import {
  clientToolOutput,
  clientToolResult,
  defineClientTool,
  type ClientToolInput,
  type ClientToolInputAlternative,
  type CompiledClientTool,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import type {
  AiClientToolCall,
  AiClientToolOutputField,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type JsonRecord = Record<string, unknown>
type MaybePromise<T> = T | Promise<T>

export const DEVICE_PROPERTY_ANALYSIS_TOOL_IDS = {
  modelGet: 'device_model_get',
  metadataSearch: 'device_metadata_search',
  latestProperties: 'device_latest_properties',
  propertyHistorySummary: 'device_property_history_summary',
  propertyHistory: 'device_property_raw_records',
  propertyAggregate: 'device_property_aggregate',
} as const

export const DEVICE_PROPERTY_ANALYSIS_OUTPUTS = {
  propertyId: { name: 'subject-property-id', shape: 'schema.property-ids' },
  eventId: { name: 'subject-event-id', shape: 'schema.event-ids' },
  functionId: { name: 'subject-function-id', shape: 'schema.function-ids' },
  tagId: { name: 'subject-tag-id', shape: 'schema.tag-ids' },
  latest: { name: 'property-snapshot', shape: 'property.snapshot' },
  historySummary: { name: 'property-history-summary', shape: 'time-series.summary' },
  history: { name: 'property-history-records', shape: 'time-series.records' },
  aggregate: { name: 'property-aggregate', shape: 'time-series.aggregate' },
} as const

const SCHEMA_SECTIONS = ['properties', 'events', 'functions', 'tags'] as const
type SchemaSection = typeof SCHEMA_SECTIONS[number]

export interface DevicePropertyAnalysisExecution<TResult> {
  value: TResult
  status?: string
  complete?: boolean
  truncated?: boolean
  limitReason?: string
  summary?: JsonRecord
  requestedRange?: JsonRecord
  observedRange?: JsonRecord
  facts?: JsonRecord
  warnings?: string[]
}

export interface DevicePropertyAnalysisCopy {
  description: string
  help?: string
  displayName?: string
  progressText?: string
}

export interface DeviceModelGetResult extends JsonRecord {
  model: Partial<Record<SchemaSection, JsonRecord[]>>
}

export interface DeviceMetadataSearchMatch extends JsonRecord {
  type: string
  id?: unknown
}

export interface DeviceMetadataSearchResult extends JsonRecord {
  matches: DeviceMetadataSearchMatch[]
}

export interface DevicePropertyHistoryResult extends JsonRecord {
  records: unknown
}

export interface DevicePropertyAggregateResult extends JsonRecord {
  records: unknown
  fields: readonly AiClientToolOutputField[]
}

interface DevicePropertyToolDependencies<TContext, TResult> {
  copy: DevicePropertyAnalysisCopy
  inputs: ClientToolInput[]
  inputAlternatives?: ClientToolInputAlternative[]
  execute: (
    args: JsonRecord,
    context: TContext,
    call: AiClientToolCall,
  ) => MaybePromise<DevicePropertyAnalysisExecution<TResult>>
}

const owner = { module: 'device-manager-ui', group: 'device-property-analysis' } as const

const toClientToolResult = <TResult>(result: DevicePropertyAnalysisExecution<TResult>) => {
  const options = {
    ...(result.status ? { status: result.status } : {}),
    ...(result.summary ? { summary: result.summary } : {}),
    ...(result.requestedRange ? { requestedRange: result.requestedRange } : {}),
    ...(result.observedRange ? { observedRange: result.observedRange } : {}),
    ...(result.facts ? { facts: result.facts } : {}),
    ...(result.warnings?.length ? { warnings: result.warnings } : {}),
    ...(result.limitReason ? { limitReason: result.limitReason } : {}),
  }
  return result.complete === false || result.truncated === true
    ? clientToolResult.partial(result.value, options)
    : clientToolResult.success(result.value, {
        ...options,
        status: result.status === 'empty' ? 'empty' : 'ok',
      })
}

export const devicePropertyAnalysisResult = <TResult>(
  value: TResult,
  options: Omit<DevicePropertyAnalysisExecution<TResult>, 'value'> = {},
): DevicePropertyAnalysisExecution<TResult> => ({ value, ...options })

const toolPresentation = (copy: DevicePropertyAnalysisCopy) => ({
  ...(copy.displayName ? { displayName: copy.displayName } : {}),
  ...(copy.progressText ? { progressText: copy.progressText } : {}),
})

const schemaIds = (result: DeviceModelGetResult, section: SchemaSection) => {
  const ids = (result.model?.[section] || [])
    .map(item => String(item?.id ?? item?.key ?? '').trim())
    .filter(Boolean)
  return ids.length ? Array.from(new Set(ids)) : undefined
}

const searchedSchemaIds = (result: DeviceMetadataSearchResult, section: SchemaSection) => {
  const ids = (result.matches || [])
    .filter(item => item?.type === section)
    .map(item => String(item?.id ?? '').trim())
    .filter(Boolean)
  return ids.length ? Array.from(new Set(ids)) : undefined
}

const schemaOutputs = <TResult>(selector: (result: TResult, section: SchemaSection) => string[] | undefined) => ([
  clientToolOutput.lookup<TResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId,
    optional: true,
    select: result => selector(result, 'properties'),
  }),
  clientToolOutput.lookup<TResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.eventId,
    optional: true,
    select: result => selector(result, 'events'),
  }),
  clientToolOutput.lookup<TResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.functionId,
    optional: true,
    select: result => selector(result, 'functions'),
  }),
  clientToolOutput.lookup<TResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.tagId,
    optional: true,
    select: result => selector(result, 'tags'),
  }),
])

export const createDeviceModelGetTool = <TContext>(
  dependencies: DevicePropertyToolDependencies<TContext, DeviceModelGetResult>,
): CompiledClientTool<TContext> => defineClientTool<JsonRecord, TContext, DeviceModelGetResult>({
  id: DEVICE_PROPERTY_ANALYSIS_TOOL_IDS.modelGet,
  description: {
    text: dependencies.copy.description,
    help: dependencies.copy.help,
    capabilities: ['subject.schema.read'],
    intents: ['读取设备物模型定义', 'read subject schema definitions'],
  },
  presentation: toolPresentation(dependencies.copy),
  inputs: dependencies.inputs,
  inputAlternatives: dependencies.inputAlternatives,
  effect: { kind: 'READ' },
  output: schemaOutputs<DeviceModelGetResult>(schemaIds),
  owner,
  execute: async (args, context, call) => toClientToolResult(
    await dependencies.execute(args, context, call),
  ),
})

export const createDeviceMetadataSearchTool = <TContext>(
  dependencies: DevicePropertyToolDependencies<TContext, DeviceMetadataSearchResult>,
): CompiledClientTool<TContext> => defineClientTool<JsonRecord, TContext, DeviceMetadataSearchResult>({
  id: DEVICE_PROPERTY_ANALYSIS_TOOL_IDS.metadataSearch,
  description: {
    text: dependencies.copy.description,
    help: dependencies.copy.help,
    capabilities: ['subject.schema.search'],
    intents: ['定位设备物模型字段标识', 'resolve subject schema field identifiers'],
  },
  presentation: toolPresentation(dependencies.copy),
  inputs: dependencies.inputs,
  inputAlternatives: dependencies.inputAlternatives,
  effect: { kind: 'READ' },
  output: schemaOutputs<DeviceMetadataSearchResult>(searchedSchemaIds),
  owner,
  execute: async (args, context, call) => toClientToolResult(
    await dependencies.execute(args, context, call),
  ),
})

export const createDeviceLatestPropertiesTool = <TContext, TResult extends JsonRecord>(
  dependencies: DevicePropertyToolDependencies<TContext, TResult>,
): CompiledClientTool<TContext> => defineClientTool<JsonRecord, TContext, TResult>({
  id: DEVICE_PROPERTY_ANALYSIS_TOOL_IDS.latestProperties,
  description: {
    text: dependencies.copy.description,
    help: dependencies.copy.help,
    capabilities: ['subject.property.latest'],
    intents: ['读取设备属性当前值', 'read current subject property values'],
  },
  presentation: toolPresentation(dependencies.copy),
  inputs: dependencies.inputs,
  inputAlternatives: dependencies.inputAlternatives,
  consumes: [{ name: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name, optional: true, source: 'EITHER' }],
  effect: { kind: 'READ' },
  output: clientToolOutput.detail<TResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.latest,
    select: result => result,
  }),
  owner,
  execute: async (args, context, call) => toClientToolResult(
    await dependencies.execute(args, context, call),
  ),
})

export const createDevicePropertyHistorySummaryTool = <TContext, TResult extends JsonRecord>(
  dependencies: DevicePropertyToolDependencies<TContext, TResult>,
): CompiledClientTool<TContext> => defineClientTool<JsonRecord, TContext, TResult>({
  id: DEVICE_PROPERTY_ANALYSIS_TOOL_IDS.propertyHistorySummary,
  description: {
    text: dependencies.copy.description,
    help: dependencies.copy.help,
    capabilities: ['subject.property.history.summary'],
    intents: ['统计设备属性历史', 'summarize subject property history'],
    notFor: [
      '分析属性趋势、分桶统计或地理位置轨迹',
      'analyze property trends, bucketed statistics, or geographic paths',
    ],
  },
  presentation: toolPresentation(dependencies.copy),
  inputs: dependencies.inputs,
  inputAlternatives: dependencies.inputAlternatives,
  consumes: [{ name: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name, source: 'EITHER' }],
  effect: { kind: 'READ' },
  output: clientToolOutput.detail<TResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.historySummary,
    select: result => result,
  }),
  owner,
  execute: async (args, context, call) => toClientToolResult(
    await dependencies.execute(args, context, call),
  ),
})

export const createDevicePropertyHistoryTool = <TContext>(
  dependencies: DevicePropertyToolDependencies<TContext, DevicePropertyHistoryResult>,
): CompiledClientTool<TContext> => defineClientTool<JsonRecord, TContext, DevicePropertyHistoryResult>({
  id: DEVICE_PROPERTY_ANALYSIS_TOOL_IDS.propertyHistory,
  description: {
    text: dependencies.copy.description,
    help: dependencies.copy.help,
    capabilities: ['subject.property.history.read'],
    intents: ['读取设备属性的未聚合历史明细', 'read unaggregated subject property history records'],
    notFor: [
      '分析属性趋势、分桶统计或地理位置轨迹',
      'analyze property trends, bucketed statistics, or geographic paths',
    ],
  },
  presentation: toolPresentation(dependencies.copy),
  inputs: dependencies.inputs,
  inputAlternatives: dependencies.inputAlternatives,
  consumes: [{ name: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name, source: 'EITHER' }],
  effect: { kind: 'READ' },
  output: clientToolOutput.recordSet<DevicePropertyHistoryResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.history,
    select: result => result.records,
    fields: [
      { name: 'timestamp', semanticRole: 'timestamp', format: 'datetime' },
    ],
  }),
  owner,
  execute: async (args, context, call) => toClientToolResult(
    await dependencies.execute(args, context, call),
  ),
})

export const createDevicePropertyAggregateDefinition = <TContext>(
  dependencies: DevicePropertyToolDependencies<TContext, DevicePropertyAggregateResult>,
): CompiledClientTool<TContext> => defineClientTool<JsonRecord, TContext, DevicePropertyAggregateResult>({
  id: DEVICE_PROPERTY_ANALYSIS_TOOL_IDS.propertyAggregate,
  description: {
    text: dependencies.copy.description,
    help: dependencies.copy.help,
    capabilities: ['subject.property.aggregate'],
    intents: [
      '分析设备属性的历史趋势、分桶统计或地理位置轨迹',
      'analyze subject property history as bucketed statistics, trends, or geographic paths',
    ],
    notFor: [
      '读取未聚合的原始属性明细',
      'read unaggregated raw property records',
    ],
  },
  presentation: toolPresentation(dependencies.copy),
  inputs: dependencies.inputs,
  inputAlternatives: dependencies.inputAlternatives,
  consumes: [{ name: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.propertyId.name, source: 'EITHER' }],
  effect: { kind: 'READ' },
  output: clientToolOutput.aggregateSeries<DevicePropertyAggregateResult>({
    ...DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate,
    label: dependencies.copy.displayName,
    select: result => result.records,
    fields: [{ name: 'time', semanticRole: 'timestamp', format: 'datetime' }],
    resolveFields: result => result.fields,
  }),
  owner,
  execute: async (args, context, call) => toClientToolResult(
    await dependencies.execute(args, context, call),
  ),
})

export const createDevicePropertySelectorAlternatives = (): ClientToolInputAlternative[] => [
  {
    title: 'Single property selector',
    required: ['propertyId'],
    forbidden: ['propertyIds'],
  },
  {
    title: 'Multiple property selector',
    required: ['propertyIds'],
    forbidden: ['propertyId'],
  },
]
