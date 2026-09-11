import assert from 'node:assert/strict'
import test from 'node:test'

import { createDeviceMetricOutput } from '../views/device/list/agent/deviceDetailAgent.metricOutput.ts'

const metricCases = [
  {
    id: 'device_activity_aggregate' as const,
    fields: [
      ['time', 'timestamp', 'temporal_dimension', 'time'],
      ['value', 'number', 'measure', 'active_duration'],
    ],
  },
  {
    id: 'device_message_aggregate' as const,
    fields: [
      ['time', 'timestamp', 'temporal_dimension', 'time'],
      ['upstream', 'number', 'measure', 'upstream_messages'],
      ['downstream', 'number', 'measure', 'downstream_messages'],
    ],
  },
  {
    id: 'device_traffic_aggregate' as const,
    fields: [
      ['time', 'timestamp', 'temporal_dimension', 'time'],
      ['upstreamBytes', 'number', 'measure', 'upstream_traffic'],
      ['downstreamBytes', 'number', 'measure', 'downstream_traffic'],
    ],
  },
]

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
  }
})
