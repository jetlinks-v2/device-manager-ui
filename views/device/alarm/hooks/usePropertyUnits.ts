import { onMounted, shallowRef } from 'vue'
import { getUnit } from '@device-manager-ui/api/instance'

// The backend's unit registry is shared by metadata editing and formatted device values.
const symbols = shallowRef<ReadonlyMap<string, string>>(new Map())
let loaded = false
let loading: Promise<void> | undefined

/** Share one dictionary load across cards; a failed load can be retried on the next visit. */
export function loadPropertyUnits(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    try {
      const response = await getUnit()
      if (!response.success || !Array.isArray(response.result)) return
      const units: Array<{ id: string; symbol: string }> = response.result
      // A registered empty symbol explicitly means no unit; it must not expose the ID.
      symbols.value = new Map(units
        .filter(unit => typeof unit.id === 'string' && typeof unit.symbol === 'string')
        .map(unit => [unit.id, unit.symbol.trim()]))
      loaded = true
    } catch {
      // Unit lookup must not prevent editing rules; unknown units keep their metadata text.
    } finally { loading = undefined }
  })()
  return loading
}

/** Page owners load once; all computed unit labels react when the dictionary arrives. */
export function usePropertyUnits() {
  onMounted(() => { void loadPropertyUnits() })
}

export function formatPropertyUnit(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'object' && !Array.isArray(value)) {
    const unit = value as Record<string, unknown>
    // Display fields are authoritative text, even if they coincide with a registered unit ID.
    for (const key of ['unitName', 'unitText', 'unitLabel', 'name', 'text', 'label', 'symbol']) {
      if (typeof unit[key] === 'string' && unit[key].trim()) return unit[key].trim()
    }
    return formatPropertyUnit(unit.unit ?? unit.id)
  }
  const unit = String(value).trim()
  return symbols.value.get(unit) ?? (unit || undefined)
}
