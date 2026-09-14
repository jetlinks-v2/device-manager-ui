import assert from 'node:assert/strict'
import test from 'node:test'

import { createDomainAgentTimeScopeContract } from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { toAiClientToolSessionDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'

import {
  createDeviceMetadataSearchTool,
  createDeviceModelGetTool,
  createDevicePropertyAggregateDefinition,
  createDevicePropertySelectorAlternatives,
  createDevicePropertyHistoryTool,
  devicePropertyAnalysisResult,
  DEVICE_PROPERTY_ANALYSIS_OUTPUTS,
} from '../views/device/agentTools/devicePropertyAnalysisTools.ts'
import {
  createDevicePropertyAggregateFields,
  createDevicePropertyAggregateRecordSchema,
  DEVICE_PROPERTY_AGGREGATE_TIME_FIELD,
  normalizeDevicePropertyAggregateData,
} from '../views/device/agentTools/propertyAggregateSupport.ts'
import { withDevicePropertyAggregateTimeZone } from '../views/device/agentTools/propertyAggregateTimeZone.ts'
import { createDeviceAnalysisTools } from '../agentCapabilities/deviceAnalysis/tools.ts'
import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools.ts'

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

const routing = (definition: Record<string, any>) => definition.expands?.['x-ai-routing']

test('property aggregate preserves the session time zone in both typed ranges without changing an absent zone', () => {
  const requested = { start: 1_785_387_600_000, end: 1_785_473_999_999 }
  const observed = { start: 1_785_391_200_000, end: 1_785_470_400_000 }

  assert.deepEqual(withDevicePropertyAggregateTimeZone(requested, 'Asia/Shanghai'), {
    ...requested,
    zoneId: 'Asia/Shanghai',
  })
  assert.deepEqual(withDevicePropertyAggregateTimeZone(observed, 'Asia/Shanghai'), {
    ...observed,
    zoneId: 'Asia/Shanghai',
  })
  assert.deepEqual(withDevicePropertyAggregateTimeZone(requested, ''), requested)
  assert.equal(withDevicePropertyAggregateTimeZone(undefined, 'Asia/Shanghai'), undefined)
})

const forbiddenRuntimeOwnedKeys = (value: unknown, path = '$'): string[] => {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const childPath = `${path}.${key}`
    const allowedContinuation = childPath === '$.x-ai-routing.analyticalCapability.completeness.continuation'
    const forbidden = ['continuation', 'sourceArgument', 'targetArgument'].includes(key) && !allowedContinuation
      ? [childPath]
      : []
    return [...forbidden, ...forbiddenRuntimeOwnedKeys(child, childPath)]
  })
}

const detailService = new Proxy({}, {
  get: () => async () => ({}),
}) as any

const serializedTool = (tools: readonly any[], id: string) => {
  const tool = tools.find(candidate => candidate.id === id)
  assert.ok(tool, `missing ${id}`)
  return toAiClientToolSessionDefinition(tool)
}

test('general and device-detail sessions serialize the same property discovery-to-aggregate contract', () => {
  const general = createDeviceAnalysisTools()
    .map(factory => factory.build())
  const detail = createDeviceDetailAgentTools(detailService)

  const sessions = [
    { name: 'general', tools: general, discovery: 'device_model_get' },
    { name: 'detail', tools: detail, discovery: 'device_model_search' },
  ]
  for (const session of sessions) {
    const aggregate = serializedTool(session.tools, 'device_property_aggregate') as Record<string, any>
    const producer = serializedTool(session.tools, session.discovery) as Record<string, any>
    const metadata = routing(aggregate)
    const producerMetadata = routing(producer)

    assert.ok(metadata, `${session.name}: aggregate routing metadata is required`)
    assert.ok(producerMetadata, `${session.name}: discovery routing metadata is required`)
    assert.ok(metadata.analyticalCapability)
    assert.deepEqual(metadata.resultDeliveries, ['auto'])
    const propertyConsumer = metadata.consumerPorts?.find((consume: any) => consume.name === 'subject-property-id')
    assert.ok(propertyConsumer, JSON.stringify(metadata))
    assert.equal(propertyConsumer.argumentBinding?.argument, 'propertyId')
    assert.ok(metadata.analyticalCapability?.argumentBindings?.some((binding: any) => binding.semantic === 'temporal'))
    assert.ok(producerMetadata.produces?.includes('subject-property-id'), JSON.stringify(producerMetadata))
    assert.deepEqual(forbiddenRuntimeOwnedKeys(aggregate.expands), [])
  }
})

const parameterSchemaAdmits = (
  schema: Record<string, any>,
  args: Record<string, unknown>,
) => (schema.oneOf || []).filter((branch: Record<string, any>) => {
  const required = Array.isArray(branch.required) ? branch.required : []
  const forbidden = (branch.not?.anyOf || [])
    .flatMap((condition: Record<string, any>) => condition.required || [])
  if (!required.every((name: string) => Object.prototype.hasOwnProperty.call(args, name))) return false
  if (forbidden.some((name: string) => Object.prototype.hasOwnProperty.call(args, name))) return false
  return Object.entries(branch.properties || {}).every(([name, constraint]) => {
    const value = args[name]
    const property = constraint as Record<string, any>
    if (Object.prototype.hasOwnProperty.call(property, 'const')) return value === property.const
    return !Array.isArray(property.enum) || property.enum.includes(value)
  })
}).length === 1

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

test('aggregate output preserves renderer-neutral records and semantic fields for the canonical compiler', async () => {
  const points = [
    { time: '2026-08-24T10:00:00.000Z', temperature: 20.1 },
    { time: '2026-08-24T10:01:00.000Z', temperature: 20.2 },
  ]
  const fields = [
    {
      name: 'time', type: 'timestamp' as const, role: 'temporal_dimension' as const,
      axis: 'time', encoding: 'date-time' as const, format: 'datetime',
    },
    {
      name: 'temperature', type: 'number' as const, role: 'measure' as const,
      label: 'Temperature', measure: 'temperature', unit: 'celsius', aggregation: 'avg',
    },
  ]
  const tool = createDevicePropertyAggregateDefinition<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({ records: points, fields }),
  })

  assert.deepEqual(tool.routing?.produces, [DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name])
  assert.deepEqual(tool.routing?.resultDeliveries, ['auto'])
  assert.deepEqual(tool.routing?.capabilities, ['subject.property.aggregate'])
  assert.deepEqual(tool.routing?.analyticalCapability?.output, {
    shape: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.shape,
    fieldSet: { mode: 'execution-authored', measureCoordinates: 'execution-authored', maxFields: 33 },
  })
  assert.deepEqual(tool.routing?.analyticalCapability?.ordering, [{
    axis: 'time',
    direction: 'asc',
    producerGuaranteed: true,
  }])
  assert.deepEqual(tool._meta?.resultBindings?.[0]?.ordering, {
    keys: [{ field: 'time', direction: 'asc' }],
    producerGuaranteed: true,
  })

  const prepared = await tool.execute({}, {}, callFor(tool.id)) as any
  assert.equal(prepared.data, undefined)
  assert.deepEqual(prepared.__clientToolOutputs.output0, points)
  assert.equal(prepared.outputBindings[0].name, DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name)
  assert.equal(prepared.outputBindings[0].shape, DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.shape)
  assert.equal(prepared.outputBindings[0].path, '$.__clientToolOutputs.output0')
  assert.deepEqual(prepared.outputBindings[0].fields, fields)
  assert.deepEqual(prepared.outputBindings[0].ordering, {
    keys: [{ field: 'time', direction: 'asc' }],
    producerGuaranteed: true,
  })
  assert.equal(JSON.stringify(prepared.outputBindings[0].fields).includes('semanticRole'), false)
  assert.equal(prepared.outputBindings[0].label, copy.displayName)
})

test('ordered paths keep one canonical time key across rows, fields and streamed schema', () => {
  const metadata = {
    properties: [{ id: 'position', name: 'Position', valueType: { type: 'geoPoint' } }],
  }
  const columns = [{ property: 'position', alias: 'position', agg: 'LAST' as const }]
  const rows = normalizeDevicePropertyAggregateData([
    { time: '2026-08-24T10:01:00+00:00', position: '120.2,30.2' },
    { time: '2026-08-24T10:00:00+00:00', position: '120.1,30.1' },
  ], metadata, columns, value => value)
  const fields = createDevicePropertyAggregateFields(metadata, columns, {
    longitude: label => `${label} longitude`,
    latitude: label => `${label} latitude`,
  })
  const schema = createDevicePropertyAggregateRecordSchema(fields)

  assert.deepEqual(rows.map(row => Object.keys(row)), [
    ['time', 'x', 'y'],
    ['time', 'x', 'y'],
  ])
  assert.deepEqual(rows.map(row => row.time), [
    '2026-08-24T10:00:00.000Z',
    '2026-08-24T10:01:00.000Z',
  ])
  assert.equal(rows.some(row => Object.prototype.hasOwnProperty.call(row, 't')), false)
  assert.deepEqual(fields[0], DEVICE_PROPERTY_AGGREGATE_TIME_FIELD)
  assert.deepEqual(fields.map(field => field.name), ['time', 'x', 'y'])
  assert.deepEqual(Object.keys(schema.properties), ['time', 'x', 'y'])
  assert.deepEqual(schema.properties.time, {
    type: 'string',
    'x-ai-role': 'temporal_dimension',
    format: 'date-time',
  })

  const scalarMetadata = {
    properties: [{ id: 'temperature', name: 'Temperature', valueType: { type: 'float' } }],
  }
  const scalarColumns = [{ property: 'temperature', alias: 'temperature', agg: 'AVG' as const }]
  const scalarRows = normalizeDevicePropertyAggregateData([
    { time: '2026-08-24T10:00:00+00:00', temperature: 20.1 },
  ], scalarMetadata, scalarColumns, value => value)
  const scalarFields = createDevicePropertyAggregateFields(scalarMetadata, scalarColumns, {
    longitude: label => `${label} longitude`,
    latitude: label => `${label} latitude`,
  })
  assert.deepEqual(Object.keys(scalarRows[0]), ['time', 'temperature'])
  assert.deepEqual(scalarFields.map(field => field.name), ['time', 'temperature'])
})

test('aggregate compiles one closed temporal contract into the analytical wire', async () => {
  const timeScope = createDomainAgentTimeScopeContract({
    timeRange: 'today, 24h, 7d, 30d, or custom',
    startTime: 'ISO date-time start for custom',
    endTime: 'ISO date-time end for custom',
  })
  let callbackCount = 0
  const tool = createDevicePropertyAggregateDefinition<Record<string, unknown>>({
    copy,
    inputs: [
      { id: 'propertyId', valueType: 'string' },
      {
        id: 'propertyIds',
        valueType: { type: 'array', elementType: { type: 'string' } },
      },
      ...timeScope.inputs,
    ],
    inputAlternatives: createDevicePropertySelectorAlternatives(timeScope.inputAlternatives),
    temporal: timeScope.temporal,
    execute: () => {
      callbackCount += 1
      return devicePropertyAnalysisResult({
        records: [],
        fields: [{ name: 'time', semanticRole: 'timestamp', format: 'datetime' }],
      }, { status: 'empty' })
    },
  })

  assert.equal(tool.parameterSchema?.oneOf?.length, 4)
  const schema = tool.parameterSchema as Record<string, any>
  assert.equal(parameterSchemaAdmits(schema, { propertyId: 'cpu', timeRange: 'today||now' }), false)
  assert.equal(parameterSchemaAdmits(schema, { propertyId: 'cpu', timeRange: 'today' }), true)
  assert.equal(parameterSchemaAdmits(schema, { propertyIds: ['cpu', 'memory'], timeRange: 'today' }), true)
  assert.equal(parameterSchemaAdmits(schema, { propertyId: 'cpu', timeRange: 'custom' }), false)
  assert.equal(parameterSchemaAdmits(schema, {
    propertyIds: ['cpu', 'memory'],
    timeRange: 'custom',
    startTime: '2031-02-03T00:00:00+08:00',
    endTime: '2031-02-04T00:00:00+08:00',
  }), true)
  const executeWhenAdmitted = async (args: Record<string, unknown>) => {
    if (!parameterSchemaAdmits(schema, args)) return false
    await tool.execute(args, {}, callFor(tool.id))
    return true
  }
  assert.equal(await executeWhenAdmitted({
    propertyId: 'cpu',
    timeRange: 'today||now',
  }), false)
  assert.equal(callbackCount, 0)
  assert.equal(await executeWhenAdmitted({ propertyId: 'cpu', timeRange: 'today' }), true)
  assert.equal(await executeWhenAdmitted({
    propertyIds: ['cpu', 'memory'],
    timeRange: 'custom',
    startTime: '2031-02-03T00:00:00+08:00',
    endTime: '2031-02-04T00:00:00+08:00',
  }), true)
  assert.equal(callbackCount, 2)

  const routing = tool.routing as Record<string, any>
  const temporalBindings = routing.analyticalCapability.argumentBindings
    .filter((binding: Record<string, any>) => binding.semantic === 'temporal')
  assert.deepEqual(temporalBindings, [{
    semantic: 'temporal',
    rangeArgument: 'timeRange',
    startArgument: 'startTime',
    endArgument: 'endTime',
    customValue: 'custom',
    encoding: 'date-time',
  }])
  assert.equal(routing.temporalArgumentBinding, undefined)
  assert.deepEqual(routing.consumerPorts, [{
    name: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name,
    type: 'structured-data',
    mediaType: 'application/json',
    shape: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.shape,
    required: false,
    sourcePolicy: 'EITHER',
    argumentBinding: {
      argument: 'propertyId',
      valueCardinality: 'exactly-one',
      encoding: 'single-string',
    },
  }])

})

test('only trend aggregate series advertise auto delivery for shared presentation compilation', () => {
  const general = createDeviceAnalysisTools().map(factory => factory.build())
  const deliveries = Object.fromEntries(general.map(tool => [tool.id, tool.routing?.resultDeliveries]))
  assert.deepEqual(deliveries.device_query_online_rate_trend, ['auto'])
  assert.deepEqual(deliveries.device_query_message_trend, ['auto'])
  assert.deepEqual(deliveries.device_property_aggregate, ['auto'])
  assert.deepEqual(deliveries.device_get_state_summary, ['inline'])
  assert.deepEqual(deliveries.device_property_raw_records, ['inline'])
})

test('empty aggregate results remain successful empty evidence without fabricating a chart', async () => {
  const tool = createDevicePropertyAggregateDefinition<Record<string, unknown>>({
    copy,
    inputs: [],
    execute: () => devicePropertyAnalysisResult({
      records: [],
      fields: [{
        name: 'time', type: 'timestamp', role: 'temporal_dimension',
        axis: 'time', encoding: 'date-time', format: 'datetime',
      }],
    }, { status: 'empty' }),
  })

  const result = await tool.execute({}, {}, callFor(tool.id)) as any
  assert.equal(result.status, 'empty')
  assert.deepEqual(result.__clientToolOutputs.output0, [])
  assert.equal(result.data, undefined)
  assert.deepEqual(result.outputBindings.map((binding: any) => binding.name), [
    DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name,
  ])
  assert.equal(result.outputBindings.length, 1)
  assert.equal(result.outputBindings[0].path, '$.__clientToolOutputs.output0')
  assert.equal(result.outputBindings[0].recordPath, '$')
  assert.equal(result.outputBindings[0].recordCount, 0)
  assert.equal(result.outputBindings[0].completeness, 'complete')
  assert.equal(result.outputBindings[0].fields, undefined)
  assert.equal(result.outputBindings[0].ordering, undefined)
})
