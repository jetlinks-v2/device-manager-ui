import { computed } from 'vue'
import { useAuthStore } from '@jetlinks-web-core/store'

/** 两个物联告警菜单共用同一按钮码；菜单可见性和设备编辑权限不能代替告警操作授权。 */
export function useDeviceAlarmPermissions() {
  const auth = useAuthStore()
  const canAdd = computed(() => auth.hasPermission('iot-user/device/alarm:add'))
  const canUpdate = computed(() => auth.hasPermission('iot-user/device/alarm:update'))
  const canDelete = computed(() => auth.hasPermission('iot-user/device/alarm:delete'))
  const canHandle = computed(() => auth.hasPermission('iot-user/device/alarm:handle'))
  return { canAdd, canUpdate, canDelete, canHandle }
}
