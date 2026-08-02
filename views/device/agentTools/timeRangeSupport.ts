export interface DeviceToolTimeRange {
  start?: number
  end?: number
}

export interface ResolveDeviceToolTimeRangeOptions {
  invalidInputMessage?: string
  now?: () => number
}

type TimeBoundary = 'start' | 'end'
type JsonRecord = Record<string, unknown>

const RANGE_ARGUMENT_KEYS = ['timeRange', 'range', 'date', 'period'] as const
const START_BOUNDARY_KEYS = [
  'start', 'from', 'startTime', 'begin', 'beginTime', 'windowStartTime', 'window_start_time',
] as const
const END_BOUNDARY_KEYS = [
  'end', 'to', 'endTime', 'finish', 'finishTime', 'windowEndTime', 'window_end_time',
] as const
const NESTED_RANGE_KEYS = ['timeRange', 'range', 'result', 'data'] as const
const DATE_ONLY_PATTERN = /^\d{4}-\d{1,2}-\d{1,2}$/
const RANGE_SEPARATOR_PATTERN = /\s+(?:to|until|through)\s+|\s*(?:至|到|~|～)\s*|\s+[\-–—]\s+/i

const isRecord = (value: unknown): value is JsonRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
)

const isSupplied = (value: unknown) => value !== undefined && value !== null && value !== ''

const firstSupplied = (record: JsonRecord, keys: readonly string[]) => (
  keys.map(key => record[key]).find(isSupplied)
)

const startOfDay = (timestamp: number) => {
  const value = new Date(timestamp)
  value.setHours(0, 0, 0, 0)
  return value.getTime()
}

const startOfWeek = (timestamp: number) => {
  const value = new Date(startOfDay(timestamp))
  const day = value.getDay() || 7
  value.setDate(value.getDate() - day + 1)
  return value.getTime()
}

const startOfMonth = (timestamp: number) => {
  const value = new Date(timestamp)
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

const endOfDay = (timestamp: number) => addDays(startOfDay(timestamp), 1) - 1

const endOfPreviousMillisecond = (timestamp: number) => Math.max(0, timestamp - 1)

const parseLocalDateTime = (value: string, boundary: TimeBoundary) => {
  const matched = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?)?$/)
  if (!matched) return undefined

  const [, yearText, monthText, dayText, hourText, minuteText = '0', secondText = '0', millisecondText = '0'] = matched
  const dateOnly = hourText === undefined
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText || '0')
  const minute = Number(minuteText)
  const second = Number(secondText)
  const millisecond = Number(millisecondText.padEnd(3, '0'))
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond)
  if (date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
    || date.getSeconds() !== second) return undefined
  const timestamp = date.getTime()
  if (!Number.isFinite(timestamp)) return undefined
  return dateOnly && boundary === 'end' ? endOfDay(timestamp) : timestamp
}

const normalizeDateTimeSeparator = (value: string) => {
  const matched = value.match(/^(\d{4}-\d{1,2}-\d{1,2})\|\|(\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)$/i)
  return matched ? `${matched[1]}T${matched[2]}` : value
}

const parsePlainTimeValue = (value: unknown, boundary: TimeBoundary) => {
  if (!isSupplied(value)) return undefined
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

  const localDateTime = parseLocalDateTime(raw, boundary)
  if (localDateTime !== undefined) return localDateTime

  const normalized = normalizeDateTimeSeparator(raw)
  const timestamp = new Date(normalized).getTime()
  if (!Number.isFinite(timestamp)) return undefined
  return DATE_ONLY_PATTERN.test(normalized) && boundary === 'end' ? endOfDay(timestamp) : timestamp
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
    while (index < mathString.length && /\d/.test(mathString.charAt(index))) index += 1
    const amount = numberStart === index ? 1 : Number(mathString.slice(numberStart, index))
    if (!Number.isFinite(amount) || amount <= 0 || index >= mathString.length) return undefined

    const unit = mathString.charAt(index++)
    if (round && amount !== 1) return undefined
    if (round) {
      if (unit === 'y') value = new Date(value.getFullYear(), 0, 1)
      else if (unit === 'M') value = new Date(value.getFullYear(), value.getMonth(), 1)
      else if (unit === 'w') value = new Date(startOfWeek(value.getTime()))
      else if (unit === 'd') value = new Date(startOfDay(value.getTime()))
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

const parseDateMathValue = (value: unknown, boundary: TimeBoundary, now: number) => {
  if (!isSupplied(value) || typeof value === 'object') return undefined
  const raw = String(value).trim()
  if (!raw || normalizeDateTimeSeparator(raw) !== raw) return undefined

  const compact = raw.replace(/\s+/g, '')
  const nowMatched = compact.match(/^now(?:\(\))?(.*)$/i)
  if (nowMatched) return applyDateMath(nowMatched[1] || '', now)

  const separatorIndex = raw.indexOf('||')
  if (separatorIndex < 0) return undefined
  const base = parsePlainTimeValue(raw.slice(0, separatorIndex).trim(), boundary)
  if (base === undefined) return undefined
  return applyDateMath(raw.slice(separatorIndex + 2).replace(/\s+/g, ''), base)
}

const normalizeRelativeTimeRange = (value: unknown, now: number): DeviceToolTimeRange | undefined => {
  if (!isSupplied(value) || typeof value === 'object') return undefined
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) return undefined

  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  if (['today', '今日', '今天', '本日', '当天'].includes(normalized)) return { start: todayStart, end: now }
  if (['yesterday', '昨日', '昨天'].includes(normalized)) {
    return { start: addDays(todayStart, -1), end: endOfPreviousMillisecond(todayStart) }
  }
  if (['thisweek', '本周', '这周', '当前周'].includes(normalized)) return { start: weekStart, end: now }
  if (['lastweek', '上周'].includes(normalized)) {
    return { start: addDays(weekStart, -7), end: endOfPreviousMillisecond(weekStart) }
  }
  if (['thismonth', '本月', '这个月', '当前月'].includes(normalized)) return { start: monthStart, end: now }
  if (['lastmonth', '上月'].includes(normalized)) {
    return { start: addMonths(monthStart, -1), end: endOfPreviousMillisecond(monthStart) }
  }

  const matched = normalized.match(/^(?:last|past|recent|最近|近|过去)?(\d+)(ms|毫秒|s|秒|min|minute|minutes|分钟|m|h|hour|hours|小时|d|day|days|天|w|week|weeks|周|month|months|个月)$/)
  if (!matched) return undefined
  const amount = Number(matched[1])
  const unitMs = ({
    ms: 1,
    毫秒: 1,
    s: 1000,
    秒: 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    分钟: 60 * 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    小时: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    天: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    周: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    个月: 30 * 24 * 60 * 60 * 1000,
  } as Record<string, number>)[matched[2]]
  return Number.isFinite(amount) && amount > 0 && unitMs
    ? { start: now - amount * unitMs, end: now }
    : undefined
}

const resolveTimePoint = (value: unknown, boundary: TimeBoundary, now: number) => {
  const timestamp = parseDateMathValue(value, boundary, now) ?? parsePlainTimeValue(value, boundary)
  if (timestamp !== undefined) return timestamp
  const relative = normalizeRelativeTimeRange(value, now)
  return boundary === 'end' ? relative?.end : relative?.start
}

const splitExplicitRange = (value: string) => {
  const parts = value.split(RANGE_SEPARATOR_PATTERN).map(item => item.trim()).filter(Boolean)
  return parts.length === 2 ? parts : undefined
}

const toTimeRangeValue = (value: unknown, now: number): DeviceToolTimeRange | undefined => {
  const relative = normalizeRelativeTimeRange(value, now)
  if (relative) return relative

  if (Array.isArray(value)) {
    const start = resolveTimePoint(value[0], 'start', now)
    const end = resolveTimePoint(value[1], 'end', now)
    return (!isSupplied(value[0]) || start !== undefined) && (!isSupplied(value[1]) || end !== undefined)
      && (start !== undefined || end !== undefined) ? { start, end } : undefined
  }

  if (isRecord(value)) {
    const startValue = firstSupplied(value, START_BOUNDARY_KEYS)
    const endValue = firstSupplied(value, END_BOUNDARY_KEYS)
    const start = resolveTimePoint(startValue, 'start', now)
    const end = resolveTimePoint(endValue, 'end', now)
    if (isSupplied(startValue) || isSupplied(endValue)) {
      return (!isSupplied(startValue) || start !== undefined) && (!isSupplied(endValue) || end !== undefined)
        ? { start, end }
        : undefined
    }
    const nested = NESTED_RANGE_KEYS.map(key => value[key]).find(item => isSupplied(item) && item !== value)
    return nested === undefined ? undefined : toTimeRangeValue(nested, now)
  }

  if (typeof value === 'string') {
    const explicitRange = splitExplicitRange(value)
    if (explicitRange) {
      const start = resolveTimePoint(explicitRange[0], 'start', now)
      const end = resolveTimePoint(explicitRange[1], 'end', now)
      return start === undefined || end === undefined ? undefined : { start, end }
    }
    if (DATE_ONLY_PATTERN.test(value.trim())) {
      const start = resolveTimePoint(value, 'start', now)
      const end = resolveTimePoint(value, 'end', now)
      return start === undefined || end === undefined ? undefined : { start, end }
    }
  }

  const start = resolveTimePoint(value, 'start', now)
  return start === undefined ? undefined : { start }
}

/**
 * Resolves every supported client-tool time representation at the adapter boundary. Explicit but
 * malformed values fail closed so downstream queries cannot silently fall back to another period.
 */
export const resolveDeviceToolTimeRange = (
  args: JsonRecord,
  options: ResolveDeviceToolTimeRangeOptions = {},
): DeviceToolTimeRange => {
  const now = options.now?.() ?? Date.now()
  const rangeValue = firstSupplied(args, RANGE_ARGUMENT_KEYS)
  const range = isSupplied(rangeValue) ? toTimeRangeValue(rangeValue, now) : undefined
  const startValue = args.startTime
  const endValue = args.endTime
  const startRange = normalizeRelativeTimeRange(startValue, now)
  const endRange = normalizeRelativeTimeRange(endValue, now)
  const startPoint = resolveTimePoint(startValue, 'start', now)
  const endPoint = resolveTimePoint(endValue, 'end', now)

  const invalid = (isSupplied(rangeValue) && !range)
    || (isSupplied(startValue) && startPoint === undefined && !startRange)
    || (isSupplied(endValue) && endPoint === undefined && !endRange)
  if (invalid) {
    throw new Error(options.invalidInputMessage || 'The supplied time range cannot be parsed.')
  }

  const start = startPoint ?? range?.start ?? (!isSupplied(startValue) ? endRange?.start : undefined)
  const end = endPoint ?? startRange?.end ?? range?.end
  return start !== undefined && end !== undefined && start > end
    ? { start: end, end: start }
    : { start, end }
}

export const describeDeviceToolTimeRange = (range: DeviceToolTimeRange) => (
  range.start === undefined && range.end === undefined
    ? undefined
    : {
      startTime: range.start,
      endTime: range.end,
      startTimeText: range.start === undefined ? undefined : new Date(range.start).toLocaleString(),
      endTimeText: range.end === undefined ? undefined : new Date(range.end).toLocaleString(),
    }
)
