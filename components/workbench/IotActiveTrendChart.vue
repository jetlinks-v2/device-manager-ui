<template>
  <JEcharts
    class="overview-chart__echarts"
    role="img"
    :aria-label="ariaLabel"
    :option="option"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  values: number[]
  points: Array<{ label: string; x: number; y: number }>
  windowLabel: string
  valueType?: 'message' | 'percent' | 'record'
  ariaLabel?: string
}>()

const { t: $t } = useI18n()
const ariaLabel = computed(() => props.ariaLabel || $t('IotWorkbench.chart.activeAria'))

function readThemeToken(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const styles = getComputedStyle(document.documentElement)
  let value = styles.getPropertyValue(name).trim()
  // ECharts canvas styles need resolved colors instead of CSS var() references.
  for (let index = 0; index < 3 && value.startsWith('var('); index += 1) {
    const nestedName = value.match(/var\((--[^,)]+)/)?.[1]
    value = nestedName ? styles.getPropertyValue(nestedName).trim() : ''
  }
  return value || fallback
}

function withAlpha(color: string, alpha: number) {
  const trimmed = color.trim()
  if (trimmed.startsWith('rgb(')) return trimmed.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  if (trimmed.startsWith('#') && (trimmed.length === 7 || trimmed.length === 4)) {
    const normalized = trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed
    const red = parseInt(normalized.slice(1, 3), 16)
    const green = parseInt(normalized.slice(3, 5), 16)
    const blue = parseInt(normalized.slice(5, 7), 16)
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }
  return color
}

function rem(value: number) {
  if (typeof window === 'undefined') return value * 16
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return value * (Number.isFinite(rootFontSize) ? rootFontSize : 16)
}

const labels = computed(() => {
  // Labels are produced from the complete timestamp span by the data layer; never infer dates from point indexes.
  return props.points.map((point) => point.label)
})

function recordAxisScale(values: number[]) {
  const peak = Math.max(0, ...values)
  if (peak <= 50) return { max: 50, interval: 10 }

  const roughInterval = peak / 5
  const magnitude = 10 ** Math.floor(Math.log10(roughInterval))
  const normalized = roughInterval / magnitude
  const factor = normalized <= 1
    ? 1
    : normalized <= 2
      ? 2
      : normalized <= 2.5
        ? 2.5
        : normalized <= 5
          ? 5
          : 10
  const interval = factor * magnitude
  return {
    max: Math.ceil(peak / interval) * interval,
    interval,
  }
}

const option = computed(() => {
  const primaryColor = readThemeToken('--jet-theme-primary', 'rgb(22, 119, 255)')
  const onlineRateColor = readThemeToken('--iot-online-rate-chart-color', 'rgb(20, 201, 201)')
  const alarmTrendColor = readThemeToken('--iot-alarm-trend-chart-color', 'rgb(250, 161, 45)')
  const chartColor = props.valueType === 'percent'
    ? onlineRateColor
    : props.valueType === 'record'
      ? alarmTrendColor
      : primaryColor
  const recordScale = recordAxisScale(props.values)
  const borderColor = readThemeToken('--jet-theme-border-secondary', 'rgb(240, 240, 240)')
  const mutedTextColor = readThemeToken('--jet-theme-text-disabled', 'rgb(156, 163, 175)')
  const tooltipBg = readThemeToken('--jet-theme-bg-container', '#ffffff')
  const textColor = readThemeToken('--jet-theme-text', 'rgb(31, 41, 55)')

  return {
    aria: { enabled: true },
    color: [chartColor],
    grid: { top: rem(0.5), right: rem(1.5), bottom: rem(0.25), left: 0, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: tooltipBg,
      borderColor,
      textStyle: { color: textColor },
      valueFormatter: (value: number) => {
        if (props.valueType === 'percent') return $t('IotWorkbench.chart.onlineRateValue', { value })
        if (props.valueType === 'record') return $t('IotWorkbench.chart.alarmCount', { total: value })
        return $t('IotWorkbench.chart.messageCount', { total: value })
      },
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#C9CDD4', width: 1, type: 'solid' },
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: labels.value,
	    axisTick: { show: true, alignWithLabel: true },
      axisLine: { lineStyle: { color: '#C9CDD4' } },
      axisLabel: { color: mutedTextColor, fontSize: 12, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
	    boundaryGap: true,
      min: 0,
      max: props.valueType === 'percent'
        ? 100
        : props.valueType === 'record'
          ? recordScale.max
          : undefined,
      interval: props.valueType === 'percent'
        ? 20
        : props.valueType === 'record'
          ? recordScale.interval
          : undefined,
      minInterval: 1,
      splitNumber: 5,
      axisLabel: {
        color: mutedTextColor,
        fontSize: 12,
        formatter: '{value}',
      },
      splitLine: { lineStyle: { color: '#E5E6EB', type: 'dashed' } },
    },
    series: [
      {
        name: props.valueType === 'percent'
          ? $t('IotWorkbench.chart.legendOnlineRate')
          : props.valueType === 'record'
            ? $t('IotWorkbench.chart.legendAlarmCount')
            : $t('IotWorkbench.chart.legendMessageCount'),
        type: 'line',
        data: props.values,
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: chartColor },
        itemStyle: { color: chartColor, borderColor: tooltipBg, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(chartColor, 0.16) },
              { offset: 1, color: withAlpha(chartColor, 0) },
            ],
          },
        },
        emphasis: { focus: 'series' },
      },
    ],
  }
})
</script>
