<template>
  <a-spin :spinning="loading">
    <section class="realtime-resource">
      <header class="realtime-resource__header">
        <div class="realtime-resource__title">
          <h3>{{ $t('components.RealtimeResource.title') }}</h3>
          <span>{{ $t('components.RealtimeResource.updatedAt', [updatedAt || '--']) }}</span>
        </div>
        <div class="realtime-resource__actions">
          <a-tag color="processing">{{ $t('components.RealtimeResource.live') }}</a-tag>
          <a-tooltip :title="$t('components.MonitorRefresh.button')">
            <a-button type="text" :loading="loading" @click="refresh">
              <template #icon><AIcon type="ReloadOutlined" /></template>
            </a-button>
          </a-tooltip>
        </div>
      </header>

      <div v-if="!nodes.length" class="realtime-resource__empty"><j-empty /></div>
      <template v-else>
        <div class="realtime-resource__table-wrap">
          <table class="realtime-resource__table">
            <thead>
              <tr>
                <th v-for="column in columns" :key="column.key">
                  <button type="button" @click="changeSort(column.key)">
                    {{ column.label }}
                    <AIcon v-if="sortKey === column.key" :type="sortOrder === 'asc' ? 'CaretUpOutlined' : 'CaretDownOutlined'" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="node in sortedNodes" :key="node.nodeId">
                <td>
                  <div class="realtime-resource__node-cell">
                    <i class="realtime-resource__node-dot" :style="{ backgroundColor: nodeColor(node.nodeId) }" />
                    <j-ellipsis class="realtime-resource__node">{{ node.nodeId }}</j-ellipsis>
                  </div>
                  <NodeHealthStatus :health="node.health" />
                </td>
                <td>
                  <div class="realtime-resource__submetric">
                    <span>{{ $t('components.RealtimeResource.cpuLabel') }}</span>
                    <ResourceUsage :percent="node.cpuSystem">
                      <template #detail>
                        <a-tooltip :title="loadTooltip(node)">
                          <span :class="loadStatusClass(node)">
                            <i />
                            {{ loadSummary(node) }}
                          </span>
                        </a-tooltip>
                      </template>
                    </ResourceUsage>
                  </div>
                  <div class="realtime-resource__submetric">
                    <span>{{ $t('components.RealtimeResource.memorySystem') }}</span>
                    <ResourceUsage :percent="node.memorySystem" :used="node.memorySystemUsed" :total="node.memorySystemTotal" />
                  </div>
                </td>
                <td>
                  <div class="realtime-resource__submetric">
                    <span>{{ $t('components.RealtimeResource.cpuLabel') }}</span>
                    <ResourceUsage :percent="node.cpuJvm" />
                  </div>
                  <div class="realtime-resource__submetric">
                    <span>{{ $t('components.RealtimeResource.jvmMemoryShort') }}</span>
                    <ResourceUsage
                      :percent="node.memoryJvm"
                      :detail="jvmMemoryDetail(node)"
                    />
                  </div>
                </td>
                <td>
                  <ResourceUsage :percent="node.disk" :used="node.diskUsed" :total="node.diskTotal" />
                  <RealtimeMetricGroup :items="diskItems(node)" inline fit />
                </td>
                <td>
                  <RealtimeMetricGroup :items="networkTrafficItems(node)" inline />
                  <RealtimeMetricGroup :items="networkConnectionItems(node)" compact />
                  <RealtimeMetricGroup :items="networkQualityItems(node)" inline />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </a-spin>
</template>

<script lang="ts" setup name="RealtimeResourceChart">
import dayjs from 'dayjs'
import { map } from 'rxjs/operators'
import { wsClient } from '@jetlinks-web/core'
import { useI18n } from 'vue-i18n'
import ResourceUsage from './ResourceUsage.vue'
import RealtimeMetricGroup from './RealtimeMetricGroup.vue'
import NodeHealthStatus from './NodeHealthStatus.vue'
import { formatMemorySize, nodeColor } from './monitorData'
import { formatNetworkSize } from './networkData'
import {
  calculateCpuLoadPressure,
  createRealtimeNodeNormalizer,
  getCpuLoadPressureLevel,
  preserveRealtimeNodeOrder,
  sortRealtimeNodes,
  type RealtimeNode,
  type RealtimePayloadItem,
  type RealtimeSortKey,
  type RealtimeSortOrder,
} from './realtimeResourceData'

const { t } = useI18n()
const emit = defineEmits(['nodes:change'])
const nodes = ref<RealtimeNode[]>([])
const updatedAt = ref('')
const loading = ref(true)
const sortKey = ref<RealtimeSortKey>()
const sortOrder = ref<RealtimeSortOrder>('desc')
const defaultNodeOrder = ref<string[]>([])
const subscriptionVersion = ref(0)
const subscription = ref<{ unsubscribe: () => void }>()
const normalizeNodes = createRealtimeNodeNormalizer()

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
const unsubscribe = () => {
  subscription.value?.unsubscribe()
  subscription.value = undefined
}
const subscribe = () => {
  unsubscribe()
  loading.value = true
  subscription.value = wsClient.getWebSocket(
    `operations-realtime-resource-${subscriptionVersion.value}`,
    '/dashboard/systemMonitor/stats/info/realTime',
    { type: 'all', interval: '3s' },
  )
    .pipe(map((response: any) => response.payload))
    .subscribe((payload: { value?: RealtimePayloadItem[] | { value?: RealtimePayloadItem[] } }) => {
      const items = Array.isArray(payload?.value) ? payload.value : payload?.value?.value
      if (!Array.isArray(items)) return
      const normalized = normalizeNodes(items)
      defaultNodeOrder.value = preserveRealtimeNodeOrder(normalized, defaultNodeOrder.value)
      nodes.value = normalized
      emit('nodes:change', normalized)
      updatedAt.value = dayjs().format('HH:mm:ss')
      loading.value = false
    })
}
const refresh = () => {
  subscriptionVersion.value += 1
  subscribe()
}

onMounted(subscribe)
onUnmounted(() => {
  unsubscribe()
})
</script>

<style lang="less" scoped>
.realtime-resource { padding: var(--space-6, 1.5rem); background: var(--bg, #fff); border-radius: 0.25rem; }
.realtime-resource__header, .realtime-resource__title, .realtime-resource__actions { display: flex; align-items: center; }
.realtime-resource__header { justify-content: space-between; }
.realtime-resource__header h3 { margin: 0; }
.realtime-resource__header span, .realtime-resource__submetric > span { color: rgba(0, 0, 0, 0.45); }
.realtime-resource__title, .realtime-resource__actions { gap: var(--space-2, 0.5rem); }
.realtime-resource__table-wrap { height: 24.75rem; margin-top: var(--space-3, 0.75rem); overflow: auto; }
.realtime-resource__table { width: 100%; min-width: 74rem; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
.realtime-resource__table th:first-child, .realtime-resource__table td:first-child { width: 10.5rem; }
.realtime-resource__table th:nth-child(2), .realtime-resource__table td:nth-child(2), .realtime-resource__table th:nth-child(3), .realtime-resource__table td:nth-child(3) { width: 18.5rem; }
.realtime-resource__table th:nth-child(4), .realtime-resource__table td:nth-child(4) { width: 12.5rem; }
.realtime-resource__table th:nth-child(5), .realtime-resource__table td:nth-child(5) { width: 14rem; }
.realtime-resource__table th:first-child, .realtime-resource__table td:first-child { position: sticky; left: 0; z-index: 1; background: var(--bg, #fff); box-shadow: 0.25rem 0 0.5rem -0.5rem rgba(0, 0, 0, 0.24); }
.realtime-resource__table th { position: sticky; top: 0; z-index: 2; padding: 0.375rem 0.75rem; color: rgba(0, 0, 0, 0.45); font-size: 0.75rem; text-align: left; background: var(--bg, #fff); }
.realtime-resource__table th:first-child { z-index: 3; }
.realtime-resource__table th button { padding: 0; color: inherit; background: none; border: 0; cursor: pointer; }
.realtime-resource__table td { min-height: 4rem; padding: 0.25rem 0.75rem; border-top: 1px solid var(--line, #f0f0f0); vertical-align: middle; }
.realtime-resource__table tbody td { background: var(--bg, #fff); transition: background-color 0.16s ease; }
.realtime-resource__table tbody tr:hover td { background: var(--primary-1, #e6f4ff); }
.realtime-resource__node-cell { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.realtime-resource__node-dot { flex: none; width: 0.5rem; height: 0.5rem; border-radius: 50%; }
.realtime-resource__node { min-width: 0; font-weight: 500; }
.realtime-resource__submetric { display: grid; grid-template-columns: 3rem minmax(0, 1fr); align-items: start; gap: 0.375rem; margin-top: 0.125rem; }
.realtime-resource__submetric:first-child { margin-top: 0; }
.realtime-resource__submetric > span { padding-top: 0.0625rem; font-size: 0.75rem; line-height: 1.25; text-align: right; }
.realtime-resource__load-status { display: inline-flex; align-items: center; gap: 0.25rem; max-width: 100%; white-space: nowrap; }
.realtime-resource__load-status i { flex: none; width: 0.375rem; height: 0.375rem; border-radius: 50%; background: rgba(0, 0, 0, 0.25); }
.realtime-resource__load-status--normal i { background: #52c41a; }
.realtime-resource__load-status--elevated { color: #d48806; }
.realtime-resource__load-status--elevated i { background: #faad14; }
.realtime-resource__load-status--overloaded { color: #cf1322; font-weight: 500; }
.realtime-resource__load-status--overloaded i { background: #ff4d4f; }
.realtime-resource__table td:nth-child(4) :deep(.realtime-metric-group) { margin-top: 0.125rem; }
.realtime-resource__empty { height: 10rem; }
</style>
