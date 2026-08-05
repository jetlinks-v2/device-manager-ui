import { getEventList } from '../../../../api/instance'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type TranslateFn = (key: string, params?: Record<string, any>) => string

type DeviceClientToolContext = {
  device: Record<string, any>
}

interface ResolvedTimeRange {
  start?: number
  end?: number
}

interface DeviceEventToolDependencies {
  t: TranslateFn
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
  asArray: <T = any>(value: unknown) => T[]
  responseResult: (response: any) => any
  resolveTimeRange: (args: Record<string, any>) => ResolvedTimeRange
  describeResolvedTimeRange: (range: ResolvedTimeRange) => Record<string, any> | undefined
  compactInlineValue: (value: unknown, maxLength?: number) => unknown
  withWriteToPathInput: (inputs: any[]) => any[]
  writeLimitInput: () => Record<string, any>
  collectPagedToolData: <T = any>(options: {
    args: Record<string, any>
    call?: AiClientToolCall
    inlineLimit: number
    pageSize?: number
    defaultWriteLimit?: number
    maxWriteLimit?: number
    fetchPage: (pageIndex: number, pageSize: number) => Promise<any>
    normalizeRecord: (record: Record<string, any>) => T
  }) => Promise<{
    total: number
    returned: number
    truncated: boolean
    writeMode: boolean
    writeLimit?: number
    writeLimitUnlimited?: boolean
    file?: Record<string, any>
    data: T[]
  }>
  writeToolResultToSessionFile: (
    args: Record<string, any>,
    call: AiClientToolCall,
    result: Record<string, any>,
    options?: {
      content?: string
      summary?: Record<string, any>
    }
  ) => Promise<any> | any
  timeRangeInput: () => Record<string, any>
  startTimeDescription: string
  endTimeDescription: string
  getDeviceId: (context: DeviceClientToolContext) => string
  getMetadata: (context: DeviceClientToolContext) => Record<string, any>
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const normalizeSearchText = (value: unknown) => String(value ?? '').trim().toLowerCase()

const eventDisplayName = (event: Record<string, any>) => event.name || event.id || event.key

const normalizeEventCandidate = (event: Record<string, any>) => ({
  id: event.id || event.key,
  name: event.name,
  description: event.description,
  type: event.type,
  valueType: event.valueType?.type || event.valueType,
})

const resolveEventMetadata = (
  deps: DeviceEventToolDependencies,
  context: DeviceClientToolContext,
  args: Record<string, any>
) => {
  const metadata = deps.getMetadata(context)
  const events = deps.asArray<Record<string, any>>(metadata.events)
  const eventId = normalizeSearchText(args.eventId ?? args.event ?? args.id)
  const keyword = normalizeSearchText(args.keyword ?? args.eventName ?? args.name)
  const exact = events.find((event) => {
    const ids = [
      event.id,
      event.key,
      event.name
    ].map(normalizeSearchText)
    return eventId ? ids.includes(eventId) : false
  })
  if (exact) return exact

  if (!keyword) return undefined
  const matches = events.filter((event) => {
    const text = [
      event.id,
      event.key,
      event.name,
      event.description,
      event.type
    ].map(normalizeSearchText).join(' ')
    return text.includes(keyword)
  })
  return matches.length === 1 ? matches[0] : undefined
}

const listEventCandidates = (
  deps: DeviceEventToolDependencies,
  context: DeviceClientToolContext,
  keyword?: unknown
) => {
  const normalizedKeyword = normalizeSearchText(keyword)
  const events = deps.asArray<Record<string, any>>(deps.getMetadata(context).events)
  return events
    .filter((event) => {
      if (!normalizedKeyword) return true
      const text = [
        event.id,
        event.key,
        event.name,
        event.description,
        event.type
      ].map(normalizeSearchText).join(' ')
      return text.includes(normalizedKeyword)
    })
    .slice(0, 20)
    .map(normalizeEventCandidate)
}

const parseFilterObject = (value: unknown) => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const buildSimpleTerm = (column: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== undefined && item !== null && item !== '')
    return values.length ? { column, termType: 'in', value: values } : undefined
  }
  return { column, termType: 'eq', value }
}

const buildEventTerms = (
  args: Record<string, any>,
  range: ResolvedTimeRange
) => {
  const terms: Record<string, any>[] = []
  if (range.start !== undefined || range.end !== undefined) {
    terms.push({
      column: 'timestamp',
      termType: 'btw',
      value: [range.start ?? 0, range.end ?? Date.now()]
    })
  }

  const filters = parseFilterObject(args.filters ?? args.where)
  Object.entries(filters).forEach(([column, value]) => {
    const term = buildSimpleTerm(column, value)
    if (term) terms.push(term)
  })
  return terms
}

const getEventProperties = (
  deps: DeviceEventToolDependencies,
  event: Record<string, any>
) => deps.asArray<Record<string, any>>(event.valueType?.properties || event.properties)

const normalizeEventRecord = (
  deps: DeviceEventToolDependencies,
  event: Record<string, any>,
  record: Record<string, any>
) => {
  const value = record.value ?? record.data ?? record.result
  const properties: Record<string, unknown> = {}
  getEventProperties(deps, event).forEach((property) => {
    const propertyId = property.id || property.key
    if (!propertyId) return
    const propertyValue = record[propertyId] ?? value?.[propertyId]
    if (propertyValue !== undefined) {
      properties[propertyId] = deps.compactInlineValue(propertyValue, 1200)
    }
  })

  return {
    timestamp: record.timestamp ?? record.time ?? record.createTime,
    messageId: record.messageId,
    value: Object.keys(properties).length ? undefined : deps.compactInlineValue(value, 1600),
    properties: Object.keys(properties).length ? properties : undefined
  }
}

export const createDeviceEventClientTools = (
  deps: DeviceEventToolDependencies
): AiClientToolDefinition<DeviceClientToolContext>[] => ([
  {
    id: 'device_event_history_query',
    name: 'device_event_history_query',
    description: deps.t('DeviceDetail.agentTools.eventHistory.description'),
    inputs: deps.withWriteToPathInput([
      {
        id: 'eventId',
        name: 'eventId',
        description: deps.t('DeviceDetail.agentTools.eventHistory.inputs.eventId'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: deps.t('DeviceDetail.agentTools.eventHistory.inputs.keyword'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'filters',
        name: 'filters',
        description: deps.t('DeviceDetail.agentTools.eventHistory.inputs.filters'),
        required: false,
        valueType: { type: 'object' }
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
        description: deps.t('DeviceDetail.agentTools.eventHistory.inputs.limit'),
        required: false,
        valueType: 'int'
      },
      deps.writeLimitInput()
    ]),
    output: { type: 'object' },
    help: deps.t('DeviceDetail.agentTools.eventHistory.help'),
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
      const event = resolveEventMetadata(deps, context, args)
      if (!event) {
        return {
          deviceId,
          needsEventId: true,
          keyword: args.keyword ?? args.eventName ?? args.name,
          candidates: listEventCandidates(deps, context, args.keyword ?? args.eventName ?? args.name),
          nextAction: deps.t('DeviceDetail.agentTools.eventHistory.nextAction.selectEvent')
        }
      }

      const eventId = event.id || event.key
      const inlineLimit = deps.clampNumber(args.limit, 1, 50, 10)
      const timeRange = deps.resolveTimeRange(args)
      const collected = await deps.collectPagedToolData({
        args,
        call,
        inlineLimit,
        fetchPage: (pageIndex, pageSize) => getEventList(deviceId, eventId, {
          paging: true,
          pageIndex,
          pageSize,
          sorts: [{ name: 'timestamp', order: 'desc' }],
          terms: buildEventTerms(args, timeRange)
        }),
        normalizeRecord: (item) => normalizeEventRecord(deps, event, item)
      })
      const previewData = collected.data.slice(0, inlineLimit)
      const base = {
        deviceId,
        event: normalizeEventCandidate(event),
        timeRange: deps.describeResolvedTimeRange(timeRange),
        filters: parseFilterObject(args.filters ?? args.where),
        total: collected.total
      }
      const output = {
        ...base,
        returned: previewData.length,
        truncated: collected.total > previewData.length,
        nextAction: collected.total > previewData.length ? deps.t('DeviceDetail.agentTools.eventHistory.nextAction.truncated') : undefined,
        data: previewData
      }
      if (collected.file) {
        return {
          ...base,
          ...collected.file,
          eventId,
          eventName: eventDisplayName(event),
          returned: collected.returned,
          truncated: collected.truncated,
          fullResultWritten: !collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          writeLimitExceeded: collected.truncated,
          inlinePreviewLimit: inlineLimit,
          inlinePreviewReturned: previewData.length,
          inlinePreviewTruncated: collected.returned > previewData.length,
          dataPreview: previewData
        }
      }
      const fullOutput = {
        ...base,
        returned: collected.returned,
        truncated: collected.truncated,
        writeLimit: collected.writeLimit,
        writeLimitUnlimited: collected.writeLimitUnlimited,
        data: collected.data
      }
      return deps.writeToolResultToSessionFile(args, call, output, {
        content: safeStringify(fullOutput),
        summary: {
          ...base,
          eventId,
          eventName: eventDisplayName(event),
          returned: collected.returned,
          truncated: collected.truncated,
          fullResultWritten: !collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          writeLimitExceeded: collected.truncated,
          inlinePreviewLimit: inlineLimit,
          inlinePreviewReturned: previewData.length,
          inlinePreviewTruncated: collected.data.length > previewData.length,
          dataPreview: previewData
        }
      })
    }
  }
])
