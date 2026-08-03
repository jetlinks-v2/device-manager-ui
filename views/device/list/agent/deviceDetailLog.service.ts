import {
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentInteger,
  resolveDomainAgentTimeRange,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import type { IotDevice } from '../types'
import {
  iotDeviceDetailRealApi,
  parseMetadata,
} from '../services/iotDeviceDetailReal.service'
import {
  asRecord,
  enumValue,
  inputError,
  normalizeText,
  pageResult,
  runDetailTool,
  safePayload,
  safeText,
  unwrapResult,
  withDeviceDetailModelSample,
  type DeviceDetailAgentArgs,
} from './deviceDetailAgent.shared'

const LOG_TYPE_ALIASES: Record<string, string | string[]> = {
  online: 'online',
  connected: 'online',
  '上线': 'online',
  '在线': 'online',
  offline: 'offline',
  disconnected: 'offline',
  '离线': 'offline',
  '下线': 'offline',
  both: ['online', 'offline'],
  onlineoffline: ['online', 'offline'],
  '上下线': ['online', 'offline'],
}

const normalizeLogTypes = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : normalizeText(value).split(/[,\s，、/|]+/).filter(Boolean)
  return Array.from(new Set(values.flatMap((item) => {
    const raw = normalizeText(item)
    const resolved = LOG_TYPE_ALIASES[raw.toLowerCase()] || LOG_TYPE_ALIASES[raw] || raw
    return Array.isArray(resolved) ? resolved : resolved ? [resolved] : []
  })))
}

const buildLogTerms = (
  args: DeviceDetailAgentArgs,
  range: { start: number; end: number },
  typeOverride?: string[],
) => {
  const types = typeOverride ?? normalizeLogTypes(args.type ?? args.types)
  const terms: Array<Record<string, unknown>> = [
    { column: 'timestamp', termType: 'btw', value: [range.start, range.end] },
  ]
  if (types.length) {
    terms.push({ column: 'type', termType: types.length > 1 ? 'in' : 'eq', value: types.length > 1 ? types : types[0] })
  }
  const keyword = normalizeText(args.keyword)
  if (keyword) terms.push({ column: 'content', termType: 'like', value: keyword })
  return terms
}

const mapLog = (value: unknown) => {
  const row = asRecord(value)
  return {
    id: normalizeText(row.id) || undefined,
    type: enumValue(row.type || row.messageType),
    timestamp: row.timestamp || row.createTime,
    messageId: normalizeText(row.messageId) || undefined,
    content: safeText(row.content || row.message, 1200),
  }
}

export const createDeviceDetailLogService = (device: IotDevice) => {
  const queryLogPage = async (
    args: DeviceDetailAgentArgs,
    range: ReturnType<typeof resolveDomainAgentTimeRange>,
    pageIndex: number,
    pageSize: number,
    typeOverride?: string[],
  ) => pageResult(await iotDeviceDetailRealApi.queryLog(device.id, {
    paging: true,
    pageIndex,
    pageSize,
    sorts: [{ name: 'timestamp', order: 'desc' }],
    terms: buildLogTerms(args, range, typeOverride),
  }))

  const eventQuery = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    const eventId = normalizeText(args.eventId)
    if (!eventId) throw inputError('DEVICE_EVENT_REQUIRED', 'eventIdRequired')
    let metadata = device.thingModelMetadata
    if (!metadata) {
      const raw = asRecord(unwrapResult(await iotDeviceDetailRealApi.getDeviceDetail(device.id)))
      metadata = parseMetadata(raw.metadata || raw.deriveMetadata || raw.productMetadata)
    }
    const event = (metadata.events || []).map(asRecord)
      .find(item => normalizeText(item.id || item.event || item.key) === eventId)
    if (!event) throw inputError('DEVICE_EVENT_NOT_FOUND', 'eventNotFound', { eventId })
    const range = resolveDomainAgentTimeRange(args)
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize ?? args.limit, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const page = pageResult(await iotDeviceDetailRealApi.queryEvent(device.id, eventId, {
      paging: true,
      pageIndex,
      pageSize,
      sorts: [{ name: 'timestamp', order: 'desc' }],
      terms: [{ column: 'timestamp', termType: 'btw', value: [range.start, range.end] }],
    }))
    const data = page.data.map((value, index) => {
      const row = asRecord(value)
      return {
        id: normalizeText(row.id || row.messageId || `${eventId}-${row.timestamp || index}`),
        eventId,
        eventName: safeText(event.name || eventId, 300),
        timestamp: row.timestamp || row.time || row.createTime,
        payload: safePayload(row.value ?? row.data ?? row.payload),
      }
    })
    const hasNext = (pageIndex + 1) * pageSize < page.total
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId: device.id, eventId, returned: data.length, total: page.total },
      data,
      total: page.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: data.length,
        totalCount: page.total,
      }),
      truncated: hasNext,
      nextPage: hasNext ? pageIndex + 1 : undefined,
    })
  })

  const onlineOfflineSummary = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const range = resolveDomainAgentTimeRange(args)
    const sampleLimit = resolveDomainAgentInteger(args.sampleLimit, { name: 'sampleLimit', defaultValue: 5, min: 1, max: 20 })
    const requested = normalizeLogTypes(args.type).filter(type => type === 'online' || type === 'offline')
    const types = requested.length ? requested : ['online', 'offline']
    const [onlinePage, offlinePage, samplePage] = await Promise.all([
      types.includes('online') ? queryLogPage(args, range, 0, 1, ['online']) : undefined,
      types.includes('offline') ? queryLogPage(args, range, 0, 1, ['offline']) : undefined,
      queryLogPage(args, range, 0, sampleLimit, types),
    ])
    const data = {
      online: onlinePage?.total,
      offline: offlinePage?.total,
      samples: samplePage.data.map(mapLog),
    }
    const total = Number(data.online || 0) + Number(data.offline || 0)
    return withDeviceDetailModelSample(createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      filters: { types },
      summary: { deviceId: device.id, online: data.online, offline: data.offline, sampleCount: data.samples.length },
      data,
      total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: total,
        totalCount: total,
      }),
      supportsAbsenceClaim: total === 0,
    }), data.samples.length)
  })

  const logsSummary = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const range = resolveDomainAgentTimeRange(args)
    const sampleLimit = resolveDomainAgentInteger(args.sampleLimit ?? args.pageSize, { name: 'sampleLimit', defaultValue: 5, min: 1, max: 20 })
    const page = await queryLogPage(args, range, 0, sampleLimit)
    const samples = page.data.map(mapLog)
    return withDeviceDetailModelSample(createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      filters: { types: normalizeLogTypes(args.type ?? args.types), keyword: args.keyword },
      summary: { deviceId: device.id, total: page.total, sampleCount: samples.length },
      data: { total: page.total, samples },
      total: page.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: page.total,
        totalCount: page.total,
      }),
    }), samples.length)
  })

  const logsQuery = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    const range = resolveDomainAgentTimeRange(args)
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize ?? args.limit, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const page = await queryLogPage(args, range, pageIndex, pageSize)
    const data = page.data.map(mapLog)
    const hasNext = (pageIndex + 1) * pageSize < page.total
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      filters: { types: normalizeLogTypes(args.type ?? args.types), keyword: args.keyword },
      summary: { deviceId: device.id, total: page.total, returned: data.length },
      data,
      total: page.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: data.length,
        totalCount: page.total,
      }),
      truncated: hasNext,
      nextPage: hasNext ? pageIndex + 1 : undefined,
    })
  })

  return { eventQuery, onlineOfflineSummary, logsSummary, logsQuery }
}
