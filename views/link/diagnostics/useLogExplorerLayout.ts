import { ref, watch, type Ref } from 'vue'

/** 目录仅由用户打开；失活时关闭浮层，不改动文件、正文或阅读位置。 */
export function useLogExplorerLayout(enabled: Ref<boolean>) {
  const open = ref(false)
  function setOpen(value: boolean) { open.value = value && enabled.value }
  function close() { open.value = false }
  watch(enabled, value => { if (!value) close() }, { flush: 'sync' })
  return { open, setOpen, close }
}
