import i18n from '@jetlinks-web-core/locales'
import {
  clientToolOutput,
  defineClientTool,
  defineClientTools,
  type CompiledClientTool,
  type ClientToolInput,
  type ClientToolConsumedResource,
  type ClientToolDescription,
  type ClientToolInputAlternative,
  type ClientToolOutput,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import type { GeneralAgentContext } from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'
import {
  adaptDomainAgentClientToolResult,
  createDomainAgentTimeScopeContract,
  domainAgentEnumValueType,
  domainAgentIntegerValueType,
  domainAgentStringArrayValueType,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { deviceAnalysisService } from './deviceAnalysis.service'
import { isDeviceDetailHandoffRequested } from './deviceAnalysis.shared'
import { deviceMetricsService } from './deviceMetrics.service'
import {
  createIotDevicePropertyAggregateInputAlternatives,
  IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS,
  IOT_DEVICE_PROPERTY_AGGREGATE_NOT_FOR,
  IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING,
  resolveIotDevicePropertyAggregateFields,
  resolveIotDevicePropertyAggregateOutputLabel,
} from './devicePropertyAggregate.support'
import {
  IOT_DEVICE_MODEL_SECTIONS,
  IOT_DEVICE_OPEN_DETAIL_TABS,
  IOT_DEVICE_PROPERTY_AGGREGATES,
  IOT_DEVICE_PROPERTY_ANALYSIS_MODES,
  IOT_DEVICE_STATES,
} from './constants'

const t = (key: string) => i18n.global.t(`IotGeneralAgent.${key}`)

const DEVICE_TOOL_USAGE: Record<string, Omit<ClientToolDescription, 'text'>> = {
  device_search: {
    capabilities: ['asset.device.search'],
    intents: ['查找符合条件的设备', 'find devices matching filters'],
    notFor: ['统计设备数量或趋势', 'aggregate device metrics'],
  },
  device_get_state_summary: {
    capabilities: ['asset.device.state.aggregate'],
    intents: ['统计设备在线离线状态', 'aggregate device state counts'],
    notFor: ['查询设备明细', 'read device records'],
  },
  device_query_online_rate_trend: {
    capabilities: ['asset.device.online-rate.aggregate'],
    intents: ['分析设备在线率趋势', 'analyze device online rate trend'],
    notFor: [
      '查询设备明细或历史在线离线设备数量',
      'read device records or historical online/offline device counts',
    ],
  },
  device_query_message_trend: {
    capabilities: ['asset.device.message.aggregate'],
    intents: ['分析设备消息量趋势', 'analyze device message trend'],
    notFor: ['查询设备消息明细', 'read raw device messages'],
  },
  device_model_get: {
    capabilities: ['subject.schema.read'],
    intents: ['读取设备物模型字段', 'read device schema fields'],
  },
  device_latest_properties: {
    capabilities: ['subject.property.latest'],
    intents: ['读取设备属性当前值', 'read latest device property values'],
  },
  device_property_raw_records: {
    capabilities: ['subject.property.history.read'],
    intents: ['读取设备属性完整历史明细', 'read complete device property history'],
    notFor: ['统计属性趋势', 'aggregate property trends'],
  },
  device_property_aggregate: {
    capabilities: ['subject.property.aggregate'],
    intents: [...IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS],
    notFor: [...IOT_DEVICE_PROPERTY_AGGREGATE_NOT_FOR],
  },
  device_health_summary: {
    capabilities: ['asset.device.health.aggregate'],
    intents: ['汇总设备健康和异常状态', 'summarize device health'],
    notFor: ['查询单台设备详情', 'read one device detail'],
  },
  device_open_detail: {
    capabilities: ['subject.navigation.open'],
    intents: ['打开已定位设备的详情', 'open a selected device detail'],
  },
}

const DEVICE_TOOL_CONSUMES: Record<string, ClientToolConsumedResource[]> = {
  device_model_get: [{ name: 'device-id', optional: true, source: 'EITHER' }],
  device_latest_properties: [{ name: 'device-id', optional: true, source: 'EITHER' }],
  device_property_raw_records: [
    { name: 'device-id', optional: true, source: 'EITHER' },
    { name: 'subject-property-id', optional: true, source: 'EITHER' },
  ],
  device_property_aggregate: [
    { name: 'device-id', optional: true, source: 'EITHER' },
    { name: 'subject-property-id', optional: true, source: 'EITHER' },
  ],
  device_open_detail: [{ name: 'device-id', optional: true, source: 'EITHER' }],
}

const input = (
  id: string,
  valueType: NonNullable<ClientToolInput['valueType']> = 'string',
  required = false,
): ClientToolInput => ({
  id,
  name: id,
  description: t(`inputs.${id}`),
  required,
  valueType,
})

const selectData = (result: any) => result.data
const selectMetricPoints = (result: any) => (
  Array.isArray(result?.data?.points) ? result.data.points : []
)
const selectListIds = (path: string) => (result: any) => {
  const values = result?.data?.[path]
  return Array.isArray(values) ? values.map((item: any) => item?.id).filter(Boolean) : []
}

const deviceOutputs = (id: string): ClientToolOutput<any> | ClientToolOutput<any>[] => {
  if (id === 'device_search') {
    return [
      clientToolOutput.lookup({
        name: 'device-id',
        shape: 'device.ids',
        select: (result: any) => Array.isArray(result.data)
          ? result.data.map((item: any) => item?.id).filter(Boolean)
          : [],
      }),
      clientToolOutput.recordSet({ name: 'device-records', shape: 'tabular.records', select: selectData }),
    ]
  }
  if (id === 'device_model_get') {
    return [
      clientToolOutput.lookup({ name: 'subject-property-id', shape: 'schema.property-ids', select: selectListIds('properties') }),
      clientToolOutput.lookup({ name: 'subject-event-id', shape: 'schema.event-ids', select: selectListIds('events') }),
      clientToolOutput.lookup({ name: 'subject-function-id', shape: 'schema.function-ids', select: selectListIds('functions') }),
      clientToolOutput.lookup({ name: 'subject-tag-id', shape: 'schema.tag-ids', select: selectListIds('tags') }),
    ]
  }
  if (id === 'device_latest_properties') {
    return clientToolOutput.detail({ name: 'property-snapshot', shape: 'property.snapshot', select: selectData })
  }
  if (id === 'device_property_raw_records') {
    return clientToolOutput.recordSet({ name: 'property-history-records', shape: 'time-series.records', select: selectData })
  }
  if (id === 'device_property_aggregate') {
    return clientToolOutput.aggregateSeries({
      name: 'property-aggregate',
      shape: 'time-series.aggregate',
      label: t('tools.device_property_aggregate.name'),
      select: selectData,
      fields: [
        { name: 'time', semanticRole: 'timestamp' },
      ],
      ordering: IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING,
      resolveFields: resolveIotDevicePropertyAggregateFields,
      resolveLabel: (_result, _value, fields) => resolveIotDevicePropertyAggregateOutputLabel(
        fields,
        IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING,
        (kind, labels) => t(`propertyAggregate.outputLabel.${kind}`, { property: labels.join(' / ') }),
      ),
    })
  }
  if (id === 'device_query_online_rate_trend') {
    return clientToolOutput.aggregateSeries({
      name: 'device-online-rate-series',
      shape: 'metric.time-series',
      label: t('tools.device_query_online_rate_trend.name'),
      select: selectMetricPoints,
      fields: [
        { name: 'label', semanticRole: 'category' },
        { name: 'value', semanticRole: 'number', format: 'percent' },
      ],
    })
  }
  if (id === 'device_query_message_trend') {
    return clientToolOutput.aggregateSeries({
      name: 'device-message-series',
      shape: 'metric.time-series',
      label: t('tools.device_query_message_trend.name'),
      select: selectMetricPoints,
      fields: [
        { name: 'label', semanticRole: 'category' },
        { name: 'value', semanticRole: 'number', format: 'integer' },
      ],
    })
  }
  if (id === 'device_health_summary') {
    return clientToolOutput.aggregateSeries({ name: 'device-health-summary', shape: 'tabular.summary', select: selectData })
  }
  return clientToolOutput.aggregateSeries({ name: 'device-state-summary', shape: 'tabular.summary', select: selectData })
}

const readonlyTool = (
  id: string,
  inputs: ClientToolInput[],
  execute: CompiledClientTool<GeneralAgentContext>['execute'],
  inputAlternatives?: ClientToolInputAlternative[],
): CompiledClientTool<GeneralAgentContext> => defineClientTool<Record<string, any>, GeneralAgentContext, any>({
  id,
  description: {
    text: t(`tools.${id}.description`),
    ...DEVICE_TOOL_USAGE[id],
  },
  presentation: {
    displayName: t(`tools.${id}.name`),
    progressText: t(`tools.${id}.progress`),
  },
  inputs,
  inputAlternatives,
  consumes: DEVICE_TOOL_CONSUMES[id],
  effect: { kind: 'READ' },
  output: deviceOutputs(id),
  owner: { module: 'iot-ui', group: 'device' },
  execute: async (args, context, call) => adaptDomainAgentClientToolResult(
    await execute(args, context, call) as any,
  ),
})

const timeScope = () => createDomainAgentTimeScopeContract({
  timeRange: t('inputs.timeRange'),
  startTime: t('inputs.startTime'),
  endTime: t('inputs.endTime'),
})

const timeScopedReadonlyTool = (
  id: string,
  inputs: ClientToolInput[],
  execute: CompiledClientTool<GeneralAgentContext>['execute'],
  transformAlternatives?: (
    alternatives: readonly ClientToolInputAlternative[],
  ) => ClientToolInputAlternative[],
) => {
  const contract = timeScope()
  return readonlyTool(
    id,
    [...inputs, ...contract.inputs],
    execute,
    transformAlternatives
      ? transformAlternatives(contract.inputAlternatives)
      : contract.inputAlternatives,
  )
}

export const createDeviceAnalysisTools = () => defineClientTools<GeneralAgentContext>([
  readonlyTool('device_search', [
    input('keyword'), input('state', domainAgentEnumValueType(IOT_DEVICE_STATES)), input('productId'), input('productName'), input('area'), input('group'),
    input('pageIndex', domainAgentIntegerValueType(0, 10000)), input('pageSize', domainAgentIntegerValueType(1, 50)),
  ], deviceAnalysisService.search),
  readonlyTool('device_get_state_summary', [
    input('productId'), input('productName'), input('area'), input('group'),
  ], deviceMetricsService.stateSummary),
  timeScopedReadonlyTool('device_query_online_rate_trend', [], deviceMetricsService.onlineRateTrend),
  timeScopedReadonlyTool('device_query_message_trend', [], deviceMetricsService.messageTrend),
  readonlyTool('device_model_get', [
    input('deviceId', 'string', true), input('section', domainAgentEnumValueType(IOT_DEVICE_MODEL_SECTIONS)), input('limit', domainAgentIntegerValueType(1, 50)),
  ], deviceAnalysisService.getModel),
  readonlyTool('device_latest_properties', [
    input('deviceIds', domainAgentStringArrayValueType(20), true),
    input('propertyIds', domainAgentStringArrayValueType(20), true),
  ], deviceAnalysisService.latestProperties),
  timeScopedReadonlyTool('device_property_raw_records', [
    input('deviceId', 'string', true), input('propertyId', 'string', true),
  ], deviceAnalysisService.propertyHistoryRecords),
  timeScopedReadonlyTool('device_property_aggregate', [
    input('deviceId', 'string', true),
    input('propertyId'),
    input('propertyIds', domainAgentStringArrayValueType(10)),
    input('analysisMode', domainAgentEnumValueType(IOT_DEVICE_PROPERTY_ANALYSIS_MODES), true),
    input('agg', domainAgentEnumValueType(IOT_DEVICE_PROPERTY_AGGREGATES)),
    input('interval'),
  ], deviceAnalysisService.propertyAggregate, createIotDevicePropertyAggregateInputAlternatives),
  readonlyTool('device_health_summary', [
    input('productId'), input('productName'), input('area'), input('group'), input('limit', domainAgentIntegerValueType(1, 20)),
  ], deviceAnalysisService.healthSummary),
  defineClientTool<Record<string, any>, GeneralAgentContext, any>({
    id: 'device_open_detail',
    description: {
      text: t('tools.device_open_detail.description'),
      ...DEVICE_TOOL_USAGE.device_open_detail,
    },
    presentation: {
      displayName: t('tools.device_open_detail.name'),
      progressText: t('tools.device_open_detail.progress'),
    },
    inputs: [
      input('deviceId', 'string', true),
      input('tab', domainAgentEnumValueType(IOT_DEVICE_OPEN_DETAIL_TABS)),
      input('handoff', 'boolean'),
    ],
    consumes: DEVICE_TOOL_CONSUMES.device_open_detail,
    effect: {
      kind: 'EXTERNAL_ACTION',
      idempotency: 'IDEMPOTENT',
      reversible: true,
      confirmation: {
        title: args => t(`tools.device_open_detail.${isDeviceDetailHandoffRequested(args.handoff) ? 'confirmHandoffTitle' : 'confirmTitle'}`),
        content: args => i18n.global.t(
          `IotGeneralAgent.tools.device_open_detail.${isDeviceDetailHandoffRequested(args.handoff) ? 'confirmHandoffContent' : 'confirmContent'}`,
          [String(args.deviceId || '')],
        ),
        okText: t('tools.device_open_detail.okText'),
        cancelText: i18n.global.t('verify.cancel'),
      },
    },
    output: clientToolOutput.stateChange({
      name: 'navigation-receipt',
      shape: 'navigation.receipt',
      transition: 'NAVIGATION',
      select: selectData,
    }),
    owner: { module: 'iot-ui', group: 'device' },
    execute: (args, context) => deviceAnalysisService.openDetail(args, context),
  }),
])
