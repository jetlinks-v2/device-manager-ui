import { dashboard } from '../../../api/link/dashboard'
import type { MonitorTimeRange } from '../types'
import { defaultParamsData, networkHistoryParams, networkParams } from '../utils/historyParams'
import { normalizeMonitorHistory, type MonitorMetric, type MonitorHistoryResponseItem } from '../utils/monitorData'
import { normalizeTrafficHistory, normalizeSystemNetworkHistory, type NetworkHistoryResponseItem, type NetworkTrendMetric } from '../utils/networkData'

/** Treat unsuccessful envelopes as failures, keeping an empty successful result distinct. */
async function query<T>(params: object, signal?: AbortSignal): Promise<T[]> {
  const response = await dashboard(params, signal) as { success?: boolean; result?: T[] }
  if (!response.success || !Array.isArray(response.result)) throw new Error('Monitor history request failed')
  return response.result
}

export async function loadResourceHistory(metric: MonitorMetric, range: MonitorTimeRange) {
  return normalizeMonitorHistory(await query<MonitorHistoryResponseItem>(defaultParamsData(metric, { time: range })), metric)
}

/** 概览批量读取系统资源、主机网络和业务流量，保留不同来源的单位与节点边界。 */
export async function loadResourceOverviewHistory(range: MonitorTimeRange, signal?: AbortSignal) {
  const items = await query<NetworkHistoryResponseItem & MonitorHistoryResponseItem>([
    ...defaultParamsData('cpuJvm', { time: range }), ...defaultParamsData('memoryJvm', { time: range }),
    ...networkHistoryParams({ time: range }), ...networkParams({ time: { time: range } }),
  ], signal)
  const resources = Object.fromEntries((['cpuSystem', 'cpuJvm', 'memorySystem', 'memoryJvm'] as const)
    .map(metric => [metric, normalizeMonitorHistory(items, metric)])) as Record<MonitorMetric, ReturnType<typeof normalizeMonitorHistory>>
  return { ...resources, traffic: normalizeTrafficHistory(items),
    network: normalizeSystemNetworkHistory(items.filter(item => item.group === 'network')) }
}

/** Business traffic is bucketed device communication; host counters keep their original semantics. */
export async function loadNetworkHistory(metric: NetworkTrendMetric, range: MonitorTimeRange) {
  const items = await query<NetworkHistoryResponseItem>(metric === 'traffic'
    ? networkParams({ time: { time: range } }) : networkHistoryParams({ time: range }))
  return metric === 'traffic' ? normalizeTrafficHistory(items) : normalizeSystemNetworkHistory(items)
}
