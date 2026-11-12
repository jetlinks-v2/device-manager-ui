import type { ExpressionExplanation } from '@jetlinks-web-core/components/Expression'
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
  error?: string
}
export type RuleExampleValue = string | number | boolean | unknown[] | Record<string, unknown>
export interface RuleExampleInput { value: RuleExampleValue | null; arrivalMillis: number | null; missing?: boolean }
export interface FallbackExampleState { value: string | number | boolean | null; time: number; outcome: 'ready' | 'missing' | 'error' }
export interface RuleExampleStage {
  key: RulePart
  status: 'kept' | 'filtered' | 'alarm' | 'skipped' | 'processed' | 'recovered' | 'error'
  error?: string
  intent?: boolean
  skipReason?: 'missing' | 'filled'
  recordInvalid?: boolean
  baseline?: string
  value?: string
  elapsedMillis?: number
  explanation?: ExpressionExplanation
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
  if (inputs.some(input => !(fallback && (input.value === null || input.missing)) && (input.value === null || numeric && !validNumericInput(input.value)))) return 'PropertyRules.diagram.invalidValue'
  if (interval && inputs.some((input, index) => input.arrivalMillis === null || !Number.isFinite(input.arrivalMillis)
    || input.arrivalMillis < 0 || index > 0 && input.arrivalMillis < inputs[index - 1].arrivalMillis!)) return 'PropertyRules.diagram.invalidArrival'
}

/** Decimal text stays intact until backend metadata conversion, including long and high precision values. */
function validNumericInput(value: unknown) {
  return typeof value === 'number' ? Number.isFinite(value)
    : typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)
}

function numericExamples(draft: RuleDraft) {
  if (!draft.samplingEnabled || draft.samplingMode !== 'change') {
    const threshold = typeof draft.alarm.value === 'number' ? draft.alarm.value : undefined
    const low = draft.rangeEnabled ? draft.min! : draft.alarmEnabled ? draft.alarm.limit.lower ?? (threshold == null ? 0 : threshold - Math.max(Math.abs(threshold) * 0.2, 1)) : 0
    const high = draft.rangeEnabled ? draft.max! : draft.alarmEnabled ? draft.alarm.limit.upper ?? (threshold == null ? 100 : threshold + Math.max(Math.abs(threshold) * 0.2, 1)) : 100
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
