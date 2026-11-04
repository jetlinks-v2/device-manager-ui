<template>
  <div class="alarm-target-form">
    <template v-if="!fixedProductScope">
      <a-form-item :label="$t('DeviceAlarm.form.product')" required>
        <IotAlarmTargetSelect :model-value="model.productId" :request="productRequest" :selected-option="productOption"
          :reload-key="productReloadKey" load-on-reload :placeholder="$t('DeviceAlarm.placeholder.productSearch')"
          :disabled="readonlyScope" @change="(_value, option) => emit('product-change', option)" />
      </a-form-item>
      <a-form-item :label="$t('DeviceAlarm.form.deviceRange')" required>
        <IotAlarmTargetSelect :model-value="deviceValue" :request="deviceRequest" :selected-option="deviceOption"
          :static-options="allDeviceOption" :reload-key="model.productId" :placeholder="$t('DeviceAlarm.placeholder.deviceSearch')"
          :disabled="readonlyScope" @change="(value, option) => emit('device-change', value, option)" />
      </a-form-item>
    </template>
    <a-form-item :label="$t('DeviceAlarm.form.property')" required>
      <a-select show-search :value="model.property" :disabled="readonlyScope" :options="propertySelectOptions"
        :placeholder="$t('DeviceAlarm.placeholder.property')" @change="(value: unknown) => emit('property-change', String(value))" />
    </a-form-item>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IotAlarmTargetSelect from '../IotAlarmTargetSelect.vue'
import type { IotAlarmTargetSelectOption, IotAlarmTargetSelectQuery } from '../IotAlarmTargetSelect.vue'
import type { DeviceAlarmFormModel, DeviceAlarmTargetOption, ThingModelProperty } from '../../types'
import { propertyIdOf, propertyNameOf } from '../../utils'
const props = defineProps<{
  model: DeviceAlarmFormModel
  fixedProductScope: boolean
  readonlyScope: boolean
  productOption?: DeviceAlarmTargetOption
  deviceOption?: DeviceAlarmTargetOption
  productReloadKey: number
  productRequest: (query: IotAlarmTargetSelectQuery) => Promise<{ data: IotAlarmTargetSelectOption[] }>
  deviceRequest: (query: IotAlarmTargetSelectQuery) => Promise<{ data: IotAlarmTargetSelectOption[] }>
  propertyOptions: ThingModelProperty[]
}>()
const emit = defineEmits<{
  (e: 'product-change', option?: IotAlarmTargetSelectOption): void
  (e: 'device-change', value?: string, option?: IotAlarmTargetSelectOption): void
  (e: 'property-change', value: string): void
}>()
const { t: $t } = useI18n()
const deviceValue = computed(() => props.model.source === 'device' ? props.model.deviceId : '__all__')
const allDeviceOption = computed(() => [{ label: $t('DeviceAlarm.deviceRange.all'), value: '__all__' }])
const propertySelectOptions = computed(() => props.propertyOptions.map(property => ({
  label: propertyNameOf(property), value: propertyIdOf(property), disabled: Boolean(property.alarmConfigured),
})))
</script>
<style scoped>
.alarm-target-form { display: grid; gap: var(--space-5); }
.alarm-target-form :deep(.ant-form-item) { margin-bottom: 0; }
.alarm-target-form :deep(.ant-select) { width: 100%; }
</style>
