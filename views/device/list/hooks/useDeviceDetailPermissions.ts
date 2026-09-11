import type { Ref } from 'vue'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { useDeviceListProvider } from './useDeviceListProvider'
import type { IotDevice } from '../types'

/**
 * 详情头部操作调用设备实例 API：需要已有 IoT 写授权，并保留业务模块自己的按钮限制。
 * 媒体按钮只授予媒体资源能力，不能据此推断设备实例也具有写权限。
 */
export function useDeviceDetailPermissions(device: Ref<IotDevice | null>) {
  const menu = useMenuStore()
  const auth = useAuthStore()
  const provider = useDeviceListProvider(device)
  return (action: 'update' | 'delete' | 'enable' | 'disable'): boolean => {
    if (!device.value) return false
    const canWriteDevice = menu.hasMenu('iot-user/device/list') || auth.hasPermission(`device/Instance:${action}`)
    return canWriteDevice && (!provider.value || auth.hasPermission(`${provider.value.menuCode}:${action}`))
  }
}
