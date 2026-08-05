import type { ModelVersionInfo } from '../gatewayCvModel.types'

export const DEFAULT_MODEL_PAGE_SIZE = 200

export function unwrapResult<T>(response: unknown): T | undefined {
  if (response && typeof response === 'object') {
    const body = response as { result?: T; data?: T; response?: T }
    if (body.result !== undefined) return body.result
    if (body.data !== undefined) return body.data
    if (body.response !== undefined) return body.response
  }
  return response as T
}

export function unwrapRows<T>(response: unknown): T[] {
  const root = unwrapResult<unknown>(response)
  if (Array.isArray(root)) return root
  if (root && typeof root === 'object') {
    const body = root as Record<string, unknown>
    if (Array.isArray(body.data)) return body.data as T[]
    if (Array.isArray(body.records)) return body.records as T[]
    if (Array.isArray(body.result)) return body.result as T[]
  }
  return []
}

export function unwrapNumber(response: unknown) {
  const root = unwrapResult<unknown>(response)
  const value = root && typeof root === 'object'
    ? (root as Record<string, unknown>).total ?? (root as Record<string, unknown>).count
    : root
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export function textValue(...values: unknown[]) {
  const value = values.find(item => item !== undefined && item !== null && String(item).trim())
  return value === undefined ? undefined : String(value)
}

export function emptyVersionInfo(): ModelVersionInfo {
  return { versions: [], histories: [] }
}
