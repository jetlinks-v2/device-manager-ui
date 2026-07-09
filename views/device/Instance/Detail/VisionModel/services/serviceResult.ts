export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError }

export interface ServiceError {
  code:
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_FAILED'
    | 'NETWORK'
    | 'INTERNAL'
    | 'UNAUTHORIZED'
    | 'CANCELED'
  message: string
  detail?: unknown
}

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })

export const err = (
  code: ServiceError['code'],
  message: string,
  detail?: unknown
): ServiceResult<never> => ({ ok: false, error: { code, message, detail } })
