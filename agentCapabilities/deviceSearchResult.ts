import { clientToolResult } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import { createDomainAgentRecordSetCardinality } from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'

interface DeviceSearchPage {
  ok: boolean
  error?: string
  items?: Array<{ id: string }>
  total?: number
  pageIndex?: number
  pageSize?: number
  summary?: string
  needsOrganizationSelection?: boolean
}

/** Preserve search guidance while keeping a page, a full population and pending selection distinct. */
export const adaptDeviceSearchPage = <T extends DeviceSearchPage>(page: T) => {
  if (!page.ok) return clientToolResult.failure({
    code: 'DEVICE_SEARCH_FORBIDDEN', message: page.error || 'Device search unavailable',
    failureDisposition: 'permission/user', retryable: false,
  })
  const { items = [], summary: description, ...metadata } = page
  const total = page.total ?? items.length
  const pageIndex = page.pageIndex ?? 0
  const pageSize = page.pageSize ?? items.length
  const hasNextPage = (pageIndex + 1) * pageSize < total
  const needsSelection = page.needsOrganizationSelection === true
  const options = {
    // Lookup answers need the bounded page's labels and links even when typed outputs become opaque resources.
    summary: { ...metadata, description, items, ...(hasNextPage ? { nextPage: pageIndex + 1 } : {}) },
    cardinality: createDomainAgentRecordSetCardinality({ returnedCount: items.length, totalCount: total }),
    requestSatisfied: !hasNextPage && !needsSelection,
    exhaustive: pageIndex === 0 && !hasNextPage && !needsSelection,
    displayTruncated: hasNextPage,
    supportsAbsenceClaim: !needsSelection && pageIndex === 0 && total === 0,
  }
  return hasNextPage || needsSelection
    ? clientToolResult.partial(page, { ...options, status: needsSelection ? 'needs-selection' : 'partial' })
    : clientToolResult.success(page, { ...options, status: total === 0 ? 'empty' : 'ok' })
}
