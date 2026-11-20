interface GroupRow {
  id?: string
  expands?: { groupId?: string; groupName?: string; isProduct?: boolean; [key: string]: unknown }
}

/** 同组包含任一产品继承属性时，设备端将整个分组视为继承分组。 */
export function isInheritedMetadataGroup(rows: GroupRow[], groupId: string, target: string): boolean {
  return target === 'device' && rows.some(row => row.expands?.groupId === groupId && row.expands?.isProduct)
}

export function canManageMetadataGroup(group: { value?: string | number; inherited?: boolean }, target: string, readonly: boolean): boolean {
  return !readonly && !(target === 'device' && group.inherited)
}

/** 重命名只影响当前物模型；继承分组在写入入口也拒绝修改。 */
export function renameMetadataGroup(rows: GroupRow[], record: { value: string; label: string; oldValue: string }, target: string): boolean {
  if (isInheritedMetadataGroup(rows, record.oldValue, target)) return false
  if (record.value !== record.oldValue && rows.some(row => row.expands?.groupId === record.value)) return false
  let changed = false
  rows.forEach(row => {
    if (row.expands?.groupId !== record.oldValue) return
    row.expands.groupId = record.value
    row.expands.groupName = record.label
    changed = true
  })
  return changed
}

/** 产品和设备自建分组均连同组内属性删除；设备继承分组仍拒绝删除。 */
export function removeMetadataGroup<T extends GroupRow>(rows: T[], groupId: string, target: string): T[] {
  if (isInheritedMetadataGroup(rows, groupId, target)) return rows
  return rows.filter(row => row.expands?.groupId !== groupId)
}
