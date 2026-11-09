<template>
  <div v-if="state.selected.value" class="business-options">
    <template v-if="state.selected.value.kind === 'businessEvent'">
      <label>{{ t('businessValue') }}<a-select v-model:value="state.valuePath.value" :options="state.fields.value.map(item=>({...item,label:item.value === '$' ? t('businessWholeEvent') : item.label}))" /></label>
      <p>{{ t('businessSubscribeOnly') }}</p>
    </template>
    <template v-else>
      <div v-for="parameter in state.selected.value.command?.inputs || []" :key="parameter.id" class="business-options__parameter">
        <span>{{ parameter.name || parameter.id }}</span>
        <a-select :value="state.parameterModes.value[parameter.id] || 'constant'" :options="modes.filter(mode=>mode.value === 'constant' || !Object.entries(state.parameterModes.value).some(([id,value])=>id !== parameter.id && value === mode.value))" @change="state.parameterModes.value[parameter.id] = String($event)" />
        <MetricParameterValue v-if="!state.parameterModes.value[parameter.id] || state.parameterModes.value[parameter.id] === 'constant'" :parameter="{...parameter,valueType:{type:'string',...parameter.valueType}}" :model-value="state.parameters.value[parameter.id]" @update:model-value="state.parameters.value = {...state.parameters.value,[parameter.id]:$event}" />
      </div>
      <label>{{ t('businessUpdates') }}<a-select v-model:value="state.updateEvent.value" allow-clear :options="state.events.value.map(item=>({value:item.id,label:item.name || item.id}))" /></label>
      <p>{{ t(state.updateEvent.value ? 'businessReadOnUpdate' : 'businessCurrentOnly') }}</p>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MetricParameterValue } from '@jetlinks-web-core/components'
import { metricHostMessages } from '../messages'
import type { BusinessSourcesState } from './useBusinessSources'
defineProps<{state:BusinessSourcesState}>()
const {t}=useI18n({useScope:'local',messages:metricHostMessages})
const modes=computed(()=>['constant','objectIdParameter','cutoffParameter','occurrenceParameter'].map(value=>({value,label:t(`businessParam_${value}`)})))
</script>
<style scoped>
.business-options,.business-options label,.business-options__parameter { display:grid; gap:6px; min-width:0 }
.business-options { gap:12px; font-size:12px }
.business-options p { margin:0; line-height:1.6; color:var(--ink-3) }
.business-options__parameter { padding-block:8px; border-bottom:1px solid var(--line) }
</style>
