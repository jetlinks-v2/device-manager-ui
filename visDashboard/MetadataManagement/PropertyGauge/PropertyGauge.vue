<template>
  <div
    ref="rootRef"
    class="property-gauge"
    :style="style"
  >
    <div
      class="property-gauge__dial-shell"
      :style="dialShellStyle"
    >
      <v-chart
        :option="chartOption"
        autoresize
      />
      <div class="property-gauge__digital-panel">
        <span
          class="property-gauge__digital-value"
          :style="digitalValueStyle"
        >
          {{ displayValue }}
        </span>
        <span
          v-if="displayUnit"
          class="property-gauge__digital-unit"
          :style="digitalUnitStyle"
        >
          {{ displayUnit }}
        </span>
      </div>
    </div>
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
  name: 'PropertyGauge'
})

interface PropertyGaugeComponentConfig {
  title?: string
  titleColor?: string
  titleFontSize?: number
  minValue?: number
  maxValue?: number
  splitNumber?: number
  pointerColor?: string
  progressStartColor?: string
  progressEndColor?: string
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

const config = computed<PropertyGaugeComponentConfig>(() => {
  return (props.info?.componentProps?.propertyGauge as PropertyGaugeComponentConfig) || {}
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
const dialSize = ref(320)
const baseDialSize = 520
let resizeObserver: ResizeObserver | undefined

const dialShellStyle = computed(() => ({
  width: `${dialSize.value}px`,
  height: `${dialSize.value}px`
}))
const uiScale = computed(() => dialSize.value / baseDialSize)
const displayUnit = computed(() => config.value.unit || '')
const digitalValueStyle = computed(() => ({
  color: config.value.valueColor || '#40424c',
  fontSize: `${Math.max(14, Math.round(Number(config.value.valueFontSize || 56) * uiScale.value))}px`,
  letterSpacing: `${Math.max(0.5, 1.5 * uiScale.value)}px`
}))
const digitalUnitStyle = computed(() => ({
  color: config.value.unitColor || '#666',
  fontSize: `${Math.max(10, Math.round(Number(config.value.unitFontSize || 14) * uiScale.value))}px`
}))

const displayValue = computed(() => {
  const value = Number(rawValue.value ?? config.value.minValue ?? -100)
  if (!Number.isFinite(value)) return '--'
  return Math.round(value)
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

const rawValue = computed(() => {
  const propertyId = String(config.value.propertyId || '')
  const valueData = propertyId ? propertyValue.value[propertyId] : undefined
  return valueData?.value
})

const gaugeValue = computed(() => {
  const min = Number(config.value.minValue ?? -100)
  const value = Number(rawValue.value ?? min)
  return Number.isFinite(value) ? value : min
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
  const id = `property-gauge-${runtimeDeviceId.value}-${runtimeProductId.value}-${propertyIds.join('-')}`
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
    // 以外部容器最小宽高为准，确保等比缩放且不受长边拉伸影响
    const side = Math.max(220, Math.min(rect.width, rect.height) - 24)
    dialSize.value = Number.isFinite(side) ? side : 320
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
  const min = Number(config.value.minValue ?? -100)
  const max = Number(config.value.maxValue ?? 100)
  const splitNumber = Number(config.value.splitNumber ?? 10)
  const startColor = config.value.progressStartColor || '#f3e7df'
  const endColor = config.value.progressEndColor || '#f97316'
  const pointerColor = config.value.pointerColor || '#e85d04'
  const title = config.value.propertyName || config.value.title || 'Temperature'
  const axisFontSize = Math.max(13, Math.min(24, Math.round(20 * uiScale.value)))

  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        min,
        max,
        splitNumber,
        startAngle: 225,
        endAngle: -45,
        center: ['50%', '50%'],
        radius: '91%',
        axisLine: {
          roundCap: false,
          lineStyle: {
            width: 22,
            color: [
              [
                1,
                {
                  type: 'linear',
                  x: 1,
                  y: 0,
                  x2: 0,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: endColor },
                    { offset: 1, color: startColor }
                  ]
                }
              ]
            ]
          }
        },
        progress: {
          show: false
        },
        pointer: {
          show: true,
          icon: 'path://M2090.36389,615.30999 L2090.36389,615.30999 C2091.48372,615.30999 2092.40383,616.194028 2092.44859,617.312956 L2096.90698,728.755929 C2097.05155,732.369577 2094.2393,735.416212 2090.62566,735.56078 C2090.53845,735.564269 2090.45117,735.566014 2090.36389,735.566014 L2090.36389,735.566014 C2086.74736,735.566014 2083.81557,732.63423 2083.81557,729.017692 C2083.81557,728.930412 2083.81732,728.84314 2083.82081,728.755929 L2088.2792,617.312956 C2088.32396,616.194028 2089.24407,615.30999 2090.36389,615.30999 Z',
          length: '92%',
          width: 10,
          offsetCenter: [0, '15%'],
          itemStyle: {
            color: pointerColor,
            shadowBlur: 3,
            shadowColor: 'rgba(0,0,0,0.16)'
          }
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 28,
          itemStyle: {
            color: '#e7e7e7',
            borderColor: '#d6d6d6',
            borderWidth: 2,
            shadowBlur: 6,
            shadowColor: 'rgba(0,0,0,0.18)'
          }
        },
        axisTick: {
          distance: -28,
          splitNumber: 5,
          lineStyle: {
            color: '#6c6c6c',
            width: 1
          },
          length: 10
        },
        splitLine: {
          distance: -28,
          length: 16,
          lineStyle: {
            color: '#545454',
            width: 2
          }
        },
        axisLabel: {
          distance: 40,
          color: '#5f5f5f',
          fontSize: axisFontSize,
          fontWeight: 600,
          formatter: (value: number) => `${Math.round(value)}`
        },
        title: {
          show: true,
          offsetCenter: [0, '-14%'],
          color: config.value.titleColor || '#7f7f7f',
          fontSize: Math.round(Number(config.value.titleFontSize || 40) * uiScale.value),
          fontWeight: 600
        },
        detail: {
          show: false
        },
        data: [
          {
            value: gaugeValue.value,
            name: title
          }
        ]
      }
    ]
  }
})
</script>

<style scoped lang="less">
.property-gauge {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 12px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.property-gauge__dial-shell {
  position: relative;
  flex: 0 0 auto;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 46%, #f6f6f6 0%, #ebebeb 58%, #d9d9d9 75%, #f4f4f4 100%);
  box-shadow: inset 0 0 0 3px rgba(125, 125, 125, 0.35), inset 0 0 0 8px rgba(255, 255, 255, 0.7),
    inset 0 0 0 11px rgba(180, 180, 180, 0.22), 0 5px 8px rgba(0, 0, 0, 0.2);
}

.property-gauge__digital-panel {
  position: absolute;
  left: 50%;
  bottom: 6.5%;
  transform: translateX(-50%);
  width: 25.5%;
  height: 10%;
  min-width: 92px;
  min-height: 36px;
  border-radius: v-bind('`${Math.max(4, Math.round(8 * uiScale))}px`');
  border: v-bind('`${Math.max(2, Math.round(4 * uiScale))}px solid #4d4d4dc9`');
  background: #8d8d8d6c;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: v-bind('`${Math.max(4, Math.round(8 * uiScale))}px`');
}

// .property-gauge__digital-sign {
//   color: #40424c;
//   font-family: 'Courier New', monospace;
//   font-size: v-bind('`${Math.round(30 * uiScale)}px`');
//   font-weight: 700;
//   line-height: 1;
// }

.property-gauge__digital-value {
  font-family: 'Courier New', monospace;
  line-height: 1;
  font-weight: 700;
}

.property-gauge__digital-unit {
  font-family: 'Courier New', monospace;
  line-height: 1;
  font-weight: 600;
  // transform: translateY(1px);
}
</style>
