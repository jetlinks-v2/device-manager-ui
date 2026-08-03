<template>
  <div class="alarm-state-condition-row">
    <div class="alarm-state-condition-row__product">
      <IotAlarmTargetSelect
        :model-value="modelValue.options?.productId"
        :request="requestProducts"
        :selected-option="selectedProduct"
        :placeholder="$t('IotSceneLinkage.placeholder.product')"
        rich
        @change="changeProduct"
      />
    </div>
    <div class="alarm-state-condition-row__device">
      <IotAlarmTargetSelect
        :model-value="modelValue.options?.deviceId"
        :request="requestDevices"
        :selected-option="selectedDevice"
        :reload-key="modelValue.options?.productId"
        :placeholder="$t('IotSceneLinkage.placeholder.device')"
        :disabled="!modelValue.options?.productId"
        rich
        option-type="device"
        @change="changeDevice"
      />
    </div>
    <span class="alarm-state-condition-row__word">{{ $t('IotSceneLinkage.alarmPhrase.ofAlarm') }}</span>
    <div class="alarm-state-condition-row__alarm-config">
      <a-select
        class="alarm-state-condition-row__alarm"
        :value="modelValue.alarmConfigId"
        :options="options"
        :loading="loading"
        :placeholder="$t('IotSceneLinkage.placeholder.alarmConfig')"
        :disabled="!modelValue.options?.productId"
        show-search
        :filter-option="filterAlarmOption"
        @dropdown-visible-change="loadOptions"
        @change="changeAlarmConfig"
      >
        <template #option="option">
          <IotAlarmTargetOption :option="alarmOption(option)" type="alarm" />
        </template>
      </a-select>
      <span>{{ $t('IotSceneLinkage.alarmPhrase.currentState') }}</span>
      <a-select :value="modelValue.state || 'warning'" :options="stateOptions" @change="changeState" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProduct, queryDeviceAlarmPreprocesses, queryDevicesPage, queryProducts } from '../../../../api/scene-linkage'
import IotAlarmTargetSelect, { type IotAlarmTargetSelectOption, type IotAlarmTargetSelectQuery } from '../../../device/alarm/components/IotAlarmTargetSelect.vue'
import IotAlarmTargetOption from '../../../device/alarm/components/IotAlarmTargetOption.vue'
import { formatTriggerText } from '../../../device/alarm/utils'
import { normalizeResult, type SceneAlarmTriggerConfig } from '../../utils'
import { enrichDeviceOptionData } from '../deviceOptionData'

type AlarmConfigOption = { label: string; value: string; targetType: string; scope: 'device' | 'product'; detail: string }

const props = defineProps({ modelValue: { type: Object as PropType<SceneAlarmTriggerConfig>, required: true } })
const emit = defineEmits<{ (event: 'update:modelValue', value: SceneAlarmTriggerConfig): void }>()

const { t } = useI18n()
const loading = ref(false)
const optionsLoaded = ref(false)
const options = ref<AlarmConfigOption[]>([])
const selectedProduct = ref<IotAlarmTargetSelectOption>()
const selectedDevice = ref<IotAlarmTargetSelectOption>()
const stateOptions = computed(() => [
  { value: 'warning', label: t('IotSceneLinkage.alarmState.warning') },
  { value: 'normal', label: t('IotSceneLinkage.alarmState.normal') },
])

function toOption(item: Record<string, any>): AlarmConfigOption | undefined {
  const alarm = item.alarm || {}
  const processor = (alarm.configuration?.processors || []).find((item: Record<string, any>) => item.provider === 'device-alarm')
  const name = processor?.configuration?.alarmName || item.propertyName || alarm.name
  const propertyName = item.propertyName || alarm.propertyName || alarm.property || ''
  const matcher = alarm.configuration?.matcher || {}
  const matcherConfig = matcher.configuration || {}
  const triggerText = matcher.provider === 'number-range'
    ? formatTriggerText({
        propertyName,
        trigger: matcherConfig.not === false ? 'inside' : 'outside',
        limit: { lower: matcherConfig.min, upper: matcherConfig.max },
      })
    : propertyName
  if (!alarm.id || !name) return undefined
  const detail = triggerText ? t('IotDeviceDetail.overview.alarmTrigger', { value: triggerText }) : ''
  return {
    label: name,
    value: String(alarm.id),
    targetType: 'device',
    scope: String(alarm.thingId || '') === props.modelValue.options?.deviceId ? 'device' : 'product',
    detail,
  }
}

const alarmOption = (option: any): AlarmConfigOption =>
  option?.data?.value ? option.data : option

function filterAlarmOption(input: string, option: any) {
  const keyword = input.trim().toLocaleLowerCase()
  if (!keyword) return true
  const item = alarmOption(option)
  return [item.label, item.detail]
    .filter(Boolean)
    .some(value => String(value).toLocaleLowerCase().includes(keyword))
}

async function requestProducts(query: IotAlarmTargetSelectQuery) {
  const terms = query.keyword ? [{ column: 'name', termType: 'like', value: `%${query.keyword}%`, type: 'or' }, { column: 'id', termType: 'like', value: `%${query.keyword}%`, type: 'or' }] : []
  const result = normalizeResult(await queryProducts({ pageIndex: query.pageIndex, pageSize: query.pageSize, terms, sorts: [{ name: 'createTime', order: 'desc' }] }))
  return { data: result.data.map((item: Record<string, any>) => ({ label: item.name || item.id, value: String(item.id), data: item })) }
}

async function requestDevices(query: IotAlarmTargetSelectQuery) {
  const result = normalizeResult(await queryDevicesPage({ pageIndex: query.pageIndex, pageSize: query.pageSize, terms: [{ column: 'productId', termType: 'eq', value: props.modelValue.options?.productId }, ...(query.keyword ? [{ column: 'name', termType: 'like', value: `%${query.keyword}%` }] : [])], sorts: [{ name: 'createTime', order: 'desc' }] }))
  const devices = await enrichDeviceOptionData(result.data)
  return { data: devices.map((item: Record<string, any>) => ({ label: item.name || item.id, value: String(item.id), data: item })) }
}

function alarmTerms() {
  const deviceId = props.modelValue.options?.deviceId
  const productId = String(props.modelValue.options?.productId || '')
  if (!productId) return []
  // 未指定设备时只查询产品级告警，与告警触发条件保持一致。
  if (!deviceId) return [
    { column: 'templateId', termType: 'eq', value: productId },
    { column: 'thingId', termType: 'eq', value: '@all' },
  ]
  return [
    { column: 'templateId', termType: 'eq', value: productId },
    { column: 'thingId', termType: 'in', value: [deviceId, '@all'] },
  ]
}

function productAlarmTerms(productId?: string) {
  return productId ? [
    { column: 'templateId', termType: 'eq', value: productId },
    { column: 'thingId', termType: 'eq', value: '@all' },
  ] : []
}

function deviceAlarmTerms(deviceId?: string) {
  const productId = props.modelValue.options?.productId
  return deviceId && productId ? [
    { column: 'templateId', termType: 'eq', value: productId },
    { column: 'thingId', termType: 'eq', value: deviceId },
  ] : []
}

async function requestOptions(terms = alarmTerms()) {
  const result = normalizeResult(await queryDeviceAlarmPreprocesses({ pageIndex: 0, pageSize: 100, terms, sorts: [{ name: 'createTime', order: 'desc' }] }))
  const candidates = result.data.map(item => ({ option: toOption(item), property: String(item.alarm?.property || item.alarm?.id || '') })).filter((item): item is { option: AlarmConfigOption; property: string } => Boolean(item.option)).sort((left, right) => Number(right.option.scope === 'device') - Number(left.option.scope === 'device'))
  const covered = new Set<string>()
  return candidates.filter(item => !covered.has(item.property) && Boolean(covered.add(item.property))).map(item => item.option)
}

async function loadOptions(open: boolean) {
  if (!open || optionsLoaded.value || loading.value) return
  loading.value = true
  try {
    options.value = await requestOptions()
    optionsLoaded.value = true
  } finally {
    loading.value = false
  }
}

async function loadProductOptions(productId?: string) {
  if (!productId) return
  loading.value = true
  try {
    options.value = await requestOptions(productAlarmTerms(productId))
    optionsLoaded.value = true
  } finally {
    loading.value = false
  }
}

async function loadDeviceOptions(deviceId?: string) {
  if (!deviceId) return
  loading.value = true
  try {
    const deviceOptions = await requestOptions(deviceAlarmTerms(deviceId))
    options.value = [...options.value.filter(item => item.scope === 'product'), ...deviceOptions]
    optionsLoaded.value = true
  } finally {
    loading.value = false
  }
}

function changeProduct(value?: string, option?: IotAlarmTargetSelectOption) {
  selectedProduct.value = option
  selectedDevice.value = undefined
  options.value = []
  optionsLoaded.value = false
  emit('update:modelValue', { ...props.modelValue, alarmConfigId: undefined, targetType: undefined, options: { productId: value } })
  void loadProductOptions(value)
}

function changeDevice(value?: string, option?: IotAlarmTargetSelectOption) {
  selectedDevice.value = option
  options.value = options.value.filter(item => item.scope === 'product')
  optionsLoaded.value = false
  emit('update:modelValue', { ...props.modelValue, alarmConfigId: undefined, targetType: undefined, options: { ...props.modelValue.options, deviceId: value } })
  void loadDeviceOptions(value)
}

function changeAlarmConfig(value: unknown) {
  if (typeof value !== 'string') return
  const option = options.value.find(item => item.value === value)
  emit('update:modelValue', { ...props.modelValue, alarmConfigId: value, targetType: option?.targetType, options: { ...props.modelValue.options, alarmConfigName: option?.label } })
}

function changeState(value: unknown) {
  if (value === 'warning' || value === 'normal') emit('update:modelValue', { ...props.modelValue, state: value })
}

async function loadSelectedConfig(id?: string) {
  if (!id || options.value.some(item => item.value === id)) return
  const option = (await requestOptions()).find(item => item.value === id)
  if (!option) return
  options.value = [option, ...options.value]
  if (!props.modelValue.targetType || props.modelValue.options?.alarmConfigName !== option.label) {
    emit('update:modelValue', { ...props.modelValue, targetType: option.targetType, options: { ...props.modelValue.options, alarmConfigName: option.label } })
  }
}

async function loadSelectedProduct(id?: string) {
  if (!id || selectedProduct.value?.value === id) return
  const response: any = await getProduct(id)
  const product = response?.result ?? response
  if (product?.id) selectedProduct.value = { label: product.name || product.id, value: String(product.id), data: product }
}

async function loadSelectedDevice(id?: string) {
  if (!id || selectedDevice.value?.value === id) return
  const result = normalizeResult(await queryDevicesPage({ pageIndex: 0, pageSize: 1, terms: [{ column: 'id', termType: 'eq', value: id }] }))
  const device = (await enrichDeviceOptionData(result.data))[0]
  if (device?.id) selectedDevice.value = { label: device.name || device.id, value: String(device.id), data: device }
}

watch(() => props.modelValue.options?.productId, id => void loadSelectedProduct(id), { immediate: true })
watch(() => props.modelValue.options?.deviceId, id => void loadSelectedDevice(id), { immediate: true })
watch(() => [props.modelValue.alarmConfigId, props.modelValue.options?.productId, props.modelValue.options?.deviceId], ([id]) => void loadSelectedConfig(id), { immediate: true })
</script>

<style scoped>
.alarm-state-condition-row { display: grid; grid-template-columns: var(--scene-linkage-resource-select-width, 10.5rem) 18rem max-content; gap: 8px; width: 100%; min-width: 0; align-items: center; justify-content: start; }
.alarm-state-condition-row__product { grid-column: 1; grid-row: 1; }
.alarm-state-condition-row__device { grid-column: 2; grid-row: 1; }
.alarm-state-condition-row__word { grid-column: 3; grid-row: 1; }
.alarm-state-condition-row__alarm-config { display: grid; grid-column: 1 / -1; grid-row: 2; grid-template-columns: minmax(10rem, 18rem) max-content 8rem; gap: 8px; min-width: 0; align-items: center; justify-content: start; }
.alarm-state-condition-row__word, .alarm-state-condition-row__alarm-config > span { white-space: nowrap; }
.alarm-state-condition-row :deep(.alarm-state-condition-row__alarm), .alarm-state-condition-row :deep(.ant-select) { width: 100% !important; min-width: 0; }
</style>
