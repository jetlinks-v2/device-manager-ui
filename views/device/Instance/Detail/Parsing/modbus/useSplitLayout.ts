import { ref } from 'vue'

/** 从原组件搬迁 SplitLayout，保持原有业务规则与执行逻辑。 */
export function useSplitLayout() {
  /** 主区域：左侧编辑 / 右侧调试 宽度占比（%），可拖动分割条调整 */
  const mmMainResizeRef = ref<HTMLElement | null>(null)

  const MM_SPLIT_STORAGE_KEY = 'modbus-mapping-mm-split-pct'

  const leftMainPercent = ref(62)

  function loadMmSplitFromStorage() {
    try {
      const s = localStorage.getItem(MM_SPLIT_STORAGE_KEY)
      if (s) {
        const n = parseFloat(s)
        if (!Number.isNaN(n) && n >= 28 && n <= 82) leftMainPercent.value = n
      }
    } catch {
      /* ignore */
    }
  }

  function persistMmSplit() {
    try {
      localStorage.setItem(MM_SPLIT_STORAGE_KEY, String(leftMainPercent.value))
    } catch {
      /* ignore */
    }
  }

  function onMmMainSplitterMouseDown() {
    const onMove = (ev: MouseEvent) => {
      const el = mmMainResizeRef.value
      if (!el) return
      const r = el.getBoundingClientRect()
      const pct = ((ev.clientX - r.left) / r.width) * 100
      leftMainPercent.value = Math.min(82, Math.max(28, pct))
    }
    const onUp = () => {
      persistMmSplit()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return {
    mmMainResizeRef,
    MM_SPLIT_STORAGE_KEY,
    leftMainPercent,
    loadMmSplitFromStorage,
    persistMmSplit,
    onMmMainSplitterMouseDown
  }
}
export type SplitLayout = ReturnType<typeof useSplitLayout>
