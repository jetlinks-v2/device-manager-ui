import { map } from 'rxjs/operators'
import { wsClient } from '@jetlinks-web/core'
import { randomString } from '@jetlinks-web/utils'
import { ref, type Ref } from 'vue'
import { formatSessionAddressDisplay } from '../tracePayloadFormat'
import {
  MAX_TRACE_GROUPS,
  trimGroupEventsToLimit,
  trimTraceGroupsToLimit,
} from '../traceListUtils'
import { resolveLogLevelFromTracePayload } from '../traceLogLevel'
import { compareTraceEvents } from '../traceOperationLabels'

export type TraceEventItem = {
  key: string
  traceId?: string
  type?: string
  /** 后端 TraceData.logLevel（如 INFO、WARN） */
  logLevel?: string
  operation?: string
  /** 链路步骤开始时间（毫秒，与纳秒二选一或同时存在） */
  startTime?: number
  endTime?: number
  /** 纳秒时间戳（优先参与排序与展示） */
  startTimeNano?: string | number | bigint
  endTimeNano?: string | number | bigint
  detail?: string
  error?: boolean
  upstream?: boolean
  downstream?: boolean
  [k: string]: any
}

export type TraceGroup = {
  key: string
  traceId: string
  traceIds?: string[]
  messageId?: string
  upstream?: boolean
  downstream?: boolean
  events: TraceEventItem[]
}

/** 单帧内合并处理，减少排序次数与响应式触发频率 */
type Dict = Record<string, unknown>

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

  // attrs.session（DeviceSessionInfo）：默认只展示 address，不整段 stringify detail
  if (attrs && isPlainObject(attrs) && attrs.session != null) {
    const line = formatSessionAddressDisplay(attrs.session)
    return {
      detailText: line,
      fallbackMessage,
    }
  }

  // 后端 detail 改为 {attrs,events} 后，仅识别 attrs 中可展示报文；
  // 若无法识别则返回空，前端不渲染报文块。
  const detailText = extractPayloadTextFromAttrs(attrs)
  return { detailText, fallbackMessage }
}

function pickMessageIdFromPayloadLike(obj: Dict | undefined): string | undefined {
  if (!obj) return undefined
  const direct = normalizeKeyText(firstNonEmptyString([obj.messageId, obj.message_id, obj.msgId]))
  if (direct) return direct

  const headers = tryParseJsonObject(obj.headers)
  const fromHeaders = normalizeKeyText(
    firstNonEmptyString([headers?.messageId, headers?.message_id, headers?.msgId]),
  )
  if (fromHeaders) return fromHeaders

  const msg = tryParseJsonObject(obj.message)
  const fromMessage = normalizeKeyText(
    firstNonEmptyString([msg?.messageId, msg?.message_id, msg?.msgId]),
  )
  if (fromMessage) return fromMessage
  return undefined
}

function extractMessageId(detail: unknown, payload: TraceEventItem): string | undefined {
  const direct = normalizeKeyText(
    firstNonEmptyString([
      (payload as Record<string, unknown>).messageId,
      (payload as Record<string, unknown>).message_id,
      (payload as Record<string, unknown>).msgId,
    ]),
  )
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
  if (detailJson) {
    const fromDetailJson = pickMessageIdFromPayloadLike(detailJson)
    if (fromDetailJson) return fromDetailJson
  }
  return undefined
}

function eventFingerprint(ev: TraceEventItem): string {
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
  // 优先用 spanId 约束唯一性；缺失时退回内容指纹
  return span ? `${span}|${core}` : core
}

function dedupeGroupEvents(g: TraceGroup): void {
  if (!g.events.length) return
  const seen = new Set<string>()
  const deduped: TraceEventItem[] = []
  for (const ev of g.events) {
    const fp = eventFingerprint(ev)
    if (seen.has(fp)) continue
    seen.add(fp)
    deduped.push(ev)
  }
  g.events = deduped
}

function normalizeTraceIdText(v: unknown): string {
  const s = String(v ?? '').replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  return s
}

function mergeTraceIds(target: TraceGroup, source: TraceGroup): void {
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

function hasSpanRelation(a: TraceGroup, b: TraceGroup): boolean {
  const aSpan = new Set<string>()
  const aParent = new Set<string>()
  const bSpan = new Set<string>()
  const bParent = new Set<string>()
  const collect = (evs: TraceEventItem[], span: Set<string>, parent: Set<string>) => {
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

function buildEventItem(payload: TraceEventItem): TraceEventItem {
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

export function useDeviceTraceLog(deviceId: Ref<string | undefined>) {
  const traceGroups = ref<TraceGroup[]>([])
  let socketSub: { unsubscribe: () => void } | undefined

  let pendingPayloads: TraceEventItem[] = []
  let rafId: number | null = null

  const mergeGroupMeta = (target: TraceGroup, source: TraceGroup) => {
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

  const mergeDuplicateMessageIdGroups = (modifiedGroups: Set<TraceGroup>) => {
    const groupsSnapshot = [...traceGroups.value]
    const firstGroupByMessageId = new Map<string, TraceGroup>()
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
      if (removeIdx >= 0) {
        traceGroups.value.splice(removeIdx, 1)
      }
      modifiedGroups.add(first)
    }
  }

  const mergeDuplicateTraceIdGroups = (modifiedGroups: Set<TraceGroup>) => {
    const groupsSnapshot = [...traceGroups.value]
    const firstGroupByTraceId = new Map<string, TraceGroup>()
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
      if (removeIdx >= 0) {
        traceGroups.value.splice(removeIdx, 1)
      }
      modifiedGroups.add(first)
    }
  }

  const mergeBySpanRelation = (modifiedGroups: Set<TraceGroup>) => {
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
    const modifiedGroups = new Set<TraceGroup>()

    for (const raw of batch) {
      const ev = buildEventItem(raw)
      const tid = String(ev.traceId ?? '_no_trace_')
      const mid = normalizeKeyText(
        firstNonEmptyString([ev.messageId, (ev as Record<string, unknown>).message_id]),
      )
      let idxByMessage = -1
      if (mid) {
        idxByMessage = traceGroups.value.findIndex((g) => g.messageId === mid)
      }
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
        const newGroup: TraceGroup = {
          key: randomString(),
          traceId: tid,
          traceIds: normalizeTraceIdText(tid) ? [normalizeTraceIdText(tid)] : [],
          ...(mid ? { messageId: mid } : {}),
          upstream: ev.upstream,
          downstream: ev.downstream,
          events: [ev],
        }
        traceGroups.value.push(newGroup)
        modifiedGroups.add(newGroup)
      }
    }

    // 兜底：批次内若已存在多个相同 messageId 的分组，做整组归并（非单事件并入）
    mergeDuplicateMessageIdGroups(modifiedGroups)
    // 兜底：相同 traceId 的分组也应整组归并
    mergeDuplicateTraceIdGroups(modifiedGroups)
    // 兜底：按 span/parentSpan 关联归并（下发与应答跨 trace 时）
    mergeBySpanRelation(modifiedGroups)

    for (const g of modifiedGroups) {
      if (!traceGroups.value.includes(g)) continue
      dedupeGroupEvents(g)
      g.events.sort(compareTraceEvents)
      trimGroupEventsToLimit(g)
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

  const enqueue = (payload: TraceEventItem) => {
    pendingPayloads.push(payload)
    scheduleFlush()
  }

  const pushOrMergeGroup = (payload: TraceEventItem) => {
    enqueue(payload)
  }

  const subscribe = () => {
    unsubscribe()
    const id = deviceId.value
    if (!id) return
    const wsId = `device-debug-${id}`
    const topic = `/debug/device/${id}/trace`
    socketSub = wsClient
      .getWebSocket(wsId, topic, {})
      ?.pipe(map((res: any) => (res != null && res.payload !== undefined ? res.payload : res)))
      .subscribe((payload: any) => {
        const typeStr = payload?.type != null ? String(payload.type).toLowerCase() : ''
        if (typeStr === 'log') {
          pushOrMergeGroup({
            key: randomString(),
            ...payload,
            type: 'log',
          })
          return
        }
        pushOrMergeGroup({ key: randomString(), ...payload })
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
