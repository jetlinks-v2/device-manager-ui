import dayjs from 'dayjs'
import { iotDeviceDetailRealApi, formatApiTime } from '../../../views/device/list/services/iotDeviceDetailReal.service'
import type { OverviewSummary, SummaryPoint, SummarySeries } from '../shared'

export const recordOf = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const numberOf = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
export const textOf = (value: unknown) => value === undefined || value === null || value === '' ? '--' : String(value)

/** 业务失败必须进入错误态，不能被当作零值或无告警。 */
export function resultOf(response: unknown): unknown {
  const value = recordOf(response)
  if (value.success === false || Number(value.status) >= 400) throw new Error('Device detail query failed')
  return 'result' in value ? value.result : response
}

/** 保留原概览的当天自然日、小时粒度和设备过滤参数。 */
export function buildSummaryParams(deviceId: string, now = dayjs()) {
  const from = now.startOf('day'), to = from.add(1, 'day').subtract(1, 'millisecond')
  return {
    columns: ['onlineDuration', 'upstreamMessages', 'downstreamMessages', 'upstreamBytes', 'downstreamBytes']
      .map(column => ({ column, alias: column, aggregation: 'SUM' })),
    groupByTime: { column: 'timestamp', alias: 'time', interval: '1h', format: 'yyyy-MM-dd HH:mm:ss',
      from: `${formatApiTime(from.valueOf(), '')}.000`, to: `${formatApiTime(to.valueOf(), '')}.000` },
    limit: 24, filter: { terms: [{ column: 'deviceId', termType: 'eq', value: deviceId }] },
  }
}

function bucketsOf(value: unknown): SummaryPoint[] {
  return Array.isArray(value) ? value.map(item => {
    const row = recordOf(item), time = row.time
    return { value: numberOf(typeof item === 'number' ? item : row.value),
      time: time === undefined || time === null || time === '' || !Number.isFinite(Number(time)) ? undefined : Number(time) }
  }) : []
}
function seriesOf(value: unknown, fallback: SummaryPoint[] = []): SummarySeries {
  const row = recordOf(value)
  return { total: numberOf(row.total), peak: numberOf(row.peak),
    buckets: Array.isArray(row.buckets) && row.buckets.length ? bucketsOf(row.buckets) : fallback }
}

/** 兼容既有聚合及分离趋势字段，HTTP/业务错误与合法零值分别处理。 */
export function normalizeSummary(response: unknown): OverviewSummary {
  const row = recordOf(resultOf(response))
  if (!['activeDuration', 'upstream', 'downstream', 'traffic', 'messageTrend', 'trafficTrend'].some(key => key in row)) {
    throw new Error('Invalid device overview response')
  }
  const trend = Array.isArray(row.messageTrend) ? row.messageTrend.map(recordOf) : []
  const traffic = recordOf(row.traffic)
  const trafficTrend = Array.isArray(row.trafficTrend) ? row.trafficTrend.map(recordOf) : []
  return {
    activeDuration: seriesOf(row.activeDuration),
    upstream: seriesOf(row.upstream, bucketsOf(trend.map(item => ({ time: item.time, value: item.upstream })))),
    downstream: seriesOf(row.downstream, bucketsOf(trend.map(item => ({ time: item.time, value: item.downstream })))),
    traffic: { ...seriesOf(traffic, bucketsOf(trafficTrend.map(item => ({ time: item.time,
      value: numberOf(item.upstreamBytes) + numberOf(item.downstreamBytes) })))),
      upstreamBytes: numberOf(traffic.upstreamBytes), downstreamBytes: numberOf(traffic.downstreamBytes) },
  }
}
export const loadSummary = async (deviceId: string) => normalizeSummary(await iotDeviceDetailRealApi.queryOverviewSummary(buildSummaryParams(deviceId)))
