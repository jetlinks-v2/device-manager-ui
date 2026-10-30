import type { FocusScope, FocusSelections } from '../types'
import { defaultFocusedRealtimeNodes, resolveFocusedRealtimeNodes, type RealtimeNode } from './realtimeResourceData'

export const FOCUSED_NODES_STORAGE_KEY = 'jetlinks.runtime.monitor.focused-nodes.v2'
const LEGACY_KEY = 'jetlinks.runtime.monitor.focused-nodes.v1'
const scopes: FocusScope[] = ['cpu', 'memory', 'network']
const validNodes = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string')
type StorageReader = Pick<Storage, 'getItem'>

/** Read existing per-chart preferences, including the previous shared selection format. */
export function readFocusedNodes(storage?: StorageReader): Partial<FocusSelections> {
  try {
    const value = JSON.parse(storage?.getItem(FOCUSED_NODES_STORAGE_KEY) || 'null')
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(scopes.filter(scope => validNodes(value[scope])).map(scope => [scope, value[scope]]))
    }
    const legacy: unknown = JSON.parse(storage?.getItem(LEGACY_KEY) || 'null')
    return validNodes(legacy) ? Object.fromEntries(scopes.map(scope => [scope, legacy])) : {}
  } catch { return {} }
}

export type NetworkFocusMode = 'auto' | 'manual' | 'legacy'

/** 旧版未记录选择来源，保留到历史数据能确认是否需要修正；新手动空选择同样有效。 */
export function readNetworkFocusMode(storage?: StorageReader): NetworkFocusMode {
  try {
    const value = JSON.parse(storage?.getItem(FOCUSED_NODES_STORAGE_KEY) || 'null')
    if (validNodes(value?.network) && (value.networkMode === 'auto' || value.networkMode === 'manual')) {
      return value.networkMode
    }
    return readFocusedNodes(storage).network?.length ? 'legacy' : 'auto'
  } catch { return 'auto' }
}

/** Reconcile topology changes without undoing an explicitly cleared selection during this visit. */
export function reconcileFocusedNodes(nodes: RealtimeNode[], selected: string[], initialized: boolean, cached?: string[]) {
  if (!initialized) return resolveFocusedRealtimeNodes(nodes, cached)
  if (!selected.length) return selected
  const available = new Set(nodes.map(node => node.nodeId))
  const retained = selected.filter(nodeId => available.has(nodeId))
  // Stable selection references keep live sampling from resetting historical chart zoom.
  if (retained.length === selected.length) return selected
  return retained.length ? retained : defaultFocusedRealtimeNodes(nodes)
}
