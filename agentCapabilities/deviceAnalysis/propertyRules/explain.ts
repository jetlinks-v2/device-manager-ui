import type {
  AlarmLevelOption, DeviceAlarmCondition, DeviceAlarmNotificationConfig, DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser, ThingModelProperty, ThingPropertyPreprocess,
} from '../../../views/device/alarm/types'
import { recoveryCondition } from '../../../views/device/alarm/conditions'
import { formatPropertyUnit, formatTriggerText, getAlarmProcessor, getNotifyProcessor, propertyIdOf, propertyNameOf, toDeviceAlarmRow } from '../../../views/device/alarm/utils'
import { isEmptyRule, parseRule, type RuleNode, type RulePart } from '../../../views/device/components/PropertyRules/codec'
import { summarizeRuleRows, type RuleTranslator } from '../../../views/device/components/PropertyRules/summary'

export interface RuleResources {
  methods?: DeviceAlarmNotifyMethod[]
  users?: Pick<DeviceAlarmNotifyUser, 'id' | 'name'>[]
  levels?: AlarmLevelOption[]
}

export interface EffectivePropertyRule {
  property: ThingModelProperty
  product?: ThingPropertyPreprocess
  device?: ThingPropertyPreprocess
}

/** Resolve an entire property override, including an empty override that disables inheritance. */
export function resolveEffectiveRule(input: EffectivePropertyRule) {
  const raw = input.device ?? input.product
  const source = input.device ? 'device' : input.product ? 'product' : 'none'
  return { raw, source, status: !raw ? 'unconfigured' : isEmptyRule(raw) ? 'disabled' : 'configured' } as const
}

/** Read only recognized alarm branches; unsupported chains must never appear fully interpreted. */
export function readRuleAlarm(input: EffectivePropertyRule) {
  const { raw, source } = resolveEffectiveRule(input)
  const parsed = parseRule(raw)
  if (!parsed.editable || !parsed.nodes.alarm) return null
  const node = parsed.nodes.alarm
  const branches: RuleNode[] = node.provider === 'composite' ? node.configuration.processors : [node]
  for (const branch of branches) {
    const actions: RuleNode[] = branch.configuration.processors
    const alarmIndex = actions.findIndex(action => ['device-alarm', 'device-alarm-relieve'].includes(action.provider))
    if (actions.some((action, index) => action.configuration.matcher !== undefined
      || action.provider === 'notify' && index < alarmIndex)) return null
  }
  const notify = getNotifyProcessor(node)?.configuration
  if (notify && (notify.topicProvider !== undefined && notify.topicProvider !== 'alarm-device'
    || notify.event !== undefined && notify.event !== 'trigger'
    || notify.enabled !== undefined && typeof notify.enabled !== 'boolean')) return null
  const row = toDeviceAlarmRow({ ...node, id: raw?.id, property: propertyIdOf(input.property) },
    source === 'device' ? 'device' : 'product', '', input.property)
  // Runtime defaults to level 3; the editor's default for creating a new rule is a separate choice.
  if (row) {
    row.level = Number(getAlarmProcessor(node)?.configuration.alarmLevel ?? 3)
    if (!Number.isInteger(row.level)) return null
    row.notification.enabled = Boolean(notify && notify.enabled !== false)
  }
  return row
}

/** Preserve operators and typed values alongside a localized sentence; units never alter thresholds. */
function explainCondition(condition: DeviceAlarmCondition, property: ThingModelProperty, t: RuleTranslator) {
  return {
    operator: condition.trigger,
    ...(['inside', 'outside'].includes(condition.trigger)
      ? { lower: condition.limit.lower, upper: condition.limit.upper, inclusive: true }
      : ['in', 'nin'].includes(condition.trigger) ? { values: condition.values } : { value: condition.value }),
    unit: formatPropertyUnit(property.valueType?.unit),
    description: formatTriggerText(condition, property, t),
  }
}

/** Whitelist parameters instead of returning arbitrary extensions, templates or script bodies to the model. */
function stepParameters(kind: RulePart, node: RuleNode): Record<string, unknown> {
  const config = node.configuration
  if (kind === 'values') return { values: config.matcher.configuration.values,
    action: config.processors[0].provider === 'replace-value' ? 'replace' : config.matcher.configuration.not ? 'keep' : 'ignore',
    ...(config.processors[0].provider === 'replace-value' ? { replacement: config.processors[0].configuration.value } : {}) }
  if (kind === 'range') return { min: config.matcher.configuration.min, max: config.matcher.configuration.max,
    inclusive: true, action: config.processors[0].provider === 'clamp' ? 'clamp' : 'ignore' }
  const keys: Partial<Record<RulePart, string[]>> = {
    step: ['maxStep', 'baselineTtlMillis'], scale: ['scale', 'offset'],
    fallback: ['mode', 'value', 'maxAgeMillis', 'includeEmpty', 'includeMissing'],
    sampling: ['ratio', 'intervalMillis', 'deadband', 'deadbandType', 'maxSilenceMillis'],
  }
  return Object.fromEntries((keys[kind] ?? []).filter(key => config[key] !== undefined).map(key => [key, config[key]]))
}

/** Explain selection and template availability, never implying successful delivery or exposing contacts. */
export function explainNotification(config: DeviceAlarmNotificationConfig, resources: RuleResources, autoRelieve: boolean, t: RuleTranslator) {
  const text = (key: string, params?: Record<string, string | number>) => t(`PropertyRuleAgent.${key}`, params)
  const legacyIds = [...new Set(config.notifyChannelIds ?? [])]
  const matched = (resources.methods ?? []).filter(method => config.channelProviders.includes(method.providerId)
    || legacyIds.some(id => method.channelIds?.includes(id)))
  const types = [...new Set([...config.channelProviders, ...matched.map(method => method.providerId)])].map(id => {
    const method = matched.find(item => item.providerId === id)
    // Persisted recovery notifications can still use the original trigger topic.
    const recoveryEvent = config.relieveTopicProvider === 'alarm-device' ? 'trigger' : 'relieve'
    return { id, name: method?.label ?? id,
      templates: { trigger: method?.templates?.trigger ?? 'unknown', relieve: method?.templates?.[recoveryEvent] ?? 'unknown' } }
  })
  const users = new Map(resources.users?.map(user => [user.id, user.name]))
  const recipients = [...new Set(config.userIds)].map(id => ({ id, name: users.get(id), resolved: users.has(id) }))
  const dimensions = config.dimensions?.length ?? 0
  const complete = Boolean((recipients.length || dimensions) && (types.length || legacyIds.length))
  const enabled = config.enabled && complete
  const includeRelieve = Boolean(enabled && autoRelieve && config.includeRelieve)
  const unknownRecipients = recipients.some(user => !user.resolved)
  const unknownLegacy = legacyIds.some(id => !matched.some(method => method.channelIds?.includes(id)))
  const unknownTemplates = types.some(type => type.templates.trigger === 'unknown' || includeRelieve && type.templates.relieve === 'unknown')
  const warnings: string[] = []
  if (config.enabled && !complete) warnings.push(text('notificationIncomplete'))
  if (enabled) {
    if (unknownRecipients) warnings.push(text('recipientUnknown'))
    if (unknownLegacy) warnings.push(text('legacyUnknown'))
    if (types.some(type => type.templates.trigger === 'missing' || includeRelieve && type.templates.relieve === 'missing')) warnings.push(text('templateMissing'))
    if (unknownTemplates) warnings.push(text('templateUnknown'))
  }
  return {
    enabled, configuredEnabled: config.enabled, complete, includeRelieve,
    triggerPolicy: enabled ? 'first-alarm' : 'disabled',
    relievePolicy: includeRelieve ? 'successful-relieve' : 'disabled',
    triggerTopic: 'alarm-device', relieveTopic: config.relieveTopicProvider ?? 'alarm-device-relieve',
    types, recipients, dimensionCount: dimensions, legacyChannelIds: legacyIds,
    resolution: enabled && (unknownRecipients || unknownLegacy || unknownTemplates) ? 'partial' : 'complete',
    notices: enabled ? [text('deliveryHint'), ...(dimensions ? [text('dynamicRecipients')] : [])] : [],
    description: enabled ? text('notification', {
      types: types.map(type => type.name).join(' / ') || text('legacySelection'),
      users: [...recipients.map(user => user.name ?? user.id), ...(dimensions ? [text('dimensionSelection')] : [])].join(' / '),
      recovery: includeRelieve ? text('includeRelieve') : text('excludeRelieve'),
    }) : text(config.enabled ? 'notificationIncomplete' : 'notificationOff'),
    warnings,
  }
}

/** Build a deterministic explanation of saved configuration, not a simulation or an alarm-state query. */
export function explainPropertyRule(input: EffectivePropertyRule, resources: RuleResources, t: RuleTranslator) {
  const text = (key: string, params?: Record<string, string | number>) => t(`PropertyRuleAgent.${key}`, params)
  const { property } = input
  const { raw, source, status } = resolveEffectiveRule(input)
  const parsed = parseRule(raw)
  const row = readRuleAlarm(input)
  const complete = parsed.editable && (!parsed.nodes.alarm || Boolean(row))
  const notification = row ? explainNotification(row.notification, resources, row.autoRelieve, t) : undefined
  const alarm = row ? {
    name: getAlarmProcessor(parsed.nodes.alarm)?.configuration.alarmName == null
      ? text('defaultAlarmName', { name: propertyNameOf(property) }) : row.name,
    level: { value: row.level, label: resources.levels?.find(level => level.value === row.level)?.label },
    trigger: explainCondition(row, property, t),
    recovery: { enabled: row.autoRelieve, mode: row.relieveCondition ? 'custom' : 'complement',
      condition: row.autoRelieve ? explainCondition(recoveryCondition(row), property, t) : undefined },
    actions: (parsed.nodes.alarm!.provider === 'composite'
      ? parsed.nodes.alarm!.configuration.processors as RuleNode[] : [parsed.nodes.alarm!]).map(branch => ({
      event: (branch.configuration.processors as RuleNode[]).some(action => action.provider === 'device-alarm') ? 'trigger' : 'relieve',
      order: (branch.configuration.processors as RuleNode[]).map(action => ({ provider: action.provider,
        ...(action.provider === 'device-record' ? { description: text('recordAction') } : {}) })),
    })),
    notification,
  } : undefined
  const rows = complete ? summarizeRuleRows(parsed, property, t) : []
  const recordInvalid = complete ? rows.some(step => step.recordInvalid) : null
  const steps = rows.map((step, index) => {
    const node = parsed.nodes[step.key]!
    return { index: index + 1, kind: step.key, provider: node.provider, title: step.key === 'alarm' && alarm ? alarm.name : step.title,
      description: step.key === 'alarm' && alarm ? text('alarm', {
        condition: alarm.trigger.description, level: alarm.level.label ?? String(alarm.level.value),
        recovery: alarm.recovery.enabled ? text('recovery', { condition: alarm.recovery.condition!.description }) : text('manualRecovery'),
      }) : step.sentence,
      parameters: stepParameters(step.key, node),
      ...(step.recordInvalid ? { recordInvalid: true } : {}),
      ...(step.notice ? { notice: step.notice } : {}),
    }
  })
  const warnings = [
    ...(!complete ? [text('unsupported')] : []),
    ...(alarm && !alarm.level.label ? [text('levelUnknown')] : []),
    ...(notification?.warnings ?? []),
  ]
  const sourceText = text(`source.${source}`)
  const summary = status !== 'configured' ? text(`status.${status}`) : !complete ? text('unsupported')
    : [sourceText, ...steps.map(step => `${step.title}: ${step.description}`),
      ...(recordInvalid ? [t('PropertyRules.recordInvalid')] : []), notification?.description].filter(Boolean).join('\n')
  return {
    property: { id: propertyIdOf(property), name: propertyNameOf(property),
      type: property.valueType?.type ?? property.type ?? property.dataType,
      unit: formatPropertyUnit(property.valueType?.unit),
      group: property.expands?.groupName },
    source: { kind: source, configId: raw?.id, inherited: source === 'product', overridesProduct: Boolean(input.device && input.product) },
    status, interpretation: complete ? 'complete' : 'unsupported', summary, steps, alarm,
    invalidDataRecording: { enabled: recordInvalid,
      description: t('PropertyRules.recordInvalidHint') },
    // Provider order is retained for unsupported chains without pretending to understand their behavior.
    ...(!complete ? { providers: parsed.providers } : {}),
    semantics: {
      configurationOnly: true, scope: 'property-preprocessing',
      description: text('scopeHint'),
      ...(steps.some(step => step.kind === 'values' || step.kind === 'range' || step.kind === 'step') ? { cleaning: text('cleaningHint') } : {}),
      ...(parsed.nodes.fallback && complete ? { fallback: text('fallbackHint') } : {}),
      ...(parsed.nodes.alarm && parsed.nodes.sampling && complete ? { sampling: text('samplingHint') } : {}),
    },
    warnings,
  }
}

export type PropertyRuleExplanation = ReturnType<typeof explainPropertyRule>
