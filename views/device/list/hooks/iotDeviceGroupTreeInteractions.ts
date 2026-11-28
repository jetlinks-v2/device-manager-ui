import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'

export type GroupTreeAction = 'create-root' | 'create-child' | 'edit' | 'delete'
export interface GroupMoveIntent { id: string; parentId: string; beforeId?: string }
export interface GroupTreePatch { id: string; parentId?: string; sortIndex: number }
export interface GroupFormValue { name: string; parentId: string }
const parentOf = (group: DeviceGroup) => !group.parentId || group.parentId === '-1' || group.parentId === group.id ? '' : group.parentId
const sorted = (groups: DeviceGroup[]) => [...groups].sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'zh-CN'))

/** 父级选择和拖放共用循环关系判断；服务端仍负责权威树校验。 */
export function canMoveGroup(groups: DeviceGroup[], id: string, parentId: string) {
  const byId = new Map(groups.map(group => [group.id, group]))
  if (!byId.has(id) || (parentId && !byId.has(parentId))) return false
  const seen = new Set<string>([id])
  for (let current = parentId; current;) {
    if (seen.has(current)) return false
    seen.add(current)
    const parent = byId.get(current)
    if (!parent) break
    current = parentOf(parent)
  }
  return true
}

/** 沿用 Ant Tree 官方示例的节点内部、间隙及展开分支下沿落点语义。 */
export function resolveGroupDrop(groups: DeviceGroup[], id: string, targetId: string | undefined, position: number, expanded = false): GroupMoveIntent | undefined {
  if (![-1, 0, 1].includes(position) || id === targetId) return
  const target = groups.find(group => group.id === targetId)
  if (targetId !== undefined && !target) return
  if (!target && position !== 0) return
  const inside = position === 0 || (position === 1 && expanded && groups.some(group => parentOf(group) === targetId))
  const parentId = !target ? '' : inside ? target.id : parentOf(target)
  if (!canMoveGroup(groups, id, parentId)) return
  const siblings = sorted(groups.filter(group => group.id !== id && parentOf(group) === parentId))
  const index = inside || !target ? 0 : siblings.findIndex(group => group.id === target.id) + (position === 1 ? 1 : 0)
  if (index < 0) return
  return { id, parentId, beforeId: siblings[index]?.id }
}

/** 仅提交发生变化的排序字段；空父级是平台明确的移至顶级标记。 */
export function planGroupMove(groups: DeviceGroup[], intent: GroupMoveIntent): GroupTreePatch[] | undefined {
  if (!canMoveGroup(groups, intent.id, intent.parentId)) return
  const source = groups.find(group => group.id === intent.id)!
  const siblings = sorted(groups.filter(group => group.id !== intent.id && parentOf(group) === intent.parentId))
  const index = intent.beforeId ? siblings.findIndex(group => group.id === intent.beforeId) : siblings.length
  if (index < 0) return
  siblings.splice(index, 0, source)
  const previous = sorted(groups.filter(group => parentOf(group) === intent.parentId))
  if (parentOf(source) === intent.parentId && previous.every((group, index) => group.id === siblings[index]?.id)) return []
  return siblings.flatMap((group, sortIndex) => {
    const reparent = group.id === source.id && parentOf(source) !== intent.parentId
    return reparent || group.sortIndex !== sortIndex
      ? [{ id: group.id, sortIndex, ...(reparent ? { parentId: intent.parentId } : {}) }]
      : []
  })
}
