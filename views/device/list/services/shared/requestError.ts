type RequestError = {
  status?: unknown
  data?: { status?: unknown }
  response?: { status?: unknown; data?: { status?: unknown } }
}

/**
 * 请求库与运行时代理可能将 HTTP 状态码序列化为字符串；统一识别 403，避免业务抽屉重复展示 Axios 原始错误。
 */
export function isForbiddenRequest(error: unknown): boolean {
  const source = error && typeof error === 'object' ? error as RequestError : {}
  const statuses = [source.response?.status, source.status, source.response?.data?.status, source.data?.status]

  return statuses.some((status) => Number(status) === 403)
}
