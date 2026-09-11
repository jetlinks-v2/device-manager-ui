<template>
  <div
    class="property-line"
    :style="style"
  >
    <div class="property-line__header">
      <div
        class="property-line__title"
        :style="titleStyle"
        :title="displayTitle"
      >
        {{ displayTitle }}
      </div>
    </div>

    <div class="property-line__legend-wrap">
      <div
        v-for="item in displaySeries"
        :key="item.id"
        class="property-line__legend-item"
      >
        <span
          class="property-line__legend-dot"
          :style="{ backgroundColor: item.color }"
        />
        <span
          class="property-line__legend-name"
          :style="legendTextStyle"
        >
          {{ item.name }}
        </span>
      </div>
    </div>

    <div class="property-line__chart">
      <v-chart
        :option="chartOption"
        autoresize
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import dayjs from 'dayjs'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getPropertiesInfo, getPropertiesList } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { debounce } from 'lodash-es'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

defineOptions({
  name: 'PropertyLine'
})

interface PropertyLineComponentConfig {
  title?: string
  titleColor?: string
  titleFontSize?: number
  legendFontSize?: number
  timePeriod?: 'today' | 'week' | 'month'
  cycle?: '*' | '1m' | '1h' | '1d' | '1w'
  aggregation?: 'AVG' | 'MAX' | 'MIN' | 'COUNT'
  deviceId?: string
  deviceName?: string
  propertyIds?: string[]
  propertyNames?: string[]
}

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

interface SeriesItem {
  id: string
  name: string
  color: string
  values: (number | undefined)[]
}

interface AxisPoint {
  key: string
  label: string
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

const config = computed<PropertyLineComponentConfig>(() => {
  return (props.info?.componentProps?.propertyLine as PropertyLineComponentConfig) || {}
})

const colors = ['#2f7cf6', '#f0ab00', '#43a047', '#ef5350', '#7e57c2']
const axisPoints = ref<AxisPoint[]>([])
const propertyData = ref<Record<string, Record<string, number | undefined>>>({})

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(config.value.deviceId || ''))
const runtimeDeviceId = computed(() => (isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')))

const displayTitle = computed(() => {
  const title = config.value.title || 'Line chart'
  const deviceName = config.value.deviceName || ''
  return deviceName ? `${deviceName}(${title})` : title
})

const titleStyle = computed(() => ({
  color: config.value.titleColor || 'rgba(0, 0, 0, 0.88)',
  fontSize: `${Number(config.value.titleFontSize || 18)}px`
}))

const legendTextStyle = computed(() => ({
  fontSize: `${Number(config.value.legendFontSize || 16)}px`
}))

const selectedPropertyIds = computed(() => {
  const ids = config.value.propertyIds || []
  return ids.slice(0, 5).map((id) => String(id))
})

const selectedPropertyNames = computed(() => {
  const ids = selectedPropertyIds.value
  return ids.map((id, index) => config.value.propertyNames?.[index] || id)
})

const timeRange = computed(() => {
  const end = dayjs()
  const type = config.value.timePeriod || 'today'
  if (type === 'week') {
    return { start: end.subtract(6, 'day'), end }
  }
  if (type === 'month') {
    return { start: end.subtract(30, 'day'), end }
  }
  return { start: dayjs().startOf('day'), end }
})

const xAxisData = computed(() => {
  return axisPoints.value.map((item) => item.label)
})

const toNumber = (value: unknown): number | undefined => {
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

const displaySeries = computed<SeriesItem[]>(() => {
  const ids = selectedPropertyIds.value
  const names = selectedPropertyNames.value

  return ids.map((id, index) => ({
    id,
    name: names[index] || id,
    color: colors[index % colors.length],
    values: axisPoints.value.map((point) => propertyData.value[id]?.[point.key])
  }))
})

const formatAxisLabel = (value: dayjs.ConfigType, cycle: string) => {
  if (cycle === '1d') return dayjs(value).format('YYYY-MM-DD')
  return dayjs(value).format('YYYY-MM-DD\nHH:mm:ss')
}

const buildFallbackAxis = (cycle: string) => {
  const { start, end } = timeRange.value
  return [
    { key: String(start.valueOf()), label: formatAxisLabel(start, cycle) },
    { key: String(end.valueOf()), label: formatAxisLabel(end, cycle) }
  ]
}

const queryRawSeries = async (deviceId: string, propertyId: string, from: number, to: number) => {
  const resp = await getPropertiesList(deviceId, propertyId, {
    paging: false,
    terms: [
      {
        column: 'timestamp$BTW',
        value: [from, to],
        type: 'and'
      }
    ],
    sorts: [{ name: 'timestamp', order: 'asc' }]
  })

  if (resp.status !== 200) return []

  const list = (resp.result || []) as Record<string, any>[]
  return list.map((item) => ({
    key: String(Number(item.timestamp)),
    ts: Number(item.timestamp),
    value: toNumber(item.value)
  }))
}

const queryAggSeries = async (deviceId: string, propertyIds: string[], agg: string, cycle: string, from: number, to: number) => {
  const resp = await getPropertiesInfo(deviceId, {
    columns: propertyIds.map((id) => ({
      property: id,
      alias: id,
      agg
    })),
    query: {
      interval: cycle,
      format: cycle === '1d' || cycle === '1w' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss',
      from,
      to
    }
  })

  if (resp.status !== 200) return [] as Record<string, any>[]
  return (resp.result || []) as Record<string, any>[]
}

const loadChartData = debounce(async () => {
  const deviceId = runtimeDeviceId.value
  const propertyIds = selectedPropertyIds.value
  const cycle = config.value.cycle || '*'
  const aggregation = config.value.aggregation || 'AVG'
  const { start, end } = timeRange.value
  const from = start.valueOf()
  const to = end.valueOf()

  if (!deviceId || !propertyIds.length) {
    axisPoints.value = buildFallbackAxis(cycle)
    propertyData.value = {}
    return
  }

  try {
    if (cycle === '*') {
      const rowsList = await Promise.all(propertyIds.map((id) => queryRawSeries(deviceId, id, from, to)))
      const axisMap = new Map<string, number>()
      const nextData: Record<string, Record<string, number | undefined>> = {}

      rowsList.forEach((rows, index) => {
        const propertyId = propertyIds[index]
        const map: Record<string, number | undefined> = {}
        map[String(from)] = undefined
        map[String(to)] = undefined
        axisMap.set(String(from), from)
        axisMap.set(String(to), to)

        rows.forEach((item) => {
          map[item.key] = item.value
          axisMap.set(item.key, item.ts)
        })

        nextData[propertyId] = map
      })

      const sorted = [...axisMap.entries()].sort((a, b) => a[1] - b[1])
      axisPoints.value = sorted.map(([key, ts]) => ({
        key,
        label: formatAxisLabel(ts, cycle)
      }))
      propertyData.value = nextData
    } else {
      const rows = await queryAggSeries(deviceId, propertyIds, aggregation, cycle, from, to)
      const nextData: Record<string, Record<string, number | undefined>> = {}
      propertyIds.forEach((id) => {
        nextData[id] = {}
      })

      const xAxis: AxisPoint[] = []
      rows.forEach((row, index) => {
        const timeValue = row.time
        const key = String(index)
        xAxis.push({
          key,
          label: formatAxisLabel(timeValue, cycle)
        })
        propertyIds.forEach((id) => {
          nextData[id][key] = toNumber(row[id])
        })
      })

      axisPoints.value = xAxis.length ? xAxis : buildFallbackAxis(cycle)
      propertyData.value = nextData
    }
  } finally {
    // noop
  }
}, 200)

onUnmounted(() => {
  loadChartData.cancel()
})

watch(
  () => [
    props.info,
    runtimeDeviceId.value,
    targetDeviceId.value,
    selectedPropertyIds.value.join(','),
    config.value.timePeriod,
    config.value.cycle,
    config.value.aggregation
  ],
  () => {
    loadChartData()
  },
  { immediate: true, deep: true }
)

const chartOption = computed(() => {
  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      valueFormatter: (value: any) => value ?? '--'
    },
    grid: {
      left: 35,
      right: 40,
      top: 20,
      bottom: 35,
      containLabel: true
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        start: 0,
        end: 100,
        height: 22,
        bottom: 10,
        left: 22,
        right: 40
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData.value,
      axisLine: {
        lineStyle: {
          color: '#d9d9d9'
        }
      },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.45)',
        fontSize: 12,
        margin: 12,
        hideOverlap: false,
        showMinLabel: true,
        showMaxLabel: true
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.45)'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e8e8e8',
          type: 'solid'
        }
      }
    },
    series: displaySeries.value.map((item) => ({
      name: item.name,
      type: 'line',
      data: item.values,
      smooth: false,
      showSymbol: false,
      connectNulls: true,
      lineStyle: {
        color: item.color,
        width: 3
      },
      itemStyle: {
        color: item.color
      }
    }))
  }
})
</script>

<style scoped lang="less">
.property-line {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 20px;
  background-color: #fff;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.property-line__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.property-line__title {
  min-width: 0;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-line__legend-wrap {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.property-line__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.property-line__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.property-line__legend-name {
  color: rgba(0, 0, 0, 0.88);
  white-space: nowrap;
}

.property-line__chart {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
  padding-left: 6px;
  padding-right: 12px;
}
</style>
