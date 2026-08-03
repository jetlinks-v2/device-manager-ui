<template>
  <a-modal
    :open="open"
    :confirm-loading="loading"
    :ok-text="$t('IotDeviceDetail.propertyWrite.okText')"
    :cancel-text="$t('IotDeviceDetail.common.cancel')"
    @update:open="emit('update:open', $event)"
    @ok="emit('confirm', writeDraft)"
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
        <div class="property-write-modal__current">
          {{ $t('IotDeviceDetail.propertyWrite.currentValueDetail', { value: currentValueText, time: property.updatedAt || $t('IotDeviceDetail.common.time.justNow') }) }}
        </div>
      </a-form-item>
      <a-form-item :label="$t('IotDeviceDetail.propertyWrite.newValue')" required>
        <a-select
          v-if="selectedOptions.length"
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
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { formatPropertyValueWithUnit, splitPropertyValueAndUnit } from './iotDevicePropertyDisplay'

export type PropertyWriteValue = string | number | boolean | null | undefined

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
const writeStrategy = ref('sync')

const title = computed(() => props.property ? $t('IotDeviceDetail.propertyWrite.titleWithName', { name: props.property.name }) : $t('IotDeviceDetail.propertyWrite.title'))
const currentValueText = computed(() => props.property ? formatPropertyValueWithUnit(props.property.value, props.property.unit) : '--')
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
</script>

<style scoped src="./IotDeviceDataTableTab.css"></style>
