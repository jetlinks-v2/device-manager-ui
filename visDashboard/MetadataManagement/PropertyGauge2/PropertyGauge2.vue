<template>
  <div
    ref="rootRef"
    class="property-gauge2"
    :style="style"
  >
    <v-chart
      class="property-gauge2__chart"
      :option="chartOption"
      autoresize
    />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { use } from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { dashboard } from '@device-manager-ui/api/dashboard'
import { detail } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { debounce, throttle } from 'lodash-es'
import { map } from 'rxjs/operators'

use([CanvasRenderer, GaugeChart])

defineOptions({
  name: 'PropertyGauge2'
})

interface PropertyGauge2ComponentConfig {
  minValue?: number
  maxValue?: number
  ringWidth?: number
  titleFontSize?: number
  valueFontSize?: number
  deviceId?: string
  deviceName?: string
  propertyIds?: string[]
  propertyNames?: string[]
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

const config = computed<PropertyGauge2ComponentConfig>(() => {
  return (props.info?.componentProps?.propertyGauge2 as PropertyGauge2ComponentConfig) || {}
})

const route = useRoute()
const instanceStore = useInstanceStore()
const productStore = useProductStore()
const rootRef = ref<HTMLElement>()
const chartSize = ref(320)
let resizeObserver: ResizeObserver | undefined

const runtimeProductId = ref('')
const metadataText = ref('')
const propertyValue = ref<Record<string, any>>({})
const dataSource = ref<Record<string, any>[]>([])
const subRef = ref<any>()
const messageCache = new Map<string, Record<string, any>>()

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(config.value.deviceId || ''))
const runtimeDeviceId = computed(() => (isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')))
const selectedPropertyIds = computed(() => (config.value.propertyIds || []).slice(0, 5).map((id) => String(id)))

const palette = ['#4f72df', '#b4d930', '#52577f', '#f59f45', '#45b8d8']

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

const minValue = computed(() => Number(config.value.minValue ?? 0))
const maxValue = computed(() => {
  const max = Number(config.value.maxValue ?? 100)
  return max <= minValue.value ? minValue.value + 1 : max
})

const displayItems = computed(() => {
  const ids = selectedPropertyIds.value
  if (!ids.length) {
    return [
      { id: 'demo-1', name: 'Perfect', value: 20, color: palette[0] },
      { id: 'demo-2', name: 'Good', value: 40, color: palette[1] },
      { id: 'demo-3', name: 'Commonly', value: 60, color: palette[2] }
    ]
  }

  return ids.map((id, index) => {
    const property = propertyMap.value.get(id)
    const raw = Number(propertyValue.value[id]?.value)
    const value = Number.isFinite(raw) ? raw : minValue.value
    return {
      id,
      name: property?.name || config.value.propertyNames?.[index] || id,
      value,
      color: palette[index % palette.length]
    }
  })
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
  const id = `property-gauge2-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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
    return
  }

  if (!targetDeviceId.value) {
    metadataText.value = productStore.detail.metadata || ''
    runtimeProductId.value = String(productStore.detail.id || '')
    return
  }

  const response = await detail(targetDeviceId.value, true)
  metadataText.value = response.result?.metadata || ''
  runtimeProductId.value = String(response.result?.productId || '')
}

const handleProperty = debounce(async () => {
  subRef.value && subRef.value?.unsubscribe()
  messageCache.clear()
  propertyValue.value = {}

  await resolveMetadata()

  dataSource.value = selectedPropertyIds.value
    .map((id) => propertyMap.value.get(id))
    .filter((item): item is Record<string, any> => !!item)
    .slice(0, 5)

  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

onMounted(() => {
  const updateSize = () => {
    const el = rootRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    chartSize.value = Math.max(220, Math.min(rect.width, rect.height))
  }

  updateSize()
  resizeObserver = new ResizeObserver(() => {
    updateSize()
  })
  if (rootRef.value) {
    resizeObserver.observe(rootRef.value)
  }

  handleProperty()
})

onUnmounted(() => {
  handleProperty.cancel()
  throttleFn.cancel()
  subRef.value && subRef.value?.unsubscribe()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = undefined
  }
})

watch(
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value, selectedPropertyIds.value.join(',')],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)

const chartOption = computed(() => {
  const ringWidth = Number(config.value.ringWidth || 26)
  const itemCount = Math.max(1, displayItems.value.slice(0, 5).length)
  const sizeFactor = Math.max(0.68, Math.min(1, chartSize.value / 420))
  const densityFactor = itemCount >= 4 ? 0.72 : itemCount === 3 ? 0.82 : 0.95
  const titleBase = Number(config.value.titleFontSize || 22)
  const valueBase = Number(config.value.valueFontSize || 20)
  const titleFontSize = Math.max(12, Math.round(titleBase * sizeFactor * densityFactor))
  const valueFontSize = Math.max(12, Math.round(valueBase * sizeFactor * densityFactor))

  const data = displayItems.value.slice(0, 5).map((item, index) => ({
    value: item.value,
    name: item.name,
    title: {
      offsetCenter: ['0%', `${-30 + index * 30}%`],
      color: '#6b6b6b'
    },
    detail: {
      valueAnimation: true,
      offsetCenter: ['0%', `${-20 + index * 30}%`],
      color: item.color,
      borderColor: item.color
    },
    itemStyle: {
      color: item.color
    }
  }))

  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        min: minValue.value,
        max: maxValue.value,
        startAngle: 90,
        endAngle: -270,
        radius: '90%',
        center: ['50%', '52%'],
        pointer: {
          show: false
        },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: {
            borderWidth: 1,
            borderColor: '#464646'
          }
        },
        axisLine: {
          lineStyle: {
            width: ringWidth,
            color: [[1, '#e4e7ee']]
          }
        },
        splitLine: {
          show: false,
          distance: 0,
          length: 10
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false,
          distance: 50
        },
        data,
        title: {
          fontSize: titleFontSize,
        },
        detail: {
          width: Math.max(58, Math.round(valueFontSize * 2.8)),
          height: Math.max(18, Math.round(valueFontSize * 1.2)),
          fontSize: valueFontSize,
          color: 'inherit',
          borderColor: 'inherit',
          borderRadius: 20,
          padding: [0, 6],
          borderWidth: 1,
          formatter: '{value}%'
        }
      }
    ]
  }
})
</script>

<style scoped lang="less">
.property-gauge2 {
  width: 100%;
  height: 100%;
  background: #fff;
}

.property-gauge2__chart {
  width: 100%;
  height: 100%;
}
</style>
