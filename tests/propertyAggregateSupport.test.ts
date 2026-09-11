import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateDevicePropertyGeoPointHistory,
  createDevicePropertyAggregateColumns,
  createDevicePropertyAggregateFields,
  createDevicePropertyAggregateRecordSchema,
  isDevicePropertyAggregateOrderedPath,
  mergeDevicePropertyAggregateRows,
  normalizeDevicePropertyAggregateData,
  refineDevicePropertyOrderedPathInterval,
  resolveDevicePropertyOrderedPathInterval,
  shouldInlineDevicePropertyAggregate,
} from '../views/device/agentTools/propertyAggregateSupport.ts'
import {
  createIotDevicePropertyAggregateFields,
  createIotDevicePropertyAggregatePlan,
} from '../agentCapabilities/deviceAnalysis/devicePropertyAggregate.support.ts'

const metadata = {
  properties: [
    { id: 'location', name: 'Position', valueType: { type: 'geoPoint' } },
    { id: 'temperature', name: 'Temperature', valueType: { type: 'double', unit: '℃' } },
    { id: 'state', name: 'State', valueType: { type: 'enum' } },
    { id: 'enabled', name: 'Enabled', valueType: { type: 'boolean' } },
  ],
}

test('selects aggregate defaults from declared property types', () => {
  const { columns, warnings } = createDevicePropertyAggregateColumns(
    metadata,
    ['location', 'temperature', 'state'],
    undefined,
    propertyId => `${propertyId} is not numeric`,
  )

  assert.deepEqual(columns, [
    { property: 'location', alias: 'location', agg: 'LAST' },
    { property: 'temperature', alias: 'temperature', agg: 'AVG' },
    { property: 'state', alias: 'state', agg: 'COUNT' },
  ])
  assert.deepEqual(warnings, [])
})

test('keeps canonical property units separate from localized display-unit text', () => {
  const plan = createIotDevicePropertyAggregatePlan({
    properties: [{
      id: 'temperature', name: 'Temperature', valueType: {
        type: 'double', unit: 'celsius', unitName: 'Degrees Celsius', unitText: 'deg C', unitLabel: '°C',
      },
    }],
  } as any, ['temperature'], 'AVG', 'statistics', {
    unsupported: () => '',
  })
  const fields = createIotDevicePropertyAggregateFields(plan.columns, {
    longitude: label => `${label} longitude`,
    latitude: label => `${label} latitude`,
  })

  assert.deepEqual(fields[1], {
    name: 'temperature', type: 'number', role: 'measure', label: 'Temperature',
    measure: 'temperature', aggregation: 'avg', unit: 'celsius', unitLabel: 'Degrees Celsius',
  })
})

test('normalizes valid geo points into ordered scalar coordinate fields', () => {
  const columns = [
    { property: 'location', alias: 'location', agg: 'LAST' as const },
    { property: 'temperature', alias: 'temperature', agg: 'AVG' as const },
  ]
  const rows = normalizeDevicePropertyAggregateData({
    result: [
      { time: 2, location: { lon: '120.2', lat: 30.2 }, temperature: 22 },
      { time: 1, location: { lon: 120.1, lat: '30.1' }, temperature: 21 },
      { time: 0, location: { lon: 181, lat: 30 }, temperature: 20 },
    ],
  }, metadata, columns, value => value)

  assert.deepEqual(rows, [
    { time: new Date(0).toISOString(), temperature: 20 },
    { time: new Date(1).toISOString(), location_longitude: 120.1, location_latitude: 30.1, temperature: 21 },
    { time: new Date(2).toISOString(), location_longitude: 120.2, location_latitude: 30.2, temperature: 22 },
  ])
})

test('normalizes serialized and array geo point representations at the aggregate boundary', () => {
  const columns = [{ property: 'location', alias: 'location', agg: 'LAST' as const }]
  const rows = normalizeDevicePropertyAggregateData([
    { time: '2030-01-01T01:00:00.000Z', location: '[120.2,30.2]' },
    { time: '2030-01-01T00:00:00.000Z', location: '{"longitude":120.1,"latitude":30.1}' },
  ], metadata, columns, value => value)

  assert.deepEqual(rows, [
    { time: '2030-01-01T00:00:00.000Z', x: 120.1, y: 30.1 },
    { time: '2030-01-01T01:00:00.000Z', x: 120.2, y: 30.2 },
  ])
})

test('buckets complex property history deterministically and merges it with scalar aggregates', () => {
  const at = (hour: number, minute: number) => new Date(2030, 0, 1, hour, minute).getTime()
  const geoColumns = [{ property: 'location', alias: 'location', agg: 'LAST' as const }]
  const geoRows = aggregateDevicePropertyGeoPointHistory({
    location: [
      { timestamp: at(0, 50), value: { value: '{"lon":120.2,"lat":30.2}' } },
      { timestamp: at(1, 10), value: [120.3, 30.3] },
      { timestamp: at(0, 5), value: { longitude: 120.1, latitude: 30.1 } },
    ],
  }, geoColumns, '1h')
  const merged = mergeDevicePropertyAggregateRows([
    [
      { time: '2030-01-01 01:00:00', temperature: 22 },
      { time: '2030-01-01 00:00:00', temperature: 21 },
    ],
    geoRows,
  ])
  const rows = normalizeDevicePropertyAggregateData(merged, metadata, [
    ...geoColumns,
    { property: 'temperature', alias: 'temperature', agg: 'AVG' as const },
  ], value => value)

  assert.deepEqual(geoRows, [
    { time: '2030-01-01 01:00:00', location: [120.3, 30.3] },
    { time: '2030-01-01 00:00:00', location: '{"lon":120.2,"lat":30.2}' },
  ])
  assert.deepEqual(rows, [
    {
      time: new Date(at(0, 0)).toISOString(),
      location_longitude: 120.2,
      location_latitude: 30.2,
      temperature: 21,
    },
    {
      time: new Date(at(1, 0)).toISOString(),
      location_longitude: 120.3,
      location_latitude: 30.3,
      temperature: 22,
    },
  ])
})

test('chooses ordered path resolution from observed timestamps instead of an empty requested span', () => {
  const at = (minute: number) => new Date(2030, 0, 1, 0, minute).getTime()

  assert.equal(resolveDevicePropertyOrderedPathInterval({
    location: [
      { timestamp: at(0), value: [120, 30] },
      { timestamp: at(35), value: [120.1, 30.1] },
    ],
  }), '1m')
  assert.equal(resolveDevicePropertyOrderedPathInterval({
    location: [
      { timestamp: new Date(2030, 0, 1).getTime(), value: [120, 30] },
      { timestamp: new Date(2030, 1, 1).getTime(), value: [120.1, 30.1] },
    ],
  }), '1h')
  assert.equal(refineDevicePropertyOrderedPathInterval('1d', {
    location: [
      { timestamp: at(0), value: [120, 30] },
      { timestamp: at(35), value: [120.1, 30.1] },
    ],
  }), '1m')
  assert.equal(refineDevicePropertyOrderedPathInterval('1m', {
    location: [
      { timestamp: at(0), value: [120, 30] },
      { timestamp: at(35), value: [120.1, 30.1] },
    ],
  }), '1m')
})

test('publishes renderer-neutral geo roles and numeric record schema', () => {
  const fields = createDevicePropertyAggregateFields(metadata, [
    { property: 'location', alias: 'location', agg: 'LAST' },
    { property: 'temperature', alias: 'temperature', agg: 'AVG' },
    { property: 'state', alias: 'state', agg: 'LAST' },
    { property: 'enabled', alias: 'enabled', agg: 'LAST' },
  ], {
    longitude: label => `${label} longitude`,
    latitude: label => `${label} latitude`,
  })

  assert.deepEqual(fields, [
    {
      name: 'time',
      type: 'timestamp',
      role: 'temporal_dimension',
      axis: 'time',
      encoding: 'date-time',
      format: 'datetime',
    },
    {
      name: 'location_longitude',
      type: 'number',
      role: 'longitude',
      label: 'Position longitude',
      measure: 'location',
      aggregation: 'last',
    },
    {
      name: 'location_latitude',
      type: 'number',
      role: 'latitude',
      label: 'Position latitude',
      measure: 'location',
      aggregation: 'last',
    },
    {
      name: 'temperature',
      type: 'number',
      role: 'measure',
      label: 'Temperature',
      measure: 'temperature',
      aggregation: 'avg',
      unit: '℃',
    },
    { name: 'state', type: 'string', role: 'label', label: 'State' },
    { name: 'enabled', type: 'boolean', role: 'state', label: 'Enabled' },
  ])
  assert.equal(JSON.stringify(fields).includes('semanticRole'), false)

  assert.deepEqual(createDevicePropertyAggregateRecordSchema(fields), {
    type: 'object',
    properties: {
      time: { type: 'string', 'x-ai-role': 'temporal_dimension', format: 'date-time' },
      location_longitude: {
        type: 'number',
        'x-ai-role': 'longitude',
        label: 'Position longitude',
        'x-ai-measure': 'location',
        'x-ai-aggregation': 'last',
      },
      location_latitude: {
        type: 'number',
        'x-ai-role': 'latitude',
        label: 'Position latitude',
        'x-ai-measure': 'location',
        'x-ai-aggregation': 'last',
      },
      temperature: {
        type: 'number',
        'x-ai-role': 'measure',
        label: 'Temperature',
        'x-ai-measure': 'temperature',
        'x-ai-unit': '℃',
        'x-ai-aggregation': 'avg',
      },
      state: { type: 'string', 'x-ai-role': 'label', label: 'State' },
      enabled: { type: 'boolean', 'x-ai-role': 'state', label: 'Enabled' },
    },
  })
})

test('uses a compact canonical projection for one closed ordered path', () => {
  const columns = [
    { property: 'location', alias: 'location', agg: 'LAST' as const },
  ]
  const rows = normalizeDevicePropertyAggregateData({
    result: [
      { time: '2026-01-01T00:01:00.000Z', location: { lon: 120.2, lat: 30.2 } },
      { time: '2026-01-01T00:00:00.000Z', location: { lon: 120.1, lat: 30.1 } },
      { time: '2026-01-01T00:02:00.000Z', location: { lon: 181, lat: 30.3 } },
    ],
  }, metadata, columns, value => value)
  const fields = createDevicePropertyAggregateFields(metadata, columns, {
    longitude: label => `${label} longitude`,
    latitude: label => `${label} latitude`,
  })

  assert.deepEqual(rows, [
    { time: '2026-01-01T00:00:00.000Z', x: 120.1, y: 30.1 },
    { time: '2026-01-01T00:01:00.000Z', x: 120.2, y: 30.2 },
  ])
  assert.deepEqual(fields.map(field => [field.name, field.type, field.role]), [
    ['time', 'timestamp', 'temporal_dimension'],
    ['x', 'number', 'longitude'],
    ['y', 'number', 'latitude'],
  ])
  assert.equal(isDevicePropertyAggregateOrderedPath(fields), true)
})

test('keeps a byte-bounded ordered path inline without widening ordinary aggregates', () => {
  const fields = [
    {
      name: 'time', type: 'timestamp' as const, role: 'temporal_dimension' as const,
      axis: 'time', encoding: 'date-time' as const, format: 'datetime',
    },
    { name: 'x', type: 'number' as const, role: 'longitude' as const, measure: 'location', aggregation: 'last' },
    { name: 'y', type: 'number' as const, role: 'latitude' as const, measure: 'location', aggregation: 'last' },
  ]
  const path = Array.from({ length: 1200 }, (_, index) => ({
    time: '2026-01-01T00:00:00.000Z',
    x: 120 + index / 1_000_000,
    y: 30 + index / 1_000_000,
  }))
  const numeric = Array.from({ length: 201 }, (_, index) => ({
    time: index,
    value: index,
  }))

  assert.equal(shouldInlineDevicePropertyAggregate(path, fields, 200), true)
  assert.equal(shouldInlineDevicePropertyAggregate(numeric, [
    {
      name: 'time', type: 'timestamp', role: 'temporal_dimension',
      axis: 'time', encoding: 'date-time', format: 'datetime',
    },
    { name: 'value', type: 'number', role: 'measure', measure: 'value', aggregation: 'avg' },
  ], 200), false)
  assert.equal(shouldInlineDevicePropertyAggregate(path.map(item => ({
    ...item,
    padding: 'x'.repeat(100),
  })), fields, 200), false)
})
