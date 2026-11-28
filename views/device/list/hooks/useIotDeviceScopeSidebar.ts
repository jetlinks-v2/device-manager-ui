import { computed, reactive } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { buildDeviceGroupTreeData, type DeviceGroupTreeNode } from './iotDeviceGroupTreeOptions'
import { IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID, IOT_ALL_BOUND_AREAS_SCOPE_ID, IOT_UNASSIGNED_GROUP_SCOPE_ID, IOT_UNBOUND_AREA_SCOPE_ID } from './iotDeviceScopeTerms'

type Area = { id: string; name: string; parentId?: string }
type Scope = { type: 'area' | 'group'; id: string }

export interface IotDeviceScopeSidebarProps {
  // 仅消费范围筛选的页面可关闭管理入口；设备页默认保留分组操作。
  showGroupActions?: boolean
  showArea?: boolean
  loading?: boolean
  loadError?: boolean
  activeType: Scope['type']
  activeId: string
  areas: Area[]
  groups: DeviceGroup[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
  unboundAreaDeviceCount: number
  unassignedGroupDeviceCount: number
  boundAreaDeviceCount?: number
  assignedGroupDeviceCount?: number
}

type ScopeTreeNode = {
  key: string
  title: string
  count?: number
  isRoot?: boolean
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
  const searchPlaceholder = computed(() => t(scopeType.value === 'area'
    ? 'IotDeviceList.scope.searchArea'
    : 'IotDeviceList.scope.searchGroup'))
  // 不设置 label 字段，分段器才会把这部分交给 #label 插槽渲染（图标 + 文案）。
  const scopeOptions = computed(() => [
    ...(props.showArea === false ? [] : [{
      value: 'area',
      payload: { title: t('IotDeviceList.scope.area'), icon: 'icon-dizhi-hui' },
    }]),
    {
      value: 'group',
      payload: { title: t('IotDeviceList.scope.group'), icon: 'icon-zuzhi' },
    },
  ])

  const areaTree = computed<ScopeTreeNode[]>(() => {
    const byParent = new Map<string, Area[]>()
    const ids = new Set(props.areas.map(area => area.id))
    props.areas.forEach((area) => {
      if (area.parentId === area.id) return
      const parentId = area.parentId || ''
      byParent.set(parentId, [...(byParent.get(parentId) ?? []), area])
    })
    const toNode = (area: Area): ScopeTreeNode => ({
      key: area.id,
      title: area.name,
      count: props.areaDeviceCounts[area.id],
      children: (byParent.get(area.id) ?? []).map(toNode),
    })
    return props.areas.filter(area => !area.parentId || area.parentId === area.id || !ids.has(area.parentId)).map(toNode)
  })
  const groupTree = computed<ScopeTreeNode[]>(() => {
    const withCount = (node: DeviceGroupTreeNode): ScopeTreeNode => ({
      ...node,
      count: props.groupDeviceCounts[node.key],
      children: node.children?.map(withCount),
    })
    return buildDeviceGroupTreeData(props.groups).map(withCount)
  })

  const quickScopes = computed(() => scopeType.value === 'area'
    ? [{
      key: '',
      title: t('IotDeviceList.scope.allAreas'),
      count: props.totalDeviceCount,
      icon: 'AppstoreOutlined',
    }, {
      key: IOT_UNBOUND_AREA_SCOPE_ID,
      title: t('IotDeviceList.scope.unboundArea'),
      count: props.unboundAreaDeviceCount,
      icon: 'DisconnectOutlined',
    }]
    : [{
      key: '',
      title: t('IotDeviceList.scope.allGroups'),
      count: props.totalDeviceCount,
      icon: 'AppstoreOutlined',
    }, {
      key: IOT_UNASSIGNED_GROUP_SCOPE_ID,
      title: t('IotDeviceList.scope.unassignedGroup'),
      count: props.unassignedGroupDeviceCount,
      icon: 'FolderOpenOutlined',
    }])
  const rootId = computed(() => scopeType.value === 'area' ? IOT_ALL_BOUND_AREAS_SCOPE_ID : IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID)
  const treeNodes = computed(() => scopeType.value === 'area' ? areaTree.value : groupTree.value)
  const hasData = computed(() => treeNodes.value.length > 0)
  const treeData = computed<ScopeTreeNode[]>(() => hasData.value ? [{
    key: rootId.value,
    title: t(scopeType.value === 'area' ? 'IotDeviceList.scope.rootAreas' : 'IotDeviceList.scope.rootGroups'),
    count: scopeType.value === 'area' ? props.boundAreaDeviceCount : props.assignedGroupDeviceCount,
    isRoot: true,
    children: treeNodes.value,
  }] : [])
  // 首次展开由公共组件生成；此处仅保留两个业务范围各自的用户偏好。
  const expandedByType = reactive<Partial<Record<Scope['type'], string[]>>>({})
  const expandedKeys = computed(() => expandedByType[scopeType.value])
  const onExpand = (keys: NonNullable<TreeProps['expandedKeys']>) => { expandedByType[scopeType.value] = keys.map(String) }
  const selectedKeys = computed(() => scopeId.value ? [scopeId.value] : [])
  const chooseScope = (id: string) => onChange({ type: scopeType.value, id })

  const onSelect: TreeProps['onSelect'] = (keys) => {
    chooseScope(String(keys[0] || ''))
  }
  const countValue = (value?: number) => Math.max(0, Number(value) || 0)

  return { scopeType, scopeOptions, searchPlaceholder, rootId, hasData, quickScopes, treeData, expandedKeys, onExpand, selectedKeys, chooseScope, onSelect, countValue }
}
