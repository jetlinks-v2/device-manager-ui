import type {
  DeviceAlarmFormModel,
  DeviceAlarmLevel,
  DeviceAlarmNotificationConfig,
  DeviceAlarmRow,
  DeviceAlarmSource,
  DeviceAlarmTrigger,
  EnumLike,
  ThingModelProperty,
  ThingPropertyPreprocess,
} from './types'
import i18n from '@jetlinks-web-core/locales'

const DEVICE_ALARM_PROCESSOR = 'device-alarm'
const NOTIFY_PROCESSOR = 'notify'
const NUMBER_RANGE_MATCHER = 'number-range'

export const DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH = 1024
export type DeviceAlarmNotificationMessageMode = 'default' | 'custom'

export function enumValue(value: EnumLike | number | undefined): string {
  if (value && typeof value === 'object') return String(value.value ?? value.name ?? '')
  return value == null ? '' : String(value)
}

export function enumText(value: EnumLike | number | undefined, fallback = ''): string {
  if (value && typeof value === 'object') {
    const raw = String(value.value ?? value.name ?? '')
    return String(value.text ?? value.label ?? (fallback || raw))
  }
  return value == null || value === '' ? fallback : String(value)
}

export function parseMetadata(value: unknown): { properties: ThingModelProperty[] } {
  if (!value) return { properties: [] }
  if (typeof value === 'string') {
    try {
      return parseMetadata(JSON.parse(value))
    } catch {
      return { properties: [] }
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return { properties: [] }
  const metadata = value as Record<string, any>
  return {
    properties: Array.isArray(metadata.properties) ? metadata.properties : [],
  }
}

export function propertyIdOf(property: ThingModelProperty): string {
  return String(property.id ?? property.identifier ?? property.key ?? '')
}

export function propertyNameOf(property: ThingModelProperty): string {
  return String(property.name ?? propertyIdOf(property))
}

export function isNumberProperty(property: ThingModelProperty): boolean {
  const type = String(property.valueType?.type ?? property.type ?? property.dataType ?? '').toLowerCase()
  return ['int', 'long', 'float', 'double', 'number'].includes(type)
}

export function getAlarmProcessor(row?: ThingPropertyPreprocess) {
  const processors = row?.configuration?.processors
  if (!Array.isArray(processors)) return undefined
  return processors.find((item) => item?.provider === DEVICE_ALARM_PROCESSOR)
}

export function getNotifyProcessor(row?: ThingPropertyPreprocess) {
  const processors = row?.configuration?.processors
  if (!Array.isArray(processors)) return undefined
  return processors.find((item) => item?.provider === NOTIFY_PROCESSOR)
}

export function getAlarmMatcher(row?: ThingPropertyPreprocess) {
  const matcher = row?.configuration?.matcher
  return matcher?.provider === NUMBER_RANGE_MATCHER ? matcher : undefined
}

export function isDeviceAlarmPreprocess(row?: ThingPropertyPreprocess): boolean {
  return Boolean(getAlarmProcessor(row))
}

export function normalizeAlarmSource(row?: ThingPropertyPreprocess): DeviceAlarmSource {
  const raw = enumValue(row?.source).toLowerCase()
  if (raw === 'device') return 'device'
  if (raw === 'product') return 'product'
  const thingId = String(row?.deviceId ?? row?.thingId ?? '')
  return thingId && thingId !== '@all' ? 'device' : 'product'
}

export function toDeviceAlarmRow(
  row: ThingPropertyPreprocess,
  source: DeviceAlarmSource,
  targetName: string,
  property?: ThingModelProperty,
): DeviceAlarmRow | null {
  if (!isDeviceAlarmPreprocess(row)) return null
  const processorConfig = getAlarmProcessor(row)?.configuration ?? {}
  const notifyConfig = normalizeNotification(row.notifyConfig ?? getNotifyProcessor(row)?.configuration)
  const matcherConfig = getAlarmMatcher(row)?.configuration ?? {}
  const propertyId = String(row.property ?? propertyIdOf(property ?? {}))
  const propertyName = String(row.propertyName ?? propertyNameOf(property ?? { id: propertyId }))
  const productId = String(row.templateId ?? '')
  const thingId = String(row.thingId ?? '')
  const deviceId = source === 'device' ? thingId : undefined

  return {
    key: String(row.id ?? `${source}:${productId}:${thingId}:${propertyId}`),
    id: row.id,
    name: String(processorConfig.alarmName ?? row.name ?? propertyName),
    source,
    targetId: source === 'product' ? productId : thingId,
    targetName,
    productId,
    productName: source === 'product' ? targetName : String(row.productName ?? ''),
    deviceId,
    property: propertyId,
    propertyName,
    propertyUnit: formatPropertyUnit(property?.valueType?.unit),
    level: normalizeLevel(processorConfig.alarmLevel),
    trigger: matcherConfig.not === false ? 'inside' : 'outside',
    limit: {
      lower: toOptionalNumber(matcherConfig.min),
      upper: toOptionalNumber(matcherConfig.max),
    },
    notificationConfigured: Boolean(row.notificationConfigured ?? isNotificationConfigured(notifyConfig)),
    notificationEnabled: Boolean(row.notificationEnabled ?? isNotificationEnabled(notifyConfig)),
    notification: notifyConfig,
    raw: row,
  }
}

export function toDeviceAlarmPageRow(row: ThingPropertyPreprocess): DeviceAlarmRow | null {
  const source = normalizeAlarmSource(row)
  const productId = String(row.productId ?? row.templateId ?? '')
  const thingId = String(row.deviceId ?? row.thingId ?? '')
  const targetId = String(row.targetId ?? (source === 'product' ? productId : thingId))
  const targetName = String(
    row.targetName
    ?? (source === 'product' ? row.productName : row.deviceName)
    ?? targetId,
  )
  return toDeviceAlarmRow(
    {
      ...row,
      templateId: productId,
      thingId,
    },
    source,
    targetName,
    row.propertyName || row.propertyUnit
      ? { id: row.property, name: row.propertyName, valueType: { unit: formatPropertyUnit(row.propertyUnit) } }
      : undefined,
  )
}

export function buildPreprocessPayload(form: DeviceAlarmFormModel) {
  const notification = buildNotifyConfig(form)
  const processors: Array<Record<string, any>> = [
    {
      provider: DEVICE_ALARM_PROCESSOR,
      configuration: {
        alarmName: form.name,
        alarmLevel: form.level,
      },
    },
  ]
  if (notification) {
    processors.push({
      provider: NOTIFY_PROCESSOR,
      configuration: notification,
    })
  }

  return {
    thingType: 'device',
    provider: 'simple',
    configuration: {
      matcher: {
        provider: NUMBER_RANGE_MATCHER,
        configuration: {
          min: form.limit.lower,
          max: form.limit.upper,
          not: form.trigger === 'outside',
        },
      },
      processors,
    },
  }
}

export function formatTriggerText(row: Pick<DeviceAlarmRow, 'trigger' | 'limit' | 'propertyName'>) {
  const lower = row.limit.lower ?? '-'
  const upper = row.limit.upper ?? '-'
  const propertyName = row.propertyName ? `${row.propertyName}` : ''
  return row.trigger === 'inside'
    ? i18n.global.t('DeviceAlarm.triggerText.inside', { propertyName, lower, upper })
    : i18n.global.t('DeviceAlarm.triggerText.outside', { propertyName, lower, upper })
}

export function formatPropertyUnit(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'object' && !Array.isArray(value)) {
    const unit = value as Record<string, unknown>
    return formatPropertyUnit(unit.unitName ?? unit.unitText ?? unit.unitLabel ?? unit.unit ?? unit.name ?? unit.text ?? unit.label ?? unit.symbol ?? unit.id)
  }
  const unit = String(value).trim()
  if (!unit) return undefined
  return { percent: '%', celsius: '℃', fahrenheit: '℉' }[unit.toLowerCase()] ?? unit
}

export function levelTone(level: DeviceAlarmLevel): 'error' | 'warning' | 'processing' | 'default' {
  if (level <= 2) return 'error'
  if (level === 3) return 'warning'
  if (level === 4) return 'processing'
  return 'default'
}

export function createEmptyNotification() {
  return {
    enabled: false,
    userIds: [],
    channelProviders: [],
    parameters: {},
  }
}

export function getNotificationMessageMode(
  notification: Pick<DeviceAlarmNotificationConfig, 'parameters'>,
): DeviceAlarmNotificationMessageMode {
  return isRecord(notification.parameters?.template) ? 'custom' : 'default'
}

export function getNotificationMessageTemplate(
  notification: Pick<DeviceAlarmNotificationConfig, 'parameters'>,
): string {
  const template = notification.parameters?.template
  return isRecord(template) && typeof template.message === 'string' ? template.message : ''
}

export function setNotificationMessageTemplate(
  notification: DeviceAlarmNotificationConfig,
  message: string,
) {
  const parameters = notification.parameters ?? {}
  const template = isRecord(parameters.template) ? parameters.template : {}
  const {
    messageTemplate: _messageTemplate,
    variableDefinitions: _variableDefinitions,
    ...rest
  } = parameters
  notification.parameters = {
    ...rest,
    template: {
      ...template,
      message,
    },
  }
}

export function clearNotificationMessageTemplate(notification: DeviceAlarmNotificationConfig) {
  const {
    messageTemplate: _messageTemplate,
    template: _template,
    variableDefinitions: _variableDefinitions,
    ...rest
  } = notification.parameters ?? {}
  notification.parameters = rest
}

export function validateNotificationMessage(
  notification: Pick<DeviceAlarmNotificationConfig, 'parameters'>,
): 'required' | 'maxLength' | undefined {
  if (getNotificationMessageMode(notification) !== 'custom') return undefined
  const message = getNotificationMessageTemplate(notification)
  if (!message.trim()) return 'required'
  if (message.length > DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH) return 'maxLength'
  return undefined
}

export function normalizeNotification(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
  return {
    ...createEmptyNotification(),
    ...source,
    // 空通知配置不能被视为已启用；已有通知沿用后端省略 enabled 时的启用语义。
    enabled: source.enabled === undefined ? isNotificationConfigured(source) : Boolean(source.enabled),
    userIds: Array.isArray(source.userIds) ? source.userIds.map(String).filter(Boolean) : [],
    dimensions: Array.isArray(source.dimensions) ? source.dimensions : [],
    channelProviders: Array.isArray(source.channelProviders) ? source.channelProviders.map(String).filter(Boolean) : [],
    notifyChannelIds: Array.isArray(source.notifyChannelIds) ? source.notifyChannelIds.map(String).filter(Boolean) : [],
    parameters: source.parameters && typeof source.parameters === 'object' && !Array.isArray(source.parameters)
      ? source.parameters
      : {},
  }
}

export function normalizeLevel(value: unknown): DeviceAlarmLevel {
  const level = Number(value)
  return Number.isInteger(level) && level >= 1 && level <= 5 ? level : 4
}

function toOptionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function buildNotifyConfig(form: DeviceAlarmFormModel) {
  const notification = normalizeNotification(form.notification)
  if (!isNotificationConfigured(notification)) {
    return undefined
  }
  return {
    enabled: notification.enabled,
    userIds: [...notification.userIds],
    dimensions: [...(notification.dimensions ?? [])],
    channelProviders: [...notification.channelProviders],
    notifyChannelIds: [...(notification.notifyChannelIds ?? [])],
    parameters: { ...(notification.parameters ?? {}) },
  }
}

function isNotificationConfigured(notification: {
  userIds?: unknown
  dimensions?: unknown
  channelProviders?: unknown
  notifyChannelIds?: unknown
}) {
  const hasReceiver = Boolean(
    (Array.isArray(notification.userIds) && notification.userIds.length)
    || (Array.isArray(notification.dimensions) && notification.dimensions.length),
  )
  const hasChannel = Boolean(
    (Array.isArray(notification.channelProviders) && notification.channelProviders.length)
    || (Array.isArray(notification.notifyChannelIds) && notification.notifyChannelIds.length),
  )
  return hasReceiver && hasChannel
}

function isNotificationEnabled(notification: ReturnType<typeof normalizeNotification>) {
  return isNotificationConfigured(notification) && notification.enabled !== false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
