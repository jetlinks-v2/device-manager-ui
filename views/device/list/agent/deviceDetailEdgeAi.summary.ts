export const AI_REVIEW_MBEAN_NAME = 'org.jetlinks:type=MonitorMetric,name=AgentRuntimeReview'
export const AI_CV_MBEAN_NAME = 'org.jetlinks:type=MonitorMetric,name=ZLMediaAiTask'

const ABNORMAL_LIMIT = 5
const HIGHLIGHT_LIMIT = 5
const NOT_FOUND_ID_LIMIT = 5
const RESULT_SUMMARY_LIMIT = 160
const ERROR_MESSAGE_LIMIT = 160
const REJECT_REASON_LIMIT = 80
const JVM_RUNTIME_DROP_KEYS = new Set([
  'classpath',
  'systemproperties',
  'inputarguments',
])
const HEALTHY_CV_STATUS = new Set(['running', 'ok', 'normal'])

export type CompactAiError = {
  message: string
  status?: unknown
  code?: unknown
}

export type CompactAiSide<T> =
  | ({ ok: true } & T)
  | { ok: false; error: CompactAiError }

export type CompactReviewQueue = {
  pending?: number
  running?: number
  workers?: number
  overloaded?: boolean
  rejectedTotal?: number
  maxBacklog?: number
  lastRejectReason?: string
}

export type CompactReviewMetrics = {
  collectedAt?: unknown
  queues: Record<string, CompactReviewQueue>
  statistics: {
    backlogCount?: number
    runningCount?: number
    activeCount?: number
    completedCount?: number
    failedCount?: number
    queueStatus?: unknown
    duration?: {
      averageMs?: number
      p95Ms?: number
      sampleCount?: number
    }
  }
  taskQuery: {
    limit?: number
    count?: number
    scanned?: number
    reviewCount?: number
  }
  byStatus: Record<string, number>
  byReviewStatus: Record<string, number>
  abnormal: Array<{
    threadId?: unknown
    reviewSourceId?: unknown
    status?: unknown
    reviewStatus?: unknown
    partialFailure?: boolean
    routedSkill?: unknown
    hit?: number
    resultSummary?: string
  }>
}

export type CompactCvMetrics = {
  collectedAt?: unknown
  taskCount: number
  notFoundCount: number
  notFoundIds: string[]
  byStatus: Record<string, number>
  highlights: Array<{
    taskKey?: unknown
    status?: unknown
    runningTime?: unknown
    inferenceTotal?: number
    hitTotal?: number
    slotRejectTotal?: number
    latencyP95?: number
    diagnostics?: {
      status?: unknown
      statusReason?: unknown
      lastErrorStage?: unknown
      lastErrorMessage?: string
      taskFaultNode?: unknown
      taskFaultReason?: unknown
    }
  }>
}

const isRecord = (value: unknown): value is Record<string, any> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : [])

const toSnake = (name: string) => name.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`)

const readField = (source: Record<string, any> | undefined, ...names: string[]) => {
  if (!source) return undefined
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null) return source[name]
    const snaked = toSnake(name)
    if (source[snaked] !== undefined && source[snaked] !== null) return source[snaked]
    const matched = Object.keys(source).find((key) => {
      const lower = key.toLowerCase().replace(/_/g, '')
      return lower === name.toLowerCase().replace(/_/g, '')
        || lower === snaked.toLowerCase().replace(/_/g, '')
    })
    if (matched && source[matched] !== undefined && source[matched] !== null) {
      return source[matched]
    }
  }
  return undefined
}

const readNumber = (source: Record<string, any> | undefined, ...names: string[]) => {
  const value = Number(readField(source, ...names))
  return Number.isFinite(value) ? value : undefined
}

const truncateText = (value: unknown, max: number) => {
  if (value === undefined || value === null) return undefined
  const text = String(value)
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const normalizeStatus = (value: unknown) => String(value || '').trim().toLowerCase()

const parseMetrics = (value: unknown): Record<string, any> | undefined => {
  if (typeof value === 'string') {
    try {
      return parseMetrics(JSON.parse(value))
    } catch {
      return undefined
    }
  }
  return isRecord(value) ? value : undefined
}

const looksLikeMetrics = (value: Record<string, any> | undefined) => (
  !!value && [
    'tasks',
    'queues',
    'collectedAt',
    'collected_at',
    'statistics',
    'notFound',
    'not_found',
    'samples',
    'reviewTaskBindings',
    'review_task_bindings',
  ].some(key => value[key] !== undefined)
)

export const readMetricsPayload = (attributes: Record<string, any> | undefined) => {
  const nested = parseMetrics(readField(attributes, 'Metrics', 'metrics'))
  if (nested) return nested
  return looksLikeMetrics(attributes) ? attributes : undefined
}

export const isMonitorMetricType = (type?: unknown) => (
  String(type || '').trim().toLowerCase() === 'monitormetric'
)

export const isKnownAiMonitorName = (name?: unknown) => {
  const raw = String(name || '')
  return /name=AgentRuntimeReview\b/i.test(raw)
    || /name=ZLMediaAiTask\b/i.test(raw)
    || raw === 'AgentRuntimeReview'
    || raw === 'ZLMediaAiTask'
}

export const isMonitorMetricBean = (type?: unknown, name?: unknown) => (
  isMonitorMetricType(type) || isKnownAiMonitorName(name)
)

const isJvmRuntimeBean = (type?: unknown, name?: unknown) => (
  String(type || '').trim().toLowerCase() === 'runtime'
  || /type=Runtime\b/i.test(String(name || ''))
)

const omitAtKeys = (attributes: Record<string, any>) => (
  Object.entries(attributes).reduce<Record<string, any>>((result, [key, value]) => {
    if (!key.startsWith('@')) result[key] = value
    return result
  }, {})
)

export const dropJvmRuntimeNoise = (
  type: unknown,
  name: unknown,
  attributes: Record<string, any> = {},
) => {
  const next = omitAtKeys(attributes)
  if (!isJvmRuntimeBean(type, name)) return next
  return Object.entries(next).reduce<Record<string, any>>((result, [key, value]) => {
    if (!JVM_RUNTIME_DROP_KEYS.has(key.toLowerCase())) result[key] = value
    return result
  }, {})
}

const countBy = (items: any[], reader: (item: any) => unknown) => (
  items.reduce<Record<string, number>>((result, item) => {
    const key = String(reader(item) || 'unknown') || 'unknown'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
)

const looksFailed = (value: unknown) => {
  const status = normalizeStatus(value)
  return status.includes('fail') || status === 'error'
}

const isCompletedZeroHit = (task: Record<string, any>) => (
  normalizeStatus(readField(task, 'status')) === 'completed'
  && Number(readField(task, 'hit') || 0) === 0
)

export const isReviewAbnormalTask = (task: unknown) => {
  if (!isRecord(task)) return false
  if (isCompletedZeroHit(task)) return false
  const status = readField(task, 'status')
  const reviewStatus = normalizeStatus(readField(task, 'reviewStatus', 'review_status'))
  const partialFailure = readField(task, 'partialFailure', 'partial_failure') === true
  return partialFailure
    || reviewStatus === 'llm_failed'
    || reviewStatus === 'failed'
    || looksFailed(status)
}

const compactQueue = (queue: unknown): CompactReviewQueue => {
  const source = isRecord(queue) ? queue : {}
  const compact: CompactReviewQueue = {
    pending: readNumber(source, 'pending'),
    running: readNumber(source, 'running'),
    workers: readNumber(source, 'workers'),
    overloaded: readField(source, 'overloaded') === undefined
      ? undefined
      : Boolean(readField(source, 'overloaded')),
    rejectedTotal: readNumber(source, 'rejectedTotal', 'rejected_total'),
  }
  const maxBacklog = readNumber(source, 'maxBacklog', 'max_backlog')
  if (maxBacklog !== undefined) compact.maxBacklog = maxBacklog
  const reason = truncateText(readField(source, 'lastRejectReason', 'last_reject_reason'), REJECT_REASON_LIMIT)
  if (reason) compact.lastRejectReason = reason
  return compact
}

const readQueueEntries = (queues: unknown): Array<[string, CompactReviewQueue]> => {
  if (Array.isArray(queues)) {
    return queues.map((item, index) => [
      String(readField(isRecord(item) ? item : {}, 'name', 'key') || index),
      compactQueue(item),
    ])
  }
  if (isRecord(queues)) {
    return Object.entries(queues).map(([name, queue]) => [name, compactQueue(queue)])
  }
  return []
}

const compactDuration = (duration: unknown) => {
  if (!isRecord(duration)) return undefined
  return {
    averageMs: readNumber(duration, 'averageMs', 'average_ms'),
    p95Ms: readNumber(duration, 'p95Ms', 'p95_ms'),
    sampleCount: readNumber(duration, 'sampleCount', 'sample_count'),
  }
}

export const compactReviewMetrics = (metrics: unknown): CompactReviewMetrics | undefined => {
  const source = parseMetrics(metrics)
  if (!source) return undefined
  const tasks = asArray(readField(source, 'tasks'))
  const statistics = isRecord(readField(source, 'statistics')) ? readField(source, 'statistics') : {}
  const taskQuery = isRecord(readField(source, 'taskQuery', 'task_query'))
    ? readField(source, 'taskQuery', 'task_query')
    : {}
  return {
    collectedAt: readField(source, 'collectedAt', 'collected_at'),
    queues: Object.fromEntries(readQueueEntries(readField(source, 'queues'))),
    statistics: {
      backlogCount: readNumber(statistics, 'backlogCount', 'backlog_count'),
      runningCount: readNumber(statistics, 'runningCount', 'running_count'),
      activeCount: readNumber(statistics, 'activeCount', 'active_count'),
      completedCount: readNumber(statistics, 'completedCount', 'completed_count'),
      failedCount: readNumber(statistics, 'failedCount', 'failed_count'),
      queueStatus: readField(statistics, 'queueStatus', 'queue_status'),
      duration: compactDuration(readField(statistics, 'duration')),
    },
    taskQuery: {
      limit: readNumber(taskQuery, 'limit'),
      count: readNumber(taskQuery, 'count'),
      scanned: readNumber(taskQuery, 'scanned'),
      reviewCount: readNumber(taskQuery, 'reviewCount', 'review_count'),
    },
    byStatus: countBy(tasks, item => readField(isRecord(item) ? item : {}, 'status')),
    byReviewStatus: countBy(tasks, item => readField(isRecord(item) ? item : {}, 'reviewStatus', 'review_status')),
    abnormal: tasks.filter(isReviewAbnormalTask).slice(0, ABNORMAL_LIMIT).map((task) => {
      const item = isRecord(task) ? task : {}
      return {
        threadId: readField(item, 'threadId', 'thread_id'),
        reviewSourceId: readField(item, 'reviewSourceId', 'review_source_id'),
        status: readField(item, 'status'),
        reviewStatus: readField(item, 'reviewStatus', 'review_status'),
        partialFailure: readField(item, 'partialFailure', 'partial_failure') === true,
        routedSkill: readField(item, 'routedSkill', 'routed_skill'),
        hit: readNumber(item, 'hit'),
        resultSummary: truncateText(readField(item, 'resultSummary', 'result_summary'), RESULT_SUMMARY_LIMIT),
      }
    }),
  }
}

const readIds = (value: unknown) => asArray(value).map((item) => {
  if (typeof item === 'string' || typeof item === 'number') return String(item)
  if (!isRecord(item)) return ''
  return String(readField(item, 'id', 'taskKey', 'task_key') || '')
}).filter(Boolean)

const hasPrefixedValue = (source: Record<string, any> | undefined, prefixes: string[]) => {
  if (!source) return false
  return Object.entries(source).some(([key, value]) => {
    if (value === undefined || value === null || value === '') return false
    const compactKey = key.toLowerCase().replace(/_/g, '')
    return prefixes.some(prefix => compactKey.startsWith(prefix))
  })
}

export const isCvHighlightTask = (task: unknown) => {
  if (!isRecord(task)) return false
  const status = normalizeStatus(readField(task, 'status'))
  const diagnostics = isRecord(readField(task, 'diagnostics')) ? readField(task, 'diagnostics') : undefined
  const diagnosticsStatus = readField(diagnostics, 'status')
  return !HEALTHY_CV_STATUS.has(status)
    || looksFailed(diagnosticsStatus)
    || hasPrefixedValue(task, ['lasterror', 'taskfault'])
    || hasPrefixedValue(diagnostics, ['lasterror', 'taskfault'])
}

export const compactCvMetrics = (metrics: unknown): CompactCvMetrics | undefined => {
  const source = parseMetrics(metrics)
  if (!source) return undefined
  const tasks = asArray(readField(source, 'tasks'))
  const notFoundIds = readIds(readField(source, 'notFound', 'not_found'))
  return {
    collectedAt: readField(source, 'collectedAt', 'collected_at'),
    taskCount: tasks.length,
    notFoundCount: notFoundIds.length,
    notFoundIds: notFoundIds.slice(0, NOT_FOUND_ID_LIMIT),
    byStatus: countBy(tasks, item => readField(isRecord(item) ? item : {}, 'status')),
    highlights: tasks.filter(isCvHighlightTask).slice(0, HIGHLIGHT_LIMIT).map((task) => {
      const item = isRecord(task) ? task : {}
      const diagnostics = isRecord(readField(item, 'diagnostics')) ? readField(item, 'diagnostics') : undefined
      const compactDiagnostics = diagnostics
        ? {
          status: readField(diagnostics, 'status'),
          statusReason: readField(diagnostics, 'statusReason', 'status_reason'),
          lastErrorStage: readField(diagnostics, 'lastErrorStage', 'last_error_stage'),
          lastErrorMessage: truncateText(
            readField(diagnostics, 'lastErrorMessage', 'last_error_message'),
            ERROR_MESSAGE_LIMIT,
          ),
          taskFaultNode: readField(diagnostics, 'taskFaultNode', 'task_fault_node'),
          taskFaultReason: readField(diagnostics, 'taskFaultReason', 'task_fault_reason'),
        }
        : undefined
      return {
        taskKey: readField(item, 'taskKey', 'task_key'),
        status: readField(item, 'status'),
        runningTime: readField(item, 'runningTime', 'running_time'),
        inferenceTotal: readNumber(item, 'inferenceTotal', 'inference_total', 'inferenceCount', 'inference_count'),
        hitTotal: readNumber(item, 'hitTotal', 'hit_total'),
        slotRejectTotal: readNumber(item, 'slotRejectTotal', 'slot_reject_total'),
        latencyP95: readNumber(item, 'latencyP95', 'latency_p95', 'inferenceLatencyP95')
          ?? readNumber(diagnostics, 'latencyP95', 'latency_p95'),
        diagnostics: compactDiagnostics,
      }
    }),
  }
}

const compactUnknownMonitorMetrics = (metrics: unknown) => {
  const source = parseMetrics(metrics)
  if (!source) return undefined
  const tasks = asArray(readField(source, 'tasks'))
  return {
    collectedAt: readField(source, 'collectedAt', 'collected_at'),
    taskCount: tasks.length,
    sampleCount: asArray(readField(source, 'samples')).length,
    queueCount: isRecord(readField(source, 'queues'))
      ? Object.keys(readField(source, 'queues')).length
      : asArray(readField(source, 'queues')).length,
  }
}

export const compactMetricsByName = (name: unknown, metrics: unknown) => {
  const raw = String(name || '')
  if (/AgentRuntimeReview/i.test(raw)) return compactReviewMetrics(metrics)
  if (/ZLMediaAiTask/i.test(raw)) return compactCvMetrics(metrics)
  return compactUnknownMonitorMetrics(metrics)
}

export const compactMonitorMetricAttributes = (
  name: unknown,
  attributes: Record<string, any> = {},
) => {
  const metrics = readMetricsPayload(attributes)
  return {
    Metrics: compactMetricsByName(name, metrics),
  }
}

export const compactMBeanAttributes = (
  type: unknown,
  name: unknown,
  attributes: Record<string, any> = {},
) => {
  const prepared = dropJvmRuntimeNoise(type, name, attributes)
  if (isMonitorMetricBean(type, name)) {
    return compactMonitorMetricAttributes(name, prepared)
  }
  return prepared
}

export const toCompactAiSide = <T>(
  compact: T | undefined,
  error?: CompactAiError,
): CompactAiSide<T> => {
  if (!compact) {
    return {
      ok: false,
      error: error || { message: 'missing' },
    }
  }
  return { ok: true, ...compact }
}

export const readAiMetricsFromMBeanData = (data: unknown) => {
  const beans: Array<{ type: string; name: string; attributes: Record<string, any> }> = []
  Object.entries(isRecord(data) ? data : {}).forEach(([ , domainValue]) => {
    Object.entries(isRecord(domainValue) ? domainValue : {}).forEach(([type, typeValue]) => {
      Object.entries(isRecord(typeValue) ? typeValue : {}).forEach(([name, attributes]) => {
        beans.push({
          type,
          name,
          attributes: isRecord(attributes) ? attributes : {},
        })
      })
    })
  })
  const bean = beans.find(item => isMonitorMetricBean(item.type, item.name)) || beans[0]
  return bean ? readMetricsPayload(bean.attributes) : readMetricsPayload(isRecord(data) ? data : undefined)
}
