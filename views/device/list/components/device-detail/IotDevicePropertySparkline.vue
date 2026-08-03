<template>
  <div class="property-sparkline" :data-tone="tone">
    <JEcharts v-if="displayRows.length" class="property-sparkline__chart" :option="chartOption" />
    <div v-else class="property-sparkline__empty">
      <i />
      <span>{{ $t('IotDeviceDetail.propertyChart.empty') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { splitPropertyValueAndUnit } from './iotDevicePropertyDisplay'
import type { PropertySparklinePoint } from './useIotDevicePropertySparklineData'

const props = defineProps({
  property: { type: Object as PropType<RealtimePropertyRow>, required: true },
  rows: { type: Array as PropType<PropertySparklinePoint[]>, default: () => [] },
  tone: { type: String, default: 'primary' },
  timeRange: { type: String as PropType<'1h' | '24h' | '7d'>, default: '1h' },
})

const { t: $t } = useI18n()
const displayRows = computed(() => {
  const rows = [...props.rows]
  const current = Number(splitPropertyValueAndUnit(props.property.value, props.property.unit).value)
  if (Number.isFinite(current)) {
    rows.push({
      time: props.property.updatedAt && props.property.updatedAt !== '--' ? props.property.updatedAt : Date.now(),
      value: current,
    })
  }
  return rows.slice(-12)
})

const chartOption = computed(() => {
  const unit = splitPropertyValueAndUnit(props.property.value, props.property.unit).unit
  const lineColor = toneColor.value
  return {
    animation: false,
    grid: { top: 8, right: 8, bottom: 20, left: 34 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter(params: any[]) {
        const item = params?.[0]
        const row = displayRows.value[item?.dataIndex ?? 0]
        return `${formatTime(row?.time, 'YYYY-MM-DD HH:mm:ss')}<br/>${props.property.name}: ${formatNumber(Number(row?.value ?? 0))}${unit}`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: displayRows.value.length === 1,
      data: displayRows.value.map((row) => formatAxisTime(row.time)),
      axisLabel: {
        color: '#8c9bab',
        fontSize: 10,
        hideOverlap: true,
        showMinLabel: true,
        showMaxLabel: true,
      },
      axisLine: { lineStyle: { color: '#e5e8ef' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitNumber: 2,
      axisLabel: {
        color: '#8c9bab',
        fontSize: 10,
        hideOverlap: true,
        formatter: (value: number) => formatAxisNumber(value),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e5e8ef' } },
    },
    series: [{
      type: 'line',
      data: displayRows.value.map((row) => row.value),
      smooth: true,
      showSymbol: displayRows.value.length <= 4,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 1.8, color: lineColor },
      itemStyle: { color: lineColor },
      areaStyle: { opacity: 0 },
    }],
  }
})
const toneColor = computed(() => {
  if (props.tone === 'danger') return '#ff4d4f'
  if (props.tone === 'warning') return '#faad14'
  if (props.tone === 'success') return '#52c41a'
  if (props.tone === 'slate') return '#8c9bab'
  return '#6b4eff'
})

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatTime(value?: number | string, pattern = 'HH:mm') {
  if (!value) return '--'
  const time = dayjs(value)
  return time.isValid() ? time.format(pattern) : String(value)
}

function formatAxisTime(value?: number | string) {
  if (props.timeRange === '7d') return formatTime(value, 'MM-DD')
  if (props.timeRange === '1h') return formatTime(value, 'HH:mm')
  return formatTime(value, 'HH:mm')
}

function formatAxisNumber(value: number) {
  const text = formatNumber(value)
  return text.length > 4 ? `${text.slice(0, 4)}` : text
}
</script>

<style scoped>
.property-sparkline {
  min-width: 0;
  height: 5rem;
  color: var(--jet-theme-primary);
}

.property-sparkline[data-tone='danger'] {
  color: var(--jet-theme-error);
}

.property-sparkline[data-tone='warning'] {
  color: var(--jet-theme-warning);
}

.property-sparkline[data-tone='success'] {
  color: var(--jet-theme-success);
}

.property-sparkline[data-tone='cyan'] {
  color: var(--jet-theme-primary);
}

.property-sparkline[data-tone='slate'] {
  color: var(--jet-theme-text-disabled);
}

.property-sparkline__chart {
  width: 100%;
  height: 100%;
}

.property-sparkline__empty {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-2);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-12);
}

.property-sparkline__empty i {
  display: block;
  width: 100%;
  height: 2rem;
  border-bottom: var(--jet-theme-stroke-width) solid color-mix(in srgb, currentColor 45%, transparent);
  opacity: 0.42;
}
</style>
