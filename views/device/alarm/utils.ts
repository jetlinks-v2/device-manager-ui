import type {
  DeviceAlarmFormModel,
  DeviceAlarmLevel,
  DeviceAlarmNotificationConfig,
  DeviceAlarmNotifyMethod,
  DeviceAlarmRow,
  DeviceAlarmSource,
  DeviceAlarmTrigger,
  EnumLike,
  ThingModelProperty,
  ThingPropertyPreprocess,
} from './types'
import i18n from '@jetlinks-web-core/locales'

const DEVICE_ALARM_PROCESSOR = 'device-alarm'
const DEVICE_ALARM_RELIEVE_PROCESSOR = 'device-alarm-relieve'
const NOTIFY_PROCESSOR = 'notify'
const NUMBER_RANGE_MATCHER = 'number-range'
const SIMPLE_PROCESSOR = 'simple'
const COMPOSITE_PROCESSOR = 'composite'

interface DeviceAlarmConfiguration {
  alarmProcessor: Record<string, any>
  matcher: Record<string, any>
  notifyProcessor?: Record<string, any>
  relieveProcessor?: Record<string, any>
}

/** 旧配置仅保存提供者和参数；同一提供者可能存在多个通知通道，必须同时匹配参数。 */
export function matchesAlarmNotifyMethod(notification: DeviceAlarmNotificationConfig, method: DeviceAlarmNotifyMethod) {
  if (notification.notifyChannelIds?.includes(method.channelId || method.id)) return true
  if (!notification.channelProviders.includes(method.providerId)) return false
  const parameter = notification.parameters?.[method.providerId]
  if (!isRecord(parameter)) return true
  const raw = method.raw ?? {}
  const configuration = raw.channelConfiguration ?? raw.configuration ?? {}
  const notifierId = String(parameter.notifierId || '')
  const templateId = String(parameter.templateId || '')
  return (!notifierId || notifierId === String(configuration.notifierId || raw.notifierId || ''))
    && (!templateId || templateId === String(configuration.templateId || raw.templateId || ''))
}

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
  return findAlarmConfiguration(row)?.alarmProcessor
}

export function getNotifyProcessor(row?: ThingPropertyPreprocess) {
  return findAlarmConfiguration(row)?.notifyProcessor
}

export function getAlarmMatcher(row?: ThingPropertyPreprocess) {
  return findAlarmConfiguration(row)?.matcher
}

export function hasAlarmRelieveProcessor(row?: ThingPropertyPreprocess): boolean {
  return Boolean(parseDeviceAlarmConfiguration(row)?.relieveProcessor)
}

/** 复合属性链只提取唯一告警单元，其他处理段仍由完整配置编解码器保护。 */
function findAlarmConfiguration(row?: ThingPropertyPreprocess, depth = 0): DeviceAlarmConfiguration | undefined {
  if (!row || depth > 16) return undefined
  const direct = parseDeviceAlarmConfiguration(row)
  if (direct) return direct
  const processors = row.configuration?.processors
  if (row.provider !== COMPOSITE_PROCESSOR || !Array.isArray(processors)) return undefined
  // 解除分支必须与告警组成已识别的单元，不能把未知平铺复合链误读成普通告警。
  if (processors.some(child => child?.provider === SIMPLE_PROCESSOR
    && directProcessors(child.configuration ?? {})?.some(item => item.provider === DEVICE_ALARM_RELIEVE_PROCESSOR))) return undefined
  let result: DeviceAlarmConfiguration | undefined
  for (const child of processors) {
    const found = findAlarmConfiguration(child, depth + 1)
    if (!found) continue
    if (result) return undefined
    result = found
  }
  return result
}

export function isDeviceAlarmPreprocess(row?: ThingPropertyPreprocess): boolean {
  return Boolean(findAlarmConfiguration(row))
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
  const alarmConfiguration = findAlarmConfiguration(row)
  if (!alarmConfiguration) return null
  const processorConfig = alarmConfiguration.alarmProcessor.configuration ?? {}
  const notifyConfig = normalizeNotification(row.notifyConfig ?? alarmConfiguration.notifyProcessor?.configuration)
  const matcherConfig = alarmConfiguration.matcher.configuration ?? {}
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
    autoRelieve: Boolean(alarmConfiguration.relieveProcessor),
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
  const alarmProcessorConfiguration = {
    alarmName: form.name,
    alarmLevel: form.level,
  }
  const processors: Array<Record<string, any>> = [
    {
      provider: DEVICE_ALARM_PROCESSOR,
      configuration: alarmProcessorConfiguration,
    },
  ]
  if (notification) {
    processors.push({
      provider: NOTIFY_PROCESSOR,
      configuration: notification,
    })
  }

  const alarmConfiguration = {
    matcher: buildNumberRangeMatcher(form),
    processors,
  }
  if (!form.autoRelieve) {
    return {
      thingType: 'device',
      provider: SIMPLE_PROCESSOR,
      configuration: alarmConfiguration,
    }
  }

  return {
    thingType: 'device',
    provider: COMPOSITE_PROCESSOR,
    configuration: {
      processors: [
        {
          provider: SIMPLE_PROCESSOR,
          configuration: alarmConfiguration,
        },
        {
          provider: SIMPLE_PROCESSOR,
          configuration: {
            matcher: buildNumberRangeMatcher(form, true),
            processors: [
              {
                provider: DEVICE_ALARM_RELIEVE_PROCESSOR,
                configuration: { ...alarmProcessorConfiguration },
              },
            ],
          },
        },
      ],
    },
  }
}

function buildNumberRangeMatcher(form: DeviceAlarmFormModel, inverted = false) {
  const not = form.trigger === 'outside'
  return {
    provider: NUMBER_RANGE_MATCHER,
    configuration: {
      min: form.limit.lower,
      max: form.limit.upper,
      not: inverted ? !not : not,
    },
  }
}

/**
 * 只解析单个告警单元：历史 simple 告警，或自动解除生成的标准 composite。
 * 混合属性链由上层查找唯一单元，未知分支的编辑由完整配置编解码器拒绝。
 */
function parseDeviceAlarmConfiguration(row?: ThingPropertyPreprocess): DeviceAlarmConfiguration | undefined {
  if (!row || !isRecord(row.configuration)) return undefined
  if (row.provider === SIMPLE_PROCESSOR) {
    return parseAlarmBranch(row.configuration)
  }
  if (row.provider !== COMPOSITE_PROCESSOR) return undefined

  const branches = directProcessors(row.configuration)
  if (!branches || branches.length !== 2 || branches.some(item => item.provider !== SIMPLE_PROCESSOR)) {
    return undefined
  }
  const parsedBranches = branches.map(item => {
    const configuration = isRecord(item.configuration) ? item.configuration : undefined
    if (!configuration) return undefined
    return {
      alarm: parseAlarmBranch(configuration),
      relieve: parseRelieveBranch(configuration),
    }
  })
  const alarmBranches = parsedBranches.filter(item => item?.alarm)
  const relieveBranches = parsedBranches.filter(item => item?.relieve)
  if (alarmBranches.length !== 1 || relieveBranches.length !== 1) return undefined

  const alarm = alarmBranches[0]!.alarm!
  const relieve = relieveBranches[0]!.relieve!
  if (!areComplementaryMatchers(alarm.matcher, relieve.matcher)) return undefined
  return { ...alarm, relieveProcessor: relieve.processor }
}

function parseAlarmBranch(configuration: Record<string, unknown>): DeviceAlarmConfiguration | undefined {
  const matcher = numberRangeMatcher(configuration.matcher)
  const processors = directProcessors(configuration)
  if (!matcher || !processors) return undefined
  const alarms = processors.filter(item => item.provider === DEVICE_ALARM_PROCESSOR)
  const notifications = processors.filter(item => item.provider === NOTIFY_PROCESSOR)
  if (alarms.length !== 1 || notifications.length > 1
    || processors.some(item => ![DEVICE_ALARM_PROCESSOR, NOTIFY_PROCESSOR, 'device-record'].includes(item.provider))) {
    return undefined
  }
  return {
    alarmProcessor: alarms[0],
    matcher,
    notifyProcessor: notifications[0],
  }
}

function parseRelieveBranch(configuration: Record<string, unknown>) {
  const matcher = numberRangeMatcher(configuration.matcher)
  const processors = directProcessors(configuration)
  if (!matcher || !processors || processors.length !== 1) return undefined
  const processor = processors[0]
  return processor.provider === DEVICE_ALARM_RELIEVE_PROCESSOR ? { matcher, processor } : undefined
}

function directProcessors(configuration: Record<string, unknown>): Array<Record<string, any>> | undefined {
  if (!Array.isArray(configuration.processors) || !configuration.processors.every(isRecord)) return undefined
  return configuration.processors as Array<Record<string, any>>
}

function numberRangeMatcher(value: unknown): Record<string, any> | undefined {
  if (!isRecord(value) || value.provider !== NUMBER_RANGE_MATCHER || !isRecord(value.configuration)) return undefined
  return value as Record<string, any>
}

function areComplementaryMatchers(left: Record<string, any>, right: Record<string, any>): boolean {
  const leftConfig = left.configuration as Record<string, unknown>
  const rightConfig = right.configuration as Record<string, unknown>
  return toOptionalNumber(leftConfig.min) === toOptionalNumber(rightConfig.min)
    && toOptionalNumber(leftConfig.max) === toOptionalNumber(rightConfig.max)
    && typeof leftConfig.not === 'boolean'
    && typeof rightConfig.not === 'boolean'
    && leftConfig.not !== rightConfig.not
}

export function formatRelieveText(row: Pick<DeviceAlarmRow, 'trigger' | 'limit' | 'propertyName'>) {
  return formatTriggerText({
    ...row,
    trigger: row.trigger === 'inside' ? 'outside' : 'inside',
  })
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
