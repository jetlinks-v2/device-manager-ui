import { nextTick, reactive, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useRuleDiagram } from './useRuleDiagram'

/** Only the diagram floats; visible actions do not depend on hover or disclosure state. */
export function useRuleActions() {
  const root = ref<HTMLElement>()
  const panel = ref<HTMLElement>()
  const trigger = ref<{ $el: HTMLElement }>()
  const diagram = reactive(useRuleDiagram())
  let panelHovered = false
  let panelFocused = false
  function showDiagram() { diagram.setOpen(true) }
  function enterPanel() { panelHovered = true; diagram.pause() }
  function leavePanel() { panelHovered = false; if (!panelFocused) diagram.resume() }
  function focusPanel() { panelFocused = true; diagram.pause() }
  function blurPanel(event: FocusEvent) {
    panelFocused = event.relatedTarget instanceof Node && Boolean(panel.value?.contains(event.relatedTarget))
    if (!panelFocused && !panelHovered) diagram.resume()
  }
  function dismiss() { panelHovered = panelFocused = false; diagram.setOpen(false) }
  function escape() {
    trigger.value?.$el.focus()
    dismiss()
  }
  async function focusDiagram() {
    showDiagram()
    await nextTick()
    panel.value?.querySelector('button')?.focus()
  }
  function toggleDiagram() {
    diagram.setOpen(!diagram.open)
  }
  onClickOutside(panel, dismiss, { ignore: [root] })
  return { root, panel, trigger, diagram, showDiagram, dismiss, enterPanel, leavePanel, focusPanel, blurPanel, escape, focusDiagram, toggleDiagram }
}
