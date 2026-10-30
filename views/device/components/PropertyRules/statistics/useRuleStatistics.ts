import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowReactive, watch } from 'vue'
import type { RuleScope } from '../service'
import { queryRuleStatistics, StatisticsQueryError } from './api'
import { inputRate, type StatisticsEntry, type StatisticsTarget } from './model'

interface StatisticsProps { scope: RuleScope; targets: StatisticsTarget[] }

/** One visible-category cache and one completion-based poller for the whole panel. */
export function useRuleStatistics(props: StatisticsProps) {
  const entries = shallowReactive<Record<string, StatisticsEntry>>({})
  const openProperty = ref<string>()
  const targets = computed(() => new Map(props.targets.map(target => [target.property, target])))
  let epoch = 0
  let disposed = false
  let active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let queue = Promise.resolve()
  let unavailable = false
  const nodes = new Map<string, string>()
  const denied = new Set<string>()
  const pending = new Set<string>()
  let previousTargets = new Map<string, string>()
  const visible = () => active && (typeof document === 'undefined' || document.visibilityState !== 'hidden')

  function close() { openProperty.value = undefined; stopTimer() }
  function stopTimer() { clearTimeout(timer); timer = undefined }
  function allowed(target: StatisticsTarget) { return target.permitted && target.source !== 'disabled' }

  function schedule() {
    stopTimer()
    const id = openProperty.value
    const target = id ? targets.value.get(id) : undefined
    if (!disposed && visible() && target && allowed(target) && !entries[id!]?.failure) {
      timer = setTimeout(() => { void refresh() }, 5000)
    }
  }

  /** Requests are serialized, deduplicated, and fenced by scope/category/permission lifetime. */
  function fetchRows(rows: StatisticsTarget[], force = false) {
    const token = epoch
    const scope = { ...props.scope }
    const selected = rows.filter(target => allowed(target) && !pending.has(target.property)
      && (force || !entries[target.property]))
    if (!selected.length || !visible()) return queue
    for (const target of selected) {
      pending.add(target.property)
      entries[target.property] = { ...entries[target.property], loading: true }
    }
    queue = queue.then(async () => {
      for (const source of ['product', 'device'] as const) {
        const group = selected.filter(target => target.source === source)
        for (let offset = 0; offset < group.length; offset += 100) {
          if (disposed || token !== epoch) return
          const batch = group.slice(offset, offset + 100)
          try {
            if (unavailable || denied.has(source)) throw new StatisticsQueryError(unavailable ? 'unavailable' : 'forbidden')
            const snapshots = await queryRuleStatistics(scope, source, batch.map(target => target.property), nodes.get(source))
            if (disposed || token !== epoch) return
            nodes.set(source, snapshots[0].nodeId)
            for (const snapshot of snapshots) {
              const previous = entries[snapshot.property]?.snapshot
              entries[snapshot.property] = { snapshot, rate: inputRate(previous, snapshot),
                restarted: !!previous?.loaded && snapshot.loaded && previous.generation !== snapshot.generation }
            }
          } catch (error) {
            if (disposed || token !== epoch) return
            const failure = error instanceof StatisticsQueryError ? error.kind : 'failed'
            if (failure === 'unavailable') unavailable = true
            if (failure === 'forbidden') denied.add(source)
            for (const target of batch) entries[target.property] = { snapshot: entries[target.property]?.snapshot, failure }
          } finally {
            if (token === epoch) for (const target of batch) pending.delete(target.property)
          }
        }
      }
    })
    return queue
  }

  async function refresh() {
    stopTimer()
    const target = openProperty.value ? targets.value.get(openProperty.value) : undefined
    if (!target || !allowed(target)) return
    await fetchRows([target], true)
    schedule()
  }

  function toggle(property: string, open: boolean) {
    if (!open) { if (openProperty.value === property) close(); return }
    close()
    openProperty.value = property
    void refresh()
  }

  function retry() {
    unavailable = false
    const target = openProperty.value ? targets.value.get(openProperty.value) : undefined
    if (target) denied.delete(target.source)
    void refresh()
  }

  /** Save/reload invalidates the baseline without pretending that runtime propagation is immediate. */
  function reset() {
    epoch++
    stopTimer()
    pending.clear()
    previousTargets.clear()
    nodes.clear()
    denied.clear()
    unavailable = false
    for (const key of Object.keys(entries)) delete entries[key]
    if (!disposed && visible()) void fetchRows(props.targets).then(schedule)
  }

  watch(() => [props.scope.productId, props.scope.deviceId], () => { close(); reset() })
  watch(() => props.targets.map(target => `${target.property}:${target.source}:${target.permitted}`).join('\0'), () => {
    // Keep snapshots only for rendered rows. Any late result from the previous category is ignored.
    epoch++
    pending.clear()
    stopTimer()
    for (const key of Object.keys(entries)) if (!targets.value.has(key)) delete entries[key]
    if (openProperty.value && !targets.value.has(openProperty.value)) close()
    for (const target of props.targets) {
      const identity = `${target.source}:${target.permitted}`
      if (target.permitted && previousTargets.get(target.property) === `${target.source}:false`) denied.delete(target.source)
      if (!allowed(target) || previousTargets.get(target.property) !== identity || entries[target.property]?.loading) delete entries[target.property]
    }
    previousTargets = new Map(props.targets.map(target => [target.property, `${target.source}:${target.permitted}`]))
    void fetchRows(props.targets).then(schedule)
  }, { immediate: true })

  function onVisibility() {
    stopTimer()
    if (!visible()) return
    if (openProperty.value) void refresh()
    else void fetchRows(props.targets)
  }
  onMounted(() => { document.addEventListener('visibilitychange', onVisibility) })
  onDeactivated(() => { active = false; close() })
  onActivated(() => { active = true; onVisibility() })
  onBeforeUnmount(() => {
    disposed = true
    epoch++
    stopTimer()
    document.removeEventListener('visibilitychange', onVisibility)
    for (const key of Object.keys(entries)) delete entries[key]
    nodes.clear(); denied.clear(); pending.clear()
  })
  return { entries, openProperty, toggle, close, refresh: retry, reset }
}
