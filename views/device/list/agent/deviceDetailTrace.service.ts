import {
  createDomainAgentErrorResult,
  createDomainAgentInputError,
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentMessage,
  resolveDomainAgentInteger,
  type DomainAgentToolResult,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { subscribeDeviceTrace } from '../services/iotDeviceDetailReal.service'

type TraceSample = Record<string, unknown>
type TraceFinalizeReason = 'timeout' | 'limit' | 'disposed'

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const normalizeText = (value: unknown) => String(value || '').trim()

const sanitizeText = (value: unknown, maxLength = 300) => normalizeText(value)
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
  .replace(/((?:access_token|token|authorization|auth|signature)\s*[=:]\s*)[^\s,;&]+/gi, '$1***')
  .slice(0, maxLength)

const toTraceSample = (value: unknown): TraceSample => {
  const row = asRecord(value)
  const type = normalizeText(row.type || row.name)
  const operation = normalizeText(row.operation)
  const logLevel = normalizeText(row.logLevel || row.log_level || row.level)
  const traceId = normalizeText(row.traceId || row.trace_id)
  const messageId = normalizeText(row.messageId || row.message_id)
  const message = sanitizeText(row.message || row.reason)
  return Object.fromEntries(Object.entries({
    type: type || undefined,
    operation: operation || undefined,
    logLevel: logLevel || undefined,
    traceId: traceId || undefined,
    messageId: messageId || undefined,
    message: message || undefined,
    startTime: row.startTime,
    endTime: row.endTime,
    error: row.error === true || logLevel.toLowerCase() === 'error',
    direction: row.upstream === true ? 'upstream' : row.downstream === true ? 'downstream' : undefined,
  }).filter(([, item]) => item !== undefined))
}

/** Owns the single bounded trace subscription for one device-detail subject. */
export const createDeviceDetailTraceService = (deviceId: string) => {
  let activeFinalize: ((reason: TraceFinalizeReason) => void) | undefined

  const capture = (args: Record<string, unknown>): Promise<DomainAgentToolResult<TraceSample[]>> => {
    if (activeFinalize) {
      throw createDomainAgentInputError(
        'DEVICE_TRACE_ALREADY_RUNNING',
        'IotDeviceDetailAgent.errors.traceAlreadyRunning',
      )
    }
    const seconds = resolveDomainAgentInteger(args.seconds, {
      name: 'seconds',
      defaultValue: 15,
      min: 1,
      max: 60,
    })
    const maxEvents = resolveDomainAgentInteger(args.maxEvents, {
      name: 'maxEvents',
      defaultValue: 50,
      min: 1,
      max: 100,
    })
    const startedAt = Date.now()

    return new Promise((resolve) => {
      const samples: TraceSample[] = []
      const distribution: Record<string, number> = {}
      let errorCount = 0
      let finished = false
      let subscription: { unsubscribe: () => void } | undefined
      let timer: ReturnType<typeof window.setTimeout> | undefined

      const finish = (reason: TraceFinalizeReason) => {
        if (finished) return
        finished = true
        if (timer) window.clearTimeout(timer)
        subscription?.unsubscribe()
        activeFinalize = undefined
        const endedAt = Date.now()
        resolve(createDomainAgentToolResult({
          domain: 'device',
          status: reason === 'disposed' ? 'partial' : undefined,
          timeRange: { start: startedAt, end: endedAt, label: 'trace' },
          summary: {
            deviceId,
            captured: samples.length,
            errorCount,
            distribution,
            reason,
          },
          data: samples,
          total: samples.length,
          cardinality: createDomainAgentRecordSetCardinality({ returnedCount: samples.length }),
          truncated: reason === 'limit',
          warnings: reason === 'disposed'
            ? [resolveDomainAgentMessage('IotDeviceDetailAgent.warnings.traceDisposed')]
            : undefined,
        }))
      }

      activeFinalize = finish
      try {
        subscription = subscribeDeviceTrace(deviceId, (value) => {
          if (finished) return
          const sample = toTraceSample(value)
          const key = normalizeText(sample.operation || sample.type) || 'unknown'
          distribution[key] = (distribution[key] || 0) + 1
          if (sample.error === true) errorCount += 1
          samples.push(sample)
          if (samples.length >= maxEvents) finish('limit')
        })
        if (!subscription) {
          activeFinalize = undefined
          resolve(createDomainAgentErrorResult('device', [], { code: 'DEVICE_TRACE_SUBSCRIPTION_UNAVAILABLE' }, {
            deviceId,
          }))
          return
        }
        if (finished) {
          subscription.unsubscribe()
          return
        }
        timer = window.setTimeout(() => finish('timeout'), seconds * 1000)
      } catch (error) {
        activeFinalize = undefined
        resolve(createDomainAgentErrorResult('device', [], error, { deviceId }))
      }
    })
  }

  const dispose = () => activeFinalize?.('disposed')

  return { capture, dispose }
}
