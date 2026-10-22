import { computed, type Ref } from 'vue'
import { useDashboardCatalog } from '@jetlinks-web-core/components/DashBoardCanvas/discovery'
import { dashboardSources } from '@jetlinks-web-core/components/DashBoardCanvas/dashboard-sources'
import type { DashboardValue } from '@jetlinks-web-core/components/DashBoardCanvas'
import { kinds, typeOf } from '../shared'
import type { DeviceDetailContext } from './context'
import { buildDeviceDetailLayout, detailLayoutMode } from './deviceDetailLayout'

const thumbnails = import.meta.glob('../*/thumbnail.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export function useDeviceDetailDashboard(context: DeviceDetailContext, width: Readonly<Ref<number>>) {
  const discovery = useDashboardCatalog(dashboardSources, {
    modules: ['device-manager-ui'], directories: ['visDashboard'],
    groups: ['device-manager-ui/visDashboard/DeviceDetail'],
  })
  const catalog = computed(() => ({ ...discovery.catalog.value,
    components: Object.fromEntries(Object.entries(discovery.catalog.value.components).map(([type, definition]) => {
      const kind = kinds.find(kind => typeOf(kind) === type)
      return [type, { ...definition, thumbnail: kind ? thumbnails[`../${kind}/thumbnail.svg`] : undefined }]
    })),
  }))
  const dashboard = computed<DashboardValue>(() => ({
    canvas: { backgroundColor: 'transparent', gridLayout: { colNum: 24, rowHeight: 16, marginHorizontal: 18, marginVertical: 18 } },
    components: buildDeviceDetailLayout(width.value).flatMap(({ kind, grid }) => {
      const type = typeOf(kind), definition = catalog.value.components[type]
      if (!definition) return []
      return [{ ...definition.defaultConfig, id: type, type,
        componentProps: { ...definition.defaultConfig.componentProps, gridItem: grid } }]
    }),
  }))
  const storageKey = computed(() => `device-detail-dashboard-v1:${encodeURIComponent(context.scope.value)}:${detailLayoutMode(width.value)}`)
  return { ...discovery, catalog, dashboard, storageKey }
}
