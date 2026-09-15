import assert from 'node:assert/strict'
import test from 'node:test'

import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools.ts'
import { createDeviceMetricOutput } from '../views/device/list/agent/deviceDetailAgent.metricOutput.ts'
import {
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

    assert.equal(output.name, `${metric.id}-series`)
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

test('converts 3600000ms to 1 hour and 1048576 bytes to 1 MB', () => {
  assert.equal(toDeviceMetricHours(3_600_000), 1)
  assert.equal(toDeviceMetricHours(7_200_000), 2)
  assert.equal(toDeviceMetricMegabytes(MB), 1)
  assert.equal(toDeviceMetricMegabytes(2 * MB), 2)
})

test('7d + 1d query limit equals in-range bucket count instead of 100', () => {
  const range = { start: 0, end: 7 * DAY_MS }
  assert.equal(resolveDeviceMetricQueryLimit(range, '1d'), 7)
  assert.ok(resolveDeviceMetricQueryLimit(range, '1d') < 100)
})

test('7d preset defaults to 1d and sends overview limit 7', async () => {
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return { activeDuration: { buckets: [] } }
  }
  try {
    await createDeviceDetailMetricsService(device).activityAggregate({ timeRange: '7d' })
    assert.equal((queries[0]?.groupByTime as { interval?: string })?.interval, '1d')
    assert.equal(queries[0]?.limit, 7)
  } finally {
    iotDeviceDetailRealApi.queryOverviewSummary = original
  }
})

test('clips padded overview buckets to the requested time range', () => {
  const range = { start: 1_700_000_000_000, end: 1_700_000_000_000 + 7 * DAY_MS }
  const { points, cardinality } = summarizeDeviceMetricPoints(
    paddedDailyBuckets(range.start, 100, 3_600_000),
    ['value'],
    range,
  )
  assert.equal(points.length, 8)
  assert.ok(points.every(point => point.time >= range.start && point.time <= range.end))
  assert.equal(cardinality.bucketCount, 8)
  assert.equal(points.at(-1)?.time, range.end)
  assert.equal(points[0]?.value, 3_600_000)
  assert.equal(points.some(point => point.time === range.start + 30 * DAY_MS), false)
})

test('keeps second-truncated query from buckets and drops far-future padding', () => {
  const range = { start: 1_700_000_000_123, end: 1_700_000_000_123 + 7 * DAY_MS }
  const { points } = summarizeDeviceMetricPoints(
    [
      { time: range.start - DAY_MS, value: 9 },
      { time: 1_700_000_000_000, value: 3_600_000 },
      { time: range.start, value: 3_600_000 },
      { time: range.start + 30 * DAY_MS, value: 3_600_000 },
    ],
    ['value'],
    range,
  )
  assert.deepEqual(points.map(point => point.time), [1_700_000_000_000, range.start])
})

test('activity aggregate converts hours and clips padded daily buckets for 7d + 1d', async () => {
  const original = iotDeviceDetailRealApi.queryOverviewSummary
  const queries: Record<string, unknown>[] = []
  const start = 1_700_000_000_000
  const end = start + 7 * DAY_MS
  iotDeviceDetailRealApi.queryOverviewSummary = async (data: Record<string, unknown>) => {
    queries.push(data)
    return {
      activeDuration: {
        total: 3_600_000,
        peak: 3_600_000,
        buckets: paddedDailyBuckets(start, 100, 3_600_000),
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

    assert.equal(queries[0]?.limit, 7)
    assert.notEqual(queries[0]?.limit, 100)
    assert.equal(data.lifetimeActiveDuration, 1)
    assert.equal(data.peakActiveDuration, 1)
    assert.ok(!('lifetimeActiveDurationMs' in data))
    assert.equal(data.points.length, 8)
    assert.equal(range.start, start)
    assert.equal(range.end, end)
    assert.ok(data.points.every(point => point.time >= range.start && point.time <= range.end))
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
