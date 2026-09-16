import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDomainAgentAggregateCardinality,
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'

import { deviceMetricsService } from '../agentCapabilities/deviceAnalysis/deviceMetrics.service.ts'
import { createDeviceAnalysisTools } from '../agentCapabilities/deviceAnalysis/tools.ts'

const stateSummary = {
  total: 20,
  online: 12,
  offline: 5,
  disabled: 2,
  noData: 1,
  onlineRate: 60,
}

const stateSummaryFields = Object.keys(stateSummary)

test('device state summary declares exact user-visible fields for terminal narrative evidence', () => {
  const factory = createDeviceAnalysisTools().find(item => item.id === 'device_get_state_summary')
  assert.ok(factory)
  const tool = factory.build()
  assert.ok(!Array.isArray(tool.output))
  const output = tool._meta?.clientToolContract.outputs[0]
  assert.equal(output?.recordPath, '$')

  assert.deepEqual(output?.fields?.map(field => ({
    name: field.name,
    role: field.role,
    type: field.type,
    unit: field.unit,
  })), [
    { name: 'total', role: 'measure', type: 'integer', unit: 'count' },
    { name: 'online', role: 'measure', type: 'integer', unit: 'count' },
    { name: 'offline', role: 'measure', type: 'integer', unit: 'count' },
    { name: 'disabled', role: 'measure', type: 'integer', unit: 'count' },
    { name: 'noData', role: 'measure', type: 'integer', unit: 'count' },
    { name: 'onlineRate', role: 'measure', type: 'number', unit: 'percent' },
  ])
  assert.ok(output?.fields?.every(field => field.label))

  const onlineRate = output?.fields?.find(field => field.name === 'onlineRate')
  assert.equal(onlineRate?.label, 'IotGeneralAgent.metrics.onlineRate')
  assert.equal(onlineRate?.format, 'percent')
  assert.equal(onlineRate?.unit, 'percent')
  assert.equal(onlineRate?.label?.includes('%'), false)

  const trendFactory = createDeviceAnalysisTools().find(item => item.id === 'device_query_online_rate_trend')
  assert.ok(trendFactory)
  const trend = trendFactory.build()
  assert.ok(!Array.isArray(trend.output))
  assert.deepEqual(trend.routing?.resultDeliveries, ['auto'])
  assert.equal(trend.routing?.analyticalCapability?.output?.fieldSet?.mode, 'execution-authored')
  assert.deepEqual(
    trend._meta?.clientToolContract.outputs[0]?.fields?.map(field => field.name),
    ['timestamp'],
  )
})

test('device state summary exposes only authoritative metrics to the model', async () => {
  assert.equal(deviceMetricsService.stateSummary.toString().includes('snapshotAt'), false)

  const executeStateSummary = deviceMetricsService.stateSummary
  deviceMetricsService.stateSummary = async () => createDomainAgentToolResult({
    domain: 'device',
    summary: stateSummary,
    facts: stateSummary,
    data: stateSummary,
    total: stateSummary.total,
    cardinality: createDomainAgentRecordSetCardinality({ returnedCount: stateSummary.total }),
  })

  try {
    const factory = createDeviceAnalysisTools().find(item => item.id === 'device_get_state_summary')
    assert.ok(factory)
    const tool = factory.build()
    const result = await tool.execute({}, {}, { id: 'state-summary-call', toolName: tool.id }) as any
    const modelVisibleValues = [
      result.summary,
      result.__clientToolOutputs?.output0,
      result.evidence?.facts,
    ]

    assert.equal(result.success, true)
    for (const value of modelVisibleValues) {
      assert.deepEqual(Object.keys(value || {}), stateSummaryFields)
      assert.equal(Object.hasOwn(value || {}, 'snapshotAt'), false)
      assert.deepEqual(value, stateSummary)
    }
    assert.deepEqual(result.outputBindings?.[0]?.fields?.map((field: any) => field.name), stateSummaryFields)
  } finally {
    deviceMetricsService.stateSummary = executeStateSummary
  }
})

test('device trend tools compile as execution-authored and emit exhaustive series bindings', async () => {
  const points = [
    { label: '09-08', value: 80, timestamp: 1_700_000_000_000 },
    { label: '09-09', value: 81, timestamp: 1_700_086_400_000 },
  ]
  const originalOnlineRateTrend = deviceMetricsService.onlineRateTrend
  const originalMessageTrend = deviceMetricsService.messageTrend
  const completeSeries = async (metric: string) => createDomainAgentToolResult({
    domain: 'device',
    timeRange: { start: 1_700_000_000_000, end: 1_700_086_400_000 },
    summary: { metric },
    data: { metric, points },
    cardinality: createDomainAgentAggregateCardinality({
      bucketCount: 2,
      populatedBucketCount: 2,
      measurementCount: 2,
    }),
    requestSatisfied: true,
    exhaustive: true,
  })
  deviceMetricsService.onlineRateTrend = async () => completeSeries('onlineRate')
  deviceMetricsService.messageTrend = async () => completeSeries('uplinkMessages')
  try {
    for (const id of ['device_query_online_rate_trend', 'device_query_message_trend'] as const) {
      const factory = createDeviceAnalysisTools().find(item => item.id === id)
      assert.ok(factory, `${id} missing from device analysis tools`)
      const tool = factory.build()
      assert.equal(tool.routing?.analyticalCapability?.output?.fieldSet?.mode, 'execution-authored')
      const result = await tool.execute(
        { timeRange: '7d' },
        {},
        { id: `${id}-contract`, toolName: id },
      ) as {
        outputBindings?: Array<{
          recordCount?: number
          exhaustive?: boolean
          fields?: Array<{ name?: string; label?: string; format?: string; unit?: string }>
        }>
        evidence?: { exhaustive?: boolean }
      }
      const binding = result.outputBindings?.[0]
      const valueField = binding?.fields?.find(field => field.name === 'value')
      assert.equal(binding?.recordCount, 2, `${id} binding.recordCount`)
      assert.equal(binding?.exhaustive, true, `${id} binding.exhaustive`)
      assert.equal(result.evidence?.exhaustive, true, `${id} evidence.exhaustive`)
      if (id === 'device_query_online_rate_trend') {
        assert.equal(valueField?.label, 'IotGeneralAgent.metrics.onlineRate')
        assert.equal(valueField?.format, 'percent')
        assert.equal(valueField?.unit, 'percent')
        assert.equal(valueField?.label?.includes('%'), false)
      }
    }
  } finally {
    deviceMetricsService.onlineRateTrend = originalOnlineRateTrend
    deviceMetricsService.messageTrend = originalMessageTrend
  }
})

test('device health summary keeps a display label separate from its authoritative timestamp', () => {
  const factory = createDeviceAnalysisTools().find(item => item.id === 'device_health_summary')
  assert.ok(factory)
  const tool = factory.build()
  assert.ok(!Array.isArray(tool.output))
  const output = tool._meta?.clientToolContract.outputs[0]
  assert.equal(output?.recordPath, '$.offlineDevices')

  assert.deepEqual(output?.fields?.filter(field => field.name === 'lastSeen' || field.name === 'lastSeenTimestamp'), [
    {
      name: 'lastSeen', type: 'string', role: 'label',
      label: 'IotHealthPage.detail.field.lastSeen',
    },
    {
      name: 'lastSeenTimestamp', type: 'timestamp', role: 'temporal_dimension',
      label: 'IotHealthPage.detail.field.lastSeen', encoding: 'epoch-millis',
    },
  ])
})
