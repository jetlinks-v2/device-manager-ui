import { computed, inject, onActivated, onDeactivated, onMounted, onScopeDispose, provide, reactive, ref, watch, type InjectionKey, type Ref } from 'vue'
import dayjs from 'dayjs'
import { subscribeRealtimeResources, type MonitorSubscriber, type MonitorSubscription } from '../services/realtime'
import { createRealtimeNodeNormalizer, defaultFocusedRealtimeNodes, type RealtimeNode } from '../utils/realtimeResourceData'
import { FOCUSED_NODES_STORAGE_KEY, readFocusedNodes, reconcileFocusedNodes } from '../utils/focusedNodes'
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
  const scopes: FocusScope[] = ['cpu', 'memory', 'network']
  let storage = options.persistFocus === false ? undefined : options.storage
  try { if (options.persistFocus !== false) storage ??= typeof localStorage === 'undefined' ? undefined : localStorage } catch { /* Disabled browser storage. */ }
  const cachedNodes = readFocusedNodes(storage)
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
    try { storage?.setItem(FOCUSED_NODES_STORAGE_KEY, JSON.stringify(selectedNodes)) } catch { /* Keep in-session focus. */ }
  }

  function selectNodes(scope: FocusScope, values: string[]) {
    initialized[scope] = true
    selectedNodes[scope] = [...new Set(values)]
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
            for (const scope of scopes) {
              selectedNodes[scope] = reconcileFocusedNodes(next, selectedNodes[scope], initialized[scope], cachedNodes[scope])
              initialized[scope] = true
            }
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
  return { nodes, nodeIds, defaultNodes, selectedNodes, topologyVersion, loading, error, updatedAt, selectNodes, refresh }
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
