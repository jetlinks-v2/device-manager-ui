import { request } from '@jetlinks-web/core'

/** 公开运行时查询契约，供模块注册表的消费者使用。 */
export type MetricAggregation = 'AVG' | 'MAX' | 'MIN' | 'SUM' | 'COUNT' | 'FIRST' | 'LAST'
export interface SupportedDeviceMetric {
  pointType: string
  pointId: string
  name?: string
  unit?: string | null
  metricType: 'GAUGE' | 'CUMULATIVE_COUNTER' | 'DELTA_COUNTER'
  defaultAggregation: MetricAggregation
  labelKeys: { id: string; name?: string }[]
  groupByKeys: { id: string; name?: string }[]
}
export interface DeviceMetricQuery {
  thingIds: string[]
  pointType: string
  metrics: { pointId: string; aggregation: MetricAggregation; alias: string }[]
  from: string
  to: string
  interval?: string
  groupBy?: string[]
  labelFilters?: { key: string; operator: 'EQ' | 'NOT_EQ' | 'IN' | 'NOT_IN' | 'EXISTS'; values: unknown[] }[]
  labelGroupBy?: { key: string; alias: string }[]
  sorts?: { alias: string; order: 'ASC' | 'DESC' }[]
  limit?: number
}
export type DeviceMetricRow = Record<string, unknown>
export interface DeviceOverviewQuery {
  /** 消息概览以 limit 决定输出桶数，与指标接口的截断语义不同。 */
  limit: number
  columns: { column: string; alias: string; aggregation: 'SUM' }[]
  groupByTime: { column: 'timestamp'; alias: 'time'; interval: string; format: string; from: string; to: string }
  filter: { terms: { column: 'deviceId'; termType: 'eq'; value: string }[] }
}
export interface DeviceOverviewResult {
  upstream?: { total?: number; buckets?: { time: number; value: number }[] }
  downstream?: { total?: number; buckets?: { time: number; value: number }[] }
  traffic?: { total?: number; upstreamBytes?: number; downstreamBytes?: number }
  messageTrend?: { time: number; upstream: number; downstream: number }[]
}

const config = { hiddenError: true, timeout: 15000 }
/** 业务错误不能被解包成合法空数据，保留状态码供消费者决定是否重试。 */
function unwrap<T>(response: unknown): T {
  const row = response as { result?: T; success?: boolean; status?: number }
  if (!row || typeof row !== 'object' || row.success === false || Number(row.status) >= 400) {
    throw Object.assign(new Error('Device runtime query failed'), { status: row?.status || 502 })
  }
  return ('result' in row ? row.result : row) as T
}

export async function deviceMetricsSupported(): Promise<SupportedDeviceMetric[]> {
  const result = unwrap<SupportedDeviceMetric[]>(await request.get('/device/metrics/_supported', {}, config))
  if (!Array.isArray(result) || result.some(row => !row || !row.pointId || !row.pointType || !row.metricType)) {
    throw new Error('Invalid metric catalog')
  }
  return result
}

export async function deviceMetricsAggregate(query: DeviceMetricQuery): Promise<DeviceMetricRow[]> {
  // 单设备页面不允许设备身份缺失后退化为全域查询。
  if (!query.thingIds.length || query.thingIds.some(id => !id.trim())) throw new Error('Missing runtime device')
  const result = unwrap<DeviceMetricRow[]>(await request.post('/device/metrics/_agg', query, config))
  if (!Array.isArray(result) || result.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('Invalid metric response')
  }
  return result
}

export async function deviceOverviewSummary(query: DeviceOverviewQuery): Promise<DeviceOverviewResult> {
  if (!query.filter.terms.some(term => term.column === 'deviceId' && term.value.trim())) throw new Error('Missing runtime device')
  const result = unwrap<DeviceOverviewResult>(await request.post('/device/summary/_overview', query, config))
  if (!result || typeof result !== 'object' || !('traffic' in result || 'upstream' in result || 'messageTrend' in result)) {
    throw new Error('Invalid overview response')
  }
  return result
}
