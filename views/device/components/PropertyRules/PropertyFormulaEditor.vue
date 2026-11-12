<template>
  <div class="property-formula">
    <MathExpressionEditor v-if="editing" :model-value="pending" :context="context" :disabled="disabled" autofocus @update:model-value="update" @invalid="check">
      <template #view-tools="{finish}"><a-button type="text" size="small" :title="$t('DeviceAlarm.action.cancel')" :aria-label="$t('DeviceAlarm.action.cancel')" @click="cancel"><AIcon type="CloseOutlined" /></a-button><a-button type="text" size="small" :disabled="invalid" :title="$t('PropertyRules.correction.done')" :aria-label="$t('PropertyRules.correction.done')" @click="done(finish)"><AIcon type="CheckOutlined" /></a-button></template>
    </MathExpressionEditor>
    <button v-else type="button" class="property-formula__preview" :disabled="disabled" :aria-label="$t('PropertyRules.correction.edit')" @click="start">
      <PropertyFormulaView :expression="modelValue" :property="property" :context="context" />
      <AIcon type="EditOutlined" class="property-formula__edit" />
    </button>
    <a-button v-if="error && editing" type="text" size="small" @click="refresh">{{ $t('PropertyRules.correction.functionsRetry') }}</a-button>
  </div>
</template>
<script setup lang="ts">
import { watch } from 'vue'
import { MathExpressionEditor,type StructuredExpression } from '@jetlinks-web-core/components/Expression'
import PropertyFormulaView from './PropertyFormulaView.vue'
import { usePropertyExpression } from './usePropertyExpression'
import { usePropertyFormulaEdit } from './usePropertyFormulaEdit'
import type { ThingModelProperty } from '../../alarm/types'
const props=defineProps<{modelValue:StructuredExpression;property:ThingModelProperty;disabled?:boolean;autofocus?:boolean}>()
const emit=defineEmits<{(event:'update:modelValue',value:StructuredExpression):void;(event:'invalid',value:boolean):void;(event:'editing',value:boolean):void;(event:'dirty',value:boolean):void}>()
const {editing,invalid,pending,start,update,check,done,cancel}=usePropertyFormulaEdit(()=>props.modelValue,{change:value=>emit('update:modelValue',value),invalid:value=>emit('invalid',value),editing:value=>emit('editing',value),dirty:value=>emit('dirty',value)})
const {context,error,refresh}=usePropertyExpression(()=>props.property,()=>Boolean(props.disabled))
watch(()=>props.autofocus,value=>{if(value && !props.disabled)start()},{immediate:true})
</script>
<style scoped>
.property-formula { width:100%; min-width:0 }
.property-formula__preview { display:flex; align-items:center; gap:8px; width:100%; min-width:0; padding:2px 6px; border:0; border-radius:3px; background:var(--bg-sunken,#f5f5f5); color:inherit; text-align:start; cursor:pointer; font:inherit }
.property-formula__preview:hover:not(:disabled),.property-formula__preview:focus-visible { background:var(--jet-theme-primary-soft,#e6f4ff); outline:1px solid var(--jet-theme-primary,#1677ff) }
.property-formula__preview:disabled { cursor:default }
.property-formula__preview :deep(.expression-math-shell) { flex:1; min-width:0 }
.property-formula__edit { flex:none; color:var(--jet-theme-text-secondary,#8c8c8c) }
</style>
