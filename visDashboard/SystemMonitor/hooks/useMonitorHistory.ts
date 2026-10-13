import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { MonitorTimeRange, TimeShortcut } from '../types'

interface HistoryOptions<T, M extends string> {
  metric: Ref<M>
  isEdit: Ref<boolean>
  topologyVersion: Ref<number>
  empty: () => T
  load: (metric: M, range: MonitorTimeRange) => Promise<T>
}

/** History requests share time controls and reject stale results after switching, previewing or unmounting. */
export function useMonitorHistory<T, M extends string>(options: HistoryOptions<T, M>) {
  const rangeFor = (value: TimeShortcut): MonitorTimeRange => {
    const now = dayjs()
    const from = value === 'week' ? now.subtract(6, 'day').startOf('day') : now.subtract(value === 'day' ? 24 : 1, 'hour')
    return [from, now]
  }
  const shortcut = ref<TimeShortcut | undefined>('hour')
  const timeRange = ref<MonitorTimeRange>(rangeFor('hour'))
  const data = shallowRef<T>(options.empty())
  const loading = ref(false)
  const error = ref(false)
  let sequence = 0
  let disposed = false

  async function load() {
    const current = ++sequence
    if (options.isEdit.value || disposed) {
      data.value = options.empty()
      loading.value = false
      error.value = false
      return
    }
    loading.value = true
    error.value = false
    try {
      const next = await options.load(options.metric.value, timeRange.value)
      if (current === sequence) data.value = next
    } catch {
      if (current === sequence) { data.value = options.empty(); error.value = true }
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  function refresh() {
    if (shortcut.value) timeRange.value = rangeFor(shortcut.value)
    else void load()
  }
  function selectRange(value: MonitorTimeRange | [string, string] | null) {
    if (!value) return
    const range: MonitorTimeRange = [dayjs(value[0]), dayjs(value[1])]
    if (range.some(date => !date.isValid()) || range[0].isAfter(range[1])) return
    shortcut.value = undefined
    timeRange.value = range
  }
  function selectShortcut(value: TimeShortcut) { shortcut.value = value; timeRange.value = rangeFor(value) }
  watch([options.metric, timeRange, options.isEdit], load, { immediate: true })
  watch(options.topologyVersion, refresh)
  onScopeDispose(() => { disposed = true; sequence++ })
  return { data, loading, error, timeRange, shortcut, refresh, selectRange, selectShortcut }
}
