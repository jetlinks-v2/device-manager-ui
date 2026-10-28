import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../alarm/types'
import { isNumberProperty } from '../../alarm/utils'
import { validateDraft, type RuleDraft } from './codec'
import { buildRuleExample, createRuleExampleInputs, validateRuleExampleInputs, type FallbackExampleState } from './diagram'
import { summarizeDraftRows } from './summary'

/** Local trial inputs live only while the diagram is mounted; edits never mutate the rule draft. */
export function useRuleExample(props: { draft: RuleDraft; property: ThingModelProperty }) {
  const { t } = useI18n()
  const inputs = ref(createRuleExampleInputs(props.draft, props.property))
  const initialFallback = (): FallbackExampleState => ({ value: isNumberProperty(props.property) ? 20
    : props.property.valueType?.type === 'boolean' ? true : props.property.valueType?.type === 'enum' ? props.property.valueType.elements?.[0]?.value ?? null : 'A', time: -1000, outcome: 'ready' })
  const fallback = ref<FallbackExampleState>(initialFallback())
  const numeric = computed(() => isNumberProperty(props.property))
  const type = computed(() => props.property.valueType?.type ?? props.property.type ?? props.property.dataType)
  const scalar = computed(() => numeric.value || ['string', 'boolean', 'enum'].includes(String(type.value)))
  const textual = computed(() => scalar.value || type.value === 'file')
  const enumOptions = computed(() => props.property.valueType?.elements?.map(element => ({ value: element.value, label: element.text ?? String(element.value) })) ?? [])
  const interval = computed(() => props.draft.samplingEnabled && (props.draft.samplingMode === 'interval' || props.draft.samplingMode === 'change' && props.draft.maxSilence != null) || Boolean(props.draft.fallbackEnabled || props.draft.stepEnabled))
  const timeUnit = computed(() => t(`PropertyRules.timeUnit.${props.draft.intervalUnit === 60000 ? 'min' : props.draft.intervalUnit === 1000 ? 's' : 'ms'}`))
  const error = computed(() => validateDraft(props.draft, numeric.value)
    ?? validateRuleExampleInputs(inputs.value, numeric.value, interval.value, Boolean(props.draft.fallbackEnabled))
    ?? (props.draft.scaleEnabled && inputs.value.some(input => input.value != null && !input.missing && !Number.isFinite(Number(input.value) * Number(props.draft.scale) + Number(props.draft.offset ?? 0))) ? 'PropertyRules.diagram.scaleOverflow' : undefined))
  const points = computed(() => error.value ? [] : buildRuleExample(props.draft, props.property, inputs.value, fallback.value))
  const rows = computed(() => error.value ? [] : summarizeDraftRows(props.draft, props.property, t))
  function reset() { inputs.value = createRuleExampleInputs(props.draft, props.property); fallback.value = initialFallback() }
  function setInputState(index: number, mode: 'null' | 'missing' | 'real') {
    inputs.value[index].missing = mode === 'missing'
    if (mode === 'null') inputs.value[index].value = null
    if (mode === 'real') inputs.value[index].value = createRuleExampleInputs(props.draft, props.property)[index].value
  }
  function setArrival(index: number, value: number | string | null) {
    inputs.value[index].arrivalMillis = value === null || value === '' ? null : Number(value) * props.draft.intervalUnit
  }
  const displayInput = (value: unknown) => typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  return { inputs, fallback, numeric, type, scalar, textual, enumOptions, interval, timeUnit, error, points, rows, reset, setArrival, setInputState, displayInput }
}
