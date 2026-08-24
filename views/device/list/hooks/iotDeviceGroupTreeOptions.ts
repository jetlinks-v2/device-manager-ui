import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'

export type DeviceGroupTreeNode = {
  title: string
  value: string
  key: string
  group: DeviceGroup
  children?: DeviceGroupTreeNode[]
}

const sortGroups = (items: DeviceGroup[]) =>
  [...items].sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name, 'zh-CN'))

/** Converts the flat group API response into the tree shape shared by group pickers. */
export function buildDeviceGroupTreeData(groups: DeviceGroup[]): DeviceGroupTreeNode[] {
  const groupIds = new Set(groups.map((group) => group.id))
  const childrenByParent = new Map<string, DeviceGroup[]>()
  const rootGroups: DeviceGroup[] = []

  for (const group of groups) {
    if (!group.parentId || group.parentId === group.id || !groupIds.has(group.parentId)) {
      rootGroups.push(group)
      continue
    }
    const children = childrenByParent.get(group.parentId) ?? []
    children.push(group)
    childrenByParent.set(group.parentId, children)
  }

  const toTreeNode = (group: DeviceGroup): DeviceGroupTreeNode => {
    const children = sortGroups(childrenByParent.get(group.id) ?? []).map(toTreeNode)
    return {
      title: group.name,
      value: group.id,
      key: group.id,
      group,
      ...(children.length ? { children } : {}),
    }
  }

  return sortGroups(rootGroups).map(toTreeNode)
}
