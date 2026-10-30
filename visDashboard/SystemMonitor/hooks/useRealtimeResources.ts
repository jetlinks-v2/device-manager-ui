import { computed, reactive, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSystemMonitorRuntime } from './useSystemMonitorRuntime'
import { formatMemorySize } from '../utils/monitorData'
import { formatNetworkSize } from '../utils/networkData'
import {
  calculateCpuLoadPressure, preserveRealtimeNodeOrder, sortRealtimeNodes,
  type RealtimeNode, type RealtimeSortKey, type RealtimeSortOrder,
} from '../utils/realtimeResourceData'

type MetricKey = 'cpuJvm' | 'memoryJvm' | 'cpuSystem' | 'memorySystem' | 'disk' | 'tcpConnectionsEstablished'
interface ResourceColumn { key: MetricKey; label: string; kind: 'percent' | 'usage' | 'count' }
export interface RealtimeDetailItem { label: string; value: string; tooltip?: string }
export interface RealtimeDetailGroup { title: string; items: RealtimeDetailItem[] }

/** 实时表仅维护本地排序与展开，共享采样及趋势选择不受表格操作影响。 */
export function useRealtimeResources(isEdit: Ref<boolean>) {
  const { t } = useI18n()
  const runtime = useSystemMonitorRuntime(isEdit)
  const nodes = runtime.nodes
  const sortKey = ref<RealtimeSortKey>()
  const sortOrder = ref<RealtimeSortOrder>('desc')
  const expandedNodeId = ref<string>()
  const defaultNodeOrder = ref<string[]>([])
  const noData = () => t('components.RealtimeResource.noData')
  const valid = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value)
  const numberText = (value: number | undefined, digits = 0) => valid(value) ? value.toFixed(digits) : noData()
  const percentText = (value: number | undefined, digits = 1) => valid(value) ? `${value.toFixed(digits)}%` : noData()
  const memoryText = (value: number | undefined) => valid(value) ? formatMemorySize(value) : noData()
  const rateText = (value: number | undefined) => valid(value) ? `${formatNetworkSize(value)}/s` : noData()

  const columns = computed<ResourceColumn[]>(() => [
    { key: 'cpuJvm', label: t('components.RealtimeResource.cpuJvm'), kind: 'percent' },
    { key: 'memoryJvm', label: t('components.RealtimeResource.heapColumn'), kind: 'usage' },
    { key: 'cpuSystem', label: t('components.RealtimeResource.cpuSystem'), kind: 'percent' },
    { key: 'memorySystem', label: t('components.RealtimeResource.systemMemoryColumn'), kind: 'usage' },
    { key: 'disk', label: t('components.RealtimeResource.systemDiskColumn'), kind: 'usage' },
    { key: 'tcpConnectionsEstablished', label: t('components.RealtimeResource.tcpColumn'), kind: 'count' },
  ])
  watch(nodes, next => {
    defaultNodeOrder.value = preserveRealtimeNodeOrder(next, defaultNodeOrder.value)
    // 新快照保留同一节点的展开；节点离开后清理，避免返回时误展开。
    if (expandedNodeId.value && !next.some(node => node.nodeId === expandedNodeId.value)) expandedNodeId.value = undefined
  }, { immediate: true })
  const sortedNodes = computed(() => {
    if (sortKey.value) return sortRealtimeNodes(nodes.value, sortKey.value, sortOrder.value)
    const byNodeId = new Map(nodes.value.map(node => [node.nodeId, node]))
    return defaultNodeOrder.value.flatMap(id => byNodeId.has(id) ? [byNodeId.get(id)!] : [])
  })
  const rows = computed(() => sortedNodes.value.map(node => {
    // 仅拆分明确的 name:port 或 [IPv6]:port；其他节点标识完整显示。
    const identity = /^([^:]+|\[[^\]]+\]):(\d+)$/.exec(node.nodeId)
    return {
      ...node, name: identity?.[1] ?? node.nodeId, port: identity?.[2],
      cells: columns.value.map(column => {
        const value = node[column.key]
        const capacity = column.key === 'memoryJvm' ? [node.memoryJvmUsed, node.memoryJvmTotal]
          : column.key === 'memorySystem' ? [node.memorySystemUsed, node.memorySystemTotal]
            : column.key === 'disk' ? [node.diskUsed, node.diskTotal] : undefined
        return {
          ...column, value,
          text: column.kind === 'count' ? numberText(value) : percentText(value),
          capacity: capacity?.every(valid) ? capacity.map(memoryText).join(' / ') : undefined,
        }
      }),
    }
  }))

  const loadTooltip = (node: RealtimeNode) => {
    if (!node.cpuLogicalProcessors) return undefined
    const averages = [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m]
    const pressures = averages.map(value => calculateCpuLoadPressure(value, node.cpuLogicalProcessors))
    return t('components.RealtimeResource.loadPressureTooltip', [
      ...averages.map(value => numberText(value, 2)), numberText(node.cpuLogicalProcessors),
      ...pressures.map(value => percentText(value)),
    ])
  }
  const detailGroups = (node: RealtimeNode): RealtimeDetailGroup[] => [
    { title: t('components.RealtimeResource.runtimeDetails'), items: [
      { label: t('components.RealtimeResource.logicalCores'), value: valid(node.cpuLogicalProcessors)
        ? t('components.RealtimeResource.coreCount', [numberText(node.cpuLogicalProcessors)]) : noData() },
      { label: t('components.RealtimeResource.systemLoad'), value: [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m]
        .some(valid) ? [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m].map(value => numberText(value, 2)).join(' / ') : noData() },
      { label: t('components.RealtimeResource.loadPressure'), value: percentText(node.cpuLoadPressure), tooltip: loadTooltip(node) },
      { label: t('components.RealtimeResource.nonHeapUsed'), value: memoryText(node.memoryJvmNonHeapUsed) },
    ] },
    { title: t('components.RealtimeResource.diskDetails'), items: [
      { label: t('components.RealtimeResource.diskReadRate'), value: rateText(node.diskReadBytesPerSecond) },
      { label: t('components.RealtimeResource.diskWriteRate'), value: rateText(node.diskWriteBytesPerSecond) },
    ] },
    { title: t('components.RealtimeResource.networkDetails'), items: [
      { label: t('components.RealtimeResource.downloadRate'), value: rateText(node.networkReceiveBytesPerSecond) },
      { label: t('components.RealtimeResource.uploadRate'), value: rateText(node.networkSendBytesPerSecond) },
      { label: t('components.RealtimeResource.packetLossRate'), value: percentText(node.receivePacketLossRate, 2) },
      { label: t('components.RealtimeResource.tcpRetransmissionRate'), value: percentText(node.tcpRetransmissionRate, 2) },
    ] },
  ]

  function changeSort(key: RealtimeSortKey) {
    const firstOrder = key === 'nodeId' ? 'asc' : 'desc'
    if (sortKey.value !== key) {
      sortKey.value = key
      sortOrder.value = firstOrder
    } else if (sortOrder.value === firstOrder) {
      sortOrder.value = firstOrder === 'desc' ? 'asc' : 'desc'
    } else {
      // 第三次点击退出手动排序，恢复采样期间持续维护的默认顺序。
      sortKey.value = undefined
      sortOrder.value = 'desc'
    }
  }
  function toggleDetails(nodeId: string) {
    expandedNodeId.value = expandedNodeId.value === nodeId ? undefined : nodeId
  }

  return reactive({ ...runtime, loading: computed(() => !isEdit.value && runtime.loading.value),
    error: computed(() => !isEdit.value && runtime.error.value), empty: computed(() => !nodes.value.length),
    columns, rows, sortKey, sortOrder, changeSort, expandedNodeId, toggleDetails, detailGroups })
}
