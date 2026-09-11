import { computed, onScopeDispose, ref, type Ref } from 'vue'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import type { DeviceListProvider } from '../../../../deviceListProvider'
import type { IotDevice } from '../types'

/** 按已加载的设备能力选择业务 Provider；列表 query 只用于返回，不能决定设备类型。 */
export function useDeviceListProvider(device: Ref<IotDevice | null>) {
  const revision = ref(0)
  onScopeDispose(moduleRegistry.onChange(() => { revision.value += 1 }))
  return computed(() => {
    void revision.value
    const current = device.value
    if (!current) return undefined
    return moduleRegistry.getAllModuleIds().flatMap(moduleId =>
      Object.values(moduleRegistry.getResource(moduleId, 'deviceListProviders')) as DeviceListProvider[],
    ).find(provider => provider.matches(current))
  })
}
