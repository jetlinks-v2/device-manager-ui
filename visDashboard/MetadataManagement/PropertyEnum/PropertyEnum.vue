<template>
  <div
    class="property-enum"
    :style="style"
  >
    <div
      class="property-enum__title"
      :style="titleStyle"
      :title="displayTitle"
    >
      {{ displayTitle }}
    </div>

    <div class="property-enum__body">
      <div
        v-if="enumOptions.length"
        class="property-enum__options"
        :style="optionsStyle"
      >
        <div
          v-for="option in enumOptions"
          :key="String(option.value)"
          class="property-enum__option"
          :class="{
            'property-enum__option--active': isOptionActive(option.value),
            'property-enum__option--disabled': props.isEdit || !canExecute
          }"
          :style="getOptionStyle(option.value)"
          @click="handleOptionClick(option.value)"
        >
          <AIcon
            :type="config.icon || 'RocketOutlined'"
            class="property-enum__option-icon"
            :style="iconStyle"
          />
          <span>{{ option.text }}</span>
        </div>
      </div>

      <a-empty
        v-else
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        description="暂无枚举项"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { Empty } from 'ant-design-vue'
import { dashboard } from '@device-manager-ui/api/dashboard'
import { detail, executeFunctions } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { onlyMessage } from '@jetlinks-web/utils'
import { debounce, throttle } from 'lodash-es'
import { map } from 'rxjs/operators'

defineOptions({
  name: 'PropertyEnum'
})

interface EnumItem {
  text?: string
  label?: string
  value?: string | number | boolean
}

interface PropertyEnumComponentConfig {
  title?: string
  titleColor?: string
  titleFontSize?: number
  icon?: string
  iconColor?: string
  iconSize?: number
  valueColor?: string
  valueFontSize?: number
  activeColor?: string
  inactiveColor?: string
  activeTextColor?: string
  inactiveTextColor?: string
  borderColor?: string
  borderRadius?: number
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
const pendingValue = ref<unknown>()
const isUserSelecting = ref(false)

const config = computed<PropertyEnumComponentConfig>(() => {
  return (props.info?.componentProps?.propertyEnum as PropertyEnumComponentConfig) || {}
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

const enumOptions = computed(() => {
  const elements = propertyValueType.value?.elements || []
  return (elements as EnumItem[]).map((item) => ({
    text: item.text ?? item.label ?? String(item.value ?? ''),
    value: item.value
  }))
})

const displayTitle = computed(() => {
  const propertyTitle = config.value.propertyName || selectedProperty.value?.name || config.value.title || 'Enum'
  const deviceName = config.value.deviceName || runtimeDeviceName.value

  return deviceName ? `${deviceName}(${propertyTitle})` : propertyTitle
})

const rawValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  const valueData = propertyId ? propertyValue.value[propertyId] : undefined
  return valueData?.value
})

const currentValue = computed(() => {
  if (isUserSelecting.value && pendingValue.value !== undefined) {
    return pendingValue.value
  }
  return rawValue.value
})

const canExecute = computed(() => {
  return Boolean(runtimeDeviceId.value && config.value.functionId && config.value.paramId)
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 16)}px`
}))

const optionsStyle = computed(() => ({
  '--property-enum-border-color': config.value.borderColor || '#0f766e',
  '--property-enum-border-radius': `${Number(config.value.borderRadius || 8)}px`
}))

const iconStyle = computed(() => ({
  color: config.value.iconColor || 'currentColor',
  fontSize: `${Number(config.value.iconSize || 16)}px`
}))

const isOptionActive = (value: unknown) => String(currentValue.value) === String(value)

const getOptionStyle = (value: unknown) => {
  const active = isOptionActive(value)

  return {
    backgroundColor: active ? config.value.activeColor || '#0f766e' : config.value.inactiveColor || '#ffffff',
    color: active ? config.value.activeTextColor || '#ffffff' : config.value.inactiveTextColor || 'rgba(0, 0, 0, 0.88)',
    fontSize: `${Number(config.value.valueFontSize || 18)}px`
  }
}

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
  const id = `property-enum-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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
  pendingValue.value = undefined
  isUserSelecting.value = false

  await resolveMetadata()

  const propertyId = String(config.value.propertyId || '')
  const selected = propertyId ? propertyMap.value.get(propertyId) : undefined
  dataSource.value = selected ? [selected] : []

  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

const executeFunc = async (value: unknown) => {
  const deviceId = runtimeDeviceId.value
  const functionId = String(config.value.functionId || '')
  const paramId = String(config.value.paramId || '')

  if (!deviceId || !functionId || !paramId || props.isEdit) {
    return
  }

  try {
    const res = await executeFunctions(deviceId, functionId, {
      [paramId]: value
    })

    if (res.status === 200) {
      onlyMessage('操作成功')
    }
  } catch (e) {
    onlyMessage('操作失败', 'error')
    throw e
  }
}

const handleOptionClick = async (value: unknown) => {
  if (props.isEdit || !canExecute.value || isOptionActive(value)) {
    return
  }

  isUserSelecting.value = true
  pendingValue.value = value

  try {
    await executeFunc(value)
  } catch (e) {
    pendingValue.value = rawValue.value
  } finally {
    setTimeout(() => {
      isUserSelecting.value = false
      pendingValue.value = undefined
    }, 500)
  }
}

onUnmounted(() => {
  handleProperty.cancel()
  throttleFn.cancel()
  subRef.value && subRef.value?.unsubscribe()
})

watch(
  rawValue,
  () => {
    if (isUserSelecting.value) return
    pendingValue.value = undefined
  }
)

watch(
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value, config.value.propertyId],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.property-enum {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  padding: 12px;
  background-color: #fff;
  overflow: hidden;
}

.property-enum__title {
  width: 100%;
  min-height: 22px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-enum__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  flex: 1;
  align-items: center;
}

.property-enum__options {
  display: flex;
  align-items: stretch;
  width: fit-content;
  max-width: 100%;
  border: 1px solid var(--property-enum-border-color);
  border-radius: var(--property-enum-border-radius);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(15, 118, 110, 0.15);
}

.property-enum__option {
  min-width: 96px;
  max-width: 180px;
  padding: 12px 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.property-enum__option + .property-enum__option {
  border-left: 1px solid rgba(15, 118, 110, 0.16);
}

.property-enum__option:hover {
  filter: brightness(0.98);
}

.property-enum__option--active {
  box-shadow: inset 0 0 0 1px transparent;
}

.property-enum__option--disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.property-enum__option-icon {
  line-height: 1;
}
</style>
