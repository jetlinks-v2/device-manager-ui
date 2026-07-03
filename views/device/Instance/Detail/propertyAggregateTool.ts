import { getPropertiesInfo } from '../../../../api/instance'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceDetailRecord = Record<string, any>

interface DeviceClientToolContext {
  device: DeviceDetailRecord
}

interface ResolvedTimeRange {
  start?: number
  end?: number
}

type PropertyAggregate = 'AVG' | 'MAX' | 'MIN' | 'COUNT' | 'FIRST' | 'LAST' | 'DISTINCT_COUNT'

interface PropertyAggregateToolDependencies {
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
    warnings.push(`${propertyId} 不是数值属性，已改用 COUNT 聚合。`)
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
  description: '按时间桶聚合查询当前设备一个或多个属性，用于回答平均值、最大值、最小值、计数、首次值、末次值、去重计数和趋势问题。',
  inputs: deps.withWriteToPathInput([
    {
      id: 'propertyId',
      name: 'propertyId',
      description: '单个属性ID；与 propertyIds 二选一。',
      required: false,
      valueType: 'string'
    },
    {
      id: 'propertyIds',
      name: 'propertyIds',
      description: '属性ID数组；可一次聚合多个属性。',
      required: false,
      valueType: { type: 'array', elementType: { type: 'string' } }
    },
    {
      id: 'agg',
      name: 'agg',
      description: '聚合方式：AVG 平均值、MAX 最大值、MIN 最小值、COUNT 条数、FIRST 首个值、LAST 最后值、DISTINCT_COUNT 去重计数；也支持“平均/最大/最小/次数/首次/最后/去重”等自然语言。未传时数值属性默认 AVG，非数值属性默认 COUNT。',
      required: false,
      valueType: 'string'
    },
    {
      id: 'interval',
      name: 'interval',
      description: '聚合时间桶：1m、1h、1d、1w、1M；也支持“按分钟/按小时/按天/按周/按月”。未传时按时间范围自动选择。',
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
      description: '内联预览最多返回聚合桶数量，默认200，最大1000；传 writeToPath 时完整聚合结果会写入会话文件，建议优先使用 .jsonl 路径，也兼容 .ndjson，不受此预览限制。',
      required: false,
      valueType: 'int'
    }
  ]),
  output: { type: 'object' },
  help: '属性聚合趋势查询。用户问“今天平均温度”“最近24小时最大电压”“按小时统计趋势”“某属性每天多少条”“每分钟最后一个坐标”“首次状态”“去重数量”，或要求导出/生成属性趋势图时，先使用此工具完成聚合取数；只问有没有/多少条且不需要趋势时使用 device_property_history_summary。查询整天每分钟、长时间范围、多属性趋势、导出或制图时，应传 writeToPath 保存完整聚合结果，建议优先使用 .jsonl 路径，也兼容 .ndjson；如需生成图片，先用本工具得到聚合数据，再使用图表工具渲染，不要用 dataset 查询替代首次聚合取数。',
  execute: async (args, context, call) => {
    const deviceId = deps.getDeviceId(context)
    if (!deviceId) throw new Error('deviceId missing')
    const metadata = deps.getMetadata(context)
    const propertyIds = normalizePropertyIds(args)
    if (!propertyIds.length) throw new Error('propertyId missing')

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
      nextAction: data.length > visibleData.length ? '结果已截断，可传 writeToPath 保存完整聚合结果。' : undefined,
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
