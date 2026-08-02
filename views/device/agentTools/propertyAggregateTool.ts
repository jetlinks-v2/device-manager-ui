import { getPropertiesInfo } from '@device-manager-ui/api/instance'
import {
  type AiClientToolCall,
  type AiClientToolDefinition,
  type AiClientToolInput,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import {
  createDevicePropertyAggregateRecordStream,
  DEVICE_PROPERTY_AGGREGATE_CONTRACT,
  withDevicePropertyAggregateEvidence,
  type DevicePropertyAggregateTimeRange,
} from './propertyAggregateContract'
import {
  clampDevicePropertyAggregateInlineLimit,
  compactDevicePropertyAggregateValue,
  createDevicePropertyAggregateColumns,
  createDevicePropertyAggregateFields,
  devicePropertyAggregateTimeFormat,
  findDevicePropertyMetadata,
  normalizeDevicePropertyAggregate,
  normalizeDevicePropertyAggregateData,
  normalizeDevicePropertyAggregateInterval,
  normalizeDevicePropertyAggregateTimeRange,
  normalizeDevicePropertyIds,
  type DevicePropertyAggregateRecord,
} from './propertyAggregateSupport'

export {
  DEVICE_PROPERTY_AGGREGATE_CONTRACT,
  DEVICE_PROPERTY_AGGREGATE_OUTPUT,
  type DevicePropertyAggregateTimeRange,
} from './propertyAggregateContract'

type JsonRecord = DevicePropertyAggregateRecord
type MaybePromise<T> = T | Promise<T>

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
  timeRangeInput: AiClientToolInput
  limit: string
  deviceIdMissing: string
  propertyIdMissing: string
  nonNumericWarning: (propertyId: string) => string
  truncated: string
}

export interface DevicePropertyAggregateDeliveryContext {
  args: JsonRecord
  call: AiClientToolCall
  data: JsonRecord[]
  preview: JsonRecord[]
  inlineLimit: number
  inlineResult: JsonRecord
  fullResult: JsonRecord
  base: JsonRecord
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
  decorateInputs?: (inputs: AiClientToolInput[]) => AiClientToolInput[]
  deliver?: (
    context: DevicePropertyAggregateDeliveryContext,
  ) => MaybePromise<JsonRecord | undefined>
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
): AiClientToolDefinition<TContext> => {
  const { copy } = dependencies
  const baseInputs: AiClientToolInput[] = [
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
  return {
    id: 'device_property_aggregate',
    name: 'device_property_aggregate',
    ...(dependencies.displayName ? { displayName: dependencies.displayName } : {}),
    ...(dependencies.progressText ? { progressText: dependencies.progressText } : {}),
    description: copy.description,
    help: copy.help,
    inputs: dependencies.decorateInputs ? dependencies.decorateInputs(baseInputs) : baseInputs,
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    ...DEVICE_PROPERTY_AGGREGATE_CONTRACT,
    execute: async (args, context, call) => {
      const subject = await dependencies.resolveSubject(args, context)
      const deviceId = String(subject.deviceId || '').trim()
      if (!deviceId) throw new Error(copy.deviceIdMissing)
      const propertyIds = normalizeDevicePropertyIds(args)
      if (!propertyIds.length) throw new Error(copy.propertyIdMissing)
      const requested = normalizeDevicePropertyAggregate(args.agg ?? args.aggregate ?? args.method)
      const range = normalizeDevicePropertyAggregateTimeRange(dependencies.resolveTimeRange(args))
      const interval = normalizeDevicePropertyAggregateInterval(args.interval, range)
      const format = devicePropertyAggregateTimeFormat(interval)
      const { columns, warnings } = createDevicePropertyAggregateColumns(
        subject.metadata,
        propertyIds,
        requested,
        copy.nonNumericWarning,
      )
      const response = await getPropertiesInfo(deviceId, {
        columns,
        query: { interval, format, from: range.start, to: range.end },
      })
      const compactValue = dependencies.compactValue || compactDevicePropertyAggregateValue
      const data = normalizeDevicePropertyAggregateData(response, propertyIds, compactValue)
      const limit = clampDevicePropertyAggregateInlineLimit(args.limit)
      const preview = data.slice(0, limit)
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
        warnings: warnings.length ? warnings : undefined,
      }
      const inlineResult = {
        ...base,
        returned: preview.length,
        truncated: data.length > preview.length,
        nextAction: data.length > preview.length ? copy.truncated : undefined,
        data: preview,
      }
      const fullResult = { ...base, returned: data.length, truncated: false, data }
      const delivered = dependencies.deliver
        ? await dependencies.deliver({ args, call, data, preview, inlineLimit: limit, inlineResult, fullResult, base })
        : undefined
      const fields = createDevicePropertyAggregateFields(subject.metadata, columns)
      if (delivered) {
        return withDevicePropertyAggregateEvidence(
          delivered,
          range,
          data,
          Number(delivered.returned ?? preview.length),
          fields,
        )
      }
      return {
        ...base,
        data: createDevicePropertyAggregateRecordStream(
          data,
          fields,
          range,
          { deviceId, propertyIds, interval, total: data.length },
          limit,
        ),
      }
    },
  }
}
