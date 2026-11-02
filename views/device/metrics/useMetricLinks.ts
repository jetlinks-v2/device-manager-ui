import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import type { MetricAlarmReference } from '@jetlinks-web-core/components'
import { metricReturnQuery } from './metricLocation'

/** 指标只发出引用，具体规则和中台路由仍由业务模块及已授权菜单承载。 */
export function useMetricLinks() {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const menu = useMenuStore()
  const sceneMenu = computed(() => ['rule-engine/Scene', 'iot-user/scene-linkage'].find(code => menu.hasMenu(code) && auth.hasPermission(`${code}:add`)))
  const alarmEnabled = computed(() => Boolean(sceneMenu.value && auth.hasPermission('rule-engine/Alarm/Configuration:update')))
  const workspaceEnabled = computed(() => menu.hasMenu('device/Metric') && auth.hasPermission('device/Metric:view'))
  function createAlarm(reference: MetricAlarmReference) {
    if (!sceneMenu.value || !alarmEnabled.value) return
    const metricReturnTo = router.resolve({ path: route.path, hash: route.hash, query: metricReturnQuery(route.query, reference, reference) }).fullPath
    menu.jumpPage(`${sceneMenu.value}/Editor`, { query: { metricConfigId: reference.configId, metricOutputId: reference.outputId, metricReturnTo } })
  }
  function openWorkspace(reference: MetricAlarmReference) {
    if (!workspaceEnabled.value) return
    menu.jumpPage('device/Metric', { query: { projectId: route.query.projectId,
      metricOwnerType: reference.ownerType, metricOwnerId: reference.ownerId,
      metricConfigId: reference.configId, metricOutputId: reference.outputId } })
  }
  return { alarmEnabled, workspaceEnabled, createAlarm, openWorkspace }
}
