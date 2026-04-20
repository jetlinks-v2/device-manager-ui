<template>
  <div
    class="chart-container"
    :style="style"
  >
    <v-chart
      :option="chartOption"
      autoresize
    />
  </div>
</template>

<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

// 将十六进制颜色转换为 RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

// 创建渐变色（从线条颜色到透明）
const createGradientColor = (lineColor: string) => {
  const rgb = hexToRgb(lineColor)
  if (!rgb) return undefined

  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)` },
      { offset: 1, color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)` }
    ]
  }
}

const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  },
  style: {
    type: Object,
    default: () => ({})
  }
})

// 实时数据状态 (Mock)
const data = ref<number[]>([30, 31, 32, 33, 34, 35, 36])
const times = ref<string[]>(['15:40', '15:41', '15:42', '15:43', '15:44', '15:45', '15:46'])

// 真实订阅数据状态
const seriesDataMap = ref<Record<string, { name: string; data: number[] }>>({})
const xAxisData = ref<string[]>([])
let events: any[] = []

const subscribeData = (val: any[]) => {
  events?.forEach((event: any) => event?.())
  events = []
  seriesDataMap.value = {}
  xAxisData.value = []

  if (!val || !val.length) return

  val.forEach((item: any, index: number) => {
    const id = item.id
    events.push(
      (window as any).$viewDataEventBus?.subscribe(id, (resData: any) => {
        if (!resData || !Array.isArray(resData) || resData.length === 0) return

        // 取出除时间字段外的物模型 key
        const firstRow = resData[0]
        const valueKeys = Object.keys(firstRow).filter((k) => k !== 'time' && k !== 'timestamp')
        const key = valueKeys.length > 0 ? valueKeys[0] : null
        if (!key) return

        const options = props.info.extraProps?.options || []
        const option = options[index]
        const label = option ? option.mappingName || key : key
        const uniqueKey = `${id}_${key}`

        // 直接使用 map 提取数据，避免遍历 push
        const values = resData.map((row: any) => (row[key] !== undefined ? row[key] : 0))
        const newTimes = resData.map((row: any) => row.time || row.timestamp || '')

        seriesDataMap.value[uniqueKey] = {
          name: label,
          data: values
        }

        if (newTimes.length !== 0) {
          xAxisData.value = newTimes
        }
      })
    )
  })
}

watch(
  () => props.info?.dataSourceProps,
  (val) => {
    subscribeData(val || [])
  },
  { deep: true, immediate: true }
)

const chartOption = computed(() => {
  const config = props.info?.componentProps?.realtimeLineChart || {}
  const options = props.info?.extraProps?.options || []
  const isMock = options.length === 0

  const seriesNames = isMock ? ['温度'] : Array.from(new Set(Object.values(seriesDataMap.value).map((s) => s.name)))

  const series = isMock
    ? [
        {
          name: '温度',
          type: 'line',
          data: data.value,
          smooth: config.smooth ?? true,
          showSymbol: config.showSymbol ?? true,
          areaStyle: config.showAreaStyle
            ? {
                color: createGradientColor(config.lineColor || '#5470c6')
              }
            : undefined,
          itemStyle: {
            color: config.lineColor || undefined
          }
        }
      ]
    : Object.entries(seriesDataMap.value).map(([uKey, s], index) => {
        // 从 options 中获取对应的 lineColor
        const optionIndex = Object.keys(seriesDataMap.value).indexOf(uKey)
        const lineColor = options[optionIndex]?.config?.lineColor || config.lineColor || '#5470c6'
        
        return {
          id: uKey,
          name: s.name,
          type: 'line',
          data: s.data,
          smooth: config.smooth ?? true,
          showSymbol: config.showSymbol ?? true,
          areaStyle: config.showAreaStyle
            ? {
                color: createGradientColor(lineColor)
              }
            : undefined,
          itemStyle: {
            color: lineColor
          }
        }
      })

  const xAxis = isMock ? times.value : xAxisData.value

  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: seriesNames,
      show: config.showLegend ?? true,
      top: config.legendPosition === 'bottom' ? 'auto' : 'top',
      bottom: config.legendPosition === 'bottom' ? 0 : 'auto'
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: config.legendPosition === 'bottom' ? 30 : '3%',
      top: config.legendPosition === 'bottom' ? 20 : 40,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxis,
      axisLabel: {
        formatter: (value: string) => {
          return value.replace(' ', '\n')
        }
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        show: config.showSplitLine !== false // 默认为 true
      }
    },
    series: series
  }
})

let timer: number
onMounted(() => {
  // Mock 数据定时器
  timer = window.setInterval(() => {
    const newVal = +(Math.random() * 20 + 30).toFixed(1)
    const now = new Date()
    const newTime = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`

    if (data.value.length > 20) {
      data.value.shift()
      times.value.shift()
    }
    data.value.push(newVal)
    times.value.push(newTime)
  }, 2000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  events?.forEach((event: any) => event?.())
})
</script>

<style scoped lang="less">
.chart-container {
  width: 100%;
  height: 100%;
  padding: 10px;
}
</style>
