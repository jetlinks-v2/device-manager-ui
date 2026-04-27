<template>
  <div
    class="property-progress"
    :style="style"
  >
    <div
      class="property-progress__title"
      :style="titleStyle"
      :title="displayTitle"
    >
      {{ displayTitle }}
    </div>

    <div class="property-progress__body">
      <div
        class="property-progress__value"
        :style="valueStyle"
      >
        {{ displayValue }}
        <span
          v-if="displayUnit"
          class="property-progress__unit"
          :style="unitStyle"
        >
          {{ displayUnit }}
        </span>
      </div>

      <div class="property-progress__bar-wrap">
        <div
          class="property-progress__bar"
          :style="{ backgroundColor: config.trailColor || '#f0f0f0' }"
        >
          <div
            class="property-progress__bar-inner"
            :style="{
              width: `${progressPercent}%`,
              backgroundColor: config.progressColor || '#0f766e'
            }"
          />
        </div>
        <div class="property-progress__range">
          <span>{{ minValue }}</span>
          <span>{{ maxValue }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { dashboard } from '@device-manager-ui/api/dashboard'
import { detail } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { debounce, throttle } from 'lodash-es'
import { map } from 'rxjs/operators'

defineOptions({
  name: 'PropertyProgress'
})

interface PropertyProgressComponentConfig {
  title?: string
  titleColor?: string
  titleFontSize?: number
  value?: string | number | null
  valueColor?: string
  valueFontSize?: number
  unit?: string
  unitColor?: string
  unitFontSize?: number
  progressColor?: string
  trailColor?: string
  minValue?: number | string
  maxValue?: number | string
  deviceId?: string
  deviceName?: string
  propertyId?: string
  propertyName?: string
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

const config = computed<PropertyProgressComponentConfig>(() => {
  return (props.info?.componentProps?.propertyProgress as PropertyProgressComponentConfig) || {}
})

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(config.value.deviceId || ''))
const runtimeDeviceId = computed(() => (isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')))

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
  const propertyTitle =
    config.value.propertyName ||
    selectedProperty.value?.name ||
    config.value.title ||
    'Progress bar'

  const deviceName = config.value.deviceName || runtimeDeviceName.value

  return deviceName ? `${deviceName}(${propertyTitle})` : propertyTitle
})

const rawValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  const valueData = propertyId ? propertyValue.value[propertyId] : undefined
  return valueData?.value
})

const displayValue = computed(() => {
  const value = rawValue.value

  if (value === undefined || value === null || value === '') {
    const fallback = config.value.value
    if (fallback === undefined || fallback === null || fallback === '') {
      return 'N/A'
    }
    return String(fallback)
  }

  return String(value)
})

const displayUnit = computed(() => config.value.unit || propertyValueType.value?.unit || '')

const resolveNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const minValue = computed(() => {
  const metadataMin = propertyValueType.value?.min ?? propertyValueType.value?.expands?.min
  return resolveNumber(config.value.minValue ?? metadataMin, 0)
})

const maxValue = computed(() => {
  const metadataMax = propertyValueType.value?.max ?? propertyValueType.value?.expands?.max
  const max = resolveNumber(config.value.maxValue ?? metadataMax, 100)
  return max === minValue.value ? minValue.value + 100 : max
})

const progressPercent = computed(() => {
  const numberValue = resolveNumber(rawValue.value ?? config.value.value, minValue.value)
  const percent = ((numberValue - minValue.value) / (maxValue.value - minValue.value)) * 100
  return Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0))
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 16)}px`
}))

const valueStyle = computed(() => ({
  color: config.value.valueColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.valueFontSize || 24)}px`
}))

const unitStyle = computed(() => ({
  color: config.value.unitColor || valueStyle.value.color,
  fontSize: `${Number(config.value.unitFontSize || 12)}px`
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
  const id = `property-progress-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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

onUnmounted(() => {
  handleProperty.cancel()
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
.property-progress {
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

.property-progress__title {
  width: 100%;
  min-height: 22px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-progress__body {
  width: 100%;
}

.property-progress__value {
  display: flex;
  align-items: baseline;
  line-height: 1;
  font-weight: 700;
  white-space: nowrap;
}

.property-progress__unit {
  margin-left: 4px;
  font-weight: 500;
}

.property-progress__bar-wrap {
  margin-top: 14px;
}

.property-progress__bar {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
}

.property-progress__bar-inner {
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.property-progress__range {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1;
}
</style>
