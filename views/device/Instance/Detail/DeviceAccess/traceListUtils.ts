import type { TraceEventItem, TraceGroup } from './composables/useDeviceTraceLog'
import { compareTraceEvents, eventMaxComparableMs } from './traceOperationLabels'
import { normalizeLogLevel } from './traceLogLevel'

export type TraceFlowKind = 'uplink' | 'downlink' | 'unknown'

export type TraceListRow = {
  traceKey: string
  traceId: string
  /** 用于展示：上行 / 下行 */
  isUpstream: boolean | null
  /** 列表左侧：数据上报 / 下发指令 等 */
  flowKind: TraceFlowKind
  /** 从事件中解析的 messageType（如 READ_PROPERTY） */
  messageTypeRaw?: string
  /** 步骤链文案，如 decode → auth */
  spanChainText: string
  /** decode 优先，否则 encode 的报文预览 */
  payloadPreview: string
  /** 最后一条日志预览 */
  lastLogPreview: string
  /** 最后一条日志的 logLevel（展示标签用） */
  lastLogLevel?: string
  /** 最后一跳非 log 步骤名 */
  lastOpLabel: string
  hasError: boolean
  spanCount: number
  logCount: number
  lastTime: number
}

export function truncateText(s: string | undefined, max: number) {
  if (!s) return ''
  const t = String(s).trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** 列表原始报文：不 trim，避免改动后端 EncodedMessage.toString() 的首尾空白与换行 */
export function truncateRawPreview(s: string | undefined, max: number) {
  if (s == null || s === '') return ''
  const t = String(s)
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/**
 * 列表单行展示：多行报文（HTTP/MQTT 等）只取第一行，避免列表被换行撑高。
 * 详情抽屉仍使用完整内容。
 */
export function firstLineOnlyForListPreview(s: string | undefined): string | undefined {
  if (s == null) return undefined
  const t = String(s)
  const m = /\r\n|\r|\n/.exec(t)
  if (m && m.index != null) return t.slice(0, m.index)
  return t
}

/**
 * 按链路方向取「原始报文」：上行优先 decode（设备→平台），下行优先 encode（平台→设备）；
 * 无编解码步骤时按 request/response/handle 等兜底。
 */
export function pickRawPayloadDetail(
  nonLogSorted: TraceEventItem[],
  flowKind: TraceFlowKind,
): string | undefined {
  const decodes = nonLogSorted.filter((e) => e.operation === 'decode' && e.detail)
  const encodes = nonLogSorted.filter((e) => e.operation === 'encode' && e.detail)
  if (flowKind === 'uplink') {
    const last = decodes[decodes.length - 1]
    if (last?.detail) return String(last.detail)
    const lastE = encodes[encodes.length - 1]
    if (lastE?.detail) return String(lastE.detail)
  } else if (flowKind === 'downlink') {
    const last = encodes[encodes.length - 1]
    if (last?.detail) return String(last.detail)
    const lastD = decodes[decodes.length - 1]
    if (lastD?.detail) return String(lastD.detail)
  } else {
    const lastD = decodes[decodes.length - 1]
    if (lastD?.detail) return String(lastD.detail)
    const lastE = encodes[encodes.length - 1]
    if (lastE?.detail) return String(lastE.detail)
  }
  const priority = [
    'request',
    'response',
    'handle',
    'decode',
    'encode',
    'downstream',
    'upstream',
  ] as const
  for (const op of priority) {
    const found = [...nonLogSorted].reverse().find((e) => e.operation === op && e.detail)
    if (found?.detail) return String(found.detail)
  }
  for (let i = nonLogSorted.length - 1; i >= 0; i--) {
    const e = nonLogSorted[i]
    if (e.detail) return String(e.detail)
  }
  return undefined
}

/** 列表中 traceId 短展示：纯十六进制时形如 0xaabbccdd */
export function shortTraceDisplay(id: string): string {
  if (!id || id === '_no_trace_') return '—'
  const compact = id.replace(/-/g, '')
  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length >= 8) {
    return `0x${compact.slice(-8).toLowerCase()}`
  }
  if (id.length <= 14) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function tryParseDetailMessageType(detail?: string): string | undefined {
  if (!detail || detail[0] !== '{') return undefined
  try {
    const o = JSON.parse(detail) as { messageType?: string; message?: { messageType?: string } }
    if (typeof o.messageType === 'string' && o.messageType.trim()) return o.messageType.trim()
    const mt = o.message?.messageType
    if (typeof mt === 'string' && mt.trim()) return mt.trim()
  } catch {
    /* ignore */
  }
  return undefined
}

/** 从链路事件中提取 messageType（字段或 detail JSON） */
export function pickMessageTypeFromEvents(evs: TraceEventItem[]): string | undefined {
  for (const e of evs) {
    if (e.type === 'log') continue
    const ex = e as Record<string, unknown>
    const mt0 = ex.messageType
    if (typeof mt0 === 'string' && mt0.trim()) return mt0.trim()
    const msg = ex.message as { messageType?: string } | undefined
    if (msg?.messageType && typeof msg.messageType === 'string' && msg.messageType.trim()) {
      return msg.messageType.trim()
    }
    const fromDetail = tryParseDetailMessageType(e.detail)
    if (fromDetail) return fromDetail
  }
  return undefined
}

/**
 * 连续相同步骤名合并为「名称(次数)」，如 处理解析结果、处理解析结果 → 处理解析结果(2)
 */
export function collapseRepeatedChainLabels(parts: string[]): string[] {
  if (parts.length === 0) return []
  const out: string[] = []
  let i = 0
  while (i < parts.length) {
    const current = parts[i]
    let count = 1
    while (i + count < parts.length && parts[i + count] === current) {
      count++
    }
    out.push(count > 1 ? `${current}(${count})` : current)
    i += count
  }
  return out
}

/** 解析单段「名称」或合并后的「名称(次数)」（次数≥2） */
export function parseChainSegmentPart(seg: string): { label: string; repeat?: number } {
  const t = seg.trim()
  const m = /^(.+)\((\d+)\)$/.exec(t)
  if (m) {
    const n = Number(m[2])
    if (!Number.isNaN(n) && n >= 2) return { label: m[1].trim(), repeat: n }
  }
  return { label: t }
}

/** 将整条链文案拆成可渲染片段（用于列表高亮次数） */
export function parseChainSegmentsFromText(text: string): { label: string; repeat?: number }[] {
  if (!text) return [{ label: '—' }]
  if (text === '—') return [{ label: '—' }]
  return text.split(/\s*→\s*/).map((s) => parseChainSegmentPart(s))
}

function deriveFlowKind(
  nonLogSorted: TraceEventItem[],
  isUpstream: boolean | null,
): TraceFlowKind {
  const firstDecode = nonLogSorted.findIndex((e) => e.operation === 'decode')
  const firstEncode = nonLogSorted.findIndex((e) => e.operation === 'encode')
  const firstRequest = nonLogSorted.findIndex((e) => e.operation === 'request')
  const firstResponse = nonLogSorted.findIndex((e) => e.operation === 'response')
  // request/response 方向语义最强：链路变化后应优先按当前步骤重算
  if (firstRequest >= 0 && (firstResponse < 0 || firstRequest <= firstResponse)) return 'downlink'
  if (firstResponse >= 0 && (firstRequest < 0 || firstResponse < firstRequest)) return 'uplink'
  // 无 request/response 时，再使用分组级方向提示
  if (isUpstream === true) return 'uplink'
  if (isUpstream === false) return 'downlink'
  if (firstDecode >= 0 && (firstEncode < 0 || firstDecode < firstEncode)) return 'uplink'
  if (firstEncode >= 0 && (firstDecode < 0 || firstEncode < firstDecode)) return 'downlink'
  return 'unknown'
}

/**
 * 将一条链路聚合为列表行：解码/编码报文预览、最后一条日志、步骤链等。
 */
export function summarizeTraceGroup(
  g: TraceGroup,
  opLabel: (op?: string) => string,
): TraceListRow {
  const evs = [...g.events].sort(compareTraceEvents)
  const nonLog = evs.filter((e) => e.type !== 'log')
  const logs = evs.filter((e) => e.type === 'log')
  const lastLog = logs[logs.length - 1]
  const nonLogSorted = [...nonLog].sort(compareTraceEvents)

  const firstNonLog = nonLogSorted[0]
  const lastNonLog = nonLogSorted[nonLogSorted.length - 1]
  const lastTime = evs.length ? Math.max(...evs.map((e) => eventMaxComparableMs(e))) : 0

  /** 上下行以“首条链路”为准：先看分组级别，再看首个非 log 事件 */
  let isUpstream: boolean | null = null
  // 1）优先使用分组上的 upstream/downstream 标记（后端可直接决定整条链路方向）
  if (typeof g.upstream === 'boolean') {
    isUpstream = g.upstream
  } else if (typeof g.downstream === 'boolean') {
    isUpstream = !g.downstream
  }
  // 2）其次以首个非 log 事件为准（“第一个链路”）
  if (isUpstream === null && firstNonLog) {
    const anyFirst = firstNonLog as any
    if (typeof anyFirst.upstream === 'boolean') {
      isUpstream = anyFirst.upstream
    } else if (typeof anyFirst.downstream === 'boolean') {
      isUpstream = !anyFirst.downstream
    } else if (firstNonLog.operation === 'request') {
      isUpstream = false
    } else if (firstNonLog.operation === 'response') {
      isUpstream = true
    } else if (firstNonLog.operation === 'decode') {
      // 无显式标记时，decode 视为上行、encode 视为下行（兼容旧链路）
      isUpstream = true
    } else if (firstNonLog.operation === 'encode') {
      isUpstream = false
    }
  }
  // 3）最后再参考最后一条日志上的方向标记（有些实现只在日志上打标）
  if (isUpstream === null && lastLog) {
    const anyLast = lastLog as any
    if (typeof anyLast.upstream === 'boolean') {
      isUpstream = anyLast.upstream
    } else if (typeof anyLast.downstream === 'boolean') {
      isUpstream = !anyLast.downstream
    }
  }

  const flowKind = deriveFlowKind(nonLogSorted, isUpstream)
  const messageTypeRaw = pickMessageTypeFromEvents(evs)

  const chainParts = nonLogSorted.slice(0, 10).map((e) => opLabel(e.operation))
  const chainCollapsed = collapseRepeatedChainLabels(chainParts)
  let spanChainText = chainCollapsed.join(' → ')
  if (nonLogSorted.length > 10) spanChainText += ' → …'

  const rawPayload = pickRawPayloadDetail(nonLogSorted, flowKind)

  return {
    traceKey: g.key,
    traceId: g.traceId,
    isUpstream,
    flowKind,
    messageTypeRaw,
    spanChainText: spanChainText || '—',
    payloadPreview: truncateRawPreview(firstLineOnlyForListPreview(rawPayload), 420),
    lastLogPreview: truncateRawPreview(firstLineOnlyForListPreview(lastLog?.detail), 180),
    lastLogLevel: lastLog?.logLevel ? normalizeLogLevel(lastLog.logLevel) : undefined,
    lastOpLabel: lastNonLog ? opLabel(lastNonLog.operation) : '—',
    hasError: evs.some((e) => e.error),
    spanCount: nonLogSorted.length,
    logCount: logs.length,
    lastTime,
  }
}

export function buildTraceRows(
  groups: TraceGroup[],
  opLabel: (op?: string) => string,
): TraceListRow[] {
  return groups
    .map((g) => summarizeTraceGroup(g, opLabel))
    .sort((a, b) => b.lastTime - a.lastTime)
}

export function findGroupByKey(
  groups: TraceGroup[],
  traceKey: string,
): TraceGroup | undefined {
  return groups.find((g) => g.key === traceKey)
}

/** 抽屉内：按 startTimeNano 等纳秒键排序（见 compareTraceEvents） */
export function sortedEvents(group: TraceGroup): TraceGroup['events'] {
  return [...group.events].sort(compareTraceEvents)
}

/** WebSocket 推送上限，减轻内存与 DOM（列表 + 抽屉时间轴） */
export const MAX_TRACE_GROUPS = 50
export const MAX_EVENTS_PER_TRACE_GROUP = 300

/** 单 trace 内仅保留时间轴上最近一段事件（去掉最早一批） */
export function trimGroupEventsToLimit(g: TraceGroup): void {
  if (g.events.length <= MAX_EVENTS_PER_TRACE_GROUP) return
  g.events.sort(compareTraceEvents)
  const remove = g.events.length - MAX_EVENTS_PER_TRACE_GROUP
  if (remove > 0) g.events.splice(0, remove)
}

function groupLastActivityMs(g: TraceGroup): number {
  if (!g.events.length) return 0
  return Math.max(...g.events.map((e) => eventMaxComparableMs(e)))
}

/** 仅保留最近活跃的若干条 trace（按组内最后一条事件时间） */
export function trimTraceGroupsToLimit(groups: TraceGroup[]): TraceGroup[] {
  if (groups.length <= MAX_TRACE_GROUPS) return groups
  const scored = groups.map((g) => ({ g, last: groupLastActivityMs(g) }))
  scored.sort((a, b) => b.last - a.last)
  return scored.slice(0, MAX_TRACE_GROUPS).map((x) => x.g)
}
