import { computed, reactive, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSystemMonitorRuntime } from './useSystemMonitorRuntime'
import { nodeColor } from '../utils/monitorData'
import { useRealtimeResourcePresentation } from './useRealtimeResourcePresentation'
import {
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
  const { loadTooltip, loadStatusClass, loadSummary, jvmMemoryDetail, diskItems, networkTrafficItems, networkConnectionItems, networkQualityItems } = useRealtimeResourcePresentation()

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
