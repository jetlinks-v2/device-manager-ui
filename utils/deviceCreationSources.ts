export type DeviceCreationCategoryNode = {
  id: string
  children?: DeviceCreationCategoryNode[]
}

/** 分类树选择父节点时需要将所有后代作为同一个产品查询范围。 */
export function collectProductCategoryScopeIds(nodes: DeviceCreationCategoryNode[], id: string): string[] {
  const collect = (node: DeviceCreationCategoryNode): string[] => [node.id, ...(node.children ?? []).flatMap(collect)]
  const find = (items: DeviceCreationCategoryNode[]): string[] | undefined => {
    for (const node of items) {
      if (node.id === id) return collect(node)
      const descendants = find(node.children ?? [])
      if (descendants) return descendants
    }
  }
  return find(nodes) ?? [id]
}

/** 运行时能力市场没有 total，只能按原始页是否填满判断能否请求下一页。 */
export const hasMoreDeviceLibraryRows = (rawRowCount: number, pageSize: number) => rawRowCount === pageSize

/** 存储策略必须来自当前运行时返回的策略集合，失效值不能继续创建设备。 */
export const hasAvailableStorePolicy = (policyId: string, policies: Array<{ id?: string }>) =>
  Boolean(policyId) && policies.some((policy) => policy.id === policyId)
