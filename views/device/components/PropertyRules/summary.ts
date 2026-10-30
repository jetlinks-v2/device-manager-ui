import type { DeviceAlarmFormModel, ThingModelProperty } from '../../alarm/types'
import { formatPropertyUnit, formatTriggerText, formatRelieveText, isNumberProperty, propertyNameOf, toDeviceAlarmRow } from '../../alarm/utils'
import type { ParsedRule, RuleDraft, RulePart } from './codec'
import { readSampling, validateSampling, type SamplingDraft } from './sampling'
import { readValueRules } from './values/config'

export type RuleSection = 'cleaning' | 'processing' | 'alarm' | 'sampling'
export type RuleTranslator = (key: string, values?: Record<string, string | number>) => string
export interface RuleStepSummary {
  key: RuleSection
  icon: string
  title: string
  text: string
  enabled: boolean
}

type RuleEffects = Omit<RuleDraft, 'alarm'> & { alarm: Pick<DeviceAlarmFormModel, 'name' | 'trigger' | 'limit' | 'value' | 'values' | 'autoRelieve' | 'relieveCondition'> }

export interface RuleRowSummary {
  key: RulePart
  icon: string
  title: string
  color: string
  sentence: string
  notice?: string
  details?: string
  recordInvalid?: boolean
}

export function ruleStageOf(part: RulePart): RuleSection { return ['values', 'range', 'step'].includes(part) ? 'cleaning' : ['scale', 'fallback', 'file'].includes(part) ? 'processing' : part === 'alarm' ? 'alarm' : 'sampling' }

/** A difference between percentage values is measured in percentage points, not relative percent. */
export function formatRuleDifferenceUnit(property: ThingModelProperty, t: RuleTranslator): string {
  const unit = formatPropertyUnit(property.valueType?.unit) ?? ''
  return unit === '%' ? t('PropertyRules.percentagePoints') : unit
}

/** Read-only rows share the editor's sentence order without creating forms for every property. */
export function summarizeRuleRows(rule: ParsedRule, property: ThingModelProperty, t: RuleTranslator): RuleRowSummary[] {
  return summarizeEffectRows(effectsOf(rule), property, t)
}

/** The preview uses the same names, conditions and ordering as saved rule summaries. */
export function summarizeDraftRows(draft: RuleDraft, property: ThingModelProperty, t: RuleTranslator): RuleRowSummary[] {
  return summarizeEffectRows(draft, property, t)
}

function summarizeEffectRows(effects: RuleEffects, property: ThingModelProperty, t: RuleTranslator): RuleRowSummary[] {
  const rows: RuleRowSummary[] = []
  const unit = formatPropertyUnit(property.valueType?.unit) ?? ''
  const cleaningUnit = effects.scaleEnabled ? ` ${t('PropertyRules.rawValue')}` : unit
  const differenceUnit = formatRuleDifferenceUnit(property, t)
  const cleaningDifferenceUnit = effects.scaleEnabled ? cleaningUnit : differenceUnit
  const differenceHint = unit === '%' ? t('PropertyRules.percentagePointsHint') : ''
  const cleaningHint = effects.scaleEnabled ? t('PropertyRules.rawValueHint') : ''
  const durationText = (millis?: number | null) => `${millis == null ? '—' : millis / 1000} ${t('PropertyRules.timeUnit.s')}`
  if (effects.valuesEnabled) {
    const all = effects.values
    const values = all.length ? `${formatValues(all.slice(0, 3), property, t)}${all.length > 3 ? '…' : ''}` : t('PropertyRules.valuesIncomplete')
    const action = t(effects.valuesMode === 'replace' ? 'PropertyRules.replace' : effects.valuesMode === 'keep' ? 'PropertyRules.sentence.keepOnly' : 'PropertyRules.sentence.ignore')
    rows.push({ key: 'values', icon: 'StopOutlined', title: t('PropertyRules.part.values'), color: 'blue',
      sentence: t('PropertyRules.sentence.valueRule', { values, action, replacement: effects.valuesMode === 'replace'
        ? `${t('PropertyRules.sentence.withValue')} ${effects.replacementValue == null ? '—' : formatValues([effects.replacementValue], property, t)}` : '' }), notice: cleaningHint || undefined })
  }
  if (effects.rangeEnabled) rows.push({ key: 'range', icon: 'SafetyOutlined', title: t('PropertyRules.part.range'), color: 'blue',
    sentence: `${t(effects.rangeAction === 'clamp' ? 'PropertyRules.sentence.clampTo' : 'PropertyRules.sentence.keep')} ${bounds(effects, cleaningUnit)}`, notice: [cleaningHint, effects.rangeAction === 'clamp' ? t('PropertyRules.clampHint') : ''].filter(Boolean).join(' ') || undefined })
  if (effects.stepEnabled) rows.push({ key: 'step', icon: 'LineChartOutlined', title: t('PropertyRules.part.step'), color: 'blue',
    sentence: t('PropertyRules.sentence.maxStep', { age: durationText(effects.baselineTtl), threshold: `${effects.maxStep ?? '—'}${cleaningDifferenceUnit}` }),
    notice: [cleaningHint, t('PropertyRules.stepHint'), effects.scaleEnabled ? '' : differenceHint, t('PropertyRules.statefulHint')].filter(Boolean).join(' ') })
  if (effects.scaleEnabled) rows.push({ key: 'scale', icon: 'CalculatorOutlined', title: t('PropertyRules.part.scale'), color: 'purple',
    sentence: `${t('PropertyRules.sentence.multiply')} ${effects.scale ?? '—'} + ${Number(effects.offset) < 0 ? `(${effects.offset})` : effects.offset ?? '0'}` })
  if (effects.fallbackEnabled) rows.push({ key: 'fallback', icon: 'HistoryOutlined', title: t('PropertyRules.part.fallback'), color: 'purple',
    sentence: t(`PropertyRules.sentence.fallback${effects.fallbackMode === 'previous' ? 'Previous' : 'Fixed'}`, {
      trigger: [t('PropertyRules.fallback.null'), effects.fallbackEmpty && (property.valueType?.type ?? property.type ?? property.dataType) === 'string' ? t('PropertyRules.fallback.emptyShort') : '',
        effects.fallbackMissing ? t('PropertyRules.fallback.absent') : ''].filter(Boolean).join(' / '),
      strategy: t('PropertyRules.fallback.' + (effects.fallbackMode === 'previous' ? 'previousShort' : 'fixed')),
      age: durationText(effects.fallbackMaxAge), value: effects.fallbackValue == null ? '—' : `${formatValues([effects.fallbackValue], property, t)}${isNumberProperty(property) ? unit : ''}`,
      otherwise: effects.fallbackValue != null ? t('PropertyRules.sentence.fallbackOtherwise', { value: `${formatValues([effects.fallbackValue], property, t)}${isNumberProperty(property) ? unit : ''}` }) : '',
    }).trim(), notice: t('PropertyRules.fallback.hint') })
  if (effects.alarmEnabled) rows.push({ key: 'alarm', icon: 'AlertOutlined', title: effects.alarm.name || t('PropertyRules.defaultAlarmName', { name: propertyNameOf(property) }), color: 'orange',
    sentence: ['inside', 'outside'].includes(effects.alarm.trigger)
      ? `${t(effects.alarm.trigger === 'outside' ? 'PropertyRules.sentence.outside' : 'PropertyRules.sentence.inside')} ${bounds({ min: effects.alarm.limit.lower, max: effects.alarm.limit.upper })}`
      : formatTriggerText(effects.alarm, property, t),
    details: effects.alarm.autoRelieve ? `${t('DeviceAlarm.autoRelieve.condition')}${formatRelieveText(effects.alarm)}` : undefined })
  if (effects.samplingEnabled) {
    const draft = effects
    const mode = draft.samplingMode
    const sentence = mode === 'ratio' ? `${t('PropertyRules.sentence.sample')} ${draft.percent == null ? '—' : Number(draft.percent.toFixed(2))}%`
      : mode === 'interval' ? t('PropertyRules.sentence.intervalRule', { interval: `${draft.interval ?? '—'} ${intervalUnitText(draft, t)}` })
        : isNumberProperty(property) ? t('PropertyRules.sentence.changeRule', { kind: t(draft.deadbandType === 'percent' ? 'PropertyRules.sentence.relativeChange' : 'PropertyRules.deadbandType.absolute'), operator: Number(draft.deadband) === 0 ? '>' : '≥', threshold: `${draft.deadband ?? '—'}${draft.deadbandType === 'percent' ? '%' : differenceUnit}` })
          : t('PropertyRules.sentence.changeScalar')
    rows.push({ key: 'sampling', icon: mode === 'ratio' ? 'FilterOutlined' : mode === 'interval' ? 'ClockCircleOutlined' : 'SwapOutlined',
      title: t(`PropertyRules.part.${mode === 'ratio' ? 'sampling' : mode}`), color: 'cyan',
      sentence: `${sentence}${mode === 'change' && draft.maxSilence != null ? ` · ${t('PropertyRules.sentence.orInterval')} ${durationText(draft.maxSilence)}` : ''}`,
      notice: mode === 'ratio' ? undefined : [t(mode === 'interval' ? 'PropertyRules.intervalHint' : 'PropertyRules.deadbandHint'), mode === 'change' && draft.deadbandType === 'absolute' ? differenceHint : '', t('PropertyRules.statefulHint')].filter(Boolean).join(' ') })
  }
  if (effects.fileEnabled) rows.push({ key: 'file', icon: 'FileOutlined', title: t('PropertyRules.part.file'), color: 'purple',
    sentence: `Base64 → ${t('PropertyRules.sentence.fileUrl')}`, notice: t('PropertyRules.fileHint') })
  for (const row of rows) {
    if (effects.recordInvalid && (row.key === 'values' && effects.valuesMode !== 'replace'
      || row.key === 'range' && effects.rangeAction !== 'clamp' || row.key === 'step')) row.recordInvalid = true
  }
  return rows

  function bounds(value: { min?: number | null; max?: number | null }, suffix = unit) {
    if (typeof value.min !== 'number' || !Number.isFinite(value.min) || typeof value.max !== 'number' || !Number.isFinite(value.max) || value.min > value.max) {
      return t('PropertyRules.rangeIncomplete')
    }
    return `${value.min}～${value.max}${suffix}`
  }
}

function formatValues(values: Array<string | number | boolean>, property: ThingModelProperty, t: RuleTranslator) {
  return values.map(value => property.valueType?.elements?.find(item => item.value === value)?.text ?? JSON.stringify(value)).join(t('PropertyRules.valueSeparator'))
}

/** Saved rules and unsaved inputs share the same effect descriptions; this never builds a runnable rule. */
export function summarizeRule(rule: ParsedRule, property: ThingModelProperty, t: RuleTranslator): RuleStepSummary[] {
  return summarizeEffects(effectsOf(rule), property, t)
}

function effectsOf(rule: ParsedRule): RuleEffects {
  const { values, range, scale, alarm, sampling, file } = rule.nodes
  const alarmRow = alarm && toDeviceAlarmRow(alarm, 'product', '')
  return {
    recordInvalid: rule.raw?.configuration?.recordInvalid === true,
    valuesEnabled: Boolean(values), valuesMode: values?.configuration.processors[0]?.provider === 'replace-value' ? 'replace' : values?.configuration.matcher.configuration.not ? 'keep' : 'ignore', values: values?.configuration.matcher.configuration.values ?? [],
    rangeEnabled: Boolean(range), min: range?.configuration.matcher.configuration.min,
    max: range?.configuration.matcher.configuration.max,
    alarmEnabled: Boolean(alarm), alarm: alarmRow ?? { name: '', trigger: 'outside', limit: {}, autoRelieve: false },
    samplingEnabled: Boolean(sampling), ...readSampling(sampling),
    scaleEnabled: Boolean(scale), scale: scale?.configuration.scale ?? '1', fileEnabled: Boolean(file),
    ...readValueRules(rule.nodes),
  }
}

export function summarizeDraft(draft: RuleDraft, property: ThingModelProperty, t: RuleTranslator): RuleStepSummary[] {
  return summarizeEffects(draft, property, t)
}

function summarizeEffects(effects: RuleEffects, property: ThingModelProperty, t: RuleTranslator): RuleStepSummary[] {
  const unit = formatPropertyUnit(property.valueType?.unit) ?? ''
  const cleaning: string[] = []
  if (effects.valuesEnabled) {
    const labels = formatValues(effects.values.slice(0, 3), property, t)
    cleaning.push(!effects.values.length ? t('PropertyRules.valuesIncomplete') : effects.valuesMode === 'replace' ? `${labels} → ${String(effects.replacementValue ?? '—')}`
      : t(effects.valuesMode === 'keep' ? effects.values.length > 3 ? 'PropertyRules.keepValuesMoreSummary' : 'PropertyRules.keepValuesSummary'
        : effects.values.length > 3 ? 'PropertyRules.valuesMoreSummary' : 'PropertyRules.valuesSummary', { values: labels, count: effects.values.length }))
  }
  if (effects.rangeEnabled) cleaning.push(`${effects.rangeAction === 'clamp' ? t('PropertyRules.clamp') + ' ' : ''}${boundsText('PropertyRules.rangeSummary', effects.min, effects.max)}`)
  if (effects.stepEnabled) cleaning.push(`${t('PropertyRules.part.step')} ≤ ${effects.maxStep}${effects.scaleEnabled ? ` ${t('PropertyRules.rawValue')}` : formatRuleDifferenceUnit(property, t)}`)
  const alarm = effects.alarmEnabled
    ? ['inside', 'outside'].includes(effects.alarm.trigger)
      ? boundsText(effects.alarm.trigger === 'outside' ? 'PropertyRules.alarmOutsideSummary' : 'PropertyRules.alarmInsideSummary', effects.alarm.limit.lower, effects.alarm.limit.upper)
      : formatTriggerText(effects.alarm, property, t)
    : t('PropertyRules.off')
  const sampling = effects.samplingEnabled
    ? samplingText(effects, isNumberProperty(property), t, formatRuleDifferenceUnit(property, t))
    : t('PropertyRules.fullRetention')
  return [
    { key: 'cleaning', icon: 'ClearOutlined', title: t('PropertyRules.cleaning'),
      text: cleaning.join(' · ') || t('PropertyRules.off'), enabled: effects.valuesEnabled || effects.rangeEnabled || Boolean(effects.stepEnabled) },
    ...(effects.scaleEnabled || effects.fallbackEnabled ? [{ key: 'processing' as const, icon: 'CalculatorOutlined', title: t('PropertyRules.stage.processing'),
      text: [effects.scaleEnabled ? `× ${effects.scale} + ${effects.offset ?? '0'}` : '', effects.fallbackEnabled ? t('PropertyRules.part.fallback') : ''].filter(Boolean).join(' · '), enabled: true }] : []),
    { key: 'alarm', icon: 'AlertOutlined', title: t('PropertyRules.alarm'), text: alarm, enabled: effects.alarmEnabled },
    { key: 'sampling', icon: 'FilterOutlined', title: t('PropertyRules.stage.sampling'), text: sampling, enabled: effects.samplingEnabled },
    ...(effects.fileEnabled ? [{ key: 'processing' as const, icon: 'FileOutlined', title: t('PropertyRules.stage.processing'), text: t('PropertyRules.part.file'), enabled: true }] : []),
  ]

  function boundsText(key: string, min?: number | null, max?: number | null) {
    if (typeof min !== 'number' || !Number.isFinite(min) || typeof max !== 'number' || !Number.isFinite(max) || min > max) {
      return t('PropertyRules.rangeIncomplete')
    }
    return t(key, { min, max, unit })
  }
}

function intervalUnitText(draft: SamplingDraft, t: RuleTranslator) {
  return t(`PropertyRules.timeUnit.${draft.intervalUnit === 60000 ? 'min' : draft.intervalUnit === 1000 ? 's' : 'ms'}`)
}
function samplingText(draft: SamplingDraft, numeric: boolean, t: RuleTranslator, differenceUnit: string) {
  if (validateSampling(draft, numeric)) return t(draft.samplingMode === 'ratio' ? 'PropertyRules.percentIncomplete' : 'PropertyRules.samplingIncomplete')
  if (draft.samplingMode === 'ratio') return t('PropertyRules.keepSummary', { percent: Number(draft.percent!.toFixed(2)) })
  if (draft.samplingMode === 'interval') return t('PropertyRules.intervalSummary', { amount: draft.interval!, unit: intervalUnitText(draft, t) })
  return t(draft.deadband === 0 ? 'PropertyRules.changeSummary' : 'PropertyRules.deadbandSummary', { amount: draft.deadband!, unit: draft.deadbandType === 'percent' ? '%' : differenceUnit })
}
