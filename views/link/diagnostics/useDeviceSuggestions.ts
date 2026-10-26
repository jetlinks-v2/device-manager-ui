import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { DeviceSessionDeviceOption } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryConnectionDeviceCandidates, type ConnectionDeviceCandidate } from '../../../api/link/deviceConnections'

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const records = (value: unknown): ConnectionDeviceCandidate[] => {
  if (Array.isArray(value)) return value as ConnectionDeviceCandidate[]
  if (!value || typeof value !== 'object') return []
  const result = (value as { result?: unknown }).result ?? (value as { data?: unknown }).data
  if (Array.isArray(result)) return result as ConnectionDeviceCandidate[]
  if (result && typeof result === 'object') {
    const data = (result as { data?: unknown; records?: unknown }).data ?? (result as { records?: unknown }).records
    return Array.isArray(data) ? data as ConnectionDeviceCandidate[] : []
  }
  return []
}

const option = (candidate: ConnectionDeviceCandidate): DeviceSessionDeviceOption | undefined => {
  const value = text(candidate.id)
  if (!value) return undefined
  const name = text(candidate.name)
  return { value, label: name || value, description: text(candidate.productName) || undefined }
}

/** Suggestions are a separate identity stream: stale lookup responses must never affect session evidence. */
export function useDeviceSuggestions(active: Ref<boolean>, scopeKey: Ref<string>) {
  const options = ref<DeviceSessionDeviceOption[]>([])
  const searching = ref(false)
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  function cancel(clear = false) {
    generation++
    if (timer) clearTimeout(timer)
    timer = undefined
    controller?.abort(); controller = undefined
    searching.value = false
    if (clear) options.value = []
  }
  function search(keyword: string) {
    cancel(false)
    const value = keyword.trim()
    if (!active.value || !value) { if (!value) options.value = []; return }
    // Options belong to the typed keyword, never to the previous lookup while a new one is pending.
    options.value = []
    const current = ++generation
    searching.value = true
    timer = setTimeout(async () => {
      timer = undefined
      controller = new AbortController()
      try {
        const result = await queryConnectionDeviceCandidates(value, controller.signal)
        if (current === generation && active.value) options.value = records(result).map(option).filter((item): item is DeviceSessionDeviceOption => !!item)
      } catch (error) {
        if (current === generation && !controller?.signal.aborted) options.value = []
      } finally {
        if (current === generation) searching.value = false
      }
    }, 200)
  }
  // Scope identity and permission activation are security boundaries, not merely display changes.
  const clearForScope = computed(() => `${scopeKey.value}:${active.value}`)
  let previousScope = clearForScope.value
  watch(clearForScope, value => { if (value !== previousScope) { previousScope = value; cancel(true) } }, { flush: 'sync' })
  onScopeDispose(() => { cancel(true) })
  return { options, searching, search, cancel }
}
