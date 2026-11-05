<template>
  <a-input-number v-if="numeric" :value="typeof value === 'number' ? value : undefined" :size="size ?? 'small'" :controls="false" class="rule-scalar-input" :placeholder="placeholder ?? label" :aria-label="label" @update:value="$emit('update:value', $event)" />
  <a-select v-else-if="type === 'boolean' || type === 'enum'" :value="value == null ? undefined : propertyValueKey(value)" :size="size ?? 'small'" class="rule-scalar-input"
    :aria-label="label" :placeholder="placeholder ?? label" :options="options" :get-popup-container="getPopupContainer"
    :status="invalid ? 'error' : undefined" :title="invalid || undefined" :not-found-content="$t('PropertyRules.noValueOptions')" @update:value="updateValue" />
  <a-input v-else :value="typeof value === 'string' ? value : ''" :size="size ?? 'small'" class="rule-scalar-input" :aria-label="label" :placeholder="placeholder ?? label" @update:value="$emit('update:value', $event)" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../../alarm/types'
import { isNumberProperty } from '../../../alarm/utils'
import type { ScalarValue } from './config'
import { propertyValueChoices, propertyValueKey, propertyValueType, readPropertyValueKeys } from './metadata'
const props = defineProps<{ property: ThingModelProperty; value?: ScalarValue | null; label: string; size?: 'small' | 'middle'; placeholder?: string; getPopupContainer?: (trigger: HTMLElement) => HTMLElement }>()
const emit = defineEmits<{ (e: 'update:value', value: ScalarValue | null): void }>()
const { t: $t } = useI18n()
const type = computed(() => propertyValueType(props.property))
const numeric = computed(() => isNumberProperty(props.property))
const selected = computed(() => props.value == null ? [] : [props.value])
const options = computed(() => propertyValueChoices(props.property, selected.value).map(choice => ({
  ...choice, label: choice.unavailable ? $t('PropertyRules.valueUnavailable', { value: choice.label }) : choice.label,
})))
const invalid = computed(() => options.value.find(choice => choice.unavailable)?.label ?? '')
function updateValue(key: unknown) {
  if (typeof key !== 'string') return
  const value = readPropertyValueKeys([key], props.property, selected.value)[0]
  if (value !== undefined) emit('update:value', value)
}
</script>
<style scoped>
.rule-scalar-input.ant-select { width: max-content; min-width: 6rem; max-width: min(16rem, 100%); }
</style>
