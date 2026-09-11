<template>
  <div
    class="property-pie"
    :style="style"
  >
    <div class="property-pie__header">
      <div
        class="property-pie__title"
        :style="titleStyle"
        :title="displayTitle"
      >
        {{ displayTitle }}
      </div>
      <!-- <div class="property-pie__badge">
        latest
      </div> -->
    </div>

    <div class="property-pie__content">
      <div class="property-pie__chart">
        <v-chart
          :option="chartOption"
          autoresize
        />
        <div class="property-pie__center">
          <div
            class="property-pie__center-label"
            :style="totalLabelStyle"
          >
            {{ config.totalLabel || 'Total' }}
          </div>
          <div
            class="property-pie__center-value"
            :style="totalValueStyle"
          >
            {{ totalValue }}
          </div>
        </div>
      </div>

      <div class="property-pie__legend">
        <div
          v-for="item in displayItems"
          :key="item.id"
          class="property-pie__legend-item"
        >
          <div class="property-pie__legend-main">
            <span
              class="property-pie__legend-dot"
              :style="{ backgroundColor: item.color }"
            />
            <span
              class="property-pie__legend-name"
              :title="item.name"
            >
              {{ item.name }}
            </span>
          </div>
          <span class="property-pie__legend-value">
            {{ item.displayValue }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { dashboard } from '@device-manager-ui/api/dashboard'
import { detail } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { debounce, throttle } from 'lodash-es'
import { map } from 'rxjs/operators'

use([CanvasRenderer, PieChart, TooltipComponent])

defineOptions({
  name: 'PropertyPie'
})

interface PropertyPieComponentConfig {
  title?: string
  titleColor?: string
  titleFontSize?: number
  totalLabel?: string
  totalLabelColor?: string
  totalLabelFontSize?: number
  totalValueColor?: string
  totalValueFontSize?: number
  emptyColor?: string
  ringWidth?: number
  deviceId?: string
  deviceName?: string
  propertyIds?: string[]
  propertyNames?: string[]
}

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

interface DisplayItem {
  id: string
  name: string
  value: number
  displayValue: string
  color: string
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

const colors = ['#16a34a', '#ff5d6c', '#60a5fa', '#f59e0b', '#8b5cf6']

const config = computed<PropertyPieComponentConfig>(() => {
  return (props.info?.componentProps?.propertyPie as PropertyPieComponentConfig) || {}
})

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(config.value.deviceId || ''))
const runtimeDeviceId = computed(() => (isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')))
const selectedPropertyIds = computed(() => (config.value.propertyIds || []).slice(0, 5).map((id) => String(id)))

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

const defaultItems = computed<DisplayItem[]>(() => [
  { id: 'demo-1', name: 'Wind power', value: 0, displayValue: '--', color: colors[0] },
  { id: 'demo-2', name: 'Solar power', value: 0, displayValue: '--', color: colors[1] }
])

const displayTitle = computed(() => {
  const title = config.value.title || 'Doughnut'
  const deviceName = config.value.deviceName || runtimeDeviceName.value
  return deviceName ? `${deviceName}(${title})` : title
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 16)}px`
}))

const totalLabelStyle = computed(() => ({
  color: config.value.totalLabelColor || 'rgba(0, 0, 0, 0.45)',
  fontSize: `${Number(config.value.totalLabelFontSize || 14)}px`
}))

const totalValueStyle = computed(() => ({
  color: config.value.totalValueColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.totalValueFontSize || 34)}px`
}))

const toNumber = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatValue = (value: number) => {
  if (!Number.isFinite(value)) return '--'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2)
}

const displayItems = computed<DisplayItem[]>(() => {
  if (!selectedPropertyIds.value.length) {
    return defaultItems.value
  }

  return selectedPropertyIds.value.map((id, index) => {
    const property = propertyMap.value.get(id)
    const value = toNumber(propertyValue.value[id]?.value)
    return {
      id,
      name: property?.name || config.value.propertyNames?.[index] || id,
      value,
      displayValue: formatValue(value),
      color: colors[index % colors.length]
    }
  })
})

const totalValue = computed(() => {
  const total = displayItems.value.reduce((sum, item) => sum + item.value, 0)
  return formatValue(total)
})

const pieData = computed(() => {
  const items = displayItems.value.filter((item) => item.value > 0)
  if (!items.length) {
    return [
      {
        value: 1,
        name: 'empty',
        itemStyle: {
          color: config.value.emptyColor || '#d9d9d9'
        }
      }
    ]
  }

  return displayItems.value.map((item) => ({
    value: item.value <= 0 ? 0.0001 : item.value,
    name: item.name,
    itemStyle: {
      color: item.color
    }
  }))
})

const chartOption = computed(() => {
  const ringWidth = Number(config.value.ringWidth || 16)
  const innerRadius = Math.max(0, 72 - ringWidth)

  return {
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true
    },
    series: [
      {
        type: 'pie',
        radius: [`${innerRadius}%`, '72%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 4,
          borderRadius: 10
        },
        roundCap: true,
        data: pieData.value
      }
    ]
  }
})

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
  const id = `property-pie-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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

  dataSource.value = selectedPropertyIds.value
    .map((id) => propertyMap.value.get(id))
    .filter(Boolean) as Record<string, any>[]

  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

onUnmounted(() => {
  handleProperty.cancel()
  throttleFn.cancel()
  subRef.value && subRef.value?.unsubscribe()
})

watch(
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value, selectedPropertyIds.value.join(',')],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.property-pie {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 14px;
  background-color: #fff;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.property-pie__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.property-pie__title {
  min-width: 0;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-pie__badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
}

.property-pie__content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(140px, 1.2fr) minmax(120px, 1fr);
  gap: 12px;
  align-items: center;
}

.property-pie__chart {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.property-pie__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.property-pie__center-label {
  line-height: 1.2;
}

.property-pie__center-value {
  margin-top: 4px;
  line-height: 1;
  font-weight: 700;
}

.property-pie__legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.property-pie__legend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.property-pie__legend-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.property-pie__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.property-pie__legend-name {
  min-width: 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-pie__legend-value {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.88);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
</style>
