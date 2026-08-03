import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'

export type AreaTreeNode = {
  title: string
  value: string
  key: string
  disabled: boolean
  selectable: boolean
  children?: AreaTreeNode[]
}

const LEGACY_SELECTABLE_AREA_DEPTH = 4

const sortAreas = (items: ProjectArea[]) =>
  [...items].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'zh-CN'))

function getAreaDepth(areas: ProjectArea[], areaId: string): number {
  const areaById = new Map(areas.map((area) => [area.id, area]))
  let depth = 0
  let current = areaById.get(areaId)
  while (current) {
    depth += 1
    current = current.parentId ? areaById.get(current.parentId) : undefined
  }
  return depth
}

export function isSelectableDeviceArea(areas: ProjectArea[], areaId: string): boolean {
  const area = areas.find((item) => item.id === areaId)
  if (!area) return false
  const hasAssetBindingCapability = areas.some((item) => typeof item.canBindAsset === 'boolean')

  // 老空间服务未返回能力元数据时，保留既有四级节点选择规则。
  return hasAssetBindingCapability
    ? area.canBindAsset === true
    : getAreaDepth(areas, areaId) === LEGACY_SELECTABLE_AREA_DEPTH
}

export function buildAreaTreeData(areas: ProjectArea[]): AreaTreeNode[] {
  const areaIds = new Set(areas.map((area) => area.id))
  const childrenByParent = new Map<string, ProjectArea[]>()
  const rootAreas: ProjectArea[] = []

  for (const area of areas) {
    if (!area.parentId || !areaIds.has(area.parentId)) {
      rootAreas.push(area)
      continue
    }
    const children = childrenByParent.get(area.parentId) ?? []
    children.push(area)
    childrenByParent.set(area.parentId, children)
  }

  const toTreeNode = (area: ProjectArea): AreaTreeNode => {
    const children = sortAreas(childrenByParent.get(area.id) ?? []).map(toTreeNode)
    const selectable = isSelectableDeviceArea(areas, area.id)
    return {
      title: area.name,
      value: area.id,
      key: area.id,
      disabled: !selectable,
      selectable,
      ...(children.length ? { children } : {}),
    }
  }

  return sortAreas(rootAreas).map(toTreeNode)
}
