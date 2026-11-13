<template>
  <div class="rule-diagram" role="group" :aria-label="$t('PropertyRules.diagram.description')">
    <div class="diagram-heading">
      <span>{{ $t('PropertyRules.diagram.title') }}</span>
      <span class="diagram-heading-status" :role="example.failure ? 'alert' : 'status'">
        <span v-if="example.error" :title="$t(example.error)">{{ $t(example.error) }}</span>
        <span v-else-if="example.needsSamples" :title="$t('PropertyRules.diagram.contextRequired')">{{ $t('PropertyRules.diagram.contextRequired') }}</span>
        <template v-else-if="example.failure"><AIcon type="ExclamationCircleOutlined" /><span :title="example.failure">{{ $t('PropertyRules.diagram.failed') }}</span><a-button type="text" size="small" @click="example.run"><AIcon type="ReloadOutlined" /></a-button></template>
      </span>
      <span><a-button type="text" size="small" :aria-label="$t('PropertyRules.diagram.reset')" @click="example.reset"><AIcon type="ReloadOutlined" /></a-button><a-button type="text" size="small" :aria-label="$t('PropertyRules.diagram.close')" @click="$emit('close')"><AIcon type="CloseOutlined" /></a-button></span>
    </div>
    <div class="diagram-content" :aria-busy="example.loading">
      <div v-if="draft.fallbackEnabled && draft.fallbackMode === 'previous'" class="diagram-fallback-settings">
        <span>{{ $t('PropertyRules.fallback.reference') }}</span>
        <ValueInput v-model:value="example.fallback.value" string-mode :property="property" :label="$t('PropertyRules.fallback.reference')" :get-popup-container="popupContainer" />
        <a-input-number :value="-example.fallback.time / 1000" :min="0" size="small" :controls="false" :aria-label="$t('PropertyRules.fallback.age')" @update:value="example.fallback.time = -Number($event) * 1000" /><span>{{ $t('PropertyRules.fallback.secondsAgo') }}</span>
        <a-select v-model:value="example.fallback.outcome" size="small" :options="fallbackOutcomes" :get-popup-container="popupContainer" :aria-label="$t('PropertyRules.fallback.lookup')" />
      </div>
      <div v-if="example.references.length" class="diagram-context">
        <span class="diagram-note">{{ $t('PropertyRules.diagram.context') }}</span>
        <label v-for="item in example.references" :key="item.id" :title="$t('PropertyRules.correction.'+item.id+'Hint')">
          <span>{{ $t('PropertyRules.correction.'+item.id) }}</span>
          <a-input-number v-if="item.type === 'long'" :value="example.samples[item.id] ?? undefined" size="small" string-mode :controls="false" :placeholder="$t('PropertyRules.diagram.simulated')" @update:value="example.samples[item.id]=$event" />
          <a-input v-else :value="example.samples[item.id] ?? undefined" size="small" :placeholder="$t('PropertyRules.diagram.simulated')" @update:value="example.samples[item.id]=$event" />
        </label>
      </div>
      <div class="diagram-row diagram-input-row">
        <span class="diagram-label"><span class="diagram-label-caption"><AIcon type="ImportOutlined" />{{ $t('PropertyRules.diagram.input') }}</span><small v-if="example.textual">{{ $t('PropertyRules.diagram.editHint') }}</small></span>
        <div v-for="(input, index) in example.inputs" :key="index" class="diagram-input" :class="{ 'diagram-input-missing': input.missing }">
          <a-dropdown v-if="draft.fallbackEnabled" :trigger="['click']" :get-popup-container="popupContainer"><a-button type="text" size="small" :aria-label="$t('PropertyRules.fallback.inputState')"><AIcon :type="input.missing ? 'MinusCircleOutlined' : input.value === null ? 'StopOutlined' : 'EditOutlined'" /></a-button><template #overlay><a-menu><a-menu-item @click="example.setInputState(index, 'null')">{{ $t('PropertyRules.fallback.null') }}</a-menu-item><a-menu-item @click="example.setInputState(index, 'missing')">{{ $t('PropertyRules.fallback.missing') }}</a-menu-item><a-menu-item @click="example.setInputState(index, 'real')">{{ $t('PropertyRules.fallback.real') }}</a-menu-item></a-menu></template></a-dropdown>
          <span v-if="input.missing" class="diagram-input-static">{{ $t('PropertyRules.fallback.absent') }}</span>
          <ValueInput v-else-if="example.scalar" string-mode :value="scalarValue(input.value) ? input.value : undefined" :property="property" :get-popup-container="popupContainer" :placeholder="input.value === null ? $t('PropertyRules.fallback.null') : undefined" :label="$t('PropertyRules.diagram.valueLabel', { index: index + 1 })" @update:value="input.value = $event" />
          <a-input v-else-if="example.textual" :value="String(input.value ?? '')" :placeholder="input.value === null ? $t('PropertyRules.fallback.null') : undefined" size="small" :aria-label="$t('PropertyRules.diagram.valueLabel', { index: index + 1 })" @update:value="input.value = $event" />
          <span v-else class="diagram-input-static" :title="example.displayInput(input.value)">{{ example.displayInput(input.value) }}</span>
        </div>
      </div>
      <div v-if="example.interval" class="diagram-row diagram-time-row">
        <span class="diagram-label"><span class="diagram-label-caption"><AIcon type="ClockCircleOutlined" />{{ $t('PropertyRules.diagram.arrival') }}</span><small>{{ $t('PropertyRules.diagram.relativeTime', { unit: example.timeUnit }) }}</small></span>
        <a-input-number v-for="(input, index) in example.inputs" :key="index" :value="input.arrivalMillis === null ? undefined : input.arrivalMillis / draft.intervalUnit" :min="0" size="small" :controls="false" :aria-label="$t('PropertyRules.diagram.timeLabel', { index: index + 1, unit: example.timeUnit })" @update:value="example.setArrival(index, $event)" />
      </div>
      <div class="diagram-flow">
        <div v-for="(row, rowIndex) in example.rows" :key="row.key" class="diagram-row diagram-rule-row" :data-rule="row.key">
          <span class="diagram-label" :title="`${row.title} · ${row.sentence} ${row.details ?? ''}`"><a-tag :color="row.color"><AIcon :type="row.icon" /><span class="diagram-rule-title">{{ row.title }}</span></a-tag><small class="diagram-rule-sentence">{{ row.sentence }}</small><small v-if="row.details">{{ row.details }}</small></span>
          <span v-for="(point, index) in example.columns" :key="index" class="diagram-cell" :class="point ? `diagram-${point.stages[rowIndex].status}` : 'diagram-pending'" :data-state="point?.stages[rowIndex].status" :title="point ? stageTitle(point.stages[rowIndex], point.inputLabel ?? point.label) : undefined">
            <template v-if="point">
            <a-popover v-if="point.stages[rowIndex].explanation" :trigger="['hover','click']" :title="$t('PropertyRules.diagram.process')">
              <template #content><div class="diagram-process"><ExpressionProcess :explanation="point.stages[rowIndex].explanation!" :context="context" /></div></template>
              <button type="button" class="diagram-node" :aria-label="$t('PropertyRules.diagram.process')"><AIcon :type="statusIcons[point.stages[rowIndex].status]" /></button>
            </a-popover>
            <span v-else class="diagram-node"><AIcon :type="statusIcons[point.stages[rowIndex].status]" /></span>
            <small v-if="point.stages[rowIndex].recordInvalid" class="diagram-transformed">{{ $t('PropertyRules.recordInvalidShort') }}</small>
            <small v-if="point.stages[rowIndex].value && point.stages[rowIndex].status === 'processed'" class="diagram-transformed">{{ point.stages[rowIndex].value }}</small>
            </template>
            <a-skeleton-avatar v-else-if="example.loading" :size="24" :active="false" aria-hidden="true" />
            <span v-else class="diagram-node" aria-hidden="true" />
          </span>
        </div>
        <div class="diagram-row diagram-output-row">
          <span class="diagram-label diagram-label-caption"><AIcon type="ExportOutlined" />{{ $t('PropertyRules.diagram.output') }}</span>
          <span v-for="(point, index) in example.columns" :key="index" class="diagram-cell" :class="outputClass(point)" :title="outputTitle(point)">
            <span v-if="point" class="diagram-result">{{ point.label }}</span>
            <a-skeleton-button v-else-if="example.loading" class="diagram-result-skeleton" size="small" :active="false" aria-hidden="true" />
            <span v-else class="diagram-result">—</span>
          </span>
        </div>
      </div>
    </div>
    <template>
      <div class="diagram-note diagram-legend"><span><AIcon type="CheckOutlined" />{{ $t('PropertyRules.diagram.status.kept') }}</span><span><AIcon type="CloseOutlined" />{{ $t('PropertyRules.diagram.status.filtered') }}</span><span v-if="draft.scaleEnabled || draft.fileEnabled || draft.fallbackEnabled || draft.valuesMode === 'replace' || draft.rangeAction === 'clamp'"><AIcon type="SwapOutlined" />{{ $t('PropertyRules.diagram.status.processed') }}</span><span v-if="draft.alarmEnabled"><AIcon type="WarningOutlined" />{{ $t('PropertyRules.diagram.alarmContinues') }}</span><span v-if="draft.alarmEnabled && draft.alarm.autoRelieve"><AIcon type="CheckCircleOutlined" />{{ $t('PropertyRules.diagram.status.recovered') }}</span></div>
      <div v-if="draft.samplingEnabled" class="diagram-note">{{ $t(draft.samplingMode !== 'ratio' ? `PropertyRules.diagram.${draft.samplingMode}` : 'PropertyRules.diagram.example') }}</div>
      <div v-if="draft.fileEnabled" class="diagram-note">{{ $t('PropertyRules.diagram.fileNote') }}</div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../alarm/types'
import type { RuleDraft } from './codec'
import type { RuleExamplePoint, RuleExampleStage } from './diagram'
import type { RuleScope } from './service'
import { useRuleExample } from './useRuleExample'
import ValueInput from './values/ValueInput.vue'
import { scalarValue } from './values/config'
import { ExpressionProcess } from '@jetlinks-web-core/components/Expression'
import { usePropertyExpression } from './usePropertyExpression'
const props = defineProps<{ draft: RuleDraft; property: ThingModelProperty; scope: RuleScope }>()
defineEmits<{ (e: 'close'): void }>()
const { t: $t } = useI18n()
const example = reactive(useRuleExample(props))
const {context}=usePropertyExpression(()=>props.property)
const fallbackOutcomes = ['ready', 'missing', 'error'].map(value => ({ value, label: $t('PropertyRules.fallback.outcome.' + value) }))
const statusIcons = { kept: 'CheckOutlined', filtered: 'CloseOutlined', alarm: 'WarningOutlined', skipped: 'MinusOutlined', processed: 'SwapOutlined', recovered: 'CheckCircleOutlined', error: 'ExclamationCircleOutlined' }
const popupContainer = (trigger: HTMLElement) => trigger.parentElement!
function outputClass(point?: RuleExamplePoint) {
  if (!point) return 'diagram-pending'
  if (point.error) return 'diagram-error'
  return !point.outputKnown || point.filtered || point.sampled ? 'diagram-skipped' : 'diagram-kept'
}
function outputTitle(point?: RuleExamplePoint) {
  if (!point) return undefined
  if (point.error) return point.error
  if (!point.outputKnown) return $t('PropertyRules.diagram.outputUnknown')
  return point.filtered || point.sampled ? $t('PropertyRules.diagram.status.filtered') : point.label
}
function stageTitle(stage: RuleExampleStage, value: string) {
  if (stage.error) return stage.error
  const elapsed = stage.elapsedMillis === undefined ? '' : ` · ${$t(stage.key === 'fallback' ? 'PropertyRules.fallback.exampleAge' : 'PropertyRules.diagram.elapsed', { value: Number((stage.elapsedMillis / props.draft.intervalUnit).toPrecision(8)), unit: example.timeUnit })}`
  const status = stage.skipReason ? $t(`PropertyRules.fallback.skip.${stage.skipReason}`) : $t(`PropertyRules.diagram.status.${stage.status}`)
  return `${stage.value ?? value} · ${status}${stage.intent ? ` · ${$t('PropertyRules.diagram.intent')}` : ''}${stage.baseline === undefined ? '' : ` · ${$t('PropertyRules.diagram.baseline', { value: stage.baseline })}`}${elapsed}`
}
</script>
<style scoped>
.diagram-fallback-settings { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-2); font-size: var(--fs-12); }
.diagram-fallback-settings > :deep(.ant-input-number), .diagram-fallback-settings > :deep(.ant-input), .diagram-fallback-settings > :deep(.ant-select) { width: 96px; }
.diagram-input-missing { opacity: 0.55; }
.rule-diagram { width: min(560px, calc(100vw - 64px)); }
.diagram-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); font-weight: 500; }
.diagram-heading-status { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-1); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); font-weight: normal; }
.diagram-heading-status > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.diagram-content { max-height: 60vh; overflow-y: auto; margin-block: var(--space-2); }
.diagram-row { display: grid; grid-template-columns: minmax(96px, 124px) repeat(5, minmax(0, 1fr)); align-items: center; column-gap: var(--space-2); }
.diagram-label-caption { display: inline-flex; align-items: center; gap: var(--space-1); }
.diagram-label { min-width: 0; font-size: var(--fs-12); }
.diagram-label small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--jet-theme-text-secondary); font-size: 11px; }
.diagram-label .diagram-rule-sentence { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; line-height: 15px; }
.diagram-label :deep(.ant-tag) { display: inline-flex; align-items: center; gap: var(--space-1); max-width: 100%; margin: 0; padding-inline: var(--space-1); font-size: var(--fs-12); }
.diagram-label :deep(.ant-tag > .anticon) { flex-shrink: 0; }
.diagram-rule-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.diagram-input { min-width: 0; text-align: center; position: relative; }
.diagram-input-static { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-12); }
.diagram-input :deep(.ant-input-number), .diagram-input :deep(.ant-input), .diagram-input :deep(.ant-select) { width: 100%; min-width: 0; }
.diagram-input :deep(input) { text-align: center; padding-inline: var(--space-1); }
.diagram-time-row { margin-top: var(--space-2); }
.diagram-time-row :deep(.ant-input-number) { width: 100%; min-width: 0; }
.diagram-time-row :deep(input) { text-align: center; padding-inline: var(--space-1); }
.diagram-rule-row { min-height: 64px; }
.diagram-cell { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px; min-width: 0; min-height: 64px; font-size: var(--fs-12); }
.diagram-pending { color: var(--jet-theme-text-disabled); }
.diagram-pending .diagram-node { border-style: dashed; }
.diagram-result-skeleton :deep(.ant-skeleton-button) { min-width: 32px; width: 32px; height: 12px; }
.diagram-processed { flex-direction: column; }
.diagram-processed .diagram-node { color: var(--jet-theme-primary); border-color: var(--jet-theme-primary); }
.diagram-transformed { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.diagram-cell::before { content: '↓'; display: block; height: 12px; line-height: 12px; color: var(--jet-theme-text-disabled); font-size: 12px; }
.diagram-node { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 1px solid var(--line); border-radius: 50%; }
.diagram-kept .diagram-node { color: var(--jet-theme-primary); border-color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.diagram-recovered .diagram-node { color: var(--jet-theme-success); border-color: var(--jet-theme-success); background: var(--jet-theme-success-soft); }
.diagram-alarm .diagram-node { color: var(--jet-theme-warning); border-color: var(--jet-theme-warning); background: var(--warn-bg); }
.diagram-filtered .diagram-node, .diagram-skipped { color: var(--jet-theme-text-secondary); }
.diagram-skipped::before { visibility: hidden; }
.diagram-skipped .diagram-node { border-color: transparent; }
.diagram-output-row { border-top: 1px solid var(--line); margin-top: var(--space-1); }
.diagram-output-row .diagram-cell { min-height: 32px; justify-content: center; }
.diagram-output-row .diagram-cell::before { display: none; }
.diagram-result { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; font-variant-numeric: tabular-nums; }
.diagram-note { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.diagram-legend { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-1); }
.diagram-legend > span { display: inline-flex; align-items: center; gap: var(--space-1); }
.diagram-context { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:8px }
.diagram-context label { display:flex; align-items:center; gap:6px; font-size:12px }
.diagram-context :deep(.ant-input),.diagram-context :deep(.ant-input-number) { width:120px }
.diagram-process { max-width:min(420px,70vw); max-height:320px; overflow:auto }
button.diagram-node { cursor:pointer; background:transparent; padding:0 }
</style>
