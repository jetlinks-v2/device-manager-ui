import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { evaluateExpression } from '@jetlinks-web-core/api/expression'
import { expressionReferences } from '@jetlinks-web-core/components/Expression'
import { correctionReferences,correctionTree } from './correction'
import type { ThingModelProperty } from '../../alarm/types'
import { isNumberProperty } from '../../alarm/utils'
import { validateDraft, type RuleDraft } from './codec'
import { buildRuleExample, buildRuleExampleAsync, createRuleExampleInputs, validateRuleExampleInputs, type FallbackExampleState, type RuleExamplePoint } from './diagram'
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
  const interval = computed(() => props.draft.samplingEnabled && (props.draft.samplingMode === 'interval' || props.draft.samplingMode === 'change' && props.draft.maxSilence != null) || Boolean(props.draft.fallbackEnabled || props.draft.stepEnabled))
  const timeUnit = computed(() => t(`PropertyRules.timeUnit.${props.draft.intervalUnit === 60000 ? 'min' : props.draft.intervalUnit === 1000 ? 's' : 'ms'}`))
  const error = computed(() => validateDraft(props.draft, numeric.value, props.property)
    ?? validateRuleExampleInputs(inputs.value, numeric.value, interval.value, Boolean(props.draft.fallbackEnabled)))
  const samples=reactive<Record<string,string|number|null>>({})
  const references=computed(()=> {
    const ids=new Set(expressionReferences(correctionTree(props.draft).root).map(item=>item.id))
    return props.draft.scaleEnabled ? correctionReferences.filter(item=>item.id !== 'value' && ids.has(item.id)) : []
  })
  const needsSamples=computed(()=>references.value.some(item=>!(item.id in samples)))
  const remotePoints=shallowRef<RuleExamplePoint[]>([]),loading=ref(false),failure=ref('')
  let revision=0,timer:ReturnType<typeof setTimeout>|undefined,disposed=false
  const points=computed(()=>error.value || loading.value || failure.value || needsSamples.value ? [] : props.draft.scaleEnabled
    ? remotePoints.value : buildRuleExample(props.draft,props.property,inputs.value,fallback.value))
  // Keep one column per input while awaiting the backend; an empty slot is never a computed result.
  const columns=computed(()=>inputs.value.map((_,index)=>points.value[index] as RuleExamplePoint|undefined))
  async function run() {
    clearTimeout(timer)
    const current=++revision
    remotePoints.value=[];failure.value=''
    if(error.value || !props.draft.scaleEnabled || needsSamples.value){loading.value=false;return}
    loading.value=true
    // Freeze one preview revision; an edit or disposal prevents later samples and stale publication.
    const snapshot=JSON.parse(JSON.stringify({draft:props.draft,property:props.property,inputs:inputs.value,fallback:fallback.value,samples}))
    const variableTypes=Object.fromEntries(correctionReferences.map(item=>[item.id,item.type]))
    try {
      const result=await buildRuleExampleAsync(snapshot.draft,snapshot.property,snapshot.inputs,snapshot.fallback,async input=>{
        if(disposed || current !== revision)throw new Error('Preview replaced')
        const response=await evaluateExpression({expression:correctionTree(snapshot.draft),variables:{...snapshot.samples,value:String(input.value)},
          variableTypes,numeric:true,resultType:{...snapshot.property.valueType,type:propertyType(snapshot.property)}})
        if(response.error)throw new Error(response.error)
        const value=Number(response.value)
        if(response.value == null || !Number.isFinite(value))throw new Error('Invalid numeric result')
        return {value,label:String(response.value),explanation:response.explanation}
      })
      if(current === revision)remotePoints.value=result
    } catch(error) {if(current === revision)failure.value=error instanceof Error ? error.message : String(error)}
    finally {if(current === revision)loading.value=false}
  }
  watch(()=>[props.draft,props.property,inputs.value,fallback.value,samples],()=>{
    revision++;clearTimeout(timer);remotePoints.value=[];failure.value='';loading.value=false
    if(props.draft.scaleEnabled && !error.value && !needsSamples.value){loading.value=true;timer=setTimeout(()=>void run(),350)}
  },{deep:true,immediate:true,flush:'sync'})
  onBeforeUnmount(()=>{disposed=true;revision++;clearTimeout(timer)})
  const rows = computed(() => summarizeDraftRows(props.draft, props.property, t))
  function reset() { Object.keys(samples).forEach(key=>delete samples[key]); inputs.value = createRuleExampleInputs(props.draft, props.property); fallback.value = initialFallback() }
  function setInputState(index: number, mode: 'null' | 'missing' | 'real') {
    inputs.value[index].missing = mode === 'missing'
    if (mode === 'null') inputs.value[index].value = null
    if (mode === 'real') inputs.value[index].value = createRuleExampleInputs(props.draft, props.property)[index].value
  }
  function setArrival(index: number, value: number | string | null) {
    inputs.value[index].arrivalMillis = value === null || value === '' ? null : Number(value) * props.draft.intervalUnit
  }
  const displayInput = (value: unknown) => typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  return { inputs, fallback, numeric, type, scalar, textual, interval, timeUnit, error, references, samples, needsSamples, loading, failure, run, points, columns, rows, reset, setArrival, setInputState, displayInput }
}

function propertyType(property:ThingModelProperty){return property.valueType?.type ?? property.type ?? property.dataType}
