export type DeviceAlarmSource = 'product' | 'device'
export type DeviceAlarmTrigger = 'outside' | 'inside' | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in' | 'nin'
export type DeviceAlarmValue = string | number | boolean
export interface DeviceAlarmCondition {
  trigger: DeviceAlarmTrigger
  limit: DeviceAlarmLimit
  value?: DeviceAlarmValue | null
  values?: DeviceAlarmValue[]
}
export type DeviceAlarmLevel = number

export type EnumLike = string | {
  value?: string
  text?: string
  label?: string
  name?: string
}

export interface DeviceAlarmLimit {
  lower?: number
  upper?: number
}

export interface DeviceAlarmNotifyMethod {
  id: string
  providerId: string
  key: 'inbox' | 'sms' | 'email' | 'wechat' | 'dingtalk' | 'phone' | 'webhook'
  label: string
  desc: string
  icon: string
  /** Accessible channel IDs are read only for persisted legacy selections. */
  channelIds?: string[]
  templates?: Record<'trigger' | 'relieve', 'ready' | 'missing' | 'unknown' | 'unneeded'>
}

export interface DeviceAlarmNotifyUser {
  id: string
  name: string
  desc: string
  tag: string
}

export interface DeviceAlarmNotificationConfig {
  enabled: boolean
  includeRelieve?: boolean
  /** Persisted legacy rules may still use the trigger provider for recovery. */
  relieveTopicProvider?: 'alarm-device' | 'alarm-device-relieve'
  userIds: string[]
  dimensions?: Array<Record<string, unknown>>
  channelProviders: string[]
  notifyChannelIds?: string[]
  parameters: Record<string, unknown>
}

export interface DeviceAlarmFormModel extends DeviceAlarmCondition {
  id?: string
  name: string
  source: DeviceAlarmSource
  targetId: string
  targetName?: string
  productId?: string
  productName?: string
  deviceId?: string
  property: string
  propertyName?: string
  propertyUnit?: string
  level: DeviceAlarmLevel
  autoRelieve: boolean
  relieveCondition?: DeviceAlarmCondition
  notification: DeviceAlarmNotificationConfig
}

export interface DeviceAlarmRow extends DeviceAlarmFormModel {
  key: string
  notificationConfigured?: boolean
  notificationEnabled?: boolean
  raw?: ThingPropertyPreprocess
}

export interface ThingModelValueType {
  type?: string
  unit?: string
  scale?: number
  maxLength?: number
  bodyType?: string
  format?: string
  trueText?: string
  falseText?: string
  elements?: Array<{ text?: string; value: string | number | boolean }>
  elementType?: ThingModelValueType
  properties?: ThingModelProperty[]
}

export interface ThingModelProperty {
  id?: string
  identifier?: string
  key?: string
  name?: string
  expands?: { groupId?: string; groupName?: string }
  alarmConfigured?: boolean
  dataType?: string
  valueType?: ThingModelValueType
  type?: string
}

export interface AlarmLevelOption {
  label: string
  value: DeviceAlarmLevel
}

export interface DeviceAlarmTargetOption {
  label: string
  value: string
  source: DeviceAlarmSource
  productId?: string
  productName?: string
  deviceId?: string
  metadata?: unknown
}

export interface DeviceAlarmTargetPage {
  data: DeviceAlarmTargetOption[]
  total: number
}

export interface ThingPropertyPreprocess {
  id?: string
  name?: string
  source?: DeviceAlarmSource | EnumLike
  targetId?: string
  targetName?: string
  productId?: string
  productName?: string
  deviceId?: string
  deviceName?: string
  templateId?: string
  thingId?: string
  property?: string
  propertyName?: string
  propertyUnit?: string
  notificationConfigured?: boolean
  notificationEnabled?: boolean
  notifyConfig?: Record<string, any>
  provider?: string
  configuration?: Record<string, any>
  state?: EnumLike | number
}

export interface DeviceAlarmPageResult {
  data: ThingPropertyPreprocess[]
  total: number
}

export interface DeviceAlarmLibraryTemplate {
  id: string
  name: string
  resourceId?: string
  version?: string
  manufacturer?: string
  model?: string
  productId?: string
  propertyPreprocessors: ThingPropertyPreprocess[]
}
