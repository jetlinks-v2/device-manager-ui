import type { ThingModelProperty } from '../../alarm/types'
import { isNumberProperty } from '../../alarm/utils'
import type { RuleDraft, RulePart } from './codec'
import { intervalMillis } from './sampling'

export interface RuleExamplePoint {
  label: string
  filtered: boolean
  alarm: boolean
  sampled: boolean
  arrival?: number
  baseline?: string
  inputLabel?: string
  stages: RuleExampleStage[]
}
export type RuleExampleValue = string | number | boolean | unknown[] | Record<string, unknown>
export interface RuleExampleInput { value: RuleExampleValue | null; arrivalMillis: number | null; missing?: boolean }
export interface FallbackExampleState { value: string | number | boolean | null; time: number; outcome: 'ready' | 'missing' | 'error' }
export interface RuleExampleStage {
  key: RulePart
  status: 'kept' | 'filtered' | 'alarm' | 'skipped' | 'processed'
  skipReason?: 'missing' | 'filled'
  baseline?: string
  value?: string
  elapsedMillis?: number
}

/** Examples belong to the floating preview, independent of the saved rule and live device state. */
export function createRuleExampleInputs(draft: RuleDraft, property: ThingModelProperty): RuleExampleInput[] {
  const numeric = isNumberProperty(property)
  const type = property.valueType?.type ?? property.type ?? property.dataType
  const elements = property.valueType?.elements
  let values: RuleExampleValue[] = numeric ? numericExamples(draft)
    : type === 'boolean' ? [true, false, true, false, true]
      : type === 'enum' && elements?.length ? Array.from({ length: 5 }, (_, i) => elements[i % elements.length].value)
        : type === 'file' ? ['SGVsbG8=', 'V29ybGQ=', 'https://example.invalid/file-3', 'VGVzdA==', 'RGF0YQ==']
          : type === 'date' ? [0, 1, 2, 3, 4].map(i => `2026-01-01T00:00:0${i}Z`)
            : type === 'array' ? [[1], [1, 2], [], [2, 3], [4]]
              : type === 'object' ? [{ value: 1 }, { value: 2 }, {}, { value: 3 }, { value: 4 }]
                : type === 'geoPoint' ? [{ lat: 30, lon: 120 }, { lat: 31, lon: 121 }, { lat: 32, lon: 122 }, { lat: 33, lon: 123 }, { lat: 34, lon: 124 }]
                  : type === 'password' || !['string', 'enum', 'boolean'].includes(String(type)) ? Array(5).fill('•••') : ['A', 'B', 'A', 'C', 'B']
  if (draft.valuesEnabled && draft.valuesMode === 'keep' && type !== 'boolean') {
    const allowed = draft.values.filter(value => !numeric || typeof value === 'number'
      && (!draft.rangeEnabled || value >= draft.min! && value <= draft.max!))
    if (allowed.length) {
      const outside = values.find(value => typeof value !== 'object' && !draft.values.includes(value))
      values = Array.from({ length: 5 }, (_, index) => index === 4 && outside !== undefined ? outside : allowed[index % allowed.length])
    }
  }
  const arrivals = [0, 0.4, 1.1, 1.2, 2.2]
  return values.map((value, index) => ({ value, arrivalMillis: arrivals[index] * intervalMillis(draft) }))
}

export function validateRuleExampleInputs(inputs: RuleExampleInput[], numeric: boolean, interval: boolean, fallback = false): string | undefined {
  if (inputs.some(input => !(fallback && (input.value === null || input.missing)) && (input.value === null || numeric && (typeof input.value !== 'number' || !Number.isFinite(input.value))))) return 'PropertyRules.diagram.invalidValue'
  if (interval && inputs.some((input, index) => input.arrivalMillis === null || !Number.isFinite(input.arrivalMillis)
    || input.arrivalMillis < 0 || index > 0 && input.arrivalMillis < inputs[index - 1].arrivalMillis!)) return 'PropertyRules.diagram.invalidArrival'
}

/** Each sample traverses the configured nodes; a dropped value never reaches later nodes. */
export function buildRuleExample(draft: RuleDraft, property: ThingModelProperty, inputs = createRuleExampleInputs(draft, property),
  initial: FallbackExampleState = { value: null, time: -1000, outcome: 'missing' }): RuleExamplePoint[] {
  const numeric = isNumberProperty(property)
  const timed = draft.samplingEnabled && (draft.samplingMode === 'interval' || draft.samplingMode === 'change' && draft.maxSilence != null) || Boolean(draft.fallbackEnabled || draft.stepEnabled)
  if (validateRuleExampleInputs(inputs, numeric, timed, Boolean(draft.fallbackEnabled))) return []
  const labelOf = (value: RuleExampleValue | null) => value === null ? '∅' : typeof value === 'object' ? JSON.stringify(value)
    : String(property.valueType?.elements?.find(item => item.value === value)?.text ?? formatExampleValue(value))
  const scores = [0.04, 0.72, 0.21, 0.34, 0.83]
  let lastArrival: number | undefined
  let baseline: RuleExampleValue | undefined
  let realBaseline: number | undefined
  let realBaselineTime = 0
  let latest = initial.value
  let latestTime = initial.time
  let latestReady = initial.outcome === 'ready'
  return inputs.map((input, index) => {
    let value = input.value
    const inputLabel = input.missing ? '∅' : labelOf(value)
    const arrival = input.arrivalMillis!
    const stages: RuleExampleStage[] = []
    const candidate = Boolean(draft.fallbackEnabled && (input.missing ? draft.fallbackMissing
      : value === null || draft.fallbackEmpty && value === ''))
    let alive = !input.missing && value !== null
    let filled = false
    function visit(key: RulePart, drop: boolean, alarm = false, skip = false) {
      stages.push({ key, status: skip || !alive ? 'skipped' : drop ? 'filtered' : alarm ? 'alarm' : 'kept',
        ...(skip ? { skipReason: filled ? 'filled' as const : 'missing' as const } : {}),
        ...(alive && (draft.scaleEnabled || draft.fileEnabled || draft.fallbackEnabled || draft.valuesMode === 'replace' || draft.rangeAction === 'clamp') ? { value: labelOf(value) } : {}) })
      if (!skip && drop) alive = false
    }
    const matches = typeof value !== 'object' && value !== null && draft.values.includes(value)
    // Raw cleaning keeps decimal/large values; only the calibration stage applies NumberType conversion.
    if (draft.valuesEnabled) {
      const replace = alive && !candidate && matches && draft.valuesMode === 'replace'
      if (replace) value = draft.replacementValue ?? null
      visit('values', draft.valuesMode === 'keep' ? !matches : draft.valuesMode === 'ignore' && matches, false, candidate)
      if (replace) stages[stages.length - 1].status = 'processed'
    }
    if (draft.rangeEnabled) {
      const outside = numeric && (Number(value) < Number(draft.min) || Number(value) > Number(draft.max))
      const clamp = outside && draft.rangeAction === 'clamp' && alive && !candidate
      if (clamp) value = Math.max(draft.min!, Math.min(draft.max!, Number(value)))
      visit('range', outside && draft.rangeAction !== 'clamp', false, candidate)
      if (clamp) stages[stages.length - 1].status = 'processed'
    }
    if (draft.stepEnabled) {
      const previous = realBaseline
      const expired = arrival - realBaselineTime >= Number(draft.baselineTtl)
      const rejected = !candidate && alive && previous !== undefined && !expired && Math.abs(Number(value) - previous) > Number(draft.maxStep)
      if (alive && !candidate && !rejected) { realBaseline = Number(value); realBaselineTime = arrival }
      visit('step', rejected, false, candidate)
      if (previous !== undefined) stages[stages.length - 1].baseline = labelOf(previous)
    }
    if (draft.scaleEnabled) {
      if (alive && !candidate) value = scaleExample(Number(value), Number(draft.scale), property, Number(draft.offset ?? 0))
      stages.push({ key: 'scale', status: alive && !candidate ? 'processed' : 'skipped',
        ...(candidate ? { skipReason: 'missing' as const } : {}),
        ...(alive && !candidate ? { value: labelOf(value) } : {}) })
    }
    if (draft.fallbackEnabled) {
      if (candidate) {
        const usePrevious = draft.fallbackMode === 'previous' && latestReady && initial.outcome !== 'error' && latest !== null
          && latestTime <= arrival && arrival - latestTime <= Number(draft.fallbackMaxAge)
        value = usePrevious ? latest : draft.fallbackValue ?? null
        alive = value !== null
        filled = alive
        stages.push({ key: 'fallback', status: alive ? 'processed' : 'filtered',
          ...(alive ? { value: labelOf(value), baseline: usePrevious ? labelOf(latest) : undefined,
            elapsedMillis: usePrevious ? arrival - latestTime : undefined } : {}) })
      } else visit('fallback', false)
    }
    const filtered = !alive
    const inside = Number(value) >= Number(draft.alarm.limit.lower) && Number(value) <= Number(draft.alarm.limit.upper)
    const alarm = alive && !filled && numeric && draft.alarmEnabled && (draft.alarm.trigger === 'inside' ? inside : !inside)
    if (draft.alarmEnabled) visit('alarm', false, alarm, filled)
    const previous = baseline
    const previousArrival = lastArrival
    let sampled = false
    if (alive && draft.samplingEnabled) {
      if (draft.samplingMode === 'ratio') sampled = scores[index % scores.length] >= Number(draft.percent) / 100
      else if (draft.samplingMode === 'interval') {
        sampled = lastArrival !== undefined && arrival - lastArrival < intervalMillis(draft)
        if (!sampled) lastArrival = arrival
      } else {
        const due = draft.maxSilence != null && lastArrival !== undefined && arrival - lastArrival >= draft.maxSilence
        sampled = previous !== undefined && !changed(previous, value!, draft) && !due
        if (!sampled) { baseline = value!; lastArrival = arrival }
      }
    }
    if (draft.samplingEnabled) {
      visit('sampling', sampled)
      if (draft.samplingMode === 'change' && previous !== undefined && !filtered) stages[stages.length - 1].baseline = labelOf(previous)
      if (draft.samplingMode === 'interval' && previousArrival !== undefined && !filtered) stages[stages.length - 1].elapsedMillis = arrival - previousArrival
      if (draft.samplingMode === 'change' && draft.maxSilence != null && previousArrival !== undefined && !filtered) stages[stages.length - 1].elapsedMillis = arrival - previousArrival
    }
    if (draft.fileEnabled) {
      const upload = alive && typeof value === 'string' && !value.slice(0, 10).includes('://')
      if (upload) value = `file://example/${index + 1}`
      stages.push({ key: 'file', status: !alive ? 'skipped' : upload ? 'processed' : 'kept', ...(alive ? { value: labelOf(value) } : {}) })
    }
    // 模拟快照只由实际发布的真实输入推进，连续补齐不能续期或成为新的上一值。
    if (alive && !filled && typeof value !== 'object' && value !== null) { latest = value; latestTime = arrival; latestReady = true }
    return { label: labelOf(value), filtered, stages, inputLabel, alarm, sampled,
      ...(timed ? { arrival: Number((arrival / draft.intervalUnit).toPrecision(5)) } : {}),
      ...(draft.samplingEnabled && draft.samplingMode === 'change' && previous !== undefined ? { baseline: labelOf(previous) } : {}) }
  })
}

function numericExamples(draft: RuleDraft) {
  if (!draft.samplingEnabled || draft.samplingMode !== 'change') {
    const low = draft.rangeEnabled ? draft.min! : draft.alarmEnabled ? draft.alarm.limit.lower! : 0
    const high = draft.rangeEnabled ? draft.max! : draft.alarmEnabled ? draft.alarm.limit.upper! : 100
    const span = high - low || Math.max(Math.abs(low) * 0.1, 1)
    const ignored = draft.valuesEnabled && draft.valuesMode === 'ignore' ? draft.values.find(value => typeof value === 'number') : undefined
    const values = [ignored ?? low - span * 0.3, ...[0.12, 0.65, 0.95, 1.3].map(factor => Number((low + span * factor).toPrecision(12)))] as number[]
    return values.every(Number.isFinite) ? values : [-999, 12, 65, 95, 130]
  }
  const preferred = draft.deadbandType === 'percent' ? 100 : 10
  const start = draft.rangeEnabled ? Math.max(draft.min!, Math.min(draft.max!, preferred)) : preferred
  if (!draft.deadband) return [start, start, start + 1, start + 1, start + 2]
  const step = draft.deadbandType === 'percent' && start ? Math.abs(start) * draft.deadband / 100 : draft.deadband
  const values = [0, 0.4, 0.8, 1, 2].map(factor => Number((start + factor * step!).toPrecision(12)))
  return values.every(Number.isFinite) ? values : [0, 0, 1, 1, 2]
}
function changed(previous: RuleExampleValue, value: RuleExampleValue, draft: RuleDraft) {
  if (previous === value) return false
  if (typeof previous !== 'number' || typeof value !== 'number') return true
  const difference = Math.abs(value - previous)
  const threshold = draft.deadbandType === 'percent' ? Math.abs(previous) * Number(draft.deadband) / 100 : Number(draft.deadband)
  // Decimal examples avoid binary rounding changing a displayed boundary decision.
  return difference > 0 && difference + Number.EPSILON * Math.max(Math.abs(value), Math.abs(previous), threshold) * 4 >= threshold
}

/** Only remove floating-point display tails; state comparisons retain the original numeric value. */
function formatExampleValue(value: RuleExampleValue) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isInteger(value)) return value
  const rounded = Number(value.toPrecision(15))
  return Math.abs(rounded - value) <= Number.EPSILON * Math.abs(value) * 4 ? rounded : value
}

/** Browser arithmetic is illustrative; the server's NumberType remains authoritative. */
function scaleExample(value: number, multiplier: number, property: ThingModelProperty, offset = 0) {
  let result = value * multiplier + offset
  const type = property.valueType?.type ?? property.type ?? property.dataType
  if (type === 'int' || type === 'long') return Math.trunc(result)
  const precision = property.valueType?.scale
  if (Number.isInteger(precision) && precision! >= 0 && precision! <= 99) result = Number(result.toFixed(precision))
  return type === 'float' ? Math.fround(result) : result
}
