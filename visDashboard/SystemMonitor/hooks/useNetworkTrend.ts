import { computed, reactive, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSystemMonitorRuntime } from './useSystemMonitorRuntime'
import { useMonitorHistory } from './useMonitorHistory'
import { loadNetworkHistory } from '../services/history'
import { nodeColor, nodeSeriesVisual } from '../utils/monitorData'
import { formatNetworkCount, formatNetworkPercent, formatNetworkSize, latestNetworkValue,
  normalizeSystemNetworkHistory, renderNetworkMetricTooltip, type NetworkSeriesByKind,
  type NetworkSeriesKind, type NetworkTrendMetric, type NetworkTooltipItem } from '../utils/networkData'
import type { TrendView } from '../types'

/** Preserve separate traffic/host metrics while using the shared trend presentation. */
export function useNetworkTrend(isEdit: Ref<boolean>): TrendView {
  const { t } = useI18n()
  const runtime = useSystemMonitorRuntime(isEdit)
  const activeMetric = ref<NetworkTrendMetric>('traffic')
  const history = useMonitorHistory<Awaited<ReturnType<typeof loadNetworkHistory>>, NetworkTrendMetric>({
    metric: activeMetric, isEdit, topologyVersion: runtime.topologyVersion,
    empty: () => normalizeSystemNetworkHistory([]), load: loadNetworkHistory,
  })
  const metricOptions = computed(() => [
    { label: t('components.NetworkTrend.traffic'), value: 'traffic' },
    { label: t('components.NetworkTrend.quality'), value: 'quality' },
    { label: t('components.NetworkTrend.retransmission'), value: 'tcpRetransmission' },
    { label: t('components.NetworkTrend.connections'), value: 'tcpConnections' },
  ])
  // 业务流量与主机指标的数据来源不同，说明随来源切换，避免把同机节点的重复值相加。
  const metricScope = computed(() => activeMetric.value === 'traffic'
    ? {
        label: t('components.NetworkTrend.trafficScope'),
        tooltip: t('components.NetworkTrend.trafficScopeTooltip'),
      }
    : {
        label: t('components.NetworkTrend.systemScope'),
        tooltip: t('components.NetworkTrend.systemScopeTooltip'),
      })
  const metricKinds = computed<NetworkSeriesKind[]>(() => ({
    traffic: ['trafficUp', 'trafficDown'],
    quality: ['packetLoss', 'interfaceErrors'],
    tcpRetransmission: ['tcpRetransmission'],
    tcpConnections: ['tcpConnections'],
  })[activeMetric.value] as NetworkSeriesKind[])
  const kindLabels = computed<Record<NetworkSeriesKind, string>>(() => ({
    trafficUp: t('DeviceAccess.index.594346-26'),
    trafficDown: t('DeviceAccess.index.594346-27'),
    hostReceive: t('components.NetworkTrend.receive'),
    hostSend: t('components.NetworkTrend.send'),
    packetLoss: t('components.NetworkTrend.packetLoss'),
    interfaceErrors: t('components.NetworkTrend.interfaceErrors'),
    tcpRetransmission: t('components.NetworkTrend.retransmission'),
    tcpConnections: t('components.NetworkTrend.connections'),
  }))
  const currentSeries = computed<Partial<NetworkSeriesByKind>>(() => history.data.value.series)
  const dataNodes = computed(() => history.data.value.nodes)
  const availableNodeIds = computed(() => [...new Set(
    runtime.nodeIds.value.length ? runtime.nodeIds.value : dataNodes.value,
  )])
  const selectedNodes = computed(() => runtime.selectedNodes.network)
  const formatter = computed(() => activeMetric.value === 'traffic'
    ? formatNetworkSize
    : activeMetric.value === 'tcpConnections' ? formatNetworkCount : formatNetworkPercent)
  const latestMetric = (nodeId: string) => Math.max(
    ...metricKinds.value.map(kind => latestNetworkValue(nodeId, currentSeries.value[kind] || {} ) ?? -1),
  )
  const defaultNodes = computed(() => availableNodeIds.value
    .map(nodeId => ({ nodeId, value: latestMetric(nodeId) }))
    .filter(node => node.value >= 0)
    .sort((left, right) => right.value - left.value || left.nodeId.localeCompare(right.nodeId))
    .slice(0, 5)
    .map(node => node.nodeId))
  const canSelectDefaults = () => !isEdit.value && !history.loading.value && !history.error.value

  // 等当前指标的历史请求成功后再选节点；旧缓存仅在漏掉所有有效数据时纠正。
  // 明确的手动选择（含清空）不被时间切换、刷新或自动推荐覆盖。
  watch([defaultNodes, history.loading, history.error, runtime.networkFocusMode], () => {
    if (!canSelectDefaults() || runtime.networkFocusMode.value === 'manual') return
    if (runtime.networkFocusMode.value === 'legacy'
      && (!defaultNodes.value.length || selectedNodes.value.some(nodeId => latestMetric(nodeId) >= 0))) return
    runtime.selectNetworkDefaults(defaultNodes.value)
  }, { immediate: true })

  const nodeOptions = computed(() => availableNodeIds.value.map(nodeId => ({
    label: nodeId,
    value: nodeId,
    color: nodeColor(nodeId),
    metric: latestMetric(nodeId) < 0 ? undefined : formatter.value(latestMetric(nodeId)),
  })))
  const visibleSeries = computed(() => runtime.selectedNodes.network.flatMap(nodeId => metricKinds.value
    .filter(kind => currentSeries.value[kind]?.[nodeId])
    .map((kind, index) => ({ nodeId, kind, secondary: index > 0 }))))
  const legendItems = computed(() => metricKinds.value.map(kind => ({ kind, label: kindLabels.value[kind] })))

  const chartOptions = computed(() => {
    const traffic = activeMetric.value === 'traffic'
    const connections = activeMetric.value === 'tcpConnections'
    return {
      animationDuration: 240,
      grid: { left: 70, right: 24, bottom: 26, top: 24 },
      xAxis: traffic
        ? { type: 'category', boundaryGap: false, axisLabel: { hideOverlap: true }, data: ('times' in history.data.value ? history.data.value.times : []) }
        : { type: 'time', boundaryGap: false, axisLabel: { hideOverlap: true } },
      yAxis: {
        type: 'value', min: 0, minInterval: connections ? 1 : undefined,
        axisLabel: { formatter: (value: unknown) => formatter.value(value) },
      },
      // 时间筛选后展示完整范围，保留图内缩放，不常驻底部缩放条。
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      tooltip: {
        trigger: 'axis',
        formatter: (items: NetworkTooltipItem[]) => renderNetworkMetricTooltip(
          items, metricKinds.value, kindLabels.value, formatter.value,
        ),
      },
      series: visibleSeries.value.map(({ nodeId, kind, secondary }) => {
        const visual = nodeSeriesVisual(nodeId)
        return {
          name: `${nodeId} · ${kind}`,
          type: 'line', smooth: true, showSymbol: false, connectNulls: false,
          data: currentSeries.value[kind]?.[nodeId]?._data || [],
          ...visual,
          lineStyle: { ...visual.lineStyle, type: secondary ? 'dashed' : 'solid' },
        }
      }),
    }
  })

  const view = reactive({
    title: computed(() => t('components.NetworkTrend.title')),
    activeMetric, metricOptions, metricScope, legendItems, timeRange: history.timeRange, shortcut: history.shortcut,
    disabled: isEdit, loading: history.loading, error: history.error,
    empty: computed(() => !visibleSeries.value.some(({ nodeId, kind }) => latestNetworkValue(nodeId, currentSeries.value[kind] || {}) !== undefined)),
    chartOptions, nodeOptions, selectedNodes,
    selectMetric(value: string | number) {
      if (metricOptions.value.some(item => item.value === value)) activeMetric.value = value as NetworkTrendMetric
    },
    selectRange: history.selectRange, selectShortcut: history.selectShortcut, refresh: history.refresh,
    selectNodes: (values: string[]) => runtime.selectNodes('network', values),
    resetNodes: () => runtime.selectNetworkDefaults(canSelectDefaults() ? defaultNodes.value : []),
  })
  return view
}
