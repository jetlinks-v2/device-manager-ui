import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import type { MetricAlarmReference } from '@jetlinks-web-core/components'

/** 按菜单权限从业务对象进入指标工作区。 */
export function useMetricLinks() {
  const route = useRoute()
  const auth = useAuthStore()
  const menu = useMenuStore()
  const workspaceEnabled = computed(() => menu.hasMenu('device/Metric') && auth.hasPermission('device/Metric:view'))
  function openWorkspace(reference: MetricAlarmReference) {
    if (!workspaceEnabled.value) return
    menu.jumpPage('device/Metric', { query: { projectId: route.query.projectId,
      metricOwnerType: reference.ownerType, metricOwnerId: reference.ownerId,
      metricConfigId: reference.configId, metricOutputId: reference.outputId } })
  }
  return { workspaceEnabled, openWorkspace }
}
