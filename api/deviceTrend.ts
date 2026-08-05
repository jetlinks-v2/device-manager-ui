import dayjs from 'dayjs'

export type DeviceGroupTrendMetricKey = 'onlineRate' | 'uplink'

export interface DeviceGroupTrendPoint {
  label: string
  value: number
  timestamp?: number
}

export interface DeviceGroupTrendMetric {
  key: DeviceGroupTrendMetricKey
  points: DeviceGroupTrendPoint[]
  bucketCount: number
  populatedBucketCount: number
}

export interface DeviceTrendDashboardScope {
  groupId?: string
  spaceId?: string | string[]
}

export interface DeviceTrendDashboardRange {
  time: string
  format: string
  limit: number
  from: string
  to: string
}

export type DeviceTrendDashboardGroup = 'device-group-online-rate' | 'device-group-uplink'

export interface DeviceTrendDashboardResponse {
  group?: DeviceTrendDashboardGroup | string
  data?: {
    value?: unknown
    timeString?: string
    timestamp?: number
  }
}

export interface DeviceTrendDashboardQuery {
  dashboard: 'device'
  object: 'status' | 'message'
  measurement: 'record' | 'quantity'
  dimension: 'onlineRate' | 'agg'
  group: DeviceTrendDashboardGroup
  params: DeviceTrendDashboardScope & DeviceTrendDashboardRange
}

const groupByMetric: Record<DeviceGroupTrendMetricKey, DeviceTrendDashboardGroup> = {
  onlineRate: 'device-group-online-rate',
  uplink: 'device-group-uplink',
}

/**
 * Builds dashboard queries from explicit business scope only.
 *
 * Dashboard measurements already apply asset permission. A UI-maintained access-provider allowlist is not a valid
 * authorization boundary and would discard custom providers or historical measurements that predate the provider tag.
 */
export function buildDeviceTrendDashboardQueries(
  scope: DeviceTrendDashboardScope,
  range: DeviceTrendDashboardRange,
  metrics: readonly DeviceGroupTrendMetricKey[],
): DeviceTrendDashboardQuery[] {
  const params = { ...scope, ...range }
  return metrics.map(metric => metric === 'onlineRate'
    ? {
      dashboard: 'device',
      object: 'status',
      measurement: 'record',
      dimension: 'onlineRate',
      group: groupByMetric.onlineRate,
      params,
    }
    : {
      dashboard: 'device',
      object: 'message',
      measurement: 'quantity',
      dimension: 'agg',
      group: groupByMetric.uplink,
      params,
    })
}

export function toDeviceTrendMetrics(
  rows: DeviceTrendDashboardResponse[],
  metrics: readonly DeviceGroupTrendMetricKey[],
  labelFormat: string,
): DeviceGroupTrendMetric[] {
  return metrics.map((key) => {
    const bucketRows = rows.filter(item => item.group === groupByMetric[key])
    const points = bucketRows
      .flatMap((item, index) => {
        const value = toFiniteDeviceTrendMeasurement(item.data?.value)
        if (value === undefined) return []

        const timeString = item.data?.timeString || ''
        const parsedTime = dayjs(timeString)
        const rawTimestamp = Number(item.data?.timestamp)
        const timestamp = parsedTime.isValid()
          ? parsedTime.valueOf()
          : Number.isFinite(rawTimestamp) ? rawTimestamp : index
        return [{
          label: parsedTime.isValid() ? parsedTime.format(labelFormat) : timeString,
          value,
          timestamp,
        }]
      })
      .sort((a, b) => Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0))

    return {
      key,
      points,
      bucketCount: bucketRows.length,
      populatedBucketCount: points.length,
    }
  })
}

/** Returns undefined when no measurement exists, while preserving a real all-zero series as total zero. */
export function sumDeviceTrendPoints(points: DeviceGroupTrendPoint[]): number | undefined {
  if (!points.length) return undefined
  return points.reduce((total, point) => total + point.value, 0)
}

export function toFiniteDeviceTrendMeasurement(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return undefined
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : undefined
}
