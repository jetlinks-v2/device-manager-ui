import { computed, ref, watch, type Ref } from 'vue'
import { useElementBounding, useElementSize, useWindowSize } from '@vueuse/core'

/** 同一工作台只切换列宽，节点缓存不因折叠或响应式切换而重建。 */
export function useClusterSidebarLayout(element: Ref<HTMLElement | undefined>, multiple: Ref<boolean>, enabled: Ref<boolean>, listElement: Ref<HTMLElement | undefined> = ref()) {
  const { width } = useElementSize(element), collapsed = ref(false)
  const { top } = useElementBounding(listElement), { height } = useWindowSize({ initialHeight: 768 })
  // Ant Tree 必须获得数值高度才启用虚拟化；实际行高由列表自身测量，允许 Buffer 提示换行。
  const listHeight = computed(() => Math.max(1, Math.floor(height.value - Math.max(0, top.value) - 16)))
  const showList = computed(() => multiple.value && (!width.value || width.value > 927))
  const expanded = computed(() => showList.value && !collapsed.value)
  const compact = computed(() => multiple.value && !expanded.value)
  const canToggle = computed(() => showList.value)
  const gridStyle = computed(() => ({ gridTemplateColumns: expanded.value ? '280px minmax(0, 1fr)' : 'minmax(0, 1fr)' }))
  // 无访问入口时重置本页折叠偏好；受控网格恢复时保持默认展开。
  watch(enabled, value => { if (!value) collapsed.value = false }, { flush: 'sync' })
  function setCollapsed(value: boolean) { collapsed.value = value }
  function toggle() { setCollapsed(!collapsed.value) }
  return { showList, expanded, compact, canToggle, gridStyle, listHeight, setCollapsed, toggle }
}
