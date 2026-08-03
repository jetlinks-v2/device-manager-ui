import {
  createDomainAgentAggregateCardinality,
  createDomainAgentToolResult,
  normalizeDomainAgentMeasurement,
  resolveDomainAgentEnum,
  resolveDomainAgentTimeRange,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import type { IotDevice } from '../types'
import { iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import {
  asRecord,
  inputError,
  runDetailTool,
  unwrapResult,
  type DeviceDetailAgentArgs,
} from './deviceDetailAgent.shared'

const METRIC_INTERVALS = ['1h', '1d', '1w'] as const
const INTERVAL_MILLIS = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
} as const
const MAX_BUCKETS = 100

type MetricInterval = typeof METRIC_INTERVALS[number]
type MetricColumn = {
  column: string
  alias: string
  aggregation: 'SUM'
}

const numberValue = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const formatAggregationTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`
}

const resolveInterval = (
  args: DeviceDetailAgentArgs,
  range: { start: number; end: number },
): MetricInterval => {
  const duration = Math.max(range.end - range.start, 1)
  const defaultValue: MetricInterval = duration / INTERVAL_MILLIS['1h'] <= MAX_BUCKETS
    ? '1h'
    : duration / INTERVAL_MILLIS['1d'] <= MAX_BUCKETS
      ? '1d'
      : '1w'
  const interval = resolveDomainAgentEnum(args.interval, METRIC_INTERVALS, {
    name: 'interval',
    defaultValue,
  })
  const bucketCount = Math.ceil(duration / INTERVAL_MILLIS[interval])
  if (bucketCount > MAX_BUCKETS) {
    throw inputError('DEVICE_METRIC_BUCKET_LIMIT', 'metricBucketLimit', { max: MAX_BUCKETS })
  }
  return interval
}

/** Projects bounded buckets while keeping missing values distinct from real zero measurements. */
export const summarizeDeviceMetricPoints = (value: unknown, fields: string[]) => {
  const rows = Array.isArray(value) ? value : []
  let populatedBucketCount = 0
  let measurementCount = 0
  const points: Array<{ time: number } & Record<string, number | null>> = rows
    .slice(0, MAX_BUCKETS)
    .map((item) => {
      const row = asRecord(item)
      const measurements: Record<string, number | null> = {}
      let bucketMeasurementCount = 0
      for (const field of fields) {
        const measurement = normalizeDomainAgentMeasurement(row[field])
        measurements[field] = measurement ?? null
        if (measurement !== undefined) bucketMeasurementCount += 1
      }
      if (bucketMeasurementCount > 0) populatedBucketCount += 1
      measurementCount += bucketMeasurementCount
      return {
        time: numberValue(row.time),
        ...measurements,
      }
    })
  return {
    points,
    cardinality: createDomainAgentAggregateCardinality({
      bucketCount: points.length,
      populatedBucketCount,
      measurementCount,
    }),
  }
}

/** Maps the device overview aggregation into explicit duration-ms, message-count, and traffic-byte contracts. */
export const createDeviceDetailMetricsService = (device: IotDevice) => {
  const queryOverview = async (
    args: DeviceDetailAgentArgs,
    columns: MetricColumn[],
  ) => {
    const range = resolveDomainAgentTimeRange(args)
    const interval = resolveInterval(args, range)
    const response = await iotDeviceDetailRealApi.queryOverviewSummary({
      columns,
      groupByTime: {
        column: 'timestamp',
        alias: 'time',
        interval,
        format: 'yyyy-MM-dd HH:mm:ss',
        from: formatAggregationTime(range.start),
        to: formatAggregationTime(range.end),
      },
      limit: MAX_BUCKETS,
      filter: {
        terms: [{ column: 'deviceId', termType: 'eq', value: device.id }],
      },
    })
    return { range, interval, overview: asRecord(unwrapResult(response)) }
  }

  const activityAggregate = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const { range, interval, overview } = await queryOverview(args, [
      { column: 'onlineDuration', alias: 'onlineDuration', aggregation: 'SUM' },
    ])
    const active = asRecord(overview.activeDuration)
    const { points, cardinality } = summarizeDeviceMetricPoints(active.buckets, ['value'])
    const rangeActiveDuration = points.reduce((total, point) => total + numberValue(point.value), 0)
    const data = {
      lifetimeActiveDurationMs: numberValue(active.total),
      rangeActiveDurationMs: rangeActiveDuration,
      peakActiveDurationMs: numberValue(active.peak),
      interval,
      points,
    }
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId: device.id, ...data, points: undefined },
      data,
      cardinality,
    })
  })

  const messageAggregate = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const { range, interval, overview } = await queryOverview(args, [
      { column: 'upstreamMessages', alias: 'upstreamMessages', aggregation: 'SUM' },
      { column: 'downstreamMessages', alias: 'downstreamMessages', aggregation: 'SUM' },
    ])
    const upstream = asRecord(overview.upstream)
    const downstream = asRecord(overview.downstream)
    const { points, cardinality } = summarizeDeviceMetricPoints(overview.messageTrend, ['upstream', 'downstream'])
    const data = {
      upstreamTotal: numberValue(upstream.total),
      downstreamTotal: numberValue(downstream.total),
      total: numberValue(upstream.total) + numberValue(downstream.total),
      upstreamPeak: numberValue(upstream.peak),
      downstreamPeak: numberValue(downstream.peak),
      interval,
      points,
    }
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId: device.id, ...data, points: undefined },
      data,
      cardinality,
    })
  })

  const trafficAggregate = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const { range, interval, overview } = await queryOverview(args, [
      { column: 'upstreamBytes', alias: 'upstreamBytes', aggregation: 'SUM' },
      { column: 'downstreamBytes', alias: 'downstreamBytes', aggregation: 'SUM' },
    ])
    const traffic = asRecord(overview.traffic)
    const { points, cardinality } = summarizeDeviceMetricPoints(overview.trafficTrend, ['upstreamBytes', 'downstreamBytes'])
    const data = {
      upstreamBytes: numberValue(traffic.upstreamBytes),
      downstreamBytes: numberValue(traffic.downstreamBytes),
      totalBytes: numberValue(traffic.total),
      peakBytes: numberValue(traffic.peak),
      interval,
      points,
    }
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId: device.id, ...data, points: undefined },
      data,
      cardinality,
    })
  })

  return { activityAggregate, messageAggregate, trafficAggregate }
}
