import { request } from '@jetlinks-web/core'
import { query } from './instance'
import { queryProductList } from './product'
import type { MetricNavigationNode, MetricNavigationPage } from '../views/device/metrics/navigation/useMetricNavigator'

type Owner = { id: string; name?: string; parentId?: string }
type OwnerResponse = { status?: number; success?: boolean; message?: string; result?: { data?: Owner[]; total?: number } }

function requireResult(response: OwnerResponse) {
  if (response.success === false || (response.status && response.status >= 400)) throw new Error(response.message || String(response.status))
  return response.result || {}
}

/** 对象列表与精确定位使用相同授权查询，URL 中的名称和 ID 不能代替查询结果。 */
export async function queryMetricOwnerPage(type: 'device' | 'product', keyword: string, pageIndex: number, exactId?: string): Promise<MetricNavigationPage> {
  const response = await (type === 'device' ? query : queryProductList)({
    pageIndex, pageSize: 20, sorts: [{ name: 'name', order: 'asc' }],
    terms: exactId ? [{ column: 'id', termType: 'eq', value: exactId }]
      : keyword.trim() ? [{ column: 'name', termType: 'like', value: `%${keyword.trim()}%` }] : [],
  })
  const result = requireResult(response)
  return { data: (result.data || []).map(item => ({ ownerId: item.id, label: item.name || item.id })), total: result.total || 0 }
}

/** 分组导航只需要层级与名称，避免 _detail 的设备统计查询。 */
export async function queryMetricGroupTree(): Promise<MetricNavigationPage> {
  const response = await request.post('/device/group/_query', { paging: false, sorts: [{ name: 'sortIndex', order: 'asc' }] }) as OwnerResponse
  const items = requireResult(response).data || []
  const nodes = new Map(items.map(item => [item.id, { ownerId: item.id, label: item.name || item.id } as MetricNavigationNode]))
  const roots: MetricNavigationNode[] = []
  for (const item of items) {
    const node = nodes.get(item.id)!
    const parent = item.parentId && nodes.get(item.parentId)
    if (parent && parent !== node) (parent.children ||= []).push(node)
    else roots.push(node)
  }
  return { data: roots, total: items.length }
}
