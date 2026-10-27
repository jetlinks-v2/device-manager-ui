import { request } from '@jetlinks-web/core'
import { createDeviceKeywordQueryTerm } from '../deviceQueryTerms'

export interface ConnectionDeviceCandidate { id?: string; name?: string; productName?: string }
export const connectionDevicePageSize = 12

/** 无 count 的轻量候选查询；稳定排序用于下拉分页，不执行详情补全。 */
export const queryConnectionDeviceCandidates = (keyword: string, signal: AbortSignal, pageIndex = 0) => request.post(
  '/device/instance/_query/no-paging',
  { paging: true, pageIndex, pageSize: connectionDevicePageSize, includes: ['id', 'name', 'productName'], sorts: [{ name: 'id', order: 'asc' }], terms: [createDeviceKeywordQueryTerm(keyword)] },
  { signal },
)
