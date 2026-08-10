import i18n from '@jetlinks-web-core/locales'
import {
  clientToolOutput,
  defineClientTool,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import {
  defineAiClientToolResultBindings,
  defineAiClientToolRouting,
  defineAiClientTools,
  type AiClientToolDataAccessMode,
  type AiClientToolDefinition,
  type AiClientToolInput,
  type AiClientToolParameterSchema,
  type AiClientToolResultDelivery,
  type AiClientToolRoutingMetadata,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import type { createDeviceDetailAgentService } from './deviceDetailAgent.service'
import {
  adaptDomainAgentClientToolResult,
  createDomainAgentTimeScopeContract,
  domainAgentEnumArrayValueType,
  domainAgentEnumValueType,
  domainAgentIntegerValueType,
  domainAgentResultValueType,
  domainAgentStringArrayValueType,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import {
  IOT_DEVICE_MODEL_SECTIONS,
  IOT_DEVICE_PROPERTY_AGGREGATES,
  IOT_DEVICE_PROPERTY_ANALYSIS_MODES,
} from '../../../../agentCapabilities/deviceAnalysis/constants'
import {
  createIotDevicePropertyAggregateInputAlternatives,
  IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS,
  IOT_DEVICE_PROPERTY_AGGREGATE_NOT_FOR,
  IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING,
  resolveIotDevicePropertyAggregateFields,
  resolveIotDevicePropertyAggregateOutputLabel,
} from '../../../../agentCapabilities/deviceAnalysis/devicePropertyAggregate.support'
import { IOT_DEVICE_DETAIL_AGENT_TABS } from './deviceDetailAgent.constants'

type DeviceDetailAgentService = ReturnType<typeof createDeviceDetailAgentService>
type DeviceDetailToolContext = Record<string, unknown>

const t = (key: string) => i18n.global.t(`IotDeviceDetailAgent.${key}`)

const MODEL_FIELD_BINDINGS = [
  'subject-property-id',
  'subject-event-id',
  'subject-function-id',
  'subject-tag-id',
]

/** Declarative data-flow metadata; the shared router never branches on these tool ids. */
const TOOL_ROUTING: Record<string, AiClientToolRoutingMetadata> = {
  device_context_get: {
    capabilities: ['subject.context.read'],
    produces: ['subject-context'],
    intents: ['读取当前对象上下文', 'read current subject context'],
    outputShapes: ['subject.detail'],
    cost: 'low',
  },
  device_model_get: {
    capabilities: ['subject.schema.read'],
    produces: MODEL_FIELD_BINDINGS,
    intents: ['读取物模型定义', 'read subject schema definitions'],
    outputShapes: ['schema.fields'],
    cost: 'low',
  },
  device_model_search: {
    capabilities: ['subject.schema.search'],
    produces: MODEL_FIELD_BINDINGS,
    intents: ['定位物模型字段', 'resolve a schema field identifier'],
    outputShapes: ['schema.field-candidates'],
    cost: 'low',
  },
  device_latest_properties: {
    capabilities: ['subject.property.latest'],
    accepts: ['subject-property-id'],
    produces: ['property-snapshot'],
    intents: ['读取属性当前值', 'read current property values'],
    outputShapes: ['property.snapshot'],
    cost: 'low',
  },
  device_property_history_summary: {
    capabilities: ['subject.property.history.summary'],
    accepts: ['subject-property-id'],
    prerequisites: ['subject-property-id'],
    produces: ['property-history-summary'],
    intents: ['统计属性历史', 'summarize historical property values'],
    notFor: [...IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS],
    outputShapes: ['time-series.summary'],
  },
  device_property_raw_records: {
    capabilities: ['subject.property.history.read'],
    accepts: ['subject-property-id'],
    prerequisites: ['subject-property-id'],
    produces: ['property-history-records'],
    intents: ['逐条读取未经聚合的原始属性明细', 'inspect unaggregated property records row by row'],
    notFor: [...IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS],
    outputShapes: ['time-series.records'],
    cost: 'high',
  },
  device_property_aggregate: {
    capabilities: ['subject.property.aggregate'],
    accepts: ['subject-property-id'],
    prerequisites: ['subject-property-id'],
    produces: ['property-aggregate'],
    intents: [...IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS],
    outputShapes: ['time-series.aggregate'],
  },
  device_activity_aggregate: {
    capabilities: ['subject.activity.aggregate'],
    produces: ['activity-aggregate'],
    intents: ['统计活跃时长', 'aggregate subject activity duration'],
    outputShapes: ['metric.time-series'],
  },
  device_message_aggregate: {
    capabilities: ['subject.message.aggregate'],
    produces: ['message-aggregate'],
    intents: ['统计消息量', 'aggregate message volume'],
    outputShapes: ['metric.time-series'],
  },
  device_traffic_aggregate: {
    capabilities: ['subject.traffic.aggregate'],
    produces: ['traffic-aggregate'],
    intents: ['统计上下行流量', 'aggregate uplink and downlink traffic'],
    outputShapes: ['metric.time-series'],
  },
  device_event_query: {
    capabilities: ['subject.event.read'],
    accepts: ['subject-event-id'],
    prerequisites: ['subject-event-id'],
    produces: ['event-records'],
    intents: ['查询事件历史', 'read historical subject events'],
    notFor: [
      '查询属性历史、属性统计或属性位置轨迹',
      'read property history, property statistics, or property location paths',
    ],
    outputShapes: ['event.records'],
  },
  device_alarm_records_query: {
    capabilities: ['subject.alarm.records.read'],
    produces: ['alarm-record-id', 'alarm-records'],
    intents: ['查询告警记录', 'read subject alarm records'],
    outputShapes: ['alarm.records'],
  },
  device_alarm_history_summary: {
    capabilities: ['subject.alarm.history.summary'],
    accepts: ['alarm-record-id'],
    produces: ['alarm-history-summary'],
    intents: ['统计告警触发历史', 'summarize alarm trigger history'],
    outputShapes: ['alarm.summary'],
  },
  device_alarm_history_query: {
    capabilities: ['subject.alarm.history.read'],
    accepts: ['alarm-record-id'],
    prerequisites: ['alarm-record-id'],
    produces: ['alarm-history-records'],
    intents: ['查询告警触发明细', 'read alarm trigger records'],
    outputShapes: ['alarm.history.records'],
  },
  device_online_offline_summary: {
    capabilities: ['subject.connection.summary'],
    produces: ['connection-summary'],
    intents: ['分析上下线', 'summarize online and offline sessions'],
    outputShapes: ['connection.summary'],
  },
  device_logs_summary: {
    capabilities: ['subject.log.summary'],
    produces: ['log-summary'],
    intents: ['统计设备日志', 'summarize subject logs'],
    outputShapes: ['log.summary'],
  },
  device_logs_query: {
    capabilities: ['subject.log.read'],
    produces: ['log-records'],
    intents: ['查询设备日志明细', 'read subject log records'],
    outputShapes: ['log.records'],
  },
  device_access_summary: {
    capabilities: ['subject.access.read'],
    produces: ['access-configuration'],
    intents: ['读取接入配置', 'read subject access configuration'],
    outputShapes: ['access.detail'],
    cost: 'low',
  },
  device_documents_query: {
    capabilities: ['subject.document.search'],
    produces: ['document-file-id', 'document-candidates'],
    intents: ['查找接入指南和协议说明', 'find subject documentation'],
    outputShapes: ['document.candidates'],
    cost: 'low',
  },
  device_document_reference: {
    capabilities: ['subject.document.read'],
    accepts: ['document-file-id'],
    prerequisites: ['document-file-id'],
    produces: ['document-content'],
    intents: ['读取设备文档', 'read selected subject documentation'],
    outputShapes: ['document.content'],
  },
  device_trace_capture: {
    capabilities: ['subject.trace.capture'],
    produces: ['trace-records'],
    intents: ['抓取短时链路证据', 'capture bounded live trace evidence'],
    outputShapes: ['trace.records'],
    cost: 'high',
  },
  device_open_tab: {
    capabilities: ['subject.navigation.open'],
    produces: ['navigation-receipt'],
    intents: ['打开当前对象页签', 'open current subject tab'],
    outputShapes: ['navigation.receipt'],
  },
}

const TOOL_RESULT_PATHS: Record<string, Record<string, string>> = {
  device_model_get: {
    'subject-property-id': '$.data.properties[*].id',
    'subject-event-id': '$.data.events[*].id',
    'subject-function-id': '$.data.functions[*].id',
    'subject-tag-id': '$.data.tags[*].id',
  },
  device_model_search: {
    'subject-property-id': "$.data[?(@.type=='properties')].id",
    'subject-event-id': "$.data[?(@.type=='events')].id",
    'subject-function-id': "$.data[?(@.type=='functions')].id",
    'subject-tag-id': "$.data[?(@.type=='tags')].id",
  },
  device_alarm_records_query: {
    'alarm-record-id': '$.data[*].id',
    'alarm-records': '$.data',
  },
  device_documents_query: {
    'document-file-id': '$.data[*].fileId',
    'document-candidates': '$.data',
  },
}

const domainResultBindings = (id: string) => {
  const routing = TOOL_ROUTING[id]
  const paths = TOOL_RESULT_PATHS[id] || Object.fromEntries(
    (routing.produces || []).map(name => [name, '$.data']),
  )
  return defineAiClientToolResultBindings(routing, paths)
}

const input = (
  id: string,
  valueType: NonNullable<AiClientToolInput['valueType']> = 'string',
  required = false,
): AiClientToolInput => ({
  id,
  name: id,
  description: t(`inputs.${id}`),
  valueType,
  required,
})

const readTool = (
  id: string,
  inputs: AiClientToolInput[],
  execute: AiClientToolDefinition<DeviceDetailToolContext>['execute'],
  dataAccessMode: AiClientToolDataAccessMode,
  resultDelivery: AiClientToolResultDelivery = 'inline',
  risk?: AiClientToolDefinition<DeviceDetailToolContext>['risk'],
  parameterSchema?: AiClientToolParameterSchema,
): AiClientToolDefinition<DeviceDetailToolContext> => ({
  id,
  name: id,
  displayName: t(`tools.${id}.name`),
  progressText: t(`tools.${id}.progress`),
  description: t(`tools.${id}.description`),
  routing: defineAiClientToolRouting(dataAccessMode, {
    ...TOOL_ROUTING[id],
    ...(resultDelivery === 'file'
      ? { resultDeliveries: ['file'] }
      : {}),
  }),
  inputs,
  parameterSchema,
  output: domainAgentResultValueType(),
  annotations: { readOnlyHint: true },
  risk,
  _meta: {
    ownerModule: 'iot-ui',
    capabilityGroup: 'device-detail',
    dataAccessMode,
    resultDelivery,
    ...(resultDelivery === 'file' ? {} : { resultBindings: domainResultBindings(id) }),
  },
  execute,
})

const timeScope = () => createDomainAgentTimeScopeContract({
  timeRange: t('inputs.timeRange'),
  startTime: t('inputs.startTime'),
  endTime: t('inputs.endTime'),
})

const timeScopedReadTool = (
  id: string,
  inputs: AiClientToolInput[],
  execute: AiClientToolDefinition<DeviceDetailToolContext>['execute'],
  dataAccessMode: AiClientToolDataAccessMode,
  resultDelivery: AiClientToolResultDelivery = 'inline',
  risk?: AiClientToolDefinition<DeviceDetailToolContext>['risk'],
) => {
  const contract = timeScope()
  return readTool(
    id,
    [...inputs, ...contract.inputs],
    execute,
    dataAccessMode,
    resultDelivery,
    risk,
    contract.parameterSchema,
  )
}

const propertyAggregateTool = (
  service: DeviceDetailAgentService,
): AiClientToolDefinition<DeviceDetailToolContext> => {
  const contract = timeScope()
  return defineClientTool<Record<string, any>, DeviceDetailToolContext, any>({
    id: 'device_property_aggregate',
    description: {
      text: t('tools.device_property_aggregate.description'),
      capabilities: ['subject.property.aggregate'],
      intents: TOOL_ROUTING.device_property_aggregate.intents,
      notFor: [...IOT_DEVICE_PROPERTY_AGGREGATE_NOT_FOR],
    },
    presentation: {
      displayName: t('tools.device_property_aggregate.name'),
      progressText: t('tools.device_property_aggregate.progress'),
    },
    inputs: [
      input('propertyId'),
      input('propertyIds', domainAgentStringArrayValueType(10)),
      input('analysisMode', domainAgentEnumValueType(IOT_DEVICE_PROPERTY_ANALYSIS_MODES), true),
      input('agg', domainAgentEnumValueType(IOT_DEVICE_PROPERTY_AGGREGATES)),
      input('interval'),
      ...contract.inputs,
    ],
    inputAlternatives: createIotDevicePropertyAggregateInputAlternatives(contract.inputAlternatives),
    consumes: [{
      name: 'subject-property-id',
      type: 'structured-data',
      mediaType: 'application/json',
      shape: 'schema.property-ids',
      required: false,
      sourcePolicy: 'EITHER',
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'property-aggregate',
      shape: 'time-series.aggregate',
      label: t('tools.device_property_aggregate.name'),
      select: (result: any) => result.data,
      fields: [{ name: 'time', semanticRole: 'timestamp' }],
      ordering: IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING,
      resolveFields: resolveIotDevicePropertyAggregateFields,
      resolveLabel: (_result, _value, fields) => resolveIotDevicePropertyAggregateOutputLabel(
        fields,
        IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING,
        (kind, labels) => i18n.global.t(
          `IotGeneralAgent.propertyAggregate.outputLabel.${kind}`,
          { property: labels.join(' / ') },
        ),
      ),
    }),
    owner: { module: 'iot-ui', group: 'device-detail' },
    execute: async args => adaptDomainAgentClientToolResult(
      await service.propertyAggregate(args) as any,
    ),
  })
}

const pageInputs = () => [
  input('pageIndex', domainAgentIntegerValueType(0, 10000)),
  input('pageSize', domainAgentIntegerValueType(1, 50)),
]

const metricInputs = () => [
  input('interval', domainAgentEnumValueType(['1h', '1d', '1w'])),
]

const alarmFilterInputs = () => [
  input('state'),
  input('level'),
  input('keyword'),
]

const logFilterInputs = () => [
  input('type'),
  input('keyword'),
]

/** Tool schemas intentionally omit deviceId; every execution is closed over the verified page subject. */
export const createDeviceDetailAgentTools = (service: DeviceDetailAgentService) => (
  defineAiClientTools<DeviceDetailToolContext>([
    readTool('device_context_get', [], service.contextGet, 'detail'),
    readTool('device_model_get', [
      input('section', domainAgentEnumValueType(IOT_DEVICE_MODEL_SECTIONS)),
      input('limit', domainAgentIntegerValueType(1, 50)),
    ], service.modelGet, 'discovery'),
    readTool('device_model_search', [
      input('keyword'),
      input('types', domainAgentEnumArrayValueType(IOT_DEVICE_MODEL_SECTIONS.filter(item => item !== 'all'))),
      input('limit', domainAgentIntegerValueType(1, 100)),
    ], service.modelSearch, 'discovery'),
    readTool('device_latest_properties', [
      input('propertyIds', domainAgentStringArrayValueType(20)),
      input('limit', domainAgentIntegerValueType(1, 20)),
    ], service.latestProperties, 'detail'),
    timeScopedReadTool('device_property_history_summary', [
      input('propertyId', 'string', true),
      input('sampleLimit', domainAgentIntegerValueType(1, 10)),
    ], service.propertyHistorySummary, 'aggregate'),
    timeScopedReadTool('device_property_raw_records', [
      input('propertyId', 'string', true),
    ], service.propertyHistory, 'records', 'file'),
    propertyAggregateTool(service),
    timeScopedReadTool('device_activity_aggregate', metricInputs(), service.activityAggregate, 'aggregate'),
    timeScopedReadTool('device_message_aggregate', metricInputs(), service.messageAggregate, 'aggregate'),
    timeScopedReadTool('device_traffic_aggregate', metricInputs(), service.trafficAggregate, 'aggregate'),
    timeScopedReadTool('device_event_query', [
      input('eventId', 'string', true),
      ...pageInputs(),
    ], service.eventQuery, 'records'),
    timeScopedReadTool('device_alarm_records_query', [
      ...alarmFilterInputs(), ...pageInputs(),
    ], service.alarmRecords, 'records'),
    timeScopedReadTool('device_alarm_history_summary', [
      input('alarmRecordId'), ...alarmFilterInputs(),
      input('sampleLimit', domainAgentIntegerValueType(1, 20)),
      input('recordLimit', domainAgentIntegerValueType(1, 20)),
    ], service.alarmHistorySummary, 'aggregate'),
    timeScopedReadTool('device_alarm_history_query', [
      input('alarmRecordId', 'string', true), ...pageInputs(),
    ], service.alarmHistoryQuery, 'records'),
    timeScopedReadTool('device_online_offline_summary', [
      input('type'), input('sampleLimit', domainAgentIntegerValueType(1, 20)),
    ], service.onlineOfflineSummary, 'aggregate'),
    timeScopedReadTool('device_logs_summary', [
      ...logFilterInputs(), input('sampleLimit', domainAgentIntegerValueType(1, 20)),
    ], service.logsSummary, 'aggregate'),
    timeScopedReadTool('device_logs_query', [
      ...logFilterInputs(), ...pageInputs(),
    ], service.logsQuery, 'records'),
    readTool('device_access_summary', [], service.accessSummary, 'detail'),
    readTool('device_documents_query', [
      input('documentTypes', domainAgentStringArrayValueType(5)),
      input('keyword'),
      input('limit', domainAgentIntegerValueType(1, 50)),
    ], service.documentsQuery, 'discovery'),
    readTool('device_document_reference', [
      input('fileId', 'string', true),
    ], service.documentReference, 'detail'),
    readTool('device_trace_capture', [
      input('seconds', domainAgentIntegerValueType(1, 60)),
      input('maxEvents', domainAgentIntegerValueType(1, 100)),
    ], service.traceCapture, 'records', 'inline', {
      readOnly: true,
      parallelSafe: false,
      needsApproval: false,
    }),
    {
      id: 'device_open_tab',
      name: 'device_open_tab',
      displayName: t('tools.device_open_tab.name'),
      progressText: t('tools.device_open_tab.progress'),
      description: t('tools.device_open_tab.description'),
      routing: defineAiClientToolRouting('action', TOOL_ROUTING.device_open_tab),
      confirm: {
        title: t('tools.device_open_tab.confirmTitle'),
        content: args => i18n.global.t('IotDeviceDetailAgent.tools.device_open_tab.confirmContent', [String(args.tab || '')]),
        okText: t('tools.device_open_tab.okText'),
        cancelText: i18n.global.t('verify.cancel'),
      },
      inputs: [input('tab', domainAgentEnumValueType(IOT_DEVICE_DETAIL_AGENT_TABS), true)],
      output: domainAgentResultValueType(),
      annotations: { readOnlyHint: false, idempotentHint: true },
      _meta: {
        ownerModule: 'iot-ui',
        capabilityGroup: 'device-detail',
        dataAccessMode: 'detail',
        resultDelivery: 'inline',
        resultBindings: domainResultBindings('device_open_tab'),
      },
      execute: service.openTab,
    },
  ])
)
