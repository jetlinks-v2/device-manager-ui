import { request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'

import type { DeviceGroupTrendRange } from '../api/deviceGroup'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})

export type AlarmRecordRow = Record<string, any>

export interface AlarmTrendPoint {
  label: string
  value: number
}

export interface AlarmTrendBucketPoint extends AlarmTrendPoint {
  timestamp: number
}

export interface DeviceAlarmTrendBundle {
  trend: AlarmTrendPoint[]
  bucket: AlarmTrendBucketPoint[]
}

export interface DeviceAlarmRankRow {
  id: string
  deviceId: string
  name: string
  count: number
}

export interface ActiveDeviceAlarmStat {
  deviceId: string
  count: number
}

export interface AlarmRecordPage {
  data: AlarmRecordRow[]
  total: number
  pageIndex: number
  pageSize: number
}

export type DeviceAlarmOverviewRange = DeviceGroupTrendRange | 'month'

interface DashboardItem {
  group: string
  data?: Record<string, any>
}

const USE_LATEST_ALARM_MOCK = false

export async function queryDeviceAlarmRecords(range?: DeviceGroupTrendRange): Promise<AlarmRecordRow[]> {
  const response: any = await request.post('/alarm/record/device/_query', {
    paging: false,
    sorts: [{ name: 'alarmTime', order: 'desc' }],
    terms: buildRecordTerms(range),
  }).catch(() => ({ result: { data: [] } }))
  const result = response?.result ?? response
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.records)) return result.records
  return []
}

export async function queryDeviceAlarmRecordPage(pageIndex: number, pageSize: number): Promise<AlarmRecordPage> {
  if (USE_LATEST_ALARM_MOCK) return mockAlarmRecordPage(pageIndex, pageSize)
  const response: any = await request.post('/alarm/record/device/_query', {
    paging: true,
    pageIndex,
    pageSize,
    sorts: [{ name: 'alarmTime', order: 'desc' }],
    terms: buildRecordTerms(),
  }).catch(() => ({ result: { data: [], total: 0, pageIndex, pageSize } }))
  return unwrapPage(response, pageIndex, pageSize)
}

export async function queryActiveDeviceAlarmStats(): Promise<ActiveDeviceAlarmStat[]> {
  const response: any = await request.post('/alarm/record/device/_aggregation', {
    columns: [{ column: 'id', alias: 'alarmCount', aggregation: 'COUNT' }],
    groupBy: [{ column: 'targetId', alias: 'targetId' }],
    filter: {
      terms: [
        { column: 'state', termType: 'eq', value: 'warning' },
      ],
    },
  }).catch(() => ({ result: [] }))
  const rows = Array.isArray(response?.result) ? response.result : Array.isArray(response) ? response : []
  return rows
    .map((item: any) => ({
      deviceId: String(item?.targetId ?? item?.deviceId ?? '').trim(),
      count: Number(item?.alarmCount ?? item?.count ?? 0),
    }))
    .filter((item: ActiveDeviceAlarmStat) => Boolean(item.deviceId))
}

export async function queryDeviceAlarmTrend(range: DeviceAlarmOverviewRange): Promise<AlarmTrendPoint[]> {
  const rows = await queryDeviceAlarmTrendByBucket(range)
  return rows.map(({ timestamp, ...item }) => item)
}

export async function queryDeviceAlarmTrendByBucket(
  range: DeviceAlarmOverviewRange,
  options: { time: string; format: string; limit: number } | undefined = undefined,
): Promise<AlarmTrendBucketPoint[]> {
  const query = buildAlarmDashboardQuery('alarmTrend', 'trend', range)
  if (options) Object.assign(query.params, options)
  const rows = await queryDashboard([query])
  return parseTrendRows(rows, query.group, query.params.time)
}

/**
 * 趋势曲线与时段分布均来自告警趋势聚合，在一次 dashboard multi 请求中返回不同粒度的数据。
 */
export async function queryDeviceAlarmTrendBundle(
  range: DeviceAlarmOverviewRange,
  bucketOptions: { time: string; format: string; limit: number },
): Promise<DeviceAlarmTrendBundle> {
  const trendQuery = buildAlarmDashboardQuery('alarmTrend', 'trend', range)
  const bucketQuery = buildAlarmDashboardQuery('alarmTrendBucket', 'trend', range)
  Object.assign(bucketQuery.params, bucketOptions)
  const rows = await queryDashboard([trendQuery, bucketQuery])
  const trend = parseTrendRows(rows, trendQuery.group, trendQuery.params.time)
    .map(({ timestamp, ...item }) => item)
  return {
    trend,
    bucket: parseTrendRows(rows, bucketQuery.group, bucketQuery.params.time),
  }
}

export async function queryDeviceAlarmRank(range: DeviceAlarmOverviewRange, limit = 24): Promise<DeviceAlarmRankRow[]> {
  const query = buildAlarmDashboardQuery('alarmRank', 'rank', range, limit)
  const rows = await queryDashboard([query])
  return rows
    .filter((item) => item.group === 'alarmRank' && Number(item.data?.value?.count ?? 0) > 0)
    .map((item) => toRankRow(item.data?.value))
    .filter((item): item is DeviceAlarmRankRow => Boolean(item))
    .sort((left, right) => right.count - left.count)
}

export function rangeDuration(range: DeviceAlarmOverviewRange) {
  if (range === '30d') return 30 * 24 * 60 * 60 * 1000
  if (range === '7d') return 7 * 24 * 60 * 60 * 1000
  return 24 * 60 * 60 * 1000
}

export function formatApiTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function buildRecordTerms(range?: DeviceGroupTrendRange) {
  const terms = [{ column: 'targetType', termType: 'eq', value: 'device' }]
  if (!range) return terms
  return [
    { column: 'alarmTime', termType: 'gte', value: formatApiTime(new Date(Date.now() - rangeDuration(range))) },
    ...terms,
  ]
}

function buildAlarmDashboardQuery(group: string, measurement: 'trend' | 'rank', range: DeviceAlarmOverviewRange, rankLimit?: number) {
  const end = new Date()
  const start = range === 'month'
    ? new Date(end.getFullYear(), end.getMonth(), 1)
    : new Date(end.getTime() - rangeDuration(range))
  const bucket = dashboardBucket(end.getTime() - start.getTime())
  return {
    dashboard: 'alarm',
    object: 'record',
    measurement,
    dimension: 'agg',
    group,
    params: {
      targetType: 'device',
      format: bucket.format,
      time: bucket.time,
      from: formatApiTime(start),
      to: formatApiTime(end),
      limit: rankLimit ?? bucket.limit,
    },
  }
}

function dashboardBucket(duration: number) {
  // Keep the bucket rules aligned with the legacy alarm dashboard so counts match /iot/Alarm/dashboard.
  const hour = 60 * 60 * 1000
  const day = hour * 24
  const year = 365 * day
  if (duration <= hour + 10) return { time: '1m', format: 'MM-dd HH:mm', limit: 60 }
  if (duration <= day) return { time: '1h', format: 'MM-dd HH:mm', limit: 24 }
  if (duration < year) return { time: '1d', format: 'MM-dd HH:mm:ss', limit: Math.abs(Math.ceil(duration / day)) + 1 }
  return { time: '1M', format: 'yyyy-MM', limit: Math.abs(Math.floor(duration / (day * 30))) }
}

async function queryDashboard(queries: ReturnType<typeof buildAlarmDashboardQuery>[]): Promise<DashboardItem[]> {
  const response: any = await request.post('/dashboard/_multi', queries).catch(() => ({ result: [] }))
  return Array.isArray(response?.result) ? response.result : []
}

function unwrapPage(payload: unknown, fallbackPageIndex: number, fallbackPageSize: number): AlarmRecordPage {
  const result = isRecord(payload) && 'result' in payload
    ? payload.result
    : isRecord(payload) && 'data' in payload
      ? payload.data
      : payload

  if (Array.isArray(result)) {
    return {
      data: result as AlarmRecordRow[],
      total: fallbackPageIndex * fallbackPageSize + result.length,
      pageIndex: fallbackPageIndex,
      pageSize: fallbackPageSize,
    }
  }

  if (isRecord(result)) {
    const data = Array.isArray(result.data)
      ? result.data as AlarmRecordRow[]
      : Array.isArray(result.records)
        ? result.records as AlarmRecordRow[]
        : []
    return {
      data,
      total: Number(result.total ?? fallbackPageIndex * fallbackPageSize + data.length),
      pageIndex: Number(result.pageIndex ?? fallbackPageIndex),
      pageSize: Number(result.pageSize ?? fallbackPageSize),
    }
  }

  return { data: [], total: 0, pageIndex: fallbackPageIndex, pageSize: fallbackPageSize }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object'
}

function mockAlarmRecordPage(pageIndex: number, pageSize: number): AlarmRecordPage {
  const data = mockLatestAlarmRecords()
  return {
    data: data.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
    total: data.length,
    pageIndex,
    pageSize,
  }
}

function mockLatestAlarmRecords(): AlarmRecordRow[] {
  const names = [
    t('IotAlarmOverview.mock.voltage'),
    t('IotAlarmOverview.mock.offline'),
    t('IotAlarmOverview.mock.temperature'),
    t('IotAlarmOverview.mock.humidity'),
    t('IotAlarmOverview.mock.current'),
    t('IotAlarmOverview.mock.gateway'),
  ]
  const devices = [
    t('IotAlarmOverview.mock.device.voltage'),
    'mqtt-1',
    t('IotAlarmOverview.mock.device.pump'),
    t('IotAlarmOverview.mock.device.thermostat'),
    t('IotAlarmOverview.mock.device.collector'),
    t('IotAlarmOverview.mock.device.gateway'),
  ]
  const states = ['warning', 'warning', 'normal', 'warning']
  const levels = [2, 3, 4, 1, 5]
  const now = Date.now()
  return Array.from({ length: 23 }, (_, index) => {
    const alarmTime = new Date(now - index * 23 * 60 * 1000)
    const state = states[index % states.length]
    return {
      id: `mock-latest-alarm-${index + 1}`,
      targetType: 'device',
      targetId: `mock-device-${(index % devices.length) + 1}`,
      targetName: devices[index % devices.length],
      alarmName: `${names[index % names.length]} ${index + 1}`,
      triggerDesc: t('IotAlarmOverview.mock.trigger', { count: index + 2 }),
      actualDesc: state === 'normal' ? t('IotAlarmOverview.mock.recovered') : t('IotAlarmOverview.mock.abnormal'),
      alarmTime: formatApiTime(alarmTime),
      createTime: formatApiTime(alarmTime),
      handleTime: state === 'normal' ? formatApiTime(new Date(alarmTime.getTime() + 18 * 60 * 1000)) : undefined,
      state,
      level: { value: levels[index % levels.length], text: mockLevelText(levels[index % levels.length]) },
    }
  })
}

function mockLevelText(level: number) {
  if (level === 1) return t('IotAlarmOverview.level.emergency')
  if (level === 2) return t('IotAlarmOverview.level.important')
  if (level === 3) return t('IotAlarmOverview.level.minor')
  if (level === 4) return t('IotAlarmOverview.level.normal')
  return t('IotAlarmOverview.level.warning')
}

function toTrendPoint(item: DashboardItem, time: string): AlarmTrendBucketPoint | undefined {
  const data = item.data
  if (!data) return undefined
  const rawLabel = String(data.timeString ?? data.timestamp ?? '')
  const label = time === '1d' ? rawLabel.split(' ')[0] : rawLabel
  const timeStringTimestamp = parseTrendTimeString(rawLabel)
  const rawTimestamp = Number(data.timestamp)
  return {
    label,
    value: Number(data.value ?? 0),
    timestamp: timeStringTimestamp || (rawTimestamp > 946684800000 ? rawTimestamp : 0),
  }
}

function parseTrendRows(rows: DashboardItem[], group: string, time: string): AlarmTrendBucketPoint[] {
  return rows
    .filter((item) => item.group === group)
    .map((item) => toTrendPoint(item, time))
    .filter((item): item is AlarmTrendBucketPoint => Boolean(item))
    .reverse()
}

function parseTrendTimeString(value: string): number {
  // 趋势接口的 timestamp 是序号，日历布局需根据格式化时间恢复真实时间桶。
  const match = value.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (match) {
    const now = new Date()
    const date = new Date(
      now.getFullYear(),
      Number(match[1]) - 1,
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5] ?? 0),
    )
    if (date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) date.setFullYear(date.getFullYear() - 1)
    return date.getTime()
  }
  const direct = new Date(value).getTime()
  return Number.isFinite(direct) ? direct : 0
}

function toRankRow(value: any): DeviceAlarmRankRow | undefined {
  const deviceId = String(value?.targetId ?? value?.deviceId ?? '').trim()
  if (!deviceId) return undefined
  return {
    id: deviceId,
    deviceId,
    name: String(value?.targetName ?? value?.deviceName ?? deviceId),
    count: Number(value?.count ?? 0),
  }
}
