import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { queryAlarmRecipientDimensions } from '../notificationTargets'
import type { DeviceAlarmDimensionKind } from '../types'

type Entry = { loading: boolean; failed: boolean; loaded: boolean; options: Array<{ value: string; label: string }> }
const empty = (): Entry => ({ loading: false, failed: false, loaded: false, options: [] })

/** Scope changes invalidate late directory responses; errors require an explicit retry. */
export function useAlarmDimensionOptions(props: { scopeKey: string; kinds: DeviceAlarmDimensionKind[] }) {
  const entries = reactive({ org: empty(), role: empty() })
  let generation = 0
  async function load(kind: DeviceAlarmDimensionKind, retry = false) {
    const entry = entries[kind]
    if (entry.loading || !retry && (entry.loaded || entry.failed)) return
    const current = generation
    entry.loading = true
    entry.failed = false
    try {
      const options = await queryAlarmRecipientDimensions(kind)
      if (generation === current) { entry.options = options; entry.loaded = true }
    } catch {
      if (generation === current) entry.failed = true
    } finally {
      if (generation === current) entry.loading = false
    }
  }
  watch(() => props.scopeKey, () => {
    generation++
    entries.org = empty()
    entries.role = empty()
    props.kinds.forEach(kind => void load(kind))
  }, { immediate: true })
  watch(() => props.kinds.join(), () => props.kinds.forEach(kind => void load(kind)), { immediate: true })
  onBeforeUnmount(() => generation++)
  return { entries, failedKinds: computed(() => (['org', 'role'] as const).filter(kind => entries[kind].failed)), retry: (kind: DeviceAlarmDimensionKind) => load(kind, true) }
}
