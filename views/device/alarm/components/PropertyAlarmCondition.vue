<template>
  <span class="property-alarm-condition" :class="{ 'is-form': layout === 'form' }">
    <a-select class="condition-operator" :value="model.trigger" :size="controlSize" :bordered="layout === 'form'" :dropdown-match-select-width="288" :list-height="360" :virtual="false" dropdown-class-name="alarm-condition-menu" :aria-label="$t(recovery ? 'DeviceAlarm.condition.recovery.condition' : 'DeviceAlarm.form.trigger')" :options="operators" @update:value="changeOperator">
      <template #option="option"><RuleMenuOption compact :icon="option.icon || 'CalculatorOutlined'" :title="$t(`DeviceAlarm.condition.label.${option.value}`)" :description="$t(`DeviceAlarm.condition.hint.${option.value}`)"><template v-if="!option.icon" #icon><span>{{ option.symbol }}</span></template></RuleMenuOption></template>
    </a-select>
    <span class="condition-operands">
    <template v-if="model.trigger === 'inside' || model.trigger === 'outside'">
      <a-input-number v-model:value="model.limit.lower" :size="controlSize" :controls="false" :placeholder="$t('PropertyRules.lowerPlaceholder')" :aria-label="$t(recovery ? 'DeviceAlarm.condition.recovery.lower' : 'PropertyRules.alarmLower')" />
      <span>～</span>
      <a-input-number v-model:value="model.limit.upper" :size="controlSize" :controls="false" :placeholder="$t('PropertyRules.upperPlaceholder')" :aria-label="$t(recovery ? 'DeviceAlarm.condition.recovery.upper' : 'PropertyRules.alarmUpper')" />
    </template>
    <ValueSetInput v-else-if="model.trigger === 'in' || model.trigger === 'nin'" :value="model.values ?? []" :property="property" :size="controlSize" class="condition-values" :label="$t(type === 'enum' ? 'DeviceAlarm.condition.selectValues' : 'DeviceAlarm.condition.values')" @update:value="model.values = $event" />
    <ValueInput v-else :property="property" :size="controlSize" v-model:value="model.value" :label="$t('DeviceAlarm.condition.value')" />
    <span v-if="unit && numeric" class="condition-unit">{{ unit }}</span>
    </span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmCondition, DeviceAlarmTrigger, ThingModelProperty } from '../types'
import { conditionOperators, conditionSymbols, switchConditionOperator } from '../conditions'
import { isNumberProperty, formatPropertyUnit } from '../utils'
import ValueInput from '../../components/PropertyRules/values/ValueInput.vue'
import ValueSetInput from '../../components/PropertyRules/values/ValueSetInput.vue'
import RuleMenuOption from '../../components/PropertyRules/RuleMenuOption.vue'
const props = defineProps<{ model: DeviceAlarmCondition; property: ThingModelProperty; recovery?: boolean; layout?: 'inline' | 'form' | 'detail' }>()
const { t: $t } = useI18n()
const controlSize = computed(() => props.layout === 'form' ? 'middle' : 'small')
const type = computed(() => props.property.valueType?.type ?? props.property.type ?? props.property.dataType)
const numeric = computed(() => isNumberProperty(props.property))
const unit = computed(() => formatPropertyUnit(props.property.valueType))
const operators = computed(() => conditionOperators(props.property).map(value => ({ value,
  icon: ({ inside: 'CompressOutlined', outside: 'ExpandOutlined', in: 'CheckSquareOutlined', nin: 'StopOutlined' } as Partial<Record<DeviceAlarmTrigger, string>>)[value],
  label: props.layout === 'form' || props.layout === 'detail' ? $t(`DeviceAlarm.condition.label.${value}`)
    : ['inside', 'outside', 'in', 'nin'].includes(value) ? $t(`DeviceAlarm.condition.${value}`) : conditionSymbols[value],
  symbol: conditionSymbols[value],
})))
function changeOperator(value: unknown) {
  const operator = operators.value.find(option => option.value === value)?.value
  if (operator) Object.assign(props.model, switchConditionOperator(props.model, operator))
}
</script>
<style scoped>
.property-alarm-condition { display: inline-flex; align-items: center; flex-wrap: wrap; gap: var(--space-1); min-width: 0; max-width: 100%; font-size: inherit; line-height: 24px; }
.property-alarm-condition :deep(.ant-input-number) { width: 76px; }
.property-alarm-condition :deep(.ant-input) { width: 112px; }
.property-alarm-condition :deep(.ant-select-selector), .property-alarm-condition :deep(input) { font-size: inherit; }
.condition-operator { flex-shrink: 0; }
.condition-operands { display: inline-flex; align-items: center; gap: var(--space-2); min-width: 0; max-width: 100%; }
.condition-operands > :deep(.ant-input-number) { flex-shrink: 0; }
.condition-values { width: max-content; min-width: 80px; max-width: min(260px, 100%); }
.condition-unit { min-width: 0; color: var(--jet-theme-text-secondary); overflow-wrap: anywhere; }
:global(.alarm-condition-menu) { max-width: calc(100vw - 48px); }
:global(.alarm-condition-menu .ant-select-item-option) { padding: 6px 12px; }
.property-alarm-condition.is-form { display: flex; gap: var(--space-2); width: 100%; font-size: var(--fs-14); line-height: 32px; }
.is-form > :deep(.ant-select:first-child) { width: 100%; }
.is-form :deep(.ant-input-number), .is-form :deep(.ant-input) { width: 8rem; max-width: 100%; }
.is-form .condition-values { width: 100%; max-width: 100%; }
.is-form .condition-operands { width: 100%; }
</style>
