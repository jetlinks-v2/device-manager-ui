<template>
  <div class="health-trend">
    <div class="health-trend__legend">
      <span>{{ $t('IotHealthPage.trend.unit') }}</span>
      <div>
        <i class="health-trend__legend-score" />
        <span>{{ $t('IotHealthPage.trend.score') }}</span>
      </div>
    </div>
    <JEcharts class="health-trend__chart" :option="option" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  points: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
  labels: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  thresholdLabel: {
    type: String,
    required: true,
  },
})

const { t: $t } = useI18n()

function readThemeToken(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const option = computed(() => {
  const mutedText = readThemeToken('--jet-theme-text-disabled', '#86909c')
  const axisLine = readThemeToken('--jet-theme-border-secondary', '#c9cdd4')
  const chartColor = '#14c9c9'
  const tooltipBackground = readThemeToken('--jet-theme-bg-container', '#ffffff')
  const tooltipText = readThemeToken('--jet-theme-text-title', '#1d2129')

  return {
    animation: false,
    grid: { top: 8, right: 16, bottom: 28, left: 36, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: tooltipBackground,
      borderWidth: 0,
      padding: 12,
      textStyle: { color: tooltipText, fontSize: 14 },
      valueFormatter: (value: number) => `${value}${$t('IotHealthPage.unit.score')}`,
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#c9cdd4', width: 1, type: 'solid' },
      },
      extraCssText: 'box-shadow: 0 4px 10px rgb(0 0 0 / 10%);',
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: props.labels.length ? props.labels : props.points.map((_, index) => String(index + 1)),
      axisTick: { show: true, alignWithLabel: true, length: 4 },
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: {
        color: mutedText,
        fontSize: 12,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 20,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: mutedText, fontSize: 12 },
      splitLine: { lineStyle: { color: '#e5e6eb', type: 'dashed' } },
    },
    series: [
      {
        name: $t('IotHealthPage.trend.score'),
        type: 'line',
        data: props.points,
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: chartColor },
        itemStyle: { color: chartColor, borderColor: tooltipBackground, borderWidth: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(20, 201, 201, 0.2)' },
              { offset: 1, color: 'rgba(20, 201, 201, 0)' },
            ],
          },
        },
        emphasis: { focus: 'series' },
        markLine: {
          symbol: 'none',
          label: { formatter: `${props.thresholdLabel} 60`, color: readThemeToken('--jet-theme-warning', '#faa12d') },
          lineStyle: { color: readThemeToken('--jet-theme-warning', '#faa12d'), type: 'dashed' },
          data: [{ yAxis: 60 }],
        },
      },
    ],
  }
})
</script>

<style scoped>
.health-trend {
  display: grid;
  grid-template-rows: auto minmax(13rem, 1fr);
  gap: var(--space-3);
  height: 15.25rem;
}

.health-trend__legend,
.health-trend__legend > div {
  display: flex;
  align-items: center;
}

.health-trend__legend {
  justify-content: space-between;
  min-width: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-12);
  line-height: 1rem;
}

.health-trend__legend > div {
  gap: 0.25rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-13);
}

.health-trend__legend i {
  display: block;
  width: 0.5rem;
  height: 0.1875rem;
  margin-left: var(--space-3);
}

.health-trend__legend i:first-child {
  margin-left: 0;
}

.health-trend__legend-score {
  background: #14c9c9;
}

.health-trend__chart,
.health-trend__chart :deep(.echarts-warp) {
  height: 100%;
  min-height: 13rem;
}
</style>
