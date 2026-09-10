import { computed, inject, onScopeDispose, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { detail as queryDeviceDetail } from '../../../../../api/instance'
import { useInstanceStore } from '../../../../../store/instance'
import type { DeviceInstance } from '../../typings'

interface ChildDeviceContext {
  detail: Ref<DeviceInstance>
  refresh: () => Promise<void>
  openDevice: (id: string) => void
}

export interface ChildDeviceMappingHandle {
  handleRefresh: () => void
  beforeLeave: (next: () => void) => void
}

const childDeviceContextKey: InjectionKey<ChildDeviceContext> = Symbol('child-device-context')

/** 映射页及其弹窗共用宿主设备；原设备详情入口继续使用自身的实例状态。 */
export function useChildDeviceContext(): ChildDeviceContext {
  const context = inject(childDeviceContextKey, undefined)
  if (context) return context

  const store = useInstanceStore()
  const { detail } = storeToRefs(store)
  const menu = useMenuStore()
  return {
    detail,
    refresh: () => store.refresh(detail.value.id),
    openDevice: id => { menu.jumpPage('device/Instance/Detail', { params: { id } }) },
  }
}

/** 为嵌入的映射工作区提供局部设备上下文，不写入全局设备详情 store。 */
export function useEmbeddedChildDeviceContext(
  deviceId: Readonly<Ref<string>>,
  mapping: Ref<ChildDeviceMappingHandle | undefined>,
) {
  const menu = useMenuStore()
  const detail = ref<DeviceInstance>({} as DeviceInstance)
  const loading = ref(false)
  const loadFailed = ref(false)
  const ready = computed(() => Boolean(deviceId.value && detail.value.id === deviceId.value))
  let requestVersion = 0

  async function loadDetail() {
    const id = deviceId.value
    const version = ++requestVersion
    loadFailed.value = false
    if (!id) return
    loading.value = true
    try {
      const response = await queryDeviceDetail(id)
      // 切换网关或卸载后，旧请求不能重新挂载旧网关的映射页。
      if (version !== requestVersion) return
      if (response.status === 200 && response.result?.id === id) {
        detail.value = response.result
      } else {
        loadFailed.value = true
      }
    } catch {
      if (version === requestVersion) loadFailed.value = true
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  function openDevice(id: string) {
    // 通过菜单 code 解析实际资源路由，不能沿用网关 URL 或旧设备列表路径。
    menu.jumpPage('iot-user/device/list/Detail', { params: { id }, query: { tab: 'overview' } })
  }

  function beforeLeave(next: () => void) {
    if (mapping.value) mapping.value.beforeLeave(next)
    else next()
  }

  function refresh() {
    beforeLeave(async () => {
      await loadDetail()
      if (!loadFailed.value) mapping.value?.handleRefresh()
    })
  }

  provide(childDeviceContextKey, { detail, refresh: loadDetail, openDevice })
  watch(deviceId, () => {
    detail.value = {} as DeviceInstance
    void loadDetail()
  }, { immediate: true })
  onScopeDispose(() => { requestVersion++ })

  return { loading, loadFailed, ready, refresh, beforeLeave }
}
