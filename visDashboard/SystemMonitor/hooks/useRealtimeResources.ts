import { computed, reactive, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSystemMonitorRuntime } from './useSystemMonitorRuntime'
import { formatMemorySize, nodeColor } from '../utils/monitorData'
import { formatNetworkSize } from '../utils/networkData'
import {
  calculateCpuLoadPressure,
  getCpuLoadPressureLevel,
  preserveRealtimeNodeOrder,
  sortRealtimeNodes,
  type RealtimeNode,
  type RealtimeSortKey,
  type RealtimeSortOrder,
} from '../utils/realtimeResourceData'

/** Table presentation and sorting consume shared samples; sorting never restarts sampling. */
export function useRealtimeResources(isEdit: Ref<boolean>) {
  const { t } = useI18n()
  const runtime = useSystemMonitorRuntime(isEdit)
  const nodes = runtime.nodes
  const sortKey = ref<RealtimeSortKey>()
  const sortOrder = ref<RealtimeSortOrder>('desc')
  const defaultNodeOrder = ref<string[]>([])
  interface RealtimeMetricItem {
    label: string
    value: string
  }

  const columns = computed<Array<{ key: RealtimeSortKey; label: string }>>(() => [
    { key: 'nodeId', label: t('components.RealtimeResource.node') },
    { key: 'system', label: t('components.RealtimeResource.system') },
    { key: 'jvm', label: t('components.RealtimeResource.jvm') },
    { key: 'disk', label: t('components.RealtimeResource.disk') },
    { key: 'network', label: t('components.RealtimeResource.network') },
  ])
  watch(nodes, next => { defaultNodeOrder.value = preserveRealtimeNodeOrder(next, defaultNodeOrder.value) }, { immediate: true })
  const sortedNodes = computed(() => {
    if (sortKey.value) return sortRealtimeNodes(nodes.value, sortKey.value, sortOrder.value)
    const byNodeId = new Map(nodes.value.map(node => [node.nodeId, node]))
    return defaultNodeOrder.value.map(nodeId => byNodeId.get(nodeId)).filter(Boolean) as RealtimeNode[]
  })
  const numberText = (value: number | undefined, digits = 0) => value === undefined ? '--' : value.toFixed(digits)
  const percentText = (value: number | undefined) => value === undefined ? '--' : `${value.toFixed(2)}%`
  const rateText = (value: number | undefined) => value === undefined ? '--' : `${formatNetworkSize(value)}/s`
  const capacityText = (used: number | undefined, total: number | undefined) => total === undefined
    ? '--'
    : `${formatMemorySize(used)} / ${formatMemorySize(total)}`
  const jvmMemoryDetail = (node: RealtimeNode) => [
    capacityText(node.memoryJvmUsed, node.memoryJvmTotal),
    t('components.RealtimeResource.nonHeapSize', [formatMemorySize(node.memoryJvmNonHeapUsed)]),
  ].join(' · ')
  const loadText = (node: RealtimeNode) => [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m]
    .map(value => numberText(value, 2)).join('/')
  const loadPercentText = (value: number | undefined) => value === undefined ? '--' : `${value.toFixed(1)}%`
  const loadStatusText = (node: RealtimeNode) => {
    const level = getCpuLoadPressureLevel(node.cpuLoadPressure)
    return level ? t(`components.RealtimeResource.loadStatus.${level}`) : ''
  }
  const loadSummary = (node: RealtimeNode) => node.cpuLoadPressure === undefined || !node.cpuLogicalProcessors
    ? `${t('components.RealtimeResource.loadAverage')} ${loadText(node)}`
    : t('components.RealtimeResource.loadPressureSummary', [
      loadPercentText(node.cpuLoadPressure),
      numberText(node.cpuLogicalProcessors),
      loadStatusText(node),
    ])
  const loadTooltip = (node: RealtimeNode) => {
    if (node.cpuLoadPressure === undefined || !node.cpuLogicalProcessors) return `${t('components.RealtimeResource.loadAverage')} ${loadText(node)}`
    const averages = [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m]
    const pressures = averages.map(value => calculateCpuLoadPressure(value, node.cpuLogicalProcessors))
    return t('components.RealtimeResource.loadPressureTooltip', [
      ...averages.map(value => numberText(value, 2)),
      numberText(node.cpuLogicalProcessors),
      ...pressures.map(loadPercentText),
    ])
  }
  const loadStatusClass = (node: RealtimeNode) => {
    const level = getCpuLoadPressureLevel(node.cpuLoadPressure)
    return ['realtime-resource__load-status', level && `realtime-resource__load-status--${level}`]
  }
  const diskItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.diskRead'), value: rateText(node.diskReadBytesPerSecond) },
    { label: t('components.RealtimeResource.diskWrite'), value: rateText(node.diskWriteBytesPerSecond) },
  ]
  const networkTrafficItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.networkDownload'), value: rateText(node.networkReceiveBytesPerSecond) },
    { label: t('components.RealtimeResource.networkUpload'), value: rateText(node.networkSendBytesPerSecond) },
  ]
  const networkConnectionItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.tcpConnections'), value: numberText(node.tcpConnectionsEstablished) },
  ]
  const networkQualityItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.packetLoss'), value: percentText(node.receivePacketLossRate) },
    { label: t('components.RealtimeResource.retransmission'), value: percentText(node.tcpRetransmissionRate) },
  ]

  const changeSort = (key: RealtimeSortKey) => {
    if (sortKey.value === key) sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
    else {
      sortKey.value = key
      sortOrder.value = key === 'nodeId' ? 'asc' : 'desc'
    }
  }

  return reactive({ ...runtime, loading: computed(() => !isEdit.value && runtime.loading.value),
    error: computed(() => !isEdit.value && runtime.error.value), empty: computed(() => !nodes.value.length),
    columns, sortedNodes, sortKey, sortOrder, changeSort, nodeColor, loadTooltip, loadStatusClass, loadSummary,
    jvmMemoryDetail, diskItems, networkTrafficItems, networkConnectionItems, networkQualityItems })
}
