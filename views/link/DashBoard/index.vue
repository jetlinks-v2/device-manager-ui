<template>
    <j-page-container>
        <div>
            <a-row :gutter="[24, 24]">
                <a-col :span="24">
                  <RealtimeResourceChart
                    @nodes:change="syncRealtimeNodes"
                  />
                </a-col>
                <a-col :xs="24" :xl="12">
                  <MonitorTrend
                    :title="$t('components.MonitorTrend.cpuTitle')"
                    :metrics="cpuMetrics"
                    :selected-nodes="selectedNodes.cpu"
                    :default-nodes="defaultNodes"
                    :refresh-version="nodeRefreshVersion"
                    @update:selected-nodes="updateSelectedNodes('cpu', $event)"
                  />
                </a-col>
                <a-col :xs="24" :xl="12">
                  <MonitorTrend
                    :title="$t('components.MonitorTrend.memoryTitle')"
                    :metrics="memoryMetrics"
                    :selected-nodes="selectedNodes.memory"
                    :default-nodes="defaultNodes"
                    :refresh-version="nodeRefreshVersion"
                    @update:selected-nodes="updateSelectedNodes('memory', $event)"
                  />
                </a-col>
                <a-col :span="24" v-if="isNoCommunity">
                  <Network
                    :selected-nodes="selectedNodes.network"
                    :default-nodes="defaultNodes"
                    :available-nodes="realtimeNodeIds"
                    :refresh-version="nodeRefreshVersion"
                    @update:selected-nodes="updateSelectedNodes('network', $event)"
                  />
                </a-col>
            </a-row>
        </div>
    </j-page-container>
</template>

<script lang="ts" setup name="DashBoardPage">
import Network from './components/Network.vue';
import MonitorTrend from './components/MonitorTrend.vue';
import RealtimeResourceChart from './components/RealtimeResourceChart.vue';
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { useI18n } from 'vue-i18n'
import type { MonitorMetric } from './components/monitorData'
import {
  defaultFocusedRealtimeNodes,
  resolveFocusedRealtimeNodes,
  type RealtimeNode,
} from './components/realtimeResourceData'

type FocusScope = 'cpu' | 'memory' | 'network'
type FocusSelections = Record<FocusScope, string[]>

const FOCUSED_NODES_STORAGE_KEY = 'jetlinks.runtime.monitor.focused-nodes.v2'
const LEGACY_FOCUSED_NODES_STORAGE_KEY = 'jetlinks.runtime.monitor.focused-nodes.v1'
const FOCUS_SCOPES: FocusScope[] = ['cpu', 'memory', 'network']
const { t } = useI18n()
const selectedNodes = reactive<FocusSelections>({ cpu: [], memory: [], network: [] })
const realtimeNodes = ref<RealtimeNode[]>([])
const nodeRefreshVersion = ref(0)
const focusInitialized = reactive<Record<FocusScope, boolean>>({ cpu: false, memory: false, network: false })
let realtimeNodeSignature = ''

const defaultNodes = computed(() => defaultFocusedRealtimeNodes(realtimeNodes.value))
const realtimeNodeIds = computed(() => realtimeNodes.value.map(node => node.nodeId))

const validNodeIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nodeId => typeof nodeId === 'string')

const readCachedNodes = (): Partial<FocusSelections> => {
  try {
    const value = JSON.parse(localStorage.getItem(FOCUSED_NODES_STORAGE_KEY) || 'null')
    if (value && typeof value === 'object') {
      const record = value as Partial<Record<FocusScope, unknown>>
      return FOCUS_SCOPES.reduce<Partial<FocusSelections>>((result, scope) => {
        const nodes = record[scope]
        if (validNodeIds(nodes)) result[scope] = nodes
        return result
      }, {})
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_FOCUSED_NODES_STORAGE_KEY) || 'null')
    if (!validNodeIds(legacy)) return {}
    return FOCUS_SCOPES.reduce<Partial<FocusSelections>>((result, scope) => {
      result[scope] = legacy
      return result
    }, {})
  } catch {
    return {}
  }
}

const persistSelectedNodes = () => {
  try {
    localStorage.setItem(FOCUSED_NODES_STORAGE_KEY, JSON.stringify(selectedNodes))
  } catch {
    // 浏览器禁用本地存储时仍保留当前会话选择，不影响监控主流程。
  }
}

const updateSelectedNodes = (scope: FocusScope, nodeIds: string[]) => {
  focusInitialized[scope] = true
  selectedNodes[scope] = [...new Set(nodeIds)]
  persistSelectedNodes()
}

const syncRealtimeNodes = (nodes: RealtimeNode[]) => {
  realtimeNodes.value = nodes
  if (!nodes.length) return
  const nextSignature = nodes.map(node => node.nodeId).sort().join('\n')
  const nodeSetChanged = Boolean(realtimeNodeSignature) && nextSignature !== realtimeNodeSignature
  realtimeNodeSignature = nextSignature
  const cachedNodes = readCachedNodes()
  const available = new Set(nodes.map(node => node.nodeId))

  FOCUS_SCOPES.forEach((scope) => {
    if (!focusInitialized[scope]) {
      selectedNodes[scope] = resolveFocusedRealtimeNodes(nodes, cachedNodes[scope])
      focusInitialized[scope] = true
      return
    }
    if (!selectedNodes[scope].length) return
    const retained = selectedNodes[scope].filter(nodeId => available.has(nodeId))
    if (retained.length !== selectedNodes[scope].length) {
      selectedNodes[scope] = retained.length ? retained : defaultNodes.value
    }
  })
  persistSelectedNodes()
  if (nodeSetChanged) nodeRefreshVersion.value += 1
}

const cpuMetrics = computed<Array<{ label: string; value: MonitorMetric }>>(() => [
  { label: t('components.MonitorTrend.jvm'), value: 'cpuJvm' },
  { label: t('components.MonitorTrend.system'), value: 'cpuSystem' },
])

const memoryMetrics = computed<Array<{ label: string; value: MonitorMetric }>>(() => [
  { label: t('components.MonitorTrend.jvmMemory'), value: 'memoryJvm' },
  { label: t('components.MonitorTrend.systemMemory'), value: 'memorySystem' },
])

</script>
