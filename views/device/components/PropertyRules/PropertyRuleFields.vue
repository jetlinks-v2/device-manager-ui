<template>
  <div class="rule-editor">
    <a-spin :spinning="editor.loading">
      <a-alert v-if="editor.failed" type="error" :message="$t('PropertyRules.loadFailed')"><template #action><a-button size="small" @click="editor.load">{{ $t('PropertyRules.retry') }}</a-button></template></a-alert>
      <template v-else-if="editor.draft">
        <PropertyRuleActions v-if="withActions !== false && (editor.steps.some(item => item.enabled) || editor.pendingSave || editor.saveState !== 'idle' || editor.hasOverride)" :editor="editor" :property="property" :scope="scope" class="rule-editor-actions" />
        <div v-if="scope.deviceId || !editor.canSave" class="rule-source">
          <a-tag v-if="scope.deviceId" :color="editor.custom ? 'blue' : undefined"><AIcon :type="editor.source === 'disabled' ? 'StopOutlined' : editor.custom ? 'HddOutlined' : 'CloudOutlined'" /> {{ $t('PropertyRules.source.' + (editor.custom ? (editor.hasOverride ? editor.source : 'device') : editor.source)) }}</a-tag>
          <a-button v-if="scope.deviceId && !editor.custom && editor.canSave && editor.parsed.editable" type="link" size="small" @click="editor.customize"><AIcon type="EditOutlined" /> {{ $t('PropertyRules.customize') }}</a-button>
          <a-tooltip v-if="!editor.canSave" :title="$t('PropertyRules.permissionHint')"><a-tag><AIcon type="LockOutlined" /> {{ $t('PropertyRules.viewOnly') }}</a-tag></a-tooltip>
        </div>
        <a-alert v-if="!editor.parsed.editable" type="info" show-icon :message="$t('PropertyRules.readonly')" />
        <template v-else>
          <PropertyRuleSummary v-if="!editor.custom || !editor.canSave" :rows="summaryRows" />
          <a-form v-else class="rule-sentences" :class="{ 'rule-set-has-alarm': editor.draft.alarmEnabled }" layout="inline" :disabled="!editor.editable">
            <PropertyRuleStage v-if="editor.draft.valuesEnabled || editor.draft.rangeEnabled || editor.draft.stepEnabled" section="cleaning" :caption="multipleStages">
            <PropertyRuleLine v-if="editor.draft.valuesEnabled" icon="StopOutlined" :title="$t('PropertyRules.part.values')" color="blue" :notice="editor.cleaningHint">
              <I18nT keypath="PropertyRules.sentence.valueRule" scope="global" tag="span" class="rule-clause">
                <template #values>
                  <a-checkbox-group v-if="editor.boolean" v-model:value="editor.draft.values" :options="editor.booleanOptions" />
                  <a-select v-else-if="editor.type === 'enum'" v-model:value="editor.draft.values" mode="multiple" size="small" :options="editor.enumOptions" :aria-label="$t('PropertyRules.valueFilter')" class="rule-value-list" />
                  <a-select v-else mode="tags" size="small" :value="editor.draft.values.map(String)" :token-separators="[',']" :open="false" :aria-label="$t('PropertyRules.valueFilter')" :title="$t('PropertyRules.valuesPlaceholder')" :placeholder="$t('PropertyRules.valuesPlaceholder')" class="rule-value-list" @change="editor.setValues" />
                </template>
                <template #action><a-select v-model:value="editor.draft.valuesMode" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('PropertyRules.valuesMode')" :options="valueModes" /></template>
                <template #replacement><span v-if="editor.draft.valuesMode === 'replace'" class="rule-phrase">{{ $t('PropertyRules.sentence.withValue') }}<ValueInput v-model:value="editor.draft.replacementValue" :property="property" :label="$t('PropertyRules.replacement')" class="rule-value-entry" /></span></template>
              </I18nT>
              <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.valueFilter') })" @click="editor.draft.valuesEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
            </PropertyRuleLine>
            <PropertyRuleLine v-if="editor.draft.rangeEnabled" icon="SafetyOutlined" :title="$t('PropertyRules.part.range')" color="blue" :notice="[editor.cleaningHint, editor.draft.rangeAction === 'clamp' ? $t('PropertyRules.clampHint') : ''].filter(Boolean).join(' ')">
              <a-select v-model:value="editor.draft.rangeAction" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('PropertyRules.rangeAction')" :options="rangeActions" />
              <span class="rule-phrase"><a-input-number v-model:value="editor.draft.min" size="small" :controls="false" :placeholder="$t('PropertyRules.lowerPlaceholder')" :aria-label="$t('PropertyRules.minValue')" /><span>～</span><a-input-number v-model:value="editor.draft.max" size="small" :controls="false" :placeholder="$t('PropertyRules.upperPlaceholder')" :aria-label="$t('PropertyRules.maxValue')" /><span v-if="editor.cleaningUnit">{{ editor.cleaningUnit }}</span></span>
              <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.validRange') })" @click="editor.draft.rangeEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
            </PropertyRuleLine>
            <PropertyRuleLine v-if="editor.draft.stepEnabled" icon="LineChartOutlined" :title="$t('PropertyRules.part.step')" color="blue" :notice="[editor.cleaningHint, $t('PropertyRules.stepHint'), $t('PropertyRules.statefulHint')].filter(Boolean).join(' ')">
              <I18nT keypath="PropertyRules.sentence.maxStep" scope="global" tag="span" class="rule-clause">
                <template #age><span class="rule-phrase"><a-input-number :value="editor.draft.baselineTtl == null ? undefined : editor.draft.baselineTtl / 1000" :min="0.001" size="small" :controls="false" :aria-label="$t('PropertyRules.step.lifetime')" @update:value="editor.draft.baselineTtl = $event == null ? null : Number($event) * 1000" />{{ $t('PropertyRules.timeUnit.s') }}</span></template>
                <template #threshold><span class="rule-phrase"><a-input-number v-model:value="editor.draft.maxStep" :min="0" size="small" :controls="false" :aria-label="$t('PropertyRules.part.step')" /><span v-if="editor.cleaningUnit">{{ editor.cleaningUnit }}</span></span></template>
              </I18nT>
              <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.part.step') })" @click="editor.draft.stepEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
            </PropertyRuleLine>
            </PropertyRuleStage>
            <PropertyRuleStage v-if="editor.draft.scaleEnabled || editor.draft.fallbackEnabled" section="processing" :caption="multipleStages">
              <template v-if="editor.draft.scaleEnabled">
              <PropertyRuleLine icon="CalculatorOutlined" :title="$t('PropertyRules.part.scale')" color="purple">
                <span>{{ $t('PropertyRules.sentence.multiply') }}</span><span class="rule-phrase"><a-input-number v-model:value="editor.draft.scale" string-mode size="small" :controls="false" :aria-label="$t('PropertyRules.part.scale')" /><span>+</span><a-input-number v-model:value="editor.draft.offset" string-mode size="small" :controls="false" :aria-label="$t('PropertyRules.offset')" /></span>
                <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.part.scale') })" @click="editor.draft.scaleEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
              </PropertyRuleLine>
              </template>
              <FallbackFields v-if="editor.draft.fallbackEnabled" :draft="editor.draft" :property="property" />
            </PropertyRuleStage>
            <PropertyRuleStage v-if="editor.draft.alarmEnabled" section="alarm" :caption="multipleStages">
            <PropertyRuleLine icon="AlertOutlined" :title="$t('PropertyRules.sentence.alarm')" color="orange" class="rule-line-alarm">
              <template #label>
                <span class="rule-alarm-name-anchor" :class="{ 'is-editing': editor.alarmNameEditing }">
                  <a-tag color="orange" class="rule-alarm-identity" :aria-hidden="editor.alarmNameEditing || undefined"><AIcon type="AlertOutlined" /><a-button ref="nameTrigger" type="text" size="small" :disabled="!editor.editable" class="rule-alarm-name" :title="editor.draft.alarm.name" :aria-label="$t('PropertyRules.editAlarmName')" @click="editor.editAlarmName">{{ editor.draft.alarm.name || $t('DeviceAlarm.form.name') }}</a-button></a-tag>
                  <a-tag v-if="editor.alarmNameEditing" color="orange" class="rule-name-editing" @keydown.esc.stop.prevent="closeName(true)">
                      <AIcon type="AlertOutlined" />
                      <span class="rule-name-input"><span class="rule-name-measure" aria-hidden="true">{{ editor.alarmNameValue || ' ' }}</span><a-textarea :ref="editor.setAlarmNameInput" v-model:value="editor.alarmNameValue" :rows="1" :maxlength="64" :aria-label="$t('DeviceAlarm.form.name')" @blur="editor.stopAlarmName()" @keydown.enter="confirmName" /></span>
                  </a-tag>
                </span>
              </template>
              <span class="alarm-flow">
                <span class="alarm-flow-row">
                  <AIcon type="ThunderboltOutlined" class="alarm-trigger-icon" />
                  <I18nT keypath="DeviceAlarm.sentence.trigger" scope="global" tag="span" class="alarm-flow-body">
                    <template #condition><PropertyAlarmCondition :model="editor.draft.alarm" :property="property" /></template>
                    <template #level><PropertyRuleAlarmActions :editor="editor" /></template>
                  </I18nT>
                </span>
                <PropertyAlarmRecovery :model="editor.draft.alarm" :property="property" :disabled="!editor.editable" />
                <RegistryComponent page-code="device/alarm" code="alarm-editor">
                  <DeviceAlarmNotificationConfig :model="editor.draft.alarm" :methods="editor.resources.methods" :loading="editor.resources.loading" :failed="editor.resources.failed" :disabled="!editor.editable" :reveal="editor.notificationOpen" @request-methods="editor.resources.load" @open-change="editor.setNotificationsOpen" />
                </RegistryComponent>
              </span>
              <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.alarm') })" @click="editor.draft.alarmEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
            </PropertyRuleLine>
            </PropertyRuleStage>
            <PropertyRuleStage v-if="editor.draft.samplingEnabled" section="sampling" :caption="multipleStages">
              <PropertySamplingFields :editor="editor" />
            </PropertyRuleStage>
            <PropertyRuleStage v-if="editor.draft.fileEnabled" section="processing" :caption="multipleStages">
              <PropertyRuleLine icon="FileOutlined" :title="$t('PropertyRules.part.file')" color="purple" :notice="$t('PropertyRules.fileHint')">
                <span :title="$t('PropertyRules.fileHint')">Base64 → {{ $t('PropertyRules.sentence.fileUrl') }}</span>
                <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.part.file') })" @click="editor.draft.fileEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
              </PropertyRuleLine>
            </PropertyRuleStage>
            <div v-if="editor.addableParts.length" class="rule-add"><RuleAddMenu :parts="editor.addableParts" :disabled="!editor.editable" @add="editor.addPart" /></div>
          </a-form>
          <a-alert v-if="editor.draft.samplingEnabled && editor.draft.samplingMode === 'ratio' && editor.draft.percent === 0" type="warning" show-icon :message="$t('PropertyRules.zeroWarning')" class="rule-warning" />
        </template>
      </template>
    </a-spin>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, type UnwrapNestedRefs } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../alarm/types'
import type { RuleScope } from './service'
import type { usePropertyRuleEditor } from './usePropertyRuleEditor'
import { summarizeRuleRows } from './summary'
import PropertyRuleActions from './PropertyRuleActions.vue'
import PropertyRuleLine from './PropertyRuleLine.vue'
import PropertyRuleSummary from './PropertyRuleSummary.vue'
import PropertyRuleStage from './PropertyRuleStage.vue'
import PropertySamplingFields from './PropertySamplingFields.vue'
import PropertyRuleAlarmActions from './PropertyRuleAlarmActions.vue'
import RuleAddMenu from './RuleAddMenu.vue'
import FallbackFields from './values/FallbackFields.vue'
import ValueInput from './values/ValueInput.vue'
import PropertyAlarmCondition from '../../alarm/components/PropertyAlarmCondition.vue'
import PropertyAlarmRecovery from '../../alarm/components/PropertyAlarmRecovery.vue'
import DeviceAlarmNotificationConfig from '../../alarm/components/DeviceAlarmNotificationConfig.vue'
const props = defineProps<{ editor: UnwrapNestedRefs<ReturnType<typeof usePropertyRuleEditor>>; scope: RuleScope; property: ThingModelProperty; withActions?: boolean }>()
const { t: $t } = useI18n()
const nameTrigger = ref<{ focus: () => void }>()
async function closeName(cancel: boolean) {
  props.editor.stopAlarmName(cancel)
  await nextTick()
  nameTrigger.value?.focus()
}
function confirmName(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  if (props.editor.alarmNameValue.trim()) closeName(false)
}
const summaryRows = computed(() => summarizeRuleRows(props.editor.parsed, props.property, $t))
const multipleStages = computed(() => props.editor.steps.filter(step => step.enabled).length > 1)
const valueModes = computed(() => [
  { value: 'ignore', label: $t('PropertyRules.sentence.ignore') }, { value: 'keep', label: $t('PropertyRules.sentence.keepOnly') },
  { value: 'replace', label: $t('PropertyRules.replace') },
])
const rangeActions = computed(() => [{ value: 'ignore', label: $t('PropertyRules.sentence.keep') }, { value: 'clamp', label: $t('PropertyRules.sentence.clampTo') }])
</script>
<style scoped>
.rule-editor { position: relative; }
.rule-editor-actions { display: flex; margin-bottom: var(--space-2); }
.rule-sentences { container: rule-fields / inline-size; display: flex; flex-direction: column; align-items: stretch; width: 100%; max-width: 100%; }
.rule-add { margin-top: var(--space-1); }
.rule-source { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2); padding-inline-end: 92px; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.rule-warning { margin-top: var(--space-2); }
/* Preserve the label footprint while the editor grows over the rule, within its container. */
.rule-alarm-name-anchor { position: relative; display: inline-flex; min-width: 0; max-width: min(160px, 100%); }
.rule-alarm-name-anchor.is-editing > .rule-alarm-identity { visibility: hidden; }
.rule-alarm-identity { align-items: center; gap: var(--space-1); width: fit-content; max-width: 100%; min-width: 0; white-space: nowrap; }
.rule-alarm-identity > :deep(.anticon) { flex-shrink: 0; }
.rule-alarm-name { min-width: 0; height: 20px; padding: 0; border: 0; overflow: hidden; text-overflow: ellipsis; color: inherit; font-size: inherit; line-height: 20px; text-align: left; }
.rule-alarm-name-anchor > .rule-name-editing { position: absolute; inset-block-start: 0; inset-inline-start: 0; z-index: 10; display: inline-flex; align-items: flex-start; gap: 4px; width: max-content; min-width: 100%; max-width: min(440px, 100cqi); height: auto; min-height: 22px; margin: 0; padding: 0 4px; font-size: var(--fs-12); line-height: 20px; transition: none; }
.rule-name-editing > :deep(.anticon) { flex-shrink: 0; margin-top: 4px; }
.rule-name-editing > .rule-name-input { position: relative; display: inline-grid; flex: 1; min-width: 0; min-height: 20px; margin-inline-start: 0; }
.rule-name-measure { grid-area: 1 / 1; visibility: hidden; overflow-wrap: anywhere; white-space: pre-wrap; }
/* A native scrollbar steals width while typing and keeps the text wrapped after the mirror grows. */
.rule-name-input :deep(textarea) { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; min-height: 0; padding: 0; border: 0; border-radius: 0; background: transparent; color: inherit; box-shadow: none; font: inherit; line-height: 20px; overflow-wrap: anywhere; overflow: hidden; resize: none; transition: none; }
.alarm-flow { display: flex; flex-direction: column; gap: 4px; width: 100%; min-width: 0; }
.alarm-flow-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; column-gap: 6px; }
.alarm-trigger-icon { display: flex; align-items: center; justify-content: center; height: 24px; color: var(--jet-theme-warning, #faad14); font-size: 14px; }
.alarm-flow-body { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; line-height: 24px; }
</style>
