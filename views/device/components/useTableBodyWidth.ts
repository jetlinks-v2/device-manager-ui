import { onScopeDispose, ref, type Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'

/** 按表体的真实可用宽度分配列宽，兼容侧栏、滚动条和容器尺寸变化。 */
export function useTableBodyWidth(panel: Ref<HTMLElement | undefined>, initialWidth = 1340) {
  const width = ref(initialWidth)
  const tableBody = ref<HTMLElement>()
  let frame: number | undefined
  useResizeObserver([panel, tableBody], () => {
    // 下一帧合并测量，避免应用列宽后在同一轮 ResizeObserver 中反复更新。
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = undefined
      const body = panel.value?.querySelector<HTMLElement>('.ant-table-body')
      tableBody.value = body || undefined
      const measured = body?.clientWidth || panel.value?.clientWidth
      if (measured) width.value = measured
    })
  })
  onScopeDispose(() => { if (frame !== undefined) cancelAnimationFrame(frame) })
  return width
}
