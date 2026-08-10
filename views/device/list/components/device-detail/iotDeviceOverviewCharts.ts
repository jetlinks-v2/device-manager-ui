import i18n from '@jetlinks-web-core/locales'

const $t = i18n.global.t

export interface OverviewStatCard {
  key: string
  label: string
  value: string
  unit: string
  sub: string
  tone: string
  chartOption: Record<string, unknown>
}

export interface OverviewTrendSeries {
  up: number[]
  down: number[]
}

export function createMessageTrendOption(labels: string[], series: OverviewTrendSeries, maxValue: number) {
  return {
    animation: false,
    color: ['#8b5cf6', '#f59e0b'],
    grid: { top: 12, right: 32, bottom: 28, left: 32, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (value: number) => $t('IotDeviceDetail.overview.chart.messageCount', { count: formatCount(Number(value || 0)) }),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: '#7e8da9',
        fontSize: 14,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(maxValue * 1.12),
      splitNumber: 4,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: '#7e8da9', fontSize: 14 },
      splitLine: { lineStyle: { color: '#e8edf4', type: 'dashed' } },
    },
    series: [
      createTrendLine($t('IotDeviceDetail.overview.upstreamMessages'), series.up, '#8b5cf6', true),
      createTrendLine($t('IotDeviceDetail.overview.downstreamMessages'), series.down, '#f59e0b', false),
    ],
  }
}

export function createStatCard(key: string, label: string, value: string, unit: string, sub: string, tone: string, values: number[], labels: string[] = []): OverviewStatCard {
  return { key, label, value, unit, sub, tone, chartOption: createStatSparkOption(values, tone, key, labels) }
}

export function formatCount(value: number) {
  return new Intl.NumberFormat(i18n.global.locale.value || undefined).format(value)
}

export function formatBytes(value: number) {
  if (value <= 0) return '0B'
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 102.4) / 10}MB`
  if (value >= 1024) return `${Math.round(value / 102.4) / 10}KB`
  return `${Math.round(value)}B`
}

export function formatDuration(value: number) {
  const minutes = Math.max(0, Math.floor(value / 60000))
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function createTrendLine(name: string, data: number[], color: string, withArea: boolean) {
  return {
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: withArea ? 6 : 4,
    data,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    areaStyle: withArea
      ? {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, .18)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0)' },
            ],
          },
        }
      : undefined,
  }
}

function createStatSparkOption(values: number[], tone: string, key: string, labels: string[]) {
  const color = statToneColor(tone)
  return {
    animation: false,
    grid: { top: 4, right: 0, bottom: 4, left: 0 },
    tooltip: {
      trigger: 'axis',
      confine: false,
      appendToBody: true,
      borderWidth: 0,
      padding: [8, 10],
      extraCssText: 'min-width: 96px;max-width: 180px;box-shadow: 0 8px 22px rgba(15,23,42,.16);',
      position: (point: number[], _params: unknown, _dom: HTMLElement, _rect: unknown, size: { contentSize: number[] }) => {
        const [width, height] = size.contentSize
        return [point[0] - width / 2, point[1] - height - 12]
      },
      formatter: (params: unknown) => formatSparkTooltip(params, key, color),
    },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, index) => labels[index] ?? '') },
    yAxis: { type: 'value', show: false, min: 0 },
    series: [{
      name: '',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 3,
      data: values,
      lineStyle: { width: 2, color },
      areaStyle: { color: 'transparent' },
    }],
  }
}

function formatSparkTooltip(params: unknown, key: string, color: string) {
  const item = Array.isArray(params) ? params[0] : params
  const data = item as { axisValueLabel?: string; axisValue?: string; value?: number }
  const time = data?.axisValueLabel || data?.axisValue || ''
  const value = formatSparkValue(key, Number(data?.value || 0))
  return `
    <div style="display:grid;gap:4px;color:#667085;font-size:12px;line-height:1.25;">
      <span>${time}</span>
      <span style="display:flex;align-items:center;gap:6px;min-width:0;">
        <i style="width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:${color};"></i>
        <strong style="overflow:hidden;color:#344054;font-size:14px;font-weight:700;text-overflow:ellipsis;white-space:nowrap;">${value}</strong>
      </span>
    </div>`
}

function formatSparkValue(key: string, value: number) {
  if (key === 'active') return formatDuration(value)
  if (key === 'traffic') return formatBytes(value)
  return $t('IotDeviceDetail.overview.chart.messageCount', { count: formatCount(value) })
}

function statToneColor(tone: string) {
  if (tone === 'orange') return '#f59e0b'
  if (tone === 'cyan') return '#06b6d4'
  return '#8b5cf6'
}
