import { getPropertiesInfo } from '../../../../api/instance'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceDetailRecord = Record<string, any>
type TranslateFn = (key: string, params?: Record<string, any>) => string

interface DeviceClientToolContext {
  device: DeviceDetailRecord
}

interface ResolvedTimeRange {
  start?: number
  end?: number
}

type PropertyAggregate = 'AVG' | 'MAX' | 'MIN' | 'COUNT' | 'FIRST' | 'LAST' | 'DISTINCT_COUNT'

interface PropertyAggregateToolDependencies {
  t: TranslateFn
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
  asArray: <T = any>(value: unknown) => T[]
  responseResult: (response: any) => any
  resolveTimeRange: (args: Record<string, any>) => ResolvedTimeRange
  describeResolvedTimeRange: (range: ResolvedTimeRange) => Record<string, any> | undefined
  dataTypeText: (valueType: any) => string
  compactInlineValue: (value: unknown, maxLength?: number) => unknown
  stringifyToolResult: (value: unknown) => string
  withWriteToPathInput: (inputs: any[]) => any[]
  writeToolResultToSessionFile: (
    args: Record<string, any>,
    call: AiClientToolCall,
    result: Record<string, any>,
    options?: {
      content?: string
      summary?: Record<string, any>
    }
  ) => Promise<any> | any
  writeRecordsToSessionFile: <T = any>(
    args: Record<string, any>,
    call: AiClientToolCall,
    records: T[]
  ) => Promise<any> | any
  timeRangeInput: () => Record<string, any>
  startTimeDescription: string
  endTimeDescription: string
  getDeviceId: (context: DeviceClientToolContext) => string
  getMetadata: (context: DeviceClientToolContext) => Record<string, any>
}

const PROPERTY_AGGREGATES = new Set<PropertyAggregate>(['AVG', 'MAX', 'MIN', 'COUNT', 'FIRST', 'LAST', 'DISTINCT_COUNT'])
const NUMERIC_REQUIRED_AGGREGATES = new Set<PropertyAggregate>(['AVG', 'MAX', 'MIN'])
const NUMERIC_PROPERTY_VALUE_TYPES = new Set(['int', 'float', 'double', 'long', 'number', 'integer', 'short', 'byte'])
const AGGREGATE_DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000
const AGGREGATE_INTERVALS = new Set(['1m', '1h', '1d', '1w', '1M'])

const normalizePropertyIds = (args: Record<string, any>) => {
  const rawValues: unknown[] = []
  const append = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }
    if (value === undefined || value === null || value === '') return
    rawValues.push(value)
  }
  append(args.propertyId ?? args.property)
  append(args.propertyIds ?? args.properties)

  return Array.from(new Set(
    rawValues
      .flatMap((value) => String(value).split(/[\s,，、]+/))
      .map((value) => value.trim())
      .filter(Boolean)
  ))
}

const getMetadataProperty = (
  asArray: PropertyAggregateToolDependencies['asArray'],
  metadata: Record<string, any>,
  propertyId: string
) => (
  asArray(metadata.properties).find((item: any) => String(item?.id || '') === propertyId)
)

const isNumericPropertyMetadata = (property: any) => {
  const valueType = property?.valueType
  const type = typeof valueType === 'string' ? valueType : valueType?.type
  return NUMERIC_PROPERTY_VALUE_TYPES.has(String(type || '').toLowerCase())
}

const normalizePropertyAggregate = (value: unknown): PropertyAggregate | undefined => {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  if (PROPERTY_AGGREGATES.has(upper as PropertyAggregate)) {
    return upper as PropertyAggregate
  }

  const normalized = raw.toLowerCase().replace(/[\s_\-./|,，、]+/g, '')
  return ({
    avg: 'AVG',
    average: 'AVG',
    mean: 'AVG',
    平均: 'AVG',
    平均值: 'AVG',
    均值: 'AVG',
    max: 'MAX',
    maximum: 'MAX',
    最大: 'MAX',
    最大值: 'MAX',
    峰值: 'MAX',
    min: 'MIN',
    minimum: 'MIN',
    最小: 'MIN',
    最小值: 'MIN',
    count: 'COUNT',
    total: 'COUNT',
    数量: 'COUNT',
    次数: 'COUNT',
    条数: 'COUNT',
    总数: 'COUNT',
    first: 'FIRST',
    firstvalue: 'FIRST',
    earliest: 'FIRST',
    initial: 'FIRST',
    首个: 'FIRST',
    第一个: 'FIRST',
    首次: 'FIRST',
    最早: 'FIRST',
    初始: 'FIRST',
    last: 'LAST',
    lastvalue: 'LAST',
    latest: 'LAST',
    newest: 'LAST',
    recent: 'LAST',
    最后: 'LAST',
    最后一个: 'LAST',
    末次: 'LAST',
    最新: 'LAST',
    最近: 'LAST',
    distinct: 'DISTINCT_COUNT',
    distinctcount: 'DISTINCT_COUNT',
    distinctcnt: 'DISTINCT_COUNT',
    uniquecount: 'DISTINCT_COUNT',
    cardinality: 'DISTINCT_COUNT',
    去重: 'DISTINCT_COUNT',
    去重数: 'DISTINCT_COUNT',
    去重计数: 'DISTINCT_COUNT',
    唯一数量: 'DISTINCT_COUNT',
    不重复数量: 'DISTINCT_COUNT'
  } as Record<string, PropertyAggregate | undefined>)[normalized]
}

const resolvePropertyAggregate = (
  deps: PropertyAggregateToolDependencies,
  metadata: Record<string, any>,
  propertyId: string,
  requestedAgg: PropertyAggregate | undefined,
  warnings: string[]
) => {
  const property = getMetadataProperty(deps.asArray, metadata, propertyId)
  const numeric = property ? isNumericPropertyMetadata(property) : true
  if (requestedAgg && NUMERIC_REQUIRED_AGGREGATES.has(requestedAgg) && !numeric) {
    warnings.push(deps.t('DeviceDetail.agentTools.propertyAggregate.warning.nonNumericCount', { propertyId }))
    return 'COUNT' as PropertyAggregate
  }
  return requestedAgg ?? (numeric ? 'AVG' : 'COUNT')
}

const normalizeAggregateTimeRange = (range: ResolvedTimeRange) => {
  const now = Date.now()
  // 聚合查询默认限制在最近 24 小时，避免模型未传时间时拉取无界结果。
  const end = range.end ?? now
  const start = range.start ?? Math.max(0, end - AGGREGATE_DEFAULT_RANGE_MS)
  return start > end ? { start: end, end: start } : { start, end }
}

const normalizeAggregateInterval = (value: unknown, range: ResolvedTimeRange) => {
  const raw = String(value ?? '').trim()
  if (raw && AGGREGATE_INTERVALS.has(raw)) return raw
  const lower = raw.toLowerCase()
  if (lower && AGGREGATE_INTERVALS.has(lower)) return lower

  const normalized = lower.replace(/[\s_\-./|,，、]+/g, '')
  const alias = ({
    minute: '1m',
    minutes: '1m',
    min: '1m',
    '1分钟': '1m',
    分钟: '1m',
    按分钟: '1m',
    hour: '1h',
    hours: '1h',
    '1小时': '1h',
    小时: '1h',
    按小时: '1h',
    day: '1d',
    days: '1d',
    '1天': '1d',
    天: '1d',
    按天: '1d',
    week: '1w',
    weeks: '1w',
    '1周': '1w',
    周: '1w',
    按周: '1w',
    month: '1M',
    months: '1M',
    '1月': '1M',
    月: '1M',
    按月: '1M'
  } as Record<string, string | undefined>)[normalized]
  if (alias && AGGREGATE_INTERVALS.has(alias)) return alias

  const duration = (range.end ?? Date.now()) - (range.start ?? 0)
  if (duration <= 60 * 60 * 1000) return '1m'
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '1h'
  if (duration <= 180 * 24 * 60 * 60 * 1000) return '1d'
  return '1w'
}

const aggregateTimeFormat = (interval: string) => (
  interval === '1d' || interval === '1w' || interval === '1M'
    ? 'yyyy-MM-dd'
    : 'yyyy-MM-dd HH:mm:ss'
)

const normalizePropertyAggregateRecord = (
  deps: PropertyAggregateToolDependencies,
  item: Record<string, any>,
  propertyIds: string[]
) => {
  const record: Record<string, any> = {
    time: item.time ?? item.timestamp ?? item.createTime
  }
  propertyIds.forEach((propertyId) => {
    record[propertyId] = deps.compactInlineValue(item[propertyId], 1000)
    const formatValue = item[`${propertyId}_format`]
    if (formatValue !== undefined) {
      record[`${propertyId}_format`] = deps.compactInlineValue(formatValue, 1000)
    }
  })
  return record
}

export const createDevicePropertyAggregateTool = (
  deps: PropertyAggregateToolDependencies
): AiClientToolDefinition<DeviceClientToolContext> => ({
  id: 'device_property_aggregate',
  name: 'device_property_aggregate',
  description: deps.t('DeviceDetail.agentTools.propertyAggregate.description'),
  inputs: deps.withWriteToPathInput([
    {
      id: 'propertyId',
      name: 'propertyId',
      description: deps.t('DeviceDetail.agentTools.propertyAggregate.inputs.propertyId'),
      required: false,
      valueType: 'string'
    },
    {
      id: 'propertyIds',
      name: 'propertyIds',
      description: deps.t('DeviceDetail.agentTools.propertyAggregate.inputs.propertyIds'),
      required: false,
      valueType: { type: 'array', elementType: { type: 'string' } }
    },
    {
      id: 'agg',
      name: 'agg',
      description: deps.t('DeviceDetail.agentTools.propertyAggregate.inputs.agg'),
      required: false,
      valueType: 'string'
    },
    {
      id: 'interval',
      name: 'interval',
      description: deps.t('DeviceDetail.agentTools.propertyAggregate.inputs.interval'),
      required: false,
      valueType: 'string'
    },
    {
      id: 'startTime',
      name: 'startTime',
      description: deps.startTimeDescription,
      required: false,
      valueType: 'string'
    },
    {
      id: 'endTime',
      name: 'endTime',
      description: deps.endTimeDescription,
      required: false,
      valueType: 'string'
    },
    deps.timeRangeInput(),
    {
      id: 'limit',
      name: 'limit',
      description: deps.t('DeviceDetail.agentTools.propertyAggregate.inputs.limit'),
      required: false,
      valueType: 'int'
    }
  ]),
  output: { type: 'object' },
  help: deps.t('DeviceDetail.agentTools.propertyAggregate.help'),
  execute: async (args, context, call) => {
    const deviceId = deps.getDeviceId(context)
    if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
    const metadata = deps.getMetadata(context)
    const propertyIds = normalizePropertyIds(args)
    if (!propertyIds.length) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.propertyIdMissing'))

    const requestedAgg = normalizePropertyAggregate(args.agg ?? args.aggregate ?? args.method)
    const warnings: string[] = []
    const timeRange = normalizeAggregateTimeRange(deps.resolveTimeRange(args))
    const interval = normalizeAggregateInterval(args.interval, timeRange)
    const format = aggregateTimeFormat(interval)
    const columns = propertyIds.map((propertyId) => ({
      property: propertyId,
      alias: propertyId,
      agg: resolvePropertyAggregate(deps, metadata, propertyId, requestedAgg, warnings)
    }))
    const resp = await getPropertiesInfo(deviceId, {
      columns,
      query: {
        interval,
        format,
        from: timeRange.start,
        to: timeRange.end
      }
    })
    const data = deps.asArray<Record<string, any>>(deps.responseResult(resp))
      .map((item) => normalizePropertyAggregateRecord(deps, item, propertyIds))
      .reverse()
    const inlineLimit = deps.clampNumber(args.limit, 1, 1000, 200)
    const visibleData = data.slice(0, inlineLimit)
    const aggregateByProperty = new Map(columns.map((item) => [item.property, item.agg]))
    const base = {
      deviceId,
      propertyIds,
      properties: propertyIds.map((propertyId) => {
        const property = getMetadataProperty(deps.asArray, metadata, propertyId)
        return {
          id: propertyId,
          name: property?.name,
          valueType: deps.dataTypeText(property?.valueType),
          aggregate: aggregateByProperty.get(propertyId)
        }
      }),
      interval,
      format,
      timeRange: deps.describeResolvedTimeRange(timeRange),
      total: data.length,
      warnings: warnings.length ? warnings : undefined
    }
    const result = {
      ...base,
      returned: visibleData.length,
      truncated: data.length > visibleData.length,
      nextAction: data.length > visibleData.length ? deps.t('DeviceDetail.agentTools.propertyAggregate.nextAction.truncated') : undefined,
      data: visibleData
    }
    const fileWrite = await deps.writeRecordsToSessionFile(args, call, data)
    if (fileWrite) {
      return {
        ...base,
        ...fileWrite,
        returned: data.length,
        truncated: false,
        fullResultWritten: true,
        inlinePreviewLimit: inlineLimit,
        inlinePreviewReturned: visibleData.length,
        inlinePreviewTruncated: data.length > visibleData.length,
        dataPreview: visibleData
      }
    }
    const fullResult = {
      ...base,
      returned: data.length,
      truncated: false,
      data
    }
    return deps.writeToolResultToSessionFile(args, call, result, {
      content: deps.stringifyToolResult(fullResult),
      summary: {
        ...base,
        returned: data.length,
        truncated: false,
        fullResultWritten: true,
        inlinePreviewLimit: inlineLimit,
        inlinePreviewReturned: visibleData.length,
        inlinePreviewTruncated: data.length > visibleData.length,
        dataPreview: visibleData
      }
    })
  }
})
