import { ref, watch, type Ref } from 'vue'
import { countDevice_api } from '@device-manager-ui/api/device'
import { batchDeviceNodeSummary_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { querySpaceAreaDeviceBindings_api, type DeviceSpaceAreaBinding } from '@device-manager-ui/api/spaceArea'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import { IOT_UNASSIGNED_GROUP_SCOPE_ID, IOT_UNBOUND_AREA_SCOPE_ID } from './useIotDeviceAssetFilters'

type ScopeCounts = Record<string, number>

function buildAreaDeviceCounts(areas: ProjectArea[], bindings: DeviceSpaceAreaBinding[]): ScopeCounts {
  const childrenByParent = new Map<string, string[]>()
  const devicesByArea = new Map<string, Set<string>>()

  areas.forEach((area) => {
    const parentId = area.parentId || ''
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), area.id])
    devicesByArea.set(area.id, new Set())
  })

  bindings.forEach((binding) => devicesByArea.get(binding.areaId)?.add(binding.deviceId))

  const visited = new Map<string, Set<string>>()
  const collectDeviceIds = (areaId: string): Set<string> => {
    const cached = visited.get(areaId)
    if (cached) return cached

    const deviceIds = new Set(devicesByArea.get(areaId) ?? [])
    visited.set(areaId, deviceIds)
    ;(childrenByParent.get(areaId) ?? []).forEach((childId) => {
      collectDeviceIds(childId).forEach((deviceId) => deviceIds.add(deviceId))
    })
    return deviceIds
  }

  return Object.fromEntries(areas.map((area) => [area.id, collectDeviceIds(area.id).size]))
}

/**
 * 设备范围侧栏统计。
 *
 * 区域选择包含子区域，统计也按同一口径合并子树中的唯一设备。
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
    const groupIds = groups.value.map((group) => group.id).filter(Boolean)
    const [total, bindings, scopeSummaries] = await Promise.all([
      countDevice_api().catch(() => 0),
      querySpaceAreaDeviceBindings_api(areaIds).catch(() => []),
      batchDeviceNodeSummary_api([
        ...groups.value.map((group) => ({
          id: group.id,
          query: {
            terms: [{ column: 'id', termType: 'dev-group-tree', value: group.id }],
          },
        })),
        {
          id: IOT_UNBOUND_AREA_SCOPE_ID,
          query: {
            terms: areaIds.length ? [{ column: 'id', termType: 'space-bind$not$device', value: areaIds }] : [],
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
    areaDeviceCounts.value = buildAreaDeviceCounts(areas.value, bindings)
    const scopeCountMap = Object.fromEntries(scopeSummaries.map((scope) => [scope.id, scope.deviceCount]))
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
