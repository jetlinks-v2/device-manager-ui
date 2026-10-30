import { computed, reactive, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { loadResourceHistory } from '../services/history'
import { useMonitorHistory } from './useMonitorHistory'
import { useSystemMonitorRuntime } from './useSystemMonitorRuntime'
import { formatMemorySize, nodeColor, nodeSeriesVisual, sortMonitorTooltipItems, type MonitorMetric, type MonitorNodeSeries } from '../utils/monitorData'
import type { TrendView } from '../types'

/** CPU and memory share rendering and request state while retaining independent selections. */
export function useResourceTrend(scope: 'cpu' | 'memory', isEdit: Ref<boolean>): TrendView {
  const { t } = useI18n()
  const runtime = useSystemMonitorRuntime(isEdit)
  const activeMetric = ref<MonitorMetric>(scope === 'cpu' ? 'cpuJvm' : 'memoryJvm')
  const metricOptions = computed(() => scope === 'cpu' ? [
    { label: t('components.MonitorTrend.jvm'), value: 'cpuJvm' },
    { label: t('components.MonitorTrend.system'), value: 'cpuSystem' },
  ] : [
    { label: t('components.MonitorTrend.jvmMemory'), value: 'memoryJvm' },
    { label: t('components.MonitorTrend.systemMemory'), value: 'memorySystem' },
  ])
  const history = useMonitorHistory({ metric: activeMetric, isEdit, topologyVersion: runtime.topologyVersion,
    empty: (): MonitorNodeSeries[] => [], load: loadResourceHistory })
  const series = history.data
  const selectedNodes = computed(() => runtime.selectedNodes[scope])
  const isMemoryMetric = computed(() => scope === 'memory')
  const nodeOptions = computed(() => {
    const ids = runtime.nodeIds.value.length ? runtime.nodeIds.value : series.value.map(item => item.nodeId)
    return ids.map(nodeId => {
      const latest = series.value.find(item => item.nodeId === nodeId)?.latest
      return { label: nodeId, value: nodeId, color: nodeColor(nodeId),
        metric: latest ? `${latest.percent.toFixed(1)}%` : undefined,
        detail: isMemoryMetric.value && latest ? `${formatMemorySize(latest.used)} / ${formatMemorySize(latest.total)}` : undefined }
    })
  })
  const visibleSeries = computed(() => series.value.filter(item => selectedNodes.value.includes(item.nodeId)))
  const chartOptions = computed(() => ({
    animationDuration: 240,
    color: visibleSeries.value.map(item => nodeColor(item.nodeId)),
    grid: { left: 52, right: 24, top: 26, bottom: 26 },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    // 时间筛选后展示完整范围，保留图内缩放，不常驻底部缩放条。
    dataZoom: [{ type: 'inside', start: 0, end: 100 }],
    tooltip: {
      trigger: 'axis',
      formatter: (items: Array<{ seriesName: string; marker: string; data: MonitorPointTuple }>) => {
        if (!items.length) return ''
        const timestamp = dayjs(items[0].data[0]).format('YYYY-MM-DD HH:mm:ss')
        // Hover 用于同一时刻的横向比较，按使用率降序让高负载节点优先进入视线。
        const values = sortMonitorTooltipItems(items).map((item) => {
          const [, percent, used, total] = item.data
          const size = isMemoryMetric.value
            ? `<span class="monitor-tooltip__detail">${formatMemorySize(used)} / ${formatMemorySize(total)}</span>`
            : ''
          return `${item.marker}${item.seriesName}<span class="monitor-tooltip__value">${percent.toFixed(2)}%</span>${size}`
        })
        return `<div class="monitor-tooltip"><div class="monitor-tooltip__time">${timestamp}</div>${values.map(value => `<div class="monitor-tooltip__row">${value}</div>`).join('')}</div>`
      },
    },
    series: visibleSeries.value.map(item => ({
      name: item.nodeId === 'undefined' ? '' : item.nodeId,
      type: 'line',
      smooth: true,
      showSymbol: false,
      ...nodeSeriesVisual(item.nodeId),
      data: item.points.map(point => [point.timestamp, point.percent, point.used, point.total]),
    })),
  }))

  type MonitorPointTuple = [number, number, number | undefined, number | undefined]

  const view = reactive({
    title: computed(() => t(`components.MonitorTrend.${scope === 'cpu' ? 'cpuTitle' : 'memoryTitle'}`)),
    activeMetric, metricOptions, timeRange: history.timeRange, shortcut: history.shortcut,
    disabled: isEdit, loading: history.loading, error: history.error,
    empty: computed(() => !visibleSeries.value.some(item => item.points.length)),
    chartOptions, nodeOptions, selectedNodes,
    selectMetric(value: string | number) {
      if (metricOptions.value.some(item => item.value === value)) activeMetric.value = value as MonitorMetric
    },
    selectRange: history.selectRange, selectShortcut: history.selectShortcut, refresh: history.refresh,
    selectNodes: (values: string[]) => runtime.selectNodes(scope, values),
    resetNodes: () => runtime.selectNodes(scope, runtime.defaultNodes.value),
  })
  return view
}
