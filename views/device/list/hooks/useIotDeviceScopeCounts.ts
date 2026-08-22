import { ref, watch, type Ref } from 'vue'
import { countDevice_api } from '@device-manager-ui/api/device'
import { batchDeviceNodeSummary_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import { IOT_UNASSIGNED_GROUP_SCOPE_ID, IOT_UNBOUND_AREA_SCOPE_ID } from './useIotDeviceAssetFilters'

type ScopeCounts = Record<string, number>
const areaScopeKey = (areaId: string) => `area:${areaId}`

function buildAreaScopeIds(areas: ProjectArea[]): Record<string, string[]> {
  const childrenByParent = new Map<string, string[]>()

  areas.forEach((area) => {
    const parentId = area.parentId || ''
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), area.id])
  })

  const cachedScopeIds = new Map<string, string[]>()
  const collectScopeIds = (areaId: string): string[] => {
    const cached = cachedScopeIds.get(areaId)
    if (cached) return cached

    const ids = [areaId]
    cachedScopeIds.set(areaId, ids)
    for (const childId of childrenByParent.get(areaId) ?? []) {
      ids.push(...collectScopeIds(childId))
    }
    return ids
  }

  return Object.fromEntries(areas.map((area) => [area.id, collectScopeIds(area.id)]))
}

/**
 * 设备范围侧栏统计。
 *
 * 区域选择包含子区域，统计通过设备运行时汇总保持与设备分组页一致的默认过滤口径。
 */
export function useIotDeviceScopeCounts(
  projectId: Ref<string>,
  areas: Ref<ProjectArea[]>,
  groups: Ref<DeviceGroup[]>,
  refreshKey: Ref<number>,
) {
  const totalDeviceCount = ref(0)
  const areaDeviceCounts = ref<ScopeCounts>({})
  const groupDeviceCounts = ref<ScopeCounts>({})
  const unboundAreaDeviceCount = ref(0)
  const unassignedGroupDeviceCount = ref(0)
  let requestVersion = 0

  async function refreshScopeCounts() {
    const version = ++requestVersion
    const areaIds = areas.value.map((area) => area.id)
    const areaScopeIds = buildAreaScopeIds(areas.value)
    const groupIds = groups.value.map((group) => group.id).filter(Boolean)
    const [total, scopeSummaries] = await Promise.all([
      countDevice_api().catch(() => 0),
      batchDeviceNodeSummary_api([
        ...areas.value.map((area) => {
          const scopeIds = areaScopeIds[area.id] ?? [area.id]
          return {
            id: areaScopeKey(area.id),
            query: {
              terms: [{
                column: 'id',
                termType: 'space-bind$device',
                value: scopeIds.length === 1 ? scopeIds[0] : scopeIds,
              }],
            },
          }
        }),
        ...groups.value.map((group) => ({
          id: group.id,
          query: {
            terms: [{ column: 'id', termType: 'dev-group-tree', value: group.id }],
          },
        })),
        {
          id: IOT_UNBOUND_AREA_SCOPE_ID,
          query: {
            terms: areaIds.length ? [{
              column: 'id',
              termType: 'space-bind$not$device',
              value: areaIds.length === 1 ? areaIds[0] : areaIds,
            }] : [],
          },
        },
        {
          id: IOT_UNASSIGNED_GROUP_SCOPE_ID,
          query: {
            terms: groupIds.length ? [{ column: 'id', termType: 'dev-group$not', value: groupIds }] : [],
          },
        },
      ]).catch(() => []),
    ])

    // 设备写操作与范围切换可能并发触发统计刷新，只保留最新结果。
    if (version !== requestVersion) return

    totalDeviceCount.value = Math.max(0, Number(total) || 0)
    const scopeCountMap = Object.fromEntries(scopeSummaries.map((scope) => [scope.id, scope.deviceCount]))
    areaDeviceCounts.value = Object.fromEntries(areas.value.map((area) => [area.id, scopeCountMap[areaScopeKey(area.id)] ?? 0]))
    groupDeviceCounts.value = Object.fromEntries(groups.value.map((group) => [group.id, scopeCountMap[group.id] ?? 0]))
    unboundAreaDeviceCount.value = scopeCountMap[IOT_UNBOUND_AREA_SCOPE_ID] ?? 0
    unassignedGroupDeviceCount.value = scopeCountMap[IOT_UNASSIGNED_GROUP_SCOPE_ID] ?? 0
  }

  watch([projectId, areas, groups, refreshKey], ([nextProjectId]) => {
    if (!nextProjectId) {
      totalDeviceCount.value = 0
      areaDeviceCounts.value = {}
      groupDeviceCounts.value = {}
      unboundAreaDeviceCount.value = 0
      unassignedGroupDeviceCount.value = 0
      return
    }
    void refreshScopeCounts()
  }, { immediate: true })

  return {
    totalDeviceCount,
    areaDeviceCounts,
    groupDeviceCounts,
    unboundAreaDeviceCount,
    unassignedGroupDeviceCount,
    refreshScopeCounts,
  }
}
