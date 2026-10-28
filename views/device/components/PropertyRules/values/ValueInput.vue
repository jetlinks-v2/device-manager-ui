<template>
  <a-input-number v-if="numeric" :value="typeof value === 'number' ? value : undefined" size="small" :controls="false" :placeholder="placeholder ?? label" :aria-label="label" @update:value="$emit('update:value', $event)" />
  <a-select v-else-if="type === 'boolean'" :value="value" size="small" :aria-label="label" :placeholder="placeholder ?? label" :options="[{ value: true, label: 'true' }, { value: false, label: 'false' }]" :get-popup-container="getPopupContainer" @update:value="$emit('update:value', $event)" />
  <a-select v-else-if="type === 'enum'" :value="value" size="small" :aria-label="label" :placeholder="placeholder ?? label" :options="options" :get-popup-container="getPopupContainer" @update:value="$emit('update:value', $event)" />
  <a-input v-else :value="typeof value === 'string' ? value : ''" size="small" :aria-label="label" :placeholder="placeholder ?? label" @update:value="$emit('update:value', $event)" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { ThingModelProperty } from '../../../alarm/types'
import { isNumberProperty } from '../../../alarm/utils'
import type { ScalarValue } from './config'
const props = defineProps<{ property: ThingModelProperty; value?: ScalarValue | null; label: string; placeholder?: string; getPopupContainer?: (trigger: HTMLElement) => HTMLElement }>()
defineEmits<{ (e: 'update:value', value: ScalarValue | null): void }>()
const type = computed(() => props.property.valueType?.type ?? props.property.type ?? props.property.dataType)
const numeric = computed(() => isNumberProperty(props.property))
const options = computed(() => props.property.valueType?.elements?.map(item => ({ value: item.value, label: item.text ?? String(item.value) })) ?? [])
</script>
