import { computed, effectScope, onScopeDispose, reactive, shallowReactive, watch, type EffectScope } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { activeLogoutNavigation } from '../useRuleLogoutNavigation'
import type { RuleScope } from '../service'
import type { usePropertyRules } from '../usePropertyRules'
import { usePropertyRuleEditor, usePropertyRuleEditorContext, type RuleEditorProps } from '../usePropertyRuleEditor'
import { useRuleLeaveConfirmation } from '../useRuleLeaveConfirmation'

type PropertyRow = ReturnType<typeof usePropertyRules>['propertyRows']['value'][number]
interface CardProps { scope: RuleScope; rows: PropertyRow[]; visibleRows: PropertyRow[]; loading?: boolean }
interface CardEntry {
  props: RuleEditorProps
  editor: ReturnType<typeof createEditor>
  lifetime: EffectScope
}
const createEditor = (...args: Parameters<typeof usePropertyRuleEditor>) => reactive(usePropertyRuleEditor(...args))

/** Keep visited cards' drafts outside the filtered DOM, with one resource cache and leave guard. */
export function usePropertyRuleCards(props: CardProps, changed: (id: string) => void | Promise<void>) {
  const context = usePropertyRuleEditorContext(props)
  const confirmDiscard = useRuleLeaveConfirmation(context.t)
  const editors = shallowReactive(new Map<string, CardEntry>())
  const saving = computed(() => [...editors.values()].some(entry => entry.editor.saving))
  const pending = computed(() => [...editors.values()].some(entry => entry.editor.pendingSave))
  let owner = ''
  function reset() {
    for (const entry of editors.values()) entry.lifetime.stop()
    editors.clear()
  }
  function synchronize() {
    const nextOwner = JSON.stringify([props.scope.productId, props.scope.deviceId])
    if (owner !== nextOwner) { reset(); owner = nextOwner }
    // Do not initialize a new device from the previous device's still-visible list snapshot.
    if (props.loading) return
    const rows = new Map(props.rows.map(row => [row.id, row]))
    for (const [id, entry] of editors) {
      const row = rows.get(id)
      if (!row) { entry.lifetime.stop(); editors.delete(id); continue }
      entry.props.property = row.property
      const next = { raw: row.raw, hasOverride: row.hasOverride }
      if (JSON.stringify(entry.props.snapshot) !== JSON.stringify(next)) {
        entry.props.snapshot = next
        // Refresh clean neighbours after a save; never replace another card's unsaved draft.
        if (!entry.editor.pendingSave && !entry.editor.saving) void entry.editor.load()
      }
    }
    // Materialize only the currently visible chunk; hidden, previously visited cards remain alive.
    for (const row of props.visibleRows) {
      if (editors.has(row.id)) continue
      const lifetime = effectScope()
      const input = reactive({
        open: true, inline: true, scope: computed(() => props.scope), property: row.property,
        snapshot: { raw: row.raw, hasOverride: row.hasOverride },
        blocked: computed(() => Boolean(props.loading) || [...editors].some(([id, entry]) => id !== row.id && entry.editor.saving)),
      })
      const editor = lifetime.run(() => createEditor(input, () => {}, () => changed(row.id), context))!
      editors.set(row.id, { props: input, editor, lifetime })
    }
  }
  watch([() => props.scope, () => props.rows, () => props.visibleRows, () => props.loading], synchronize, { immediate: true })

  async function confirmLeave() {
    if (activeLogoutNavigation.value) return true
    if (saving.value) return false
    if (!pending.value) return true
    return confirmDiscard()
  }
  onBeforeRouteLeave(confirmLeave)
  onBeforeRouteUpdate((to, from) => to.path === from.path && to.query.tab === from.query.tab || confirmLeave())
  function beforeUnload(event: BeforeUnloadEvent) { if (!activeLogoutNavigation.value && (pending.value || saving.value)) event.preventDefault() }
  window.addEventListener('beforeunload', beforeUnload)
  onScopeDispose(() => { reset(); window.removeEventListener('beforeunload', beforeUnload) })
  return { editors, saving, pending, alarmAvailable: computed(() => Boolean(context.system.showThreshold)), confirmLeave }
}
