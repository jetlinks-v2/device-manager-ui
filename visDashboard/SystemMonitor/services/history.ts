import { dashboard } from '../../../api/link/dashboard'
import type { MonitorTimeRange } from '../types'
import { defaultParamsData, networkHistoryParams, networkParams } from '../utils/historyParams'
import { normalizeMonitorHistory, type MonitorMetric, type MonitorHistoryResponseItem } from '../utils/monitorData'
import { normalizeTrafficHistory, normalizeSystemNetworkHistory, type NetworkHistoryResponseItem, type NetworkTrendMetric } from '../utils/networkData'

/** Treat unsuccessful envelopes as failures, keeping an empty successful result distinct. */
async function query<T>(params: object): Promise<T[]> {
  const response = await dashboard(params) as { success?: boolean; result?: T[] }
  if (!response.success || !Array.isArray(response.result)) throw new Error('Monitor history request failed')
  return response.result
}

export async function loadResourceHistory(metric: MonitorMetric, range: MonitorTimeRange) {
  return normalizeMonitorHistory(await query<MonitorHistoryResponseItem>(defaultParamsData(metric, { time: range })), metric)
}

/** Business traffic is bucketed device communication; host counters keep their original semantics. */
export async function loadNetworkHistory(metric: NetworkTrendMetric, range: MonitorTimeRange) {
  const items = await query<NetworkHistoryResponseItem>(metric === 'traffic'
    ? networkParams({ time: { time: range } }) : networkHistoryParams({ time: range }))
  return metric === 'traffic' ? normalizeTrafficHistory(items) : normalizeSystemNetworkHistory(items)
}
