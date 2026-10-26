import type { MBeanDescriptor, MBeanAttribute, MBeanOperation, ThreadSnapshot, TraceSpan, TraceEvent, LogEntry, MetricChart, MetricSample } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { nanosText } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import type { RawThread, RawSpan, DiagnosticNode } from '../../../api/link/diagnostics'
import type { loadResourceOverviewHistory } from '../../../visDashboard/SystemMonitor/services/history'
import type { MonitorMetric } from '../../../visDashboard/SystemMonitor/utils/monitorData'
import { formatNetworkSize, formatNetworkCount, formatNetworkPercent, type NetworkSeriesKind } from '../../../visDashboard/SystemMonitor/utils/networkData'

/** 实例固定为当前nodeId；图表与旧总览共用归一化，不修改其节点聚焦缓存。 */
export function nodeMetricCharts(history: Awaited<ReturnType<typeof loadResourceOverviewHistory>> | undefined, nodeId: string, t: (key: string) => string): MetricChart[] {
  const resource = (metric: MonitorMetric, label: string, color: string) => ({ key: metric, label: t(label), color,
    samples: history?.[metric].find(series => series.nodeId === nodeId)?.points.map(point => ({ timestamp: point.timestamp, value: point.percent })) ?? [] })
  const network = (key: Exclude<NetworkSeriesKind, 'trafficUp' | 'trafficDown'>, label: string, color: string) => ({ key, label: t(label), color,
    samples: (history?.network.series[key][nodeId]?._data ?? []).flatMap(point =>
      Array.isArray(point) && Number.isFinite(Number(point[0])) ? [{ timestamp: Number(point[0]), value: numericMetric(point[1]) }] : []) })
  const traffic = (key: 'trafficUp' | 'trafficDown', label: string, color: string) => ({ key, label: t(label), color,
    samples: history?.traffic.timestamps.map((timestamp, index) => ({ timestamp, value: numericMetric(history.traffic.series[key][nodeId]?._data[index]) })) ?? [] })
  const hostScope = t('components.NetworkTrend.systemScopeTooltip')
  return [
    { key: 'cpu', label: 'CPU', unit: '%', max: 100, series: [resource('cpuSystem', 'runtimeDiagnostics.hostCpu', '#86909c'), resource('cpuJvm', 'runtimeDiagnostics.cpu', '#165dff')] },
    { key: 'memory', label: t('runtimeDiagnostics.memory'), unit: '%', max: 100, series: [resource('memorySystem', 'runtimeDiagnostics.systemMemory', '#86909c'), resource('memoryJvm', 'runtimeDiagnostics.heap', '#165dff')] },
    { key: 'hostTraffic', label: t('components.NetworkTrend.hostTraffic'), description: hostScope, formatValue: value => `${formatNetworkSize(value)}/s`,
      series: [network('hostReceive', 'components.NetworkTrend.receive', '#165dff'), network('hostSend', 'components.NetworkTrend.send', '#14b8a6')] },
    { key: 'traffic', label: t('components.NetworkTrend.businessTraffic'), description: t('components.NetworkTrend.trafficScopeTooltip'), formatValue: formatNetworkSize,
      series: [traffic('trafficUp', 'DeviceAccess.index.594346-26', '#165dff'), traffic('trafficDown', 'DeviceAccess.index.594346-27', '#14b8a6')] },
    { key: 'quality', label: t('components.NetworkTrend.quality'), description: hostScope, unit: '%', formatValue: formatNetworkPercent,
      series: [network('packetLoss', 'components.NetworkTrend.packetLoss', '#ff7d00'), network('interfaceErrors', 'components.NetworkTrend.interfaceErrors', '#f53f3f'), network('tcpRetransmission', 'components.NetworkTrend.retransmission', '#722ed1')] },
    { key: 'tcpConnections', label: t('components.NetworkTrend.connections'), description: hostScope, minInterval: 1, formatValue: formatNetworkCount,
      series: [network('tcpConnections', 'components.NetworkTrend.connections', '#165dff')] },
  ]
}

/** 缺测不转成0，保留counter首点、回退和不可用时的图表断点。 */
function numericMetric(value: unknown): MetricSample['value'] {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
/** detailed契约保留完整ObjectName；旧服务只能读属性，不能推测身份后调用。 */
export function normalizeMBeans(raw: Record<string, unknown>, requireMetadata = false): MBeanDescriptor[] {
  const beans: MBeanDescriptor[] = []
  for (const [domain, types] of Object.entries(raw)) for (const [type, items] of Object.entries(object(types))) for (const [key, value] of Object.entries(object(items))) {
    const data = object(value)
    const canonical = typeof data['@objectName'] === 'string' ? data['@objectName'] : undefined
    if (requireMetadata && !canonical) throw Object.assign(new Error('MBean metadata unavailable'), { status: 501 })
    const metadata = Array.isArray(data['@attributes']) ? data['@attributes'] as MBeanAttribute[] : Object.keys(data).filter(name => !name.startsWith('@')).map(name => ({ name, type: '', readable: true, available: true }))
    beans.push({ domain, type, name: String(data['@name'] ?? key), objectName: canonical ?? `${domain}:${type}:${key}`,
      attributes: metadata.map(attribute => ({ ...attribute, value: data[attribute.name] })),
      operations: canonical && Array.isArray(data['@operations']) ? data['@operations'] as MBeanOperation[] : [] })
  }
  return beans.sort((a, b) => a.objectName.localeCompare(b.objectName))
}
export function normalizeThreads(raw: RawThread[]): ThreadSnapshot[] {
  const sampledAt = Date.now()
  return raw.map(thread => ({ id: String(thread.threadId), name: thread.threadName, state: thread.threadState, sampledAt,
    lock: [thread.lockName, thread.lockOwnerName].filter(Boolean).join(' · '),
    lockOwner: thread.lockOwnerName ? { id: thread.lockOwnerId === undefined ? undefined : String(thread.lockOwnerId), name: thread.lockOwnerName } : undefined,
    blockedCount: thread.blockedCount, blockedTime: thread.blockedTime, waitedCount: thread.waitedCount, waitedTime: thread.waitedTime, inNative: thread.inNative, suspended: thread.suspended,
    stack: (thread.stackTrace ?? []).map(frame => `${frame.className}.${frame.methodName}(${frame.fileName ?? ''}:${frame.lineNumber ?? ''})`).join('\n') }))
}
export function normalizeTrace(raw: RawSpan[], nodes: DiagnosticNode[] = []): TraceSpan[] {
  return raw.map(span => {
    const events = normalizeTraceEvents(span.events)
    const aliases = nodes.filter(node => node.alias === span.app)
    const node = span.app && span.app !== 'default' ? nodes.find(node => node.id === span.app) ?? (aliases.length === 1 ? aliases[0] : undefined) : undefined
    return { id: span.spanId, parentId: span.parentSpanId, name: span.name, traceId: span.traceId, nodeId: node?.id, app: span.app,
      startNanos: nanosText(span.startWithNanos, span.startWithNanosText) ?? '', endNanos: nanosText(span.endWithNanos, span.endWithNanosText) ?? '', attributes: span.attributes, events,
      error: events.some(event => event.name === 'exception') }
  })
}
/** 仅明确异常事件标红；业务属性中出现error字样不代表Span失败。 */
function normalizeTraceEvents(events?: unknown[]): TraceEvent[] {
  return (events ?? []).flatMap(value => {
    const event = object(value)
    return typeof event.name === 'string' ? [{ name: event.name, epochNanos: nanosText(event.epochNanos), attributes: object(event.attributes) }] : []
  })
}
const logTimestamp = '(\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}(?:[.,]\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?)'
const bootLogHeader = new RegExp(`^${logTimestamp}\\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\\s+\\d+\\s+---\\s+(?:\\[[^\\]]*\\]\\s+)?\\[([^\\]]+)\\]\\s+\\S+\\s*:\\s?(.*)$`)
const standardLogHeader = new RegExp(`^${logTimestamp}\\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\\s+\\[([^\\]]+)\\]\\s+\\S+\\s+[-:]\\s?(.*)$`)
const javaFrame = /^\s*at\s+[\w$./<>+\-]+\.[\w$<>]+\([^)]*\)\s*$/
const javaContinuation = /^\s*(?:(?:Caused by:|Suppressed:)\s*\S.*|\.\.\.\s*\d+\s+(?:more|frames? excluded|common frames? omitted)|\[CIRCULAR REFERENCE:.*\])\s*$/
const reactorBanner = /^\s*(?:Error has been observed at the following site\(s\):|Original Stack Trace:|Assembly trace from producer \[.*\]\s*:)\s*$/
const reactorTree = /^\s*[|*+_][|*_+\s]*(?:checkpoint|[\w.$]+)\s*(?:⇢|->)\s*.+$/
const reactorAssemblyFrame = /^\s+[\w$./<>+\-]+\.[\w$<>]+\([^)]*\)\s*$/
const messageField = /^\s*(?:[\w.$/-]+|"[^"\n]+"|'[^'\n]+')\s*[:=]\s*\S.*$/
const messageSentinel = /^\s*<[^<>\r\n]+>\s*$/
const independentLogPrefix = /^(?:\[\w[^\]\r\n]*\]\s+\S|\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}|<\d{1,3}>\S)/
/** 只对已明确进入的结构块计数；引号内括号不参与判断，普通文案中的括号不建立多行归属。 */
function messageBracketDelta(text: string) {
  let quote = '', escaped = false, delta = 0
  for (const char of text) {
    if (escaped) { escaped = false; continue }
    if (char === '\\' && quote) { escaped = true; continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if ('{[('.includes(char)) delta++
    if ('}])'.includes(char)) delta--
  }
  return delta
}
/** 通常的Throwable命名可直接识别；其他自定义类型需由后续栈证据确认，避免吞掉普通命名文本。 */
function isThrowableHeader(text: string, followsStack: boolean) {
  const value = text.trim().replace(/^Exception in thread "[^"]+"\s+/, '')
  return /^(?:[\w$]+\.)*[\w$]*(?:Exception|Error|Throwable)(?::.*)?$/.test(value)
    || followsStack && /^(?:[\w$]+\.)+[A-Z][\w$]*:.*$/.test(value)
}
/** 完整头始终开启新记录；缩进/结构块/连续字段构成普通多行消息，异常栈另存，未知独立行不附会元数据。 */
export function normalizeLogs(lines: string[], windowStart = 0): LogEntry[] {
  const entries: LogEntry[] = []
  let structured: LogEntry | undefined, exception: LogEntry | undefined, reactor = false, messageMode = false, fieldMode = false, payloadMode = false, blockDepth = 0
  let blanks: Array<{ text: string; index: number }> = []
  const nextText: string[] = []
  for (let index = lines.length - 1, next = ''; index >= 0; index--) { nextText[index] = next; if (lines[index].trim()) next = lines[index] }
  const create = (text: string, index: number, header?: RegExpMatchArray | null) => {
    const entry: LogEntry = { id: `${windowStart}:${index}`, text, raw: text, time: header?.[1], level: header?.[2], thread: header?.[3],
      message: header?.[4] ?? text, traceId: text.match(/(?:traceId|trace_id)["\s:=]+([a-f\d]{32}|[a-f\d]{16})\b/i)?.[1] }
    entries.push(entry)
    return entry
  }
  const append = (entry: LogEntry, text: string, kind: 'message' | 'stack' = 'stack') => {
    entry.text += `\n${text}`; entry.raw = entry.text
    if (kind === 'message') entry.message = `${entry.message ?? ''}\n${text}`
    else entry.stack = entry.stack === undefined ? text : `${entry.stack}\n${text}`
  }
  const flushBlanks = (owner?: LogEntry, kind: 'message' | 'stack' = 'stack') => {
    blanks.forEach(({ text, index }) => owner ? append(owner, text, kind) : create(text, index))
    blanks = []
  }
  lines.forEach((text, index) => {
    // 平台沿用Spring Boot文件格式；只有完整结构匹配才拆列，消息中的ERROR或[]不猜为字段。
    const header = text.match(bootLogHeader) ?? text.match(standardLogHeader)
    if (header) {
      flushBlanks(exception ?? (messageMode ? structured : undefined), exception ? 'stack' : 'message')
      structured = create(text, index, header)
      exception = isThrowableHeader(header[4], false) ? structured : undefined
      reactor = false; messageMode = false; fieldMode = false; payloadMode = false
      blockDepth = /[({[]\s*$/.test(header[4]) ? Math.max(0, messageBracketDelta(header[4])) : 0
      return
    }
    if (!text.trim()) { blanks.push({ text, index }); return }
    const next = nextText[index]
    const throwable = isThrowableHeader(text, javaFrame.test(next) || javaContinuation.test(next) || reactorBanner.test(next))
    const banner = reactorBanner.test(text)
    const continuation = blockDepth === 0 && (throwable || javaFrame.test(text) || javaContinuation.test(text) || banner
      || reactor && (reactorTree.test(text) || reactorAssemblyFrame.test(text)))
    if (continuation) {
      const owner = exception ?? structured
      flushBlanks(owner)
      exception = owner ?? create(text, index)
      if (owner) append(owner, text)
      if (banner) reactor = true
      return
    }
    const field = messageField.test(text), fieldBlock = field && messageField.test(next)
    const indented = /^\s+\S/.test(text)
    // 连续字段已证明消息块；空行之后是该块的payload，遇到新日志前缀或Throwable立即结束归属。
    const payloadStart = fieldMode && blanks.length > 0 && !independentLogPrefix.test(text)
    const explicitBlockStart = structured && /:\s*$/.test(structured.message ?? '') && /^[({[]\s*$/.test(text)
    const messageEvidence = structured ? indented || blockDepth > 0 || fieldBlock || explicitBlockStart || payloadStart || payloadMode
      || messageMode && (field || messageSentinel.test(text) || /^\s*[}\])]+[;,]?\s*$/.test(text)) : fieldBlock
    const messageContinuation = !exception && !independentLogPrefix.test(text) && messageEvidence
    if (messageContinuation) {
      const owner = structured
      flushBlanks(owner, 'message')
      if (owner) append(owner, text, 'message')
      else structured = create(text, index)
      messageMode = true
      fieldMode ||= fieldBlock
      payloadMode ||= payloadStart
      blockDepth = blockDepth > 0 || /[({[]\s*$/.test(text) ? Math.max(0, blockDepth + messageBracketDelta(text)) : 0
      return
    }
    flushBlanks(exception ?? (messageMode ? structured : undefined), exception ? 'stack' : 'message')
    create(text, index)
    structured = undefined; exception = undefined; reactor = false; messageMode = false; fieldMode = false; payloadMode = false; blockDepth = 0
  })
  flushBlanks(exception ?? (messageMode ? structured : undefined), exception ? 'stack' : 'message')
  return entries
}
