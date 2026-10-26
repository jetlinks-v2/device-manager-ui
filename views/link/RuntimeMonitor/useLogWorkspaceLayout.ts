import { computed, onActivated, onDeactivated, ref, watch, type Ref } from 'vue'

/** 日志占用当前可见工作区；不依赖仅有 min-height 的路由祖先，也不干预阅读位置。 */
export function useLogWorkspaceLayout(target: Ref<HTMLElement | undefined>, enabled: Ref<boolean>) {
  const activated = ref(true), availableHeight = ref<number>()
  const style = computed(() => availableHeight.value === undefined ? undefined : { '--runtime-log-available-height': `${availableHeight.value}px` })
  watch([target, enabled, activated], ([element, active, cachedActive], _, onCleanup) => {
    availableHeight.value = undefined
    if (!element || !active || !cachedActive || typeof window === 'undefined') return
    let frame: number | undefined
    const measure = () => {
      frame = undefined
      const rect = element.getBoundingClientRect()
      if (!element.isConnected || !rect.width) return
      const viewport = window.visualViewport
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      availableHeight.value = Math.max(0, bottom - Math.max(0, rect.top))
    }
    const schedule = () => { if (frame === undefined) frame = window.requestAnimationFrame(measure) }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule)
    observer?.observe(element)
    if (element.parentElement) observer?.observe(element.parentElement)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    measure()
    onCleanup(() => {
      observer?.disconnect()
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    })
  }, { immediate: true, flush: 'post' })
  onDeactivated(() => { activated.value = false })
  onActivated(() => { activated.value = true })
  return style
}
