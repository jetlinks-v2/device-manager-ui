import { computed, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'

/** Prefer the complete list; only reserve a counter once the names actually overflow. */
export function alarmSelectionVisibleCount(widths: number[], available: number, counters: number[], gap: number) {
  let used = widths.reduce((total, width) => total + width, 0)
  if (used <= available + 0.5) return widths.length
  for (let count = widths.length - 1; count > 0; count--) {
    used -= widths[count]
    if (used + gap + counters[widths.length - count - 1] <= available + 0.5) return count
  }
  // A single long name can ellipsize while the remaining count stays readable.
  return Math.min(1, widths.length)
}

/** Measure rendered names, so resizing, translated labels and name hydration use the same layout. */
export function useAlarmSelectionOverflow(labels: () => readonly string[]) {
  const container = ref<HTMLElement>()
  const measure = ref<HTMLElement>()
  const visibleCount = ref(labels().length)
  const naturalWidth = ref<number>()
  const recalculate = () => {
    if (!container.value?.clientWidth || !measure.value) return
    const widths = (selector: string) => Array.from(measure.value!.querySelectorAll<HTMLElement>(selector))
      .map(element => element.getBoundingClientRect().width)
    const gap = parseFloat(getComputedStyle(container.value).columnGap) || 0
    const names = widths('[data-name]')
    // Preserve intrinsic width in compact buttons when the visible text becomes shorter.
    naturalWidth.value = names.length ? names.reduce((total, width) => total + width, 0) : undefined
    visibleCount.value = alarmSelectionVisibleCount(names, container.value.clientWidth,
      widths('[data-count]'), gap)
  }
  useResizeObserver([container, measure], recalculate)
  watch(() => [...labels()], recalculate, { flush: 'post' })
  const visibleLabels = computed(() => labels().slice(0, visibleCount.value).join('、'))
  const hiddenCount = computed(() => Math.max(0, labels().length - visibleCount.value))
  return { container, measure, naturalWidth, visibleLabels, hiddenCount }
}
