<template>
  <div class="group-trend-chart">
    <JEcharts :option="option" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GroupDashboardTrendSeries } from './groupDetailDashboard.types'

const props = defineProps<{
  series: GroupDashboardTrendSeries
}>()
const { t: $t } = useI18n()

const option = computed(() => ({
  animation: false,
  grid: {
    top: 36,
    left: 16,
    right: 18,
    bottom: 24,
    containLabel: true,
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'var(--bg-elev)',
    borderColor: 'var(--line)',
    textStyle: {
      color: 'var(--ink-1)',
      fontSize: 14,
    },
	  axisPointer: {
		  type: 'line',
		  lineStyle: { color: '#C9CDD4', width: 1, type: 'solid' },
	  },
  },
  xAxis: {
    type: 'category',
    data: props.series.points.map((item) => item.label),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: 'var(--ink-3)',
      fontSize: 14,
    },
  },
  yAxis: {
    type: 'value',
    min: props.series.key === 'onlineRate' ? 0 : undefined,
    max: props.series.key === 'onlineRate' ? 100 : undefined,
    splitNumber: props.series.key === 'onlineRate' ? undefined : 3,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: 'var(--ink-3)',
      fontSize: 14,
    },
    splitLine: {
      lineStyle: {
        color: '#E5E6EB',
	      type: 'dashed',
      },
    },
  },
  series: [{
    type: 'line',
    data: props.series.points.map((item) => item.value),
    smooth: true,
	  showSymbol: false,
    lineStyle: {
      width: 1,
      color: resolveColor(props.series.accent),
    },
    itemStyle: {
      color: resolveColor(props.series.accent),
      borderColor: '#fff',
      borderWidth: 2,
    },
    areaStyle: {
      color: 'rgba(35, 189, 137, 0.12)',
    },
    markLine: props.series.key === 'onlineRate'
      ? {
          silent: true,
          label: {
            formatter: $t('IotDeviceGroups.trend.warningLine70'),
            color: '#c46a16',
            fontSize: 14,
            position: 'insideEndTop',
          },
          lineStyle: {
            color: '#f3a64b',
            type: 'dashed',
            width: 1.5,
          },
          data: [{ yAxis: 70 }],
        }
      : undefined,
  }],
}))

function resolveColor(color: string) {
  if (typeof window === 'undefined') return color
  const match = color.match(/^var\((--[^)]+)\)$/)
  if (!match) return color
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim()
  return value || color
}
</script>

<style scoped>
.group-trend-chart {
  height: 13.75rem;
}
</style>
