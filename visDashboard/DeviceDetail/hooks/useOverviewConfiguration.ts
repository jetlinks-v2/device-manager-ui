import { computed, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { buildIotDeviceDetailPath, resolveIotProjectId } from '../../../views/device/list/hooks/useIotDeviceRouting'

export function useOverviewConfiguration(deviceId: Readonly<Ref<string>>, isEdit: Readonly<Ref<boolean>>) {
  const route = useRoute(), router = useRouter(), menu = useMenuStore()
  const canConfigure = computed(() => Boolean(deviceId.value) && !isEdit.value)
  const canConfigureAlarms = computed(() => canConfigure.value && menu.hasMenu('iot-user/device/alarm'))
  function configureProperties() {
    if (!canConfigure.value) return
    void router.push(buildIotDeviceDetailPath(resolveIotProjectId(route), deviceId.value, { tab: 'thing-model' }, route))
  }
  function configureAlarms() {
    if (!canConfigureAlarms.value) return
    menu.jumpPage('iot-user/device/alarm')
  }
  return { canConfigure, canConfigureAlarms, configureProperties, configureAlarms }
}
