import { computed, ref, watch, type Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { NodeOption } from '../types'

/** 先判断能否全部显示，再为 +N 预留位置；始终只有一行，不按固定标签数截断。 */
export function fitNodePreview(widths: number[], available: number, moreWidth: number, gap = 4): number {
  if (available <= 0) return 0
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap
  if (total <= available) return widths.length
  let used = 0
  let count = 0
  for (const width of widths) {
    const next = used + (count ? gap : 0) + width
    if (next + gap + moreWidth > available) break
    used = next
    count++
  }
  return count
}

/** 节点编辑只触发当前图表回调；采样更新不重置浮层、搜索或滚动位置。 */
export function useNodeFocusSelector(
  value: () => string[],
  options: () => NodeOption[],
  change: (ids: string[]) => void,
  summary: Ref<HTMLElement | undefined>,
) {
  const open = ref(false)
  const keyword = ref('')
  const visibleCount = ref(0)
  const showMore = ref(false)
  const selected = computed(() => new Set(value()))
  const byId = computed(() => new Map(options().map(item => [item.value, item])))
  const selectedOptions = computed(() => value().flatMap(id => byId.value.has(id) ? [byId.value.get(id)!] : []))
  const preview = computed(() => selectedOptions.value.slice(0, visibleCount.value))
  const measure = () => {
    const element = summary.value
    if (!element) return
    const widths = [...element.querySelectorAll<HTMLElement>('[data-node-measure]')].map(tag => tag.getBoundingClientRect().width)
    const moreWidth = element.querySelector<HTMLElement>('[data-more-measure]')?.getBoundingClientRect().width ?? 0
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0
    visibleCount.value = fitNodePreview(widths, element.clientWidth, moreWidth, gap)
    showMore.value = moreWidth <= element.clientWidth
  }
  useResizeObserver(summary, measure)
  watch(selectedOptions, measure, { flush: 'post' })
  const remaining = computed(() => selectedOptions.value.length - preview.value.length)
  const filtered = computed(() => {
    const text = keyword.value.trim().toLocaleLowerCase()
    return options().filter(item => item.label.toLocaleLowerCase().includes(text))
  })
  function toggle(id: string, checked: boolean) {
    if (!byId.value.has(id)) return
    const next = new Set(value())
    if (checked) next.add(id); else next.delete(id)
    change([...next])
  }
  function selectAll() { change(options().map(item => item.value)) }
  return { open, keyword, selected, selectedOptions, preview, remaining, showMore, filtered, toggle, selectAll }
}
