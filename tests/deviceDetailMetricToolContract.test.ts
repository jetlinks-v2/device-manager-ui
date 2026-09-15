import assert from 'node:assert/strict'
import test from 'node:test'

import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools.ts'
import { createDeviceDetailAgentWorkflows } from '../views/device/list/agent/deviceDetailAgent.workflows.ts'
import {
  createDeviceMetricOutput,
  deviceMetricSeriesName,
} from '../views/device/list/agent/deviceDetailAgent.metricOutput.ts'
import {
  alignDeviceMetricBucketStart,
  createDeviceDetailMetricsService,
  resolveDeviceMetricQueryLimit,
  summarizeDeviceMetricPoints,
  toDeviceMetricHours,
  toDeviceMetricMegabytes,
} from '../views/device/list/agent/deviceDetailMetrics.service.ts'
import { iotDeviceDetailRealApi } from '../views/device/list/services/iotDeviceDetailReal.service.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MB = 1024 * 1024

const metricCases = [
  {
    id: 'device_activity_aggregate' as const,
    unit: 'h',
    unitLabel: 'IotDeviceDetailAgent.units.hours',
    format: undefined,
    fields: [
      ['time', 'timestamp', 'temporal_dimension', 'time'],
      ['value', 'number', 'measure', 'active_duration'],
    ],
  },
  {
    id: 'device_message_aggregate' as const,
    unit: 'count',
    unitLabel: 'IotDeviceDetailAgent.units.messages',
    format: 'integer',
    fields: [
      ['time', 'timestamp', 'temporal_dimension', 'time'],
      ['upstream', 'integer', 'measure', 'upstream_messages'],
      ['downstream', 'integer', 'measure', 'downstream_messages'],
    ],
  },
  {
    id: 'device_traffic_aggregate' as const,
    unit: 'MB',
    unitLabel: 'IotDeviceDetailAgent.units.megabytes',
    format: undefined,
    fields: [
      ['time', 'timestamp', 'temporal_dimension', 'time'],
      ['upstream', 'number', 'measure', 'upstream_traffic'],
      ['downstream', 'number', 'measure', 'downstream_traffic'],
    ],
  },
]

const device = { id: 'device-1' } as any
const detailService = new Proxy({}, { get: () => async () => ({}) }) as any

const paddedDailyBuckets = (start: number, count: number, value: number) => (
  Array.from({ length: count }, (_, index) => ({
    time: start + index * DAY_MS,
    value,
    upstream: 1,
    downstream: 2,
    upstreamBytes: MB,
    downstreamBytes: 2 * MB,
  }))
)

test('publishes fixed device metrics as raw canonical aggregate-series outputs', () => {
  for (const metric of metricCases) {
    const output = createDeviceMetricOutput(metric.id)

    assert.equal(output.name, deviceMetricSeriesName(metric.id))
    assert.equal(output.shape, 'metric.time-series')
    assert.equal(output.delivery, 'auto')
    assert.equal(output.recordPath, '$')
    assert.deepEqual(output.ordering, {
      keys: [{ field: 'time', direction: 'asc' }],
      producerGuaranteed: true,
    })
    assert.deepEqual(output.fields?.map(field => [
      field.name,
      field.type,
      field.role,
      field.name === 'time' ? field.axis : field.measure,
    ]), metric.fields)
    assert.deepEqual(output.select?.({ data: { points: [{ time: 1 }] } }), [{ time: 1 }])

    const measures = output.fields?.filter(field => field.role === 'measure') || []
    assert.ok(measures.length > 0)
    for (const field of measures) {
      assert.ok(field.label, `${metric.id}.${field.name} missing label`)
      assert.equal(field.unit, metric.unit)
      assert.equal(field.unitLabel, metric.unitLabel)
      assert.equal(field.aggregation, 'sum')
      assert.equal(field.format, metric.format)
    }
  }
})

test('device metric analytical producers publish the same display units as output fields', () => {
  const tools = createDeviceDetailAgentTools(detailService)
  assert.deepEqual(
    tools.find(tool => tool.id === 'device_activity_aggregate')
      ?.routing
      ?.analyticalCapability
      ?.measures
      ?.map(measure => [measure.name, measure.units]),
    [['active_duration', ['h']]],
  )
  assert.deepEqual(
    tools.find(tool => tool.id === 'device_message_aggregate')
      ?.routing
      ?.analyticalCapability
      ?.measures
      ?.map(measure => [measure.name, measure.units]),
    [['upstream_messages', ['count']], ['downstream_messages', ['count']]],
  )
  assert.deepEqual(
    tools.find(tool => tool.id === 'device_traffic_aggregate')
      ?.routing
      ?.analyticalCapability
      ?.measures
      ?.map(measure => [measure.name, measure.units]),
    [['upstream_traffic', ['mb']], ['downstream_traffic', ['mb']]],
  )
})

test('compiled device metric tools lock auto delivery and series produces', () => {
  const tools = createDeviceDetailAgentTools(detailService)
  const evidenceNames = createDeviceDetailAgentWorkflows().flatMap(guide => (
    (guide.steps || []).flatMap(step => {
      if (typeof step === 'string') return []
      return Array.isArray(step.evidence) ? step.evidence : [step.evidence]
    })
  ))
  for (const metric of metricCases) {
    const tool = tools.find(item => item.id === metric.id)
    const seriesName = createDeviceMetricOutput(metric.id).name
    assert.ok(tool, `${metric.id} missing from compiled device-detail tools`)
    assert.equal(seriesName, deviceMetricSeriesName(metric.id))
    assert.deepEqual(tool.routing?.produces, [seriesName])
    assert.deepEqual(tool.routing?.producerPorts?.map(port => port.name), [seriesName])
    assert.deepEqual(tool.routing?.resultDeliveries, ['auto'])
    assert.deepEqual(tool.routing?.outputShapes, ['metric.time-series'])
    assert.ok(evidenceNames.includes(seriesName), `${seriesName} missing from workflow evidence`)
  }
  for (const stale of ['activity-aggregate', 'message-aggregate', 'traffic-aggregate'] as const) {
    assert.equal(evidenceNames.includes(stale), false, `stale workflow evidence ${stale}`)
  }
})

test('converts 3600000ms to 1 hour and 1048576 bytes to 1 MB', () => {
  assert.equal(toDeviceMetricHours(3_600_000), 1)
  assert.equal(toDeviceMetricHours(7_200_000), 2)
  assert.equal(toDeviceMetricMegabytes(MB), 1)
  assert.equal(toDeviceMetricMegabytes(2 * MB), 2)
})

const localTime = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) => (
  new Date(year, month, day, hour, minute, second, ms).getTime()
)

const rollingSevenDayEvening = {
  start: localTime(2026, 8, 8, 21, 34, 12, 345),
  end: localTime(2026, 8, 15, 21, 34, 12, 345),
}

test('aligns 1h to the local hour and 1d/1w to local midnight', () => {
  const timestamp = rollingSevenDayEvening.end
  assert.equal(alignDeviceMetricBucketStart(timestamp, '1h'), localTime(2026, 8, 15, 21))
  assert.equal(alignDeviceMetricBucketStart(timestamp, '1d'), localTime(2026, 8, 15))
  assert.equal(alignDeviceMetricBucketStart(timestamp, '1w'), localTime(2026, 8, 15))
})

test('7d + 1d query limit includes the end-day bucket instead of ceil(duration)', () => {
  assert.equal(resolveDeviceMetricQueryLimit(rollingSevenDayEvening, '1d'), 8)
  assert.notEqual(resolveDeviceMetricQueryLimit(rollingSevenDayEvening, '1d'), 7)
  assert.ok(resolveDeviceMetricQueryLimit(rollingSevenDayEvening, '1d') < 100)
  assert.equal(
    resolveDeviceMetricQueryLimit({
      start: localTime(2026, 8, 8),
      end: localTime(2026, 8, 15),
    }, '1d'),
    8,
  )
})

test('7d evening query aligns from to local midnight and covers today', async () => {
  const originalNow = Date.now
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  Date.now = () => rollingSevenDayEvening.end
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return { activeDuration: { buckets: [] } }
  }
  try {
    await createDeviceDetailMetricsService(device).activityAggregate({ timeRange: '7d' })
    const groupByTime = queries[0]?.groupByTime as { interval?: string; from?: string }
    assert.equal(groupByTime.interval, '1d')
    assert.equal(groupByTime.from, '2026-09-08 00:00:00.000')
    assert.ok(groupByTime.from?.endsWith('00:00:00.000'))
    assert.equal(queries[0]?.limit, 8)
    const alignedEnd = alignDeviceMetricBucketStart(rollingSevenDayEvening.end, '1d')
    const alignedStart = alignDeviceMetricBucketStart(rollingSevenDayEvening.start, '1d')
    assert.equal(alignedStart + (Number(queries[0]?.limit) - 1) * DAY_MS, alignedEnd)
  } finally {
    Date.now = originalNow
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('today evening 1h query aligns from to the local hour and includes the current hour', async () => {
  const originalNow = Date.now
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  const evening = localTime(2026, 8, 15, 21, 34, 12, 345)
  Date.now = () => evening
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return { activeDuration: { buckets: [] } }
  }
  try {
    await createDeviceDetailMetricsService(device).activityAggregate({ timeRange: 'today' })
    const groupByTime = queries[0]?.groupByTime as { interval?: string; from?: string }
    assert.equal(groupByTime.interval, '1h')
    assert.equal(groupByTime.from, '2026-09-15 00:00:00.000')
    assert.match(String(groupByTime.from), /\d{2}:00:00\.000$/)
    assert.equal(queries[0]?.limit, 22)
  } finally {
    Date.now = originalNow
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('today at an exact hour keeps the current hour that ceil(duration/interval) would drop', async () => {
  const originalNow = Date.now
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  const exactHour = localTime(2026, 8, 15, 21)
  Date.now = () => exactHour
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return { activeDuration: { buckets: [] } }
  }
  try {
    await createDeviceDetailMetricsService(device).activityAggregate({ timeRange: 'today' })
    const start = localTime(2026, 8, 15)
    assert.equal(Math.ceil((exactHour - start) / HOUR_MS), 21)
    assert.equal(queries[0]?.limit, 22)
    assert.equal(
      alignDeviceMetricBucketStart(start, '1h') + (Number(queries[0]?.limit) - 1) * HOUR_MS,
      exactHour,
    )
  } finally {
    Date.now = originalNow
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('100-hour custom range falls back to 1d instead of throwing on inclusive 1h overflow', async () => {
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return { activeDuration: { buckets: [] } }
  }
  try {
    await createDeviceDetailMetricsService(device).activityAggregate({
      timeRange: 'custom',
      startTime: localTime(2026, 8, 11, 17),
      endTime: localTime(2026, 8, 15, 21),
    })
    const groupByTime = queries[0]?.groupByTime as { interval?: string; from?: string }
    assert.equal(groupByTime.interval, '1d')
    assert.equal(groupByTime.from, '2026-09-11 00:00:00.000')
    assert.equal(queries[0]?.limit, 5)
  } finally {
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('1h custom from drops minutes and includes the current hour bucket', async () => {
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return { activeDuration: { buckets: [] } }
  }
  try {
    await createDeviceDetailMetricsService(device).activityAggregate({
      timeRange: 'custom',
      startTime: localTime(2026, 8, 15, 8, 34, 12, 345),
      endTime: localTime(2026, 8, 15, 21, 34, 12, 345),
      interval: '1h',
    })
    const groupByTime = queries[0]?.groupByTime as { from?: string }
    assert.equal(groupByTime.from, '2026-09-15 08:00:00.000')
    assert.match(String(groupByTime.from), /\d{2}:00:00\.000$/)
    assert.equal(queries[0]?.limit, 14)
  } finally {
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('clips padded overview buckets to the aligned query window', () => {
  const alignedStart = alignDeviceMetricBucketStart(rollingSevenDayEvening.start, '1d')
  const todayMidnight = alignDeviceMetricBucketStart(rollingSevenDayEvening.end, '1d')
  const clipRange = { start: alignedStart, end: rollingSevenDayEvening.end }
  const { points, cardinality } = summarizeDeviceMetricPoints(
    paddedDailyBuckets(alignedStart, 100, 3_600_000),
    ['value'],
    clipRange,
  )
  assert.equal(points.length, 8)
  assert.ok(points.every(point => (
    point.time >= alignedStart - 999 && point.time <= rollingSevenDayEvening.end
  )))
  assert.equal(cardinality.bucketCount, 8)
  assert.equal(points[0]?.time, alignedStart)
  assert.equal(points.at(-1)?.time, todayMidnight)
  assert.equal(points[0]?.value, 3_600_000)
  assert.equal(points.some(point => point.time === alignedStart + 30 * DAY_MS), false)
})

test('keeps second-truncated query from buckets and drops far-future padding', () => {
  const alignedStart = alignDeviceMetricBucketStart(rollingSevenDayEvening.start, '1d')
  const clipRange = { start: alignedStart, end: rollingSevenDayEvening.end }
  const { points } = summarizeDeviceMetricPoints(
    [
      { time: alignedStart - DAY_MS, value: 9 },
      { time: alignedStart - 123, value: 3_600_000 },
      { time: alignedStart, value: 3_600_000 },
      { time: alignedStart + 30 * DAY_MS, value: 3_600_000 },
    ],
    ['value'],
    clipRange,
  )
  assert.deepEqual(points.map(point => point.time), [alignedStart - 123, alignedStart])
})

test('activity aggregate converts hours and clips padded daily buckets for 7d + 1d', async () => {
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  const start = rollingSevenDayEvening.start
  const end = rollingSevenDayEvening.end
  const alignedStart = alignDeviceMetricBucketStart(start, '1d')
  const todayMidnight = alignDeviceMetricBucketStart(end, '1d')
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return {
      activeDuration: {
        total: 3_600_000,
        peak: 3_600_000,
        buckets: paddedDailyBuckets(alignedStart, 100, 3_600_000),
      },
    }
  }

  try {
    const service = createDeviceDetailMetricsService(device)
    const result = await service.activityAggregate({
      timeRange: 'custom',
      startTime: start,
      endTime: end,
      interval: '1d',
    })
    const data = result.data as {
      lifetimeActiveDuration: number
      rangeActiveDuration: number
      peakActiveDuration: number
      points: Array<{ time: number; value: number | null }>
    }
    const range = result.evidence?.requestedRange as { start: number; end: number }
    const groupByTime = queries[0]?.groupByTime as { from?: string }

    assert.equal(queries[0]?.limit, 8)
    assert.notEqual(queries[0]?.limit, 7)
    assert.notEqual(queries[0]?.limit, 100)
    assert.equal(groupByTime.from, '2026-09-08 00:00:00.000')
    assert.equal(data.lifetimeActiveDuration, 1)
    assert.equal(data.peakActiveDuration, 1)
    assert.ok(!('lifetimeActiveDurationMs' in data))
    assert.equal(data.points.length, 8)
    assert.equal(range.start, start)
    assert.equal(range.end, end)
    assert.equal(data.points[0]?.time, alignedStart)
    assert.equal(data.points.at(-1)?.time, todayMidnight)
    assert.ok(data.points.every(point => (
      point.time >= alignedStart - 999 && point.time <= range.end
    )))
    assert.equal(data.points[0]?.value, 1)
    assert.equal(data.rangeActiveDuration, data.points.length)
  } finally {
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('traffic aggregate converts bytes to MB without *Bytes summary keys', async () => {
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const start = 1_700_000_000_000
  const pointTime = start + HOUR_MS
  iotDeviceDetailRealApi.queryOverviewSummary = async () => ({
    traffic: {
      upstreamBytes: MB,
      downstreamBytes: 2 * MB,
      total: 3 * MB,
      peak: 2 * MB,
    },
    trafficTrend: [
      { time: pointTime, upstreamBytes: MB, downstreamBytes: 2 * MB },
    ],
  })

  try {
    const service = createDeviceDetailMetricsService(device)
    const result = await service.trafficAggregate({
      timeRange: 'custom',
      startTime: start,
      endTime: start + 24 * HOUR_MS,
    })
    const data = result.data as Record<string, unknown>
    assert.equal(data.upstreamTotal, 1)
    assert.equal(data.downstreamTotal, 2)
    assert.equal(data.total, 3)
    assert.equal(data.peak, 2)
    assert.ok(!('upstreamBytes' in data))
    assert.ok(!('totalBytes' in data))
    const points = data.points as Array<{ upstream: number; downstream: number }>
    assert.equal(points[0]?.upstream, 1)
    assert.equal(points[0]?.downstream, 2)
  } finally {
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})
