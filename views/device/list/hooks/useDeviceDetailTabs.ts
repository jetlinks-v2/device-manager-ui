import { computed, onScopeDispose, ref, type Ref } from 'vue'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { useMenuStore } from '@jetlinks-web-core/store'
import type { DeviceDetailSubject, DeviceDetailTabProvider } from '../../../../deviceDetailProvider'
import { selectDeviceDetailTabs } from './deviceDetailTabs'

/** 跟踪模块注册和卸载；扩展内容由 owning module 提供，宿主只管理设备适用性。 */
export function useDeviceDetailTabs(device: Ref<DeviceDetailSubject | null>) {
  const menu = useMenuStore()
  const revision = ref(0)
  const unsubscribe = moduleRegistry.onChange(() => { revision.value += 1 })
  onScopeDispose(unsubscribe)
  return computed(() => {
    void revision.value
    const providers = moduleRegistry.getAllModuleIds().flatMap(moduleId =>
      Object.values(moduleRegistry.getResource(moduleId, 'deviceDetailTabs')) as DeviceDetailTabProvider[],
    )
    return selectDeviceDetailTabs(device.value, providers.filter(provider => !provider.menuCode || menu.hasMenu(provider.menuCode)))
  })
}
