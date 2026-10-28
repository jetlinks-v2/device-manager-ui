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
              <template #label><a-tag color="orange" class="rule-alarm-identity"><AIcon type="AlertOutlined" /><a-input v-if="editor.alarmNameEditing" :ref="editor.setAlarmNameInput" v-model:value="editor.draft.alarm.name" size="small" :maxlength="64" :aria-label="$t('DeviceAlarm.form.name')" @blur="editor.stopAlarmName()" @press-enter="editor.stopAlarmName()" @keydown.esc.stop.prevent="editor.stopAlarmName(true)" /><a-button v-else type="text" size="small" :disabled="!editor.editable" class="rule-alarm-name" :title="editor.draft.alarm.name" :aria-label="$t('PropertyRules.editAlarmName')" @click="editor.editAlarmName">{{ editor.draft.alarm.name || $t('DeviceAlarm.form.name') }}</a-button></a-tag></template>
              <a-select v-model:value="editor.draft.alarm.trigger" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('DeviceAlarm.form.trigger')" :options="[{ value: 'outside', label: $t('PropertyRules.sentence.outside') }, { value: 'inside', label: $t('PropertyRules.sentence.inside') }]" />
              <span class="rule-phrase"><a-input-number v-model:value="editor.draft.alarm.limit.lower" size="small" :controls="false" :placeholder="$t('PropertyRules.lowerPlaceholder')" :aria-label="$t('PropertyRules.alarmLower')" /><span>～</span><a-input-number v-model:value="editor.draft.alarm.limit.upper" size="small" :controls="false" :placeholder="$t('PropertyRules.upperPlaceholder')" :aria-label="$t('PropertyRules.alarmUpper')" /><span v-if="editor.unit">{{ editor.unit }}</span></span>
              <template #extra><PropertyRuleAlarmActions :editor="editor" /></template>
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
import { computed, type UnwrapNestedRefs } from 'vue'
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
const props = defineProps<{ editor: UnwrapNestedRefs<ReturnType<typeof usePropertyRuleEditor>>; scope: RuleScope; property: ThingModelProperty; withActions?: boolean }>()
const { t: $t } = useI18n()
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
.rule-sentences { container: rule-fields / inline-size; display: flex; flex-direction: column; align-items: stretch; width: 100%; max-width: 700px; }
.rule-add { margin-top: var(--space-1); }
.rule-source { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2); padding-inline-end: 92px; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.rule-warning { margin-top: var(--space-2); }
.rule-alarm-identity { align-items: center; gap: var(--space-1); width: 100%; min-width: 0; white-space: nowrap; }
.rule-alarm-identity > :deep(.anticon) { flex-shrink: 0; }
.rule-alarm-name { min-width: 0; height: 20px; padding: 0; border: 0; overflow: hidden; text-overflow: ellipsis; color: inherit; font-size: inherit; line-height: 20px; text-align: left; }
.rule-alarm-identity :deep(.ant-input) { flex: 1; min-width: 0; width: 0; padding: 0; border: 0; border-bottom: 1px solid currentColor; border-radius: 0; background: transparent; color: inherit; box-shadow: none; font-size: var(--fs-12); }
</style>
