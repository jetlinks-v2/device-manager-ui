import { computed, onActivated, onDeactivated, onScopeDispose, shallowRef, ref, watch } from 'vue'
import { useDocumentVisibility, useTimestamp } from '@vueuse/core'
import { timer, switchMap } from 'rxjs'
import { getRequestHeaders } from '@jetlinks-web-core/utils/request-context'
import { observePluginRuntime, retryPluginRuntime, type PluginDriverRecord, type PluginRuntimeInfo, type PluginRuntimeTargets } from '../../../api/link/pluginRuntime'
import { pluginAvailability, pluginRuntimeError, pluginDriverMetadata } from './runtimeState'
import { useDiagnosticScope } from '../diagnostics/useDiagnosticScope'
import { useI18n } from 'vue-i18n'

/** One stream for the visible demand; cancellation and context changes discard obsolete snapshots. */
export function usePluginRuntime(drivers: () => PluginDriverRecord[], instances = false, metadata = false,
  targets?: () => PluginRuntimeTargets) {
  const rows = shallowRef<PluginRuntimeInfo[]>([])
  const error = shallowRef('')
  const busy = ref('')
  const pending = ref(false)
  const loading = ref(new Set<string>())
  const coverage = shallowRef<PluginRuntimeInfo[]>([])
  const scope = useDiagnosticScope()
  const { t } = useI18n()
  const visibility = useDocumentVisibility()
  const active = ref(true)
  const now = useTimestamp({ interval: 1000 })
  let subscription: { unsubscribe(): void } | undefined
  let generation = 0
  let previousTarget = '', previousIdentity = ''
  function stop() { generation++; subscription?.unsubscribe(); subscription = undefined }
  function refresh() {
    stop(); error.value = ''; pending.value = false; coverage.value = []; loading.value = new Set()
    const ids = drivers().map(driver => driver.id).filter(Boolean)
    const identity = JSON.stringify([scope.value, getRequestHeaders()])
    const target = JSON.stringify(targets?.())
    if (target !== previousTarget || identity !== previousIdentity) rows.value = []
    previousTarget = target; previousIdentity = identity
    rows.value = rows.value.filter(row => ids.includes(row.driverId))
    if (!ids.length || visibility.value !== 'visible' || !active.value) { rows.value = []; return }
    const current = generation
    pending.value = true
    loading.value = new Set(ids.filter(id => !rows.value.some(row => row.driverId === id)))
    const seen = new Map<string, Set<string>>()
    const nodeErrors = new Map<string, string>()
    subscription = timer(100).pipe(switchMap(() => observePluginRuntime(ids, instances, metadata, targets?.()))).subscribe({
      next(value) {
        if (current !== generation) return
        if (identity !== JSON.stringify([scope.value, getRequestHeaders()])) { stop(); rows.value = []; pending.value = false; loading.value.clear(); return }
        pending.value = false
        const records = new Map(rows.value.filter(row => !row.receivedAt || Date.now() - row.receivedAt < 15000).map(row => [key(row), row]))
        for (const node of Array.isArray(value) ? value : [value]) {
          if (!node?.driverId || !node.serverId || !ids.includes(node.driverId)) continue
          loading.value.delete(node.driverId)
          if (instances && node.kind === 'node') {
            coverage.value = [...coverage.value.filter(row => row.serverId !== node.serverId), node]
            if (node.status === 'ready' || node.status === 'unsupported') {
              for (const [id, row] of records) if (row.serverId === node.serverId && (node.status === 'unsupported' || !seen.get(node.serverId)?.has(id))) records.delete(id)
              nodeErrors.delete(node.serverId)
            } else {
              for (const [id, row] of records) if (row.serverId === node.serverId) records.set(id, { ...row, available: false, status: 'unknown' })
              nodeErrors.set(node.serverId, `${node.serverId}: ${node.error || node.status}`)
            }
            seen.delete(node.serverId)
            error.value = [...nodeErrors.values()].join('; ')
            continue
          }
          if (instances) {
            if (!seen.has(node.serverId)) seen.set(node.serverId, new Set())
            seen.get(node.serverId)!.add(key(node))
          }
          records.set(key(node), { ...node, receivedAt: Date.now() })
        }
        rows.value = [...records.values()]
      },
      error(reason: unknown) {
        if (current !== generation) return
        error.value = pluginRuntimeError(reason) || t('pluginRuntime.readFailed')
        pending.value = false
        loading.value.clear()
        rows.value = rows.value.map(row => ({ ...row, status: 'unknown', available: false }))
      },
      complete() {
        if (current === generation) { pending.value = false; loading.value.clear(); rows.value = rows.value.map(row => ({ ...row, status: 'unknown', available: false })) }
      },
    })
  }
  function key(row: PluginRuntimeInfo) {
    return [row.driverId, row.serverId, row.instanceKey || ''].join(':')
  }
  const status = computed(() => Object.fromEntries(drivers().map(driver => [driver.id,
    pluginAvailability(rows.value.filter(row => row.driverId === driver.id), driver.runtimeRevision, now.value)])))
  const descriptions = computed(() => Object.fromEntries(drivers().map(driver => [driver.id,
    pluginDriverMetadata(rows.value.filter(row => row.driverId === driver.id), driver.runtimeRevision, now.value)])))
  async function retry(id: string, node: PluginRuntimeInfo) {
    busy.value = node.serverId
    try { await retryPluginRuntime(id, node); refresh() }
    catch (reason) { error.value = pluginRuntimeError(reason) || t('pluginRuntime.readFailed') }
    finally { busy.value = '' }
  }
  watch(() => [drivers().map(driver => `${driver.id}:${driver.runtimeRevision || ''}`).join(','), visibility.value, active.value, JSON.stringify(targets?.()), JSON.stringify(scope.value), JSON.stringify(getRequestHeaders())], refresh, { immediate: true })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false })
  onScopeDispose(stop)
  return { rows, error, status, descriptions, refresh, retry, busy, pending, loading, limitReached: computed(() => coverage.value.some(node => node.limitReached)) }
}
