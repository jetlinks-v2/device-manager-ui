<template>
  <a-spin :spinning="loading">
    <section class="network-trend">
      <header class="network-trend__header">
        <div class="network-trend__title-group">
          <h3>{{ $t('components.NetworkTrend.title') }}</h3>
          <a-segmented v-model:value="activeMetric" size="small" :options="metricOptions" />
          <a-tooltip :title="metricScope.tooltip">
            <span class="network-trend__scope">
              <AIcon type="InfoCircleOutlined" />
              {{ metricScope.label }}
            </span>
          </a-tooltip>
        </div>
        <div class="network-trend__actions">
          <a-range-picker
            v-model:value="timeRange"
            :allow-clear="false"
            :show-time="{ format: 'HH:mm:ss' }"
            format="YYYY-MM-DD HH:mm:ss"
            @change="onRangeChange"
          >
            <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
            <template #renderExtraFooter>
              <a-radio-group v-model:value="shortcut" button-style="solid" size="small">
                <a-radio-button value="hour">{{ $t('components.MonitorTrend.lastHour') }}</a-radio-button>
                <a-radio-button value="day">{{ $t('components.MonitorTrend.lastDay') }}</a-radio-button>
                <a-radio-button value="week">{{ $t('components.MonitorTrend.lastWeek') }}</a-radio-button>
              </a-radio-group>
            </template>
          </a-range-picker>
          <a-tooltip :title="$t('components.MonitorRefresh.button')">
            <a-button type="text" :loading="loading" @click="refresh">
              <template #icon><AIcon type="ReloadOutlined" /></template>
            </a-button>
          </a-tooltip>
        </div>
      </header>

      <div v-if="legendItems.length > 1" class="network-trend__legend">
        <span v-for="(item, index) in legendItems" :key="item.kind">
          <i class="network-trend__line" :class="{ 'network-trend__line--secondary': index > 0 }" />
          {{ item.label }}
        </span>
      </div>

      <j-empty v-if="!loading && !visibleSeries.length" class="network-trend__empty" />
      <div v-else class="network-trend__chart">
        <JEcharts :option="chartOptions" not-merge />
      </div>
      <NodeFocusSelector
        v-if="nodeOptions.length > 1"
        :value="selectedNodes"
        :options="nodeOptions"
        @update:value="updateSelectedNodes"
        @reset="resetFocusedNodes"
      />
    </section>
  </a-spin>
</template>

<script lang="ts" setup name="Network">
import type { PropType } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { useI18n } from 'vue-i18n'
import { dashboard } from '../../../../api/link/dashboard'
import { getTimeByType, networkHistoryParams, networkParams } from './tool'
import NodeFocusSelector from './NodeFocusSelector.vue'
import { nodeColor, nodeSeriesVisual } from './monitorData'
import {
  formatNetworkCount,
  formatNetworkPercent,
  formatNetworkSize,
  latestNetworkValue,
  normalizeSystemNetworkHistory,
  normalizeTrafficHistory,
  renderNetworkMetricTooltip,
  type NetworkHistoryResponseItem,
  type NetworkSeriesByKind,
  type NetworkSeriesKind,
  type NetworkTrendMetric,
  type TrafficHistoryResult,
} from './networkData'

const EMPTY_TRAFFIC: TrafficHistoryResult = {
  times: [], nodes: [], series: { trafficUp: {}, trafficDown: {} },
}
const EMPTY_SYSTEM = normalizeSystemNetworkHistory([])

const props = defineProps({
  selectedNodes: { type: Array as PropType<string[]>, default: () => [] },
  defaultNodes: { type: Array as PropType<string[]>, default: () => [] },
  availableNodes: { type: Array as PropType<string[]>, default: () => [] },
  refreshVersion: { type: Number, default: 0 },
})
const emit = defineEmits(['update:selectedNodes'])
const { t } = useI18n()

const loading = ref(false)
const activeMetric = ref<NetworkTrendMetric>('traffic')
const shortcut = ref<'hour' | 'day' | 'week' | undefined>('hour')
const timeRange = ref<[Dayjs, Dayjs]>([dayjs(getTimeByType('hour')), dayjs()])
const trafficHistory = ref<TrafficHistoryResult>(EMPTY_TRAFFIC)
const systemHistory = ref(EMPTY_SYSTEM)
let requestSequence = 0

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
  packetLoss: t('components.NetworkTrend.packetLoss'),
  interfaceErrors: t('components.NetworkTrend.interfaceErrors'),
  tcpRetransmission: t('components.NetworkTrend.retransmission'),
  tcpConnections: t('components.NetworkTrend.connections'),
}))
const currentSeries = computed<Partial<NetworkSeriesByKind>>(() => activeMetric.value === 'traffic'
  ? trafficHistory.value.series
  : systemHistory.value.series)
const dataNodes = computed(() => activeMetric.value === 'traffic'
  ? trafficHistory.value.nodes
  : systemHistory.value.nodes)
const availableNodeIds = computed(() => [...new Set(
  props.availableNodes.length ? props.availableNodes : dataNodes.value,
)])
const selectedNodes = computed(() => props.selectedNodes)
const formatter = computed(() => activeMetric.value === 'traffic'
  ? formatNetworkSize
  : activeMetric.value === 'tcpConnections' ? formatNetworkCount : formatNetworkPercent)
const latestMetric = (nodeId: string) => Math.max(
  ...metricKinds.value.map(kind => latestNetworkValue(nodeId, currentSeries.value[kind] || {} ) ?? -1),
)
const nodeOptions = computed(() => availableNodeIds.value.map(nodeId => ({
  label: nodeId,
  value: nodeId,
  color: nodeColor(nodeId),
  metric: latestMetric(nodeId) < 0 ? undefined : formatter.value(latestMetric(nodeId)),
})))
const visibleSeries = computed(() => props.selectedNodes.flatMap(nodeId => metricKinds.value
  .filter(kind => currentSeries.value[kind]?.[nodeId])
  .map((kind, index) => ({ nodeId, kind, secondary: index > 0 }))))
const legendItems = computed(() => metricKinds.value.map(kind => ({ kind, label: kindLabels.value[kind] })))

const updateSelectedNodes = (value: string[]) => emit('update:selectedNodes', value)
const resetFocusedNodes = () => emit('update:selectedNodes', props.defaultNodes)

const loadHistory = async () => {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const params = activeMetric.value === 'traffic'
      ? networkParams({ time: { time: timeRange.value } })
      : networkHistoryParams({ time: timeRange.value })
    const response = await dashboard(params) as { success?: boolean; result?: NetworkHistoryResponseItem[] }
    if (sequence !== requestSequence) return
    const items = response.success ? response.result || [] : []
    if (activeMetric.value === 'traffic') trafficHistory.value = normalizeTrafficHistory(items)
    else systemHistory.value = normalizeSystemNetworkHistory(items)
  } catch {
    if (sequence !== requestSequence) return
    if (activeMetric.value === 'traffic') trafficHistory.value = EMPTY_TRAFFIC
    else systemHistory.value = EMPTY_SYSTEM
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

const onRangeChange = () => {
  shortcut.value = undefined
  loadHistory()
}
const refresh = () => {
  if (shortcut.value) timeRange.value = [dayjs(getTimeByType(shortcut.value)), dayjs()]
  loadHistory()
}

const chartOptions = computed(() => {
  const traffic = activeMetric.value === 'traffic'
  const connections = activeMetric.value === 'tcpConnections'
  return {
    animationDuration: 240,
    grid: { left: 70, right: 24, bottom: 44, top: 24 },
    xAxis: traffic
      ? { type: 'category', boundaryGap: false, data: trafficHistory.value.times }
      : { type: 'time', boundaryGap: false },
    yAxis: {
      type: 'value', min: 0, minInterval: connections ? 1 : undefined,
      axisLabel: { formatter: (value: unknown) => formatter.value(value) },
    },
    dataZoom: [
      { type: 'inside', start: shortcut.value === 'hour' ? 0 : 70, end: 100 },
      { type: 'slider', height: 20, bottom: 4, start: shortcut.value === 'hour' ? 0 : 70, end: 100 },
    ],
    tooltip: {
      trigger: 'axis',
      formatter: (items: any[]) => renderNetworkMetricTooltip(
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

watch(shortcut, (value) => {
  if (!value) return
  timeRange.value = [dayjs(getTimeByType(value)), dayjs()]
  loadHistory()
}, { immediate: true })
watch(activeMetric, loadHistory)
watch(() => props.refreshVersion, refresh)
</script>

<style lang="less" scoped>
.network-trend {
  display: flex;
  flex-direction: column;
  min-height: 30rem;
  padding: var(--space-6, 1.5rem);
  background: var(--bg, #fff);
  border-radius: 0.25rem;
}
.network-trend__header,
.network-trend__title-group,
.network-trend__actions,
.network-trend__legend,
.network-trend__legend span { display: flex; align-items: center; }
.network-trend__header { justify-content: space-between; gap: var(--space-4, 1rem); }
.network-trend__title-group,
.network-trend__actions,
.network-trend__legend { gap: var(--space-3, 0.75rem); }
.network-trend__title-group h3 { margin: 0; }
.network-trend__scope {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: rgba(0, 0, 0, 0.45);
  font-size: 0.75rem;
  white-space: nowrap;
  cursor: help;
}
.network-trend__legend { margin-top: var(--space-3, 0.75rem); color: rgba(0, 0, 0, 0.45); }
.network-trend__legend span { gap: 0.375rem; }
.network-trend__line { width: 1.25rem; border-top: 2px solid currentColor; }
.network-trend__line--secondary { border-top-style: dashed; }
.network-trend__chart { height: 20rem; margin-top: var(--space-2, 0.5rem); }
.network-trend__empty { height: 22rem; }
@media (max-width: 70rem) {
  .network-trend__header { align-items: flex-start; flex-direction: column; }
}
</style>

<style lang="less" src="./monitorTooltip.less"></style>
