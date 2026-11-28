import { onScopeDispose, ref, type Ref } from 'vue'
import { queryDevicePage_api, type DeviceQueryTerm } from '../../../../api/device'
import type { DeviceListProvider, UnifiedDevice } from '../../../../deviceListProvider'

export const deviceListBatchSize = 50
export type DeviceDetailState = 'loading' | 'ready' | 'error'
type QueryContext = { type: string; provider?: DeviceListProvider; terms: DeviceQueryTerm[]; baseTerms: DeviceQueryTerm[] }
export type DeviceRowsSnapshot = { rows: UnifiedDevice[]; total: number; nextPage: number; hasMore: boolean; details: Record<string, DeviceDetailState> }

/** 页码仅作为有界批次传输；列表、追加与字段补齐共享同一个查询生命周期。 */
export function useUnifiedDeviceRows(options: {
  rows: Ref<UnifiedDevice[]>
  prepare: () => Promise<void>
  context: () => QueryContext
  classify: (device: UnifiedDevice) => string
  onRows: (rows: UnifiedDevice[]) => void
  errorMessage: () => string
}) {
  const total = ref(0), loading = ref(false), loadingMore = ref(false), hasMore = ref(true), hasLoaded = ref(false)
  const error = ref(''), appendError = ref(''), details = ref<Record<string, DeviceDetailState>>({}), revision = ref(0)
  let generation = 0, nextPage = 0, detailQueue = Promise.resolve()
  const message = (reason: unknown) => reason instanceof Error ? reason.message : options.errorMessage()

  function enrich(data: UnifiedDevice[], context: QueryContext, version: number) {
    const selectedProvider = context.provider
    if (!data.length || !selectedProvider?.enrich) return
    const ids = new Set(data.map(row => row.id))
    details.value = { ...details.value, ...Object.fromEntries(data.map(row => [row.id, 'loading' as const])) }
    detailQueue = detailQueue.then(async () => {
      if (version !== generation) return
      try {
        const enriched = await selectedProvider.enrich!(data.filter(device => device.category === selectedProvider.id))
        if (version !== generation) return
        const extras = new Map(enriched.map(row => [row.id, row]))
        options.rows.value = options.rows.value.map(row => ids.has(row.id) ? extras.get(row.id) || row : row)
        details.value = { ...details.value, ...Object.fromEntries(data.map(row => [row.id, 'ready' as const])) }
      } catch {
        if (version === generation) details.value = { ...details.value, ...Object.fromEntries(data.map(row => [row.id, 'error' as const])) }
      }
    })
  }

  async function batch(page: number, context: QueryContext) {
    const result = await queryDevicePage_api({ pageIndex: page, pageSize: deviceListBatchSize, terms: context.terms,
      sorts: [{ name: 'createTime', order: 'desc' }, { name: 'id', order: 'asc' }] }, context.baseTerms)
    const data = result.data.map(row => {
      const device = { ...row, category: '' } as UnifiedDevice
      device.category = options.classify(device)
      return device
    })
    return { data, total: result.total }
  }

  async function reload(retain = false) {
    const version = ++generation, pages = retain ? Math.max(1, nextPage) : 1
    detailQueue = Promise.resolve()
    loading.value = true; loadingMore.value = false; error.value = ''; appendError.value = ''
    if (!retain) {
      options.rows.value = []; total.value = 0; nextPage = 0; hasMore.value = true; hasLoaded.value = false
      details.value = {}; revision.value++
    }
    try {
      await options.prepare()
      if (version !== generation) return
      const context = options.context(), refreshed = new Map<string, UnifiedDevice>(), chunks: UnifiedDevice[][] = []
      let resultTotal = 0, more = true, loadedPages = 0
      for (let page = 0; page < pages && more; page++) {
        const result = await batch(page, context)
        if (version !== generation) return
        result.data.forEach(row => refreshed.set(row.id, row)); chunks.push(result.data)
        resultTotal = result.total; loadedPages = page + 1
        more = result.data.length === deviceListBatchSize && loadedPages * deviceListBatchSize < resultTotal
      }
      options.rows.value = [...refreshed.values()]; total.value = resultTotal; nextPage = loadedPages; hasMore.value = more
      hasLoaded.value = true; details.value = {}; options.onRows(options.rows.value)
      chunks.forEach(data => enrich(data, context, version))
    } catch (reason) {
      if (version === generation) {
        error.value = message(reason)
        details.value = Object.fromEntries(Object.entries(details.value).map(([id, state]) => [id, state === 'loading' ? 'error' : state]))
      }
    }
    finally { if (version === generation) loading.value = false }
  }

  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value || error.value) return
    const version = generation, context = options.context(), page = nextPage
    loadingMore.value = true; appendError.value = ''
    try {
      const result = await batch(page, context)
      if (version !== generation) return
      const seen = new Set(options.rows.value.map(row => row.id)), added = result.data.filter(row => {
        if (seen.has(row.id)) return false
        seen.add(row.id); return true
      })
      options.rows.value = [...options.rows.value, ...added]; total.value = result.total; nextPage++
      hasMore.value = result.data.length === deviceListBatchSize && nextPage * deviceListBatchSize < result.total
      options.onRows(added); enrich(added, context, version)
    } catch (reason) { if (version === generation) appendError.value = message(reason) }
    finally { if (version === generation) loadingMore.value = false }
  }
  function retryDetails(ids: string[]) {
    const wanted = new Set(ids)
    enrich(options.rows.value.filter(row => wanted.has(row.id) && details.value[row.id] === 'error'), options.context(), generation)
  }
  function snapshot(): DeviceRowsSnapshot {
    return { rows: options.rows.value, total: total.value, nextPage, hasMore: hasMore.value, details: details.value }
  }
  function restore(value: DeviceRowsSnapshot) {
    options.rows.value = value.rows; total.value = value.total; nextPage = value.nextPage; hasMore.value = value.hasMore
    details.value = value.details; hasLoaded.value = true; error.value = ''; appendError.value = ''; revision.value++
    options.onRows(value.rows)
  }
  onScopeDispose(() => { generation++ })
  return { total, loading, loadingMore, hasMore, hasLoaded, error, appendError, details, revision, reload, loadMore, retryDetails, snapshot, restore }
}
