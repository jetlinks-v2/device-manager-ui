<template>
  <a-checkbox-group v-if="type === 'boolean'" :value="value" :options="booleanOptions" :aria-label="label" @update:value="$emit('update:value', $event)" />
  <a-select v-else :value="selectedKeys" :mode="type === 'enum' ? 'multiple' : 'tags'" size="small" class="rule-value-list"
    :options="type === 'enum' ? options : undefined" :aria-label="label" :placeholder="placeholder ?? label" :token-separators="[',', '，']"
    :open="type === 'enum' ? undefined : false" :status="invalid ? allowUnknown ? 'warning' : 'error' : undefined" :title="invalid || undefined"
    :not-found-content="$t('PropertyRules.noValueOptions')" @update:value="updateValues" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../../alarm/types'
import { isNumberProperty } from '../../../alarm/utils'
import type { ScalarValue } from './config'
import { propertyValueChoices, propertyValueKey, propertyValueType, readPropertyValueKeys, readValueTags } from './metadata'
const props = defineProps<{ property: ThingModelProperty; value: ScalarValue[]; label: string; placeholder?: string; allowUnknown?: boolean }>()
const emit = defineEmits<{ (e: 'update:value', value: ScalarValue[]): void }>()
const { t: $t } = useI18n()
const type = computed(() => propertyValueType(props.property))
const options = computed(() => propertyValueChoices(props.property, props.value).map(choice => ({
  ...choice, label: choice.unavailable ? $t('PropertyRules.valueUnavailable', { value: choice.label }) : choice.label,
})))
const booleanOptions = computed(() => options.value.map(choice => ({ value: choice.rawValue, label: choice.label })))
const invalid = computed(() => type.value === 'enum' ? options.value.filter(option => option.unavailable).map(option => option.label).join('、') : '')
const selectedKeys = computed(() => type.value === 'enum' ? props.value.map(propertyValueKey) : props.value.map(String))
function updateValues(value: unknown) {
  if (!Array.isArray(value)) return
  const keys = value.filter((key): key is string => typeof key === 'string')
  emit('update:value', type.value === 'enum' ? readPropertyValueKeys(keys, props.property, props.value)
    : readValueTags(keys, isNumberProperty(props.property)))
}
</script>
<style scoped>
.rule-value-list { width: max-content; min-width: 6rem; max-width: min(16rem, 100%); }
</style>
