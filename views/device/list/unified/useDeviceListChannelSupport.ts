import { ref, watch, type Ref } from 'vue'
import type { DeviceListProvider } from '../../../../deviceListProvider'

/** 通道列的能力由业务 Provider 决定；切换分类或卸载后丢弃旧结果。 */
export function useDeviceListChannelSupport(provider: Ref<DeviceListProvider | undefined>) {
  const supported = ref(false)
  watch(provider, async (current, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    supported.value = !!current && !current.isChannelSupported
    if (!current?.isChannelSupported) return
    try {
      const available = await current.isChannelSupported()
      if (!cancelled) supported.value = available === true
    } catch {
      if (!cancelled) supported.value = false
    }
  }, { immediate: true, flush: 'sync' })
  return supported
}
