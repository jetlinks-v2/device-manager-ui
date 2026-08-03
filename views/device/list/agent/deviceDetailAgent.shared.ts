import {
  createDomainAgentErrorResult,
  createDomainAgentInputError,
  DomainAgentInputError,
  type DomainAgentToolResult,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { extractRows } from '../services/iotDeviceDetailReal.service'

export type DeviceDetailAgentArgs = Record<string, unknown>

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

export const asRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {}
export const normalizeText = (value: unknown) => String(value || '').trim()

export const inputError = (
  code: string,
  key: string,
  params?: Record<string, string | number>,
) => createDomainAgentInputError(code, `IotDeviceDetailAgent.errors.${key}`, params)

export const unwrapResult = (value: unknown): unknown => {
  const record = asRecord(value)
  return 'result' in record ? record.result : value
}

export const pageResult = (value: unknown) => {
  const result = asRecord(unwrapResult(value))
  const data = extractRows(result) as unknown[]
  const total = Number(result.total ?? result.count ?? data.length)
  return { data, total: Number.isFinite(total) ? total : data.length }
}

export const dictValue = (value: unknown) => {
  const record = asRecord(value)
  return normalizeText(record.value || value)
}

export const dictText = (value: unknown) => {
  const record = asRecord(value)
  return normalizeText(record.text || record.name || record.label || record.value || value)
}

export const safeText = (value: unknown, maxLength = 1000) => normalizeText(value)
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
  .replace(/((?:access_token|token|authorization|auth|signature|credential|password)\s*[=:]\s*)[^\s,;&]+/gi, '$1***')
  .slice(0, maxLength)

export const safePayload = (value: unknown, maxLength = 1200) => {
  try {
    return safeText(typeof value === 'string' ? value : JSON.stringify(value), maxLength)
  } catch {
    return safeText(value, maxLength)
  }
}

/** Marks bounded representative records as model samples without reducing the summary's complete query coverage. */
export const withDeviceDetailModelSample = <T>(
  result: DomainAgentToolResult<T>,
  sampleCount: number,
): DomainAgentToolResult<T> => {
  if (!result.evidence || !Number.isFinite(sampleCount)) return result
  return {
    ...result,
    evidence: {
      ...result.evidence,
      modelSample: {
        count: Math.max(0, Math.trunc(sampleCount)),
        userVisible: false,
      },
    },
  }
}

export const runDetailTool = async <T>(
  data: T,
  action: () => Promise<DomainAgentToolResult<T>>,
): Promise<DomainAgentToolResult<T>> => {
  try {
    return await action()
  } catch (error) {
    if (error instanceof DomainAgentInputError) throw error
    return createDomainAgentErrorResult('device', data, error)
  }
}

export const enumValue = (value: unknown) => ({
  value: dictValue(value),
  text: dictText(value),
})
