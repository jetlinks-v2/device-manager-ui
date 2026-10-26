import { request } from '@jetlinks-web/core'
import { createDeviceKeywordQueryTerm } from '../deviceQueryTerms'

export interface ConnectionDeviceCandidate { id?: string; name?: string; productName?: string }

/** Connection lookup stays a small detail query: it deliberately skips list enrichment and area grouping. */
export const queryConnectionDeviceCandidates = (keyword: string, signal: AbortSignal) => request.post(
  '/device/instance/detail/_query',
  { pageIndex: 0, pageSize: 10, terms: [createDeviceKeywordQueryTerm(keyword)] },
  { signal },
)
