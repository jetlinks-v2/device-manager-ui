<template>
  <a-spin :spinning="loading" size="small">
    <div class="property-mini-chart">
      <div v-if="hasChartData" ref="chartRef" class="property-mini-chart__body" />
      <CloudEmpty v-else class="property-mini-chart__empty" :description="$t('IotDeviceDetail.propertyChart.empty')" />
    </div>
  </a-spin>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { computed, nextTick, onBeforeUnmount, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDeviceTrendAxisLabels } from '@device-manager-ui/api/deviceTrend'

import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

type ChartRow = {
  time: number | string
  value: number | string
}

const props = defineProps({
  deviceId: {
    type: String,
    required: true,
  },
  property: {
    type: Object as PropType<RealtimePropertyRow>,
    required: true,
  },
})

const { t: $t } = useI18n()
const loading = ref(false)
const chartRef = ref<HTMLDivElement>()
const chartRows = ref<ChartRow[]>([])
let chartInstance: echarts.ECharts | undefined
const REALTIME_CHART_REFRESH_INTERVAL = 10_000
let realtimeChartTimer: ReturnType<typeof setTimeout> | undefined
let lastRealtimeChartRenderAt = 0

const isNumericProperty = computed(() => ['int', 'float', 'double', 'long', 'number'].includes(props.property.valueType?.type || props.property.dataType || ''))
const hasChartData = computed(() => getDisplayRows().length > 0)

function getTimeRange() {
  const end = Date.now()
  return [dayjs(end).subtract(24, 'hour').valueOf(), end] as [number, number]
}

async function queryMiniChart() {
  if (!props.deviceId || !props.property.identifier) {
    chartRows.value = []
    return
  }

  loading.value = true
  try {
    chartRows.value = isNumericProperty.value
      ? await queryNumericRows()
      : await queryDiscreteRows()
  } finally {
    loading.value = false
  }
}

async function queryNumericRows() {
  const [from, to] = getTimeRange()
  const resp: any = await iotDeviceDetailRealApi.queryPropertyAggregation(props.deviceId, {
    columns: [{
      property: props.property.identifier,
      alias: props.property.identifier,
      agg: 'AVG',
    }],
    query: {
      interval: '1h',
      format: 'yyyy-MM-dd HH:mm:ss',
      from,
      to,
    },
  })

  return extractRows(resp?.result)
    .map((item: any) => ({
      time: item.time,
      value: Number(item[props.property.identifier]),
    }))
    .filter((item) => Number.isFinite(item.value))
    .reverse()
}

async function queryDiscreteRows() {
  const [from, to] = getTimeRange()
  const resp: any = await iotDeviceDetailRealApi.queryPropertyData(props.deviceId, props.property.identifier, {
    pageIndex: 0,
    pageSize: 24,
    sorts: [{ name: 'timestamp', order: 'asc' }],
    terms: [{
      terms: [{
        column: 'timestamp',
        termType: 'btw',
        value: [from, to],
      }],
    }],
  })

  return extractRows(resp?.result)
    .map((item: any) => {
      const valueSource = item?.value && typeof item.value === 'object' ? item.value : item
      const value = valueSource?.formatValue ?? valueSource?.value ?? item?.formatValue ?? item?.value
      const time = item?.timestamp ?? valueSource?.timestamp ?? item?.createTime ?? item?.time
      return value === undefined || value === null || !time ? undefined : {
        time,
        value: String(value),
      }
    })
    .filter((item): item is ChartRow => Boolean(item))
}

function getDisplayRows() {
  const rows = [...chartRows.value]
  const value = props.property.value
  if (value && value !== '--') {
    const time = props.property.updatedAt && props.property.updatedAt !== $t('IotDeviceDetail.detail.noReport')
      ? props.property.updatedAt
      : Date.now()
    rows.push({ time, value: isNumericProperty.value ? Number.parseFloat(value) : value })
  }
  return rows.filter((item) => !isNumericProperty.value || Number.isFinite(Number(item.value))).slice(-24)
}

function readThemeVar(name: string) {
  if (typeof window === 'undefined') return 'transparent'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'transparent'
}

function renderChart() {
  lastRealtimeChartRenderAt = Date.now()
  nextTick(() => {
    if (!chartRef.value || !hasChartData.value) return
    const rows = getDisplayRows()
    if (!rows.length) return

    if (!chartInstance || chartInstance.isDisposed()) {
      chartInstance = echarts.init(chartRef.value)
    }

    const categories = isNumericProperty.value
      ? undefined
      : Array.from(new Set(rows.map((item) => String(item.value))))
    const data = isNumericProperty.value
      ? rows.map((item) => Number(item.value))
      : rows.map((item) => String(item.value))
    const axisTextColor = readThemeVar('--jet-theme-text-disabled')
    const axisLineColor = readThemeVar('--jet-theme-border-secondary')
    const lineColor = readThemeVar('--jet-theme-primary')
    const areaColor = readThemeVar('--jet-theme-primary-soft')

    chartInstance.setOption({
      grid: { top: 8, right: 8, bottom: 18, left: 28 },
      tooltip: {
        trigger: 'axis',
        formatter(params: any) {
          const rowIndex = params?.[0]?.dataIndex ?? 0
          const row = rows[rowIndex]
          return $t('IotDeviceDetail.propertyChart.tooltip', {
            time: formatTime(row?.time),
            name: props.property.name,
            value: row?.value ?? '--',
          })
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: formatDeviceTrendAxisLabels(rows.map((item) => item.time), '1h'),
        axisLabel: { fontSize: 14, color: axisTextColor },
        axisLine: { lineStyle: { color: axisLineColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: isNumericProperty.value ? 'value' : 'category',
        data: categories,
        axisLabel: { fontSize: 14, color: axisTextColor },
        splitLine: { lineStyle: { color: axisLineColor } },
      },
      series: [{
        type: 'line',
        smooth: isNumericProperty.value,
        symbol: 'circle',
        symbolSize: 4,
        data,
        animationDurationUpdate: 260,
        animationEasingUpdate: 'cubicOut',
        lineStyle: { width: 2, color: lineColor },
        itemStyle: { color: lineColor },
        areaStyle: isNumericProperty.value
          ? { color: areaColor }
          : undefined,
      }],
    }, {
      notMerge: false,
      lazyUpdate: true,
    })
  })
}

function clearRealtimeChartTimer() {
  if (realtimeChartTimer) {
    clearTimeout(realtimeChartTimer)
    realtimeChartTimer = undefined
  }
}

function scheduleRealtimeChartRender() {
  const elapsed = Date.now() - lastRealtimeChartRenderAt
  if (elapsed >= REALTIME_CHART_REFRESH_INTERVAL) {
    clearRealtimeChartTimer()
    renderChart()
    return
  }
  if (!realtimeChartTimer) {
    realtimeChartTimer = setTimeout(() => {
      realtimeChartTimer = undefined
      renderChart()
    }, REALTIME_CHART_REFRESH_INTERVAL - elapsed)
  }
}

function formatTime(value?: number | string, pattern = 'YYYY-MM-DD HH:mm:ss') {
  if (!value) return '--'
  const time = dayjs(value)
  return time.isValid() ? time.format(pattern) : String(value)
}

function resizeChart() {
  chartInstance?.resize()
}

watch(
  () => [props.deviceId, props.property.identifier, props.property.valueType?.type],
  queryMiniChart,
  { immediate: true },
)

watch(
  chartRows,
  renderChart,
  { deep: true },
)

watch(
  () => [props.property.value, props.property.updatedAt],
  scheduleRealtimeChartRender,
)

if (typeof window !== 'undefined') {
  window.addEventListener('resize', resizeChart)
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', resizeChart)
  }
  clearRealtimeChartTimer()
  chartInstance?.dispose()
})
</script>

<style scoped>
.property-mini-chart {
  height: 7rem;
  min-width: 0;
}

.property-mini-chart__body {
  width: 100%;
  height: 100%;
}

.property-mini-chart__empty {
  display: grid;
  place-items: center;
  height: 100%;
  border: 0.0625rem dashed color-mix(in srgb, var(--jet-theme-border) 78%, transparent);
  border-radius: var(--jet-theme-radius);
  color: var(--jet-theme-text-disabled);
  background: color-mix(in srgb, var(--jet-theme-primary-soft) 72%, transparent);
  font-size: var(--fs-14);
}
</style>
