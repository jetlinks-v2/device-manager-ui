import { computed } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { buildDeviceGroupTreeData, type DeviceGroupTreeNode } from './iotDeviceGroupTreeOptions'
import { IOT_UNASSIGNED_GROUP_SCOPE_ID, IOT_UNBOUND_AREA_SCOPE_ID } from './useIotDeviceAssetFilters'

const IOT_ALL_DEVICE_SCOPE_ID = '__iot-all-devices__'

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
  icon: string
  isScope?: boolean
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
      icon: 'icon-dizhi',
      children: (byParent.get(area.id) ?? []).map(toNode),
    })
    return (byParent.get('') ?? []).map(toNode)
  })
  const groupTree = computed<ScopeTreeNode[]>(() => {
    const withCount = (node: DeviceGroupTreeNode): ScopeTreeNode => ({
      ...node,
      count: props.groupDeviceCounts[node.key],
      icon: 'icon-zuzhi',
      children: node.children?.map(withCount),
    })
    return buildDeviceGroupTreeData(props.groups).map(withCount)
  })

  // 固定范围始终排在树顶，并通过虚拟 key 映射回既有的空 scopeId 筛选语义。
  const treeData = computed<ScopeTreeNode[]>(() => scopeType.value === 'area'
    ? [{
      key: IOT_ALL_DEVICE_SCOPE_ID,
      title: t('IotDeviceList.scope.allAreas'),
      count: props.totalDeviceCount,
      icon: 'icon-shebei2',
      isScope: true,
    }, {
      key: IOT_UNBOUND_AREA_SCOPE_ID,
      title: t('IotDeviceList.scope.unboundArea'),
      count: props.unboundAreaDeviceCount,
      icon: 'icon-shebei2',
      isScope: true,
    }, ...areaTree.value]
    : [{
      key: IOT_ALL_DEVICE_SCOPE_ID,
      title: t('IotDeviceList.scope.allGroups'),
      count: props.totalDeviceCount,
      icon: 'icon-shebei2',
      isScope: true,
    }, {
      key: IOT_UNASSIGNED_GROUP_SCOPE_ID,
      title: t('IotDeviceList.scope.unassignedGroup'),
      count: props.unassignedGroupDeviceCount,
      icon: 'icon-shebei2',
      isScope: true,
    }, ...groupTree.value])
  const selectedKeys = computed(() => [scopeId.value || IOT_ALL_DEVICE_SCOPE_ID])

  const onSelect: TreeProps['onSelect'] = (keys) => {
    const key = String(keys[0] || IOT_ALL_DEVICE_SCOPE_ID)
    onChange({ type: scopeType.value, id: key === IOT_ALL_DEVICE_SCOPE_ID ? '' : key })
  }
  const countText = (value?: number) => t('IotDeviceList.scope.deviceCount', { count: Math.max(0, Number(value) || 0) })

  return { scopeType, scopeOptions, treeData, selectedKeys, onSelect, countText }
}
