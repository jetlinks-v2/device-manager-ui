import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDevicePropertyAggregateColumns,
  createDevicePropertyAggregateFields,
  createDevicePropertyAggregateRecordSchema,
  normalizeDevicePropertyAggregateData,
} from '../views/device/agentTools/propertyAggregateSupport.ts'

const metadata = {
  properties: [
    { id: 'location', name: 'Position', valueType: { type: 'geoPoint' } },
    { id: 'temperature', name: 'Temperature', valueType: { type: 'double', unit: '℃' } },
    { id: 'state', name: 'State', valueType: { type: 'enum' } },
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
    { time: 0, temperature: 20 },
    { time: 1, location_longitude: 120.1, location_latitude: 30.1, temperature: 21 },
    { time: 2, location_longitude: 120.2, location_latitude: 30.2, temperature: 22 },
  ])
})

test('publishes renderer-neutral geo roles and numeric record schema', () => {
  const fields = createDevicePropertyAggregateFields(metadata, [
    { property: 'location', alias: 'location', agg: 'LAST' },
    { property: 'temperature', alias: 'temperature', agg: 'AVG' },
  ], {
    longitude: label => `${label} longitude`,
    latitude: label => `${label} latitude`,
  })

  assert.deepEqual(fields, [
    { name: 'time', semanticRole: 'timestamp', format: 'datetime' },
    {
      name: 'location_longitude',
      semanticRole: 'longitude',
      label: 'Position longitude',
      measure: 'location',
      aggregation: 'last',
    },
    {
      name: 'location_latitude',
      semanticRole: 'latitude',
      label: 'Position latitude',
      measure: 'location',
      aggregation: 'last',
    },
    {
      name: 'temperature',
      semanticRole: 'number',
      label: 'Temperature',
      measure: 'temperature',
      aggregation: 'avg',
      unit: '℃',
    },
  ])

  assert.deepEqual(createDevicePropertyAggregateRecordSchema(fields), {
    type: 'object',
    properties: {
      time: { type: 'string', 'x-ai-role': 'timestamp', format: 'date-time' },
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
        'x-ai-role': 'number',
        label: 'Temperature',
        'x-ai-measure': 'temperature',
        'x-ai-unit': '℃',
        'x-ai-aggregation': 'avg',
      },
    },
  })
})
