import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { UnifiedDeviceResultsModel } from './deviceListPresentation'

type ScrollInstance = { scrollTo: (top: number) => void; getScrollTop?: () => number }
type Range = { start: number; end: number }
export function useDeviceListViewport(
  model: Readonly<Ref<UnifiedDeviceResultsModel>>,
  events: { visible: (ids: string[]) => void; reading: (index: number, offset: number) => void; more: () => void },
) {
  const viewport = ref<HTMLElement>(), table = ref<ScrollInstance>(), cards = ref<ScrollInstance>()
  const { width, height } = useElementSize(viewport)
  const compact = computed(() => width.value > 0 && width.value < 640)
  const tableRowHeight = computed(() => model.value.activeType === 'gateway' && model.value.monitorCell ? 88 : 72)
  const cardHeight = computed(() => model.value.activeType === 'gateway' && model.value.monitorCell ? (width.value <= 420 ? 272 : 240) : 184)
  const headerHeight = 48
  const bodyHeight = computed(() => Math.max(1, height.value - headerHeight))
  let top = 0, restoring = false, restoreVersion = 0
  function visible(range?: Range) {
    const start = range?.start ?? Math.floor(top / tableRowHeight.value)
    const end = range?.end ?? start + Math.ceil(bodyHeight.value / tableRowHeight.value) + 2
    events.visible(model.value.rows.slice(start, end).map(row => row.id))
    if (!restoring) captureReading()
  }
  function captureReading() {
    const height = compact.value ? cardHeight.value : tableRowHeight.value
    const position = compact.value ? cards.value?.getScrollTop?.() ?? top : top
    const index = Math.floor(position / height)
    events.reading(index, (position - index * height) / height)
  }
  function fillViewport() {
    const value = model.value, itemHeight = compact.value ? cardHeight.value : tableRowHeight.value
    if (!value.loading && !value.loadingMore && !value.error && !value.appendError && value.hasMore && value.rows.length * itemHeight <= bodyHeight.value) events.more()
  }
  function tableScroll(event: Event) {
    if (compact.value || restoring) return
    const target = event.target as HTMLElement | null
    if (!target || target.clientHeight <= 0 || target.scrollHeight <= target.clientHeight) return
    top = target.scrollTop; visible()
    if (target.scrollHeight - top - target.clientHeight < tableRowHeight.value * 2 && !model.value.appendError) events.more()
  }
  function cardRange(range: Range) { visible(range) }
  watch([() => model.value.revision, compact, tableRowHeight, cardHeight, cards, table, height], async () => {
    const version = ++restoreVersion, index = model.value.readingIndex, offset = model.value.readingOffset
    restoring = true
    await nextTick()
    if (version !== restoreVersion) return
    const owner = compact.value ? cards.value : table.value
    // 缓存可先于虚拟容器挂载恢复，尺寸与 ref 就绪后再执行同一锚点。
    if (!owner || height.value <= 0) return
    top = (index + offset) * (compact.value ? cardHeight.value : tableRowHeight.value)
    owner.scrollTo(top)
    await nextTick()
    if (version !== restoreVersion) return
    restoring = false
    if (!compact.value) visible()
    fillViewport()
  }, { immediate: true, flush: 'sync' })
  watch([height, () => model.value.rows, () => model.value.loading, () => model.value.loadingMore], async () => {
    await nextTick()
    if (!compact.value) visible()
    fillViewport()
  }, { flush: 'post' })
  onScopeDispose(() => { restoreVersion++ })
  return { viewport, table, cards, compact, availableWidth: width, tableRowHeight, cardHeight, bodyHeight, tableScroll, cardRange, captureReading }
}
