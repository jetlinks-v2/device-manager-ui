import type {
  AiClientToolOrdering,
  AiClientToolOutputField,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import type { ClientToolInputAlternative } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import type { ThingModelMetadata } from '@device-manager-ui/views/device/list/services/iotDeviceDetailReal.service'
import {
  IOT_DEVICE_PROPERTY_AGGREGATES,
  IOT_DEVICE_PROPERTY_ANALYSIS_MODES,
} from './constants'

export type IotDevicePropertyAggregate = typeof IOT_DEVICE_PROPERTY_AGGREGATES[number]
export type IotDevicePropertyAnalysisMode = typeof IOT_DEVICE_PROPERTY_ANALYSIS_MODES[number]

export const IOT_DEVICE_PROPERTY_AGGREGATE_INTENTS = [
  '分析设备属性的历史趋势、分桶统计或地理位置轨迹',
  'analyze device property history as bucketed statistics, trends, or geographic paths',
] as const

export const IOT_DEVICE_PROPERTY_AGGREGATE_NOT_FOR = [
  '读取未聚合的原始属性明细',
  'read unaggregated raw property records',
] as const

export interface IotDevicePropertyAggregateColumn {
  property: string
  propertyLabel: string
  propertyType: string
  alias: string
  agg: IotDevicePropertyAggregate
  geoPointValue: boolean
  unit?: string
}

export interface IotDevicePropertyAggregatePlan {
  columns: IotDevicePropertyAggregateColumn[]
  warnings: string[]
}

export type IotDevicePropertyAggregateModeIssue =
  | 'orderedPathSingleProperty'
  | 'orderedPathGeoPointRequired'
  | 'orderedPathAggregateRequired'
  | 'statisticsGeoPointAggregateRequired'

interface AggregateCopy {
  unsupported: (propertyLabel: string, aggregates: readonly IotDevicePropertyAggregate[]) => string
  longitude: (propertyLabel: string) => string
  latitude: (propertyLabel: string) => string
}

const NUMERIC_TYPES = new Set([
  'int', 'long', 'float', 'double', 'number', 'integer', 'short', 'byte', 'decimal',
])
const GEO_POINT_TYPE = 'geopoint'
const NUMERIC_ONLY_AGGREGATES = new Set<IotDevicePropertyAggregate>(['AVG', 'MAX', 'MIN'])
const GEO_POINT_VALUE_AGGREGATES = new Set<IotDevicePropertyAggregate>(['FIRST', 'LAST'])
const PROPERTY_AGGREGATE_INTERVALS = new Set(['1m', '1h', '1d', '1w', '1M'])
const TARGET_ORDERED_PATH_BUCKETS = 1000

/** The producer sorts every aggregate row by the canonical time field before delivery. */
export const IOT_DEVICE_PROPERTY_AGGREGATE_ORDERING: AiClientToolOrdering = {
  keys: [{ field: 'time', direction: 'asc' }],
  producerGuaranteed: true,
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const asRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {}
const text = (value: unknown) => String(value ?? '').trim()

const normalizedStringList = (...values: unknown[]) => {
  const result: string[] = []
  const append = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }
    if (value === undefined || value === null || value === '') return
    result.push(...String(value).split(/[\s,，、]+/).map(item => item.trim()).filter(Boolean))
  }
  values.forEach(append)
  return Array.from(new Set(result))
}

/** Keeps the temporary iot-ui copy compatible with the device-manager single/plural selector contract. */
export const normalizeIotDevicePropertyIds = (args: Record<string, unknown>) => normalizedStringList(
  args.propertyId ?? args.property,
  args.propertyIds ?? args.properties,
)

export const normalizeIotDevicePropertyAggregate = (
  value: unknown,
): IotDevicePropertyAggregate | undefined => {
  const raw = text(value)
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  if (IOT_DEVICE_PROPERTY_AGGREGATES.includes(upper as IotDevicePropertyAggregate)) {
    return upper as IotDevicePropertyAggregate
  }
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
  } as Record<string, IotDevicePropertyAggregate | undefined>)[normalized]
}

export const normalizeIotDevicePropertyAggregateInput = (args: Record<string, unknown>) => (
  normalizedStringList(args.agg ?? args.aggregate ?? args.method, args.aggregates)[0]
)

export const normalizeIotDevicePropertyAggregateInterval = (
  value: unknown,
  range: { start?: number; end?: number },
) => {
  const raw = text(value)
  if (raw && PROPERTY_AGGREGATE_INTERVALS.has(raw)) return raw
  const lower = raw.toLowerCase()
  if (lower && PROPERTY_AGGREGATE_INTERVALS.has(lower)) return lower
  const normalized = lower.replace(/[\s_\-./|,，、]+/g, '')
  const alias = ({
    minute: '1m', minutes: '1m', min: '1m', '1分钟': '1m', 分钟: '1m', 按分钟: '1m',
    hour: '1h', hours: '1h', '1小时': '1h', 小时: '1h', 按小时: '1h',
    day: '1d', days: '1d', '1天': '1d', 天: '1d', 按天: '1d',
    week: '1w', weeks: '1w', '1周': '1w', 周: '1w', 按周: '1w',
    month: '1M', months: '1M', '1月': '1M', 月: '1M', 按月: '1M',
  } as Record<string, string | undefined>)[normalized]
  if (alias && PROPERTY_AGGREGATE_INTERVALS.has(alias)) return alias
  const duration = (range.end ?? Date.now()) - (range.start ?? 0)
  if (duration <= 60 * 60 * 1000) return '1m'
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '1h'
  if (duration <= 180 * 24 * 60 * 60 * 1000) return '1d'
  return '1w'
}

export const createIotDevicePropertyAggregateInputAlternatives = (
  timeAlternatives: readonly ClientToolInputAlternative[],
): ClientToolInputAlternative[] => timeAlternatives.flatMap(timeAlternative => (
  (['propertyId', 'propertyIds'] as const).map((propertyInput) => {
    const sibling = propertyInput === 'propertyId' ? 'propertyIds' : 'propertyId'
    return {
      ...timeAlternative,
      title: `${timeAlternative.title || 'Time range'} / ${propertyInput}`,
      required: [propertyInput, ...timeAlternative.required],
      forbidden: [...(timeAlternative.forbidden || []), sibling],
    }
  })
))

const propertyIdOf = (property: unknown) => {
  const value = asRecord(property)
  return text(value.id || value.property || value.key)
}

const propertyTypeOf = (property: Record<string, unknown>) => {
  const valueType = property.valueType
  return text(typeof valueType === 'string' ? valueType : asRecord(valueType).type || property.dataType).toLowerCase()
}

const propertyUnitOf = (property: Record<string, unknown>) => {
  const valueType = asRecord(property.valueType)
  const expands = asRecord(valueType.expands)
  return text(valueType.unit || expands.unit) || undefined
}

const supportedAggregates = (
  propertyType: string,
  requested: readonly IotDevicePropertyAggregate[],
) => {
  if (NUMERIC_TYPES.has(propertyType)) return requested
  return requested.filter(aggregate => !NUMERIC_ONLY_AGGREGATES.has(aggregate))
}

const defaultAggregates = (propertyType: string): readonly IotDevicePropertyAggregate[] => (
  NUMERIC_TYPES.has(propertyType)
    ? ['AVG']
    : ['COUNT']
)

export const normalizeIotDevicePropertyAnalysisMode = (
  value: unknown,
): IotDevicePropertyAnalysisMode | undefined => {
  const normalized = text(value).toLowerCase().replace(/[\s_\-./|,，、]+/g, '')
  return ({
    statistics: 'statistics', statistic: 'statistics', stats: 'statistics', aggregate: 'statistics', aggregation: 'statistics',
    统计: 'statistics', 统计分析: 'statistics', 聚合: 'statistics', 趋势: 'statistics', 趋势分析: 'statistics',
    orderedpath: 'ordered_path', path: 'ordered_path', trajectory: 'ordered_path', route: 'ordered_path', track: 'ordered_path',
    有序路径: 'ordered_path', 路径: 'ordered_path', 轨迹: 'ordered_path', 轨迹路线: 'ordered_path', 路线: 'ordered_path',
  } as Record<string, IotDevicePropertyAnalysisMode | undefined>)[normalized]
}

/** Validates semantic intent before selecting a producer strategy; no field-name or page heuristic participates. */
export const resolveIotDevicePropertyAggregateModeIssue = (
  metadata: ThingModelMetadata,
  propertyIds: readonly string[],
  requested: IotDevicePropertyAggregate | undefined,
  analysisMode: IotDevicePropertyAnalysisMode,
): IotDevicePropertyAggregateModeIssue | undefined => {
  const properties = new Map(metadata.properties.map((property) => {
    const record = asRecord(property)
    return [propertyIdOf(record), record]
  }))
  if (analysisMode === 'ordered_path') {
    if (propertyIds.length !== 1) return 'orderedPathSingleProperty'
    if (propertyTypeOf(properties.get(propertyIds[0]) || {}) !== GEO_POINT_TYPE) {
      return 'orderedPathGeoPointRequired'
    }
    if (requested && !GEO_POINT_VALUE_AGGREGATES.has(requested)) {
      return 'orderedPathAggregateRequired'
    }
    return undefined
  }
  const geoPointSelected = propertyIds.some(propertyId => (
    propertyTypeOf(properties.get(propertyId) || {}) === GEO_POINT_TYPE
  ))
  if (geoPointSelected && requested && GEO_POINT_VALUE_AGGREGATES.has(requested)) {
    return 'statisticsGeoPointAggregateRequired'
  }
  return undefined
}

/** Builds one type-aware query plan without coupling the tool contract to a concrete property id. */
export const createIotDevicePropertyAggregatePlan = (
  metadata: ThingModelMetadata,
  propertyIds: readonly string[],
  requested: IotDevicePropertyAggregate | undefined,
  analysisMode: IotDevicePropertyAnalysisMode,
  copy: Pick<AggregateCopy, 'unsupported'>,
): IotDevicePropertyAggregatePlan => {
  const properties = new Map(metadata.properties.map((property) => {
    const record = asRecord(property)
    return [propertyIdOf(record), record]
  }))
  const warnings: string[] = []
  const columns = propertyIds.flatMap((propertyId) => {
    const property = properties.get(propertyId) || {}
    const propertyLabel = text(property.name) || propertyId
    const propertyType = propertyTypeOf(property)
    const modeDefault = analysisMode === 'ordered_path' ? ['LAST'] as const : defaultAggregates(propertyType)
    const selected = requested ? supportedAggregates(propertyType, [requested]) : modeDefault
    const aggregates = selected.length ? selected : modeDefault
    const ignored = requested && !aggregates.includes(requested) ? [requested] : []
    if (ignored.length) warnings.push(copy.unsupported(propertyLabel, ignored))
    return aggregates.map(agg => ({
      property: propertyId,
      propertyLabel,
      propertyType,
      alias: '',
      agg,
      geoPointValue: analysisMode === 'ordered_path'
        && propertyType === GEO_POINT_TYPE
        && GEO_POINT_VALUE_AGGREGATES.has(agg),
      unit: propertyUnitOf(property),
    }))
  })
  const countByProperty = new Map<string, number>()
  columns.forEach(column => countByProperty.set(column.property, (countByProperty.get(column.property) || 0) + 1))
  columns.forEach((column) => {
    column.alias = countByProperty.get(column.property) === 1
      ? column.property
      : `${column.property}_${column.agg.toLowerCase()}`
  })
  return { columns, warnings }
}

const finiteCoordinate = (value: unknown, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined
}

const parseGeoPoint = (value: unknown): { longitude: number; latitude: number } | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    try {
      return parseGeoPoint(JSON.parse(trimmed))
    } catch {
      const [longitude, latitude] = trimmed.split(',').map(item => item.trim())
      const lng = finiteCoordinate(longitude, -180, 180)
      const lat = finiteCoordinate(latitude, -90, 90)
      return lng === undefined || lat === undefined ? undefined : { longitude: lng, latitude: lat }
    }
  }
  const point = asRecord(value)
  const longitude = finiteCoordinate(point.lon ?? point.lng ?? point.longitude, -180, 180)
  const latitude = finiteCoordinate(point.lat ?? point.latitude, -90, 90)
  if (longitude !== undefined && latitude !== undefined) return { longitude, latitude }
  if (Array.isArray(value) && value.length >= 2) {
    const lng = finiteCoordinate(value[0], -180, 180)
    const lat = finiteCoordinate(value[1], -90, 90)
    return lng === undefined || lat === undefined ? undefined : { longitude: lng, latitude: lat }
  }
  return undefined
}

const coordinateField = (alias: string, coordinate: 'longitude' | 'latitude') => `${alias}_${coordinate}`

const timeSortValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = text(value).replace(' ', 'T')
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const padTimePart = (value: number) => String(value).padStart(2, '0')

const formatBucketTime = (timestamp: number, interval: string) => {
  const date = new Date(timestamp)
  if (interval === '1m') date.setSeconds(0, 0)
  else if (interval === '1h') date.setMinutes(0, 0, 0)
  else if (interval === '1d') date.setHours(0, 0, 0, 0)
  else if (interval === '1w') {
    const day = date.getDay() || 7
    date.setDate(date.getDate() - day + 1)
    date.setHours(0, 0, 0, 0)
  }
  else if (interval === '1M') {
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
  }
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`
    + (interval === '1d' || interval === '1w' || interval === '1M'
      ? ''
      : ` ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:00`)
}

const rawPropertyValue = (input: unknown) => {
  const row = asRecord(input)
  const nested = asRecord(row.value)
  return {
    timestamp: timeSortValue(row.timestamp ?? nested.timestamp ?? row.createTime),
    value: 'value' in nested ? nested.value : row.value,
  }
}

interface IotDevicePropertyHistoryPage {
  records: unknown[]
  total?: number
}

const finiteRecordCount = (value: unknown) => {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : undefined
}

const normalizeIotDevicePropertyHistoryPage = (
  response: unknown,
  depth = 0,
): IotDevicePropertyHistoryPage => {
  if (Array.isArray(response)) return { records: response }
  const result = asRecord(response)
  const directRecords = [result.records, result.data, result.result].find(Array.isArray)
  if (Array.isArray(directRecords)) {
    return {
      records: directRecords,
      total: finiteRecordCount(result.total ?? result.count),
    }
  }
  if (depth < 3) {
    for (const nested of [result.result, result.data]) {
      if (!nested || nested === response || typeof nested !== 'object') continue
      const page = normalizeIotDevicePropertyHistoryPage(nested, depth + 1)
      if (page.records.length || Object.keys(asRecord(nested)).length) {
        return {
          records: page.records,
          total: finiteRecordCount(result.total ?? result.count) ?? page.total,
        }
      }
    }
  }
  return {
    records: [],
    total: finiteRecordCount(result.total ?? result.count),
  }
}

/** Collects ascending history pages under a caller-owned hard record budget. */
export const collectBoundedIotDevicePropertyHistory = async (
  queryPage: (pageIndex: number, pageSize: number) => Promise<unknown>,
  maxRecords: number,
  pageSize = 1000,
) => {
  const records: unknown[] = []
  let total: number | undefined
  let pageIndex = 0
  while (records.length < maxRecords) {
    const currentPageSize = Math.min(pageSize, maxRecords - records.length)
    const page = normalizeIotDevicePropertyHistoryPage(await queryPage(pageIndex, currentPageSize))
    total = page.total ?? total
    records.push(...page.records.slice(0, currentPageSize))
    if (!page.records.length
      || page.records.length < currentPageSize
      || (total !== undefined && records.length >= total)) break
    pageIndex += 1
  }
  return {
    records,
    total,
    truncated: total === undefined ? records.length >= maxRecords : records.length < total,
  }
}

/** Uses observed timestamps because a mostly empty requested range must not collapse a path. */
export const resolveIotDevicePropertyOrderedPathInterval = (
  recordsByProperty: Readonly<Record<string, readonly unknown[]>>,
) => {
  const timestamps = Object.values(recordsByProperty)
    .flatMap(records => records.map(record => rawPropertyValue(record).timestamp))
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

export const refineIotDevicePropertyOrderedPathInterval = (
  requested: string,
  recordsByProperty: Readonly<Record<string, readonly unknown[]>>,
) => {
  const observed = resolveIotDevicePropertyOrderedPathInterval(recordsByProperty)
  return (ORDERED_PATH_INTERVAL_RANK.get(observed) ?? Number.MAX_SAFE_INTEGER)
    < (ORDERED_PATH_INTERVAL_RANK.get(requested) ?? Number.MAX_SAFE_INTEGER)
    ? observed
    : requested
}

/**
 * Some storage adapters cannot aggregate complex GeoPoint values. This bounded fallback keeps the
 * same public aggregate contract while selecting FIRST/LAST from the requested raw time range.
 */
export const aggregateIotDeviceGeoPointHistory = (
  recordsByProperty: Readonly<Record<string, readonly unknown[]>>,
  columns: readonly IotDevicePropertyAggregateColumn[],
  interval: string,
) => {
  const buckets = new Map<string, Record<string, unknown>>()
  const byProperty = new Map<string, IotDevicePropertyAggregateColumn[]>()
  columns.forEach((column) => {
    const current = byProperty.get(column.property) || []
    current.push(column)
    byProperty.set(column.property, current)
  })
  byProperty.forEach((propertyColumns, propertyId) => {
    const records = [...(recordsByProperty[propertyId] || [])]
      .map(rawPropertyValue)
      .filter((record): record is { timestamp: number; value: unknown } => record.timestamp !== undefined)
      .sort((left, right) => left.timestamp - right.timestamp)
    records.forEach((record) => {
      const time = formatBucketTime(record.timestamp, interval)
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
  return normalizeIotDevicePropertyAggregateRows([...buckets.values()], columns)
}

export const mergeIotDevicePropertyAggregateRows = (
  groups: readonly (readonly Record<string, unknown>[])[],
) => {
  const merged = new Map<string, Record<string, unknown>>()
  groups.flat().forEach((row) => {
    const key = text(row.time)
    if (!key) return
    merged.set(key, { ...(merged.get(key) || {}), ...row, time: row.time })
  })
  return [...merged.values()].sort((left, right) => (
    (timeSortValue(left.time) ?? Number.MAX_SAFE_INTEGER)
    - (timeSortValue(right.time) ?? Number.MAX_SAFE_INTEGER)
  ))
}

export interface IotDevicePropertyAggregateTransport {
  data: Record<string, unknown>[]
  bucketCount: number
  populatedBucketCount: number
  measurementCount: number
  missingBucketCount: number
  samplingSemantics: 'observed_only'
}

const hasAggregateMeasurement = (
  value: unknown,
  field: AiClientToolOutputField,
) => {
  if (value === undefined || value === null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string'
    && ['number', 'longitude', 'latitude', 'duration'].includes(field.semanticRole)) {
    return value.trim() !== '' && Number.isFinite(Number(value))
  }
  // Empty categories and false states can be real domain values; absence is represented by null/undefined.
  return true
}

/**
 * Omits buckets with no observed measure while retaining the evaluated bucket capacity separately.
 * This is a transport optimization only: it never fills gaps or changes a complete query into a partial one.
 */
export const createIotDevicePropertyAggregateTransport = (
  rows: readonly Record<string, unknown>[],
  fields: readonly AiClientToolOutputField[],
): IotDevicePropertyAggregateTransport => {
  const measureFields = fields.filter(field => field.semanticRole !== 'timestamp')
  let measurementCount = 0
  const data = rows.filter((row) => {
    const count = measureFields.reduce((total, field) => (
      total + (hasAggregateMeasurement(row[field.name], field) ? 1 : 0)
    ), 0)
    measurementCount += count
    return count > 0
  })
  return {
    data,
    bucketCount: rows.length,
    populatedBucketCount: data.length,
    measurementCount,
    missingBucketCount: rows.length - data.length,
    samplingSemantics: 'observed_only',
  }
}

export const normalizeIotDevicePropertyAggregateRows = (
  rows: readonly unknown[],
  columns: readonly IotDevicePropertyAggregateColumn[],
) => rows
  .filter(isRecord)
  .map((row, index) => {
    const record: Record<string, unknown> = {
      time: row.time ?? row.timestamp ?? row.createTime,
    }
    columns.forEach((column) => {
      const value = row[column.alias] ?? row[column.property]
      if (column.geoPointValue) {
        const point = parseGeoPoint(value)
        if (point) {
          record[coordinateField(column.alias, 'longitude')] = point.longitude
          record[coordinateField(column.alias, 'latitude')] = point.latitude
        }
        return
      }
      if (value !== undefined) record[column.alias] = value
    })
    return { record, index, order: timeSortValue(record.time) }
  })
  .sort((left, right) => {
    if (left.order === undefined && right.order === undefined) return left.index - right.index
    if (left.order === undefined) return 1
    if (right.order === undefined) return -1
    return left.order - right.order
  })
  .map(item => item.record)

export const createIotDevicePropertyAggregateFields = (
  columns: readonly IotDevicePropertyAggregateColumn[],
  copy: Pick<AggregateCopy, 'longitude' | 'latitude'>,
): AiClientToolOutputField[] => [
  { name: 'time', semanticRole: 'timestamp', format: 'datetime' },
  ...columns.flatMap((column): AiClientToolOutputField[] => {
    if (column.geoPointValue) {
      return [
        {
          name: coordinateField(column.alias, 'longitude'),
          semanticRole: 'longitude',
          label: copy.longitude(column.propertyLabel),
          measure: column.alias,
          aggregation: column.agg.toLowerCase(),
        },
        {
          name: coordinateField(column.alias, 'latitude'),
          semanticRole: 'latitude',
          label: copy.latitude(column.propertyLabel),
          measure: column.alias,
          aggregation: column.agg.toLowerCase(),
        },
      ]
    }
    const counted = column.agg === 'COUNT' || column.agg === 'DISTINCT_COUNT'
    return [{
      name: column.alias,
      semanticRole: NUMERIC_TYPES.has(column.propertyType) || counted ? 'number' : 'category',
      label: column.propertyLabel,
      measure: column.alias,
      aggregation: column.agg.toLowerCase(),
      ...(counted ? { unit: 'count' } : column.unit ? { unit: column.unit } : {}),
    }]
  }),
]

export const resolveIotDevicePropertyAggregateFields = (result: unknown): readonly AiClientToolOutputField[] => {
  const record = asRecord(result)
  return Array.isArray(record.outputFields) ? record.outputFields as AiClientToolOutputField[] : []
}

export type IotDevicePropertyAggregateOutputLabelKind =
  | 'avg'
  | 'max'
  | 'min'
  | 'first'
  | 'last'
  | 'count'
  | 'distinct_count'
  | 'value'
  | 'ordered_path'

/**
 * Resolves an execution label only from producer-declared field labels, aggregation, semantic roles and ordering.
 * Stable binding identity remains static, and no property key or sample value participates in this decision.
 */
export const resolveIotDevicePropertyAggregateOutputLabel = (
  fields: readonly AiClientToolOutputField[],
  ordering: AiClientToolOrdering | undefined,
  format: (kind: IotDevicePropertyAggregateOutputLabelKind, labels: readonly string[]) => string,
) => {
  const normalizedFields = fields || []
  const labels = (selected: readonly AiClientToolOutputField[]) => Array.from(new Set(
    selected.map(field => text(field.label)).filter(Boolean),
  )).slice(0, 4)
  const longitude = normalizedFields.filter(field => field.semanticRole === 'longitude')
  const latitude = normalizedFields.filter(field => field.semanticRole === 'latitude')
  const timestampNames = new Set(
    normalizedFields.filter(field => field.semanticRole === 'timestamp').map(field => field.name),
  )
  const orderedByTimestamp = !!ordering?.producerGuaranteed
    && ordering.keys.some(key => timestampNames.has(key.field))
  if (longitude.length === 1
    && latitude.length === 1
    && text(longitude[0].measure)
    && text(longitude[0].measure).toLowerCase() === text(latitude[0].measure).toLowerCase()
    && orderedByTimestamp) {
    const coordinateLabels = labels([...longitude, ...latitude])
    return coordinateLabels.length ? format('ordered_path', coordinateLabels) : undefined
  }

  const values = normalizedFields.filter(field => (
    field.semanticRole === 'number' || field.semanticRole === 'duration'
  ))
  const valueLabels = labels(values)
  if (!values.length || !valueLabels.length) return undefined
  const aggregations = Array.from(new Set(values.map(field => text(field.aggregation).toLowerCase()).filter(Boolean)))
  if (aggregations.length !== 1) return format('value', valueLabels)
  const aggregation = aggregations[0] as IotDevicePropertyAggregateOutputLabelKind
  const supported: readonly IotDevicePropertyAggregateOutputLabelKind[] = [
    'avg', 'max', 'min', 'first', 'last', 'count', 'distinct_count',
  ]
  return format(supported.includes(aggregation) ? aggregation : 'value', valueLabels)
}

export const resolveIotDevicePropertyAggregateObservedRange = (
  data: readonly Record<string, unknown>[],
) => {
  let start: number | undefined
  let end: number | undefined
  data.forEach((item) => {
    const timestamp = timeSortValue(item.time)
    if (timestamp === undefined) return
    start = start === undefined ? timestamp : Math.min(start, timestamp)
    end = end === undefined ? timestamp : Math.max(end, timestamp)
  })
  return start === undefined || end === undefined ? undefined : { start, end }
}
