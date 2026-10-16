import { ref, watch, nextTick } from 'vue'
import type { MappingConfiguration } from './useMappingConfiguration'

/** 从原组件搬迁 TableHeight，保持原有业务规则与执行逻辑。 */
export function useTableHeight(mappingConfiguration: Pick<MappingConfiguration, 'mappings' | 'loading'>) {
  const { mappings, loading } = mappingConfiguration

  /** 映射表表体可视高度（px）：由容器 ResizeObserver 计算，撑满剩余页面，仅内容超出时出现纵向滚动条 */
  const tableScrollEl = ref<HTMLElement | null>(null)

  const tableBodyScrollY = ref(360)

  let tableScrollResizeObserver: ResizeObserver | null = null

  function measureTableBodyScrollY() {
    const el = tableScrollEl.value
    if (!el || el.clientHeight < 48) return
    const thead = el.querySelector('.ant-table-thead') as HTMLElement | null
    const headH = thead ? Math.ceil(thead.getBoundingClientRect().height) : 39
    const borderPad = 2
    const h = Math.floor(el.clientHeight - headH - borderPad)
    tableBodyScrollY.value = Math.max(160, h)
  }

  // ==================== Lifecycle ====================
  function scheduleMeasureTableBody() {
    requestAnimationFrame(() => {
      measureTableBodyScrollY()
    })
  }

  watch(
    () => [mappings.value.length, loading.value] as const,
    () => nextTick(() => scheduleMeasureTableBody()),
    { flush: 'post' }
  )
  /** 由组合入口在原 nextTick 时点调用，保持原测量和观察顺序。 */
  function observeTableBody() {
    tableScrollResizeObserver = new ResizeObserver(() => scheduleMeasureTableBody())
    if (tableScrollEl.value) {
      tableScrollResizeObserver.observe(tableScrollEl.value)
    }
  }
  function stopTableObserver() {
    tableScrollResizeObserver?.disconnect()
    tableScrollResizeObserver = null
  }

  return {
    tableScrollEl,
    tableBodyScrollY,
    measureTableBodyScrollY,
    scheduleMeasureTableBody,
    observeTableBody,
    stopTableObserver
  }
}
export type TableHeight = ReturnType<typeof useTableHeight>
