<template>
  <a-popover :trigger="['hover', 'focus']" placement="top">
    <template #content><span class="property-rule-metadata-description">{{ description }}</span></template>
    <span class="property-rule-metadata" tabindex="0" :aria-label="description"><AIcon :type="icon" aria-hidden="true" /><span>{{ shortLabel }}</span><span v-if="unit" class="property-rule-metadata-unit">{{ unit }}</span></span>
  </a-popover>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../alarm/types'
import { findTypeItem } from '../../../../components/Metadata/components/Type/data'
import { formatPropertyUnit } from '../../alarm/utils'
const props = defineProps<{ property: ThingModelProperty }>()
const { t: $t } = useI18n()
const type = computed(() => String(props.property.valueType?.type ?? props.property.type ?? props.property.dataType ?? ''))
const typeLabel = computed(() => findTypeItem(type.value)?.label ?? (type.value || $t('PropertyRules.metadata.unknown')))
const shortLabel = computed(() => {
  if (['int', 'long', 'double', 'float'].includes(type.value)) return $t('PropertyRules.metadata.type.number')
  const supported = ['string', 'boolean', 'enum', 'date', 'file', 'array', 'object', 'geoPoint', 'password'].includes(type.value)
  return $t(`PropertyRules.metadata.type.${supported ? type.value : 'unknown'}`)
})
const unit = computed(() => formatPropertyUnit(props.property.valueType?.unit))
const icon = computed(() => ({ int: 'NumberOutlined', long: 'NumberOutlined', double: 'NumberOutlined', float: 'NumberOutlined',
  string: 'FontSizeOutlined', boolean: 'CheckCircleOutlined', enum: 'UnorderedListOutlined', date: 'CalendarOutlined',
  file: 'FileOutlined', array: 'BarsOutlined', object: 'ProfileOutlined', geoPoint: 'EnvironmentOutlined', password: 'LockOutlined',
}[type.value] ?? 'QuestionCircleOutlined'))
const details = computed(() => {
  const value = props.property.valueType ?? {}
  if (['int', 'long', 'double', 'float'].includes(type.value)) return [formatPropertyUnit(value.unit),
    value.scale === undefined ? undefined : $t('PropertyRules.metadata.precision', { value: value.scale })].filter(Boolean)
  if (type.value === 'string') return value.maxLength === undefined ? [] : [$t('PropertyRules.metadata.length', { value: value.maxLength })]
  if (type.value === 'enum') return value.elements ? [$t('PropertyRules.metadata.elements', { count: value.elements.length })] : []
  if (type.value === 'boolean') return [value.trueText, value.falseText].filter(Boolean)
  if (type.value === 'date') return value.format ? [value.format] : []
  if (type.value === 'file') return value.bodyType ? [value.bodyType === 'base64' ? 'Base64' : value.bodyType === 'url' ? 'URL' : value.bodyType] : []
  if (type.value === 'object') return value.properties ? [$t('PropertyRules.metadata.fields', { count: value.properties.length })] : []
  if (type.value === 'array') return value.elementType?.type ? [findTypeItem(value.elementType.type)?.label ?? value.elementType.type] : []
  return []
})
const description = computed(() => [typeLabel.value, ...details.value].join(' · '))
</script>
<style scoped>
.property-rule-metadata { display: inline-flex; align-items: center; gap: var(--space-1); min-width: 0; max-width: 100%; padding-inline: var(--space-1); border-radius: var(--radius-sm, 4px); background: var(--bg-sunken); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); font-weight: normal; line-height: 20px; cursor: help; }
.property-rule-metadata-unit { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px; padding-inline-start: var(--space-1); border-inline-start: 1px solid var(--line); }
.property-rule-metadata-description { font-size: var(--fs-12); line-height: 1.7; }
.property-rule-metadata:focus-visible { outline: 1px solid var(--jet-theme-primary); outline-offset: 2px; border-radius: 2px; }
</style>
