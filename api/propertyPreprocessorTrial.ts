import { request } from '@jetlinks-web/core'
import type { ExpressionExplanation, ExpressionFunction } from '@jetlinks-web-core/components/Expression'

export interface PropertyTrialSample {
  value: unknown
  missing?: boolean
  arrivalMillis: number
  messageTime?: string | number
  sourceTime?: string | number
  propertyState?: string
}
export interface PropertyTrialRequest {
  provider: string
  configuration: Record<string, unknown>
  samples: PropertyTrialSample[]
  previous?: { value: unknown; timeMillis: number; outcome: string }
}
export interface PropertyTrialStep {
  path: string
  provider: string
  status: 'kept' | 'processed' | 'filtered' | 'skipped' | 'error'
  value?: unknown
  explanation?: ExpressionExplanation
  recordInvalid?: boolean
}
export interface PropertyTrialPoint {
  value?: unknown
  present: boolean
  outputKnown: boolean
  steps: PropertyTrialStep[]
  intents: { path: string; action: string; conditional: boolean }[]
  error?: string
}

/** 身份由业务路径提供；所有规则节点和模拟输入一次提交，不在浏览器执行规则。 */
export async function trialPropertyRules(scope: { productId: string; deviceId?: string }, property: string,
  input: PropertyTrialRequest): Promise<PropertyTrialPoint[]> {
  const owner = scope.deviceId ? `device/${encodeURIComponent(scope.productId)}/${encodeURIComponent(scope.deviceId)}`
    : `product/${encodeURIComponent(scope.productId)}`
  const response: { result: PropertyTrialPoint[]; status?: number; message?: string } = await request.post(`/message/preprocessor/${owner}/property/${encodeURIComponent(property)}/_trial`, input, { hiddenError: true })
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}

/** 业务宿主声明函数目录地址，共享 MathLive 组件不依赖设备业务接口。 */
export async function propertyExpressionFunctions(): Promise<ExpressionFunction[]> {
  const response: { result: ExpressionFunction[]; status?: number; message?: string } = await request.get('/message/preprocessor/expression/functions', undefined, { hiddenError: true })
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}
