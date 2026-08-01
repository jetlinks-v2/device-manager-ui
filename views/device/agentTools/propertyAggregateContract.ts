import {
  createAiClientToolArrayRecordSource,
  createAiClientToolRecordStream,
  defineAiClientToolContract,
  withAiClientToolContractEvidence,
  type AiClientToolOutputField,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import { createDevicePropertyAggregateRecordSchema } from './propertyAggregateSupport'

type JsonRecord = Record<string, unknown>

export interface DevicePropertyAggregateTimeRange {
  start?: number
  end?: number
}

export const DEVICE_PROPERTY_AGGREGATE_OUTPUT = {
  name: 'device-property-aggregate-series',
  shape: 'time-series.aggregate',
} as const

export const DEVICE_PROPERTY_AGGREGATE_CONTRACT = defineAiClientToolContract({
  routingKind: 'aggregate',
  routing: {
    capabilities: ['device.property.aggregate'],
    accepts: ['device-context', 'property-selector', 'time-range'],
    intents: [
      'aggregate device property values into bounded time series',
      '按时间桶聚合设备属性形成有界趋势',
    ],
    notFor: [
      'infer duration from event counts',
      'read unbounded raw property history',
    ],
    evidencePolicy: 'required',
    validationHints: ['structured-output-exists'],
  },
  outputs: [{
    kind: 'aggregate-series',
    name: DEVICE_PROPERTY_AGGREGATE_OUTPUT.name,
    shape: DEVICE_PROPERTY_AGGREGATE_OUTPUT.shape,
    path: '$.data.sample',
    mediaType: 'application/json',
    delivery: 'auto',
    fields: [{ name: 'time', semanticRole: 'timestamp', format: 'datetime' }],
  }],
})

const asRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
)

const finiteTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const timestamp = new Date(String(value || '')).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const observedRange = (data: JsonRecord[]) => {
  let start: number | undefined
  let end: number | undefined
  data.forEach((item) => {
    const timestamp = finiteTimestamp(item.time)
    if (timestamp === undefined) return
    start = start === undefined ? timestamp : Math.min(start, timestamp)
    end = end === undefined ? timestamp : Math.max(end, timestamp)
  })
  return start === undefined || end === undefined ? undefined : { start, end }
}

const fileReference = (result: JsonRecord) => String(
  result.uri || result.fileRef || result.contentRef || asRecord(result.file).uri || '',
).trim()

/** Attaches complete/partial coverage without reconstructing output identity at the business entry point. */
export const withDevicePropertyAggregateEvidence = (
  result: JsonRecord,
  range: DevicePropertyAggregateTimeRange,
  data: JsonRecord[],
  inlineReturned: number,
  fields: AiClientToolOutputField[],
) => {
  const ref = fileReference(result)
  const observed = observedRange(data)
  const complete = ref ? result.truncated !== true : inlineReturned >= data.length && result.truncated !== true
  const returned = ref ? data.length : inlineReturned
  const coverage = {
    complete,
    truncated: !complete,
    returned,
    total: data.length,
    ratio: data.length ? Math.min(1, returned / data.length) : 1,
  }
  return withAiClientToolContractEvidence(result, DEVICE_PROPERTY_AGGREGATE_CONTRACT, {
    requestedRange: range,
    observedRange: observed,
    recordCount: data.length,
    returnedCount: returned,
    complete,
    truncated: !complete,
    resultStatus: data.length ? (complete ? 'ok' : 'partial') : 'empty',
    evidenceCoverage: ref ? 'materialized-complete-result' : 'bounded-inline-result',
    outputs: [{
      name: DEVICE_PROPERTY_AGGREGATE_OUTPUT.name,
      ...(ref ? { ref } : { path: '$.data' }),
      mediaType: ref ? 'application/x-ndjson' : 'application/json',
      recordCount: data.length,
      complete,
      truncated: !complete,
      fields,
      requestedRange: range,
      ...(observed ? { observedRange: observed } : {}),
      coverage,
    }],
  })
}

/** Uses the generic delivery lifecycle so weak models do not need to invent a writeToPath argument. */
export const createDevicePropertyAggregateRecordStream = (
  data: JsonRecord[],
  fields: AiClientToolOutputField[],
  range: DevicePropertyAggregateTimeRange,
  summary: JsonRecord,
  inlineLimit: number,
) => createAiClientToolRecordStream({
  source: createAiClientToolArrayRecordSource(data),
  schema: createDevicePropertyAggregateRecordSchema(fields),
  bindingName: DEVICE_PROPERTY_AGGREGATE_OUTPUT.name,
  outputShape: DEVICE_PROPERTY_AGGREGATE_OUTPUT.shape,
  timeRange: range,
  summary,
  limits: {
    fallbackSampleLimit: Math.min(20, inlineLimit),
    previewLimit: Math.min(3, inlineLimit),
  },
})
