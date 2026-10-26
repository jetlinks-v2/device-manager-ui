export type DiagnosticTool = 'overview' | 'jvm' | 'sessions' | 'mbean' | 'logs'
export interface DiagnosticPreferenceScope { accountId: string; projectId: string }
export interface DiagnosticNodePreference {
  bean?: string
  mbeanDisplay?: { expandedKeys: string[]; section: 'summary' | 'attributes' | 'operations' }
  bufferFilter?: 'all' | 'failed' | 'pending'
  bufferObjectName?: string
  bufferView?: 'backlog' | 'throughput'
  bufferVisibleObjectNames?: string[]
  bufferScale?: 'linear' | 'compressed'
  bufferGrouping?: 'aggregate' | 'queues'
  logDisplay?: { level: string; wrap: boolean }
  jvmTab?: 'performance' | 'snapshots'
  deviceRuntimeMode?: 'messages' | 'traffic'
  deviceRuntimeSeries?: string[]
  deviceRuntimeZoom?: { start: number; end: number }
}
export interface DiagnosticPreferences {
  version: 1
  nodeId?: string
  tool?: DiagnosticTool
  historyRange?: { from: number; to: number }
  bufferIntervalSeconds?: BufferInterval
  nodes: Record<string, DiagnosticNodePreference>
}

export const bufferIntervals = [3, 5, 10, 30, 60] as const
export type BufferInterval = typeof bufferIntervals[number]
export const defaultDiagnosticInterval: BufferInterval = 3
/** 兼容既有 Buffer 偏好，概览各采集者使用同一白名单和默认值。 */
export function diagnosticIntervalSeconds(value: unknown): BufferInterval {
  return bufferIntervals.includes(value as BufferInterval) ? value as BufferInterval : defaultDiagnosticInterval
}

export const diagnosticTools: DiagnosticTool[] = ['overview', 'jvm', 'sessions', 'mbean', 'logs']
export const emptyDiagnosticPreferences = (): DiagnosticPreferences => ({ version: 1, nodes: {} })
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 4096
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** 未取得账号前不持久化；项目来自宿主平台上下文，不信任用户输入的任意存储键。 */
export function diagnosticPreferenceKey(scope: DiagnosticPreferenceScope): string | undefined {
  if (!scope.accountId) return undefined
  return `runtime-diagnostics:v1:${encodeURIComponent(scope.accountId)}:${encodeURIComponent(scope.projectId)}`
}

/** 只恢复浏览配置，忽略未知版本、内容、采集状态、搜索词和执行参数。 */
export function sanitizeDiagnosticPreferences(value: unknown): DiagnosticPreferences {
  const result = emptyDiagnosticPreferences()
  if (!object(value) || value.version !== 1) return result
  if (text(value.nodeId)) result.nodeId = value.nodeId
  if (object(value.historyRange) && Number.isFinite(value.historyRange.from) && Number.isFinite(value.historyRange.to) && Number(value.historyRange.to) > Number(value.historyRange.from)) {
    result.historyRange = { from: Number(value.historyRange.from), to: Number(value.historyRange.to) }
  }
  if (diagnosticTools.includes(value.tool as DiagnosticTool)) result.tool = value.tool as DiagnosticTool
  if (bufferIntervals.includes(value.bufferIntervalSeconds as BufferInterval)) result.bufferIntervalSeconds = value.bufferIntervalSeconds as BufferInterval
  if (!object(value.nodes)) return result
  for (const [nodeId, config] of Object.entries(value.nodes).slice(-30)) {
    if (!text(nodeId) || !object(config)) continue
    const node: DiagnosticNodePreference = {}
    if (text(config.bean)) node.bean = config.bean
    if (config.jvmTab === 'threads' || config.jvmTab === 'snapshots') node.jvmTab = 'snapshots'
    else if (config.jvmTab === 'memory' || config.jvmTab === 'performance') node.jvmTab = 'performance'
    if (['messages', 'traffic'].includes(String(config.deviceRuntimeMode))) node.deviceRuntimeMode = config.deviceRuntimeMode as DiagnosticNodePreference['deviceRuntimeMode']
    if (Array.isArray(config.deviceRuntimeSeries)) node.deviceRuntimeSeries = [...new Set(config.deviceRuntimeSeries.filter((id): id is string => typeof id === 'string' && ['sessions', 'upstreamMessages', 'communicationQps', 'propertyReports', 'eventReports', 'receivedBytes', 'sentBytes'].includes(id)))]
    if (object(config.deviceRuntimeZoom) && Number.isFinite(config.deviceRuntimeZoom.start) && Number.isFinite(config.deviceRuntimeZoom.end)) {
      const start = Number(config.deviceRuntimeZoom.start), end = Number(config.deviceRuntimeZoom.end)
      if (start >= 0 && end <= 100 && start < end) node.deviceRuntimeZoom = { start, end }
    }
    if (object(config.mbeanDisplay) && Array.isArray(config.mbeanDisplay.expandedKeys) && ['summary', 'attributes', 'operations'].includes(String(config.mbeanDisplay.section))) {
      node.mbeanDisplay = { expandedKeys: config.mbeanDisplay.expandedKeys.filter(text).slice(0, 200), section: config.mbeanDisplay.section as 'summary' | 'attributes' | 'operations' }
    }
    if (['all', 'failed', 'pending'].includes(String(config.bufferFilter))) node.bufferFilter = config.bufferFilter as DiagnosticNodePreference['bufferFilter']
    if (text(config.bufferObjectName)) node.bufferObjectName = config.bufferObjectName
    if (['backlog', 'throughput'].includes(String(config.bufferView))) node.bufferView = config.bufferView as DiagnosticNodePreference['bufferView']
    if (Array.isArray(config.bufferVisibleObjectNames)) node.bufferVisibleObjectNames = [...new Set(config.bufferVisibleObjectNames.filter(text))].slice(0, 200)
    if (['linear', 'compressed'].includes(String(config.bufferScale))) node.bufferScale = config.bufferScale as DiagnosticNodePreference['bufferScale']
    if (['aggregate', 'queues'].includes(String(config.bufferGrouping))) node.bufferGrouping = config.bufferGrouping as DiagnosticNodePreference['bufferGrouping']
    if (object(config.logDisplay) && ['all', 'ERROR', 'FATAL', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(String(config.logDisplay.level)) && typeof config.logDisplay.wrap === 'boolean') {
      node.logDisplay = { level: String(config.logDisplay.level), wrap: config.logDisplay.wrap }
    }
    // Object.fromEntries 避免把 ObjectName / 节点名当成对象原型属性。
    result.nodes = Object.fromEntries([...Object.entries(result.nodes), [nodeId, node]])
  }
  return result
}
