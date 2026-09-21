import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'

export type DeviceBoundArea = ProjectArea & {
  /** 仅由设备关联查询补齐，不能作为新的区域绑定目标。 */
  boundOnly?: true
}

export type DeviceAreaBindingOption = {
  areaId?: string
  area?: string
}

export type AreaTreeNode = {
  title: string
  value: string
  key: string
  disabled: boolean
  selectable: boolean
  children?: AreaTreeNode[]
}

const LEGACY_SELECTABLE_AREA_DEPTH = 4

const isBoundOnlyArea = (area: ProjectArea): area is DeviceBoundArea => (
  (area as DeviceBoundArea).boundOnly === true
)

/**
 * 将设备已绑定但当前无空间读取权限的区域补入选项。
 *
 * 这类节点只包含设备关联接口已返回的 ID 和名称，保持为根节点且不可作为新的绑定目标。
 */
export function mergeDeviceBoundAreas(
  areas: ProjectArea[],
  bindings: DeviceAreaBindingOption[],
  projectId = '',
): DeviceBoundArea[] {
  const result = new Map<string, DeviceBoundArea>(areas.map((area) => [area.id, area]))

  bindings.forEach((binding) => {
    const areaId = String(binding.areaId || '').trim()
    if (!areaId || result.has(areaId)) return
    const name = String(binding.area || areaId).trim() || areaId
    result.set(areaId, {
      id: areaId,
      projectId,
      name,
      type: 'site',
      canBindAsset: false,
      code: areaId,
      aliases: [],
      sortOrder: 0,
      description: '',
      planMode: 'own',
      boundOnly: true,
    })
  })

  return [...result.values()]
}

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
  if (!area || isBoundOnlyArea(area)) return false
  const hasAssetBindingCapability = areas.some((item) => !isBoundOnlyArea(item) && typeof item.canBindAsset === 'boolean')

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
