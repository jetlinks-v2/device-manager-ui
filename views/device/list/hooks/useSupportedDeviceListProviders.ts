import { shallowRef, watch, type Ref } from 'vue'
import type { DeviceListProvider } from '../../../../deviceListProvider'

/** 能力属于后端部署，与菜单授权分开判断；过期或卸载后的请求不能恢复入口。 */
export function useSupportedDeviceListProviders(providers: Ref<DeviceListProvider[]>) {
  const supported = shallowRef(providers.value.filter(provider => !provider.isSupported))
  watch(providers, async (current, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    supported.value = current.filter(provider => !provider.isSupported)
    if (!current.some(provider => provider.isSupported)) return
    const available = await Promise.all(current.map(async provider => {
      try { return !provider.isSupported || await provider.isSupported() }
      catch { return false }
    }))
    if (!cancelled) supported.value = current.filter((_, index) => available[index])
  }, { immediate: true })
  return supported
}
