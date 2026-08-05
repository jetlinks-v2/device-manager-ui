<template>
  <div
    ref="containerRef"
    class="individual-card"
    :class="{ 'is-vertical': isVertical }"
    :style="style"
  >
    <div class="individual-card__header">
      <span
        class="individual-card__icon"
        :style="{
          color: config.iconColor || '#1aa37a',
          fontSize: `${Number(config.iconSize || 32)}px`
        }"
      >
        <AIcon :type="config.icon || 'ExperimentOutlined'" />
      </span>
      <span
        class="individual-card__title"
        :style="titleStyle"
      >
        {{ displayTitle }}
      </span>
    </div>

    <div
      class="individual-card__value"
      :style="valueStyle"
    >
      {{ displayValue }}
      <span
        v-if="config.unit"
        class="individual-card__unit"
        :style="unitStyle"
      >
        {{ config.unit }}
      </span>
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
  name: 'IndividualCard'
})

interface IndividualCardComponentConfig {
  title?: string
  icon?: string
  iconColor?: string
  iconSize?: number
  titleColor?: string
  titleFontSize?: number
  value?: string | number | null
  valueColor?: string
  valueFontSize?: number
  unit?: string
  unitColor?: string
  unitFontSize?: number
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

const containerRef = ref<HTMLElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null

const runtimeProductId = ref('')
const runtimeDeviceName = ref('')
const metadataText = ref('')
const propertyValue = ref<Record<string, any>>({})
const dataSource = ref<Record<string, any>[]>([])
const subRef = ref<any>()
const messageCache = new Map<string, Record<string, any>>()

const config = computed<IndividualCardComponentConfig>(() => {
  return (props.info?.componentProps?.individualCard as IndividualCardComponentConfig) || {}
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

const displayTitle = computed(() => {
  const propertyTitle =
    config.value.propertyName ||
    selectedProperty.value?.name ||
    config.value.title ||
    'Temperature'

  const deviceName = config.value.deviceName || runtimeDeviceName.value

  return deviceName ? `${deviceName}(${propertyTitle})` : propertyTitle
})

const displayValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  const valueData = propertyId ? propertyValue.value[propertyId] : undefined
  const value = valueData?.value

  if (value === undefined || value === null || value === '') {
    const fallback = config.value.value
    if (fallback === undefined || fallback === null || fallback === '') {
      return 'N/A'
    }
    return String(fallback)
  }

  return String(value)
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 40)}px`
}))

const valueStyle = computed(() => ({
  color: config.value.valueColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.valueFontSize || 48)}px`
}))

const unitStyle = computed(() => ({
  color: config.value.unitColor || valueStyle.value.color,
  fontSize: `${Number(config.value.unitFontSize || 24)}px`
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
  const id = `individual-card-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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

const isVertical = computed(() => {
  const { width, height } = containerSize.value
  if (!width || !height) {
    return false
  }
  return width < 280 || height > width
})

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      containerSize.value = {
        width: Math.floor(width),
        height: Math.floor(height)
      }
    })

    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  handleProperty.cancel()
  subRef.value && subRef.value?.unsubscribe()
  resizeObserver?.disconnect()
  resizeObserver = null
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
.individual-card {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 22px 24px;
  background-color: #fff;
  overflow: hidden;
}

.individual-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.individual-card__icon {
  line-height: 1;
  flex-shrink: 0;
}

.individual-card__title {
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.individual-card__value {
  flex-shrink: 0;
  margin-left: 16px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.individual-card__unit {
  margin-left: 6px;
  font-weight: 500;
  line-height: 1;
}

.individual-card.is-vertical {
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}

.individual-card.is-vertical .individual-card__header {
  justify-content: center;
  flex: none;
}

.individual-card.is-vertical .individual-card__title {
  max-width: 100%;
  text-align: center;
}

.individual-card.is-vertical .individual-card__value {
  margin-left: 0;
}
</style>
