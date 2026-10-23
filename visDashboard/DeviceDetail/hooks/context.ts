import { computed, inject, onScopeDispose, provide, type InjectionKey, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { getProjectCodeFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getBaseApi } from '@jetlinks-web-core/utils/request-context'
import { createResourcePool } from './resourcePool'
import type { RealtimePropertyRow } from '../shared'

export interface DeviceDetailContext {
  deviceId: Readonly<Ref<string>>
  properties?: Readonly<Ref<RealtimePropertyRow[]>>
  scope: Readonly<Ref<string>>
  pool: ReturnType<typeof createResourcePool>
}
const contextKey: InjectionKey<DeviceDetailContext> = Symbol('device-detail-dashboard')

/** 设备由宿主或组件配置显式提供；账号、项目和API根地址共同隔离业务结果与个人布局。 */
export function createDeviceDetailContext(deviceId: Readonly<Ref<string>>, properties?: Readonly<Ref<RealtimePropertyRow[]>>): DeviceDetailContext {
  const user = useUserStore(), route = useRoute(), pool = createResourcePool()
  const scope = computed(() => {
    // URL本身不是缓存键；读取响应式路由仅用于使项目根地址/编码随导航重新求值。
    void route?.fullPath
    return JSON.stringify([user.userInfo.id || '', route?.params.projectId || route?.query.projectId || getProjectCodeFromLocation() || '', getBaseApi()])
  })
  onScopeDispose(() => pool.dispose())
  return { deviceId, properties, scope, pool }
}
export function provideDeviceDetailContext(deviceId: Readonly<Ref<string>>, properties: Readonly<Ref<RealtimePropertyRow[]>>) {
  const context = createDeviceDetailContext(deviceId, properties)
  provide(contextKey, context)
  return context
}
export const useDeviceDetailContext = () => inject(contextKey, undefined)
