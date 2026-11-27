import { computed, nextTick, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize } from '@vueuse/core'
import type { Subscription } from 'rxjs'
import { streamPlugins } from '../../../api/link/plugin'
import type { PluginDriverRecord } from '../../../api/link/pluginRuntime'
import { pluginListBatchSize, type PluginListCursor, type PluginListQuery } from '../../../api/link/pluginListQuery'

export function usePluginList() {
  const viewport = ref<HTMLElement>()
  const scroll = ref<{ scrollTo(top: number): void }>()
  const { width, height } = useElementSize(viewport)
  const columns = computed(() => Math.max(1, Math.floor((width.value + 16) / 296)))
  const rowHeight = 184
  const items = shallowRef<PluginDriverRecord[]>([])
  const loading = ref(false), error = ref(false), more = ref(true), active = ref(true)
  const visibility = useDocumentVisibility()
  const enabled = computed(() => active.value && visibility.value === 'visible')
  const query = shallowRef<PluginListQuery>({})
  const rows = computed(() => {
    const grouped: Array<{ id: string; plugins: PluginDriverRecord[] }> = []
    for (let offset = 0; offset < items.value.length; offset += columns.value)
      grouped.push({ id: items.value[offset].id, plugins: items.value.slice(offset, offset + columns.value) })
    return grouped
  })
  let reader: Subscription | undefined, cursor: PluginListCursor | undefined, generation = 0

  function loadMore() {
    if (loading.value || !more.value || !enabled.value) return
    const identity = generation
    loading.value = true
    error.value = false
    let count = 0, last: PluginDriverRecord | undefined
    const seen = new Set(items.value.map(item => item.id))
    reader = streamPlugins(query.value, cursor).subscribe({
      next(item) {
        if (identity !== generation) return
        count++
        last = item
        if (!seen.has(item.id)) { seen.add(item.id); items.value = [...items.value, item] }
      },
      error() { if (identity === generation) { loading.value = false; error.value = true } },
      complete() {
        if (identity !== generation) return
        if (last?.createTime != null) cursor = { createTime: last.createTime, id: last.id }
        more.value = count === pluginListBatchSize
        loading.value = false
        void nextTick(fillViewport)
      },
    })
  }
  function fillViewport() {
    if (!error.value && rows.value.length * rowHeight <= height.value) loadMore()
  }
  function refresh(filter: PluginListQuery = query.value) {
    generation++
    reader?.unsubscribe()
    loading.value = false
    query.value = filter
    cursor = undefined
    more.value = true
    error.value = false
    items.value = []
    scroll.value?.scrollTo(0)
    loadMore()
  }
  watch([height, columns, enabled], fillViewport)
  watch(enabled, value => {
    if (!value) { generation++; reader?.unsubscribe(); loading.value = false }
    else if (!items.value.length) loadMore()
  })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false })
  onScopeDispose(() => { generation++; reader?.unsubscribe() })
  return { viewport, scroll, columns, rows, rowHeight, items, loading, error, more, enabled, query, refresh, loadMore }
}
