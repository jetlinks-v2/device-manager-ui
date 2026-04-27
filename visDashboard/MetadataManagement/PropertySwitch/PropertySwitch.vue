<template>
  <div
    class="property-switch"
    :style="style"
  >
    <div
      class="property-switch__title"
      :style="titleStyle"
      :title="displayTitle"
    >
      {{ displayTitle }}
    </div>

    <div class="property-switch__body">
      <div
        class="property-switch__value"
        :style="valueStyle"
      >
        {{ switchDisplayValue }}
      </div>

      <div class="property-switch__switch-wrap">
        <a-switch
          :checked="switchChecked"
          :style="switchStyle"
          @change="handleSwitchChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { dashboard } from '@device-manager-ui/api/dashboard'
import { detail, executeFunctions } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { onlyMessage } from '@jetlinks-web/utils'
import { debounce, throttle } from 'lodash-es'
import { map } from 'rxjs/operators'

defineOptions({
  name: 'PropertySwitch'
})

interface PropertySwitchComponentConfig {
  title?: string
  titleColor?: string
  titleFontSize?: number
  valueColor?: string
  valueFontSize?: number
  activeColor?: string
  inactiveColor?: string
  trueLabel?: string
  falseLabel?: string
  deviceId?: string
  deviceName?: string
  propertyId?: string
  propertyName?: string
  functionId?: string
  paramId?: string
}

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

const props = defineProps({
  info: {
    type: Object as PropType<DashboardCardInfo>,
    default: () => ({})
  },
  style: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()
const instanceStore = useInstanceStore()
const productStore = useProductStore()

const runtimeProductId = ref('')
const runtimeDeviceName = ref('')
const metadataText = ref('')
const propertyValue = ref<Record<string, any>>({})
const dataSource = ref<Record<string, any>[]>([])
const subRef = ref<any>()
const messageCache = new Map<string, Record<string, any>>()

const config = computed<PropertySwitchComponentConfig>(() => {
  return (props.info?.componentProps?.propertySwitch as PropertySwitchComponentConfig) || {}
})

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(config.value.deviceId || ''))
const runtimeDeviceId = computed(() =>
  isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')
)

const propertyMap = computed(() => {
  try {
    const properties = JSON.parse(metadataText.value || '{}').properties || []
    const mapData = new Map<string, Record<string, any>>()

    properties.forEach((item: Record<string, any>) => {
      mapData.set(String(item.id || ''), item)
    })

    return mapData
  } catch (error) {
    return new Map<string, Record<string, any>>()
  }
})

const selectedProperty = computed(() => {
  const id = String(config.value.propertyId || '')
  if (!id) return undefined
  return dataSource.value.find((item) => String(item.id || '') === id)
})

const propertyValueType = computed(() => selectedProperty.value?.valueType || {})

const displayTitle = computed(() => {
  const propertyTitle = config.value.propertyName || selectedProperty.value?.name || config.value.title || 'Switch'
  const deviceName = config.value.deviceName || runtimeDeviceName.value

  return deviceName ? `${deviceName}(${propertyTitle})` : propertyTitle
})

const rawValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  const valueData = propertyId ? propertyValue.value[propertyId] : undefined
  return valueData?.value
})

const toBoolean = (value: unknown, trueValue?: unknown, falseValue?: unknown) => {
  if (value === undefined || value === null) return false

  if (trueValue !== undefined && String(value) === String(trueValue)) return true
  if (falseValue !== undefined && String(value) === String(falseValue)) return false

  if (typeof value === 'boolean') return value
  const normalized = String(value).toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'on') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'off') return false

  return Boolean(value)
}

const trueValue = computed(() => propertyValueType.value?.trueValue ?? true)
const falseValue = computed(() => propertyValueType.value?.falseValue ?? false)
const boolValue = computed(() => toBoolean(rawValue.value, trueValue.value, falseValue.value))

const switchChecked = ref(boolValue.value)
const isUserSwitching = ref(false)

watch(boolValue, (val) => {
  if (isUserSwitching.value) return
  switchChecked.value = val
})

const switchDisplayValue = computed(() => {
  return switchChecked.value ? config.value.trueLabel || 'ON' : config.value.falseLabel || 'OFF'
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 16)}px`
}))

const valueStyle = computed(() => ({
  color: config.value.valueColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.valueFontSize || 24)}px`
}))

const switchStyle = computed(() => ({
  '--switch-color': config.value.activeColor || '#0f766e',
  '--switch-inactive-color': config.value.inactiveColor || '#d9d9d9'
}))

const valueChange = (arr: Record<string, any>[]) => {
  ;(arr || [])
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .forEach((item: any) => {
      const property = item?.value?.property
      if (property) {
        propertyValue.value[property] = { ...item, ...item.value }
      }
    })
}

const throttleFn = throttle(() => {
  const list = [...messageCache.values()]
  valueChange(list)
}, 500)

const subscribeProperty = () => {
  if (!runtimeDeviceId.value || !runtimeProductId.value || !dataSource.value.length) {
    return
  }

  const propertyIds = dataSource.value.map((item) => item.id)
  const id = `property-switch-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
  const topic = `/dashboard/device/${runtimeProductId.value}/properties/realTime`

  subRef.value = wsClient
    .getWebSocket(id, topic, {
      deviceId: runtimeDeviceId.value,
      properties: propertyIds,
      history: 1
    })
    ?.pipe(map((res: any) => res.payload))
    .subscribe((payload: any) => {
      if (payload?.value?.property) {
        messageCache.set(payload.value.property, payload)
        throttleFn()
      }
    })
}

const getDashboard = async () => {
  if (!runtimeDeviceId.value || !runtimeProductId.value || !dataSource.value.length) {
    subRef.value && subRef.value?.unsubscribe()
    return
  }

  const response: Record<string, any> = await dashboard([
    {
      dashboard: 'device',
      object: runtimeProductId.value,
      measurement: 'properties',
      dimension: 'history',
      params: {
        deviceId: runtimeDeviceId.value,
        history: 1,
        properties: dataSource.value.map((item) => item.id)
      }
    }
  ])

  if (response.status === 200) {
    const latestMap: Record<string, any> = {}
    ;(response.result || []).forEach((item: any) => {
      const payload = item?.data || {}
      const property = payload?.value?.property
      if (!property) return

      const existed = latestMap[property]
      if (!existed || Number(payload.timestamp || 0) >= Number(existed.timestamp || 0)) {
        latestMap[property] = {
          timeString: payload.timeString,
          timestamp: payload.timestamp,
          ...payload.value
        }
      }
    })

    propertyValue.value = {
      ...unref(propertyValue),
      ...latestMap
    }
  }

  subRef.value && subRef.value?.unsubscribe()
  subscribeProperty()
}

const resolveMetadata = async () => {
  if (!isProduct.value) {
    metadataText.value = instanceStore.current.metadata || instanceStore.detail.metadata || ''
    runtimeProductId.value = String(instanceStore.current.productId || instanceStore.detail.productId || '')
    runtimeDeviceName.value = String(instanceStore.current.name || instanceStore.detail.name || '')
    return
  }

  if (!targetDeviceId.value) {
    metadataText.value = productStore.detail.metadata || ''
    runtimeProductId.value = String(productStore.detail.id || '')
    runtimeDeviceName.value = ''
    return
  }

  const response = await detail(targetDeviceId.value, true)
  metadataText.value = response.result?.metadata || ''
  runtimeProductId.value = String(response.result?.productId || '')
  runtimeDeviceName.value = String(response.result?.name || '')
}

const handleProperty = debounce(async () => {
  subRef.value && subRef.value?.unsubscribe()
  messageCache.clear()
  propertyValue.value = {}

  await resolveMetadata()

  const propertyId = String(config.value.propertyId || '')
  const selected = propertyId ? propertyMap.value.get(propertyId) : undefined
  dataSource.value = selected ? [selected] : []

  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

const executeFunc = async (checked: boolean) => {
  const deviceId = runtimeDeviceId.value
  const functionId = String(config.value.functionId || '')
  const paramId = String(config.value.paramId || '')

  if (!deviceId || !functionId || !paramId || props.isEdit) {
    return
  }

  try {
    const res = await executeFunctions(deviceId, functionId, {
      [paramId]: checked
    })

    if (res.status === 200) {
      onlyMessage('操作成功')
    }
  } catch (e) {
    onlyMessage('操作失败', 'error')
  }
}

const handleSwitchChange = async (checked: boolean) => {
  isUserSwitching.value = true
  switchChecked.value = checked
  await executeFunc(checked)
  isUserSwitching.value = false
}

onUnmounted(() => {
  handleProperty.cancel()
  throttleFn.cancel()
  subRef.value && subRef.value?.unsubscribe()
})

watch(
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value, config.value.propertyId],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.property-switch {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 12px;
  background-color: #fff;
  overflow: hidden;
}

.property-switch__title {
  width: 100%;
  min-height: 22px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-switch__body {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.property-switch__value {
  line-height: 1;
  font-weight: 700;
  white-space: nowrap;
}

.property-switch__switch-wrap {
  flex-shrink: 0;
}

.property-switch__switch-wrap :deep(.ant-switch) {
  background-color: var(--switch-inactive-color);
}

.property-switch__switch-wrap :deep(.ant-switch.ant-switch-checked) {
  background-color: var(--switch-color);
}
</style>
