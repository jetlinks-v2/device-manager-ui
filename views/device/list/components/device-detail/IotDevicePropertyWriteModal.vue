<template>
  <a-modal
    :open="open"
    :confirm-loading="loading"
    :ok-text="$t('IotDeviceDetail.propertyWrite.okText')"
    :cancel-text="$t('IotDeviceDetail.common.cancel')"
    @update:open="emit('update:open', $event)"
    @ok="submit"
  >
    <template #title>
      <a-space>
        <div class="property-read-title-icon">
          <AIcon type="EditOutlined"/>
        </div>
        <div class="property-read-title-text">{{title}}</div>
      </a-space>
    </template>
    <a-form v-if="property" layout="vertical" class="property-write-modal">
      <a-form-item :label="$t('IotDeviceDetail.propertyWrite.currentValue')">
        <JsonViewer
          v-if="structuredCurrentValue"
          class="property-write-modal__json"
          :expand-depth="5"
          :value="structuredCurrentValue"
        />
        <div v-else class="property-write-modal__current">
          {{ $t('IotDeviceDetail.propertyWrite.currentValueDetail', { value: currentValueText, time: property.updatedAt || $t('IotDeviceDetail.common.time.justNow') }) }}
        </div>
      </a-form-item>
      <a-form-item :label="$t('IotDeviceDetail.propertyWrite.newValue')" required>
        <a-textarea
          v-if="isStructured"
          v-model:value="structuredDraft"
          class="property-write-modal__json-editor"
          :rows="8"
          spellcheck="false"
        />
        <a-select
          v-else-if="selectedOptions.length"
          v-model:value="writeDraft"
          :options="selectedOptions"
        />
        <a-switch
          v-else-if="property.dataType === 'boolean'"
          v-model:checked="writeDraft"
        />
        <a-input-number
          v-else-if="isNumber"
          v-model:value="writeDraft"
          :addon-after="property.unit"
          style="width: 100%"
        />
        <a-input v-else v-model:value="writeDraft" />
        <div v-if="jsonError" class="property-write-modal__json-error">{{ jsonError }}</div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import {
  formatPropertyValueWithUnit,
  isStructuredPropertyType,
  parseStructuredPropertyValue,
  splitPropertyValueAndUnit,
} from './iotDevicePropertyDisplay'

export type PropertyWriteValue = string | number | boolean | Record<string, unknown> | unknown[] | null | undefined

const props = defineProps<{
  open: boolean
  property: RealtimePropertyRow | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [value: PropertyWriteValue]
}>()

const { t: $t } = useI18n()
const writeDraft = ref<PropertyWriteValue>()
const structuredDraft = ref('')
const jsonError = ref('')
const writeStrategy = ref('sync')

const title = computed(() => props.property ? $t('IotDeviceDetail.propertyWrite.titleWithName', { name: props.property.name }) : $t('IotDeviceDetail.propertyWrite.title'))
const currentValueText = computed(() => props.property ? formatPropertyValueWithUnit(props.property.value, props.property.unit) : '--')
const isStructured = computed(() => isStructuredPropertyType(props.property?.valueType, props.property?.dataType))
const structuredCurrentValue = computed(() => props.property
  ? parseStructuredPropertyValue(props.property.value)
  : undefined)
const isNumber = computed(() => ['int', 'long', 'float', 'double', 'number'].includes(props.property?.dataType || ''))
const selectedOptions = computed(() => {
  const elements = props.property?.valueType?.elements
  if (!Array.isArray(elements)) return []
  return elements.map((item: Record<string, PropertyWriteValue>) => ({
    label: String(item.text || item.label || item.value || ''),
    value: item.value,
  }))
})

const writeStrategyOptions = [
  { label: $t('IotDeviceDetail.propertyWrite.strategy.sync'), value: 'sync' },
  { label: $t('IotDeviceDetail.propertyWrite.strategy.async'), value: 'async' },
]

watch(
  () => [props.open, props.property] as const,
  ([open, property]) => {
    if (!open || !property) return
    writeDraft.value = normalizeDraft(property)
    structuredDraft.value = isStructuredPropertyType(property.valueType, property.dataType)
      ? formatStructuredValue(property.value)
      : ''
    jsonError.value = ''
  },
  { immediate: true },
)

function normalizeDraft(property: RealtimePropertyRow): PropertyWriteValue {
  const displayValue = splitPropertyValueAndUnit(property.value, property.unit).value
  if (property.dataType === 'boolean') return displayValue === 'true'
  if (['int', 'long', 'float', 'double', 'number'].includes(property.dataType)) {
    const value = Number(displayValue)
    return Number.isNaN(value) ? undefined : value
  }
  return displayValue
}

function formatStructuredValue(value: unknown): string {
  const parsed = parseStructuredPropertyValue(value)
  if (!parsed) return typeof value === 'string' ? value : ''
  return JSON.stringify(parsed, null, 2)
}

function submit() {
  if (!isStructured.value) {
    emit('confirm', writeDraft.value)
    return
  }

  try {
    const value = JSON.parse(structuredDraft.value)
    const expectedType = props.property?.dataType
    if ((expectedType === 'object' && (Array.isArray(value) || !value || typeof value !== 'object'))
      || (expectedType === 'array' && !Array.isArray(value))) {
      throw new Error('type')
    }
    jsonError.value = ''
    emit('confirm', value)
  } catch {
    jsonError.value = $t('IotDeviceDetail.propertyWrite.jsonInvalid')
  }
}
</script>

<style scoped src="./IotDeviceDataTableTab.css"></style>
