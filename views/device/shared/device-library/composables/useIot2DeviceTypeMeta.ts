import type {
  Iot2DeviceTypeBatchAction,
  Iot2DeviceTypeCategory,
  Iot2DeviceTypeDetailTab,
  Iot2DeviceTypeFlowStatus,
  Iot2DeviceTypeFlowTarget,
  Iot2DeviceTypeIndustry,
  Iot2DeviceTypeProtocol,
  Iot2DeviceTypeRuleStatus,
  Iot2DeviceTypeSortBy,
  Iot2DeviceTypeSortOrder,
  Iot2DeviceTypeStatus,
  Iot2DeviceTypeVersionChangeType,
  Iot2DeviceTypeViewMode,
  Iot2KpiTone,
  Iot2ThingModelAccessMode,
  Iot2ThingModelDataType,
  Iot2ThingModelEventLevel,
  Iot2ThingModelKind,
  Iot2ThingModelServiceCallMode,
} from '@device-manager-ui/views/device/shared/device-library/services/iot2.types'
import i18n from '@jetlinks-web-core/locales'

const t = (key: string) => i18n.global.t(key)

export interface Iot2DeviceTypeMetaItem<T extends string> {
  key: T
  label: string
  icon?: string
  tone?: Iot2KpiTone
}

export const IOT2_DEVICE_TYPE_PROTOCOL_META: Record<Iot2DeviceTypeProtocol, Iot2DeviceTypeMetaItem<Iot2DeviceTypeProtocol>> = {
  MQTT: { key: 'MQTT', label: 'MQTT', icon: 'RadarChartOutlined' },
  CoAP: { key: 'CoAP', label: 'CoAP', icon: 'BranchesOutlined' },
  HTTP: { key: 'HTTP', label: 'HTTP', icon: 'GlobalOutlined' },
  Modbus: { key: 'Modbus', label: 'Modbus', icon: 'HddOutlined' },
  'OPC UA': { key: 'OPC UA', label: 'OPC UA', icon: 'ToolOutlined' },
  GB28181: { key: 'GB28181', label: 'GB28181', icon: 'VideoCameraOutlined' },
  Custom: { key: 'Custom', get label() { return t('Iot2DeviceType.protocol.custom') }, icon: 'CodeOutlined' },
}

export const IOT2_DEVICE_TYPE_CATEGORY_META: Record<Iot2DeviceTypeCategory, Iot2DeviceTypeMetaItem<Iot2DeviceTypeCategory>> = {
  direct: { key: 'direct', get label() { return t('Iot2DeviceType.category.direct') }, icon: 'DisconnectOutlined' },
  gateway: { key: 'gateway', get label() { return t('Iot2DeviceType.category.gateway') }, icon: 'ApartmentOutlined' },
  'sub-device': { key: 'sub-device', get label() { return t('Iot2DeviceType.category.subDevice') }, icon: 'ForkOutlined' },
  network: { key: 'network', get label() { return t('Iot2DeviceType.category.network') }, icon: 'GatewayOutlined' },
}

export const IOT2_DEVICE_TYPE_STATUS_META: Record<Iot2DeviceTypeStatus, Iot2DeviceTypeMetaItem<Iot2DeviceTypeStatus>> = {
  published: { key: 'published', get label() { return t('Iot2DeviceType.status.published') }, tone: 'ok', icon: 'CheckCircleOutlined' },
  draft: { key: 'draft', get label() { return t('Iot2DeviceType.status.draft') }, tone: 'info', icon: 'EditOutlined' },
  disabled: { key: 'disabled', get label() { return t('Iot2DeviceType.status.disabled') }, tone: 'muted', icon: 'PauseCircleOutlined' },
}

export const IOT2_DEVICE_TYPE_INDUSTRY_META: Record<Iot2DeviceTypeIndustry, Iot2DeviceTypeMetaItem<Iot2DeviceTypeIndustry>> = {
  fire: { key: 'fire', get label() { return t('Iot2DeviceType.industry.fire') }, icon: 'FireOutlined' },
  'commercial-space': { key: 'commercial-space', get label() { return t('Iot2DeviceType.industry.commercialSpace') }, icon: 'ShopOutlined' },
  'smart-park': { key: 'smart-park', get label() { return t('Iot2DeviceType.industry.smartPark') }, icon: 'BankOutlined' },
  energy: { key: 'energy', get label() { return t('Iot2DeviceType.industry.energy') }, icon: 'ThunderboltOutlined' },
  logistics: { key: 'logistics', get label() { return t('Iot2DeviceType.industry.logistics') }, icon: 'BankOutlined' },
  general: { key: 'general', get label() { return t('Iot2DeviceType.industry.general') }, icon: 'AppstoreOutlined' },
}

export const IOT2_DEVICE_TYPE_VIEW_MODE_META: Record<Iot2DeviceTypeViewMode, Iot2DeviceTypeMetaItem<Iot2DeviceTypeViewMode>> = {
  card: { key: 'card', get label() { return t('Iot2DeviceType.view.card') }, icon: 'AppstoreOutlined' },
  table: { key: 'table', get label() { return t('Iot2DeviceType.view.table') }, icon: 'TableOutlined' },
}

export const IOT2_DEVICE_TYPE_SORT_META: Record<Iot2DeviceTypeSortBy, Iot2DeviceTypeMetaItem<Iot2DeviceTypeSortBy>> = {
  updatedAt: { key: 'updatedAt', get label() { return t('Iot2DeviceType.sort.updatedAt') } },
  deviceCount: { key: 'deviceCount', get label() { return t('Iot2DeviceType.sort.deviceCount') } },
  onlineRate: { key: 'onlineRate', get label() { return t('Iot2DeviceType.sort.onlineRate') } },
  unhandledAlarms: { key: 'unhandledAlarms', get label() { return t('Iot2DeviceType.sort.unhandledAlarms') } },
  name: { key: 'name', get label() { return t('Iot2DeviceType.sort.name') } },
  createdAt: { key: 'createdAt', get label() { return t('Iot2DeviceType.sort.createdAt') } },
}

export const IOT2_DEVICE_TYPE_SORT_ORDER_META: Record<Iot2DeviceTypeSortOrder, Iot2DeviceTypeMetaItem<Iot2DeviceTypeSortOrder>> = {
  desc: { key: 'desc', get label() { return t('Iot2DeviceType.sortOrder.desc') } },
  asc: { key: 'asc', get label() { return t('Iot2DeviceType.sortOrder.asc') } },
}

export const IOT2_DEVICE_TYPE_BATCH_ACTION_META: Record<Iot2DeviceTypeBatchAction, Iot2DeviceTypeMetaItem<Iot2DeviceTypeBatchAction> & { danger?: boolean }> = {
  publish: { key: 'publish', get label() { return t('Iot2DeviceType.batch.publish') }, icon: 'CheckCircleOutlined' },
  disable: { key: 'disable', get label() { return t('Iot2DeviceType.batch.disable') }, icon: 'PauseOutlined', danger: true },
  delete: { key: 'delete', get label() { return t('Iot2DeviceType.batch.delete') }, icon: 'DeleteOutlined', danger: true },
  exportThingModel: { key: 'exportThingModel', get label() { return t('Iot2DeviceType.batch.exportThingModel') }, icon: 'DownloadOutlined' },
  changeIndustry: { key: 'changeIndustry', get label() { return t('Iot2DeviceType.batch.changeIndustry') }, icon: 'TagsOutlined' },
}

export const IOT2_DEVICE_TYPE_DETAIL_TAB_META: Record<Iot2DeviceTypeDetailTab, Iot2DeviceTypeMetaItem<Iot2DeviceTypeDetailTab>> = {
  overview: { key: 'overview', get label() { return t('Iot2DeviceType.tab.overview') }, icon: 'DashboardOutlined' },
  'thing-model': { key: 'thing-model', get label() { return t('Iot2DeviceType.tab.thingModel') }, icon: 'AppstoreOutlined' },
  access: { key: 'access', get label() { return t('Iot2DeviceType.tab.access') }, icon: 'ApiOutlined' },
  devices: { key: 'devices', get label() { return t('Iot2DeviceType.tab.devices') }, icon: 'CloudServerOutlined' },
  'alarm-rules': { key: 'alarm-rules', get label() { return t('Iot2DeviceType.tab.alarmRules') }, icon: 'BellOutlined' },
  'data-flow': { key: 'data-flow', get label() { return t('Iot2DeviceType.tab.dataFlow') }, icon: 'PartitionOutlined' },
  simulator: { key: 'simulator', get label() { return t('Iot2DeviceType.tab.simulator') }, icon: 'CodeOutlined' },
  versions: { key: 'versions', get label() { return t('Iot2DeviceType.tab.versions') }, icon: 'HistoryOutlined' },
}

export const IOT2_THING_MODEL_KIND_META: Record<Iot2ThingModelKind, Iot2DeviceTypeMetaItem<Iot2ThingModelKind>> = {
  properties: { key: 'properties', get label() { return t('Iot2DeviceType.thingModel.properties') }, icon: 'ControlOutlined' },
  events: { key: 'events', get label() { return t('Iot2DeviceType.thingModel.events') }, icon: 'RadarChartOutlined' },
  services: { key: 'services', get label() { return t('Iot2DeviceType.thingModel.services') }, icon: 'SendOutlined' },
}

export const IOT2_THING_MODEL_DATA_TYPE_META: Record<Iot2ThingModelDataType, Iot2DeviceTypeMetaItem<Iot2ThingModelDataType>> = {
  number: { key: 'number', get label() { return t('Iot2DeviceType.dataType.number') } },
  string: { key: 'string', get label() { return t('Iot2DeviceType.dataType.string') } },
  bool: { key: 'bool', get label() { return t('Iot2DeviceType.dataType.bool') } },
  enum: { key: 'enum', get label() { return t('Iot2DeviceType.dataType.enum') } },
  date: { key: 'date', get label() { return t('Iot2DeviceType.dataType.date') } },
  struct: { key: 'struct', get label() { return t('Iot2DeviceType.dataType.struct') } },
  array: { key: 'array', get label() { return t('Iot2DeviceType.dataType.array') } },
}

export const IOT2_THING_MODEL_ACCESS_META: Record<Iot2ThingModelAccessMode, Iot2DeviceTypeMetaItem<Iot2ThingModelAccessMode>> = {
  read: { key: 'read', get label() { return t('Iot2DeviceType.access.read') } },
  write: { key: 'write', get label() { return t('Iot2DeviceType.access.write') } },
  readwrite: { key: 'readwrite', get label() { return t('Iot2DeviceType.access.readwrite') } },
}

export const IOT2_THING_MODEL_EVENT_LEVEL_META: Record<Iot2ThingModelEventLevel, Iot2DeviceTypeMetaItem<Iot2ThingModelEventLevel>> = {
  info: { key: 'info', get label() { return t('Iot2DeviceType.eventLevel.info') }, tone: 'info' },
  alarm: { key: 'alarm', get label() { return t('Iot2DeviceType.eventLevel.alarm') }, tone: 'warn' },
  fault: { key: 'fault', get label() { return t('Iot2DeviceType.eventLevel.fault') }, tone: 'danger' },
}

export const IOT2_THING_MODEL_CALL_MODE_META: Record<Iot2ThingModelServiceCallMode, Iot2DeviceTypeMetaItem<Iot2ThingModelServiceCallMode>> = {
  sync: { key: 'sync', get label() { return t('Iot2DeviceType.callMode.sync') } },
  async: { key: 'async', get label() { return t('Iot2DeviceType.callMode.async') } },
}

export const IOT2_DEVICE_TYPE_AUTH_MODE_OPTIONS = [
  { key: '一机一密', get label() { return t('Iot2DeviceType.auth.uniqueDevice') } },
  { key: '一型一密', get label() { return t('Iot2DeviceType.auth.uniqueType') } },
  { key: '动态注册', get label() { return t('Iot2DeviceType.auth.dynamic') } },
  { key: 'X.509 证书', get label() { return t('Iot2DeviceType.auth.x509') } },
] as const

export const IOT2_DEVICE_TYPE_DATA_FORMAT_OPTIONS = [
  { key: 'JSON', label: 'JSON' },
  { key: '二进制', get label() { return t('Iot2DeviceType.format.binary') } },
  { key: '自定义编解码', get label() { return t('Iot2DeviceType.format.customCodec') } },
  { key: 'GB28181', label: 'GB28181' },
] as const

export const IOT2_DEVICE_TYPE_CODEC_MODE_OPTIONS = [
  { key: '内置解析', get label() { return t('Iot2DeviceType.codec.builtin') } },
  { key: '脚本解析', get label() { return t('Iot2DeviceType.codec.script') } },
  { key: 'Modbus 寄存器映射', get label() { return t('Iot2DeviceType.codec.modbus') } },
  { key: '标准通道解析', get label() { return t('Iot2DeviceType.codec.standard') } },
] as const

export const IOT2_DEVICE_TYPE_RULE_STATUS_META: Record<Iot2DeviceTypeRuleStatus, Iot2DeviceTypeMetaItem<Iot2DeviceTypeRuleStatus>> = {
  enabled: { key: 'enabled', get label() { return t('Iot2DeviceType.rule.enabled') }, tone: 'ok' },
  disabled: { key: 'disabled', get label() { return t('Iot2DeviceType.rule.disabled') }, tone: 'muted' },
}

export const IOT2_DEVICE_TYPE_FLOW_STATUS_META: Record<Iot2DeviceTypeFlowStatus, Iot2DeviceTypeMetaItem<Iot2DeviceTypeFlowStatus>> = {
  enabled: { key: 'enabled', get label() { return t('Iot2DeviceType.flow.enabled') }, tone: 'ok' },
  disabled: { key: 'disabled', get label() { return t('Iot2DeviceType.flow.disabled') }, tone: 'muted' },
  failed: { key: 'failed', get label() { return t('Iot2DeviceType.flow.failed') }, tone: 'danger' },
}

export const IOT2_DEVICE_TYPE_FLOW_TARGET_META: Record<Iot2DeviceTypeFlowTarget, Iot2DeviceTypeMetaItem<Iot2DeviceTypeFlowTarget>> = {
  Kafka: { key: 'Kafka', label: 'Kafka', icon: 'SendOutlined' },
  HTTP: { key: 'HTTP', get label() { return t('Iot2DeviceType.flowTarget.http') }, icon: 'ApiOutlined' },
  Database: { key: 'Database', get label() { return t('Iot2DeviceType.flowTarget.database') }, icon: 'DatabaseOutlined' },
  Webhook: { key: 'Webhook', label: 'Webhook', icon: 'LinkOutlined' },
}

export const IOT2_DEVICE_TYPE_VERSION_CHANGE_META: Record<Iot2DeviceTypeVersionChangeType, Iot2DeviceTypeMetaItem<Iot2DeviceTypeVersionChangeType>> = {
  compatible: { key: 'compatible', get label() { return t('Iot2DeviceType.version.compatible') }, tone: 'ok' },
  breaking: { key: 'breaking', get label() { return t('Iot2DeviceType.version.breaking') }, tone: 'danger' },
  config: { key: 'config', get label() { return t('Iot2DeviceType.version.config') }, tone: 'info' },
  release: { key: 'release', get label() { return t('Iot2DeviceType.version.release') }, tone: 'default' },
}

function fallback<T extends string>(key: T, label = t('Iot2DeviceType.common.unknown')): Iot2DeviceTypeMetaItem<T> {
  return { key, label, tone: 'muted' }
}

export function useIot2DeviceTypeMeta() {
  function protocolMeta(value: Iot2DeviceTypeProtocol | string | undefined) {
    return IOT2_DEVICE_TYPE_PROTOCOL_META[value as Iot2DeviceTypeProtocol]
      ?? fallback((value || 'Custom') as Iot2DeviceTypeProtocol, value || t('Iot2DeviceType.common.unknownProtocol'))
  }

  function categoryMeta(value: Iot2DeviceTypeCategory | string | undefined) {
    return IOT2_DEVICE_TYPE_CATEGORY_META[value as Iot2DeviceTypeCategory]
      ?? fallback((value || 'direct') as Iot2DeviceTypeCategory)
  }

  function statusMeta(value: Iot2DeviceTypeStatus | string | undefined) {
    return IOT2_DEVICE_TYPE_STATUS_META[value as Iot2DeviceTypeStatus]
      ?? fallback((value || 'draft') as Iot2DeviceTypeStatus)
  }

  function industryMeta(value: Iot2DeviceTypeIndustry | string | undefined) {
    return IOT2_DEVICE_TYPE_INDUSTRY_META[value as Iot2DeviceTypeIndustry]
      ?? fallback((value || 'general') as Iot2DeviceTypeIndustry)
  }

  function viewModeMeta(value: Iot2DeviceTypeViewMode | string | undefined) {
    return IOT2_DEVICE_TYPE_VIEW_MODE_META[value as Iot2DeviceTypeViewMode]
      ?? IOT2_DEVICE_TYPE_VIEW_MODE_META.card
  }

  function sortMeta(value: Iot2DeviceTypeSortBy | string | undefined) {
    return IOT2_DEVICE_TYPE_SORT_META[value as Iot2DeviceTypeSortBy]
      ?? IOT2_DEVICE_TYPE_SORT_META.updatedAt
  }

  function sortOrderMeta(value: Iot2DeviceTypeSortOrder | string | undefined) {
    return IOT2_DEVICE_TYPE_SORT_ORDER_META[value as Iot2DeviceTypeSortOrder]
      ?? IOT2_DEVICE_TYPE_SORT_ORDER_META.desc
  }

  function batchActionMeta(action: Iot2DeviceTypeBatchAction) {
    return IOT2_DEVICE_TYPE_BATCH_ACTION_META[action]
  }

  function detailTabMeta(value: Iot2DeviceTypeDetailTab | string | undefined) {
    return IOT2_DEVICE_TYPE_DETAIL_TAB_META[value as Iot2DeviceTypeDetailTab]
      ?? IOT2_DEVICE_TYPE_DETAIL_TAB_META.overview
  }

  function thingModelKindMeta(value: Iot2ThingModelKind | string | undefined) {
    return IOT2_THING_MODEL_KIND_META[value as Iot2ThingModelKind]
      ?? IOT2_THING_MODEL_KIND_META.properties
  }

  function thingModelDataTypeMeta(value: Iot2ThingModelDataType | string | undefined) {
    return IOT2_THING_MODEL_DATA_TYPE_META[value as Iot2ThingModelDataType]
      ?? fallback((value || 'string') as Iot2ThingModelDataType, value || t('Iot2DeviceType.common.unknownType'))
  }

  function thingModelAccessMeta(value: Iot2ThingModelAccessMode | string | undefined) {
    return IOT2_THING_MODEL_ACCESS_META[value as Iot2ThingModelAccessMode]
      ?? fallback((value || 'read') as Iot2ThingModelAccessMode, value || t('Iot2DeviceType.common.unset'))
  }

  function eventLevelMeta(value: Iot2ThingModelEventLevel | string | undefined) {
    return IOT2_THING_MODEL_EVENT_LEVEL_META[value as Iot2ThingModelEventLevel]
      ?? fallback((value || 'info') as Iot2ThingModelEventLevel, value || t('Iot2DeviceType.common.unset'))
  }

  function callModeMeta(value: Iot2ThingModelServiceCallMode | string | undefined) {
    return IOT2_THING_MODEL_CALL_MODE_META[value as Iot2ThingModelServiceCallMode]
      ?? fallback((value || 'async') as Iot2ThingModelServiceCallMode, value || t('Iot2DeviceType.common.unset'))
  }

  function ruleStatusMeta(value: Iot2DeviceTypeRuleStatus | string | undefined) {
    return IOT2_DEVICE_TYPE_RULE_STATUS_META[value as Iot2DeviceTypeRuleStatus]
      ?? IOT2_DEVICE_TYPE_RULE_STATUS_META.disabled
  }

  function flowStatusMeta(value: Iot2DeviceTypeFlowStatus | string | undefined) {
    return IOT2_DEVICE_TYPE_FLOW_STATUS_META[value as Iot2DeviceTypeFlowStatus]
      ?? IOT2_DEVICE_TYPE_FLOW_STATUS_META.disabled
  }

  function flowTargetMeta(value: Iot2DeviceTypeFlowTarget | string | undefined) {
    return IOT2_DEVICE_TYPE_FLOW_TARGET_META[value as Iot2DeviceTypeFlowTarget]
      ?? IOT2_DEVICE_TYPE_FLOW_TARGET_META.HTTP
  }

  function versionChangeMeta(value: Iot2DeviceTypeVersionChangeType | string | undefined) {
    return IOT2_DEVICE_TYPE_VERSION_CHANGE_META[value as Iot2DeviceTypeVersionChangeType]
      ?? IOT2_DEVICE_TYPE_VERSION_CHANGE_META.config
  }

  return {
    protocolMeta,
    categoryMeta,
    statusMeta,
    industryMeta,
    viewModeMeta,
    sortMeta,
    sortOrderMeta,
    batchActionMeta,
    detailTabMeta,
    thingModelKindMeta,
    thingModelDataTypeMeta,
    thingModelAccessMeta,
    eventLevelMeta,
    callModeMeta,
    ruleStatusMeta,
    flowStatusMeta,
    flowTargetMeta,
    versionChangeMeta,
    protocolOptions: Object.values(IOT2_DEVICE_TYPE_PROTOCOL_META),
    categoryOptions: Object.values(IOT2_DEVICE_TYPE_CATEGORY_META),
    statusOptions: Object.values(IOT2_DEVICE_TYPE_STATUS_META),
    industryOptions: Object.values(IOT2_DEVICE_TYPE_INDUSTRY_META),
    viewModeOptions: Object.values(IOT2_DEVICE_TYPE_VIEW_MODE_META),
    sortOptions: Object.values(IOT2_DEVICE_TYPE_SORT_META),
    sortOrderOptions: Object.values(IOT2_DEVICE_TYPE_SORT_ORDER_META),
    batchActions: Object.values(IOT2_DEVICE_TYPE_BATCH_ACTION_META),
    detailTabOptions: Object.values(IOT2_DEVICE_TYPE_DETAIL_TAB_META),
    thingModelKindOptions: Object.values(IOT2_THING_MODEL_KIND_META),
    thingModelDataTypeOptions: Object.values(IOT2_THING_MODEL_DATA_TYPE_META),
    thingModelAccessOptions: Object.values(IOT2_THING_MODEL_ACCESS_META),
    eventLevelOptions: Object.values(IOT2_THING_MODEL_EVENT_LEVEL_META),
    callModeOptions: Object.values(IOT2_THING_MODEL_CALL_MODE_META),
    authModeOptions: IOT2_DEVICE_TYPE_AUTH_MODE_OPTIONS,
    dataFormatOptions: IOT2_DEVICE_TYPE_DATA_FORMAT_OPTIONS,
    codecModeOptions: IOT2_DEVICE_TYPE_CODEC_MODE_OPTIONS,
    ruleStatusOptions: Object.values(IOT2_DEVICE_TYPE_RULE_STATUS_META),
    flowStatusOptions: Object.values(IOT2_DEVICE_TYPE_FLOW_STATUS_META),
    flowTargetOptions: Object.values(IOT2_DEVICE_TYPE_FLOW_TARGET_META),
    versionChangeOptions: Object.values(IOT2_DEVICE_TYPE_VERSION_CHANGE_META),
  }
}
