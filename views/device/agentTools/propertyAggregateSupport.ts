import type { AiClientToolOutputField } from '@jetlinks-web-core/layout/components/AiChat/clientTools'

export type DevicePropertyAggregateRecord = Record<string, unknown>
export type DevicePropertyAggregate = 'AVG' | 'MAX' | 'MIN' | 'COUNT' | 'FIRST' | 'LAST' | 'DISTINCT_COUNT'

export interface DevicePropertyAggregateTimeRange {
  start?: number
  end?: number
}

export interface DevicePropertyAggregateColumn {
  property: string
  alias: string
  agg: DevicePropertyAggregate
}

export interface DevicePropertyAggregateCoordinateLabels {
  longitude: (propertyLabel: string) => string
  latitude: (propertyLabel: string) => string
}

const PROPERTY_AGGREGATES = new Set<DevicePropertyAggregate>([
  'AVG', 'MAX', 'MIN', 'COUNT', 'FIRST', 'LAST', 'DISTINCT_COUNT',
])
const NUMERIC_REQUIRED_AGGREGATES = new Set<DevicePropertyAggregate>(['AVG', 'MAX', 'MIN'])
const NUMERIC_PROPERTY_VALUE_TYPES = new Set([
  'int', 'float', 'double', 'long', 'number', 'integer', 'short', 'byte',
])
const GEO_POINT_PROPERTY_VALUE_TYPE = 'geopoint'
const AGGREGATE_INTERVALS = new Set(['1m', '1h', '1d', '1w', '1M'])
const AGGREGATE_DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000
const DEFAULT_INLINE_LIMIT = 200
const MAX_INLINE_LIMIT = 1000
const MAX_ORDERED_PATH_INLINE_RECORDS = 10_000
const TARGET_ORDERED_PATH_BUCKETS = 1000
// Leave headroom below the client-tool runtime's 96 KiB result guard for evidence and artifact metadata.
const MAX_ORDERED_PATH_INLINE_BYTES = 84 * 1024

const asArray = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

const asRecord = (value: unknown): DevicePropertyAggregateRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as DevicePropertyAggregateRecord
    : {}
)

export const devicePropertyAggregateResponseResult = (response: unknown) => {
  const record = asRecord(response)
  return record.result ?? record.data ?? response
}

export const clampDevicePropertyAggregateInlineLimit = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(MAX_INLINE_LIMIT, Math.max(1, Math.floor(number)))
    : DEFAULT_INLINE_LIMIT
}

export const compactDevicePropertyAggregateValue = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : value
  } catch {
    return String(value)
  }
}

export const normalizeDevicePropertyIds = (args: DevicePropertyAggregateRecord) => {
  const values: unknown[] = []
  const append = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }
    if (value !== undefined && value !== null && value !== '') values.push(value)
  }
  append(args.propertyId ?? args.property)
  append(args.propertyIds ?? args.properties)
  return Array.from(new Set(values
    .flatMap(value => String(value).split(/[\s,，、]+/))
    .map(value => value.trim())
    .filter(Boolean)))
}

export const findDevicePropertyMetadata = (
  metadata: DevicePropertyAggregateRecord,
  propertyId: string,
) => asArray<DevicePropertyAggregateRecord>(metadata.properties)
  .find(property => String(property?.id || '') === propertyId)

const propertyValueType = (property: DevicePropertyAggregateRecord | undefined) => {
  const valueType = property?.valueType
  return typeof valueType === 'string' ? valueType : asRecord(valueType).type
}

const isNumericProperty = (property: DevicePropertyAggregateRecord | undefined) => (
  NUMERIC_PROPERTY_VALUE_TYPES.has(String(propertyValueType(property) || '').toLowerCase())
)

const isGeoPointProperty = (property: DevicePropertyAggregateRecord | undefined) => (
  String(propertyValueType(property) || '').toLowerCase() === GEO_POINT_PROPERTY_VALUE_TYPE
)

const isGeoPointValueAggregate = (
  property: DevicePropertyAggregateRecord | undefined,
  aggregate: DevicePropertyAggregate,
) => isGeoPointProperty(property) && (aggregate === 'FIRST' || aggregate === 'LAST')

const finiteCoordinate = (value: unknown, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined
}

const normalizeGeoPoint = (value: unknown): { longitude: number; latitude: number } | undefined => {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return undefined
    try {
      return normalizeGeoPoint(JSON.parse(text))
    } catch {
      const [longitude, latitude] = text.split(',').map(item => item.trim())
      const lng = finiteCoordinate(longitude, -180, 180)
      const lat = finiteCoordinate(latitude, -90, 90)
      return lng === undefined || lat === undefined ? undefined : { longitude: lng, latitude: lat }
    }
  }
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = finiteCoordinate(value[0], -180, 180)
    const latitude = finiteCoordinate(value[1], -90, 90)
    return longitude === undefined || latitude === undefined ? undefined : { longitude, latitude }
  }
  const point = asRecord(value)
  const longitude = finiteCoordinate(point.lon ?? point.lng ?? point.longitude, -180, 180)
  const latitude = finiteCoordinate(point.lat ?? point.latitude, -90, 90)
  return longitude === undefined || latitude === undefined
    ? undefined
    : { longitude, latitude }
}

const isSingleOrderedPathColumn = (
  metadata: DevicePropertyAggregateRecord,
  columns: DevicePropertyAggregateColumn[],
) => columns.length === 1 && isGeoPointValueAggregate(
  findDevicePropertyMetadata(metadata, columns[0].property),
  columns[0].agg,
)

const aggregateTimeFieldName = (
  metadata: DevicePropertyAggregateRecord,
  columns: DevicePropertyAggregateColumn[],
) => isSingleOrderedPathColumn(metadata, columns) ? 't' : 'time'

const coordinateFieldName = (
  metadata: DevicePropertyAggregateRecord,
  columns: DevicePropertyAggregateColumn[],
  propertyId: string,
  coordinate: 'longitude' | 'latitude',
) => isSingleOrderedPathColumn(metadata, columns)
  ? coordinate === 'longitude' ? 'x' : 'y'
  : `${propertyId}_${coordinate}`

export const isDevicePropertyAggregateGeoPointValueColumn = (
  metadata: DevicePropertyAggregateRecord,
  column: DevicePropertyAggregateColumn,
) => isGeoPointValueAggregate(
  findDevicePropertyMetadata(metadata, column.property),
  column.agg,
)

export const normalizeDevicePropertyAggregate = (value: unknown): DevicePropertyAggregate | undefined => {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  if (PROPERTY_AGGREGATES.has(upper as DevicePropertyAggregate)) return upper as DevicePropertyAggregate
  const normalized = raw.toLowerCase().replace(/[\s_\-./|,，、]+/g, '')
  return ({
    avg: 'AVG', average: 'AVG', mean: 'AVG', 平均: 'AVG', 平均值: 'AVG', 均值: 'AVG',
    max: 'MAX', maximum: 'MAX', 最大: 'MAX', 最大值: 'MAX', 峰值: 'MAX',
    min: 'MIN', minimum: 'MIN', 最小: 'MIN', 最小值: 'MIN',
    count: 'COUNT', total: 'COUNT', 数量: 'COUNT', 次数: 'COUNT', 条数: 'COUNT', 总数: 'COUNT',
    first: 'FIRST', firstvalue: 'FIRST', earliest: 'FIRST', initial: 'FIRST',
    首个: 'FIRST', 第一个: 'FIRST', 首次: 'FIRST', 最早: 'FIRST', 初始: 'FIRST',
    last: 'LAST', lastvalue: 'LAST', latest: 'LAST', newest: 'LAST', recent: 'LAST',
    最后: 'LAST', 最后一个: 'LAST', 末次: 'LAST', 最新: 'LAST', 最近: 'LAST',
    distinct: 'DISTINCT_COUNT', distinctcount: 'DISTINCT_COUNT', distinctcnt: 'DISTINCT_COUNT',
    uniquecount: 'DISTINCT_COUNT', cardinality: 'DISTINCT_COUNT', 去重: 'DISTINCT_COUNT',
    去重数: 'DISTINCT_COUNT', 去重计数: 'DISTINCT_COUNT', 唯一数量: 'DISTINCT_COUNT',
    不重复数量: 'DISTINCT_COUNT',
  } as Record<string, DevicePropertyAggregate | undefined>)[normalized]
}

export const normalizeDevicePropertyAggregateTimeRange = (
  range: DevicePropertyAggregateTimeRange,
) => {
  const now = Date.now()
  // Missing ranges stay bounded so a weak model cannot accidentally trigger an unbounded aggregate query.
  const end = range.end ?? now
  const start = range.start ?? Math.max(0, end - AGGREGATE_DEFAULT_RANGE_MS)
  return start > end ? { start: end, end: start } : { start, end }
}

export const normalizeDevicePropertyAggregateInterval = (
  value: unknown,
  range: DevicePropertyAggregateTimeRange,
) => {
  const raw = String(value ?? '').trim()
  if (raw && AGGREGATE_INTERVALS.has(raw)) return raw
  const lower = raw.toLowerCase()
  if (lower && AGGREGATE_INTERVALS.has(lower)) return lower
  const normalized = lower.replace(/[\s_\-./|,，、]+/g, '')
  const alias = ({
    minute: '1m', minutes: '1m', min: '1m', '1分钟': '1m', 分钟: '1m', 按分钟: '1m',
    hour: '1h', hours: '1h', '1小时': '1h', 小时: '1h', 按小时: '1h',
    day: '1d', days: '1d', '1天': '1d', 天: '1d', 按天: '1d',
    week: '1w', weeks: '1w', '1周': '1w', 周: '1w', 按周: '1w',
    month: '1M', months: '1M', '1月': '1M', 月: '1M', 按月: '1M',
  } as Record<string, string | undefined>)[normalized]
  if (alias && AGGREGATE_INTERVALS.has(alias)) return alias
  const duration = (range.end ?? Date.now()) - (range.start ?? 0)
  if (duration <= 60 * 60 * 1000) return '1m'
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '1h'
  if (duration <= 180 * 24 * 60 * 60 * 1000) return '1d'
  return '1w'
}

export const devicePropertyAggregateTimeFormat = (interval: string) => (
  interval === '1d' || interval === '1w' || interval === '1M'
    ? 'yyyy-MM-dd'
    : 'yyyy-MM-dd HH:mm:ss'
)

export const createDevicePropertyAggregateColumns = (
  metadata: DevicePropertyAggregateRecord,
  propertyIds: string[],
  requested: DevicePropertyAggregate | undefined,
  nonNumericWarning: (propertyId: string) => string,
) => {
  const warnings: string[] = []
  const columns = propertyIds.map((propertyId): DevicePropertyAggregateColumn => {
    const property = findDevicePropertyMetadata(metadata, propertyId)
    const numeric = property ? isNumericProperty(property) : true
    const aggregate = requested && NUMERIC_REQUIRED_AGGREGATES.has(requested) && !numeric
      ? 'COUNT'
      : requested ?? (numeric ? 'AVG' : isGeoPointProperty(property) ? 'LAST' : 'COUNT')
    if (aggregate === 'COUNT' && requested && NUMERIC_REQUIRED_AGGREGATES.has(requested) && !numeric) {
      warnings.push(nonNumericWarning(propertyId))
    }
    return { property: propertyId, alias: propertyId, agg: aggregate }
  })
  return { columns, warnings }
}

export const normalizeDevicePropertyAggregateData = (
  response: unknown,
  metadata: DevicePropertyAggregateRecord,
  columns: DevicePropertyAggregateColumn[],
  compactValue: (value: unknown, maxLength: number) => unknown,
) => {
  const orderedPath = isSingleOrderedPathColumn(metadata, columns)
  const timeField = aggregateTimeFieldName(metadata, columns)
  return asArray<DevicePropertyAggregateRecord>(devicePropertyAggregateResponseResult(response))
    .map((item) => {
      const record: DevicePropertyAggregateRecord = {
        [timeField]: item.time ?? item.timestamp ?? item.createTime,
      }
      columns.forEach(({ property: propertyId, agg }) => {
        const property = findDevicePropertyMetadata(metadata, propertyId)
        if (isGeoPointValueAggregate(property, agg)) {
          // Geo values remain canonical at the query boundary, then become renderer-neutral scalar roles here.
          const point = normalizeGeoPoint(item[propertyId])
          if (point) {
            record[coordinateFieldName(metadata, columns, propertyId, 'longitude')] = point.longitude
            record[coordinateFieldName(metadata, columns, propertyId, 'latitude')] = point.latitude
          }
          return
        }
        record[propertyId] = compactValue(item[propertyId], 1000)
        const formatted = item[`${propertyId}_format`]
        if (formatted !== undefined) record[`${propertyId}_format`] = compactValue(formatted, 1000)
      })
      return record
    })
    // A closed path cannot contain a timestamp-only row. Mixed aggregates keep their other measures.
    .filter(record => !orderedPath || ('x' in record && 'y' in record))
    .reverse()
}

const timeSortValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Date.parse(String(value || '').trim().replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : undefined
}

const padTimePart = (value: number) => String(value).padStart(2, '0')

const formatAggregateBucketTime = (timestamp: number, interval: string) => {
  const date = new Date(timestamp)
  if (interval === '1m') date.setSeconds(0, 0)
  else if (interval === '1h') date.setMinutes(0, 0, 0)
  else if (interval === '1d') date.setHours(0, 0, 0, 0)
  else if (interval === '1w') {
    const day = date.getDay() || 7
    date.setDate(date.getDate() - day + 1)
    date.setHours(0, 0, 0, 0)
  } else if (interval === '1M') {
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
  }
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`
    + (interval === '1d' || interval === '1w' || interval === '1M'
      ? ''
      : ` ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:00`)
}

const rawPropertyHistoryValue = (input: unknown) => {
  const row = asRecord(input)
  const nested = asRecord(row.value)
  return {
    timestamp: timeSortValue(row.timestamp ?? nested.timestamp ?? row.createTime),
    value: 'value' in nested ? nested.value : row.value,
  }
}

/**
 * Selects the finest supported bucket that keeps an observed ordered path near the inline budget.
 * Requested time ranges can be mostly empty, so path resolution is based on observed timestamps.
 */
export const resolveDevicePropertyOrderedPathInterval = (
  recordsByProperty: Readonly<Record<string, readonly unknown[]>>,
) => {
  const timestamps = Object.values(recordsByProperty)
    .flatMap(records => records.map(record => rawPropertyHistoryValue(record).timestamp))
    .filter((timestamp): timestamp is number => timestamp !== undefined)
  if (timestamps.length < 2) return '1m'
  const duration = Math.max(...timestamps) - Math.min(...timestamps)
  if (duration <= TARGET_ORDERED_PATH_BUCKETS * 60 * 1000) return '1m'
  if (duration <= TARGET_ORDERED_PATH_BUCKETS * 60 * 60 * 1000) return '1h'
  if (duration <= TARGET_ORDERED_PATH_BUCKETS * 24 * 60 * 60 * 1000) return '1d'
  if (duration <= TARGET_ORDERED_PATH_BUCKETS * 7 * 24 * 60 * 60 * 1000) return '1w'
  return '1M'
}

const ORDERED_PATH_INTERVAL_RANK = new Map([
  ['1m', 0],
  ['1h', 1],
  ['1d', 2],
  ['1w', 3],
  ['1M', 4],
])

export const refineDevicePropertyOrderedPathInterval = (
  requested: string,
  recordsByProperty: Readonly<Record<string, readonly unknown[]>>,
) => {
  const observed = resolveDevicePropertyOrderedPathInterval(recordsByProperty)
  return (ORDERED_PATH_INTERVAL_RANK.get(observed) ?? Number.MAX_SAFE_INTEGER)
    < (ORDERED_PATH_INTERVAL_RANK.get(requested) ?? Number.MAX_SAFE_INTEGER)
    ? observed
    : requested
}

/**
 * Complex values are not uniformly supported by storage aggregation adapters. This fallback keeps
 * the aggregate contract stable by selecting FIRST/LAST inside the requested, already bounded rows.
 */
export const aggregateDevicePropertyGeoPointHistory = (
  recordsByProperty: Readonly<Record<string, readonly unknown[]>>,
  columns: readonly DevicePropertyAggregateColumn[],
  interval: string,
) => {
  const buckets = new Map<string, DevicePropertyAggregateRecord>()
  const columnsByProperty = new Map<string, DevicePropertyAggregateColumn[]>()
  columns.forEach((column) => {
    columnsByProperty.set(column.property, [
      ...(columnsByProperty.get(column.property) || []),
      column,
    ])
  })
  columnsByProperty.forEach((propertyColumns, propertyId) => {
    const records = [...(recordsByProperty[propertyId] || [])]
      .map(rawPropertyHistoryValue)
      .filter((record): record is { timestamp: number; value: unknown } => record.timestamp !== undefined)
      .sort((left, right) => left.timestamp - right.timestamp)
    records.forEach((record) => {
      const time = formatAggregateBucketTime(record.timestamp, interval)
      const bucket = buckets.get(time) || { time }
      propertyColumns.forEach((column) => {
        if (column.agg === 'FIRST') {
          if (bucket[column.alias] === undefined) bucket[column.alias] = record.value
        } else {
          bucket[column.alias] = record.value
        }
      })
      buckets.set(time, bucket)
    })
  })
  // normalizeDevicePropertyAggregateData accepts storage-order rows and returns chronological rows.
  return [...buckets.values()].sort((left, right) => (
    (timeSortValue(right.time) ?? Number.MIN_SAFE_INTEGER)
    - (timeSortValue(left.time) ?? Number.MIN_SAFE_INTEGER)
  ))
}

export const mergeDevicePropertyAggregateRows = (
  groups: readonly (readonly DevicePropertyAggregateRecord[])[],
) => {
  const merged = new Map<string, DevicePropertyAggregateRecord>()
  groups.flat().forEach((row) => {
    const key = String(row.time || '').trim()
    if (!key) return
    merged.set(key, { ...(merged.get(key) || {}), ...row, time: row.time })
  })
  return [...merged.values()].sort((left, right) => (
    (timeSortValue(right.time) ?? Number.MIN_SAFE_INTEGER)
    - (timeSortValue(left.time) ?? Number.MIN_SAFE_INTEGER)
  ))
}

const propertyUnit = (property: DevicePropertyAggregateRecord | undefined) => {
  const valueType = asRecord(property?.valueType)
  const expands = asRecord(valueType.expands)
  return String(valueType.unit || expands.unit || '').trim() || undefined
}

export const createDevicePropertyAggregateFields = (
  metadata: DevicePropertyAggregateRecord,
  columns: DevicePropertyAggregateColumn[],
  coordinateLabels: DevicePropertyAggregateCoordinateLabels,
): AiClientToolOutputField[] => [
  {
    name: aggregateTimeFieldName(metadata, columns),
    semanticRole: 'timestamp',
    format: 'datetime',
  },
  ...columns.flatMap(({ property: propertyId, agg }): AiClientToolOutputField[] => {
    const property = findDevicePropertyMetadata(metadata, propertyId)
    if (isGeoPointValueAggregate(property, agg)) {
      const propertyLabel = String(property?.name || propertyId)
      return [
        {
          name: coordinateFieldName(metadata, columns, propertyId, 'longitude'),
          semanticRole: 'longitude',
          label: coordinateLabels.longitude(propertyLabel),
          measure: propertyId,
          aggregation: agg.toLowerCase(),
        },
        {
          name: coordinateFieldName(metadata, columns, propertyId, 'latitude'),
          semanticRole: 'latitude',
          label: coordinateLabels.latitude(propertyLabel),
          measure: propertyId,
          aggregation: agg.toLowerCase(),
        },
      ]
    }
    const numeric = isNumericProperty(property) || agg === 'COUNT' || agg === 'DISTINCT_COUNT'
    const unit = agg === 'COUNT' || agg === 'DISTINCT_COUNT' ? 'count' : propertyUnit(property)
    return [{
      name: propertyId,
      semanticRole: numeric ? 'number' as const : 'category' as const,
      ...(property?.name ? { label: String(property.name) } : {}),
      measure: propertyId,
      aggregation: agg.toLowerCase(),
      ...(unit ? { unit } : {}),
    }]
  }),
]

const normalizedFieldText = (value: unknown) => String(value || '').trim().toLowerCase()

export const isDevicePropertyAggregateOrderedPath = (
  fields: readonly AiClientToolOutputField[],
) => {
  const timestamps = fields.filter(field => field.semanticRole === 'timestamp')
  const longitudes = fields.filter(field => field.semanticRole === 'longitude')
  const latitudes = fields.filter(field => field.semanticRole === 'latitude')
  if (timestamps.length + longitudes.length + latitudes.length !== fields.length
    || timestamps.length !== 1
    || longitudes.length !== 1
    || latitudes.length !== 1) return false
  const longitude = longitudes[0]
  const latitude = latitudes[0]
  const measure = normalizedFieldText(longitude.measure)
  const aggregation = normalizedFieldText(longitude.aggregation)
  return !!measure
    && measure === normalizedFieldText(latitude.measure)
    && aggregation === normalizedFieldText(latitude.aggregation)
    && (aggregation === 'first' || aggregation === 'last')
}

const jsonByteLength = (value: unknown) => {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/**
 * Small aggregates follow the caller's normal inline limit. A closed ordered path may exceed that
 * bucket limit only while it remains below the shared record and WebSocket byte budgets, allowing
 * the canonical compiler to materialize the line presentation without a second model-authored chart.
 */
export const shouldInlineDevicePropertyAggregate = (
  data: readonly DevicePropertyAggregateRecord[],
  fields: readonly AiClientToolOutputField[],
  inlineLimit: number,
) => data.length <= inlineLimit || (
  data.length <= MAX_ORDERED_PATH_INLINE_RECORDS
  && isDevicePropertyAggregateOrderedPath(fields)
  && jsonByteLength(data) <= MAX_ORDERED_PATH_INLINE_BYTES
)

export const createDevicePropertyAggregateRecordSchema = (fields: AiClientToolOutputField[]) => ({
  type: 'object',
  properties: Object.fromEntries(fields.map(field => [field.name, {
    type: ['number', 'duration', 'longitude', 'latitude'].includes(field.semanticRole || '')
      ? 'number'
      : 'string',
    'x-ai-role': field.semanticRole,
    ...(field.format === 'datetime' ? { format: 'date-time' } : {}),
    ...(field.label ? { label: field.label } : {}),
    ...(field.measure ? { 'x-ai-measure': field.measure } : {}),
    ...(field.unit ? { 'x-ai-unit': field.unit } : {}),
    ...(field.aggregation ? { 'x-ai-aggregation': field.aggregation } : {}),
  }])),
})

const finiteTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const timestamp = new Date(String(value || '')).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

export const resolveDevicePropertyAggregateObservedRange = (
  data: DevicePropertyAggregateRecord[],
) => {
  let start: number | undefined
  let end: number | undefined
  data.forEach((item) => {
    const timestamp = finiteTimestamp(item.time ?? item.t)
    if (timestamp === undefined) return
    start = start === undefined ? timestamp : Math.min(start, timestamp)
    end = end === undefined ? timestamp : Math.max(end, timestamp)
  })
  return start === undefined || end === undefined ? undefined : { start, end }
}
