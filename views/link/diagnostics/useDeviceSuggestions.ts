import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { DeviceSessionDeviceOption } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { connectionDevicePageSize, queryConnectionDeviceCandidates, type ConnectionDeviceCandidate } from '../../../api/link/deviceConnections'

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
  const hasMore = ref(false)
  let keyword = '', nextPage = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  function cancel(clear = false) {
    generation++
    if (timer) clearTimeout(timer)
    timer = undefined
    controller?.abort(); controller = undefined
    searching.value = false
    if (clear) { options.value = []; keyword = ''; nextPage = 0; hasMore.value = false }
  }
  async function loadPage(page: number, current: number) {
    if (!active.value || current !== generation) return
    const request = new AbortController()
    controller = request
    searching.value = true
    try {
      const result = await queryConnectionDeviceCandidates(keyword, request.signal, page)
      if (request.signal.aborted || current !== generation || !active.value) return
      const rows = records(result)
      const unique = new Map(options.value.map(item => [item.value, item]))
      for (const row of rows) { const item = option(row); if (item) unique.set(item.value, item) }
      options.value = [...unique.values()]
      nextPage = page + 1
      hasMore.value = rows.length === connectionDevicePageSize
    } catch (error) {
      if (!request.signal.aborted && current === generation) {
        const failure = error as { status?: number; response?: { status?: number } }
        if ([401, 403].includes(failure?.status ?? failure?.response?.status ?? 0)) { options.value = []; hasMore.value = false }
      }
    } finally {
      if (controller === request) controller = undefined
      if (current === generation) searching.value = false
    }
  }
  function loadMore() {
    if (!active.value || !keyword || searching.value || !hasMore.value) return
    void loadPage(nextPage, generation)
  }
  function search(keyword: string) {
    cancel(false)
    const value = keyword.trim()
    reset(value)
    if (!active.value || !value) return
    // Options belong to the typed keyword, never to the previous lookup while a new one is pending.
    options.value = []
    const current = ++generation
    searching.value = true
    timer = setTimeout(() => {
      timer = undefined
      void loadPage(0, current)
    }, 200)
  }
  function reset(value: string) { keyword = value; nextPage = 0; hasMore.value = false; options.value = [] }
  // Scope identity and permission activation are security boundaries, not merely display changes.
  const clearForScope = computed(() => `${scopeKey.value}:${active.value}`)
  let previousScope = clearForScope.value
  watch(clearForScope, value => { if (value !== previousScope) { previousScope = value; cancel(true) } }, { flush: 'sync' })
  onScopeDispose(() => { cancel(true) })
  return { options, searching, hasMore, search, loadMore, cancel }
}
