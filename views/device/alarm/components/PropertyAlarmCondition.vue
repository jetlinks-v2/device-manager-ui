<template>
  <span class="property-alarm-condition">
    <a-select :value="model.trigger" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('DeviceAlarm.form.trigger')" :options="operators" @update:value="changeOperator" />
    <template v-if="model.trigger === 'inside' || model.trigger === 'outside'">
      <a-input-number v-model:value="model.limit.lower" size="small" :controls="false" :placeholder="$t('PropertyRules.lowerPlaceholder')" :aria-label="$t('PropertyRules.alarmLower')" />
      <span>～</span>
      <a-input-number v-model:value="model.limit.upper" size="small" :controls="false" :placeholder="$t('PropertyRules.upperPlaceholder')" :aria-label="$t('PropertyRules.alarmUpper')" />
    </template>
    <a-select v-else-if="model.trigger === 'in' || model.trigger === 'nin'" :value="model.values" :mode="type === 'enum' ? 'multiple' : 'tags'" size="small" class="condition-values" :options="enumOptions" :placeholder="$t(type === 'enum' ? 'DeviceAlarm.condition.selectValues' : 'DeviceAlarm.condition.values')" :aria-label="$t(type === 'enum' ? 'DeviceAlarm.condition.selectValues' : 'DeviceAlarm.condition.values')" :token-separators="[',', '，']" @update:value="model.values = $event" />
    <ValueInput v-else :property="property" v-model:value="model.value" :label="$t('DeviceAlarm.condition.value')" />
    <span v-if="unit && numeric" class="condition-unit">{{ unit }}</span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmCondition, DeviceAlarmTrigger, ThingModelProperty } from '../types'
import { conditionOperators, conditionSymbols, switchConditionOperator } from '../conditions'
import { isNumberProperty, formatPropertyUnit } from '../utils'
import ValueInput from '../../components/PropertyRules/values/ValueInput.vue'
const props = defineProps<{ model: DeviceAlarmCondition; property: ThingModelProperty }>()
const { t: $t } = useI18n()
const type = computed(() => props.property.valueType?.type ?? props.property.type ?? props.property.dataType)
const numeric = computed(() => isNumberProperty(props.property))
const unit = computed(() => formatPropertyUnit(props.property.valueType?.unit))
const enumOptions = computed(() => props.property.valueType?.elements?.map(item => ({ value: item.value, label: item.text ?? String(item.value) })) ?? [])
const operators = computed(() => conditionOperators(props.property).map(value => ({ value,
  label: ['inside', 'outside', 'in', 'nin'].includes(value) ? $t(`DeviceAlarm.condition.${value}`) : conditionSymbols[value],
})))
function changeOperator(value: DeviceAlarmTrigger) {
  Object.assign(props.model, switchConditionOperator(props.model, value))
}
</script>
<style scoped>
.property-alarm-condition { display: inline-flex; align-items: center; flex-wrap: wrap; gap: var(--space-1); min-width: 0; font-size: inherit; line-height: 24px; }
.property-alarm-condition :deep(.ant-input-number) { width: 76px; }
.property-alarm-condition :deep(.ant-input) { width: 112px; }
.property-alarm-condition :deep(.ant-select-selector), .property-alarm-condition :deep(input) { font-size: inherit; }
.condition-values { min-width: 160px; max-width: 260px; }
.condition-unit { color: var(--jet-theme-text-secondary); }
</style>
