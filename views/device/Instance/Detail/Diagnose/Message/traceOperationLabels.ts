import type { TraceEventItem } from './composables/useDeviceTraceLog'
import dayjs from 'dayjs'

/** 后端可能返回 string（大数）/ number / bigint */
export function parseNano(v: unknown): bigint | null {
  if (v == null || v === '') return null
  if (typeof v === 'bigint') return v === 0n ? null : v
  try {
    const s = typeof v === 'string' ? v.trim() : String(v)
    if (!s || s === 'NaN') return null
    const n = BigInt(s)
    // 0 视为未设置：否则 endTimeNano − 0 会变成「整段 epoch 纳秒」被当成耗时，出现 1774873601s 量级
    return n === 0n ? null : n
  } catch {
    return null
  }
}

/** 单段 span 耗时合理上限（纳秒），超过则改用毫秒字段或视为异常 */
const MAX_REASONABLE_SPAN_NS = 3600n * 1_000_000_000n // 1 小时

/**
 * 排序键（纳秒时间轴）：**仅用于排序** — startTimeNano → startTime(ms→ns) → endTimeNano → endTime(ms→ns)
 */
function eventSortKeyNs(ev: TraceEventItem): bigint {
  let n = parseNano((ev as { startTimeNano?: unknown }).startTimeNano)
  if (n != null) return n
  const st = ev.startTime
  if (st != null && !Number.isNaN(st) && st > 0) {
    return BigInt(Math.trunc(st)) * 1_000_000n
  }
  n = parseNano((ev as { endTimeNano?: unknown }).endTimeNano)
  if (n != null) return n
  const et = ev.endTime
  if (et != null && !Number.isNaN(et) && et > 0) {
    return BigInt(Math.trunc(et)) * 1_000_000n
  }
  return 0n
}

export function compareTraceEvents(a: TraceEventItem, b: TraceEventItem) {
  const ka = eventSortKeyNs(a)
  const kb = eventSortKeyNs(b)
  if (ka < kb) return -1
  if (ka > kb) return 1
  return 0
}

/** 纳秒时间戳 → 当日时钟 HH:mm:ss.SSS */
function formatNsAsClock(ns: bigint): string {
  const ms = Number(ns / 1_000_000n)
  return dayjs(ms).format('HH:mm:ss.SSS')
}

/**
 * 详情时间列：简化时钟 **HH:mm:ss.SSS**；展示用 **startTime**（毫秒）；无则回退 startTimeNano / endTimeNano / endTime（毫秒）
 */
export function formatDisplayEventTime(ev: TraceEventItem): string {
  const st = ev.startTime
  if (st != null && !Number.isNaN(st) && st > 0) {
    return dayjs(st).format('HH:mm:ss.SSS')
  }
  const stn = parseNano((ev as { startTimeNano?: unknown }).startTimeNano)
  if (stn != null) return formatNsAsClock(stn)
  const etn = parseNano((ev as { endTimeNano?: unknown }).endTimeNano)
  if (etn != null) return formatNsAsClock(etn)
  const et = ev.endTime
  if (et != null && !Number.isNaN(et) && et > 0) return dayjs(et).format('HH:mm:ss.SSS')
  return '—'
}

function trimDurationNum(n: number): string {
  const s = n.toFixed(3).replace(/\.?0+$/, '')
  return s === '' ? '0' : s
}

/** 纳秒差值 → 带单位文案（s / ms / µs / ns） */
function formatDurationFromNs(delta: bigint): string {
  const n = delta < 0n ? -delta : delta
  if (n === 0n) return ''
  if (n >= 1_000_000_000n) return `${trimDurationNum(Number(n) / 1e9)}s`
  if (n >= 1_000_000n) return `${trimDurationNum(Number(n) / 1e6)}ms`
  if (n >= 1_000n) return `${trimDurationNum(Number(n) / 1e3)}µs`
  return `${n}ns`
}

/** 毫秒差值（整数）→ s / ms */
function formatDurationFromMs(deltaMs: number): string {
  if (deltaMs <= 0) return ''
  if (deltaMs >= 1000) return `${trimDurationNum(deltaMs / 1000)}s`
  return `${deltaMs}ms`
}

/**
 * 单步耗时：优先 endTimeNano − startTimeNano，否则 endTime − startTime（毫秒）
 */
export function formatTraceEventDuration(ev: TraceEventItem): string {
  const stn = parseNano((ev as { startTimeNano?: unknown }).startTimeNano)
  const etn = parseNano((ev as { endTimeNano?: unknown }).endTimeNano)
  if (stn != null && etn != null) {
    const d = etn - stn
    if (d > 0n && d <= MAX_REASONABLE_SPAN_NS) {
      return formatDurationFromNs(d)
    }
  }
  const st = ev.startTime
  const et = ev.endTime
  if (
    st != null &&
    et != null &&
    !Number.isNaN(st) &&
    !Number.isNaN(et) &&
    et > st
  ) {
    return formatDurationFromMs(Math.trunc(et - st))
  }
  return ''
}

/** 详情标题用：`(1ms)`，无耗时则空串 */
export function formatTraceDurationParen(ev: TraceEventItem): string {
  const d = formatTraceEventDuration(ev)
  return d ? ` (${d})` : ''
}

/** 单条事件「墙钟」开始时间（ms），优先 startTimeNano / startTime */
function eventWallStartMs(ev: TraceEventItem): number | null {
  const stn = parseNano((ev as { startTimeNano?: unknown }).startTimeNano)
  if (stn != null) return Number(stn / 1_000_000n)
  if (ev.startTime != null && !Number.isNaN(ev.startTime) && ev.startTime > 0) {
    return ev.startTime
  }
  return null
}

/**
 * 单条事件「墙钟」结束时间（ms）：有 end 用 end，否则退回 start（点事件）
 */
function eventWallEndMs(ev: TraceEventItem): number | null {
  const etn = parseNano((ev as { endTimeNano?: unknown }).endTimeNano)
  if (etn != null) return Number(etn / 1_000_000n)
  if (ev.endTime != null && !Number.isNaN(ev.endTime) && ev.endTime > 0) {
    return ev.endTime
  }
  return eventWallStartMs(ev)
}

/**
 * 整条链路墙钟跨度：所有步骤中最早开始时间 与 最晚结束时间 的差（含日志步骤）。
 * 无任一有效开始时间则返回 null。
 */
export function computeGroupWallElapsedMs(events: TraceEventItem[]): number | null {
  if (!events.length) return null
  const starts: number[] = []
  const ends: number[] = []
  for (const ev of events) {
    let s = eventWallStartMs(ev)
    let e = eventWallEndMs(ev)
    if (s == null && e != null) s = e
    if (e == null && s != null) e = s
    if (s != null) starts.push(s)
    if (e != null) ends.push(e)
  }
  if (!starts.length || !ends.length) return null
  const minStart = Math.min(...starts)
  const maxEnd = Math.max(...ends)
  const d = maxEnd - minStart
  return Number.isFinite(d) && d >= 0 ? d : null
}

/** 链路总耗时展示：与单步耗时风格一致（ms / s） */
export function formatWallElapsedLabel(deltaMs: number): string {
  if (deltaMs <= 0) return '0ms'
  if (deltaMs >= 1000) return `${trimDurationNum(deltaMs / 1000)}s`
  return `${Math.round(deltaMs)}ms`
}

/**
 * 列表「最近时间」排序用：取事件上可能出现的最大毫秒时间（由纳秒或毫秒字段换算）
 */
export function eventMaxComparableMs(ev: TraceEventItem): number {
  const candidates: number[] = []
  const stn = parseNano((ev as { startTimeNano?: unknown }).startTimeNano)
  const etn = parseNano((ev as { endTimeNano?: unknown }).endTimeNano)
  const nsToMs = (n: bigint) => Number(n / 1_000_000n)
  if (stn != null) candidates.push(nsToMs(stn))
  if (etn != null) candidates.push(nsToMs(etn))
  if (ev.startTime != null && ev.startTime > 0) candidates.push(ev.startTime)
  if (ev.endTime != null && ev.endTime > 0) candidates.push(ev.endTime)
  return candidates.length ? Math.max(...candidates) : 0
}

/**
 * 与后端 Trace 操作常量一致，通过 i18n 展示。
 * principal：身份识别；auth：设备认证；disconnect/sessionCreated/sessionClosed：连接与会话生命周期。
 */
export function createTraceOperationLabel(t: (key: string) => string) {
  const keys: Record<string, string> = {
    connection: 'Dialog.index.786817-0',
    disconnect: 'Dialog.index.786817-10',
    sessionCreated: 'Dialog.index.786817-11',
    sessionClosed: 'Dialog.index.786817-12',
    auth: 'Dialog.index.786817-1',
    principal: 'Dialog.index.786817-9',
    decode: 'Dialog.index.786817-2',
    encode: 'Dialog.index.786817-3',
    request: 'Dialog.index.786817-4',
    response: 'Dialog.index.786817-5',
    downstream: 'Dialog.index.786817-6',
    upstream: 'Dialog.index.786817-7',
    handle: 'Dialog.index.786817-8',
  }
  return (op?: string) => {
    if (!op) return '—'
    const k = keys[op]
    return k ? t(k) : op
  }
}
