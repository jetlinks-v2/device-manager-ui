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
const MS_PER_HOUR = 60 * 60 * 1000
const BYTES_PER_MB = 1024 * 1024
const METRIC_SCALE_DECIMALS = 6
/** `formatAggregationTime` always writes `.000`, so query `from` can be up to 999ms before `range.start`. */
const QUERY_FROM_MS_TRUNCATION = 999

type MetricInterval = typeof METRIC_INTERVALS[number]
type MetricColumn = {
  column: string
  alias: string
  aggregation: 'SUM'
}
type MetricPoint = { time: number } & Record<string, number | null>

const numberValue = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const formatAggregationTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`
}

export const scaleDeviceMetricValue = (value: number, divisor: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) return 0
  return Number((value / divisor).toFixed(METRIC_SCALE_DECIMALS))
}

export const toDeviceMetricHours = (milliseconds: number) => scaleDeviceMetricValue(milliseconds, MS_PER_HOUR)
export const toDeviceMetricMegabytes = (bytes: number) => scaleDeviceMetricValue(bytes, BYTES_PER_MB)

const scaleMeasurement = (value: number | null | undefined, divisor: number) => (
  value === null || value === undefined ? null : scaleDeviceMetricValue(value, divisor)
)

export const resolveDeviceMetricQueryLimit = (
  range: { start: number; end: number },
  interval: MetricInterval,
) => {
  const duration = Math.max(range.end - range.start, 1)
  return Math.min(MAX_BUCKETS, Math.max(1, Math.ceil(duration / INTERVAL_MILLIS[interval])))
}

const isDeviceMetricPointInRange = (time: number, range: { start: number; end: number }) => (
  time <= range.end && time >= range.start - QUERY_FROM_MS_TRUNCATION
)

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
  if (Math.ceil(duration / INTERVAL_MILLIS[interval]) > MAX_BUCKETS) {
    throw inputError('DEVICE_METRIC_BUCKET_LIMIT', 'metricBucketLimit', { max: MAX_BUCKETS })
  }
  return interval
}

const scalePointFields = (points: MetricPoint[], fields: string[], divisor: number): MetricPoint[] => (
  points.map((point) => {
    const scaled: MetricPoint = { time: point.time }
    for (const field of fields) {
      scaled[field] = scaleMeasurement(point[field], divisor)
    }
    return scaled
  })
)

const remapTrafficPoints = (points: MetricPoint[]): MetricPoint[] => (
  points.map(point => ({
    time: point.time,
    upstream: scaleMeasurement(point.upstreamBytes, BYTES_PER_MB),
    downstream: scaleMeasurement(point.downstreamBytes, BYTES_PER_MB),
  }))
)

/** Projects bounded buckets while keeping missing values distinct from real zero measurements. */
export const summarizeDeviceMetricPoints = (
  value: unknown,
  fields: string[],
  range?: { start: number; end: number },
) => {
  const rows = Array.isArray(value) ? value : []
  let populatedBucketCount = 0
  let measurementCount = 0
  const points: MetricPoint[] = rows
    .filter((item) => {
      if (!range) return true
      return isDeviceMetricPointInRange(numberValue(asRecord(item).time), range)
    })
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

/** Maps the device overview aggregation into hour, message-count, and megabyte contracts. */
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
      limit: resolveDeviceMetricQueryLimit(range, interval),
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
    const { points: rawPoints, cardinality } = summarizeDeviceMetricPoints(active.buckets, ['value'], range)
    const rangeActiveDurationRaw = rawPoints.reduce((total, point) => total + numberValue(point.value), 0)
    const points = scalePointFields(rawPoints, ['value'], MS_PER_HOUR)
    const data = {
      lifetimeActiveDuration: toDeviceMetricHours(numberValue(active.total)),
      rangeActiveDuration: toDeviceMetricHours(rangeActiveDurationRaw),
      peakActiveDuration: toDeviceMetricHours(numberValue(active.peak)),
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
    const { points, cardinality } = summarizeDeviceMetricPoints(overview.messageTrend, ['upstream', 'downstream'], range)
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
    const { points: rawPoints, cardinality } = summarizeDeviceMetricPoints(
      overview.trafficTrend,
      ['upstreamBytes', 'downstreamBytes'],
      range,
    )
    const points = remapTrafficPoints(rawPoints)
    const data = {
      upstreamTotal: toDeviceMetricMegabytes(numberValue(traffic.upstreamBytes)),
      downstreamTotal: toDeviceMetricMegabytes(numberValue(traffic.downstreamBytes)),
      total: toDeviceMetricMegabytes(numberValue(traffic.total)),
      peak: toDeviceMetricMegabytes(numberValue(traffic.peak)),
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
