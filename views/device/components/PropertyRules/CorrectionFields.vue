<template>
  <div class="correction-fields">
    <div v-if="mode === 'simple'" class="correction-controls">
      <span class="correction-value" :title="$t('PropertyRules.correction.valueHint')">{{ grouped ? '(' : '' }}{{ $t('PropertyRules.correction.value') }}</span>
      <span v-for="(step,index) in steps" :key="index" class="correction-operation">
      <a-select :value="step.operator" class="correction-operator" size="small" :bordered="false" :disabled="disabled" :dropdown-match-select-width="false" option-label-prop="label" :aria-label="$t('PropertyRules.correction.operator') + ' ' + (index+1)" @change="changeOperator(index,$event)">
        <a-select-option v-for="option in operators" :key="option.value" :value="option.value" :label="option.symbol" :title="option.description"><RuleMenuOption compact :icon="option.icon" :title="option.label" :description="option.description" /></a-select-option>
      </a-select>
      <a-input-number :value="step.value ?? undefined" string-mode size="small" :controls="false" :disabled="disabled" :aria-label="$t('PropertyRules.correction.constant') + ' ' + (index+1)" @update:value="update(index,{value:$event == null ? null : String($event)})" />
      <span v-if="grouped && index === 0">)</span>
      </span>
    </div>
    <PropertyFormulaEditor v-else :model-value="correctionTree(draft)" :property="property" :disabled="disabled" :autofocus="autofocus" @update:model-value="updateFormula" @invalid="draft.correctionInvalid=$event" @dirty="draft.correctionPending=$event" @editing="$emit('editing',$event)" />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StructuredExpression } from '@jetlinks-web-core/components/Expression'
import RuleMenuOption from './RuleMenuOption.vue'
import type { ThingModelProperty } from '../../alarm/types'
import type { RuleDraft } from './codec'
import { correctionTree,readCorrectionSteps,legacyCorrectionSteps,buildCorrectionSteps,correctionIsFormula,type CorrectionStep,type CorrectionSteps } from './correction'
import PropertyFormulaEditor from './PropertyFormulaEditor.vue'
const props=defineProps<{draft:RuleDraft;property:ThingModelProperty;disabled?:boolean;autofocus?:boolean}>()
defineEmits<{(event:'editing',value:boolean):void}>()
const {t}=useI18n()
const mode=computed(()=>correctionIsFormula(props.draft) ? 'formula' : 'simple')
const steps=computed(()=>props.draft.correctionSteps ?? (props.draft.correction && readCorrectionSteps(props.draft.correction)) ?? legacyCorrectionSteps(props.draft))
const grouped=computed(()=>['add','subtract'].includes(steps.value[0].operator) && ['multiply','divide'].includes(steps.value[1].operator))
const operators=computed(()=>([
  {value:'add',symbol:'＋',icon:'PlusOutlined',key:'add'},
  {value:'subtract',symbol:'−',icon:'MinusOutlined',key:'subtract'},
  {value:'multiply',symbol:'×',icon:'CloseOutlined',key:'multiply'},
  {value:'divide',symbol:'÷',icon:'PercentageOutlined',key:'divide'},
] as const).map(item=>({...item,label:t('PropertyRules.correction.'+item.key),description:t('PropertyRules.correction.'+item.key+'Hint')})))
function changeOperator(index:number,value:unknown){const option=operators.value.find(item=>item.value === value);if(option)update(index,{operator:option.value})}
function update(index:number,change:Partial<CorrectionStep>) {
  const next=steps.value.map((step,i)=>i === index ? {...step,...change} : {...step}) as CorrectionSteps,tree=buildCorrectionSteps(next)
  props.draft.correctionSteps=next
  props.draft.correction=tree || correctionTree(props.draft)
  props.draft.correctionMode='simple';props.draft.correctionInvalid=!tree
}
function updateFormula(value:StructuredExpression){props.draft.correction=value;props.draft.correctionSteps=undefined;props.draft.correctionInvalid=false}
</script>
<style scoped>
.correction-fields { min-width:0; flex:1; max-width:100% }
.correction-controls { display:flex; align-items:center; flex-wrap:wrap; gap:4px 6px }
.correction-value { color:var(--jet-theme-text-secondary); font-size:12px }
.correction-operation { display:inline-flex; align-items:center; gap:4px; white-space:nowrap }
.correction-controls :deep(.correction-operator.ant-select-single) { width:36px; min-width:36px }
.correction-operator :deep(.ant-select-selector) { padding-inline:4px !important }
.correction-operator :deep(.ant-select-selection-item) { font-size:15px; padding-inline-end:9px !important }
.correction-operator :deep(.ant-select-arrow) { right:2px; font-size:8px }
.correction-controls :deep(.ant-input-number) { width:64px }
</style>
