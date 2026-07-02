import { map } from 'rxjs/operators'
import { wsClient } from '@jetlinks-web/core'
import {
  downloadRemoteSystemFile,
  getProperty,
  getPropertyData,
  getRemoteSystemWorkingDirectory,
  listRemoteSystemFiles,
  queryLog
} from '../../../../api/instance'
import { queryByDevice as queryDeviceAlarmRecord } from '../../../../api/rule-engine/log'
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

type DeviceDetailRecord = Record<string, any>
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

const parseJsonObject = (value: unknown): Record<string, any> => {
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

const METADATA_SECTIONS = ['properties', 'functions', 'events', 'tags'] as const
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

const TIME_INPUT_EXAMPLES = '今日/今天/昨天/最近24小时/近7天/本周/本月、now、now-1d、now/d、2020-10-01||+1d'
const TIME_RANGE_DESCRIPTION = `时间范围，支持“${TIME_INPUT_EXAMPLES}”等自然语言或 JetLinks 时间表达式，也支持毫秒时间戳、可解析时间字符串，或后端时间工具返回的 {start/end/from/to/startTime/endTime}。`
const START_TIME_DESCRIPTION = `开始时间，支持毫秒时间戳、可解析时间字符串、“${TIME_INPUT_EXAMPLES}”等自然语言或 JetLinks 时间表达式。`
const END_TIME_DESCRIPTION = `结束时间，支持毫秒时间戳、可解析时间字符串、“${TIME_INPUT_EXAMPLES}”等自然语言或 JetLinks 时间表达式。`

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
  description: TIME_RANGE_DESCRIPTION,
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

const dataTypeText = (valueType: any): string => {
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

const metadataSectionItems = (metadata: Record<string, any>, section: string) => {
  if (VALID_METADATA_SECTIONS.has(section)) return asArray(metadata[section])
  return METADATA_SECTIONS.flatMap((type) => (
    asArray(metadata[type]).map((item) => ({ ...item, __type: type }))
  ))
}

const metadataTypeName = (type: string) => ({
  properties: '属性',
  functions: '功能',
  events: '事件',
  tags: '标签'
}[type] || type)

const propertyAccessText = (item: any) => {
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
    `# ${device.name || device.id || '设备'}物模型`,
    '',
    `- 设备ID: ${device.id || '--'}`,
    `- 产品: ${device.productName || device.productId || '--'}`,
    `- 状态: ${device.state?.text || device.state?.value || '--'}`,
    ''
  ]

  sections.forEach((key) => {
    const items = metadataSectionItems(metadata, key).slice(0, limit)
    lines.push(`## ${metadataTypeName(key)}（${metadataSectionItems(metadata, key).length}）`, '')
    if (!items.length) {
      lines.push('暂无定义', '')
      return
    }
    if (key === 'properties') {
      lines.push('| 标识 | 名称 | 类型 | 读写 | 说明 |', '| --- | --- | --- | --- | --- |')
      items.forEach((item: any) => {
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(dataTypeText(item.valueType))} | ${escapeMarkdownTableCell(propertyAccessText(item))} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    } else if (key === 'functions') {
      lines.push('| 标识 | 名称 | 输入 | 输出 | 说明 |', '| --- | --- | --- | --- | --- |')
      items.forEach((item: any) => {
        const inputs = asArray(item.inputs).map((input: any) => `${input.id}:${dataTypeText(input.valueType)}`).join(', ')
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(inputs || '--')} | ${escapeMarkdownTableCell(dataTypeText(item.output))} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    } else if (key === 'events') {
      lines.push('| 标识 | 名称 | 类型 | 输出 | 说明 |', '| --- | --- | --- | --- | --- |')
      items.forEach((item: any) => {
        const outputs = asArray(item.properties).map((property: any) => `${property.id}:${dataTypeText(property.valueType)}`).join(', ')
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(item.type || '--')} | ${escapeMarkdownTableCell(outputs || '--')} | ${escapeMarkdownTableCell(item.description)} |`)
      })
    } else {
      lines.push('| 标识 | 名称 | 类型 | 说明 |', '| --- | --- | --- | --- |')
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

const normalizeAlarmState = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return undefined
  return ({
    alarm: 'warning',
    active: 'warning',
    warning: 'warning',
    processing: 'warning',
    abnormal: 'warning',
    '告警': 'warning',
    '报警': 'warning',
    '告警中': 'warning',
    '报警中': 'warning',
    '异常': 'warning',
    normal: 'normal',
    recovered: 'normal',
    resolved: 'normal',
    closed: 'normal',
    '正常': 'normal',
    '已恢复': 'normal',
    '恢复': 'normal',
    '已处理': 'normal'
  } as Record<string, string>)[raw] || raw
}

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  const raw = String(value ?? '').trim().toLowerCase()
  return ['true', '1', 'yes', 'y', '只看告警中', '告警中'].includes(raw)
}

const buildSimpleTerm = (column: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== undefined && item !== null && item !== '')
    return values.length ? { column, termType: 'in', value: values } : undefined
  }
  return { column, termType: 'eq', value }
}

const buildDeviceAlarmTerms = (deviceId: string, args: Record<string, any>) => {
  const state = normalizeAlarmState(args.state || (toBoolean(args.onlyActive) ? 'warning' : undefined))
  const keyword = String(args.keyword || '').trim()
  const terms: any[] = [
    {
      terms: [
        { column: 'sourceId', value: deviceId, termType: 'eq' },
        { column: 'targetType', value: 'device', termType: 'eq' }
      ],
      type: 'and'
    },
    ...buildTimeTerms(args, 'alarmTime')
  ]

  const stateTerm = buildSimpleTerm('state', state)
  if (stateTerm) terms.push(stateTerm)

  const levelTerm = buildSimpleTerm('level', args.level)
  if (levelTerm) terms.push(levelTerm)

  if (keyword) {
    terms.push({
      type: 'or',
      terms: [
        { column: 'alarmName', termType: 'like', value: keyword },
        { column: 'triggerDesc', termType: 'like', value: keyword },
        { column: 'actualDesc', termType: 'like', value: keyword },
        { column: 'sourceName', termType: 'like', value: keyword }
      ]
    })
  }

  return terms
}

const normalizeAlarmRecord = (item: Record<string, any>) => ({
  id: item.id,
  alarmName: item.alarmName || item.name,
  level: item.level,
  state: {
    value: enumValue(item.state),
    text: enumText(item.state)
  },
  alarmTime: item.alarmTime,
  lastAlarmTime: item.lastAlarmTime,
  duration: item.duration,
  triggerDesc: item.triggerDesc,
  actualDesc: item.actualDesc,
  sourceId: item.sourceId,
  sourceName: item.sourceName,
  targetId: item.targetId,
  targetType: item.targetType,
  handleTime: item.handleTime,
  handleType: item.handleType
    ? {
        value: enumValue(item.handleType),
        text: enumText(item.handleType)
      }
    : undefined
})

const ensureRemoteFileSupported = (context: DeviceClientToolContext) => {
  const deviceId = getDeviceId(context)
  if (!deviceId) throw new Error('deviceId missing')
  const accessProvider = String(context.device?.accessProvider || '')
  if (!REMOTE_FILE_ACCESS_PROVIDERS.has(accessProvider)) {
    throw new Error(`remote file tools unsupported for accessProvider: ${accessProvider || 'unknown'}`)
  }
  return deviceId
}

const ensureSuccessResult = (response: any) => {
  if (response?.success === false) {
    throw new Error(response?.message || response?.result || 'request failed')
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

const writeToPathInput = {
  id: 'writeToPath',
  name: 'writeToPath',
  description: '可选。需要保存较大或完整查询结果时，传入会话文件相对路径，如 reports/property-history.jsonl 或 reports/metadata.md；分页明细工具会按 JSONL/NDJSON 逐页追加到当前会话文件容器并返回 fs:// 引用和 inputPath，非分页工具按自身内容格式写入。后续对大数据做过滤/聚合/排序/图表时优先用 dataset_materialize(format=jsonl) + dataset_query，不要用 text_regex_extract。',
  required: false,
  valueType: 'string'
}

const withWriteToPathInput = (inputs: any[]) => [...inputs, writeToPathInput]

const normalizeWriteToPath = (value: unknown) => String(value || '').trim()

const DEFAULT_WRITE_RECORD_LIMIT = 100000
const MAX_WRITE_RECORD_LIMIT = 1000000
const UNLIMITED_WRITE_RECORD_LIMIT = Number.MAX_SAFE_INTEGER

const writeLimitInput = () => ({
  id: 'writeLimit',
  name: 'writeLimit',
  description: `传 writeToPath 时最多写入多少条记录，默认${DEFAULT_WRITE_RECORD_LIMIT}，最大${MAX_WRITE_RECORD_LIMIT}；传 0、-1、all 或 unlimited 表示不按前端条数截断，仅受接口分页结束和会话文件配额限制；分页明细会写入 JSONL/NDJSON，limit 仍只控制内联预览。`,
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
  const nextAction = `已完成业务工具取数并写入 ${fileUri}。只有需要对这个已写入文件做二次过滤、排序、抽取轨迹或制图时，才调用 dataset_materialize(inputPath="${actualPath}", format="jsonl") 后使用 dataset_query 或图表工具；不要用 dataset 查询替代设备属性聚合、告警、日志等业务工具的首次取数。`
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
    protocolHint: '会话文件展示必须使用 fs:// 引用，不要改写为 file://、http:// 或本地路径；调用后端文件/数据集工具时使用 inputPath 相对路径。',
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
  throw new Error('session file api unavailable for writeToPath')
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
    throw new Error('writeToPath missing')
  }
  const sessionFiles = call.sessionFiles
  if (!sessionFiles) {
    throw new Error('session file api unavailable for writeToPath')
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
    throw new Error('session file api unavailable for writeToPath')
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
        nextAction: `已完成业务工具取数并写入 ${fileUri}。只有需要对这个已写入文件做二次过滤、排序、抽取轨迹或制图时，才调用 dataset_materialize(inputPath="${filePath}", jsonPath="$.data") 后使用 dataset_query 或图表工具；只读取少量字段时才用 json_query_path；不要用 dataset 查询替代设备属性聚合、告警、日志等业务工具的首次取数。`
      }
    : undefined

  return {
    ...(options.summary || {}),
    writeToPath,
    inputPath: filePath,
    uri: fileUri,
    markdownLink: `[${fileName}](${fileUri})`,
    protocolHint: '会话文件展示必须使用 fs:// 引用，不要改写为 file://、http:// 或本地路径；调用后端文件/数据集工具时使用 inputPath 相对路径。',
    ...(structuredDataHint ? { structuredDataHint } : {}),
    file,
    contentOmitted: true,
    nextAction: structuredDataHint?.nextAction || `查询结果已写入 ${fileUri}`
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

const normalizeTracePayload = (payload: Record<string, any>) => ({
  type: payload?.type,
  operation: payload?.operation,
  logLevel: payload?.logLevel,
  traceId: payload?.traceId,
  spanId: payload?.spanId,
  parentSpanId: payload?.parentSpanId,
  timestamp: payload?.timestamp,
  startTime: payload?.startTime,
  endTime: payload?.endTime,
  detail: compactInlineValue(payload?.detail, 1200),
  message: compactInlineValue(payload?.message, 1200),
  error: compactInlineValue(payload?.error, 1200),
  upstream: compactInlineValue(payload?.upstream, 1600),
  downstream: compactInlineValue(payload?.downstream, 1600)
})

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

const captureDeviceTrace = (deviceId: string, seconds: number, limit: number) => new Promise((resolve, reject) => {
  const duration = clampNumber(seconds, 1, 15, 5) * 1000
  const maxCount = clampNumber(limit, 1, 30, 10)
  const items: any[] = []
  let finished = false
  let sub: { unsubscribe: () => void } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    sub?.unsubscribe()
    sub = undefined
  }

  const finish = (reason: string) => {
    if (finished) return
    finished = true
    cleanup()
    resolve({
      deviceId,
      reason,
      count: items.length,
      data: items
    })
  }

  const fail = (error: unknown) => {
    if (finished) return
    finished = true
    cleanup()
    reject(error instanceof Error ? error : new Error(String(error)))
  }

  const topic = `/debug/device/${deviceId}/trace`
  const wsId = `ai-device-debug-${deviceId}-${Date.now()}`
  const socket = wsClient.getWebSocket(wsId, topic, {})
  if (!socket) {
    reject(new Error('device trace websocket unavailable'))
    return
  }

  timer = setTimeout(() => finish('timeout'), duration)
  sub = socket
    .pipe(map((res: any) => (res != null && res.payload !== undefined ? res.payload : res)))
    .subscribe((payload: any) => {
      items.push(normalizeTracePayload(payload))
      if (items.length >= maxCount) {
        finish('limit')
      }
    }, fail)
})

export const createDeviceDetailClientToolRuntime = (
  getDevice: () => DeviceDetailRecord
): AiClientToolRuntime => {
  registerDeviceDetailSelectorTools()
  return createAiClientToolRuntime<DeviceClientToolContext>(
    defineAiClientTools<DeviceClientToolContext>([
    ...createDeviceAccessClientTools({
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
      description: '将当前设备物模型转换为适合智能体阅读的 Markdown。',
      inputs: withWriteToPathInput([
        {
          id: 'section',
          name: 'section',
          description: '物模型范围：all、properties、functions、events、tags。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'limit',
          name: 'limit',
          description: '内联预览每个分类最多返回多少条，默认40，最大120；传 writeToPath 时完整物模型写入文件。',
          required: false,
          valueType: 'int'
        }
      ]),
      output: { type: 'object' },
      help: '获取物模型 Markdown。section=properties 只看属性；section=functions 只看功能；section=events 只看事件；默认 all。需要保存完整 Markdown 时传 writeToPath，limit 只控制内联预览。',
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
      description: '按标识、名称、说明或类型模糊搜索当前设备物模型。',
      inputs: [
        {
          id: 'keyword',
          name: 'keyword',
          description: '搜索关键词，可匹配物模型标识、名称、说明和数据类型。',
          required: true,
          valueType: 'string'
        },
        {
          id: 'types',
          name: 'types',
          description: '限定分类，如 properties/functions/events/tags 数组；为空时搜索全部。',
          required: false,
          valueType: { type: 'array', elementType: { type: 'string' } }
        },
        {
          id: 'limit',
          name: 'limit',
          description: '最多返回条数，默认20，最大100。',
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: '模糊搜索物模型。适合用户只记得“温度”“电压”“alarm”这类关键词时查找属性、功能或事件定义。',
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
      description: '获取当前设备一个或多个属性的最新值。',
      inputs: [
        {
          id: 'propertyIds',
          name: 'propertyIds',
          description: '属性ID数组；为空时按物模型属性顺序取前 limit 个。',
          required: false,
          valueType: { type: 'array', elementType: { type: 'string' } }
        },
        {
          id: 'limit',
          name: 'limit',
          description: 'propertyIds 为空时最多读取多少个属性，默认15，最大30。',
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: '查询设备属性最新值。优先尝试实时读取；设备离线或读取失败时回退到历史最新一条，并返回每个属性的 success/error 明细。',
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error('deviceId missing')
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
      description: '统计当前设备指定属性在时间范围内的历史数据条数，并返回少量最新样本。',
      inputs: [
        {
          id: 'propertyId',
          name: 'propertyId',
          description: '属性ID。',
          required: true,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: START_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: END_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'sampleLimit',
          name: 'sampleLimit',
          description: '返回最新样本条数，默认3，最大10。',
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: '属性历史统计。用户问“这段时间有没有上报”“上报了多少条”“最近有没有变化”时优先用此工具；需要少量原始样本再看 samples。',
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        const propertyId = String(args.propertyId || '').trim()
        if (!deviceId) throw new Error('deviceId missing')
        if (!propertyId) throw new Error('propertyId missing')
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
      clampNumber,
      asArray,
      responseResult,
      resolveTimeRange,
      describeResolvedTimeRange,
      dataTypeText,
      compactInlineValue,
      stringifyToolResult,
      withWriteToPathInput,
      writeToolResultToSessionFile,
      writeRecordsToSessionFile,
      timeRangeInput,
      startTimeDescription: START_TIME_DESCRIPTION,
      endTimeDescription: END_TIME_DESCRIPTION,
      getDeviceId,
      getMetadata
    }),
    ...createDeviceDocumentClientTools({
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
      startTimeDescription: START_TIME_DESCRIPTION,
      endTimeDescription: END_TIME_DESCRIPTION,
      getDeviceId,
      getMetadata
    }),
    ...createDeviceFunctionClientTools({
      asArray,
      responseResult,
      compactInlineValue,
      getDeviceId,
      getMetadata
    }),
    {
      id: 'device_property_history',
      name: 'device_property_history',
      description: '按时间倒序查询当前设备指定属性的少量历史样本。',
      inputs: withWriteToPathInput([
        {
          id: 'propertyId',
          name: 'propertyId',
          description: '属性ID。',
          required: true,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: START_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: END_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'limit',
          name: 'limit',
          description: '内联预览样本条数，默认20，最大50；传 writeToPath 时完整/大批量结果写入文件。',
          required: false,
          valueType: 'int'
        },
        writeLimitInput()
      ]),
      output: { type: 'object' },
      help: '查询单个属性历史样本。用于“最近20条温度数据”这类确实需要明细的问题；如果只是问有没有、多少条，优先使用 device_property_history_summary。需要保存大范围样本时传 writeToPath，建议优先使用 .jsonl 路径，也兼容 .ndjson，工具会逐页追加 JSONL/NDJSON；limit 只控制内联预览，writeLimit 控制文件写入条数，完整导出可传 writeLimit=0。',
      execute: async (args, context, call) => {
        const deviceId = getDeviceId(context)
        const propertyId = String(args.propertyId || '').trim()
        if (!deviceId) throw new Error('deviceId missing')
        if (!propertyId) throw new Error('propertyId missing')
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
          nextAction: collected.total > previewData.length ? '结果已截断，可传 writeToPath 保存更多历史样本。' : undefined,
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
      id: 'device_alarm_records_query',
      name: 'device_alarm_records_query',
      description: '查询平台告警中心中与当前设备关联的告警记录，是回答设备告警/报警问题的首选事实来源。',
      inputs: withWriteToPathInput([
        {
          id: 'state',
          name: 'state',
          description: '告警状态：warning 表示告警中，normal 表示已恢复/正常；为空查询全部。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'onlyActive',
          name: 'onlyActive',
          description: '是否只查询告警中的记录；为 true 时等同 state=warning。',
          required: false,
          valueType: 'boolean'
        },
        {
          id: 'level',
          name: 'level',
          description: '告警级别，可传单个级别或级别数组。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'keyword',
          name: 'keyword',
          description: '按告警名称、触发描述、告警原因或告警源模糊搜索。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: START_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: END_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'limit',
          name: 'limit',
          description: '内联预览条数，默认20，最大50；传 writeToPath 时更多告警记录写入文件。',
          required: false,
          valueType: 'int'
        },
        writeLimitInput()
      ]),
      output: { type: 'object' },
      help: '查询平台告警记录。用户问“有没有告警”“报警中吗”“最近告警原因”“某时间段告警”时优先使用此工具；物模型中的 alarmRecord 或属性历史只能作为补充解释，不作为告警事实的首选来源。需要保存大范围告警列表时传 writeToPath，建议优先使用 .jsonl 路径，也兼容 .ndjson，工具会逐页追加 JSONL/NDJSON；limit 只控制内联预览，writeLimit 控制文件写入条数，完整导出可传 writeLimit=0。',
      execute: async (args, context, call) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error('deviceId missing')
        const inlineLimit = clampNumber(args.limit, 1, 50, 20)
        const collected = await collectPagedToolData({
          args,
          call,
          inlineLimit,
          fetchPage: (pageIndex, pageSize) => queryDeviceAlarmRecord({
            paging: true,
            pageIndex,
            pageSize,
            sorts: [{ name: 'alarmTime', order: 'desc' }],
            terms: buildDeviceAlarmTerms(deviceId, args)
          }),
          normalizeRecord: normalizeAlarmRecord
        })
        const previewData = collected.data.slice(0, inlineLimit)
        const base = {
          deviceId,
          source: 'platform-alarm-record',
          state: normalizeAlarmState(args.state || (toBoolean(args.onlyActive) ? 'warning' : undefined)),
          keyword: String(args.keyword || '').trim() || undefined,
          total: collected.total
        }
        const result = {
          ...base,
          returned: previewData.length,
          truncated: collected.total > previewData.length,
          nextAction: collected.total > previewData.length ? '结果已截断，可传 writeToPath 保存更多告警记录。' : undefined,
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
      description: '统计当前设备在指定时间范围内的上线和离线日志数量，并返回少量最新上下线样本。',
      inputs: [
        {
          id: 'type',
          name: 'type',
          description: '统计范围：both/online/offline，也支持“上下线/上线/离线”；默认 both。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: START_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: END_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'sampleLimit',
          name: 'sampleLimit',
          description: '返回最新上下线样本条数，默认5，最大10。',
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: '设备上下线统计。用户问“上下线数量”“今天上线几次”“最近离线几次”“在线离线记录数量”时优先使用此工具；它会分别统计 online/offline 的 total，并只返回少量样本。',
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error('deviceId missing')
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
        return {
          deviceId,
          source: 'device-log',
          types,
          timeRange: describeResolvedTimeRange(timeRange),
          onlineCount: online,
          offlineCount: offline,
          total: Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0),
          returned: samples.data.length,
          samples: samples.data.map(normalizeDeviceLogRecord)
        }
      }
    },
    {
      id: 'device_logs_summary',
      name: 'device_logs_summary',
      description: '统计当前设备日志数量，并返回少量最新日志样本；上下线数量优先使用 device_online_offline_summary。',
      inputs: [
        {
          id: 'type',
          name: 'type',
          description: '日志类型，可为空；上线/在线会归一为 online，离线/下线会归一为 offline，上下线会归一为 online/offline。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'keyword',
          name: 'keyword',
          description: '日志内容关键词。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: START_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: END_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'sampleLimit',
          name: 'sampleLimit',
          description: '返回最新样本条数，默认3，最大10。',
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: '设备日志统计。用户问“最近有没有上报/错误/日志”“日志多少条”“这段时间是否有通信”时使用此工具；如果问题是“上下线数量/上线几次/离线几次”，优先使用 device_online_offline_summary。只返回 total 和少量 samples，避免把整页日志回传给模型。',
      execute: async (args, context) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error('deviceId missing')
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
        return {
          deviceId,
          type: types.length > 1 ? types : types[0],
          timeRange: describeResolvedTimeRange(timeRange),
          keyword: String(args.keyword || '').trim() || undefined,
          total: result.total,
          returned: result.data.length,
          samples: result.data.map(normalizeDeviceLogRecord)
        }
      }
    },
    {
      id: 'device_logs_query',
      name: 'device_logs_query',
      description: '查询当前设备少量操作日志和消息日志样本。',
      inputs: withWriteToPathInput([
        {
          id: 'type',
          name: 'type',
          description: '日志类型，可为空；上线/在线会归一为 online，离线/下线会归一为 offline，上下线会归一为 online/offline。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'keyword',
          name: 'keyword',
          description: '日志内容关键词。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'startTime',
          name: 'startTime',
          description: START_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        {
          id: 'endTime',
          name: 'endTime',
          description: END_TIME_DESCRIPTION,
          required: false,
          valueType: 'string'
        },
        timeRangeInput(),
        {
          id: 'limit',
          name: 'limit',
          description: '内联预览样本条数，默认10，最大20；传 writeToPath 时更多日志样本写入文件。',
          required: false,
          valueType: 'int'
        },
        writeLimitInput()
      ]),
      output: { type: 'object' },
      help: '查询设备日志样本。需要查看少量原始日志内容时使用；如果只是问有没有、多少条、最近是否有通信，优先使用 device_logs_summary；上下线数量优先使用 device_online_offline_summary。需要保存大范围日志样本时传 writeToPath，建议优先使用 .jsonl 路径，也兼容 .ndjson，工具会逐页追加 JSONL/NDJSON；limit 只控制内联预览，writeLimit 控制文件写入条数，完整导出可传 writeLimit=0。',
      execute: async (args, context, call) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error('deviceId missing')
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
        const previewData = collected.data.slice(0, inlineLimit)
        const base = {
          deviceId,
          type: types.length > 1 ? types : types[0],
          timeRange: describeResolvedTimeRange(timeRange),
          total: collected.total
        }
        const result = {
          ...base,
          returned: previewData.length,
          truncated: collected.total > previewData.length,
          nextAction: collected.total > previewData.length ? '结果已截断，可传 writeToPath 保存更多日志样本。' : undefined,
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
      id: 'edge_remote_file_workdir',
      name: 'edge_remote_file_workdir',
      description: '获取当前边缘网关设备远程文件管理的工作目录。',
      inputs: [],
      output: { type: 'object' },
      help: '获取边缘网关远程文件系统的当前工作目录。适合在列目录或读取日志文件前确认根路径。',
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
      description: '列出当前边缘网关设备远程文件系统目录。',
      inputs: [
        {
          id: 'path',
          name: 'path',
          description: '目录路径；为空时先读取远程工作目录。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'filter',
          name: 'filter',
          description: '按文件名过滤的关键词。',
          required: false,
          valueType: 'string'
        },
        {
          id: 'limit',
          name: 'limit',
          description: '最多返回条数，默认50，最大200。',
          required: false,
          valueType: 'int'
        }
      ],
      output: { type: 'object' },
      help: '列出边缘网关远程文件。path 为空时使用工作目录；filter 可按文件名模糊过滤；返回目录/文件、大小、权限和时间信息。',
      execute: async (args, context) => {
        const deviceId = ensureRemoteFileSupported(context)
        const filter = String(args.filter || '').trim()
        const limit = clampNumber(args.limit, 1, 200, 50)
        let path = String(args.path || '').trim()
        if (!path) {
          path = ensureSuccessResult(await getRemoteSystemWorkingDirectory(deviceId)) || ''
        }
        if (!path) throw new Error('remote working directory missing')

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
      description: '读取当前边缘网关远程文件的文本内容片段。',
      inputs: withWriteToPathInput([
        {
          id: 'path',
          name: 'path',
          description: '远程文件完整路径。',
          required: true,
          valueType: 'string'
        },
        {
          id: 'maxBytes',
          name: 'maxBytes',
          description: '最多读取字节数，默认16384，最大131072。',
          required: false,
          valueType: 'int'
        },
        {
          id: 'mode',
          name: 'mode',
          description: '读取位置：head 表示文件开头，tail 表示文件末尾；默认 head。',
          required: false,
          valueType: 'string'
        }
      ]),
      output: { type: 'object' },
      help: '读取远程文本文件片段。仅用于日志、配置、脚本等文本内容分析；默认读取 16 KiB，最多 128 KiB，可用 mode=tail 查看日志末尾，并通过 truncated 标记是否截断。需要把片段保存为会话文件时传 writeToPath。',
      execute: async (args, context, call) => {
        const deviceId = ensureRemoteFileSupported(context)
        const path = String(args.path || '').trim()
        if (!path) throw new Error('path missing')
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
    {
      id: 'device_trace_capture',
      name: 'device_trace_capture',
      description: '订阅并抓取当前设备实时链路、协议日志和诊断数据。',
      inputs: withWriteToPathInput([
        {
          id: 'seconds',
          name: 'seconds',
          description: '抓取秒数，默认5，最大15。',
          required: false,
          valueType: 'int'
        },
        {
          id: 'limit',
          name: 'limit',
          description: '最多抓取条数，默认10，最大30。',
          required: false,
          valueType: 'int'
        }
      ]),
      output: { type: 'object' },
      help: '实时抓取设备接入链路样本。用于排查连接、认证、上报、下发、编解码等问题；工具会压缩上下行报文和错误详情，若设备当前无通信，可能返回空数组。需要保存完整抓包结果时传 writeToPath。',
      execute: async (args, context, call) => {
        const deviceId = getDeviceId(context)
        if (!deviceId) throw new Error('deviceId missing')
        const result = await captureDeviceTrace(deviceId, Number(args.seconds || 5), Number(args.limit || 10)) as Record<string, any>
        return writeToolResultToSessionFile(args, call, result, {
          summary: {
            deviceId,
            reason: result.reason,
            count: result.count
          }
        })
      }
    }
    ]),
    {
      toolsName: 'device-detail-client-tools',
      toolsDescription: '设备详情页提供的当前设备问数与诊断工具。可用于自然语言问题中的在线状态、接入配置、接入地址、认证字段、协议说明、接入会话、物模型、属性快照、属性聚合趋势、事件上报数据、设备文档与维修知识库、平台告警记录、上下线统计、日志统计与少量样本、边缘网关远程文件片段和实时链路样本分析；普通用户无需知道工具名，接入指南、协议说明、认证失败、连接地址等问题优先用 device_access_summary 获取设备接入 Tab 中的配置、身份、协议说明和在线连接证据，日志/属性/事件优先用 summary、aggregate 或 event 工具回答有没有、多少条、平均/最大/最小、首次/末次/去重计数和趋势。设备文档问题优先用 device_documents_query 查找当前设备和所属产品文档，或用 device_document_reference 定位 platform-file-id 与 url/fileUrl；文档正文不要通过前端工具读取，需由后端 fs_download 或统一文件/文档通道导入或挂载到会话文件容器后再按 inputPath 分析。需要选择其它设备时可使用动态注册的 selector 工具获取候选设备；当前设备默认来自 subject。只有用户明确要求下发/调用/执行设备功能时，才可使用 device_function_invoke，并且会在下发前要求用户确认。部分明细工具支持 writeToPath，可把较大或完整结果写入当前会话文件容器并返回 fs:// 引用和 inputPath；分页明细和聚合结果默认写 JSONL/NDJSON，建议优先使用 .jsonl 路径，也兼容 .ndjson，limit 只控制内联预览，writeLimit 控制分页类工具写入文件的记录数，完整导出可传 writeLimit=0；若返回 writeLimitExceeded/truncated，需要向用户说明结果受上限影响并建议缩小时间范围、提高 writeLimit 或使用 writeLimit=0 完整导出；对写入的 JSONL/NDJSON 继续过滤、聚合、排序、抽取轨迹或生成图表时，优先用 dataset_materialize(format=jsonl) + dataset_query 或 chart_echarts2svg，不要用 text_regex_extract 或脚本解析大文本。',
      registeredToolScopes: DEVICE_DETAIL_SELECTOR_SCOPE,
      getContext: () => ({ device: getDevice() || {} })
    }
  )
}
