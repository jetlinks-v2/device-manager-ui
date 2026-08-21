import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { queryProjectServiceRuntime_api } from '@device-manager-ui/api/projectRuntime'
import type { IotAddDeviceInstallProgressLog } from './useIotAddDeviceDrawer'

const QUOTA_ERROR_CODE = 'error.message.tenant.out_of_quota'
const QUOTA_ERROR_SOURCE = 'tenant_quota_limiter'
const QUOTA_ERROR_MESSAGES = new Set([
  '配额已用完，无法执行此操作',
  'quota exceeded, unable to perform this operation',
])

type UnknownRecord = Record<string, unknown>

export type IotDeviceQuotaExceededState = {
  detected: boolean
  loading: boolean
  metricName: string
  usage: number | null
  limit: number | null
  unit: string
}

type QuotaMetric = Omit<IotDeviceQuotaExceededState, 'detected' | 'loading'>

const emptyState = (): IotDeviceQuotaExceededState => ({
  detected: false,
  loading: false,
  metricName: '',
  usage: null,
  limit: null,
  unit: '',
})

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
)

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

const asNumber = (value: unknown): number | null => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const normalizeMetricId = (value: unknown): string => asText(value).replace(/\([^)]*\)$/, '').trim()

function collectErrorRecords(value: unknown, depth = 0): UnknownRecord[] {
  if (depth > 3) return []
  const record = asRecord(value)
  if (!Object.keys(record).length) return []
  const nested = ['data', 'result', 'error', 'extra', 'payload']
    .flatMap((key) => collectErrorRecords(record[key], depth + 1))
  return [record, ...nested]
}

function readQuotaSourceMetric(value: unknown): string {
  const record = asRecord(value)
  const sources = [record, asRecord(record.source), asRecord(record.sources)]
  return sources.map((source) => normalizeMetricId(source[QUOTA_ERROR_SOURCE])).find(Boolean) || ''
}

function readMetricId(record: UnknownRecord): string {
  const metricId = record.metricId
  const metric = asRecord(metricId)
  if (metric.resource && metric.metric) {
    return `${asText(metric.resource)}:${asText(metric.metric)}`
  }
  return normalizeMetricId(metricId)
}

function readQuotaError(log: IotAddDeviceInstallProgressLog): { metricId: string } | null {
  const records = collectErrorRecords(log.payload ?? log.extra)
  const sourceMetricId = records.map(readQuotaSourceMetric).find(Boolean) || ''
  const codeMatched = records.some((record) => (
    [record.code, record.errorCode, record.i18nCode].some((value) => asText(value) === QUOTA_ERROR_CODE)
  ))
  const sourceMatched = Boolean(sourceMetricId)
  const messageMatched = QUOTA_ERROR_MESSAGES.has(log.message.trim().toLowerCase())
  if (!codeMatched && !sourceMatched && !messageMatched) return null

  return {
    metricId: records.map(readMetricId).find(Boolean) || sourceMetricId,
  }
}

function unwrapResult(value: unknown): unknown {
  const record = asRecord(value)
  if (record.success === false) throw new Error(asText(record.message))
  return 'result' in record ? record.result : value
}

function matchMetricId(target: string, resource: UnknownRecord, metric: UnknownRecord): boolean {
  const metricDefinition = asRecord(metric.metric)
  const resourceId = asText(resource.id)
  const metricId = normalizeMetricId(metric.metricId) || normalizeMetricId(metricDefinition.id)
  if (!target || !metricId) return false
  return target === metricId
    || target === `${resourceId}:${metricId}`
    || (target.endsWith(`:${metricId}`) && target.startsWith(`${resourceId}:`))
}

function findRuntimeMetric(runtime: unknown, targetMetricId: string): QuotaMetric | null {
  for (const service of asArray(runtime)) {
    for (const resource of asArray(asRecord(service).resources)) {
      const resourceRecord = asRecord(resource)
      for (const metric of asArray(resourceRecord.metrics)) {
        const metricRecord = asRecord(metric)
        if (!matchMetricId(targetMetricId, resourceRecord, metricRecord)) continue
        const definition = asRecord(metricRecord.metric)
        const limit = asRecord(metricRecord.limit)
        return {
          metricName: asText(definition.name) || targetMetricId,
          usage: asNumber(metricRecord.usage),
          limit: asNumber(limit.limit ?? limit.value),
          unit: asText(limit.unit) || asText(definition.unit),
        }
      }
    }
  }
  return null
}

export function useIotDeviceQuotaExceeded(
  projectId: Ref<string>,
  logs: ComputedRef<IotAddDeviceInstallProgressLog[]>,
) {
  const state = ref<IotDeviceQuotaExceededState>(emptyState())
  let latestErrorKey = ''
  let requestId = 0

  const quotaError = computed(() => {
    const errorLog = [...logs.value].reverse().find((item) => item.type === 'error')
    return errorLog ? readQuotaError(errorLog) : null
  })

  watch([quotaError, projectId], async ([error]) => {
    if (!error) {
      // 关闭或重新发起安装后，不能让上一次异步用量查询覆盖新的弹窗状态。
      requestId += 1
      latestErrorKey = ''
      state.value = emptyState()
      return
    }

    const errorKey = `${projectId.value}:${error.metricId}`
    if (errorKey === latestErrorKey) return
    latestErrorKey = errorKey
    const currentRequestId = ++requestId
    state.value = { ...emptyState(), detected: true, loading: Boolean(error.metricId) }
    if (!error.metricId || !projectId.value) return

    try {
      const runtime = unwrapResult(await queryProjectServiceRuntime_api(projectId.value))
      if (currentRequestId !== requestId) return
      const metric = findRuntimeMetric(runtime, error.metricId)
      state.value = {
        ...state.value,
        loading: false,
        ...(metric ?? {}),
      }
    } catch {
      if (currentRequestId === requestId) state.value.loading = false
    }
  }, { immediate: true })

  return { quotaExceededState: state }
}
