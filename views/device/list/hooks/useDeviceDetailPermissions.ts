import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { useDeviceListProvider } from './useDeviceListProvider'
import { getIotDeviceListMenuCode } from './useIotDeviceRouting'
import type { IotDevice } from '../types'

/**
 * 详情头部操作调用设备实例 API：需要当前入口的 IoT 写授权，并保留业务模块自己的按钮限制。
 * 资源中心与物联入口的菜单码不同，旧物联菜单缺少按钮定义时才以菜单可见性兼容。
 * 媒体按钮只授予媒体资源能力，不能据此推断设备实例也具有写权限。
 */
export function useDeviceDetailPermissions(device: Ref<IotDevice | null>) {
  const route = useRoute()
  const menu = useMenuStore()
  const auth = useAuthStore()
  const provider = useDeviceListProvider(device)
  return (action: 'update' | 'delete' | 'enable' | 'disable'): boolean => {
    if (!device.value) return false
    const menuCode = getIotDeviceListMenuCode(route)
    const canWriteDevice = auth.hasPermission(`${menuCode}:${action}`)
      || auth.hasPermission(`device/Instance:${action}`)
      || (menuCode === 'iot-user/device/list' && menu.hasMenu(menuCode))
    return canWriteDevice && (!provider.value || provider.value.menuCode === 'iot-user/device/list' || auth.hasPermission(`${provider.value.menuCode}:${action}`))
  }
}
