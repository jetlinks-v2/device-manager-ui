import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'

/** One idle deadline per visible diagram; VueUse cancels it when the editor unmounts. */
export function useRuleDiagram() {
  const open = ref(false)
  const { start, stop } = useTimeoutFn(() => { open.value = false }, 8000, { immediate: false })
  function setOpen(value: boolean) {
    open.value = value
    if (value) start()
    else stop()
  }
  function resume() { if (open.value) start() }
  return { open, setOpen, pause: stop, resume }
}
