import { computed, watch } from 'vue'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { dashboardSources } from '@jetlinks-web-core/components/DashBoardCanvas/dashboard-sources'
import { useDashboardCatalog } from '@jetlinks-web-core/components/DashBoardCanvas/discovery'
import type { DashboardValue } from '@jetlinks-web-core/components/DashBoardCanvas'
import { parseStoredLayout } from '@jetlinks-web-core/components/DashBoardCanvas/utils/layout'
import { provideSystemMonitorRuntime } from '../../../visDashboard/SystemMonitor/hooks/useSystemMonitorRuntime'
import { buildInfrastructureLayout, infrastructureLayoutStorageKey, resizeDefaultInfrastructureLayout } from './infrastructureDashboardLayout'

/** Assemble this domain's catalog and share node discovery for this mounted dashboard. */
export function useInfrastructureDashboard() {
  const runtime = provideSystemMonitorRuntime()
  const nodeCount = computed(() => runtime.nodes.value.length)
  const { catalog, loading, errors, reload } = useDashboardCatalog(dashboardSources, {
    modules: ['device-manager-ui'], directories: ['visDashboard'],
    groups: ['device-manager-ui/visDashboard/SystemMonitor'],
  })
  // 首帧和节点数量变化时才调整默认缓存；普通采样不会反复改画布或覆盖手工布局。
  watch([nodeCount, () => !!runtime.updatedAt.value], ([count, ready]) => {
    if (!ready) return
    try {
      if (typeof localStorage === 'undefined') return
      const saved = parseStoredLayout(JSON.parse(localStorage.getItem(infrastructureLayoutStorageKey) || 'null'))
      const next = saved && resizeDefaultInfrastructureLayout(saved, count)
      if (next) localStorage.setItem(infrastructureLayoutStorageKey, JSON.stringify(next))
    } catch { /* 存储不可用或记录非法时，继续由画布恢复个人布局或使用默认坐标。 */ }
  }, { flush: 'sync' })
  const dashboard = computed<DashboardValue>(() => ({
    canvas: { backgroundColor: 'transparent', gridLayout: { rowHeight: 16, marginHorizontal: 18, marginVertical: 18 } },
    components: buildInfrastructureLayout(nodeCount.value).flatMap(({ i: type, x, y, w, h }) => {
      const definition = catalog.value.components[type]
      if (!definition) return []
      return [{ ...definition.defaultConfig, id: type, type,
        visible: type !== 'systemMonitorNetworkTrend' || isNoCommunity,
        componentProps: { ...definition.defaultConfig.componentProps,
          gridItem: { ...definition.defaultConfig.componentProps.gridItem, x, y, w, h } } }]
    }),
  }))
  return { catalog, loading, errors, reload, dashboard }
}
