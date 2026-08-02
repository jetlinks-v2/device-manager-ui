import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDeviceMetadataSearchTool,
  createDeviceModelGetTool,
  createDevicePropertyAggregateDefinition,
  createDevicePropertyHistoryTool,
  devicePropertyAnalysisResult,
  DEVICE_PROPERTY_ANALYSIS_OUTPUTS,
} from '../views/device/agentTools/devicePropertyAnalysisTools.ts'

const copy = {
  displayName: 'Device trajectory',
  progressText: 'Reading device data',
  description: 'Read device property data',
  help: 'Use the declared capability and evidence contract.',
}

const callFor = (toolName: string) => ({ id: `${toolName}-call`, toolName })

const declarationContract = (tool: Record<string, any>) => ({
  routing: tool.routing,
  annotations: tool.annotations,
  risk: tool.risk,
  resultBindings: tool._meta?.resultBindings,
  authoring: tool._meta?.clientToolDefinition,
})

test('two entry adapters compile identical canonical model contracts and verified schema bindings', async () => {
  const createEntryTool = () => createDeviceModelGetTool<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({
      model: {
        properties: [{ id: 'temperature' }],
        events: [{ id: 'overheat' }],
        functions: [{ id: 'restart' }],
        tags: [{ id: 'area' }],
      },
    }),
  })
  const domainTool = createEntryTool()
  const detailTool = createEntryTool()

  assert.deepEqual(declarationContract(domainTool), declarationContract(detailTool))
  assert.deepEqual(domainTool.routing?.capabilities, ['subject.schema.read'])
  assert.deepEqual(domainTool.routing?.produces, [
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.eventId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.functionId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.tagId.name,
  ])
  assert.equal(domainTool.annotations?.readOnlyHint, true)

  const result = await detailTool.execute({}, {}, callFor(detailTool.id)) as any
  assert.equal(result.success, true)
  assert.deepEqual(result.outputBindings.map((binding: any) => binding.name), [
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.eventId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.functionId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.tagId.name,
  ])
  assert.deepEqual(result.__clientToolOutputs, {
    output0: ['temperature'],
    output1: ['overheat'],
    output2: ['restart'],
    output3: ['area'],
  })
})

test('metadata search emits only identifiers that were actually found', async () => {
  const tool = createDeviceMetadataSearchTool<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({
      matches: [
        { type: 'properties', id: 'battery' },
        { type: 'properties', id: '' },
        { type: 'events', id: 'lowBattery' },
      ],
    }),
  })

  const result = await tool.execute({}, {}, callFor(tool.id)) as any
  assert.deepEqual(result.outputBindings.map((binding: any) => binding.name), [
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name,
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.eventId.name,
  ])
  assert.deepEqual(result.__clientToolOutputs.output0, ['battery'])
  assert.deepEqual(result.__clientToolOutputs.output1, ['lowBattery'])
})

test('raw property history stays a record producer and preserves partial evidence', async () => {
  const tool = createDevicePropertyHistoryTool<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({
      records: [{ timestamp: 2, value: 21 }],
    }, {
      complete: false,
      truncated: true,
      limitReason: 'records',
    }),
  })

  assert.deepEqual(tool.routing?.capabilities, ['subject.property.history.read'])
  assert.equal(tool.id, 'device_property_raw_records')
  assert.deepEqual(tool.routing?.produces, [DEVICE_PROPERTY_ANALYSIS_OUTPUTS.history.name])
  assert.equal(tool.routing?.produces?.includes(DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name), false)

  const result = await tool.execute({}, {}, callFor(tool.id)) as any
  assert.equal(result.complete, false)
  assert.equal(result.truncated, true)
  assert.equal(result.evidence.limitReason, 'records')
  assert.deepEqual(result.outputBindings.map((binding: any) => binding.name), [
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.history.name,
  ])
})

test('raw property history accepts standard record-stream delivery without changing its logical binding', async () => {
  const tool = createDevicePropertyHistoryTool<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({
      records: {
        kind: 'ai-client-tool-record-stream/v1',
        source: {
          consume: async () => undefined,
        },
        schema: {
          type: 'object',
          properties: {
            timestamp: { type: 'number', 'x-ai-role': 'timestamp' },
            value: { type: 'number', 'x-ai-role': 'number' },
          },
        },
      },
    }),
  })

  const prepared = await tool.execute({}, {}, callFor(tool.id)) as any
  assert.equal(prepared.data.kind, 'ai-client-tool-record-stream/v1')
  assert.equal(prepared.data.bindingName, DEVICE_PROPERTY_ANALYSIS_OUTPUTS.history.name)
  assert.equal(prepared.data.outputShape, DEVICE_PROPERTY_ANALYSIS_OUTPUTS.history.shape)
})

test('aggregate output derives a renderer-ready, zoomable line path from semantic coordinates', async () => {
  const points = [
    { time: 1, position_longitude: 120.1, position_latitude: 30.1 },
    { time: 2, position_longitude: 120.2, position_latitude: 30.2 },
  ]
  const fields = [
    { name: 'time', semanticRole: 'timestamp' as const, format: 'datetime' },
    { name: 'position_longitude', semanticRole: 'longitude' as const, measure: 'position', aggregation: 'last' },
    { name: 'position_latitude', semanticRole: 'latitude' as const, measure: 'position', aggregation: 'last' },
  ]
  const tool = createDevicePropertyAggregateDefinition<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({ records: points, fields }),
  })

  assert.deepEqual(
    tool.routing?.produces?.filter(name => !name.endsWith('-echarts-source')),
    [DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name],
  )
  assert.deepEqual(tool.routing?.capabilities, ['subject.property.aggregate'])

  const prepared = await tool.execute({}, {}, callFor(tool.id)) as any
  const option = prepared.data.modelSafeInline
  assert.equal(option.series[0].type, 'line')
  assert.equal(option.xAxis.scale, true)
  assert.equal(option.yAxis.scale, true)
  assert.deepEqual(option.dataZoom, [
    { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
    { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
  ])
  assert.equal(prepared.outputBindings[0].label, copy.displayName)
})

test('empty aggregate results remain successful empty evidence without fabricating a chart', async () => {
  const tool = createDevicePropertyAggregateDefinition<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({
      records: [],
      fields: [{ name: 'time', semanticRole: 'timestamp', format: 'datetime' }],
    }, { status: 'empty' }),
  })

  const result = await tool.execute({}, {}, callFor(tool.id)) as any
  assert.equal(result.status, 'empty')
  assert.deepEqual(result.__clientToolOutputs.output0, [])
  assert.equal(result.data, undefined)
  assert.deepEqual(result.outputBindings.map((binding: any) => binding.name), [
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name,
  ])
})
