import i18n from '@jetlinks-web-core/locales'
import {
  createDomainAgentAggregateCardinality,
  createDomainAgentClaim,
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentEnum,
  resolveDomainAgentInteger,
  resolveDomainAgentStringList,
  resolveDomainAgentTimeRange,
  resolveDomainAgentMessage,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import {
  createAiClientToolNdjsonSource,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolNdjsonSource'
import {
  createAiClientToolRecordStream,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolResultDelivery'
import {
  buildDevicePropertyNoPagingUrl,
  extractRows,
  iotDeviceDetailRealApi,
  parseMetadata,
} from '@device-manager-ui/views/device/list/services/iotDeviceDetailReal.service'
import {
  IOT_DEVICE_PROPERTY_AGGREGATES,
  IOT_DEVICE_PROPERTY_ANALYSIS_MODES,
  IOT_DEVICE_PROPERTY_INTERVALS,
} from './constants'
import {
  aggregateIotDeviceGeoPointHistory,
  collectBoundedIotDevicePropertyHistory,
  createIotDevicePropertyAggregateFields,
  createIotDevicePropertyAggregatePlan,
  createIotDevicePropertyAggregateTransport,
  mergeIotDevicePropertyAggregateRows,
  normalizeIotDevicePropertyAggregate,
  normalizeIotDevicePropertyAggregateInput,
  normalizeIotDevicePropertyAggregateInterval,
  normalizeIotDevicePropertyIds,
  normalizeIotDevicePropertyAggregateRows,
  normalizeIotDevicePropertyAnalysisMode,
  refineIotDevicePropertyOrderedPathInterval,
  resolveIotDevicePropertyAggregateModeIssue,
  resolveIotDevicePropertyAggregateObservedRange,
  type IotDevicePropertyAggregate,
} from './devicePropertyAggregate.support'
import {
  asRecord,
  findProperty,
  getMetadata,
  getRawDevice,
  inputError,
  isRecord,
  normalizeText,
  runDeviceTool,
  runDeviceToolExecution,
  unwrapResult,
} from './deviceAnalysis.shared'

type Aggregate = typeof IOT_DEVICE_PROPERTY_AGGREGATES[number]

const GEO_POINT_HISTORY_PAGE_SIZE = 1000
const GEO_POINT_HISTORY_RECORD_LIMIT = 10_000

const aggregateText = (key: string, params?: Record<string, unknown>) => (
  i18n.global.t(`IotGeneralAgent.propertyAggregate.${key}`, params || {})
)

interface PropertyHistoryRecord {
  deviceId: string
  propertyId: string
  timestamp?: unknown
  value?: unknown
  formatValue?: unknown
}

const PROPERTY_HISTORY_SCHEMA = {
  type: 'object',
  properties: {
    deviceId: { type: 'string', 'x-ai-role': 'identifier' },
    propertyId: { type: 'string', 'x-ai-role': 'identifier' },
    timestamp: { type: 'number', 'x-ai-role': 'timestamp' },
    value: {},
    formatValue: {},
  },
}

const mapLatestDashboardValue = (input: unknown) => {
  const item = asRecord(input)
  const itemData = asRecord(item.data)
  const value = asRecord(itemData.value || item.value)
  return {
    property: value.property,
    value: value.value,
    formatValue: value.formatValue ?? value.value,
    timestamp: itemData.timestamp ?? value.timestamp,
    timeString: itemData.timeString ?? value.timeString,
  }
}

const mapPropertyHistoryRecord = (
  input: unknown,
  deviceId: string,
  propertyId: string,
): PropertyHistoryRecord => {
  const row = asRecord(input)
  const value = isRecord(row.value) ? row.value : row
  return {
    deviceId,
    propertyId,
    value: value.value ?? row.value,
    formatValue: value.formatValue ?? row.formatValue ?? value.value ?? row.value,
    timestamp: row.timestamp ?? value.timestamp,
  }
}

export const devicePropertyService = {
  latestProperties: (args: Record<string, unknown>) => runDeviceTool<Array<Record<string, unknown>>>([], async () => {
    const deviceIds = resolveDomainAgentStringList(args.deviceIds ?? args.deviceId, { name: 'deviceIds', max: 20 })
    const propertyIds = resolveDomainAgentStringList(args.propertyIds, { name: 'propertyIds', max: 20 })
    if (!deviceIds.length || !propertyIds.length) {
      throw inputError('DEVICE_PROPERTY_REQUIRED', 'devicePropertiesRequired')
    }
    const devices = await Promise.all(deviceIds.map(getRawDevice))
    devices.forEach((device) => {
      const metadata = parseMetadata(device.metadata || device.deriveMetadata || device.productMetadata)
      propertyIds.forEach(propertyId => findProperty(metadata, propertyId))
    })
    const response = await iotDeviceDetailRealApi.queryDashboard(devices.map(device => ({
      dashboard: 'device',
      object: device.productId || device.id,
      measurement: 'properties',
      dimension: 'history',
      group: device.id,
      params: { deviceId: device.id, history: 1, properties: propertyIds },
    })))
    const rows = extractRows(unwrapResult<unknown>(response)) as unknown[]
    const data = rows.map((item) => ({
      deviceId: asRecord(item).group,
      ...mapLatestDashboardValue(item),
    }))
    return createDomainAgentToolResult({
      domain: 'device',
      summary: { deviceCount: deviceIds.length, propertyCount: propertyIds.length, returned: data.length },
      facts: { deviceCount: deviceIds.length, propertyCount: propertyIds.length, returned: data.length },
      data,
      total: data.length,
      cardinality: createDomainAgentRecordSetCardinality({ returnedCount: data.length }),
    })
  }),

  propertyHistory: (args: Record<string, unknown>) => runDeviceTool<Array<Record<string, unknown>>>([], async () => {
    const deviceId = normalizeText(args.deviceId)
    const propertyId = normalizeText(args.propertyId)
    if (!deviceId || !propertyId) throw inputError('DEVICE_PROPERTY_REQUIRED', 'devicePropertyRequired')
    const range = resolveDomainAgentTimeRange(args)
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize ?? args.limit, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const { metadata } = await getMetadata(deviceId)
    findProperty(metadata, propertyId)
    const response = await iotDeviceDetailRealApi.queryPropertyData(deviceId, propertyId, {
      pageIndex,
      pageSize,
      sorts: [{ name: 'timestamp', order: 'desc' }],
      terms: [{ terms: [{ column: 'timestamp', termType: 'btw', value: [range.start, range.end] }] }],
    })
    const result = asRecord(unwrapResult<unknown>(response))
    const data = (extractRows(result) as unknown[]).map((input) => {
      const row = asRecord(input)
      const value = isRecord(row.value) ? row.value : row
      return {
        value: value.value ?? row.value,
        formatValue: value.formatValue ?? row.formatValue ?? value.value ?? row.value,
        timestamp: row.timestamp ?? value.timestamp,
      }
    })
    const total = Number(result.total ?? data.length)
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId, propertyId, returned: data.length, total },
      facts: { deviceId, propertyId, returned: data.length, total },
      claims: [createDomainAgentClaim(
        'recordCount',
        resolveDomainAgentMessage('components.AiChat.domainAgent.claims.recordCount'),
        total,
        'integer',
      )],
      data,
      total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: data.length,
        totalCount: total,
      }),
      truncated: (pageIndex + 1) * pageSize < total,
      nextPage: (pageIndex + 1) * pageSize < total ? pageIndex + 1 : undefined,
      supportsAbsenceClaim: total === 0,
    })
  }),

  propertyHistoryRecords: (
    args: Record<string, unknown>,
  ) => runDeviceToolExecution([], async () => {
    const deviceId = normalizeText(args.deviceId)
    const propertyId = normalizeText(args.propertyId)
    if (!deviceId || !propertyId) throw inputError('DEVICE_PROPERTY_REQUIRED', 'devicePropertyRequired')
    const range = resolveDomainAgentTimeRange(args)
    const { metadata } = await getMetadata(deviceId)
    findProperty(metadata, propertyId)
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: {
        deviceId,
        propertyId,
      },
      facts: { deviceId, propertyId },
      data: createAiClientToolRecordStream({
        source: createAiClientToolNdjsonSource({
          url: buildDevicePropertyNoPagingUrl(deviceId, propertyId),
          data: {
            paging: false,
            sorts: [{ name: 'timestamp', order: 'asc' }],
            terms: [{ terms: [{ column: 'timestamp', termType: 'btw', value: [range.start, range.end] }] }],
          },
          mapRow: row => mapPropertyHistoryRecord(row, deviceId, propertyId),
        }),
        schema: PROPERTY_HISTORY_SCHEMA,
        timeRange: { ...range },
      }),
    })
  }),

  propertyAggregate: (args: Record<string, unknown>) => runDeviceTool<Array<Record<string, unknown>>>([], async () => {
    const deviceId = normalizeText(args.deviceId)
    const propertyIds = resolveDomainAgentStringList(normalizeIotDevicePropertyIds(args), {
      name: 'propertyIds',
      max: 10,
    })
    if (!deviceId || !propertyIds.length) throw inputError('DEVICE_PROPERTY_REQUIRED', 'devicePropertyListRequired')
    const aggregateInput = normalizeIotDevicePropertyAggregateInput(args)
    const aggregate = aggregateInput
      ? resolveDomainAgentEnum(
          normalizeIotDevicePropertyAggregate(aggregateInput) ?? aggregateInput.toUpperCase(),
          IOT_DEVICE_PROPERTY_AGGREGATES,
          { name: 'aggregate' },
        ) as Aggregate
      : undefined
    const analysisMode = resolveDomainAgentEnum(
      normalizeIotDevicePropertyAnalysisMode(args.analysisMode) ?? normalizeText(args.analysisMode),
      IOT_DEVICE_PROPERTY_ANALYSIS_MODES,
      { name: 'analysisMode' },
    )
    const range = resolveDomainAgentTimeRange(args)
    const interval = resolveDomainAgentEnum(
      normalizeIotDevicePropertyAggregateInterval(args.interval, range),
      IOT_DEVICE_PROPERTY_INTERVALS,
      { name: 'interval' },
    )
    const { metadata } = await getMetadata(deviceId)
    propertyIds.forEach(propertyId => findProperty(metadata, propertyId))
    const modeIssue = resolveIotDevicePropertyAggregateModeIssue(
      metadata,
      propertyIds,
      aggregate as IotDevicePropertyAggregate | undefined,
      analysisMode,
    )
    if (modeIssue) {
      throw inputError(
        `DEVICE_PROPERTY_${modeIssue.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`,
        modeIssue,
      )
    }
    const plan = createIotDevicePropertyAggregatePlan(
      metadata,
      propertyIds,
      aggregate as IotDevicePropertyAggregate | undefined,
      analysisMode,
      {
        unsupported: (propertyLabel, ignored) => aggregateText('unsupported', {
          property: propertyLabel,
          aggregates: ignored.join(', '),
        }),
      },
    )
    const scalarColumns = plan.columns.filter(column => !column.geoPointValue)
    const geoPointColumns = plan.columns.filter(column => column.geoPointValue)
    const aggregateRows = scalarColumns.length
      ? await iotDeviceDetailRealApi.queryPropertyAggregation(deviceId, {
          columns: scalarColumns.map(({ property, alias, agg }) => ({ property, alias, agg })),
          query: {
            interval,
            format: interval === '1d' || interval === '1w' || interval === '1M'
              ? 'yyyy-MM-dd'
              : 'yyyy-MM-dd HH:mm:ss',
            from: range.start,
            to: range.end,
          },
        }).then((response: unknown) => normalizeIotDevicePropertyAggregateRows(
          extractRows(unwrapResult<unknown>(response)) as unknown[],
          scalarColumns,
        ))
      : []
    const geoPointPropertyIds = Array.from(new Set(geoPointColumns.map(column => column.property)))
    const geoPointRecords: Record<string, readonly unknown[]> = {}
    let remainingRecordBudget = GEO_POINT_HISTORY_RECORD_LIMIT
    let rawRecordCount = 0
    let historyTruncated = false
    for (const [index, propertyId] of geoPointPropertyIds.entries()) {
      // Complex properties share one hard budget so adding fields cannot create an unbounded fan-out.
      const remainingProperties = geoPointPropertyIds.length - index
      const propertyLimit = Math.max(1, Math.floor(remainingRecordBudget / remainingProperties))
      const history = await collectBoundedIotDevicePropertyHistory(
        (pageIndex, pageSize) => iotDeviceDetailRealApi.queryPropertyData(deviceId, propertyId, {
          paging: true,
          pageIndex,
          pageSize,
          sorts: [{ name: 'timestamp', order: 'asc' }],
          terms: [{ terms: [{ column: 'timestamp', termType: 'btw', value: [range.start, range.end] }] }],
        }),
        propertyLimit,
        GEO_POINT_HISTORY_PAGE_SIZE,
      )
      geoPointRecords[propertyId] = history.records
      rawRecordCount += history.records.length
      remainingRecordBudget -= history.records.length
      historyTruncated ||= history.truncated
    }
    // Requested ranges may be mostly empty; observed timestamps preserve useful path detail.
    const effectiveInterval = analysisMode === 'ordered_path'
      ? refineIotDevicePropertyOrderedPathInterval(interval, geoPointRecords)
      : interval
    const geoPointRows = aggregateIotDeviceGeoPointHistory(
      geoPointRecords,
      geoPointColumns,
      effectiveInterval,
    )
    const resolutionAdjusted = effectiveInterval !== interval
    const warnings = [
      ...plan.warnings,
      ...(resolutionAdjusted
        ? [aggregateText('pathResolutionAdjusted', { requested: interval, resolved: effectiveInterval })]
        : []),
      ...(historyTruncated ? [aggregateText('truncated')] : []),
    ]
    const fields = createIotDevicePropertyAggregateFields(plan.columns, {
      longitude: propertyLabel => aggregateText('longitude', { property: propertyLabel }),
      latitude: propertyLabel => aggregateText('latitude', { property: propertyLabel }),
    })
    // Aggregation APIs may add driver-specific columns; expose only selected scalar or coordinate fields.
    const mergedRows = mergeIotDevicePropertyAggregateRows([aggregateRows, geoPointRows])
    const transport = createIotDevicePropertyAggregateTransport(mergedRows, fields)
    const {
      data,
      bucketCount,
      populatedBucketCount,
      measurementCount,
      missingBucketCount,
      samplingSemantics,
    } = transport
    const cardinality = createDomainAgentAggregateCardinality({
      bucketCount,
      populatedBucketCount,
      measurementCount,
    })
    const result = createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: {
        deviceId,
        propertyIds,
        analysisMode,
        aggregates: Array.from(new Set(plan.columns.map(column => column.agg))),
        interval: effectiveInterval,
        requestedInterval: resolutionAdjusted ? interval : undefined,
        resolutionAdjusted: resolutionAdjusted || undefined,
        rawRecordCount: rawRecordCount || undefined,
        bucketCount,
        populatedBucketCount,
        measurementCount,
        missingBucketCount,
        samplingSemantics,
      },
      facts: {
        deviceId,
        propertyIds,
        analysisMode,
        aggregates: Array.from(new Set(plan.columns.map(column => column.agg))),
        interval: effectiveInterval,
        requestedInterval: resolutionAdjusted ? interval : undefined,
        resolutionAdjusted: resolutionAdjusted || undefined,
        rawRecordCount: rawRecordCount || undefined,
        bucketCount,
        populatedBucketCount,
        measurementCount,
        missingBucketCount,
        samplingSemantics,
      },
      claims: [],
      data,
      cardinality,
      truncated: historyTruncated,
      supportsAbsenceClaim: !historyTruncated && measurementCount === 0,
      warnings,
    })
    const observedRange = resolveIotDevicePropertyAggregateObservedRange(data)
    if (result.evidence) {
      if (observedRange) result.evidence.observedRange = observedRange
      if (historyTruncated) result.evidence.limitReason = 'records'
    }
    // Dynamic fields are execution facts; the typed definition adapter owns binding name, path and shape.
    return { ...result, outputFields: fields }
  }),
}
