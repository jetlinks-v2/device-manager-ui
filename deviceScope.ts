import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DeviceQueryTerm } from './api/device'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from './api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from './api/spaceArea'
import type { ProjectArea } from './modules/defaults/types'
import { resolveIotProjectId } from './views/device/list/hooks/useIotDeviceRouting'
import { buildAreaScopeIds, useIotDeviceScopeCounts } from './views/device/list/hooks/useIotDeviceScopeCounts'
import {
  IOT_UNASSIGNED_GROUP_SCOPE_ID,
  IOT_UNBOUND_AREA_SCOPE_ID,
} from './views/device/list/hooks/useIotDeviceAssetFilters'

/** 模块公开的设备范围能力；宿主传入固定设备条件，树、统计和路由由设备模块维护。 */
export function useDeviceScope(baseTerms: Ref<DeviceQueryTerm[]>, refreshKey: Ref<number>) {
  const route = useRoute()
  const router = useRouter()
  const projectId = computed(() => resolveIotProjectId(route))
  const areas = ref<ProjectArea[]>([])
  const groups = ref<DeviceGroup[]>([])
  const loading = ref(false)
  const loadError = ref(false)
  const scopeType = computed(() => route.query.scopeType === 'group' ? 'group' : 'area')
  const scopeId = computed(() => String(route.query.scopeId || ''))
  const areaScopeIds = computed(() => buildAreaScopeIds(areas.value))
  let loadRequest: Promise<void> = Promise.resolve()

  watch(projectId, (id, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    loading.value = true
    loadError.value = false
    // 区域和分组加载完成后才允许查询未绑定范围，避免空选项被误当作全部设备。
    loadRequest = Promise.all([
      queryProjectSpaceAreaSettings_api(id),
      queryDeviceGroupDetailList_api(),
    ]).then(([settings, items]) => {
      if (cancelled) return
      areas.value = settings.areas
      groups.value = items
    }).catch(() => {
      if (!cancelled) loadError.value = true
    }).finally(() => {
      if (!cancelled) loading.value = false
    })
  }, { immediate: true })

  const terms = computed<DeviceQueryTerm[]>(() => {
    const id = scopeId.value
    if (!id) return []
    if (scopeType.value === 'group') {
      if (id !== IOT_UNASSIGNED_GROUP_SCOPE_ID) {
        return [{ column: 'id', termType: 'dev-group-tree', value: id }]
      }
      const ids = groups.value.map(group => group.id)
      return ids.length ? [{ column: 'id', termType: 'dev-group$not', value: ids }] : []
    }
    const unbound = id === IOT_UNBOUND_AREA_SCOPE_ID
    const ids = unbound ? areas.value.map(area => area.id) : areaScopeIds.value[id] ?? [id]
    return ids.length ? [{
      column: 'id',
      termType: unbound ? 'space-bind$not$device' : 'space-bind$device',
      value: ids.length === 1 ? ids[0] : ids,
    }] : []
  })

  function handleScopeChange(scope: { type: 'area' | 'group'; id: string }) {
    void router.replace({ query: {
      ...route.query,
      scopeType: scope.type,
      scopeId: scope.id || undefined,
    } })
  }

  async function ensureReady() {
    await loadRequest
    if (loadError.value) throw new Error('Device scope options failed to load')
  }

  const countsProjectId = computed(() => loading.value || loadError.value ? '' : projectId.value)
  const counts = useIotDeviceScopeCounts(countsProjectId, areas, groups, refreshKey, baseTerms)
  const sidebarProps = computed(() => ({
    activeType: scopeType.value,
    activeId: scopeId.value,
    areas: areas.value,
    groups: groups.value,
    totalDeviceCount: counts.totalDeviceCount.value,
    areaDeviceCounts: counts.areaDeviceCounts.value,
    groupDeviceCounts: counts.groupDeviceCounts.value,
    unboundAreaDeviceCount: counts.unboundAreaDeviceCount.value,
    unassignedGroupDeviceCount: counts.unassignedGroupDeviceCount.value,
  }))
  async function reloadGroups() { groups.value = await queryDeviceGroupDetailList_api() }
  return { sidebarProps, scopeType, scopeId, terms, loading, loadError, ensureReady, handleScopeChange, reloadGroups }
}
