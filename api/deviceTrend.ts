import dayjs from 'dayjs'

import { IOT_DEVICE_DASHBOARD_ACCESS_PROVIDERS } from '../dataCapabilities/deviceScope'

const MIN_TIMESTAMP = 946684800000

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
  accessProvider?: readonly string[]
}

export interface DeviceTrendDashboardRange {
  time: string
  format: string
  limit: number
  from: string
  to: string
}

export type DeviceTrendDashboardGroup = 'device-group-online-rate' | 'device-group-uplink'

/**
 * Resolves a user-visible time label from the actual calendar span and bucket granularity.
 * Numeric ordering stays independent from this presentation format.
 */
export function resolveDeviceTrendLabelFormat(
  start: number | string,
  end: number | string,
  bucket: string,
): string {
  const startTime = toDeviceTrendTimestamp(start)
  const endTime = toDeviceTrendTimestamp(end)
  const unit = String(bucket || '').slice(-1)

  if (unit === 'M') return 'YYYY-MM'
  if (!startTime || !endTime) return unit === 'd' ? 'MM-DD' : 'HH:mm'
  if (dayjs(startTime).year() !== dayjs(endTime).year()) {
    return unit === 'd' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'
  }
  if (unit === 'd') return 'MM-DD'
  if (!dayjs(startTime).isSame(dayjs(endTime), 'day')) return 'MM-DD HH:mm'
  return 'HH:mm'
}

/** Formats a batch of axis values with one format derived from the whole series. */
export function formatDeviceTrendAxisLabels(
  values: readonly (number | string | undefined | null)[],
  bucket = '1h',
): string[] {
  const timestamps = values
    .map(toDeviceTrendTimestamp)
    .filter((value): value is number => value !== undefined)
  const format = timestamps.length
    ? resolveDeviceTrendLabelFormat(Math.min(...timestamps), Math.max(...timestamps), bucket)
    : resolveDeviceTrendLabelFormat('', '', bucket)

  return values.map((value) => {
    const timestamp = toDeviceTrendTimestamp(value)
    if (timestamp === undefined) {
      if (value === undefined || value === null || value === '') return ''
      if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) return ''
      return String(value)
    }
    return dayjs(timestamp).format(format)
  })
}

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
  const params = {
    ...scope,
    accessProvider: scope.accessProvider ?? IOT_DEVICE_DASHBOARD_ACCESS_PROVIDERS,
    ...range,
  }
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
        const parsedTimestamp = parsedTime.isValid() ? parsedTime.valueOf() : undefined
        const timestamp = parsedTimestamp
          ?? (Number.isFinite(rawTimestamp) ? rawTimestamp : index)
        return [{
          label: parsedTimestamp === undefined ? timeString : dayjs(parsedTimestamp).format(labelFormat),
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

function toDeviceTrendTimestamp(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric >= MIN_TIMESTAMP ? numeric : undefined
  }
  const parsed = dayjs(String(value))
  return parsed.isValid() ? parsed.valueOf() : undefined
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
