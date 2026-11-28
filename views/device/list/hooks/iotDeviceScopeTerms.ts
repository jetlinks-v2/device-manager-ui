import type { DeviceQueryTerm } from '@device-manager-ui/api/device'

export const IOT_ALL_BOUND_AREAS_SCOPE_ID = '__iot-all-bound-areas__'
export const IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID = '__iot-all-assigned-groups__'
export const IOT_UNBOUND_AREA_SCOPE_ID = '__iot-unbound-area__'
export const IOT_UNASSIGNED_GROUP_SCOPE_ID = '__iot-unassigned-group__'

/** 查询、统计共用范围条件；关联关系使用 EXISTS，设备不会因多处绑定而重复。 */
export function buildDeviceScopeTerms(
  type: 'area' | 'group',
  id: string,
  groupIds: string[],
  areaIds: string[] = [id],
): DeviceQueryTerm[] {
  if (!id) return []
  if (type === 'group') {
    if (id === IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID) return [{ column: 'id', termType: 'dev-group', value: groupIds }]
    if (id === IOT_UNASSIGNED_GROUP_SCOPE_ID) return groupIds.length ? [{ column: 'id', termType: 'dev-group$not', value: groupIds }] : []
    return [{ column: 'id', termType: 'dev-group-tree', value: id }]
  }
  if (id === IOT_ALL_BOUND_AREAS_SCOPE_ID || id === IOT_UNBOUND_AREA_SCOPE_ID) {
    // 任意空间条件不依赖可见空间 ID，避免将已绑定到不可读空间的设备误判为未绑定。
    return [{ column: 'id', termType: id === IOT_UNBOUND_AREA_SCOPE_ID ? 'space-bind$any$not' : 'space-bind$any', value: '__any_space_binding__' }]
  }
  return [{ column: 'id', termType: 'space-bind$device', value: areaIds.length === 1 ? areaIds[0] : areaIds }]
}
