import type { PluginRuntimeInfo, PluginMetricSnapshot } from '../../../api/link/pluginRuntime'

export type PluginAvailability = 'available' | 'partial' | 'pending' | 'unavailable' | 'unknown' | 'previous'
export interface PluginRuntimeInspection {
  nodes: PluginRuntimeInfo[]
  instances: PluginRuntimeInfo[]
  nodeError: string
  instanceError: string
  pending: boolean
  limitReached: boolean
  busy: string
}
export function pluginRuntimeError(reason: unknown): string | undefined {
  if (reason instanceof Error) return reason.message
  if (reason instanceof Response) return `HTTP ${reason.status}`
  return typeof reason === 'string' ? reason : undefined
}
export function pluginRuntimeState(row: Partial<Pick<PluginRuntimeInfo, 'status' | 'state' | 'receivedAt'>>, now = Date.now()) {
  return row.status === 'unknown' || row.receivedAt != null && now - row.receivedAt >= 15000
    ? 'unknown' : row.state || row.status || 'unknown'
}
export function isPreviousPluginRevision(row: Pick<PluginRuntimeInfo, 'desiredRevision' | 'appliedRevision'>) {
  return !!row.desiredRevision && !!row.appliedRevision && row.desiredRevision !== row.appliedRevision
}
export function pluginInstancePreview(instances: PluginRuntimeInfo[]) {
  return instances.filter(row => (row.state || row.status) !== 'stopped' || !!row.error)
}
export function pluginAvailability(nodes: PluginRuntimeInfo[], revision?: string, now = Date.now()) {
  const fresh = nodes.filter(node => !node.receivedAt || now - node.receivedAt < 15000)
  const ready = fresh.filter(node => node.available && node.status === 'ready' && (!revision || node.appliedRevision === revision))
  const failed = fresh.filter(node => node.status === 'failed')
  const uncertain = fresh.length !== nodes.length || fresh.some(node => ['unknown', 'loading', 'notLoaded'].includes(node.status))
  let state: PluginAvailability = 'unknown'
  if (ready.length) state = failed.length ? 'partial' : 'available'
  else if (fresh.some(node => node.available)) state = 'previous'
  else if (!uncertain && failed.length) state = 'unavailable'
  else if (fresh.some(node => node.status === 'loading')) state = 'pending'
  return { state, ready: ready.length, failed: failed.length, uncertain }
}

export interface PluginMetricRow { key: string; name: string; value: string; description?: string; unit?: string }
/** Display package metadata from one fresh host of the desired revision, never mix hosts or revisions. */
export function pluginDriverMetadata(nodes: PluginRuntimeInfo[], revision?: string, now = Date.now()) {
  return nodes.find(node => node.status === 'ready' && node.available
    && (!revision || node.appliedRevision === revision)
    && (!node.receivedAt || now - node.receivedAt < 15000)
    && (node.driverName?.trim() || node.driverDescription?.trim()))
}

/** Definitions and nested scopes come from the backend; missing readings stay distinct from zero. */
export function pluginMetricRows(snapshot?: PluginMetricSnapshot, prefix = ''): PluginMetricRow[] {
  if (!snapshot) return []
  const definitions = new Map(snapshot.metadata?.properties?.map(property => [property.id, property]) || [])
  const rows: PluginMetricRow[] = Object.entries(snapshot.values || {}).map(([key, reading]) => {
    const definition = definitions.get(key)
    const value = !reading.available || reading.value == null ? '—'
      : typeof reading.value === 'object' ? JSON.stringify(reading.value) : String(reading.value)
    return { key: prefix + key, name: definition?.name || prefix + key, description: definition?.description,
      unit: definition?.valueType?.unit, value }
  })
  return rows.concat(Object.entries(snapshot.observations || {}).flatMap(([scope, child]) => pluginMetricRows(child, `${prefix}${scope}.`)))
}
