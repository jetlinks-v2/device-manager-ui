import { request } from '@jetlinks-web/core'
import type { RuleScope } from '../service'
import type { RuleStatisticsSnapshot } from './model'

export class StatisticsQueryError extends Error {
  constructor(public readonly kind: 'unavailable' | 'forbidden' | 'failed') { super(kind) }
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const counters = ['input', 'output', 'cleaned', 'sampled', 'bypassed', 'errors'] as const

/** Do not turn missing/malformed snapshots into zero traffic or a healthy rule. */
function isSnapshot(value: unknown): value is RuleStatisticsSnapshot {
  return object(value) && ['ruleId', 'property', 'nodeId'].every(key => typeof value[key] === 'string' && !!value[key])
    && (!value.loaded || typeof value.generation === 'string' && !!value.generation)
    && typeof value.loaded === 'boolean' && Number.isFinite(value.startedAt) && Number.isFinite(value.sampledAt)
    && counters.every(key => value.loaded ? typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0 : value[key] == null)
}

function queryError(error: unknown) {
  if (error instanceof StatisticsQueryError) return error
  const response = object(error) && object(error.response) ? error.response : error
  const status = object(response) ? Number(response.status ?? response.code) : 0
  const data = object(response) && object(response.data) ? response.data : response
  const unsupported = object(data) && data.code === 'method_not_allowed'
  return new StatisticsQueryError(status === 404 || status === 405 || unsupported ? 'unavailable' : status === 403 || status === 401 ? 'forbidden' : 'failed')
}

/** The controller accepts property IDs (not rule IDs), with a hard maximum of 100. */
export async function queryRuleStatistics(scope: RuleScope, source: 'product' | 'device', properties: string[], nodeId?: string): Promise<RuleStatisticsSnapshot[]> {
  if (!properties.length || properties.length > 100) throw new StatisticsQueryError('failed')
  if (source === 'device' && !scope.deviceId) throw new StatisticsQueryError('failed')
  const product = encodeURIComponent(scope.productId)
  const owner = source === 'device' && scope.deviceId ? `device/${product}/${encodeURIComponent(scope.deviceId)}` : `product/${product}`
  try {
    const response: unknown = await request.post(`/message/preprocessor/${owner}/property/_statistics`, properties,
      { params: nodeId ? { nodeId } : undefined, timeout: 10000, hiddenError: true })
    if (object(response) && (response.success === false || Number(response.status) >= 400)) throw queryError(response)
    const rows = object(response) && 'result' in response ? response.result : response
    if (!Array.isArray(rows) || rows.length !== properties.length || !rows.every(isSnapshot)
      || new Set(rows.map(row => row.property)).size !== properties.length
      || rows.some(row => !properties.includes(row.property) || nodeId && row.nodeId !== nodeId)
      || new Set(rows.map(row => row.nodeId)).size !== 1) throw new StatisticsQueryError('failed')
    return rows
  } catch (error) { throw queryError(error) }
}
