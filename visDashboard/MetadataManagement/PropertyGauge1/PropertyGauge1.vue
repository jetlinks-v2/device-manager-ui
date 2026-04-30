<template>
  <div
    ref="rootRef"
    class="property-gauge1"
    :style="style"
  >
    <v-chart
      class="property-gauge1__chart"
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
  name: 'PropertyGauge1'
})

interface PropertyGauge1ComponentConfig {
  titleColor?: string
  titleFontSize?: number
  minValue?: number
  maxValue?: number
  splitNumber?: number
  valueColor?: string
  valueFontSize?: number
  unit?: string
  unitColor?: string
  unitFontSize?: number
  startColor?: string
  middleColor?: string
  endColor?: string
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

const config = computed<PropertyGauge1ComponentConfig>(() => {
  return (props.info?.componentProps?.propertyGauge1 as PropertyGauge1ComponentConfig) || {}
})

const route = useRoute()
const instanceStore = useInstanceStore()
const productStore = useProductStore()

const runtimeProductId = ref('')
const metadataText = ref('')
const propertyValue = ref<Record<string, any>>({})
const dataSource = ref<Record<string, any>[]>([])
const subRef = ref<any>()
const messageCache = new Map<string, Record<string, any>>()

const rootRef = ref<HTMLElement>()
const dialSize = ref(220)
const baseDialSize = 320
let resizeObserver: ResizeObserver | undefined

const uiScale = computed(() => dialSize.value / baseDialSize)

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

const rawValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  const valueData = propertyId ? propertyValue.value[propertyId] : undefined
  return valueData?.value
})

const gaugeValue = computed(() => {
  const min = Number(config.value.minValue ?? 0)
  const value = Number(rawValue.value ?? min)
  return Number.isFinite(value) ? value : min
})

const displayValue = computed(() => {
  const value = Number(rawValue.value ?? config.value.minValue ?? 0)
  if (!Number.isFinite(value)) return '--'
  return String(value)
})

const displayUnit = computed(() => config.value.unit || '')

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
  const id = `property-gauge1-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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

  const propertyId = String(config.value.propertyId || '')
  const selected = propertyId ? propertyMap.value.get(propertyId) : undefined
  dataSource.value = selected ? [selected] : []

  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

onMounted(() => {
  const updateDialSize = () => {
    const el = rootRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const side = Math.max(160, Math.min(rect.width, rect.height))
    dialSize.value = Number.isFinite(side) ? side : 220
  }

  updateDialSize()
  resizeObserver = new ResizeObserver(() => {
    updateDialSize()
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
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value, config.value.propertyId],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)

const chartOption = computed(() => {
  const min = Number(config.value.minValue ?? 0)
  const max = Number(config.value.maxValue ?? 1)
  const safeMax = max <= min ? min + 1 : max
  const splitNumber = Number(config.value.splitNumber ?? 5)
  const gaugeTitle = config.value.propertyName || ''

  const startColor = config.value.startColor || '#1fcf8b'
  const middleColor = config.value.middleColor || '#f4b447'
  const endColor = config.value.endColor || '#f0825d'

  const majorFontSize = Math.max(10, Math.round(12 * uiScale.value))

  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        min,
        max: safeMax,
        splitNumber,
        startAngle: 200,
        endAngle: -20,
        center: ['50%', '67%'],
        radius: '88%',
        title: {
          show: !!gaugeTitle,
          offsetCenter: [0, '24%'],
          color: config.value.titleColor || '#666',
          fontSize: Math.max(10, Math.round(Number(config.value.titleFontSize || 14) * uiScale.value)),
          fontWeight: 500
        },
        axisLine: {
          
          lineStyle: {
            width: Math.max(16, Math.round(10 * uiScale.value)),
            color: [
              [
                0.3,
                {
                  type: 'linear',
                  x: 0,
                  y: 1,
                  x2: 0,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: startColor },
                    { offset: 1, color: '#4293ff' }
                  ]
                }
              ],
              [
                0.6,
                {
                  type: 'linear',
                  x: 0,
                  y: 1,
                  x2: 0,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: '#4293ff' },
                    { offset: 1, color: middleColor }
                  ]
                }
              ],
              [
                1,
                {
                  type: 'linear',
                  x: 0,
                  y: 1,
                  x2: 0,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: middleColor },
                    { offset: 1, color: endColor }
                  ]
                }
              ]
            ]
          }
        },
        axisTick: {
          distance: -Math.max(14, Math.round(20 * uiScale.value)),
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: 'rgba(0,0,0,0.15)'
          }
        },
        splitLine: {
          distance: -Math.max(16, Math.round(22 * uiScale.value)),
          length: Math.max(7, Math.round(9 * uiScale.value)),
          lineStyle: {
            width: 1,
            color: '#000'
          }
        },
        axisLabel: {
          distance: -Math.max(14, Math.round(22 * uiScale.value)),
          color: 'auto',
          fontSize: majorFontSize,
          width: 30,
          padding: [6, 10, 0, 10],
          formatter: (value: number) => {
            const step = (safeMax - min) / Math.max(splitNumber, 1)
            const idx = Math.round((value - min) / step)
            const tickValue = min + idx * step
            if (Math.abs(value - tickValue) > step * 0.15) return ''
            const normalized = Math.round(tickValue * 100) / 100
            return `${normalized}${displayUnit.value}`
          }
        },
        pointer: {
          show: true,
          length: '80%',
          width: Math.max(3, Math.round(4 * uiScale.value)),
          itemStyle: {
            color: 'auto'
          }
        },
        anchor: {
          show: true,
          showAbove: true,
          size: Math.max(16, Math.round(26 * uiScale.value)),
          itemStyle: {
            borderWidth: Math.max(2, Math.round(3 * uiScale.value)),
            borderColor: '#fff',
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, .25)',
            color: 'auto'
          }
        },
        detail: {
          valueAnimation: false,
          width: '100%',
          lineHeight: Math.max(24, Math.round(34 * uiScale.value)),
          offsetCenter: [0, '-25%'],
          formatter: () => `${displayValue.value}`,
          color: config.value.valueColor || '#00b86b',
          fontSize: Math.max(18, Math.round(Number(config.value.valueFontSize || 36) * uiScale.value)),
          fontWeight: 600
        },
        data: [
          {
            value: gaugeValue.value,
            name: gaugeTitle
          }
        ]
      },
      {
        type: 'gauge',
        min,
        max: safeMax,
        splitNumber,
        startAngle: 200,
        endAngle: -20,
        center: ['50%', '67%'],
        radius: '88%',
        pointer: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { show: false },
        data: [{ value: gaugeValue.value }]
      }
    ]
  }
})
</script>

<style scoped lang="less">
.property-gauge1 {
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.property-gauge1__chart {
  width: 100%;
  height: 100%;
}
</style>
