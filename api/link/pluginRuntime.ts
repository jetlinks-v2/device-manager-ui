import { request } from '@jetlinks-web/core'
import { postRuntimeNdJson } from '@jetlinks-web-core/utils/ndjson-precision'
import { unwrapDiagnosticRecord } from './diagnosticStream'
import { map } from 'rxjs'

export interface PluginMetricSnapshot {
  instanceId: string
  sampledAt: number
  values: Record<string, { available: boolean; value: unknown }>
  observations?: Record<string, PluginMetricSnapshot>
  metadata?: { properties?: Array<{ id: string; name?: string; description?: string; valueType?: { unit?: string } }> }
}
export interface PluginRuntimeInfo {
  driverId: string
  kind?: 'node'
  limitReached?: boolean
  pluginId?: string
  instanceKey?: string
  ownerId?: string
  ownerType?: string
  serverId: string
  serviceId: string
  typeName?: string
  desiredRevision?: string
  appliedRevision?: string
  version?: string
  status: string
  state?: string
  stage?: string
  error?: string
  lastError?: string
  lastFailureStage?: string
  failedAt?: number
  sampledAt: number
  available: boolean
  instanceCount: number
  metrics?: PluginMetricSnapshot
  receivedAt?: number
}
export type PluginDriverRecord = {
  id: string
  name?: string
  description?: string
  version?: string
  type?: string
  createTime?: number
  configuration?: { sourceId?: string; autoCreate?: boolean }
  runtimeRevision?: string
}
export interface PluginRuntimeTargets { serverIds?: string[]; instanceKeys?: string[]; offset?: number; limit?: number }
export function observePluginRuntime(ids: string[], instances = false, includeMetadata = false,
  targets?: PluginRuntimeTargets) {
  const url = instances ? `/plugin/driver/${encodeURIComponent(ids[0])}/instances/_observe` : '/plugin/driver/_runtime'
  return postRuntimeNdJson<PluginRuntimeInfo | PluginRuntimeInfo[]>(url, { ids, interval: 5000, metrics: includeMetadata ? null : [], includeMetadata, ...targets })
    .pipe(map(value => unwrapDiagnosticRecord<PluginRuntimeInfo | PluginRuntimeInfo[]>(value)))
}
export async function retryPluginRuntime(driverId: string, node: PluginRuntimeInfo) {
  const result = await request.post(`/plugin/driver/${encodeURIComponent(driverId)}/_retry`, {
    serverId: node.serverId, revision: node.desiredRevision,
  })
  if (!result.success) throw new Error(result.message || 'Plugin application failed')
}
