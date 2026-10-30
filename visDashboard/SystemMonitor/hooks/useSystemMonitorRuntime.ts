import { computed, inject, onActivated, onDeactivated, onMounted, onScopeDispose, provide, reactive, ref, watch, type InjectionKey, type Ref } from 'vue'
import dayjs from 'dayjs'
import { subscribeRealtimeResources, type MonitorSubscriber, type MonitorSubscription } from '../services/realtime'
import { createRealtimeNodeNormalizer, defaultFocusedRealtimeNodes, type RealtimeNode } from '../utils/realtimeResourceData'
import { FOCUSED_NODES_STORAGE_KEY, readFocusedNodes, readNetworkFocusMode, reconcileFocusedNodes } from '../utils/focusedNodes'
import type { FocusScope, FocusSelections } from '../types'

interface RuntimeOptions {
  enabled?: Ref<boolean>
  subscribe?: MonitorSubscriber
  storage?: Storage
  /** 独立监控工作台复用订阅时，不读取或覆盖仪表盘的图表聚焦偏好。 */
  persistFocus?: boolean
  staleAfterMs?: number
}
const runtimeKey: InjectionKey<SystemMonitorRuntime> = Symbol('system-monitor-runtime')

/** Own one live stream per dashboard, retaining independent CPU/memory/network focus preferences. */
export function createSystemMonitorRuntime(isEdit: Ref<boolean>, options: RuntimeOptions = {}) {
  const nodes = ref<RealtimeNode[]>([])
  const loading = ref(false)
  const error = ref(false)
  const updatedAt = ref('')
  const topologyVersion = ref(0)
  const selectedNodes = reactive<FocusSelections>({ cpu: [], memory: [], network: [] })
  const initialized: Record<FocusScope, boolean> = { cpu: false, memory: false, network: false }
  const resourceScopes: FocusScope[] = ['cpu', 'memory']
  let storage = options.persistFocus === false ? undefined : options.storage
  try { if (options.persistFocus !== false) storage ??= typeof localStorage === 'undefined' ? undefined : localStorage } catch { /* Disabled browser storage. */ }
  const cachedNodes = readFocusedNodes(storage)
  const networkFocusMode = ref(readNetworkFocusMode(storage))
  // 历史可能先于实时返回，保存网络默认时也需保留尚未核对拓扑的 CPU / 内存缓存。
  Object.assign(selectedNodes, cachedNodes)
  const normalize = createRealtimeNodeNormalizer()
  let subscription: MonitorSubscription | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let signature: string | undefined
  let mounted = false
  let active = true
  const defaultNodes = computed(() => defaultFocusedRealtimeNodes(nodes.value))
  const nodeIds = computed(() => nodes.value.map(node => node.nodeId))

  function persist() {
    try { storage?.setItem(FOCUSED_NODES_STORAGE_KEY, JSON.stringify({ ...selectedNodes, networkMode: networkFocusMode.value })) } catch { /* Keep in-session focus. */ }
  }

  function selectNodes(scope: FocusScope, values: string[]) {
    initialized[scope] = true
    if (scope === 'network') networkFocusMode.value = 'manual'
    selectedNodes[scope] = [...new Set(values)]
    persist()
  }

  /** 网络默认由当前历史指标提供；相同选择不重置图表缩放或重复写缓存。 */
  function selectNetworkDefaults(values: string[]) {
    const next = [...new Set(values)]
    const unchanged = next.length === selectedNodes.network.length
      && next.every((value, index) => value === selectedNodes.network[index])
    if (networkFocusMode.value === 'auto' && unchanged) return
    networkFocusMode.value = 'auto'
    if (!unchanged) selectedNodes.network = next
    persist()
  }

  /** Stop and invalidate callbacks before releasing the transport, including synchronous completion. */
  function stop() {
    generation++
    clearTimeout(timeout)
    subscription?.unsubscribe()
    subscription = undefined
    loading.value = false
  }

  function start() {
    if (!mounted || !active || isEdit.value || subscription) return
    const current = ++generation
    loading.value = true
    error.value = false
    const failed = () => {
      if (current !== generation) return
      clearTimeout(timeout)
      loading.value = false
      error.value = true
    }
    const armTimeout = () => {
      clearTimeout(timeout)
      timeout = setTimeout(failed, options.staleAfterMs ?? 15000)
    }
    armTimeout()
    try {
      subscription = (options.subscribe ?? subscribeRealtimeResources)({
        next(items) {
          if (current !== generation) return
          const next = normalize(items)
          const nextSignature = next.map(node => node.nodeId).sort().join('\n')
          // Sampling updates values only; a changed node set refreshes each history chart once.
          if (signature !== undefined && signature !== nextSignature) topologyVersion.value++
          signature = nextSignature
          nodes.value = next
          if (next.length) {
            for (const scope of resourceScopes) {
              selectedNodes[scope] = reconcileFocusedNodes(next, selectedNodes[scope], initialized[scope], cachedNodes[scope])
              initialized[scope] = true
            }
            // 网络只清理离开的节点，不使用 CPU / 内存压力补回默认选择。
            const available = new Set(next.map(node => node.nodeId))
            const retained = selectedNodes.network.filter(nodeId => available.has(nodeId))
            if (retained.length !== selectedNodes.network.length) selectedNodes.network = retained
            persist()
          }
          updatedAt.value = dayjs().format('HH:mm:ss')
          loading.value = false
          error.value = false
          armTimeout()
        },
        error: failed,
      })
    } catch { failed() }
  }

  function refresh() { stop(); start() }
  onMounted(() => { mounted = true; start() })
  onActivated(() => { active = true; start() })
  onDeactivated(() => { active = false; stop() })
  onScopeDispose(stop)
  watch(isEdit, () => { stop(); start() })
  return { nodes, nodeIds, defaultNodes, selectedNodes, topologyVersion, loading, error, updatedAt, networkFocusMode, selectNodes, selectNetworkDefaults, refresh }
}

export type SystemMonitorRuntime = ReturnType<typeof createSystemMonitorRuntime>

/** Provide instance-local node discovery; moving or resizing widgets does not restart this owner. */
export function provideSystemMonitorRuntime(options: RuntimeOptions = {}) {
  const runtime = createSystemMonitorRuntime(computed(() => options.enabled?.value === false), options)
  if (options.enabled) watch(options.enabled, enabled => {
    if (!enabled) { runtime.nodes.value = []; runtime.updatedAt.value = '' }
  })
  provide(runtimeKey, runtime)
  return runtime
}

/** Widgets can also run independently; preview instances never open a connection. */
export function useSystemMonitorRuntime(isEdit: Ref<boolean>) {
  return inject(runtimeKey, null) ?? createSystemMonitorRuntime(isEdit)
}
