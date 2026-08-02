import { getPropertiesInfo, getPropertyData } from '@device-manager-ui/api/instance'
import {
  createAiClientToolArrayRecordSource,
  createAiClientToolRecordStream,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import {
  type ClientToolInput,
  type CompiledClientTool,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import {
  createDevicePropertyAggregateDefinition,
  createDevicePropertySelectorAlternatives,
  devicePropertyAnalysisResult,
  DEVICE_PROPERTY_ANALYSIS_OUTPUTS,
} from './devicePropertyAnalysisTools'
import {
  aggregateDevicePropertyGeoPointHistory,
  clampDevicePropertyAggregateInlineLimit,
  compactDevicePropertyAggregateValue,
  createDevicePropertyAggregateColumns,
  createDevicePropertyAggregateFields,
  createDevicePropertyAggregateRecordSchema,
  devicePropertyAggregateTimeFormat,
  findDevicePropertyMetadata,
  isDevicePropertyAggregateGeoPointValueColumn,
  mergeDevicePropertyAggregateRows,
  normalizeDevicePropertyAggregate,
  normalizeDevicePropertyAggregateData,
  normalizeDevicePropertyAggregateInterval,
  normalizeDevicePropertyAggregateTimeRange,
  normalizeDevicePropertyIds,
  refineDevicePropertyOrderedPathInterval,
  resolveDevicePropertyAggregateObservedRange,
  shouldInlineDevicePropertyAggregate,
  type DevicePropertyAggregateTimeRange,
  type DevicePropertyAggregateRecord,
} from './propertyAggregateSupport'

export {
  DEVICE_PROPERTY_ANALYSIS_OUTPUTS,
} from './devicePropertyAnalysisTools'
export type { DevicePropertyAggregateTimeRange } from './propertyAggregateSupport'

type JsonRecord = DevicePropertyAggregateRecord
type MaybePromise<T> = T | Promise<T>

const GEO_POINT_HISTORY_PAGE_SIZE = 1000
const GEO_POINT_HISTORY_RECORD_LIMIT = 10_000

interface DevicePropertyHistoryPage {
  records: unknown[]
  total?: number
}

const asJsonRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
)

const finiteRecordCount = (value: unknown) => {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : undefined
}

const normalizeDevicePropertyHistoryPage = (
  response: unknown,
  depth = 0,
): DevicePropertyHistoryPage => {
  if (Array.isArray(response)) return { records: response }
  const result = asJsonRecord(response)
  const directRecords = [result.records, result.data, result.result]
    .find(Array.isArray)
  if (Array.isArray(directRecords)) {
    return {
      records: directRecords,
      total: finiteRecordCount(result.total ?? result.count),
    }
  }
  if (depth < 3) {
    for (const nested of [result.result, result.data]) {
      if (!nested || nested === response || typeof nested !== 'object') continue
      const page = normalizeDevicePropertyHistoryPage(nested, depth + 1)
      if (page.records.length || Object.keys(asJsonRecord(nested)).length) {
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

const collectDevicePropertyHistory = async (
  deviceId: string,
  propertyId: string,
  range: Required<DevicePropertyAggregateTimeRange>,
  maxRecords: number,
) => {
  const records: unknown[] = []
  let total: number | undefined
  let pageIndex = 0
  while (records.length < maxRecords) {
    const pageSize = Math.min(GEO_POINT_HISTORY_PAGE_SIZE, maxRecords - records.length)
    const response = await getPropertyData(deviceId, propertyId, {
      paging: true,
      pageIndex,
      pageSize,
      sorts: [{ name: 'timestamp', order: 'asc' }],
      terms: [{
        column: 'timestamp',
        termType: 'btw',
        value: [range.start, range.end],
      }],
    })
    const page = normalizeDevicePropertyHistoryPage(response)
    total = page.total ?? total
    records.push(...page.records.slice(0, pageSize))
    if (!page.records.length
      || page.records.length < pageSize
      || (total !== undefined && records.length >= total)) break
    pageIndex += 1
  }
  return {
    records,
    total,
    truncated: total === undefined
      ? records.length >= maxRecords
      : records.length < total,
  }
}

export interface DevicePropertyAggregateSubject {
  deviceId: string
  metadata: JsonRecord
}

export interface DevicePropertyAggregateCopy {
  description: string
  help: string
  propertyId: string
  propertyIds: string
  aggregation: string
  interval: string
  startTime: string
  endTime: string
  timeRangeInput: ClientToolInput
  limit: string
  deviceIdMissing: string
  propertyIdMissing: string
  nonNumericWarning: (propertyId: string) => string
  longitudeLabel: (propertyLabel: string) => string
  latitudeLabel: (propertyLabel: string) => string
  pathResolutionAdjusted: (requested: string, resolved: string) => string
  truncated: string
}

export interface DevicePropertyAggregateToolDependencies<TContext> {
  copy: DevicePropertyAggregateCopy
  resolveSubject: (
    args: JsonRecord,
    context: TContext,
  ) => MaybePromise<DevicePropertyAggregateSubject>
  resolveTimeRange: (args: JsonRecord) => DevicePropertyAggregateTimeRange
  describeTimeRange: (range: DevicePropertyAggregateTimeRange) => JsonRecord | undefined
  dataTypeText: (valueType: unknown) => string
  compactValue?: (value: unknown, maxLength: number) => unknown
  decorateInputs?: (inputs: ClientToolInput[]) => ClientToolInput[]
  resolveRecordPath?: (args: JsonRecord) => string | undefined
  displayName?: string
  progressText?: string
}

/**
 * Creates the single property-aggregation producer used by both device-detail and domain entry points.
 * Adapters own authorization, page context, copy and optional file delivery; query and evidence semantics
 * remain identical across entries.
 */
export const createDevicePropertyAggregateTool = <TContext>(
  dependencies: DevicePropertyAggregateToolDependencies<TContext>,
): CompiledClientTool<TContext> => {
  const { copy } = dependencies
  const baseInputs: ClientToolInput[] = [
    { id: 'propertyId', name: 'propertyId', description: copy.propertyId, required: false, valueType: 'string' },
    {
      id: 'propertyIds',
      name: 'propertyIds',
      description: copy.propertyIds,
      required: false,
      valueType: { type: 'array', elementType: { type: 'string' } },
    },
    { id: 'agg', name: 'agg', description: copy.aggregation, required: false, valueType: 'string' },
    { id: 'interval', name: 'interval', description: copy.interval, required: false, valueType: 'string' },
    { id: 'startTime', name: 'startTime', description: copy.startTime, required: false, valueType: 'string' },
    { id: 'endTime', name: 'endTime', description: copy.endTime, required: false, valueType: 'string' },
    copy.timeRangeInput,
    { id: 'limit', name: 'limit', description: copy.limit, required: false, valueType: 'int' },
  ]
  return createDevicePropertyAggregateDefinition<TContext>({
    copy: {
      description: copy.description,
      help: copy.help,
      displayName: dependencies.displayName,
      progressText: dependencies.progressText,
    },
    inputs: dependencies.decorateInputs ? dependencies.decorateInputs(baseInputs) : baseInputs,
    inputAlternatives: createDevicePropertySelectorAlternatives(),
    execute: async (args, context, call) => {
      const subject = await dependencies.resolveSubject(args, context)
      const deviceId = String(subject.deviceId || '').trim()
      if (!deviceId) throw new Error(copy.deviceIdMissing)
      const propertyIds = normalizeDevicePropertyIds(args)
      if (!propertyIds.length) throw new Error(copy.propertyIdMissing)
      const requested = normalizeDevicePropertyAggregate(args.agg ?? args.aggregate ?? args.method)
      const range = normalizeDevicePropertyAggregateTimeRange(dependencies.resolveTimeRange(args))
      const requestedInterval = normalizeDevicePropertyAggregateInterval(args.interval, range)
      const { columns, warnings } = createDevicePropertyAggregateColumns(
        subject.metadata,
        propertyIds,
        requested,
        copy.nonNumericWarning,
      )
      const scalarColumns = columns.filter(column => (
        !isDevicePropertyAggregateGeoPointValueColumn(subject.metadata, column)
      ))
      const geoPointColumns = columns.filter(column => (
        isDevicePropertyAggregateGeoPointValueColumn(subject.metadata, column)
      ))
      const scalarResponse = scalarColumns.length
        ? await getPropertiesInfo(deviceId, {
            columns: scalarColumns,
            query: {
              interval: requestedInterval,
              format: devicePropertyAggregateTimeFormat(requestedInterval),
              from: range.start,
              to: range.end,
            },
          })
        : []
      const scalarResult = scalarColumns.length
        ? normalizeDevicePropertyAggregateData(
            scalarResponse,
            subject.metadata,
            scalarColumns,
            dependencies.compactValue || compactDevicePropertyAggregateValue,
          ).reverse()
        : []
      const geoPointPropertyIds = Array.from(new Set(geoPointColumns.map(column => column.property)))
      const geoPointHistory: Record<string, readonly unknown[]> = {}
      let remainingRecordBudget = GEO_POINT_HISTORY_RECORD_LIMIT
      let geoPointRecordCount = 0
      let geoPointHistoryTruncated = false
      for (const [index, propertyId] of geoPointPropertyIds.entries()) {
        // Share one hard record budget across every complex property so adding fields cannot create
        // an unbounded fan-out. Unused capacity rolls forward to the remaining properties.
        const remainingProperties = geoPointPropertyIds.length - index
        const propertyLimit = Math.max(1, Math.floor(remainingRecordBudget / remainingProperties))
        const history = await collectDevicePropertyHistory(deviceId, propertyId, range, propertyLimit)
        geoPointHistory[propertyId] = history.records
        geoPointRecordCount += history.records.length
        remainingRecordBudget -= history.records.length
        geoPointHistoryTruncated ||= history.truncated
      }
      // Closed paths use the finer of the requested and observed-safe buckets. Coarse calendar
      // ranges otherwise collapse a dense movement path into one or two statistically valid points.
      const interval = columns.length === 1 && geoPointColumns.length === 1
        ? refineDevicePropertyOrderedPathInterval(requestedInterval, geoPointHistory)
        : requestedInterval
      const geoPointResult = aggregateDevicePropertyGeoPointHistory(
        geoPointHistory,
        geoPointColumns,
        interval,
      )
      const resolutionAdjusted = interval !== requestedInterval
      const aggregateWarnings = [
        ...warnings,
        ...(resolutionAdjusted
          ? [copy.pathResolutionAdjusted(requestedInterval, interval)]
          : []),
        ...(geoPointHistoryTruncated ? [copy.truncated] : []),
      ]
      const format = devicePropertyAggregateTimeFormat(interval)
      const mergedResponse = mergeDevicePropertyAggregateRows([scalarResult, geoPointResult])
      const compactValue = dependencies.compactValue || compactDevicePropertyAggregateValue
      const data = normalizeDevicePropertyAggregateData(
        mergedResponse,
        subject.metadata,
        columns,
        compactValue,
      )
      const limit = clampDevicePropertyAggregateInlineLimit(args.limit)
      const aggregates = new Map(columns.map(column => [column.property, column.agg]))
      const base = {
        deviceId,
        propertyIds,
        properties: propertyIds.map((propertyId) => {
          const property = findDevicePropertyMetadata(subject.metadata, propertyId)
          return {
            id: propertyId,
            name: property?.name,
            valueType: dependencies.dataTypeText(property?.valueType),
            aggregate: aggregates.get(propertyId),
          }
        }),
        interval,
        format,
        timeRange: dependencies.describeTimeRange(range),
        total: data.length,
        rawRecordCount: geoPointRecordCount || undefined,
        requestedInterval: resolutionAdjusted ? requestedInterval : undefined,
        resolutionAdjusted: resolutionAdjusted || undefined,
        warnings: aggregateWarnings.length ? aggregateWarnings : undefined,
      }
      const fields = createDevicePropertyAggregateFields(subject.metadata, columns, {
        longitude: copy.longitudeLabel,
        latitude: copy.latitudeLabel,
      })
      const recordPath = dependencies.resolveRecordPath?.(args)
      // Large or explicitly exported results use the shared streaming delivery lifecycle; small
      // aggregates and byte-bounded ordered paths stay inline so the canonical compiler can derive
      // a renderer-ready chart without asking the model to redraw or truncate the producer result.
      const records = recordPath || !shouldInlineDevicePropertyAggregate(data, fields, limit)
        ? createAiClientToolRecordStream({
            source: createAiClientToolArrayRecordSource(data),
            schema: createDevicePropertyAggregateRecordSchema(fields),
            bindingName: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.name,
            ...(dependencies.displayName ? { bindingLabel: dependencies.displayName } : {}),
            outputShape: DEVICE_PROPERTY_ANALYSIS_OUTPUTS.aggregate.shape,
            timeRange: range,
            summary: { deviceId, propertyIds, interval, total: data.length },
            ...(recordPath ? { path: recordPath } : {}),
            limits: {
              fallbackSampleLimit: Math.min(20, limit),
              previewLimit: Math.min(3, limit),
            },
          })
        : data
      return devicePropertyAnalysisResult({ records, fields }, {
        status: data.length ? 'ok' : 'empty',
        complete: !geoPointHistoryTruncated,
        truncated: geoPointHistoryTruncated,
        limitReason: geoPointHistoryTruncated ? 'records' : undefined,
        requestedRange: range,
        observedRange: resolveDevicePropertyAggregateObservedRange(data),
        summary: base,
        facts: {
          deviceId,
          propertyCount: propertyIds.length,
          bucketCount: data.length,
          rawRecordCount: geoPointRecordCount || undefined,
          interval,
          requestedInterval: resolutionAdjusted ? requestedInterval : undefined,
          resolutionAdjusted: resolutionAdjusted || undefined,
        },
        warnings: aggregateWarnings,
      })
    },
  })
}
