import type { DeviceQueryTerm } from './device-library/types'

export const DEVICE_FUZZY_TERM_TYPE = 'like$ignoreCase'

const baseTermType = (termType: unknown) => String(termType || '').split('$', 1)[0]

export const isLikeQueryTermType = (termType: unknown) => (
  ['like', 'nlike'].includes(baseTermType(termType))
)

export const normalizeDeviceLikeValue = (value: unknown) => {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || text.includes('%')) return text
  return `%${text}%`
}

export const createDeviceIgnoreCaseLikeTerm = (
  column: string,
  value: unknown,
  type?: string,
): DeviceQueryTerm => ({
  column,
  termType: DEVICE_FUZZY_TERM_TYPE,
  value: normalizeDeviceLikeValue(value),
  type,
})

/**
 * Builds the canonical fuzzy device keyword scope from fields supported by the device query endpoint.
 * Authentication identifiers belong to the principal table and must not be emitted as instance columns.
 */
export const createDeviceKeywordQueryTerm = (value: unknown, type?: string): DeviceQueryTerm => ({
  type,
  terms: [
    createDeviceIgnoreCaseLikeTerm('name', value),
    createDeviceIgnoreCaseLikeTerm('id', value, 'or'),
    createDeviceIgnoreCaseLikeTerm('productName', value, 'or'),
    {
      column: 'productId$product-info',
      value: [createDeviceIgnoreCaseLikeTerm('manufacturer', value)],
      type: 'or',
    },
    {
      column: 'productId$product-info',
      value: [createDeviceIgnoreCaseLikeTerm('model', value)],
      type: 'or',
    },
  ],
})

const normalizeDeviceQueryTerm = (term: DeviceQueryTerm): DeviceQueryTerm => {
  const queryTerm = { ...term }
  delete queryTerm.skipKeywordExpand

  if (Array.isArray(term.terms)) {
    return {
      ...queryTerm,
      terms: term.terms.map(normalizeDeviceQueryTerm),
    }
  }

  if (isLikeQueryTermType(term.termType)) {
    queryTerm.value = normalizeDeviceLikeValue(term.value)
  }
  return queryTerm
}

/**
 * Normalizes wildcard values and expands only a top-level legacy name keyword.
 * Explicit nested groups already define their own scope and must not be expanded again.
 */
export const prepareDeviceQueryTerm = (term: DeviceQueryTerm): DeviceQueryTerm => {
  if (Array.isArray(term.terms)) {
    return normalizeDeviceQueryTerm(term)
  }

  const normalized = normalizeDeviceQueryTerm(term)
  if (
    !term.skipKeywordExpand
    && term.column === 'name'
    && baseTermType(term.termType) === 'like'
    && typeof term.value === 'string'
  ) {
    return createDeviceKeywordQueryTerm(normalized.value, term.type)
  }
  return normalized
}
