<template>
  <a-modal :open="state.open.value" :title="t('sourceTitle')" :width="640" :mask-closable="false" @cancel="state.cancel">
    <a-alert v-if="unsupported" type="warning" :message="t('unsupported')" />
    <a-form v-else layout="vertical">
      <a-radio-group :value="state.scoped.value" @change="state.changeScope($event.target.value)">
        <a-radio-button :value="true">{{ t('scope') }}</a-radio-button>
        <a-radio-button :value="false">{{ t('all') }}</a-radio-button>
      </a-radio-group>
      <a-input-search v-model:value="state.keyword.value" :placeholder="t('search')" @search="state.page.value = 1; state.search()" />
      <a-alert v-if="state.error.value" type="error" :message="t('failed')">
        <template #action><a-button @click="retry">{{ t('retry') }}</a-button></template>
      </a-alert>
      <a-form-item :label="t('device')">
        <a-select :value="state.deviceId.value || undefined" :loading="state.loading.value" :placeholder="t('selectDevice')" :options="deviceOptions" @change="(value: unknown) => state.selectDevice(String(value))" />
        <a-empty v-if="!state.loading.value && !state.error.value && !state.devices.value.length" :description="t('empty')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        <a-pagination v-if="state.total.value > 20" size="small" :current="state.page.value" :total="state.total.value" :page-size="20" @change="state.changePage" />
      </a-form-item>
      <a-form-item :label="t('property')">
        <a-select v-model:value="state.propertyId.value" :disabled="!state.deviceId.value || state.propertyLoading.value" :loading="state.propertyLoading.value" :options="propertyOptions" :placeholder="t('selectProperty')" show-search option-filter-prop="label" />
      </a-form-item>
      <p v-if="state.request.value?.input.unit" class="metric-source-unit">{{ t('inputUnit') }}: {{ state.request.value.input.unit }} · {{ t('sourceUnit') }}: {{ selectedProperty?.unit || t('noUnit') }}</p>
      <p v-if="state.request.value?.input.unit && selectedProperty?.unit && state.request.value.input.unit !== selectedProperty.unit" class="metric-source-unit">{{ t('unitHint') }}</p>
    </a-form>
    <template #footer>
      <a-button @click="state.cancel">{{ t('cancel') }}</a-button>
      <a-button type="primary" :disabled="unsupported || !state.canConfirm.value" @click="state.confirm">{{ t('confirm') }}</a-button>
    </template>
  </a-modal>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { metricHostMessages } from './messages'
import type { MetricSourcePickerState } from './useMetricSourcePicker'
const props = defineProps<{ state: MetricSourcePickerState }>()
const { t } = useI18n({ useScope: 'local', messages: metricHostMessages })
const unsupported = computed(() => props.state.request.value?.input.source?.kind === 'metric')
const deviceOptions = computed(() => props.state.devices.value.map(device => ({ value: device.id, label: device.name })))
const propertyOptions = computed(() => [
  { value: '$online', label: t('online') },
  ...props.state.properties.value.map(property => ({ value: property.id, label: property.unit ? `${property.name} (${property.unit})` : property.name })),
])
const selectedProperty = computed(() => props.state.properties.value.find(property => property.id === props.state.propertyId.value))
function retry() { void props.state.search(); if (props.state.deviceId.value) void props.state.selectDevice(props.state.deviceId.value, true) }
</script>
<style scoped>
.ant-form { display:grid; gap:var(--space-3,12px) }
.ant-form-item { margin-bottom:0 }
.metric-source-unit { color:var(--jet-theme-text-secondary); margin:0 }
</style>
