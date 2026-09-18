import { computed } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { buildDeviceGroupTreeData, type DeviceGroupTreeNode } from './iotDeviceGroupTreeOptions'
import { IOT_UNASSIGNED_GROUP_SCOPE_ID, IOT_UNBOUND_AREA_SCOPE_ID } from './useIotDeviceAssetFilters'

type Area = { id: string; name: string; parentId?: string }
type Scope = { type: 'area' | 'group'; id: string }

export interface IotDeviceScopeSidebarProps {
  // 仅消费范围筛选的页面可关闭管理入口；设备页默认保留分组操作。
  showGroupActions?: boolean
  activeType: Scope['type']
  activeId: string
  areas: Area[]
  groups: DeviceGroup[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
  unboundAreaDeviceCount: number
  unassignedGroupDeviceCount: number
}

type ScopeTreeNode = {
  key: string
  title: string
  count?: number
  group?: DeviceGroup
  children?: ScopeTreeNode[]
}

/** 派生侧栏树和选中状态，仅通过 change 回传筛选意图。 */
export function useIotDeviceScopeSidebar(
  props: Readonly<IotDeviceScopeSidebarProps>,
  onChange: (scope: Scope) => void,
) {
  const { t } = useI18n()
  const scopeType = computed({
    get: () => props.activeType,
    set: (type: Scope['type']) => onChange({ type, id: '' }),
  })
  const scopeId = computed(() => props.activeId)
  // 不设置 label 字段，分段器才会把这部分交给 #label 插槽渲染（图标 + 文案）。
  const scopeOptions = computed(() => [
    {
      value: 'area',
      payload: { title: t('IotDeviceList.scope.area'), icon: 'icon-dizhi-hui' },
    },
    {
      value: 'group',
      payload: { title: t('IotDeviceList.scope.group'), icon: 'icon-zuzhi' },
    },
  ])

  const areaTree = computed<ScopeTreeNode[]>(() => {
    const byParent = new Map<string, Area[]>()
    props.areas.forEach((area) => {
      const parentId = area.parentId || ''
      byParent.set(parentId, [...(byParent.get(parentId) ?? []), area])
    })
    const toNode = (area: Area): ScopeTreeNode => ({
      key: area.id,
      title: area.name,
      count: props.areaDeviceCounts[area.id],
      children: (byParent.get(area.id) ?? []).map(toNode),
    })
    return (byParent.get('') ?? []).map(toNode)
  })
  const groupTree = computed<ScopeTreeNode[]>(() => {
    const withCount = (node: DeviceGroupTreeNode): ScopeTreeNode => ({
      ...node,
      count: props.groupDeviceCounts[node.key],
      children: node.children?.map(withCount),
    })
    return buildDeviceGroupTreeData(props.groups).map(withCount)
  })

  const hasScopes = computed(() => (scopeType.value === 'area' ? areaTree.value : groupTree.value).length > 0)
  // 特殊范围始终追加为最后一个根节点；不附带 group，避免出现分组管理操作。
  const treeData = computed<ScopeTreeNode[]>(() => scopeType.value === 'area'
    ? [...areaTree.value, {
      key: IOT_UNBOUND_AREA_SCOPE_ID,
      title: t('IotDeviceList.scope.unboundArea'),
      count: props.unboundAreaDeviceCount,
    }]
    : [...groupTree.value, {
      key: IOT_UNASSIGNED_GROUP_SCOPE_ID,
      title: t('IotDeviceList.scope.unassignedGroup'),
      count: props.unassignedGroupDeviceCount,
    }])

  const select = (id: string) => onChange({ type: scopeType.value, id })
  const onSelect: TreeProps['onSelect'] = (keys) => select(String(keys[0] || ''))
  const countText = (value?: number) => t('IotDeviceList.scope.deviceCount', { count: Math.max(0, Number(value) || 0) })

  return { scopeType, scopeId, scopeOptions, hasScopes, treeData, select, onSelect, countText }
}
