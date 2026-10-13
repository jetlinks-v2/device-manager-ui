import { computed } from 'vue'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { dashboardSources } from '@jetlinks-web-core/components/DashBoardCanvas/dashboard-sources'
import { useDashboardCatalog } from '@jetlinks-web-core/components/DashBoardCanvas/discovery'
import type { DashboardValue } from '@jetlinks-web-core/components/DashBoardCanvas'
import { provideSystemMonitorRuntime } from '../../../visDashboard/SystemMonitor/hooks/useSystemMonitorRuntime'

/** Assemble this domain's catalog and share node discovery for this mounted dashboard. */
export function useInfrastructureDashboard() {
  provideSystemMonitorRuntime()
  const { catalog, loading, errors, reload } = useDashboardCatalog(dashboardSources, {
    modules: ['device-manager-ui'], directories: ['visDashboard'],
    groups: ['device-manager-ui/visDashboard/SystemMonitor'],
  })
  const layout = [
    ['systemMonitorRealtimeResources', 0, 0], ['systemMonitorCpuTrend', 0, 13],
    ['systemMonitorMemoryTrend', 6, 13], ['systemMonitorNetworkTrend', 0, 26],
  ] as const
  const dashboard = computed<DashboardValue>(() => ({
    canvas: { backgroundColor: 'transparent', gridLayout: { rowHeight: 16, marginHorizontal: 18, marginVertical: 18 } },
    components: layout.flatMap(([type, x, y]) => {
      const definition = catalog.value.components[type]
      if (!definition) return []
      return [{ ...definition.defaultConfig, id: type, type,
        visible: type !== 'systemMonitorNetworkTrend' || isNoCommunity,
        componentProps: { ...definition.defaultConfig.componentProps,
          gridItem: { ...definition.defaultConfig.componentProps.gridItem, x, y } } }]
    }),
  }))
  return { catalog, loading, errors, reload, dashboard }
}
