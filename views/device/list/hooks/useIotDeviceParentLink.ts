import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store'
import { detail } from '@device-manager-ui/api/instance'
import { mapApiDevice } from '../services/adapters/iotDeviceApiAdapter'
import { buildIotDeviceDetailPath, resolveIotProjectId } from './useIotDeviceRouting'
import { useDeviceListProvider } from './useDeviceListProvider'
import type { IotDevice } from '../types'

/** 父设备名称独立回填；切换设备、重新绑定和卸载时丢弃旧查询。 */
export function useIotDeviceParentLink(device: Ref<IotDevice | null>) {
  const route = useRoute()
  const router = useRouter()
  const menu = useMenuStore()
  const parentDevice = ref<IotDevice | null>(null)
  const parentProvider = useDeviceListProvider(parentDevice)
  let parentLoad = Promise.resolve()
  let requestVersion = 0
  const parentDeviceId = computed(() => device.value?.deviceTypeValue === 'childrenDevice' ? device.value.parentId : undefined)
  const parentDeviceName = computed(() => device.value?.parentName || parentDevice.value?.name || parentDeviceId.value || '')

  watch([() => device.value?.id, parentDeviceId], ([, parentId], _, onCleanup) => {
    const version = ++requestVersion
    parentDevice.value = null
    onCleanup(() => { requestVersion += 1 })
    // 即使已有父设备名称，也需要接入类型来选择网关原有的专用详情页。
    parentLoad = (async () => {
      if (!parentId) return
      try {
        const response = await detail(parentId, true)
        if (version === requestVersion && response.result?.id === parentId) {
          parentDevice.value = mapApiDevice(response.result, resolveIotProjectId(route))
        }
      } catch {
        // 名称不可读时保留父设备 ID，不影响子设备详情加载。
      }
    })()
  }, { immediate: true })

  /** 沿用列表 Provider 的详情入口，不能把边缘网关降为普通设备详情。 */
  async function openParentDevice() {
    const parentId = parentDeviceId.value
    if (!parentId) return
    const version = requestVersion
    await parentLoad
    if (version !== requestVersion || parentId !== parentDeviceId.value) return
    if (!parentDevice.value) {
      // 后台名称回填失败后，点击时重试并显示接口错误；不能凭空按普通设备跳转。
      try {
        const response = await detail(parentId)
        if (version !== requestVersion || parentId !== parentDeviceId.value || response.result?.id !== parentId) return
        parentDevice.value = mapApiDevice(response.result, resolveIotProjectId(route))
      } catch {
        return
      }
    }
    const provider = parentProvider.value
    if (provider?.detailPath && parentDevice.value) {
      void router.push(provider.detailPath({ ...parentDevice.value, category: provider.id }))
    } else if (provider?.detailRoute) {
      menu.jumpPage(provider.detailRoute, {
        params: { [provider.detailParam || 'id']: parentId },
        query: { ...route.query, type: provider.id },
      })
    } else {
      void router.push(buildIotDeviceDetailPath(resolveIotProjectId(route), parentId, { tab: 'overview' }, route))
    }
  }

  return { parentDeviceId, parentDeviceName, openParentDevice }
}
