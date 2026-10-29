import type { DeviceAlarmFormModel, ThingModelProperty, ThingPropertyPreprocess } from '../../alarm/types'
import { buildPreprocessPayload, hasAlarmRelieveProcessor, isNumberProperty } from '../../alarm/utils'
import { isAlarmProperty, readCondition, validateAlarmConditions } from '../../alarm/conditions'
import { buildSampling, isSamplingNode, validateSampling, type SamplingDraft } from './sampling'
import { buildFallback, scalarValue, validFallback, type ValueRuleDraft } from './values/config'

export interface RuleNode {
  provider: string
  configuration: Record<string, any>
  [key: string]: unknown
}
export type RulePart = 'values' | 'range' | 'step' | 'scale' | 'fallback' | 'alarm' | 'sampling' | 'file'
export type RuleAddPart = RulePart | 'interval' | 'change'
export interface ParsedRule {
  editable: boolean
  nodes: Partial<Record<RulePart, RuleNode>>
  raw?: ThingPropertyPreprocess
  providers: string[]
}
export interface RuleDraft extends SamplingDraft, ValueRuleDraft {
  valuesEnabled: boolean
  valuesMode: 'ignore' | 'keep' | 'replace'
  values: Array<string | number | boolean>
  rangeEnabled: boolean
  min?: number
  max?: number
  alarmEnabled: boolean
  alarm: DeviceAlarmFormModel
  samplingEnabled: boolean
  scaleEnabled: boolean
  scale: string | null
  fileEnabled: boolean
}

const order: RulePart[] = ['values', 'range', 'step', 'scale', 'fallback', 'alarm', 'sampling', 'file']

/** Keep decimal strings intact when configuring the existing BigDecimal multiplier. */
export const validScale = (value: unknown): value is string => typeof value === 'string'
  && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))

/** Both the list and editor offer only missing rules applicable to the current property type. */
export function availableRuleParts(property: ThingModelProperty, configured: Partial<Record<RulePart, unknown>>, alarmAvailable: boolean): RuleAddPart[] {
  const numeric = isNumberProperty(property)
  const type = property.valueType?.type ?? property.type ?? property.dataType
  const parts: RuleAddPart[] = order.filter(part => !configured[part] && (part === 'sampling'
    || part === 'values' && (numeric || ['string', 'boolean', 'enum'].includes(String(type)))
    || part === 'fallback' && (numeric || ['string', 'boolean', 'enum'].includes(String(type)))
    || (part === 'range' || part === 'step' || part === 'scale') && numeric || part === 'alarm' && isAlarmProperty(property) && alarmAvailable
    || part === 'file' && type === 'file' && property.valueType?.bodyType === 'base64'))
  if (!configured.sampling) {
    parts.push('interval')
    if (numeric || ['string', 'boolean', 'enum'].includes(String(type))) parts.push('change')
  }
  return parts
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const isNode = (value: unknown): value is RuleNode => Boolean(value && typeof value === 'object'
  && typeof (value as RuleNode).provider === 'string' && (value as RuleNode).configuration
  && typeof (value as RuleNode).configuration === 'object' && !Array.isArray((value as RuleNode).configuration))

function classify(node: RuleNode): RulePart | undefined {
  const config = node.configuration
  if (hasAlarmRelieveProcessor(node)) return 'alarm'
  if (isSamplingNode(node)) return 'sampling'
  if (['scale', 'calibration'].includes(node.provider) && validScale(config.scale) && (config.offset === undefined || validScale(config.offset))) return 'scale'
  if (node.provider === 'fallback' && validFallback(config)) return 'fallback'
  if (node.provider === 'max-step' && validStep(config)) return 'step'
  if (node.provider === 'file-storage') return 'file'
  if (node.provider !== 'simple' || !isNode(config.matcher) || !Array.isArray(config.processors)) return
  const actions: RuleNode[] = config.processors
  if (!actions.every(isNode)) return
  const matcher = config.matcher
  if (actions.length === 1 && (actions[0].provider === 'ignore' || actions[0].provider === 'replace-value' && scalarValue(actions[0].configuration.value)
    || actions[0].provider === 'clamp' && validRange(actions[0].configuration))) {
    if (matcher.provider === 'value-set' && (matcher.configuration.not === undefined || typeof matcher.configuration.not === 'boolean')
      && Array.isArray(matcher.configuration.values)
      && matcher.configuration.values.length > 0
      && matcher.configuration.values.every(isScalar) && actions[0].provider !== 'clamp'
      && (actions[0].provider !== 'replace-value' || matcher.configuration.not !== true)) return 'values'
    if (matcher.provider === 'number-range' && matcher.configuration.not === true && validRange(matcher.configuration)
      && (actions[0].provider === 'ignore' || actions[0].provider === 'clamp'
        && actions[0].configuration.min === matcher.configuration.min && actions[0].configuration.max === matcher.configuration.max)) return 'range'
  }
  if (readCondition(matcher)
    && actions.filter((item) => item.provider === 'device-alarm').length === 1
    && actions.filter((item) => item.provider === 'notify').length <= 1
    && actions.every((item) => ['device-alarm', 'device-record', 'notify'].includes(item.provider))) return 'alarm'
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}
function validRange(config: Record<string, unknown>) {
  return typeof config.min === 'number' && Number.isFinite(config.min)
    && typeof config.max === 'number' && Number.isFinite(config.max) && config.min <= config.max
}

function validStep(config: Record<string, unknown>) {
  return typeof config.maxStep === 'number' && Number.isFinite(config.maxStep) && config.maxStep > 0
    && typeof config.baselineTtlMillis === 'number' && Number.isSafeInteger(config.baselineTtlMillis)
    && config.baselineTtlMillis > 0 && config.baselineTtlMillis <= 9_223_372_036_854
}

/** Only the fixed, losslessly editable sequence is exposed as controls. Other chains stay read-only. */
export function parseRule(raw?: ThingPropertyPreprocess): ParsedRule {
  const result: ParsedRule = { editable: true, nodes: {}, raw, providers: [] }
  if (!raw) return result
  if (!isNode(raw)) return { ...result, editable: false }
  const children = raw.provider === 'composite' && !hasAlarmRelieveProcessor(raw) ? raw.configuration.processors : [raw]
  if (!Array.isArray(children)) return { ...result, editable: false }
  let last = -1
  for (const node of children) {
    if (!isNode(node)) { result.editable = false; continue }
    result.providers.push(node.provider)
    const part = classify(node)
    if (!part || result.nodes[part] || order.indexOf(part) < last) {
      result.editable = false
      continue
    }
    result.nodes[part] = node
    last = order.indexOf(part)
  }
  // The file chain samples before uploading; mixed scalar/file chains are never silently rewritten.
  if (result.nodes.file && ['values', 'range', 'step', 'scale', 'fallback', 'alarm'].some(part => result.nodes[part as RulePart])) result.editable = false
  return result
}

function updateNode(previous: RuleNode | undefined, next: RuleNode): RuleNode {
  return { ...previous, ...next, configuration: { ...previous?.configuration, ...next.configuration } }
}

/** Preserve extensions and existing action order, including alarm history identity and record actions. */
function updateAlarm(previous: RuleNode | undefined, form: DeviceAlarmFormModel): RuleNode {
  const next: RuleNode = buildPreprocessPayload(form)
  const previousBranches: RuleNode[] = previous?.provider === 'composite' ? previous.configuration.processors : previous ? [previous] : []
  const nextBranches: RuleNode[] = next.provider === 'composite' ? next.configuration.processors : [next]
  // 自动解除与告警是同一个编辑单元，保持各自 matcher、历史身份及扩展参数。
  const processors = nextBranches.map(branch => {
    const action = branch.configuration.processors.some((item: RuleNode) => item.provider === 'device-alarm')
      ? 'device-alarm' : 'device-alarm-relieve'
    const old = previousBranches.find(item => item.configuration.processors.some((child: RuleNode) => child.provider === action))
    return updateAlarmBranch(old, branch)
  })
  return next.provider === 'composite'
    ? updateNode(previous?.provider === 'composite' ? previous : undefined, { ...next, configuration: { ...next.configuration, processors } })
    : processors[0]
}

function updateAlarmBranch(previous: RuleNode | undefined, next: RuleNode): RuleNode {
  if (!previous) return next
  // 只保留扩展字段，清除旧条件专属参数；避免切换运算符后出现多个真值源。
  const oldMatcher = clone(previous.configuration.matcher) as RuleNode
  for (const key of ['min', 'max', 'not', 'operator', 'value', 'values']) delete oldMatcher.configuration[key]
  const matcher = updateNode(oldMatcher, next.configuration.matcher)
  const replacements = new Map<string, RuleNode>((next.configuration.processors as RuleNode[]).map(node => [node.provider, node]))
  const processors: RuleNode[] = []
  for (const node of previous.configuration.processors as RuleNode[]) {
    if (node.provider === 'device-record') { processors.push(clone(node)); continue }
    const replacement = replacements.get(node.provider)
    if (replacement) { processors.push(updateNode(node, replacement)); replacements.delete(node.provider) }
  }
  processors.push(...replacements.values())
  return updateNode(previous, { ...next, configuration: { matcher, processors } })
}

function packRule(parsed: ParsedRule, nodes: Partial<Record<RulePart, RuleNode>>): ThingPropertyPreprocess {
  if (!parsed.editable) throw new Error('PropertyRules.readonly')
  const processors = order.flatMap((part) => nodes[part] ? [nodes[part]!] : [])
  const raw = clone(parsed.raw ?? {})
  // A legacy single step is wrapped only when the user explicitly saves it.
  return {
    ...raw,
    provider: 'composite',
    configuration: { ...(raw.provider === 'composite' ? raw.configuration : {}), processors },
  }
}

export function buildRule(parsed: ParsedRule, draft: RuleDraft): ThingPropertyPreprocess {
  const nodes: ParsedRule['nodes'] = {}
  if (draft.valuesEnabled) {
    const previous = parsed.nodes.values
    nodes.values = updateNode(previous, { provider: 'simple', configuration: {
      matcher: updateNode(previous?.configuration.matcher, { provider: 'value-set', configuration: { values: clone(draft.values), not: draft.valuesMode === 'keep' } }),
      processors: [updateNode(previous?.configuration.processors[0], draft.valuesMode === 'replace'
        ? { provider: 'replace-value', configuration: { value: draft.replacementValue } }
        : { provider: 'ignore', configuration: {} })],
    } })
  }
  if (draft.rangeEnabled) {
    const previous = parsed.nodes.range
    nodes.range = updateNode(previous, { provider: 'simple', configuration: {
      matcher: updateNode(previous?.configuration.matcher, { provider: 'number-range', configuration: { min: draft.min, max: draft.max, not: true } }),
      processors: [updateNode(previous?.configuration.processors[0], draft.rangeAction === 'clamp'
        ? { provider: 'clamp', configuration: { min: draft.min, max: draft.max } }
        : { provider: 'ignore', configuration: {} })],
    } })
  }
  if (draft.stepEnabled) nodes.step = updateNode(parsed.nodes.step, { provider: 'max-step', configuration: { maxStep: draft.maxStep, baselineTtlMillis: draft.baselineTtl } })
  if (draft.scaleEnabled) nodes.scale = updateNode(parsed.nodes.scale, {
    provider: draft.offset && !/^[+-]?0*(?:\.0*)?(?:[eE][+-]?\d+)?$/.test(draft.offset) ? 'calibration' : 'scale',
    configuration: { scale: draft.scale, ...(draft.offset !== undefined ? { offset: draft.offset } : {}) },
  })
  if (draft.fallbackEnabled) nodes.fallback = buildFallback(draft, parsed.nodes.fallback)
  if (draft.alarmEnabled) nodes.alarm = updateAlarm(parsed.nodes.alarm, draft.alarm)
  if (draft.samplingEnabled) nodes.sampling = buildSampling(draft, parsed.nodes.sampling)
  if (draft.fileEnabled) nodes.file = updateNode(parsed.nodes.file, { provider: 'file-storage', configuration: {} })
  return packRule(parsed, nodes)
}

/** All alarm entry points update the full property configuration through the same codec. */
export function replaceAlarm(raw: ThingPropertyPreprocess | undefined, form?: DeviceAlarmFormModel) {
  const parsed = parseRule(raw)
  const nodes = { ...parsed.nodes }
  if (form) nodes.alarm = updateAlarm(nodes.alarm, form)
  else delete nodes.alarm
  return packRule(parsed, nodes)
}

export const isEmptyRule = (raw: ThingPropertyPreprocess) => raw.provider === 'composite'
  && Array.isArray(raw.configuration?.processors) && raw.configuration.processors.length === 0

export function validateDraft(draft: RuleDraft, numeric: boolean, property?: ThingModelProperty): string | undefined {
  if (draft.valuesEnabled && (!['ignore', 'keep', 'replace'].includes(draft.valuesMode) || !draft.values.length || !draft.values.every(isScalar)
    || (numeric && draft.values.some((value) => typeof value !== 'number')))) return 'PropertyRules.validation.values'
  if (draft.valuesEnabled && draft.valuesMode === 'replace' && (!scalarValue(draft.replacementValue)
    || numeric && typeof draft.replacementValue !== 'number')) return 'PropertyRules.validation.replacement'
  if (draft.rangeEnabled && (!numeric || !validRange({ min: draft.min, max: draft.max }))) return 'PropertyRules.validation.range'
  if (draft.stepEnabled && (!numeric || !validStep({ maxStep: draft.maxStep, baselineTtlMillis: draft.baselineTtl }))) return 'PropertyRules.validation.step'
  if (draft.scaleEnabled && (!numeric || !validScale(draft.scale) || draft.offset !== undefined && !validScale(draft.offset))) return 'PropertyRules.validation.scale'
  if (draft.fallbackEnabled && (!validFallback(buildFallback(draft).configuration)
    || numeric && draft.fallbackValue != null && typeof draft.fallbackValue !== 'number')) return 'PropertyRules.validation.fallback'
  if (draft.fileEnabled && (numeric || draft.valuesEnabled || draft.rangeEnabled || draft.stepEnabled || draft.scaleEnabled || draft.fallbackEnabled || draft.alarmEnabled)) return 'PropertyRules.validation.file'
  if (draft.alarmEnabled) {
    if (!draft.alarm.name.trim()) return 'DeviceAlarm.validation.name'
    const error = validateAlarmConditions(draft.alarm, property)
    if (error) return error
  }
  if (draft.samplingEnabled) return validateSampling(draft, numeric)
}
