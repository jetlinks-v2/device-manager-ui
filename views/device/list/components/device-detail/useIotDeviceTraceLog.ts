import { ref, type Ref } from 'vue'
import { map } from 'rxjs/operators'
import { wsClient } from '@jetlinks-web/core'
import { randomString } from '@jetlinks-web/utils'

export type IotTraceEventItem = {
  key: string
  traceId?: string
  type?: string
  logLevel?: string
  operation?: string
  startTime?: number
  endTime?: number
  startTimeNano?: string | number | bigint
  endTimeNano?: string | number | bigint
  detail?: string
  message?: string
  error?: boolean
  upstream?: boolean
  downstream?: boolean
  [k: string]: any
}

export type IotTraceGroup = {
  key: string
  traceId: string
  traceIds?: string[]
  messageId?: string
  upstream?: boolean
  downstream?: boolean
  version?: number
  events: IotTraceEventItem[]
}

type Dict = Record<string, unknown>

const MAX_TRACE_GROUPS = 200
const MAX_EVENTS_PER_TRACE_GROUP = 300
const MAX_REASONABLE_SPAN_NS = 3600n * 1_000_000_000n

function isPlainObject(v: unknown): v is Dict {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function firstNonEmptyString(list: unknown[]): string | undefined {
  for (const v of list) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function normalizeKeyText(v: unknown): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  if (!s) return undefined
  return s.toLowerCase()
}

function toDisplayText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return safeStringify(v)
}

function tryParseJsonObject(v: unknown): Dict | undefined {
  if (isPlainObject(v)) return v
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return undefined
  try {
    const parsed = JSON.parse(t) as unknown
    return isPlainObject(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function formatSessionAddressDisplay(session: unknown): string {
  if (session == null) return ''
  if (typeof session === 'string') return session.trim()
  if (isPlainObject(session)) {
    const a = session.address ?? session.serverAddress ?? session.remoteAddress
    if (typeof a === 'string') return a.trim()
    if (a != null && typeof a !== 'object') return String(a).trim()
  }
  return ''
}

function extractPayloadTextFromAttrs(attrs: Dict | undefined): string {
  if (!attrs) return ''
  const message = toDisplayText(attrs.message)
  const response = toDisplayText(attrs.response)
  if (message && response) return `${message}\n\n${response}`
  if (message) return message
  if (response) return response
  const extra = firstNonEmptyString([toDisplayText(attrs.payload), toDisplayText(attrs.request)])
  return extra || ''
}

function extractErrorTextFromEvents(events: unknown): string | undefined {
  if (!events) return undefined
  const readErr = (obj: Dict): string | undefined => {
    const attrs = (isPlainObject(obj.attributes) ? obj.attributes : undefined) || obj
    if (!isPlainObject(attrs)) return undefined
    return firstNonEmptyString([
      attrs.exception_message,
      attrs.exceptionMessage,
      attrs.message,
      attrs.reason,
      attrs.exception_stacktrace,
      attrs.stackTrace,
      attrs.stacktrace,
    ])
  }

  if (isPlainObject(events)) {
    const direct = readErr(events)
    if (direct) return direct
    for (const v of Object.values(events)) {
      if (isPlainObject(v)) {
        const hit = readErr(v)
        if (hit) return hit
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (isPlainObject(item)) {
            const hit = readErr(item)
            if (hit) return hit
          }
        }
      }
    }
  }
  return undefined
}

function normalizeTraceDetail(detail: unknown): { detailText: string; fallbackMessage?: string } {
  if (detail == null) return { detailText: '' }
  if (typeof detail === 'string') return { detailText: detail }
  if (!isPlainObject(detail)) return { detailText: '' }

  const attrs = isPlainObject(detail.attrs)
    ? detail.attrs
    : isPlainObject(detail.attributes)
      ? detail.attributes
      : undefined
  const fallbackMessage = extractErrorTextFromEvents(detail.events)

  if (attrs && isPlainObject(attrs) && attrs.session != null) {
    return {
      detailText: formatSessionAddressDisplay(attrs.session),
      fallbackMessage,
    }
  }

  return {
    detailText: extractPayloadTextFromAttrs(attrs),
    fallbackMessage,
  }
}

function pickMessageIdFromPayloadLike(obj: Dict | undefined): string | undefined {
  if (!obj) return undefined
  const direct = normalizeKeyText(firstNonEmptyString([obj.messageId, obj.message_id, obj.msgId]))
  if (direct) return direct

  const headers = tryParseJsonObject(obj.headers)
  const fromHeaders = normalizeKeyText(firstNonEmptyString([headers?.messageId, headers?.message_id, headers?.msgId]))
  if (fromHeaders) return fromHeaders

  const msg = tryParseJsonObject(obj.message)
  return normalizeKeyText(firstNonEmptyString([msg?.messageId, msg?.message_id, msg?.msgId]))
}

function extractMessageId(detail: unknown, payload: IotTraceEventItem): string | undefined {
  const direct = normalizeKeyText(firstNonEmptyString([
    (payload as Record<string, unknown>).messageId,
    (payload as Record<string, unknown>).message_id,
    (payload as Record<string, unknown>).msgId,
  ]))
  if (direct) return direct

  if (isPlainObject(detail)) {
    const self = pickMessageIdFromPayloadLike(detail)
    if (self) return self
    const attrs = isPlainObject(detail.attrs)
      ? detail.attrs
      : isPlainObject(detail.attributes)
        ? detail.attributes
        : undefined
    if (attrs) {
      const fromAttrs = pickMessageIdFromPayloadLike(attrs)
      if (fromAttrs) return fromAttrs
      const fromAttrsMessage = pickMessageIdFromPayloadLike(tryParseJsonObject(attrs.message))
      if (fromAttrsMessage) return fromAttrsMessage
      const fromAttrsResponse = pickMessageIdFromPayloadLike(tryParseJsonObject(attrs.response))
      if (fromAttrsResponse) return fromAttrsResponse
    }
  }

  const detailJson = tryParseJsonObject(detail)
  return detailJson ? pickMessageIdFromPayloadLike(detailJson) : undefined
}

function normalizeLogLevel(logLevel?: string | null): string {
  if (logLevel == null || logLevel === '') return ''
  const t = String(logLevel).trim()
  return t ? t.toUpperCase() : ''
}

function resolveLogLevelFromTracePayload(payload: unknown): string {
  if (payload == null || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  const raw = p.logLevel ?? p.log_level ?? p.level
  return typeof raw === 'string' && raw.trim() ? normalizeLogLevel(raw) : ''
}

function eventFingerprint(ev: IotTraceEventItem): string {
  const core = [
    ev.type || '',
    ev.operation || '',
    String(ev.startTimeNano ?? ''),
    String(ev.endTimeNano ?? ''),
    String(ev.startTime ?? ''),
    String(ev.endTime ?? ''),
    String((ev as Record<string, unknown>).messageId ?? ''),
    ev.message || '',
    ev.detail || '',
  ].join('|')
  const span = firstNonEmptyString([ev.spanId, (ev as Record<string, unknown>).span_id])
  return span ? `${span}|${core}` : core
}

function dedupeGroupEvents(g: IotTraceGroup): void {
  if (!g.events.length) return
  const seen = new Set<string>()
  const deduped: IotTraceEventItem[] = []
  for (const ev of g.events) {
    const fp = eventFingerprint(ev)
    if (seen.has(fp)) continue
    seen.add(fp)
    deduped.push(ev)
  }
  g.events = deduped
}

function normalizeTraceIdText(v: unknown): string {
  return String(v ?? '').replace(/[^0-9a-fA-F]/g, '').toLowerCase()
}

function mergeTraceIds(target: IotTraceGroup, source: IotTraceGroup): void {
  const set = new Set<string>()
  const add = (v: string | undefined) => {
    const n = normalizeTraceIdText(v)
    if (n) set.add(n)
  }
  add(target.traceId)
  add(source.traceId)
  ;(target.traceIds || []).forEach((id) => add(id))
  ;(source.traceIds || []).forEach((id) => add(id))
  target.traceIds = [...set]
}

function hasSpanRelation(a: IotTraceGroup, b: IotTraceGroup): boolean {
  const aSpan = new Set<string>()
  const aParent = new Set<string>()
  const bSpan = new Set<string>()
  const bParent = new Set<string>()
  const collect = (evs: IotTraceEventItem[], span: Set<string>, parent: Set<string>) => {
    for (const ev of evs) {
      const s = firstNonEmptyString([ev.spanId, (ev as Record<string, unknown>).span_id])
      const p = firstNonEmptyString([ev.parentSpanId, (ev as Record<string, unknown>).parent_span_id])
      if (s) span.add(String(s))
      if (p) parent.add(String(p))
    }
  }
  collect(a.events, aSpan, aParent)
  collect(b.events, bSpan, bParent)
  if (!aSpan.size || !bSpan.size) return false
  for (const s of aSpan) if (bParent.has(s)) return true
  for (const s of bSpan) if (aParent.has(s)) return true
  return false
}

function parseNano(v: unknown): bigint | null {
  if (v == null || v === '') return null
  if (typeof v === 'bigint') return v === 0n ? null : v
  try {
    const s = typeof v === 'string' ? v.trim() : String(v)
    if (!s || s === 'NaN') return null
    const n = BigInt(s)
    return n === 0n ? null : n
  } catch {
    return null
  }
}

function eventSortKeyNs(ev: IotTraceEventItem): bigint {
  let n = parseNano(ev.startTimeNano)
  if (n != null) return n
  const st = ev.startTime
  if (st != null && !Number.isNaN(st) && st > 0) return BigInt(Math.trunc(st)) * 1_000_000n
  n = parseNano(ev.endTimeNano)
  if (n != null) return n
  const et = ev.endTime
  if (et != null && !Number.isNaN(et) && et > 0) return BigInt(Math.trunc(et)) * 1_000_000n
  return 0n
}

export function compareIotTraceEvents(a: IotTraceEventItem, b: IotTraceEventItem) {
  const ka = eventSortKeyNs(a)
  const kb = eventSortKeyNs(b)
  if (ka < kb) return -1
  if (ka > kb) return 1
  return 0
}

function eventMaxComparableMs(ev: IotTraceEventItem): number {
  const candidates: number[] = []
  const nsToMs = (n: bigint) => Number(n / 1_000_000n)
  const stn = parseNano(ev.startTimeNano)
  const etn = parseNano(ev.endTimeNano)
  if (stn != null) candidates.push(nsToMs(stn))
  if (etn != null) candidates.push(nsToMs(etn))
  if (ev.startTime != null && ev.startTime > 0) candidates.push(ev.startTime)
  if (ev.endTime != null && ev.endTime > 0) candidates.push(ev.endTime)
  return candidates.length ? Math.max(...candidates) : 0
}

function trimDurationNum(n: number): string {
  const s = n.toFixed(3).replace(/\.?0+$/, '')
  return s === '' ? '0' : s
}

function formatDurationFromNs(delta: bigint): string {
  const n = delta < 0n ? -delta : delta
  if (n === 0n) return ''
  if (n >= 1_000_000_000n) return `${trimDurationNum(Number(n) / 1e9)}s`
  if (n >= 1_000_000n) return `${trimDurationNum(Number(n) / 1e6)}ms`
  if (n >= 1_000n) return `${trimDurationNum(Number(n) / 1e3)}µs`
  return `${n}ns`
}

function formatDurationFromMs(deltaMs: number): string {
  if (deltaMs <= 0) return ''
  if (deltaMs >= 1000) return `${trimDurationNum(deltaMs / 1000)}s`
  return `${deltaMs}ms`
}

export function formatIotTraceEventDuration(ev: IotTraceEventItem): string {
  const stn = parseNano(ev.startTimeNano)
  const etn = parseNano(ev.endTimeNano)
  if (stn != null && etn != null) {
    const d = etn - stn
    if (d > 0n && d <= MAX_REASONABLE_SPAN_NS) return formatDurationFromNs(d)
  }
  const st = ev.startTime
  const et = ev.endTime
  if (st != null && et != null && !Number.isNaN(st) && !Number.isNaN(et) && et > st) {
    return formatDurationFromMs(Math.trunc(et - st))
  }
  return ''
}

export function formatIotTraceEventTime(ev: IotTraceEventItem): string {
  const ms = eventMaxComparableMs(ev)
  if (!ms) return '-'
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (input: number, width = 2) => String(input).padStart(width, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

function groupLastActivityMs(g: IotTraceGroup): number {
  if (!g.events.length) return 0
  return Math.max(...g.events.map((e) => eventMaxComparableMs(e)))
}

export function iotTraceGroupLastTime(g: IotTraceGroup): number {
  return groupLastActivityMs(g)
}

function trimGroupEventsToLimit(g: IotTraceGroup): void {
  if (g.events.length <= MAX_EVENTS_PER_TRACE_GROUP) return
  g.events.sort(compareIotTraceEvents)
  const remove = g.events.length - MAX_EVENTS_PER_TRACE_GROUP
  if (remove > 0) g.events.splice(0, remove)
}

function trimTraceGroupsToLimit(groups: IotTraceGroup[]): IotTraceGroup[] {
  if (groups.length <= MAX_TRACE_GROUPS) return groups
  return groups
    .map((g) => ({ g, last: groupLastActivityMs(g) }))
    .sort((a, b) => b.last - a.last)
    .slice(0, MAX_TRACE_GROUPS)
    .map((x) => x.g)
}

function buildEventItem(payload: IotTraceEventItem): IotTraceEventItem {
  const messageId = extractMessageId(payload.detail, payload)
  const { detailText, fallbackMessage } = normalizeTraceDetail(payload.detail)
  const resolvedMessage = firstNonEmptyString([payload.message, payload.errorMessage, fallbackMessage])
  const resolvedLevel = resolveLogLevelFromTracePayload(payload)
  return {
    ...payload,
    key: payload.key || randomString(),
    detail: detailText,
    ...(messageId ? { messageId } : {}),
    ...(resolvedMessage ? { message: resolvedMessage } : {}),
    ...(resolvedLevel ? { logLevel: resolvedLevel } : {}),
  }
}

function markTraceGroupUpdated(group: IotTraceGroup): void {
  group.version = (typeof group.version === 'number' ? group.version : 0) + 1
}

export function useIotDeviceTraceLog(deviceId: Ref<string | undefined>) {
  const traceGroups = ref<IotTraceGroup[]>([])
  let socketSub: { unsubscribe: () => void } | undefined
  let pendingPayloads: IotTraceEventItem[] = []
  let rafId: number | null = null

  const mergeGroupMeta = (target: IotTraceGroup, source: IotTraceGroup) => {
    if (!target.messageId && source.messageId) target.messageId = source.messageId
    mergeTraceIds(target, source)
    if (typeof source.upstream === 'boolean') {
      if (typeof target.upstream !== 'boolean') target.upstream = source.upstream
      else if (target.upstream !== source.upstream) target.upstream = undefined
    }
    if (typeof source.downstream === 'boolean') {
      if (typeof target.downstream !== 'boolean') target.downstream = source.downstream
      else if (target.downstream !== source.downstream) target.downstream = undefined
    }
  }

  const mergeGroupsByIndex = (targetIdx: number, sourceIdx: number): number => {
    if (targetIdx === sourceIdx) return targetIdx
    const groups = traceGroups.value
    const target = groups[targetIdx]
    const source = groups[sourceIdx]
    if (!target || !source) return targetIdx
    target.events.push(...source.events)
    mergeGroupMeta(target, source)
    dedupeGroupEvents(target)
    groups.splice(sourceIdx, 1)
    return sourceIdx < targetIdx ? targetIdx - 1 : targetIdx
  }

  const mergeDuplicateMessageIdGroups = (modifiedGroups: Set<IotTraceGroup>) => {
    const groupsSnapshot = [...traceGroups.value]
    const firstGroupByMessageId = new Map<string, IotTraceGroup>()
    for (const g of groupsSnapshot) {
      if (!g.messageId) continue
      const first = firstGroupByMessageId.get(g.messageId)
      if (!first) {
        firstGroupByMessageId.set(g.messageId, g)
        continue
      }
      if (first === g) continue
      first.events.push(...g.events)
      mergeGroupMeta(first, g)
      dedupeGroupEvents(first)
      const removeIdx = traceGroups.value.indexOf(g)
      if (removeIdx >= 0) traceGroups.value.splice(removeIdx, 1)
      modifiedGroups.add(first)
    }
  }

  const mergeDuplicateTraceIdGroups = (modifiedGroups: Set<IotTraceGroup>) => {
    const groupsSnapshot = [...traceGroups.value]
    const firstGroupByTraceId = new Map<string, IotTraceGroup>()
    for (const g of groupsSnapshot) {
      const tid = String(g.traceId ?? '_no_trace_')
      const first = firstGroupByTraceId.get(tid)
      if (!first) {
        firstGroupByTraceId.set(tid, g)
        continue
      }
      if (first === g) continue
      first.events.push(...g.events)
      mergeGroupMeta(first, g)
      dedupeGroupEvents(first)
      const removeIdx = traceGroups.value.indexOf(g)
      if (removeIdx >= 0) traceGroups.value.splice(removeIdx, 1)
      modifiedGroups.add(first)
    }
  }

  const mergeBySpanRelation = (modifiedGroups: Set<IotTraceGroup>) => {
    let changed = true
    while (changed) {
      changed = false
      const list = traceGroups.value
      outer: for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]
          const b = list[j]
          if (!a || !b) continue
          if (!hasSpanRelation(a, b)) continue
          a.events.push(...b.events)
          mergeGroupMeta(a, b)
          dedupeGroupEvents(a)
          list.splice(j, 1)
          modifiedGroups.add(a)
          changed = true
          break outer
        }
      }
    }
  }

  const findGroupIndexByTraceId = (traceId: string): number => {
    const n = normalizeTraceIdText(traceId)
    if (!n) return -1
    return traceGroups.value.findIndex((g) => {
      const primary = normalizeTraceIdText(g.traceId)
      if (primary === n) return true
      return (g.traceIds || []).some((id) => normalizeTraceIdText(id) === n)
    })
  }

  const flushPending = () => {
    if (!pendingPayloads.length) return
    const batch = pendingPayloads
    pendingPayloads = []
    const modifiedGroups = new Set<IotTraceGroup>()

    for (const raw of batch) {
      const ev = buildEventItem(raw)
      const tid = String(ev.traceId ?? '_no_trace_')
      const mid = normalizeKeyText(firstNonEmptyString([ev.messageId, (ev as Record<string, unknown>).message_id]))
      let idxByMessage = -1
      if (mid) idxByMessage = traceGroups.value.findIndex((g) => g.messageId === mid)
      let idxByTrace = findGroupIndexByTraceId(tid)
      if (idxByMessage >= 0 && idxByTrace >= 0 && idxByMessage !== idxByTrace) {
        idxByMessage = mergeGroupsByIndex(idxByMessage, idxByTrace)
        idxByTrace = idxByMessage
      }
      const idx = idxByMessage >= 0 ? idxByMessage : idxByTrace
      if (idx >= 0) {
        const g = traceGroups.value[idx]
        g.events.push(ev)
        if (mid && !g.messageId) g.messageId = mid
        if (typeof ev.upstream === 'boolean') {
          if (typeof g.upstream !== 'boolean') g.upstream = ev.upstream
          else if (g.upstream !== ev.upstream) g.upstream = undefined
        }
        if (typeof ev.downstream === 'boolean') {
          if (typeof g.downstream !== 'boolean') g.downstream = ev.downstream
          else if (g.downstream !== ev.downstream) g.downstream = undefined
        }
        modifiedGroups.add(g)
      } else {
        const newGroup: IotTraceGroup = {
          key: randomString(),
          traceId: tid,
          traceIds: normalizeTraceIdText(tid) ? [normalizeTraceIdText(tid)] : [],
          ...(mid ? { messageId: mid } : {}),
          upstream: ev.upstream,
          downstream: ev.downstream,
          version: 0,
          events: [ev],
        }
        traceGroups.value.push(newGroup)
        modifiedGroups.add(newGroup)
      }
    }

    mergeDuplicateMessageIdGroups(modifiedGroups)
    mergeDuplicateTraceIdGroups(modifiedGroups)
    mergeBySpanRelation(modifiedGroups)

    for (const g of modifiedGroups) {
      if (!traceGroups.value.includes(g)) continue
      dedupeGroupEvents(g)
      g.events.sort(compareIotTraceEvents)
      trimGroupEventsToLimit(g)
      markTraceGroupUpdated(g)
    }

    if (traceGroups.value.length > MAX_TRACE_GROUPS) {
      traceGroups.value = trimTraceGroupsToLimit(traceGroups.value)
    }
  }

  const scheduleFlush = () => {
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      flushPending()
    })
  }

  const enqueue = (payload: IotTraceEventItem) => {
    pendingPayloads.push(payload)
    scheduleFlush()
  }

  const subscribe = () => {
    unsubscribe()
    const id = deviceId.value
    if (!id) return
    socketSub = wsClient
      .getWebSocket(`iot-device-debug-${id}`, `/debug/device/${id}/trace`, {})
      ?.pipe(map((res: any) => (res != null && res.payload !== undefined ? res.payload : res)))
      .subscribe((payload: any) => {
        const typeStr = payload?.type != null ? String(payload.type).toLowerCase() : ''
        enqueue({
          key: randomString(),
          ...payload,
          ...(typeStr === 'log' ? { type: 'log' } : {}),
        })
      })
  }

  const unsubscribe = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    flushPending()
    socketSub?.unsubscribe()
    socketSub = undefined
  }

  const clear = () => {
    pendingPayloads = []
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    traceGroups.value = []
  }

  return {
    traceGroups,
    subscribe,
    unsubscribe,
    clear,
  }
}
