export type DeviceCreationCategoryNode = {
  id: string
  children?: DeviceCreationCategoryNode[]
}

const excludedAccessProviders = new Set([
  'agent-device-gateway',
  'agent-media-device-gateway',
  'official-edge-gateway',
  'fixed-media',
  'gb28181-2016',
  'media-plugin',
  'onvif',
])

/** 两种来源共用的候选限制：边缘网关和视频设备必须从各自业务入口创建。 */
export function isSelectableDeviceCreationCandidate(candidate: { category?: string; accessProvider?: string }): boolean {
  return candidate.category !== 'video' && !excludedAccessProviders.has(String(candidate.accessProvider || ''))
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
