<template>
  <PropertyRuleLine icon="HistoryOutlined" :title="$t('PropertyRules.part.fallback')" color="purple" :notice="$t('PropertyRules.fallback.hint')">
    <I18nT :keypath="`PropertyRules.sentence.fallback${draft.fallbackMode === 'previous' ? 'Previous' : 'Fixed'}`" scope="global" tag="span" class="rule-clause">
      <template #trigger>
        <a-popover trigger="click" placement="bottomLeft" :title="$t('PropertyRules.fallback.conditions')">
          <template #content>
            <div class="fallback-options">
              <a-checkbox checked disabled><RuleMenuOption compact icon="StopOutlined" :title="$t('PropertyRules.fallback.null')" :description="$t('PropertyRules.choice.null')" /></a-checkbox>
              <a-checkbox v-if="type === 'string'" v-model:checked="draft.fallbackEmpty"><RuleMenuOption compact icon="FontSizeOutlined" :title="$t('PropertyRules.fallback.empty')" :description="$t('PropertyRules.choice.empty')" /></a-checkbox>
              <a-checkbox v-model:checked="draft.fallbackMissing"><RuleMenuOption compact icon="MinusCircleOutlined" :title="$t('PropertyRules.fallback.missing')" :description="$t('PropertyRules.choice.missing')" /></a-checkbox>
            </div>
          </template>
          <a-button type="text" size="small" class="fallback-trigger" :aria-label="`${$t('PropertyRules.fallback.conditions')}：${conditions}`"><span>{{ conditions }}</span><AIcon type="DownOutlined" /></a-button>
        </a-popover>
      </template>
      <template #strategy><a-select v-model:value="draft.fallbackMode" size="small" :bordered="false" :dropdown-match-select-width="288" :virtual="false" dropdown-class-name="rule-select-menu" :aria-label="$t('PropertyRules.part.fallback')" :options="modes"><template #option="option"><RuleMenuOption compact :icon="option.icon" :title="option.label" :description="$t(option.description)" /></template></a-select></template>
      <template #age><span class="rule-phrase"><a-input-number :value="draft.fallbackMaxAge == null ? undefined : draft.fallbackMaxAge / 1000" :min="0.001" size="small" :controls="false" :aria-label="$t('PropertyRules.fallback.maxAge')" @update:value="draft.fallbackMaxAge = $event == null ? null : Number($event) * 1000" />{{ $t('PropertyRules.timeUnit.s') }}</span></template>
      <template #value><span class="rule-phrase"><ValueInput v-model:value="draft.fallbackValue" :property="property" :label="$t('PropertyRules.fallback.fixedValue')" :placeholder="$t('PropertyRules.fallback.valuePlaceholder')" class="rule-fallback-value" /><span v-if="unit">{{ unit }}</span></span></template>
      <template #otherwise>
        <span class="fallback-fixed">
          <a-checkbox :checked="draft.fallbackValue != null" @update:checked="setFixed">{{ $t('PropertyRules.fallback.otherwise') }}</a-checkbox>
          <span v-if="draft.fallbackValue != null" class="rule-phrase"><ValueInput v-model:value="draft.fallbackValue" :property="property" :label="$t('PropertyRules.fallback.fixedValue')" :placeholder="$t('PropertyRules.fallback.valuePlaceholder')" class="rule-fallback-value" /><span v-if="unit">{{ unit }}</span></span>
        </span>
      </template>
    </I18nT>
    <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.part.fallback') })" @click="draft.fallbackEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
  </PropertyRuleLine>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../../alarm/types'
import { formatPropertyUnit, isNumberProperty } from '../../../alarm/utils'
import type { RuleDraft } from '../codec'
import PropertyRuleLine from '../PropertyRuleLine.vue'
import ValueInput from './ValueInput.vue'
import RuleMenuOption from '../RuleMenuOption.vue'
const props = defineProps<{ draft: RuleDraft; property: ThingModelProperty }>()
const { t: $t } = useI18n()
const type = computed(() => props.property.valueType?.type ?? props.property.type ?? props.property.dataType)
const unit = computed(() => isNumberProperty(props.property) ? formatPropertyUnit(props.property.valueType?.unit) : '')
const conditions = computed(() => [
  $t('PropertyRules.fallback.null'),
  props.draft.fallbackEmpty && type.value === 'string' ? $t('PropertyRules.fallback.emptyShort') : '',
  props.draft.fallbackMissing ? $t('PropertyRules.fallback.absent') : '',
].filter(Boolean).join(' / '))
const modes = computed(() => [
  { value: 'previous', label: $t('PropertyRules.fallback.previousShort'), icon: 'HistoryOutlined', description: 'PropertyRules.choice.previous' },
  { value: 'fixed', label: $t('PropertyRules.fallback.fixed'), icon: 'EditOutlined', description: 'PropertyRules.choice.fixed' },
])
function setFixed(enabled: boolean) {
  props.draft.fallbackValue = enabled ? isNumberProperty(props.property) ? 0 : type.value === 'boolean' ? false
    : type.value === 'enum' ? props.property.valueType?.elements?.[0]?.value ?? null : '' : null
}
</script>
<style scoped>
.fallback-trigger { gap: 4px; padding-inline: 0; color: inherit; }
.fallback-trigger > span:first-child { text-decoration: underline dotted var(--jet-theme-text-secondary); text-underline-offset: 4px; }
.fallback-trigger :deep(.anticon) { margin: 0; color: var(--jet-theme-text-secondary); font-size: 10px; }
.fallback-options { display: flex; flex-direction: column; align-items: stretch; gap: var(--space-2); width: min(264px, calc(100vw - 72px)); font-size: var(--fs-12); }
.fallback-options :deep(.ant-checkbox-wrapper) { align-items: flex-start; margin: 0; }
.fallback-options :deep(.ant-checkbox) { top: 4px; align-self: flex-start; }
.fallback-fixed { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; color: var(--jet-theme-text-secondary); }
.fallback-fixed :deep(.ant-checkbox-wrapper) { font-size: var(--fs-12); }
.rule-fallback-value.ant-input-number { width: 80px; }
.rule-fallback-value.ant-input, .rule-fallback-value.ant-select { width: 112px; max-width: 100%; }
</style>
