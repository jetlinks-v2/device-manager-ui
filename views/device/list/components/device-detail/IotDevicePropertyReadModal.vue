<template>
  <a-modal
    :open="open"
    :confirm-loading="loading"
    :ok-text="$t('IotDeviceDetail.propertyRead.okText')"
    :cancel-text="$t('IotDeviceDetail.propertyRead.cancelText')"
    @update:open="emit('update:open', $event)"
    @ok="emit('confirm')"
  >
    <template #title>
      <a-space>
        <div class="property-read-title-icon">
          <AIcon type="ReloadOutlined"/>
        </div>
        <div class="property-read-title-text">{{title}}</div>
      </a-space>
    </template>
    <section v-if="property" class="property-read-modal">
      <div class="property-read-modal__value">
        <span>{{ $t('IotDeviceDetail.runtime.currentValue') }}</span>
        <strong>{{ propertyDisplayValue(property) }}</strong>
        <em v-if="propertyDisplayUnit(property)">{{ propertyDisplayUnit(property) }}</em>
        <small>{{ $t('IotDeviceDetail.propertyRead.reportedAt', { time: property.updatedAt || $t('IotDeviceDetail.common.time.justNow') }) }}</small>
      </div>
      <dl class="property-modal-meta">
        <div><dt>{{ $t('IotDeviceDetail.runtime.dataType') }}</dt><dd>{{ property?.valueType?.type }}</dd></div>
        <div><dt>{{ $t('IotDeviceDetail.runtime.accessMode') }}</dt><dd>{{ accessModeText(property) }}</dd></div>
        <div><dt>{{ $t('IotDeviceDetail.detail.lastReport') }}</dt><dd>{{ property.updatedAt || '--' }}</dd></div>
      </dl>
    </section>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { getPropertyDisplayUnit, getPropertyDisplayValue } from './iotDevicePropertyDisplay'

const props = defineProps<{
  open: boolean
  property: RealtimePropertyRow | null
  tone: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const { t: $t } = useI18n()
const title = computed(() => props.property ? $t('IotDeviceDetail.propertyRead.titleWithName', { name: props.property.name }) : $t('IotDeviceDetail.runtime.read'))
const propertyDisplayValue = getPropertyDisplayValue
const propertyDisplayUnit = getPropertyDisplayUnit

function rangeText(item: RealtimePropertyRow) {
  const min = item.valueType?.min ?? item.valueType?.minimum
  const max = item.valueType?.max ?? item.valueType?.maximum
  if (min !== undefined || max !== undefined) return `${min ?? 0} ~ ${max ?? 100}${item.unit ? ` (${item.unit})` : ''}`
  return item.unit ? `0 ~ 100 (${item.unit})` : '--'
}

function accessModeText(item: RealtimePropertyRow) {
  if (item.accessMode === 'readwrite') return $t('IotDeviceDetail.runtime.filter.readwrite')
  if (item.accessMode === 'write') return $t('IotDeviceDetail.runtime.filter.write')
  if (item.accessMode === 'none') return $t('IotDeviceDetail.common.unconfigured')
  return $t('IotDeviceDetail.runtime.filter.read')
}
</script>

<style scoped src="./IotDeviceDataTableTab.css"></style>
