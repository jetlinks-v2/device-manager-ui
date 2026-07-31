import {
  downloadRemoteSystemFile,
  getProperty,
  getPropertyData,
  getRemoteSystemWorkingDirectory,
  listRemoteSystemFiles,
  queryLog
} from '../../../../api/instance'
import {
  createAiClientToolRuntime,
  defineAiClientTools,
  type AiClientToolCall,
  type AiClientToolRuntime
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import {
  DEVICE_DETAIL_SELECTOR_SCOPE,
  registerDeviceDetailSelectorTools
} from './selectorTools'
import { createDevicePropertyAggregateTool } from './propertyAggregateTool'
import { createDeviceDocumentClientTools } from './documentTool'
import { createDeviceAccessClientTools } from './accessTool'
import { createDeviceEventClientTools } from './eventTool'
import { createDeviceFunctionClientTools } from './functionTool'
import { createDeviceAlarmClientTools } from './alarmTool'
import { createEdgeDiagnosisClientTools } from './edgeDiagnosisTool'
import { createDeviceTraceCaptureClientTools } from './traceCaptureTool'
import {
  DEVICE_LOG_RECORDS_CONTRACT,
  DEVICE_LOG_SUMMARY_CONTRACT,
  withDeviceLogRecordEvidence,
  withDeviceLogSummaryEvidence,
} from './deviceLogToolContract'

type DeviceDetailRecord = Record<string, any>
type TranslateFn = (key: string, params?: Record<string, any>) => string
let currentT: TranslateFn = (key) => key
type RemoteSystemFileRecord = Record<string, any>

interface DeviceClientToolContext {
  device: DeviceDetailRecord
}

const clampNumber = (value: unknown, min: number, max: number, defaultValue: number) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultValue
  return Math.min(max, Math.max(min, n))
}

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : [])

const responseResult = (response: any) => response?.result ?? response?.data ?? response

export const parseJsonObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>
  }
  if (typeof value !== 'string' || !value.trim()) {
    return {}
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const getDeviceId = (context: DeviceClientToolContext) => String(context.device?.id || '').trim()

const getMetadata = (context: DeviceClientToolContext) => parseJsonObject(context.device?.metadata)

const REMOTE_FILE_ACCESS_PROVIDERS = new Set([
  'agent-device-gateway',
  'agent-media-device-gateway'
])

export const METADATA_SECTIONS = ['properties', 'functions', 'events', 'tags'] as const
const VALID_METADATA_SECTIONS = new Set<string>(METADATA_SECTIONS)

const normalizeMetadataSection = (section?: string) => {
  const value = String(section || 'all').trim()
  return value === 'all' || VALID_METADATA_SECTIONS.has(value) ? value : 'all'
}

const normalizeMetadataTypes = (types: string[]) => {
  const normalized = types.filter((type) => VALID_METADATA_SECTIONS.has(type))
  return normalized.length ? normalized : [...METADATA_SECTIONS]
}

const escapeMarkdownTableCell = (value: unknown) => (
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
)

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const normalizeToolError = (error: any) => ({
  message: error?.message || String(error),
  status: error?.status || error?.response?.status,
  code: error?.code || error?.response?.data?.code,
  type: error?.response?.data?.errorType || error?.response?.data?.type,
  detail: truncateText(error?.response?.data || error?.data || error)
})

const truncateText = (value: unknown, maxLength = 4000) => {
  if (value === undefined || value === null) return value
  const text = typeof value === 'string' ? value : safeStringify(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

const safeToolPart = async <T>(
  runner: () => Promise<T> | T
): Promise<{ ok: true; data: T } | { ok: false; error: ReturnType<typeof normalizeToolError> }> => {
  try {
    return {
      ok: true,
      data: await runner()
    }
  } catch (error) {
    return {
      ok: false,
      error: normalizeToolError(error)
    }
  }
}

interface ResolvedTimeRange {
  start?: number
  end?: number
}

const timeInputExamples = () => currentT('DeviceDetail.agentTools.common.time.examples')
const timeRangeDescription = () => currentT('DeviceDetail.agentTools.common.time.rangeDescription', { examples: timeInputExamples() })
const startTimeDescription = () => currentT('DeviceDetail.agentTools.common.time.startDescription', { examples: timeInputExamples() })
const endTimeDescription = () => currentT('DeviceDetail.agentTools.common.time.endDescription', { examples: timeInputExamples() })

const startOfDay = (date = new Date()) => {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value.getTime()
}

const startOfWeek = (date = new Date()) => {
  const value = new Date(startOfDay(date))
  const day = value.getDay() || 7
  value.setDate(value.getDate() - day + 1)
  return value.getTime()
}

const startOfMonth = (date = new Date()) => {
  const value = new Date(date)
  value.setDate(1)
  value.setHours(0, 0, 0, 0)
  return value.getTime()
}

const addDays = (timestamp: number, days: number) => {
  const value = new Date(timestamp)
  value.setDate(value.getDate() + days)
  return value.getTime()
}

const addMonths = (timestamp: number, months: number) => {
  const value = new Date(timestamp)
  value.setMonth(value.getMonth() + months)
  return value.getTime()
}

const endOfPreviousMillisecond = (timestamp: number) => Math.max(0, timestamp - 1)

const parseLocalDateTime = (value: string) => {
  const matched = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?)?$/)
  if (!matched) return undefined

  const [, year, month, day, hour = '0', minute = '0', second = '0', millisecond = '0'] = matched
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, '0'))
  )
  const timestamp = date.getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const parsePlainTimeValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : undefined
  }

  const raw = String(value).trim()
  if (!raw) return undefined
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const timestamp = Number(raw)
    return Number.isFinite(timestamp) ? timestamp : undefined
  }

  const localDateTime = parseLocalDateTime(raw)
  if (localDateTime !== undefined) return localDateTime

  const timestamp = new Date(raw).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const applyDateMath = (mathString: string, baseTime: number) => {
  let value = new Date(baseTime)
  for (let index = 0; index < mathString.length;) {
    const operator = mathString.charAt(index++)
    const round = operator === '/'
    const sign = operator === '-' ? -1 : 1
    if (!round && operator !== '+' && operator !== '-') return undefined
    if (index >= mathString.length) return undefined

    const numberStart = index
    while (index < mathString.length && /\d/.test(mathString.charAt(index))) {
      index += 1
    }
    const amount = numberStart === index ? 1 : Number(mathString.slice(numberStart, index))
    if (!Number.isFinite(amount) || amount <= 0 || index >= mathString.length) return undefined

    const unit = mathString.charAt(index++)
    if (round && amount !== 1) return undefined

    if (round) {
      if (unit === 'y') value = new Date(value.getFullYear(), 0, 1)
      else if (unit === 'M') value = new Date(value.getFullYear(), value.getMonth(), 1)
      else if (unit === 'w') {
        const day = value.getDay() || 7
        value = new Date(value.getFullYear(), value.getMonth(), value.getDate() - day + 1)
      } else if (unit === 'd') value = new Date(value.getFullYear(), value.getMonth(), value.getDate())
      else if (unit === 'h' || unit === 'H') value = new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours())
      else if (unit === 'm') value = new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes())
      else if (unit === 's') value = new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds())
      else return undefined
      continue
    }

    const next = new Date(value)
    if (unit === 'y') next.setFullYear(next.getFullYear() + sign * amount)
    else if (unit === 'M') next.setMonth(next.getMonth() + sign * amount)
    else if (unit === 'w') next.setDate(next.getDate() + sign * amount * 7)
    else if (unit === 'd') next.setDate(next.getDate() + sign * amount)
    else if (unit === 'h' || unit === 'H') next.setHours(next.getHours() + sign * amount)
    else if (unit === 'm') next.setMinutes(next.getMinutes() + sign * amount)
    else if (unit === 's') next.setSeconds(next.getSeconds() + sign * amount)
    else return undefined
    value = next
  }

  const timestamp = value.getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const parseDateMathValue = (value: unknown) => {
  if (value === undefined || value === null || value === '' || typeof value === 'object') return undefined

  const raw = String(value).trim()
  if (!raw) return undefined

  const compact = raw.replace(/\s+/g, '')
  const nowMatched = compact.match(/^now(?:\(\))?(.*)$/i)
  if (nowMatched) {
    return applyDateMath(nowMatched[1] || '', Date.now())
  }

  const separatorIndex = raw.indexOf('||')
  if (separatorIndex < 0) return undefined

  const base = parsePlainTimeValue(raw.slice(0, separatorIndex).trim())
  if (base === undefined) return undefined
  return applyDateMath(raw.slice(separatorIndex + 2).replace(/\s+/g, ''), base)
}

const toTimeValue = (value: unknown) => parseDateMathValue(value) ?? parsePlainTimeValue(value)

const normalizeRelativeTimeRange = (value: unknown): ResolvedTimeRange | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'object') return undefined

  const raw = String(value).trim()
  if (!raw) return undefined

  const normalized = raw.toLowerCase().replace(/\s+/g, '')
  const now = Date.now()
  const todayStart = startOfDay()
  const weekStart = startOfWeek()
  const monthStart = startOfMonth()

  if (['today', '今日', '今天', '本日', '当天'].includes(normalized)) {
    return { start: todayStart, end: now }
  }
  if (['yesterday', '昨日', '昨天'].includes(normalized)) {
    return { start: addDays(todayStart, -1), end: endOfPreviousMillisecond(todayStart) }
  }
  if (['thisweek', '本周', '这周', '当前周'].includes(normalized)) {
    return { start: weekStart, end: now }
  }
  if (['lastweek', '上周'].includes(normalized)) {
    return { start: addDays(weekStart, -7), end: endOfPreviousMillisecond(weekStart) }
  }
  if (['thismonth', '本月', '这个月', '当前月'].includes(normalized)) {
    return { start: monthStart, end: now }
  }
  if (['lastmonth', '上月'].includes(normalized)) {
    return { start: addMonths(monthStart, -1), end: endOfPreviousMillisecond(monthStart) }
  }

  const relativeMatched = normalized.match(/^(?:last|past|recent|最近|近|过去)?(\d+)(ms|毫秒|s|秒|min|minute|minutes|分钟|m|h|hour|hours|小时|d|day|days|天|w|week|weeks|周|month|months|个月)$/)
  if (!relativeMatched) return undefined

  const amount = Number(relativeMatched[1])
  if (!Number.isFinite(amount) || amount <= 0) return undefined

  const unit = relativeMatched[2]
  const unitMs = ({
    ms: 1,
    '毫秒': 1,
    s: 1000,
    '秒': 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    '分钟': 60 * 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    '小时': 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    '天': 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    '周': 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    '个月': 30 * 24 * 60 * 60 * 1000
  } as Record<string, number>)[unit]

  return unitMs ? { start: now - amount * unitMs, end: now } : undefined
}

const resolveTimePoint = (value: unknown, boundary: 'start' | 'end') => {
  const timestamp = toTimeValue(value)
  if (timestamp !== undefined) return timestamp
  const range = normalizeRelativeTimeRange(value)
  return boundary === 'end' ? range?.end : range?.start
}

const toTimeRangeValue = (value: unknown): ResolvedTimeRange | undefined => {
  const relative = normalizeRelativeTimeRange(value)
  if (relative) return relative

  if (Array.isArray(value)) {
    const start = resolveTimePoint(value[0], 'start')
    const end = resolveTimePoint(value[1], 'end')
    return start === undefined && end === undefined ? undefined : { start, end }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, any>
    const startValue = record.start ?? record.from ?? record.startTime ?? record.begin ?? record.beginTime ?? record.windowStartTime ?? record.window_start_time
    const endValue = record.end ?? record.to ?? record.endTime ?? record.finish ?? record.finishTime ?? record.windowEndTime ?? record.window_end_time
    const start = resolveTimePoint(startValue, 'start')
    const end = resolveTimePoint(endValue, 'end')
    if (start !== undefined || end !== undefined) return { start, end }

    const nested = [record.timeRange, record.range, record.result, record.data]
      .find((item) => item && item !== value)
    return nested ? toTimeRangeValue(nested) : undefined
  }

  const timestamp = toTimeValue(value)
  return timestamp === undefined ? undefined : { start: timestamp }
}

const getTimeRangeArg = (args: Record<string, any>) => (
  ['timeRange', 'range', 'date', 'period']
    .map((key) => args[key])
    .find((value) => value !== undefined && value !== null && value !== '')
)

const resolveTimeRange = (args: Record<string, any>): ResolvedTimeRange => {
  const range = toTimeRangeValue(getTimeRangeArg(args))
  const startRange = normalizeRelativeTimeRange(args.startTime)
  const endRange = normalizeRelativeTimeRange(args.endTime)
  const start = resolveTimePoint(args.startTime, 'start') ?? range?.start ?? (!args.startTime ? endRange?.start : undefined)
  const end = resolveTimePoint(args.endTime, 'end') ?? startRange?.end ?? range?.end
  if (start !== undefined && end !== undefined && start > end) {
    return { start: end, end: start }
  }
  return { start, end }
}

const buildTimeTerms = (args: Record<string, any>, column = 'timestamp', resolved = resolveTimeRange(args)) => {
  const { start, end } = resolved
  if (start === undefined && end === undefined) {
    return []
  }
  return [
    {
      column,
      termType: 'btw',
      value: [start ?? 0, end ?? Date.now()]
    }
  ]
}

const timeRangeInput = () => ({
  id: 'timeRange',
  name: 'timeRange',
  description: timeRangeDescription(),
  required: false,
  valueType: 'string'
})

const describeResolvedTimeRange = (range: ResolvedTimeRange) => (
  range.start === undefined && range.end === undefined
    ? undefined
    : {
      startTime: range.start,
      endTime: range.end,
      startTimeText: range.start === undefined ? undefined : new Date(range.start).toLocaleString(),
      endTimeText: range.end === undefined ? undefined : new Date(range.end).toLocaleString()
    }
)

export const dataTypeText = (valueType: any): string => {
  if (!valueType) return 'unknown'
  if (typeof valueType === 'string') return valueType
  const type = valueType.type || valueType.id || 'object'
  if (type === 'array') {
    return `array<${dataTypeText(valueType.elementType)}>`
  }
  if (type === 'object' && Array.isArray(valueType.properties)) {
    const props = valueType.properties
      .slice(0, 6)
      .map((item: any) => `${item.id}:${dataTypeText(item.valueType)}`)
      .join(', ')
    return props ? `object{${props}}` : 'object'
  }
  if (Array.isArray(valueType.elements) && valueType.elements.length) {
    const elements = valueType.elements
      .slice(0, 8)
      .map((item: any) => `${item.text || item.label || item.value}:${item.value}`)
      .join(', ')
    return `${type}(${elements})`
  }
  return String(type)
}

export const metadataSectionItems = (metadata: Record<string, any>, section: string) => {
  if (VALID_METADATA_SECTIONS.has(section)) return asArray(metadata[section])
  return METADATA_SECTIONS.flatMap((type) => (
    asArray(metadata[type]).map((item) => ({ ...item, __type: type }))
  ))
}

const metadataTypeName = (type: string) => ({
  properties: currentT('DeviceDetail.agentTools.metadata.types.properties'),
  functions: currentT('DeviceDetail.agentTools.metadata.types.functions'),
  events: currentT('DeviceDetail.agentTools.metadata.types.events'),
  tags: currentT('DeviceDetail.agentTools.metadata.types.tags')
}[type] || type)

export const propertyAccessText = (item: any) => {
  const raw = item?.expands?.type
  const type = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  if (!type.length) return ''
  return type.join('/')
}

const buildMetadataMarkdown = (
  context: DeviceClientToolContext,
  section = 'all',
  limit = 80
) => {
  const metadata = getMetadata(context)
  const device = context.device || {}
  const sectionKey = normalizeMetadataSection(section)
  const sections = sectionKey === 'all' ? [...METADATA_SECTIONS] : [sectionKey]

  const lines = [
    `# ${currentT('DeviceDetail.agentTools.metadataMarkdown.title', { device: device.name || device.id || currentT('DeviceDetail.agentTools.metadataMarkdown.deviceFallback') })}`,
    '',
    `- ${currentT('DeviceDetail.agentTools.metadataMarkdown.fields.deviceId')}: ${device.id || '--'}`,
    `- ${currentT('DeviceDetail.agentTools.metadataMarkdown.fields.product')}: ${device.productName || device.productId || '--'}`,
    `- ${currentT('DeviceDetail.agentTools.metadataMarkdown.fields.state')}: ${device.state?.text || device.state?.value || '--'}`,
    ''
  ]

  sections.forEach((key) => {
    const items = metadataSectionItems(metadata, key).slice(0, limit)
    lines.push(currentT('DeviceDetail.agentTools.metadataMarkdown.sectionHeading', { name: metadataTypeName(key), count: metadataSectionItems(metadata, key).length }), '')
    if (!items.length) {
      lines.push(currentT('DeviceDetail.agentTools.metadataMarkdown.empty'), '')
      return
    }
    if (key === 'properties') {
      lines.push(currentT('DeviceDetail.agentTools.metadataMarkdown.table.properties'), '| --- | --- | --- | --- | --- |')
      items.forEach((item: any) => {
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(dataTypeText(item.valueType))} | ${escapeMarkdownTableCell(propertyAccessText(item))} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    } else if (key === 'functions') {
      lines.push(currentT('DeviceDetail.agentTools.metadataMarkdown.table.functions'), '| --- | --- | --- | --- | --- |')
      items.forEach((item: any) => {
        const inputs = asArray(item.inputs).map((input: any) => `${input.id}:${dataTypeText(input.valueType)}`).join(', ')
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(inputs || '--')} | ${escapeMarkdownTableCell(dataTypeText(item.output))} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    } else if (key === 'events') {
      lines.push(currentT('DeviceDetail.agentTools.metadataMarkdown.table.events'), '| --- | --- | --- | --- | --- |')
      items.forEach((item: any) => {
        const outputs = asArray(item.properties).map((property: any) => `${property.id}:${dataTypeText(property.valueType)}`).join(', ')
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(item.type || '--')} | ${escapeMarkdownTableCell(outputs || '--')} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    } else {
      lines.push(currentT('DeviceDetail.agentTools.metadataMarkdown.table.default'), '| --- | --- | --- | --- |')
      items.forEach((item: any) => {
        lines.push(`| ${escapeMarkdownTableCell(item.id || item.key)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(dataTypeText(item.valueType || item.dataType))} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    }
    lines.push('')
  })

  return lines.join('\n')
}

const normalizeMetadataMatch = (type: string, item: any) => ({
  type,
  typeName: metadataTypeName(type),
  id: item.id || item.key,
  name: item.name,
  description: item.description,
  valueType: dataTypeText(item.valueType || item.dataType || item.output),
  access: type === 'properties' ? propertyAccessText(item) : undefined,
  inputs: type === 'functions'
    ? asArray(item.inputs).map((input: any) => ({
      id: input.id,
      name: input.name,
      valueType: dataTypeText(input.valueType)
    }))
    : undefined
})

const fuzzySearchMetadata = (metadata: Record<string, any>, keyword: string, types: string[], limit: number) => {
  const lower = keyword.toLowerCase()
  const candidates = normalizeMetadataTypes(types)
    .flatMap((type) => metadataSectionItems(metadata, type).map((item) => ({ type, item })))
  return candidates
    .filter(({ item }) => {
      const text = [
        item.id,
        item.key,
        item.name,
        item.description,
        item.type,
        dataTypeText(item.valueType || item.dataType || item.output)
      ].filter(Boolean).join(' ').toLowerCase()
      return !lower || text.includes(lower)
    })
    .slice(0, limit)
    .map(({ type, item }) => normalizeMetadataMatch(type, item))
}

const normalizePagedList = (response: any) => {
  const result = responseResult(response) || {}
  const list = result.data || result.records || result.result || (Array.isArray(result) ? result : [])
  const hasTotal = result.total !== undefined || result.count !== undefined
  return {
    data: Array.isArray(list) ? list : [],
    total: Number(result.total ?? result.count ?? (Array.isArray(list) ? list.length : 0)),
    hasTotal
  }
}

interface CollectPagedToolDataOptions<T> {
  args: Record<string, any>
  call?: AiClientToolCall
  inlineLimit: number
  pageSize?: number
  defaultWriteLimit?: number
  maxWriteLimit?: number
  fetchPage: (pageIndex: number, pageSize: number) => Promise<any>
  normalizeRecord: (record: Record<string, any>) => T
}

// 普通对话只取预览页；传 writeToPath 时才分页采集，避免大结果直接走 WebSocket。
const collectPagedToolData = async <T = any>({
  args,
  call,
  inlineLimit,
  pageSize,
  defaultWriteLimit,
  maxWriteLimit,
  fetchPage,
  normalizeRecord
}: CollectPagedToolDataOptions<T>) => {
  const writeMode = isWriteToPathEnabled(args)
  const writeLimit = writeMode
    ? resolveWriteRecordLimit(args, defaultWriteLimit, maxWriteLimit)
    : undefined
  const targetLimit = writeMode
    ? writeLimit!.limit
    : inlineLimit
  const actualPageSize = Math.max(1, Math.min(targetLimit, pageSize ?? (writeMode ? 500 : inlineLimit)))
  const data: T[] = []
  let total = 0
  let totalKnown = false
  let returned = 0
  let firstRecord: T | undefined
  let lastRecord: T | undefined
  let fileWrite: ToolSessionFileWriteSummary | undefined
  let fileAppend = false

  for (let pageIndex = 0; returned < targetLimit; pageIndex += 1) {
    const page = normalizePagedList(await fetchPage(pageIndex, actualPageSize))
    if (pageIndex === 0) {
      total = page.total
      totalKnown = page.hasTotal
    }
    const remaining = targetLimit - returned
    const normalizedPage = page.data.slice(0, remaining).map(normalizeRecord)
    if (normalizedPage.length) {
      firstRecord ??= normalizedPage[0]
      lastRecord = normalizedPage[normalizedPage.length - 1]
    }
    returned += normalizedPage.length

    if (writeMode && call) {
      if (normalizedPage.length) {
        fileWrite = await writeNdjsonRecordsToSessionFile(args, call, normalizedPage, { append: fileAppend })
        fileAppend = true
      }
      if (data.length < inlineLimit) {
        data.push(...normalizedPage.slice(0, inlineLimit - data.length))
      }
    } else {
      data.push(...normalizedPage)
    }

    if (
      !writeMode
      || !page.data.length
      || page.data.length < actualPageSize
      || (page.hasTotal && total > 0 && returned >= total)
    ) {
      break
    }
  }

  if (writeMode && call && !fileWrite) {
    fileWrite = await writeNdjsonRecordsToSessionFile(args, call, [], { append: false })
  }

  const resolvedTotal = totalKnown ? total : returned
  return {
    total: resolvedTotal,
    returned,
    truncated: totalKnown ? resolvedTotal > returned : (!writeLimit?.unlimited && returned >= targetLimit),
    writeMode,
    writeLimit: writeMode && !writeLimit?.unlimited ? targetLimit : undefined,
    writeLimitUnlimited: writeMode ? !!writeLimit?.unlimited : undefined,
    file: fileWrite,
    boundaryRecords: [firstRecord, lastRecord].filter((value): value is T => value !== undefined),
    data
  }
}

const enumValue = (value: any) => {
  if (value && typeof value === 'object') {
    return value.value ?? value.id ?? value.key ?? value.text ?? value.name
  }
  return value
}

const enumText = (value: any) => {
  if (value && typeof value === 'object') {
    return value.text ?? value.name ?? value.label ?? value.value ?? value.id
  }
  return value
}

const buildSimpleTerm = (column: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== undefined && item !== null && item !== '')
    return values.length ? { column, termType: 'in', value: values } : undefined
  }
  return { column, termType: 'eq', value }
}

const ensureRemoteFileSupported = (context: DeviceClientToolContext) => {
  const deviceId = getDeviceId(context)
  if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
  const accessProvider = String(context.device?.accessProvider || '')
  if (!REMOTE_FILE_ACCESS_PROVIDERS.has(accessProvider)) {
    throw new Error(currentT('DeviceDetail.agentTools.legacyRemoteFile.errors.unsupportedAccessProvider', { accessProvider: accessProvider || 'unknown' }))
  }
  return deviceId
}

const ensureSuccessResult = (response: any) => {
  if (response?.success === false) {
    throw new Error(response?.message || response?.result || currentT('DeviceDetail.agentTools.common.errors.requestFailed'))
  }
  if (response?.status && response.status !== 200) {
    throw new Error(response?.message || `${response.status}`)
  }
  return responseResult(response)
}

const normalizeRemoteFile = (file: RemoteSystemFileRecord) => ({
  path: file.path,
  name: file.name,
  directory: !!file.directory,
  size: Number(file.size || 0),
  mediaType: typeof file.mediaType === 'string'
    ? file.mediaType
    : [file.mediaType?.type, file.mediaType?.subtype].filter(Boolean).join('/'),
  canWrite: !!file.canWrite,
  permission: Array.isArray(file.permission) ? file.permission : [],
  createTime: file.createTime,
  modifyTime: file.modifyTime
})

const compactInlineValue = (value: unknown, maxLength = 1200) => {
  if (value === undefined || value === null) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return truncateText(value, maxLength)
}

const extractPropertyValue = (record: Record<string, any>, propertyId: string) => {
  const formatKey = `${propertyId}_format`
  return record?.value
    ?? record?.propertyValue
    ?? record?.[formatKey]
    ?? record?.[propertyId]
    ?? record?.data
    ?? record?.result
    ?? record
}

const normalizeLatestPropertyRead = (item: Record<string, any>) => {
  const result = item.result && typeof item.result === 'object' ? item.result : { value: item.result }
  return {
    propertyId: item.propertyId,
    success: !!item.success,
    source: item.source,
    timestamp: result.timestamp ?? result.time ?? result.createTime,
    value: compactInlineValue(extractPropertyValue(result, item.propertyId), 1600),
    error: item.error,
    readError: item.readError ? {
      ...item.readError,
      detail: compactInlineValue(item.readError.detail, 1000)
    } : undefined
  }
}

const normalizePropertyHistoryRecord = (item: Record<string, any>, propertyId: string) => ({
  timestamp: item.timestamp ?? item.time ?? item.createTime,
  value: compactInlineValue(extractPropertyValue(item, propertyId), 1600),
  messageId: item.messageId,
  formatValue: item[`${propertyId}_format`]
})

const normalizeDeviceLogRecord = (item: Record<string, any>) => ({
  id: item.id,
  type: {
    value: enumValue(item.type),
    text: enumText(item.type)
  },
  timestamp: item.timestamp ?? item.createTime,
  messageId: item.messageId,
  content: compactInlineValue(item.content, 1600)
})

const writeToPathInput = () => ({
  id: 'writeToPath',
  name: 'writeToPath',
  description: currentT('DeviceDetail.agentTools.common.inputs.writeToPath'),
  required: false,
  valueType: 'string'
})

const withWriteToPathInput = (inputs: any[]) => [...inputs, writeToPathInput()]

const normalizeWriteToPath = (value: unknown) => String(value || '').trim()

const DEFAULT_WRITE_RECORD_LIMIT = 100000
const MAX_WRITE_RECORD_LIMIT = 1000000
const UNLIMITED_WRITE_RECORD_LIMIT = Number.MAX_SAFE_INTEGER

const writeLimitInput = () => ({
  id: 'writeLimit',
  name: 'writeLimit',
  description: currentT('DeviceDetail.agentTools.common.inputs.writeLimit', { defaultLimit: DEFAULT_WRITE_RECORD_LIMIT, maxLimit: MAX_WRITE_RECORD_LIMIT }),
  required: false,
  valueType: 'int'
})

const isWriteToPathEnabled = (args: Record<string, any>) => !!normalizeWriteToPath(args.writeToPath)

const isUnlimitedWriteRecordLimit = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value <= 0
  }
  const raw = String(value ?? '').trim().toLowerCase()
  return ['0', '-1', 'all', 'full', 'unlimited', 'none', 'false'].includes(raw)
}

const resolveWriteRecordLimit = (
  args: Record<string, any>,
  defaultValue = DEFAULT_WRITE_RECORD_LIMIT,
  maxValue = MAX_WRITE_RECORD_LIMIT
) => {
  const value = args.writeLimit ?? args.fileLimit ?? args.maxRecords
  // JSONL 写文件已经避开 WebSocket 大报文；显式导出完整数据时，不再用前端行数上限截断。
  if (isUnlimitedWriteRecordLimit(value)) {
    return {
      limit: UNLIMITED_WRITE_RECORD_LIMIT,
      unlimited: true
    }
  }
  return {
    limit: clampNumber(value, 1, maxValue, defaultValue),
    unlimited: false
  }
}

const stringifyToolResult = (value: unknown) => JSON.stringify(value, null, 2)

const isJsonSessionFilePath = (path: string) => /\.json$/i.test(path)
const isNdjsonSessionFilePath = (path: string) => /\.(ndjson|jsonl)$/i.test(path)

interface ToolSessionFileWriteSummary {
  writeToPath: string
  requestedWriteToPath?: string
  inputPath: string
  uri: string
  markdownLink: string
  format: 'jsonl'
  file?: Record<string, any>
  contentOmitted: true
  structuredDataHint: Record<string, any>
  protocolHint: string
  nextAction: string
}

const normalizeNdjsonWritePath = (path: string) => {
  const normalized = normalizeWriteToPath(path)
  if (!normalized) return normalized
  if (isNdjsonSessionFilePath(normalized)) return normalized
  if (isJsonSessionFilePath(normalized)) {
    return normalized.replace(/\.json$/i, '.jsonl')
  }
  return `${normalized.replace(/[/.]+$/g, '') || 'result'}.jsonl`
}

const normalizeSessionFileInfo = (
  file: Record<string, any> | undefined,
  filePath: string,
  fallbackSize = 0
) => ({
  ...(file || {}),
  path: String(file?.path || filePath || '').trim(),
  size: Number(file?.size ?? fallbackSize)
})

const resolveSessionFileUri = (
  sessionFiles: Record<string, any>,
  filePath: string,
  file?: Record<string, any>
) => String(
  file?.uri
  || (typeof sessionFiles.toUri === 'function' ? sessionFiles.toUri(filePath) : '')
  || `fs://${filePath}`
).trim()

const createSessionFileWriteSummary = (
  sessionFiles: Record<string, any>,
  requestedPath: string,
  filePath: string,
  file?: Record<string, any>
): ToolSessionFileWriteSummary => {
  const normalizedFile = normalizeSessionFileInfo(file, filePath)
  const actualPath = String(normalizedFile.path || filePath).trim()
  const fileUri = resolveSessionFileUri(sessionFiles, actualPath, normalizedFile)
  const fileName = actualPath.split('/').filter(Boolean).pop() || actualPath || 'result.jsonl'
  const nextAction = currentT('DeviceDetail.agentTools.common.file.jsonlNextAction', { fileUri, actualPath })
  return {
    writeToPath: actualPath,
    ...(requestedPath && requestedPath !== actualPath ? { requestedWriteToPath: requestedPath } : {}),
    inputPath: actualPath,
    uri: fileUri,
    markdownLink: `[${fileName}](${fileUri})`,
    format: 'jsonl',
    structuredDataHint: {
      format: 'jsonl',
      inputPath: actualPath,
      preferredWorkflow: 'business_tool(writeToPath) -> optional dataset_materialize/dataset_query for secondary processing -> optional chart/report',
      nextAction
    },
    protocolHint: currentT('DeviceDetail.agentTools.common.file.protocolHint'),
    file: normalizedFile,
    contentOmitted: true,
    nextAction
  }
}

const writeSessionFileTextChunk = async (
  sessionFiles: Record<string, any>,
  filePath: string,
  content: string,
  append: boolean
) => {
  if (typeof sessionFiles.upload === 'function') {
    return sessionFiles.upload(filePath, new Blob([content], { type: 'application/x-ndjson;charset=UTF-8' }), {
      append,
      charset: 'UTF-8'
    })
  }
  if (append && typeof sessionFiles.appendText === 'function') {
    return sessionFiles.appendText(filePath, content, { charset: 'UTF-8' })
  }
  if (typeof sessionFiles.writeText === 'function') {
    return sessionFiles.writeText(filePath, content, { append, charset: 'UTF-8' })
  }
  throw new Error(currentT('DeviceDetail.agentTools.common.errors.sessionFileApiUnavailable'))
}

const writeNdjsonRecordsToSessionFile = async <T = any>(
  args: Record<string, any>,
  call: AiClientToolCall,
  records: T[],
  options: { append: boolean }
) => {
  const requestedPath = normalizeWriteToPath(args.writeToPath)
  const filePath = normalizeNdjsonWritePath(requestedPath)
  if (!filePath) {
    throw new Error(currentT('DeviceDetail.agentTools.common.errors.writeToPathMissing'))
  }
  const sessionFiles = call.sessionFiles
  if (!sessionFiles) {
    throw new Error(currentT('DeviceDetail.agentTools.common.errors.sessionFileApiUnavailable'))
  }

  // 大结果按 JSONL/NDJSON 分块追加，避免把完整数组放进内存或 WebSocket 工具结果。
  const content = records.length
    ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n`
    : ''
  const file = await writeSessionFileTextChunk(sessionFiles, filePath, content, options.append)
  return createSessionFileWriteSummary(sessionFiles, requestedPath, filePath, file)
}

const writeRecordsToSessionFile = async <T = any>(
  args: Record<string, any>,
  call: AiClientToolCall,
  records: T[]
) => {
  if (!isWriteToPathEnabled(args)) {
    return undefined
  }
  return writeNdjsonRecordsToSessionFile(args, call, records, { append: false })
}

const writeToolResultToSessionFile = async (
  args: Record<string, any>,
  call: AiClientToolCall,
  result: Record<string, any>,
  options: {
    content?: string
    summary?: Record<string, any>
  } = {}
) => {
  const writeToPath = normalizeWriteToPath(args.writeToPath)
  if (!writeToPath) {
    return result
  }
  const sessionFiles = call.sessionFiles
  if (!sessionFiles || (typeof sessionFiles.writeText !== 'function' && typeof sessionFiles.upload !== 'function')) {
    throw new Error(currentT('DeviceDetail.agentTools.common.errors.sessionFileApiUnavailable'))
  }

  const content = options.content ?? stringifyToolResult(result)
  const file = typeof sessionFiles.upload === 'function'
    ? await sessionFiles.upload(writeToPath, content, { append: false, charset: 'UTF-8' })
    : await sessionFiles.writeText(writeToPath, content, { charset: 'UTF-8' })
  const filePath = String(file.path || writeToPath || '').trim()
  const fileUri = String(file.uri || (typeof sessionFiles.toUri === 'function' ? sessionFiles.toUri(filePath) : '') || `fs://${filePath}`).trim()
  const fileName = filePath.split('/').filter(Boolean).pop() || filePath || 'result'
  const structuredDataHint = isJsonSessionFilePath(filePath)
    ? {
        format: 'json',
        inputPath: filePath,
        preferredWorkflow: 'business_tool(writeToPath) -> optional dataset_materialize/dataset_query for secondary processing -> optional chart/report',
        nextAction: currentT('DeviceDetail.agentTools.common.file.structuredNextAction', { fileUri, filePath })
      }
    : undefined

  return {
    ...(options.summary || {}),
    writeToPath,
    inputPath: filePath,
    uri: fileUri,
    markdownLink: `[${fileName}](${fileUri})`,
    protocolHint: currentT('DeviceDetail.agentTools.common.file.protocolHint'),
    ...(structuredDataHint ? { structuredDataHint } : {}),
    file,
    contentOmitted: true,
    nextAction: structuredDataHint?.nextAction || currentT('DeviceDetail.agentTools.common.file.writtenNextAction', { fileUri })
  }
}

const DEVICE_ONLINE_OFFLINE_TYPES = ['online', 'offline'] as const

const normalizeDeviceLogTypeToken = (value: unknown) => {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const normalized = raw.toLowerCase().replace(/[\s_\-./|,，、]+/g, '')
  const alias = ({
    online: 'online',
    on: 'online',
    up: 'online',
    connect: 'online',
    connected: 'online',
    '上线': 'online',
    '在线': 'online',
    '接入': 'online',
    offline: 'offline',
    off: 'offline',
    down: 'offline',
    disconnect: 'offline',
    disconnected: 'offline',
    '离线': 'offline',
    '下线': 'offline',
    '断开': 'offline',
  } as Record<string, string>)[normalized]
  if (alias) return alias
  if (['上下线', '上线离线', '在线离线', '上下线记录', '上下线日志', 'onlineoffline', 'both'].includes(normalized)) {
    return DEVICE_ONLINE_OFFLINE_TYPES
  }
  return raw
}

const normalizeDeviceLogTypes = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '')
      .split(/[,\s，、/|]+/)
      .filter(Boolean)
  const normalized = values.flatMap((item) => {
    const type = normalizeDeviceLogTypeToken(item)
    return Array.isArray(type) ? type : (type ? [type] : [])
  })
  return Array.from(new Set(normalized))
}

const normalizeOnlineOfflineTypes = (value: unknown) => {
  const types = normalizeDeviceLogTypes(value)
    .filter((type): type is typeof DEVICE_ONLINE_OFFLINE_TYPES[number] => (
      DEVICE_ONLINE_OFFLINE_TYPES.includes(type as any)
    ))
  return types.length ? types : [...DEVICE_ONLINE_OFFLINE_TYPES]
}

const buildDeviceLogTerms = (args: Record<string, any>, resolved = resolveTimeRange(args)) => {
  const types = normalizeDeviceLogTypes(args.type ?? args.types)
  const typeTerm = buildSimpleTerm('type', types.length > 1 ? types : types[0])
  return [
    ...buildTimeTerms(args, 'timestamp', resolved),
    ...(typeTerm ? [typeTerm] : []),
    ...(args.keyword ? [{ column: 'content', termType: 'like', value: String(args.keyword).trim() }] : [])
  ]
}

const booleanInput = (value: unknown) => value === true || String(value || '').trim().toLowerCase() === 'true'

const readPreviousDeviceLogBoundary = async (
  deviceId: string,
  args: Record<string, any>,
  range: ResolvedTimeRange
) => {
  if (!booleanInput(args.includePreviousBoundary) || range.start === undefined) return undefined
  const response = await queryLog(deviceId, {
    paging: true,
    pageIndex: 0,
    pageSize: 1,
    sorts: [{ name: 'timestamp', order: 'desc' }],
    terms: buildDeviceLogTerms(args, { end: Math.max(0, range.start - 1) })
  })
  const item = normalizePagedList(response).data[0]
  return item ? normalizeDeviceLogRecord(item) : undefined
}

const readBlobText = async (response: any, maxBytes: number, mode = 'head') => {
  const blob = response instanceof Blob ? response : new Blob([response])
  const normalizedMode = mode === 'tail' ? 'tail' : 'head'
  const slice = blob.size > maxBytes && normalizedMode === 'tail'
    ? blob.slice(Math.max(0, blob.size - maxBytes))
    : (blob.size > maxBytes ? blob.slice(0, maxBytes) : blob)
  const text = await slice.text()
  return {
    text,
    size: blob.size,
    returnedBytes: slice.size,
    mode: normalizedMode,
    truncated: blob.size > maxBytes
  }
}

const readLatestProperty = async (deviceId: string, propertyId: string) => {
  try {
    const resp = await getProperty(deviceId, propertyId)
    return {
      propertyId,
      success: true,
      source: 'read',
      result: responseResult(resp)
    }
  } catch (error) {
    try {
      const historyResp = await getPropertyData(deviceId, propertyId, {
        paging: true,
        pageIndex: 0,
        pageSize: 1,
        sorts: [{ name: 'timestamp', order: 'desc' }],
        terms: []
      })
      const latest = normalizePagedList(historyResp).data[0]
      return {
        propertyId,
        success: !!latest,
        source: 'history',
        result: latest,
        readError: normalizeToolError(error)
      }
    } catch (historyError) {
      return {
        propertyId,
        success: false,
        source: 'none',
        error: normalizeToolError(historyError),
        readError: normalizeToolError(error)
      }
    }
  }
}

const fallbackT: TranslateFn = (key) => key

export const createDeviceDetailClientToolRuntime = (
  getDevice: () => DeviceDetailRecord,
  t: TranslateFn = fallbackT
): AiClientToolRuntime => {
  currentT = t
  registerDeviceDetailSelectorTools(t)
  return createAiClientToolRuntime<DeviceClientToolContext>(
    defineAiClientTools<DeviceClientToolContext>([
    ...createDeviceAccessClientTools({
      t,
      clampNumber,
      responseResult,
      compactInlineValue,
      stringifyToolResult,
      withWriteToPathInput,
      writeToolResultToSessionFile,
      getDeviceId
    }),
    {
      id: 'device_metadata_markdown',
      name: 'device_metadata_markdown',
      description: t('DeviceDetail.agentTools.metadataMarkdown.description'),
      inputs: withWriteToPathInput([
        {
          id: 'section',
          name: 'section',
          description: t('DeviceDetail.agentTools.metadata.inputs.section'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'limit',
          name: 'limit',
          description: t('DeviceDetail.agentTools.metadataMarkdown.inputs.limit'),
          required: false,
          valueType: 'int'
        }
      ]),
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.metadataMarkdown.help'),
      execute: async (args, context, call) => {
        const section = normalizeMetadataSection(args.section)
        const inlineLimit = clampNumber(args.limit, 1, 120, 40)
        const markdown = buildMetadataMarkdown(context, section, inlineLimit)
        const fullMarkdown = isWriteToPathEnabled(args)
          ? buildMetadataMarkdown(context, section, Number.MAX_SAFE_INTEGER)
          : markdown
        const result = {
          deviceId: getDeviceId(context),
          section,
          markdown
        }
        return writeToolResultToSessionFile(args, call, result, {
          content: fullMarkdown,
          summary: {
            deviceId: result.deviceId,
            section,
            format: 'markdown',
            fullResultWritten: true,
            inlinePreviewLimit: inlineLimit,
            markdownPreview: markdown
          }
        })
      }
    },
    {
      id: 'device_metadata_search',
      name: 'device_metadata_search',
      description: t('DeviceDetail.agentTools.metadataSearch.description'),
      inputs: [
        {
          id: 'keyword',
          name: 'keyword',
          description: t('DeviceDetail.agentTools.metadataSearch.inputs.keyword'),
          required: true,
          valueType: 'string'
        },
        {
          id: 'types',
          name: 'types',
          description: t('DeviceDetail.agentTools.metadataSearch.inputs.types'),
          required: false,
          valueType: { type: 'array', elementType: { type: 'string' } }
        },
        {
          id: 'limit',
          name: 'limit',
          description: t('DeviceDetail.agentTools.metadataSearch.inputs.limit'),
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.metadataSearch.help'),
      execute: (args, context) => {
        const metadata = getMetadata(context)
        const types = asArray<string>(args.types).length
          ? normalizeMetadataTypes(asArray<string>(args.types))
          : ['properties', 'functions', 'events', 'tags']
        const limit = clampNumber(args.limit, 1, 100, 20)
        return {
          deviceId: getDeviceId(context),
          keyword: String(args.keyword || ''),
          matches: fuzzySearchMetadata(metadata, String(args.keyword || ''), types, limit)
        }
      }
    },
    {
      id: 'device_latest_properties',
      name: 'device_latest_properties',
      description: t('DeviceDetail.agentTools.latestProperties.description'),
      inputs: [
        {
          id: 'propertyIds',
          name: 'propertyIds',
          description: t('DeviceDetail.agentTools.latestProperties.inputs.propertyIds'),
          required: false,
          valueType: { type: 'array', elementType: { type: 'string' } }
        },
        {
          id: 'limit',
          name: 'limit',
          description: t('DeviceDetail.agentTools.latestProperties.inputs.limit'),
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.latestProperties.help'),
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
        const metadata = getMetadata(context)
        const limit = clampNumber(args.limit, 1, 30, 15)
        const propertyIds = asArray<string>(args.propertyIds).length
          ? asArray<string>(args.propertyIds)
          : asArray(metadata.properties).map((item: any) => item.id).filter(Boolean).slice(0, limit)
        const data = await Promise.all(propertyIds.map((propertyId) => readLatestProperty(deviceId, propertyId)))
        return {
          deviceId,
          count: data.length,
          successCount: data.filter((item) => item.success).length,
          data: data.map(normalizeLatestPropertyRead)
        }
      }
    },
    {
      id: 'device_property_history_summary',
      name: 'device_property_history_summary',
      description: t('DeviceDetail.agentTools.propertyHistorySummary.description'),
      inputs: [
        {
          id: 'propertyId',
          name: 'propertyId',
          description: t('DeviceDetail.agentTools.common.inputs.propertyId'),
          required: true,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: startTimeDescription(),
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: endTimeDescription(),
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'sampleLimit',
          name: 'sampleLimit',
          description: t('DeviceDetail.agentTools.propertyHistorySummary.inputs.limit'),
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.propertyHistorySummary.help'),
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        const propertyId = String(args.propertyId || '').trim()
        if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
        if (!propertyId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.propertyIdMissing'))
        const sampleLimit = clampNumber(args.sampleLimit, 1, 10, 3)
        const timeRange = resolveTimeRange(args)
        const resp = await getPropertyData(deviceId, propertyId, {
          paging: true,
          pageIndex: 0,
          pageSize: sampleLimit,
          sorts: [{ name: 'timestamp', order: 'desc' }],
          terms: buildTimeTerms(args, 'timestamp', timeRange)
        })
        const result = normalizePagedList(resp)
        return {
          deviceId,
          propertyId,
          timeRange: describeResolvedTimeRange(timeRange),
          total: result.total,
          returned: result.data.length,
          samples: result.data.map((item: Record<string, any>) => normalizePropertyHistoryRecord(item, propertyId))
        }
      }
    },
    createDevicePropertyAggregateTool({
      copy: {
        description: t('DeviceDetail.agentTools.propertyAggregate.description'),
        help: t('DeviceDetail.agentTools.propertyAggregate.help'),
        propertyId: t('DeviceDetail.agentTools.propertyAggregate.inputs.propertyId'),
        propertyIds: t('DeviceDetail.agentTools.propertyAggregate.inputs.propertyIds'),
        aggregation: t('DeviceDetail.agentTools.propertyAggregate.inputs.agg'),
        interval: t('DeviceDetail.agentTools.propertyAggregate.inputs.interval'),
        startTime: startTimeDescription(),
        endTime: endTimeDescription(),
        timeRangeInput: timeRangeInput(),
        limit: t('DeviceDetail.agentTools.propertyAggregate.inputs.limit'),
        deviceIdMissing: t('DeviceDetail.agentTools.common.errors.deviceIdMissing'),
        propertyIdMissing: t('DeviceDetail.agentTools.common.errors.propertyIdMissing'),
        nonNumericWarning: propertyId => t(
          'DeviceDetail.agentTools.propertyAggregate.warning.nonNumericCount',
          { propertyId }
        ),
        truncated: t('DeviceDetail.agentTools.propertyAggregate.nextAction.truncated')
      },
      resolveSubject: (_args, context) => ({
        deviceId: getDeviceId(context),
        metadata: getMetadata(context)
      }),
      resolveTimeRange,
      describeTimeRange: describeResolvedTimeRange,
      dataTypeText,
      compactValue: compactInlineValue,
      decorateInputs: withWriteToPathInput,
      deliver: async ({ args, call, data, preview, inlineLimit, inlineResult, fullResult, base }) => {
        if (!String(args.writeToPath || '').trim()) return undefined
        const fileWrite = await writeRecordsToSessionFile(args, call, data)
        if (fileWrite) {
          return {
            ...base,
            ...fileWrite,
            returned: data.length,
            truncated: false,
            fullResultWritten: true,
            inlinePreviewLimit: inlineLimit,
            inlinePreviewReturned: preview.length,
            inlinePreviewTruncated: data.length > preview.length,
            dataPreview: preview
          }
        }
        return writeToolResultToSessionFile(args, call, inlineResult, {
          content: stringifyToolResult(fullResult),
          summary: {
            ...base,
            returned: data.length,
            truncated: false,
            fullResultWritten: true,
            inlinePreviewLimit: inlineLimit,
            inlinePreviewReturned: preview.length,
            inlinePreviewTruncated: data.length > preview.length,
            dataPreview: preview
          }
        })
      }
    }),
    ...createDeviceDocumentClientTools({
      t,
      clampNumber,
      asArray,
      responseResult,
      compactInlineValue,
      stringifyToolResult,
      withWriteToPathInput,
      writeToolResultToSessionFile,
      getDeviceId
    }),
    ...createDeviceEventClientTools({
      t,
      clampNumber,
      asArray,
      responseResult,
      resolveTimeRange,
      describeResolvedTimeRange,
      compactInlineValue,
      withWriteToPathInput,
      writeLimitInput,
      collectPagedToolData,
      writeToolResultToSessionFile,
      timeRangeInput,
      startTimeDescription: startTimeDescription(),
      endTimeDescription: endTimeDescription(),
      getDeviceId,
      getMetadata
    }),
    ...createDeviceFunctionClientTools({
      t,
      asArray,
      responseResult,
      compactInlineValue,
      getDeviceId,
      getMetadata
    }),
    ...createDeviceAlarmClientTools({
      t,
      clampNumber,
      asArray,
      responseResult,
      resolveTimeRange,
      describeResolvedTimeRange,
      compactInlineValue,
      withWriteToPathInput,
      writeLimitInput,
      collectPagedToolData,
      writeToolResultToSessionFile,
      timeRangeInput,
      startTimeDescription: startTimeDescription(),
      endTimeDescription: endTimeDescription(),
      getDeviceId
    }),
    ...createEdgeDiagnosisClientTools({
      t,
      clampNumber,
      asArray,
      responseResult,
      compactInlineValue,
      getDeviceId
    }),
    {
      id: 'device_property_history',
      name: 'device_property_history',
      description: t('DeviceDetail.agentTools.propertyHistory.description'),
      inputs: withWriteToPathInput([
        {
          id: 'propertyId',
          name: 'propertyId',
          description: t('DeviceDetail.agentTools.common.inputs.propertyId'),
          required: true,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: startTimeDescription(),
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: endTimeDescription(),
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'limit',
          name: 'limit',
          description: t('DeviceDetail.agentTools.propertyHistory.inputs.limit'),
          required: false,
          valueType: 'int'
        },
        writeLimitInput()
      ]),
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.propertyHistory.help'),
      execute: async (args, context, call) => {
        const deviceId = getDeviceId(context)
        const propertyId = String(args.propertyId || '').trim()
        if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
        if (!propertyId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.propertyIdMissing'))
        const inlineLimit = clampNumber(args.limit, 1, 50, 20)
        const timeRange = resolveTimeRange(args)
        const collected = await collectPagedToolData({
          args,
          call,
          inlineLimit,
          fetchPage: (pageIndex, pageSize) => getPropertyData(deviceId, propertyId, {
            paging: true,
            pageIndex,
            pageSize,
            sorts: [{ name: 'timestamp', order: 'desc' }],
            terms: buildTimeTerms(args, 'timestamp', timeRange)
          }),
          normalizeRecord: (item) => normalizePropertyHistoryRecord(item, propertyId)
        })
        const previewData = collected.data.slice(0, inlineLimit)
        const base = {
          deviceId,
          propertyId,
          timeRange: describeResolvedTimeRange(timeRange),
          total: collected.total
        }
        const result = {
          ...base,
          returned: previewData.length,
          truncated: collected.total > previewData.length,
          nextAction: collected.total > previewData.length ? t('DeviceDetail.agentTools.propertyHistory.nextAction.truncated') : undefined,
          data: previewData
        }
        if (collected.file) {
          return {
            ...base,
            ...collected.file,
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
        const fullResult = {
          ...base,
          returned: collected.returned,
          truncated: collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          data: collected.data
        }
        return writeToolResultToSessionFile(args, call, result, {
          content: stringifyToolResult(fullResult),
          summary: {
            ...base,
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
    },
    {
      id: 'device_online_offline_summary',
      name: 'device_online_offline_summary',
      ...DEVICE_LOG_SUMMARY_CONTRACT,
      description: t('DeviceDetail.agentTools.onlineOfflineSummary.description'),
      inputs: [
        {
          id: 'type',
          name: 'type',
          description: t('DeviceDetail.agentTools.onlineOfflineSummary.inputs.type'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: startTimeDescription(),
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: endTimeDescription(),
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'sampleLimit',
          name: 'sampleLimit',
          description: t('DeviceDetail.agentTools.onlineOfflineSummary.inputs.limit'),
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.onlineOfflineSummary.help'),
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
        const sampleLimit = clampNumber(args.sampleLimit, 1, 10, 5)
        const timeRange = resolveTimeRange(args)
        const types = normalizeOnlineOfflineTypes(args.type)
        const buildTermsByTypes = (targetTypes: string[]) => {
          const typeTerm = buildSimpleTerm('type', targetTypes.length > 1 ? targetTypes : targetTypes[0])
          return [
            ...buildTimeTerms(args, 'timestamp', timeRange),
            ...(typeTerm ? [typeTerm] : [])
          ]
        }

        const [onlineResult, offlineResult, sampleResult] = await Promise.all([
          types.includes('online')
            ? queryLog(deviceId, {
              paging: true,
              pageIndex: 0,
              pageSize: 1,
              sorts: [{ name: 'timestamp', order: 'desc' }],
              terms: buildTermsByTypes(['online'])
            })
            : Promise.resolve(undefined),
          types.includes('offline')
            ? queryLog(deviceId, {
              paging: true,
              pageIndex: 0,
              pageSize: 1,
              sorts: [{ name: 'timestamp', order: 'desc' }],
              terms: buildTermsByTypes(['offline'])
            })
            : Promise.resolve(undefined),
          queryLog(deviceId, {
            paging: true,
            pageIndex: 0,
            pageSize: sampleLimit,
            sorts: [{ name: 'timestamp', order: 'desc' }],
            terms: buildTermsByTypes(types)
          })
        ])
        const online = onlineResult ? normalizePagedList(onlineResult).total : undefined
        const offline = offlineResult ? normalizePagedList(offlineResult).total : undefined
        const samples = normalizePagedList(sampleResult)
        const counts = {
          ...(online !== undefined ? { online } : {}),
          ...(offline !== undefined ? { offline } : {})
        }
        return withDeviceLogSummaryEvidence({
          deviceId,
          source: 'device-log',
          types,
          timeRange: describeResolvedTimeRange(timeRange),
          onlineCount: online,
          offlineCount: offline,
          total: Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0),
          returned: samples.data.length,
          samples: samples.data.map(normalizeDeviceLogRecord)
        }, timeRange)
      }
    },
    {
      id: 'device_logs_summary',
      name: 'device_logs_summary',
      ...DEVICE_LOG_SUMMARY_CONTRACT,
      description: t('DeviceDetail.agentTools.logsSummary.description'),
      inputs: [
        {
          id: 'type',
          name: 'type',
          description: t('DeviceDetail.agentTools.logs.inputs.type'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'keyword',
          name: 'keyword',
          description: t('DeviceDetail.agentTools.logs.inputs.keyword'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: startTimeDescription(),
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: endTimeDescription(),
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'sampleLimit',
          name: 'sampleLimit',
          description: t('DeviceDetail.agentTools.propertyHistorySummary.inputs.limit'),
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.logsSummary.help'),
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
        const sampleLimit = clampNumber(args.sampleLimit, 1, 10, 3)
        const timeRange = resolveTimeRange(args)
        const types = normalizeDeviceLogTypes(args.type ?? args.types)
        const resp = await queryLog(deviceId, {
          paging: true,
          pageIndex: 0,
          pageSize: sampleLimit,
          sorts: [{ name: 'timestamp', order: 'desc' }],
          terms: buildDeviceLogTerms(args, timeRange)
        })
        const result = normalizePagedList(resp)
        return withDeviceLogSummaryEvidence({
          deviceId,
          type: types.length > 1 ? types : types[0],
          timeRange: describeResolvedTimeRange(timeRange),
          keyword: String(args.keyword || '').trim() || undefined,
          total: result.total,
          returned: result.data.length,
          samples: result.data.map(normalizeDeviceLogRecord)
        }, timeRange)
      }
    },
    {
      id: 'device_logs_query',
      name: 'device_logs_query',
      ...DEVICE_LOG_RECORDS_CONTRACT,
      description: t('DeviceDetail.agentTools.logsQuery.description'),
      inputs: withWriteToPathInput([
        {
          id: 'type',
          name: 'type',
          description: t('DeviceDetail.agentTools.logs.inputs.type'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'keyword',
          name: 'keyword',
          description: t('DeviceDetail.agentTools.logs.inputs.keyword'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: startTimeDescription(),
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: endTimeDescription(),
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'limit',
          name: 'limit',
          description: t('DeviceDetail.agentTools.logsQuery.inputs.limit'),
          required: false,
          valueType: 'int'
        },
        {
          id: 'includePreviousBoundary',
          name: 'includePreviousBoundary',
          description: t('DeviceDetail.agentTools.logsQuery.inputs.includePreviousBoundary'),
          required: false,
          valueType: 'boolean'
        },
        writeLimitInput()
      ]),
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.logsQuery.help'),
      execute: async (args, context, call) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error(currentT('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
        const inlineLimit = clampNumber(args.limit, 1, 20, 10)
        const timeRange = resolveTimeRange(args)
        const types = normalizeDeviceLogTypes(args.type ?? args.types)
        const collected = await collectPagedToolData({
          args,
          call,
          inlineLimit,
          fetchPage: (pageIndex, pageSize) => queryLog(deviceId, {
            paging: true,
            pageIndex,
            pageSize,
            sorts: [{ name: 'timestamp', order: 'desc' }],
            terms: buildDeviceLogTerms(args, timeRange)
          }),
          normalizeRecord: normalizeDeviceLogRecord
        })
        const previousBoundary = await readPreviousDeviceLogBoundary(deviceId, args, timeRange)
        let resultFile = collected.file
        if (previousBoundary) {
          collected.boundaryRecords.push(previousBoundary)
          if (resultFile) {
            resultFile = await writeNdjsonRecordsToSessionFile(args, call, [previousBoundary], { append: true })
          }
        }
        const deliveredRecordCount = collected.returned + (previousBoundary ? 1 : 0)
        // The boundary record is outside the requested range and must not consume its preview quota.
        const inlineRangeRecords = collected.data.slice(0, inlineLimit)
        const previewData = [
          ...inlineRangeRecords,
          ...(previousBoundary ? [previousBoundary] : [])
        ]
        const base = {
          deviceId,
          type: types.length > 1 ? types : types[0],
          timeRange: describeResolvedTimeRange(timeRange),
          total: collected.total,
          boundaryIncluded: !!previousBoundary,
          boundaryTimestamp: previousBoundary?.timestamp
        }
        const result = {
          ...base,
          returned: previewData.length,
          truncated: collected.truncated,
          nextAction: collected.truncated ? t('DeviceDetail.agentTools.logsQuery.nextAction.truncated') : undefined,
          data: previewData
        }
        if (resultFile) {
          return withDeviceLogRecordEvidence({
            ...base,
            ...resultFile,
            returned: collected.returned,
            truncated: collected.truncated,
            fullResultWritten: !collected.truncated,
            writeLimit: collected.writeLimit,
            writeLimitUnlimited: collected.writeLimitUnlimited,
            writeLimitExceeded: collected.truncated,
            inlinePreviewLimit: inlineLimit,
            inlinePreviewReturned: previewData.length,
            inlinePreviewTruncated: collected.returned > inlineRangeRecords.length,
            dataPreview: previewData
          }, {
            range: timeRange,
            total: collected.total,
            returned: collected.returned,
            recordCount: deliveredRecordCount,
            truncated: collected.truncated,
            reference: resultFile.uri,
            records: collected.boundaryRecords
          })
        }
        const fullResult = {
          ...base,
          returned: collected.returned,
          truncated: collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          data: previewData
        }
        const delivered = await writeToolResultToSessionFile(args, call, result, {
          content: stringifyToolResult(fullResult),
          summary: {
            ...base,
            returned: collected.returned,
            truncated: collected.truncated,
            fullResultWritten: !collected.truncated,
            writeLimit: collected.writeLimit,
            writeLimitUnlimited: collected.writeLimitUnlimited,
            writeLimitExceeded: collected.truncated,
            inlinePreviewLimit: inlineLimit,
            inlinePreviewReturned: previewData.length,
            inlinePreviewTruncated: collected.returned > inlineRangeRecords.length,
            dataPreview: previewData
          }
        })
        return withDeviceLogRecordEvidence(delivered, {
          range: timeRange,
          total: collected.total,
          returned: collected.returned,
          recordCount: deliveredRecordCount,
          truncated: collected.truncated,
          reference: String((delivered as Record<string, any>).uri || '').trim() || undefined,
          inlinePath: '$.data',
          records: collected.boundaryRecords
        })
      }
    },
    {
      id: 'edge_remote_file_workdir',
      name: 'edge_remote_file_workdir',
      description: t('DeviceDetail.agentTools.legacyRemoteFileWorkdir.description'),
      inputs: [],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.legacyRemoteFileWorkdir.help'),
      execute: async (_args, context) => {
        const deviceId = ensureRemoteFileSupported(context)
        const resp = await getRemoteSystemWorkingDirectory(deviceId)
        return {
          deviceId,
          accessProvider: context.device?.accessProvider,
          workingDirectory: ensureSuccessResult(resp) || ''
        }
      }
    },
    {
      id: 'edge_remote_file_list',
      name: 'edge_remote_file_list',
      description: t('DeviceDetail.agentTools.legacyRemoteFileList.description'),
      inputs: [
        {
          id: 'path',
          name: 'path',
          description: t('DeviceDetail.agentTools.legacyRemoteFile.inputs.pathOptionalWorkdir'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'filter',
          name: 'filter',
          description: t('DeviceDetail.agentTools.legacyRemoteFile.inputs.filter'),
          required: false,
          valueType: 'string'
        },
        {
          id: 'limit',
          name: 'limit',
          description: t('DeviceDetail.agentTools.legacyRemoteFile.inputs.limit50'),
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.legacyRemoteFileList.help'),
      execute: async (args, context) => {
        const deviceId = ensureRemoteFileSupported(context)
        const filter = String(args.filter || '').trim()
        const limit = clampNumber(args.limit, 1, 200, 50)
        let path = String(args.path || '').trim()
        if (!path) {
          path = ensureSuccessResult(await getRemoteSystemWorkingDirectory(deviceId)) || ''
        }
        if (!path) throw new Error(currentT('DeviceDetail.agentTools.legacyRemoteFile.errors.workdirMissing'))

        const resp = await listRemoteSystemFiles(deviceId, {
          path,
          filter: filter
            ? {
              id: 'fileName',
              configuration: {
                pattern: filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              }
            }
            : undefined
        })
        const files = asArray<RemoteSystemFileRecord>(ensureSuccessResult(resp))
        return {
          deviceId,
          path,
          filter: filter || undefined,
          total: files.length,
          returned: files.slice(0, limit).length,
          data: files.slice(0, limit).map(normalizeRemoteFile)
        }
      }
    },
    {
      id: 'edge_remote_file_read_text',
      name: 'edge_remote_file_read_text',
      description: t('DeviceDetail.agentTools.legacyRemoteFileRead.description'),
      inputs: withWriteToPathInput([
        {
          id: 'path',
          name: 'path',
          description: t('DeviceDetail.agentTools.legacyRemoteFile.inputs.fullPath'),
          required: true,
          valueType: 'string'
        },
        {
          id: 'maxBytes',
          name: 'maxBytes',
          description: t('DeviceDetail.agentTools.legacyRemoteFile.inputs.maxBytes'),
          required: false,
          valueType: 'int'
        },
        {
          id: 'mode',
          name: 'mode',
          description: t('DeviceDetail.agentTools.legacyRemoteFile.inputs.mode'),
          required: false,
          valueType: 'string'
        }
      ]),
      output: { type: 'object' },
      help: t('DeviceDetail.agentTools.legacyRemoteFileRead.help'),
      execute: async (args, context, call) => {
        const deviceId = ensureRemoteFileSupported(context)
        const path = String(args.path || '').trim()
        if (!path) throw new Error(currentT('DeviceDetail.agentTools.common.errors.pathMissing'))
        const maxBytes = clampNumber(args.maxBytes, 1, 128 * 1024, 16 * 1024)
        const mode = String(args.mode || 'head').trim()

        // 文件工具只暴露只读能力，避免智能体通过对话直接修改边端文件系统。
        const fileRead = await readBlobText(await downloadRemoteSystemFile(deviceId, path), maxBytes, mode)
        const result = {
          deviceId,
          path,
          ...fileRead
        }
        return writeToolResultToSessionFile(args, call, result, {
          content: fileRead.text,
          summary: {
            deviceId,
            path,
            size: fileRead.size,
            returnedBytes: fileRead.returnedBytes,
            mode: fileRead.mode,
            truncated: fileRead.truncated
          }
        })
      }
    },
    ...createDeviceTraceCaptureClientTools({
      t,
      clampNumber,
      compactInlineValue,
      withWriteToPathInput,
      writeRecordsToSessionFile,
      getDeviceId
    })
    ]),
    {
      toolsName: 'device-detail-client-tools',
      toolsDescription: [
        t('DeviceDetail.agentTools.runtime.description.0'),
        t('DeviceDetail.agentTools.runtime.description.1'),
        t('DeviceDetail.agentTools.runtime.description.2'),
        t('DeviceDetail.agentTools.runtime.description.3'),
        t('DeviceDetail.agentTools.runtime.description.4')
      ].join('\n'),
      registeredToolScopes: DEVICE_DETAIL_SELECTOR_SCOPE,
      getContext: () => ({ device: getDevice() || {} })
    }
  )
}
