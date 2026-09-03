<template>
  <div
    class="property-chart"
    :style="style"
  >
    <div
      class="property-chart__title"
      :style="titleStyle"
      :title="displayTitle"
    >
      {{ displayTitle }}
    </div>
    <div class="property-chart__content">
      <div
        class="property-chart__value"
        :style="valueStyle"
      >
        {{ displayValue }}
        <span
          v-if="displayUnit"
          class="property-chart__unit"
          :style="unitStyle"
        >
          {{ displayUnit }}
        </span>
      </div>
      <div class="property-chart__divider" />
      <div class="property-chart__chart">
        <v-chart
          :option="chartOption"
          autoresize
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { dashboard } from '@device-manager-ui/api/dashboard'
import { detail } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { debounce, throttle } from 'lodash-es'
import { map } from 'rxjs/operators'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

defineOptions({
  name: 'PropertyChart'
})

interface PropertyChartComponentConfig {
  titleColor?: string
  titleFontSize?: number
  valueColor?: string
  valueFontSize?: number
  unit?: string
  unitColor?: string
  unitFontSize?: number
  lineColor?: string
  showAreaStyle?: boolean
  smooth?: boolean
  history?: number
  deviceId?: string
  deviceName?: string
  propertyId?: string
  propertyName?: string
}

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, any>
}

interface ChartPoint {
  value: number | null
  time: string
  timestamp: number
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
const chartData = ref<ChartPoint[]>([])
const subRef = ref<any>()
const messageCache = new Map<string, Record<string, any>>()

const config = computed<PropertyChartComponentConfig>(() => {
  return (props.info?.componentProps?.propertyChart as PropertyChartComponentConfig) || {}
})

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(config.value.deviceId || ''))
const runtimeDeviceId = computed(() => (isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')))
const historySize = computed(() => Math.max(2, Number(config.value.history || 20)))
const defaultChartData = computed<ChartPoint[]>(() => {
  const now = Date.now()

  return [30, 31, 32, 31.5, 33, 34, 35].map((value, index, arr) => {
    const timestamp = now - (arr.length - index - 1) * 60 * 1000
    const date = new Date(timestamp)
    const hours = `${date.getHours()}`.padStart(2, '0')
    const minutes = `${date.getMinutes()}`.padStart(2, '0')

    return {
      value,
      time: `${hours}:${minutes}`,
      timestamp
    }
  })
})
const displayChartData = computed(() => (chartData.value.length ? chartData.value : defaultChartData.value))

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
  const propertyTitle = config.value.propertyName || selectedProperty.value?.name || '属性'
  const deviceName = config.value.deviceName || runtimeDeviceName.value

  return deviceName ? `${deviceName}(${propertyTitle})` : propertyTitle
})

const currentRawValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  return propertyId ? propertyValue.value[propertyId]?.value : undefined
})

const displayValue = computed(() => {
  const value = currentRawValue.value

  if (value === undefined || value === null || value === '') {
    return 'N/A'
  }

  return String(value)
})

const displayUnit = computed(() => {
  return config.value.unit || selectedProperty.value?.valueType?.unit || ''
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 16)}px`
}))

const valueStyle = computed(() => ({
  color: config.value.valueColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.valueFontSize || 32)}px`
}))

const unitStyle = computed(() => ({
  color: config.value.unitColor || valueStyle.value.color,
  fontSize: `${Number(config.value.unitFontSize || 16)}px`
}))

const toNumber = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

const formatTime = (item: Record<string, any>) => {
  if (item.timeString) return String(item.timeString)
  if (!item.timestamp) return ''

  const date = new Date(Number(item.timestamp))
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const pushChartPoint = (item: Record<string, any>) => {
  const propertyId = String(config.value.propertyId || '')
  if (!propertyId || item?.property !== propertyId) return

  const point: ChartPoint = {
    value: toNumber(item.value),
    time: formatTime(item),
    timestamp: Number(item.timestamp || Date.now())
  }

  chartData.value = [...chartData.value, point]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-historySize.value)
}

const valueChange = (arr: Record<string, any>[]) => {
  ;(arr || [])
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .forEach((item: any) => {
      const property = item?.value?.property
      if (property) {
        const value = { ...item, ...item.value }
        propertyValue.value[property] = value
        pushChartPoint(value)
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
  const id = `property-chart-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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
        history: historySize.value,
        properties: dataSource.value.map((item) => item.id)
      }
    }
  ])

  if (response.status === 200) {
    const propertyId = String(config.value.propertyId || '')
    const historyList = (response.result || [])
      .map((item: any) => ({
        timeString: item.data?.timeString,
        timestamp: item.data?.timestamp,
        ...item.data?.value
      }))
      .filter((item: any) => item.property === propertyId)
      .sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0))

    const latest = historyList[historyList.length - 1]
    if (latest?.property) {
      propertyValue.value = {
        ...unref(propertyValue),
        [latest.property]: latest
      }
    }

    chartData.value = historyList.slice(-historySize.value).map((item: any) => ({
      value: toNumber(item.value),
      time: formatTime(item),
      timestamp: Number(item.timestamp || Date.now())
    }))
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
  chartData.value = []

  await resolveMetadata()

  const propertyId = String(config.value.propertyId || '')
  const selected = propertyId ? propertyMap.value.get(propertyId) : undefined
  dataSource.value = selected ? [selected] : []

  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

const chartOption = computed(() => {
  const lineColor = config.value.lineColor || '#2f7cf6'

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true
    },
    grid: {
      left: 4,
      right: 4,
      top: 8,
      bottom: 4,
      containLabel: false
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: displayChartData.value.map((item) => item.time),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false }
    },
    series: [
      {
        name: selectedProperty.value?.name || config.value.propertyName || '属性',
        type: 'line',
        data: displayChartData.value.map((item) => item.value),
        smooth: config.value.smooth !== false,
        showSymbol: false,
        connectNulls: true,
        lineStyle: {
          color: lineColor,
          width: 2
        },
        itemStyle: {
          color: lineColor
        },
        areaStyle:
          config.value.showAreaStyle === false
            ? undefined
            : {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${lineColor}33` },
                    { offset: 1, color: `${lineColor}00` }
                  ]
                }
              }
      }
    ]
  }
})

onUnmounted(() => {
  handleProperty.cancel()
  throttleFn.cancel()
  subRef.value && subRef.value?.unsubscribe()
})

watch(
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value, config.value.propertyId, config.value.history],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.property-chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 12px;
  background-color: #fff;
  overflow: hidden;
}

.property-chart__title {
  flex-shrink: 0;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-chart__content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(80px, 1fr);
  align-items: center;
  gap: 12px;
}

.property-chart__value {
  min-width: 0;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-chart__unit {
  margin-left: 4px;
  font-weight: 500;
}

.property-chart__divider {
  width: 1px;
  height: 62px;
  border-left: 1px dashed rgba(0, 0, 0, 0.16);
}

.property-chart__chart {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 72px;
}
</style>
