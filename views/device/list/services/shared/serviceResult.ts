/**
 * ServiceResult<T> —— 所有 service 方法的统一返回模型
 *
 * service-layer.md §补强条款 v1 #1:不 throw,走 discriminated union。
 * composable / page 层 if (!result.ok) 处理错误,或解构 result.data 用值。
 *
 * Future API:HTTP 适配器将 statusCode → ServiceError.code,
 *   2xx body → { ok: true, data }
 *   4xx/5xx body 或 network error → { ok: false, error: { code, message, detail? } }
 */

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError }

export interface ServiceError {
  /**
   * 机器可读 code,跟未来 HTTP 状态对齐:
   *   NOT_FOUND / CONFLICT / VALIDATION_FAILED / NETWORK / INTERNAL / UNAUTHORIZED / CANCELED
   */
  code:
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_FAILED'
    | 'NETWORK'
    | 'INTERNAL'
    | 'UNAUTHORIZED'
    | 'CANCELED'
  /** 给用户看的中文错误描述 */
  message: string
  /** 调试用,生产可截断 */
  detail?: unknown
}

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
export const err = (
  code: ServiceError['code'],
  message: string,
  detail?: unknown
): ServiceResult<never> => ({ ok: false, error: { code, message, detail } })
