import { request } from '@jetlinks-web/core'
import type { MBeanInvocation, LogFile } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { collectDiagnosticStream, streamDiagnostic } from './diagnosticStream'

export interface Envelope<T> { success?: boolean; result?: T; message?: string }
/** 失败信封不能伪装为空数据；所有诊断请求都必须显式指定实际节点。 */
export async function diagnosticResult<T>(pending: Promise<Envelope<T>>): Promise<T> {
  const response = await pending
  if (!response.success || response.result === undefined) throw Object.assign(new Error(response.message || 'Diagnostic request failed'), { status: (response as { status?: number }).status })
  return response.result
}
const segment = encodeURIComponent
const monitor = '/system/monitor'
export interface DiagnosticNode { id: string; alias?: string }
/** 节点发现与指标读取分别授权；复用已有监控成员接口。 */
export const queryMonitorNodes = (signal: AbortSignal) => diagnosticResult<DiagnosticNode[]>(request.get(`${monitor}/members`, {}, { signal }))
export const queryMBeans = (nodeId: string, signal: AbortSignal, pattern = '*:*', attributes?: string[]) => diagnosticResult<Record<string, unknown>>(request.get(`${monitor}/mbean/${segment(pattern)}`, { serverId: nodeId, detailed: true, attributes: attributes?.join(',') }, { signal }))
/** 集群Buffer只读少量计数，不发现整棵MBean树或执行操作。 */
export const queryBufferMBeans = (nodeId: string, signal: AbortSignal) => queryMBeans(nodeId, signal, 'org.jetlinks:type=PersistenceBuffer,*', ['Remainder', 'DeadSize', 'Monitor', 'WriterPending', 'Wip'])
/** 会话能力只按精确 MBean 与两个轻量计数发现，不枚举会话正文。 */
export const querySessionMBeans = (nodeId: string, signal: AbortSignal) => queryMBeans(nodeId, signal, 'org.jetlinks:type=DeviceSessionManager,*', ['Sessions', 'KeepOnlineSize'])
/** 节点级网关通信累计；精确读取单个只读 MBean，不扫描或查询单设备。 */
export const queryDeviceMessageMBeans = (nodeId: string, signal: AbortSignal) => queryMBeans(nodeId, signal, 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor', ['StartTime', 'SnapshotTime', 'ReceivedBytesTotal', 'SentBytesTotal', 'UpstreamMessagesTotal', 'PropertyReportsTotal', 'PropertyValuesTotal', 'EventReportsTotal', 'ReceivedPacketsTotal', 'SentPacketsTotal', 'QpsSnapshot'])
/** 仅当前节点读取秒级历史；大的一小时响应只在用户定位峰值时请求。 */
export const queryDeviceMessageRecording = (nodeId: string, signal: AbortSignal, hour = false) => queryMBeans(nodeId, signal, 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor', ['HistorySummary', hour ? 'HourHistory' : 'RecentHistory'])
export const queryDeviceSessions = (deviceId: string, signal: AbortSignal) => diagnosticResult<unknown[]>(request.get(`/device/instance/${segment(deviceId)}/sessions`, {}, { signal }))
/** 前三个源位置稳定；堆证据独立轻读，属性缓存仅在会话能力确认后读取。 */
export const queryOperationalMBeans = (nodeId: string, signal: AbortSignal, includeCache = false) => Promise.allSettled([
  queryMBeans(nodeId, signal, 'org.jetlinks:type=EventBus,*', ['StructuredBufferedEventCount', 'StructuredPendingSyncPeerCount']),
  includeCache ? queryMBeans(nodeId, signal, 'org.jetlinks:type=ThingsDataManager,*', ['InMemorySize', 'DirtyCount', 'QueueDepth', 'LastCommitTime', 'LastFlushDuration']) : Promise.resolve({}),
  queryMBeans(nodeId, signal, 'org.jetlinks:type=SystemMonitorCollector,*', ['LastFailureTime', 'LastSuccessTime']),
  queryMBeans(nodeId, signal, 'java.lang:type=Memory', ['HeapMemoryUsage']),
])
/** JVM概览保留启动身份用于识别短时重启；运行时长仅在建立或更新基线时读取。 */
export async function queryOverviewMBeans(nodeId: string, signal: AbortSignal, includeLifetime = true) {
  const source = await queryMBeans(nodeId, signal, 'java.lang:*', ['StartTime', ...(includeLifetime ? ['Uptime'] : []), 'ThreadCount', 'PeakThreadCount', 'DaemonThreadCount', 'CollectionCount', 'CollectionTime'])
  return { sources: [source], partial: false }
}
export const sampleThreads = (nodeId: string, signal: AbortSignal) => collectDiagnosticStream(streamDiagnostic<RawThread>(nodeId, 'thread', signal), signal)
export const invokeMBean = (nodeId: string, invocation: MBeanInvocation, signal: AbortSignal) => request.post(`${monitor}/mbean/${segment(invocation.bean.objectName)}/${segment(invocation.operation.name)}/_invoke`, invocation.args, { params: { serverId: nodeId, signature: invocation.operation.signature.join(',') }, signal })
/** TracingController返回Flux裸数组；仅兼容标准成功信封，不把失败或未知形状当空结果。 */
export async function queryTrace(traceId: string, signal: AbortSignal): Promise<RawSpan[]> {
  const response: unknown = await request.get(`/system/trace/${segment(traceId)}`, {}, { signal, timeout: 20000 })
  return traceResponse(response, traceId)
}
/** 只代理对应边缘的只读链路接口；边缘资产与代理权限由现有后端入口校验。 */
export async function queryEdgeTrace(target: EdgeTraceTarget, traceId: string, signal: AbortSignal): Promise<RawSpan[]> {
  const response: unknown = await request.get(`/edge/${segment(target.thingType)}/${segment(target.thingId)}/_/system/trace/${segment(traceId)}`, {}, { signal, timeout: 10000, hiddenError: true })
  return traceResponse(response, traceId)
}
/** 远端不能带入页面来源身份，且其他 Trace 的记录不能拼入当前调用树。 */
function traceResponse(response: unknown, traceId: string): RawSpan[] {
  const envelope = response && typeof response === 'object' && !Array.isArray(response) ? response as Envelope<unknown> & { status?: number } : undefined
  const result = Array.isArray(response) ? response : envelope?.success === true ? envelope.result : undefined
  if (!Array.isArray(result) || !result.every(isRawSpan) || result.some(span => span.traceId.toLowerCase() !== traceId.toLowerCase())) throw Object.assign(new Error(envelope?.message || 'Diagnostic trace response invalid'), { status: envelope?.status })
  return result.map(span => { const clean = { ...span }; delete clean.edgeSource; return clean })
}
function isRawSpan(value: unknown): value is RawSpan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const span = value as Record<string, unknown>
  const nanos = (time: unknown) => typeof time === 'number' ? Number.isFinite(time) : typeof time === 'string' && /^-?\d+$/.test(time)
  return typeof span.spanId === 'string' && !!span.spanId && typeof span.traceId === 'string' && !!span.traceId
    && typeof span.name === 'string' && nanos(span.startWithNanos) && nanos(span.endWithNanos)
}
export const logRoots = (nodeId: string, signal: AbortSignal) => diagnosticResult<LogFile[]>(request.get(`/system/log/${segment(nodeId)}/roots`, {}, { signal }))
export const logNodes = (signal: AbortSignal) => diagnosticResult<DiagnosticNode[]>(request.get('/system/log/nodes', {}, { signal }))
const logUrl = (nodeId: string, file: LogFile) => `/system/log/${segment(nodeId)}/${segment(file.providerId)}/${segment(file.id)}`
export const logChildren = (nodeId: string, file: LogFile, signal: AbortSignal) => diagnosticResult<LogFile[]>(request.get(`${logUrl(nodeId, file)}/children`, {}, { signal }))
export const statLog = (nodeId: string, file: LogFile, signal: AbortSignal) => diagnosticResult<LogFile & { size?: number; lastModified?: number }>(request.get(logUrl(nodeId, file), {}, { signal }))
export const readLog = (nodeId: string, file: LogFile, signal: AbortSignal, position?: number, direction = 'backward') => diagnosticResult<LogWindow>(request.post(`${logUrl(nodeId, file)}/_readWindow`, { lineCount: 500, position, direction, entry: file.entry }, { signal }))
export const logEntries = (nodeId: string, file: LogFile, signal: AbortSignal) => diagnosticResult<string[]>(request.get(`${logUrl(nodeId, file)}/entries`, {}, { signal }))
export const downloadLog = (nodeId: string, file: LogFile, signal: AbortSignal) => request.get(`${logUrl(nodeId, file)}/download`, {}, { signal, responseType: 'blob' })
export const captureDiagnostic = (nodeId: string, kind: 'jfr' | 'heap-dump', seconds: number, signal: AbortSignal, live = false) => request.post(`${monitor}/${kind === 'jfr' ? 'jfr' : 'heap'}/_dump`, kind === 'jfr' ? { duration: `${seconds}s` } : { alive: live, autoDelete: true }, { params: { serverId: nodeId }, signal, responseType: 'blob', timeout: 600000 })
export interface RawThread { threadId: string | number; threadName: string; threadState: string; lockName?: string; lockOwnerName?: string; lockOwnerId?: string | number; blockedCount?: number; blockedTime?: number; waitedCount?: number; waitedTime?: number; inNative?: boolean; suspended?: boolean; stackTrace?: Array<{ className: string; methodName: string; fileName?: string; lineNumber?: number }> }
export interface EdgeTraceTarget { key: string; thingType: string; thingId: string }
export interface RawSpan { app?: string; spanId: string; parentSpanId?: string; traceId: string; name: string; startWithNanos: string | number; endWithNanos: string | number; startWithNanosText?: string; endWithNanosText?: string; attributes?: Record<string, unknown>; events?: unknown[]; edgeSource?: EdgeTraceTarget }
export interface LogWindow { lines: string[]; startPosition: number; endPosition: number; previousPosition?: number; nextPosition?: number; truncated: boolean }

/** 二进制请求只在响应确认为Blob后保存，错误信封不能下载成诊断文件。 */
export async function saveDiagnosticFile(response: unknown, name: string, signal?: AbortSignal) {
  const data = response instanceof Blob ? response : (response as { data?: unknown })?.data
  if (!(data instanceof Blob) || data.size === 0) throw new Error('Diagnostic download failed')
  const prefix = await data.slice(0, 2048).text()
  if (/json/.test(data.type) || /^\s*\{\s*"(?:success|status|code)"/.test(prefix)) {
    let error: { success?: boolean; message?: string } = {}
    try { error = JSON.parse(prefix) } catch { throw new Error('Diagnostic download failed') }
    if (/json/.test(data.type) || error.success === false) throw new Error(error.message || 'Diagnostic download failed')
  }
  saveDiagnosticBlob(data, name, signal)
}

/** 保存本地生成的诊断内容；服务端响应须先经 saveDiagnosticFile 校验。 */
export function saveDiagnosticBlob(data: Blob, name: string, signal?: AbortSignal) {
  if (!(data instanceof Blob) || data.size === 0) throw new Error('Diagnostic download failed')
  if (signal?.aborted) return
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
