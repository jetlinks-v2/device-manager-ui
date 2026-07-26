import {
  defineAiClientToolContract,
  withAiClientToolContractEvidence,
  type AiClientToolOutputField,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

export interface DeviceLogTimeRange {
  start?: number
  end?: number
}

interface DeviceLogRecord {
  timestamp?: unknown
}

interface DeviceLogRecordEvidenceOptions {
  range: DeviceLogTimeRange
  total: number
  returned: number
  recordCount?: number
  truncated: boolean
  reference?: string
  inlinePath?: string
  records?: DeviceLogRecord[]
}

export const DEVICE_LOG_RECORD_FIELDS: AiClientToolOutputField[] = [
  { name: 'id', semanticRole: 'identifier' },
  { name: 'timestamp', semanticRole: 'timestamp', format: 'datetime' },
  { name: 'type.value', semanticRole: 'state' },
  { name: 'type.text', semanticRole: 'category' },
  { name: 'messageId', semanticRole: 'identifier' },
]

export const DEVICE_LOG_SUMMARY_OUTPUT = {
  name: 'device-log-summary',
  shape: 'summary.counts',
} as const

export const DEVICE_LOG_RECORDS_OUTPUT = {
  name: 'device-log-records',
  shape: 'time-series.records',
} as const

export const DEVICE_LOG_SUMMARY_CONTRACT = defineAiClientToolContract({
  routingKind: 'aggregate',
  routing: {
    capabilities: ['device.log.aggregate'],
    accepts: ['device-context', 'time-range'],
    intents: ['count device log states in a requested range', '统计指定范围内的设备日志状态'],
    notFor: ['calculate state duration', 'read complete device log records'],
    evidencePolicy: 'required',
  },
  outputs: [{
    kind: 'lookup',
    name: DEVICE_LOG_SUMMARY_OUTPUT.name,
    shape: DEVICE_LOG_SUMMARY_OUTPUT.shape,
    path: '$',
  }],
})

export const DEVICE_LOG_RECORDS_CONTRACT = defineAiClientToolContract({
  routingKind: 'records',
  routing: {
    capabilities: ['device.log.records'],
    accepts: ['device-context', 'time-range'],
    intents: ['read bounded device log records', '读取有界设备日志记录'],
    notFor: ['count-only summary', 'calculate business-specific metrics'],
    evidencePolicy: 'required',
    validationHints: ['structured-output-exists'],
  },
  outputs: [{
    kind: 'state-events',
    name: DEVICE_LOG_RECORDS_OUTPUT.name,
    shape: DEVICE_LOG_RECORDS_OUTPUT.shape,
    path: '$.data',
    mediaType: 'application/json',
    delivery: 'auto',
    fields: DEVICE_LOG_RECORD_FIELDS,
  }],
})

const finite = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

const requestedRange = (range: DeviceLogTimeRange) => {
  const start = finite(range.start)
  const end = finite(range.end)
  return {
    ...(start === undefined ? {} : { start }),
    ...(end === undefined ? {} : { end }),
  }
}

const observedRange = (records: DeviceLogRecord[] = []) => {
  let start: number | undefined
  let end: number | undefined
  records.forEach((record) => {
    const timestamp = finite(record.timestamp)
    if (timestamp === undefined) return
    start = start === undefined ? timestamp : Math.min(start, timestamp)
    end = end === undefined ? timestamp : Math.max(end, timestamp)
  })
  return start === undefined || end === undefined ? undefined : { start, end }
}

const coverage = (returned: number, total: number, truncated: boolean) => ({
  complete: !truncated,
  truncated,
  returned,
  total,
  ratio: total <= 0 ? 1 : Math.min(1, returned / total),
})

export const withDeviceLogSummaryEvidence = <T extends Record<string, unknown>>(
  result: T,
  range: DeviceLogTimeRange,
) => {
  const requested = requestedRange(range)
  return withAiClientToolContractEvidence(result, DEVICE_LOG_SUMMARY_CONTRACT, {
    complete: true,
    truncated: false,
    recordCount: 1,
    ...(Object.keys(requested).length ? { requestedRange: requested } : {}),
    outputs: [{
      name: DEVICE_LOG_SUMMARY_OUTPUT.name,
      path: '$',
      mediaType: 'application/json',
      recordCount: 1,
      complete: true,
      truncated: false,
      ...(Object.keys(requested).length ? { requestedRange: requested } : {}),
      coverage: { complete: true, truncated: false },
    }],
  })
}

/**
 * Attaches the canonical records binding while keeping range coverage separate from the optional boundary record.
 */
export const withDeviceLogRecordEvidence = <T extends Record<string, unknown>>(
  result: T,
  options: DeviceLogRecordEvidenceOptions,
) => {
  const requested = requestedRange(options.range)
  const observed = observedRange(options.records)
  const evidenceCoverage = coverage(options.returned, options.total, options.truncated)
  const recordCount = options.recordCount ?? options.returned
  return withAiClientToolContractEvidence(result, DEVICE_LOG_RECORDS_CONTRACT, {
    complete: !options.truncated,
    truncated: options.truncated,
    recordCount,
    returnedCount: options.returned,
    ...(Object.keys(requested).length ? { requestedRange: requested } : {}),
    ...(observed ? { observedRange: observed } : {}),
    outputs: [{
      name: DEVICE_LOG_RECORDS_OUTPUT.name,
      ...(options.reference ? { ref: options.reference } : { path: options.inlinePath || '$.data' }),
      mediaType: options.reference ? 'application/x-ndjson' : 'application/json',
      recordCount,
      complete: !options.truncated,
      truncated: options.truncated,
      ...(Object.keys(requested).length ? { requestedRange: requested } : {}),
      ...(observed ? { observedRange: observed } : {}),
      coverage: evidenceCoverage,
    }],
  })
}
