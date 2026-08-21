import dayjs from 'dayjs'
import { request } from '@jetlinks-web/core'

import { queryRuntimeDeviceAlarmInfo } from './alarmRecord'
import type { DeviceGroupRuntimeDevice, RuntimeDeviceResponse } from './deviceGroupRuntime'
import { toRuntimeDevice } from './deviceGroupRuntime'
import { withIotDeviceListDefaultTerms } from './deviceListDefaultTerms'
import {
  buildDeviceTrendDashboardQueries,
  resolveDeviceTrendLabelFormat,
  toFiniteDeviceTrendMeasurement,
  toDeviceTrendMetrics,
  type DeviceGroupTrendMetric,
  type DeviceGroupTrendMetricKey,
  type DeviceGroupTrendPoint,
  type DeviceTrendDashboardResponse,
} from './deviceTrend'

export type { DeviceGroupRuntimeDevice } from './deviceGroupRuntime'
export type {
  DeviceGroupTrendMetric,
  DeviceGroupTrendMetricKey,
  DeviceGroupTrendPoint,
} from './deviceTrend'

export type DeviceGroupQueryTerm = {
  column?: string
  termType?: string
  value?: unknown
  type?: string
  terms?: DeviceGroupQueryTerm[]
}

export type DeviceGroupDeviceQueryParams = {
  pageIndex?: number
  pageSize?: number
  terms?: DeviceGroupQueryTerm[]
  sorts?: Array<{
    name: string
    order?: 'asc' | 'desc' | string
  }>
  withAlarmInfo?: boolean
}

export interface DeviceGroup {
  id: string
  key: string
  name: string
  description?: string
  sortIndex: number
  creatorId?: string
  createTime?: number
  deviceCount: number
}

export interface CreateDeviceGroupInput {
  code: string
  name: string
  description?: string
  sortIndex?: number
}

export interface UpdateDeviceGroupInput extends CreateDeviceGroupInput {
  id: string
}

export interface DeviceGroupSummary {
  deviceCount: number
  total: number
  watch: number
  normal: number
  online: number
  offline: number
  noData: number
  notActive?: number
  onlineRate: number
}

export interface DeviceGroupDevicePageResult {
  data: DeviceGroupRuntimeDevice[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface DeviceGroupPageResult {
  data: DeviceGroup[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface DeviceGroupNodeSummary {
  id: string
  deviceCount: number
  total?: number
  watch?: number
  normal?: number
  online?: number
  offline?: number
  noData?: number
  notActive?: number
  onlineRate?: number
}

export type DeviceGroupTrendRange = 'today' | '24h' | '7d' | '30d'

export interface DeviceGroupTrendWindow {
  start: number
  end: number
}

export type DeviceGroupTrendQuery = DeviceGroupTrendRange | DeviceGroupTrendWindow

type ApiResponse<T> = {
  result?: T
}

type PagerResult<T> = {
  data?: T[]
  total?: number
  pageIndex?: number
  pageSize?: number
}

type DeviceGroupResponse = Partial<DeviceGroup>

type DeviceGroupSummaryResponse = Partial<DeviceGroupSummary>

const unwrapResult = <T>(response: ApiResponse<T> | T | undefined | null): T => {
  if (response && typeof response === 'object' && 'result' in response) {
    return (response as ApiResponse<T>).result as T
  }
  return response as T
}

const normalizeLikeTermValue = (term: DeviceGroupQueryTerm): DeviceGroupQueryTerm => {
  if (Array.isArray(term.terms)) {
    return {
      ...term,
      terms: term.terms.map(normalizeLikeTermValue),
    }
  }

  if (['like', 'nlike'].includes(String(term.termType || '')) && typeof term.value === 'string') {
    const value = term.value.trim()
    return {
      ...term,
      value: value.includes('%') ? value : `%${value}%`,
    }
  }

  return term
}

const buildQueryBody = (params: DeviceGroupDeviceQueryParams = {}) => ({
  pageIndex: params.pageIndex ?? 0,
  pageSize: params.pageSize ?? 10,
  sorts: params.sorts ?? [{ name: 'createTime', order: 'desc' }],
  terms: (params.terms ?? []).map(normalizeLikeTermValue),
})

const buildRuntimeQueryBody = (params: DeviceGroupDeviceQueryParams = {}) => ({
  ...buildQueryBody(params),
  terms: withIotDeviceListDefaultTerms((params.terms ?? []).map(normalizeLikeTermValue)),
})

const buildGroupDeviceQueryBody = (groupId: string, params: DeviceGroupDeviceQueryParams = {}) => ({
  ...buildRuntimeQueryBody(params),
  // 设备分组为平铺业务分组，仅匹配当前分组下的设备。
  terms: [
    { column: 'id', termType: 'dev-group', value: groupId },
    ...withIotDeviceListDefaultTerms((params.terms ?? []).map(normalizeLikeTermValue)),
  ],
})

const trendRangeWindow = (range: DeviceGroupTrendQuery) => {
  const now = dayjs()
  if (typeof range === 'object') {
    return { start: dayjs(range.start), end: dayjs(range.end) }
  }

  if (range === 'today') {
    return { start: now.startOf('day'), end: now }
  }

  if (range === '24h') {
    return { start: now.subtract(23, 'hour').startOf('hour'), end: now }
  }

  if (range === '30d') {
    return { start: now.subtract(29, 'day').startOf('day'), end: now }
  }

  return { start: now.subtract(6, 'day').startOf('day'), end: now }
}

const trendRangeConfig = (range: DeviceGroupTrendQuery) => {
  const { start, end } = trendRangeWindow(range)
  const duration = Math.max(1, end.valueOf() - start.valueOf())
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  const textFormat = 'YYYY-MM-DD HH:mm:ss'

  if (duration <= hour) {
    return {
      time: '1m',
      format: 'yyyy-MM-dd HH:mm:ss',
      labelFormat: resolveDeviceTrendLabelFormat(start.valueOf(), end.valueOf(), '1m'),
      limit: Math.max(1, Math.ceil(duration / (60 * 1000))),
      from: start.format(textFormat),
      to: end.format(textFormat),
    }
  }

  if (duration <= day) {
    return {
      time: '1h',
      format: 'yyyy-MM-dd HH:mm:ss',
      labelFormat: resolveDeviceTrendLabelFormat(start.valueOf(), end.valueOf(), '1h'),
      limit: Math.max(1, Math.ceil(duration / hour)),
      from: start.format(textFormat),
      to: end.format(textFormat),
    }
  }

  return {
    time: '1d',
    format: 'yyyy-MM-dd',
    labelFormat: resolveDeviceTrendLabelFormat(start.valueOf(), end.valueOf(), '1d'),
    limit: Math.max(1, Math.ceil(duration / day)),
    from: start.format(textFormat),
    to: end.format(textFormat),
  }
}

const hasDeviceInGroup = async (groupId: string, deviceId: string): Promise<boolean> => {
  const response = await request.post(
    '/device/group/device/_runtime-query',
    buildGroupDeviceQueryBody(groupId, {
      pageIndex: 0,
      pageSize: 1,
      terms: [{ column: 'id', termType: 'eq', value: deviceId }],
    }),
  ) as ApiResponse<PagerResult<RuntimeDeviceResponse>>
  const result = unwrapResult<PagerResult<RuntimeDeviceResponse>>(response) ?? {}
  return Number(result.total ?? result.data?.length ?? 0) > 0
}

const toDeviceGroupNodeSummary = (item: Partial<DeviceGroupNodeSummary> = {}): DeviceGroupNodeSummary => ({
  id: String(item.id || ''),
  deviceCount: Number(item.deviceCount ?? 0),
  total: Number(item.total ?? item.deviceCount ?? 0),
  watch: Number(item.watch ?? 0),
  normal: Number(item.normal ?? item.deviceCount ?? 0),
  online: Number(item.online ?? 0),
  offline: Number(item.offline ?? 0),
  noData: Number(item.noData ?? 0),
  onlineRate: Number(item.onlineRate ?? 0),
})

const normalizeGroupId = (code: string) => {
  const id = code.trim().replace(/[^0-9a-zA-Z_-]/g, '-').replace(/-+/g, '-').slice(0, 32)
  if (id.length >= 4) return id
  return `${id || 'group'}_${Date.now().toString(36)}`.slice(0, 32)
}

const toDeviceGroup = (item: DeviceGroupResponse = {}): DeviceGroup => ({
  id: String(item.id || ''),
  key: String(item.key || item.id || ''),
  name: String(item.name || item.key || item.id || '--'),
  description: item.description || '',
  sortIndex: Number(item.sortIndex ?? 0),
  creatorId: item.creatorId,
  createTime: item.createTime,
  deviceCount: Number(item.deviceCount ?? 0),
})

const emptySummary = (deviceCount = 0): DeviceGroupSummary => ({
  deviceCount,
  total: deviceCount,
  watch: 0,
  normal: deviceCount,
  online: 0,
  offline: 0,
  noData: 0,
  onlineRate: 0,
})

const toDeviceGroupSummary = (item: DeviceGroupSummaryResponse = {}): DeviceGroupSummary => {
  const deviceCount = Number(item.deviceCount ?? item.total ?? 0)

  return {
    ...emptySummary(deviceCount),
    total: Number(item.total ?? deviceCount),
    watch: Number(item.watch ?? 0),
    normal: Number(item.normal ?? 0),
    online: Number(item.online ?? 0),
    offline: Number(item.offline ?? 0),
    noData: Number(item.noData ?? 0),
    ...(item.notActive === undefined ? {} : { notActive: Number(item.notActive) }),
    onlineRate: Number(item.onlineRate ?? 0),
  }
}

export const queryDeviceGroupDetailList_api = async (): Promise<DeviceGroup[]> => {
  const response = await request.post('/device/group/_query/_detail', {
    paging: false,
    sorts: [{ name: 'sortIndex', order: 'asc' }],
  }) as ApiResponse<PagerResult<DeviceGroupResponse>>
  const result = unwrapResult<PagerResult<DeviceGroupResponse>>(response) ?? {}

  return (result.data ?? [])
    .map(toDeviceGroup)
    .filter((item) => Boolean(item.id))
}

export const queryDeviceBoundGroup_api = async (deviceId: string): Promise<DeviceGroup | null> => {
  if (!deviceId) return null
  const groups = await queryDeviceGroupDetailList_api()
  for (const group of groups) {
    try {
      if (await hasDeviceInGroup(group.id, deviceId)) return group
    } catch {
      // 分组补查失败不阻断设备详情基础信息展示。
    }
  }
  return null
}

export const queryDeviceBoundGroups_api = async (deviceIds: string[]): Promise<Record<string, DeviceGroup[]>> => {
  const ids = [...new Set(deviceIds.filter(Boolean))]
  if (!ids.length) return {}

  const groups = await queryDeviceGroupDetailList_api()
  const groupByDeviceId: Record<string, DeviceGroup[]> = {}

  await Promise.all(groups.map(async (group) => {
    try {
      const response = await request.post(
        '/device/group/device/_runtime-query',
        buildGroupDeviceQueryBody(group.id, {
          pageIndex: 0,
          pageSize: ids.length,
          terms: [{ column: 'id', termType: 'in', value: ids }],
        }),
      ) as ApiResponse<PagerResult<RuntimeDeviceResponse>>
      const result = unwrapResult<PagerResult<RuntimeDeviceResponse>>(response) ?? {}
      for (const row of result.data ?? []) {
        const deviceId = String(row.id || '')
        if (!deviceId) continue
        const current = groupByDeviceId[deviceId] ?? []
        if (!current.some((item) => item.id === group.id)) {
          groupByDeviceId[deviceId] = [...current, group]
        }
      }
    } catch {
      // 分组绑定补查失败不阻断设备列表基础信息展示。
    }
  }))

  return groupByDeviceId
}

export const queryDeviceGroupPage_api = async (
  params: DeviceGroupDeviceQueryParams = {},
): Promise<DeviceGroupPageResult> => {
  const response = await request.post(
    '/device/group/_query/_detail',
    buildQueryBody(params),
  ) as ApiResponse<PagerResult<DeviceGroupResponse>>
  const result = unwrapResult<PagerResult<DeviceGroupResponse>>(response) ?? {}

  return {
    data: (result.data ?? []).map(toDeviceGroup).filter((item) => Boolean(item.id)),
    total: Number(result.total ?? 0),
    pageIndex: Number(result.pageIndex ?? params.pageIndex ?? 0),
    pageSize: Number(result.pageSize ?? params.pageSize ?? 10),
  }
}

export const createDeviceGroup_api = async (input: CreateDeviceGroupInput): Promise<DeviceGroup> => {
  const id = normalizeGroupId(input.code)
  const response = await request.post('/device/group', {
    id,
    key: input.code,
    name: input.name,
    description: input.description,
    sortIndex: input.sortIndex ?? 0,
  }) as ApiResponse<DeviceGroupResponse>
  const result = unwrapResult<DeviceGroupResponse>(response) ?? { id, key: input.code, ...input }

  return toDeviceGroup(result)
}

export const updateDeviceGroup_api = async (input: UpdateDeviceGroupInput): Promise<DeviceGroup> => {
  const response = await request.put(`/device/group/${input.id}`, {
    id: input.id,
    key: input.code,
    name: input.name,
    description: input.description,
    sortIndex: input.sortIndex ?? 0,
  }) as ApiResponse<DeviceGroupResponse>
  const result = unwrapResult<DeviceGroupResponse>(response) ?? { key: input.code, ...input }

  return toDeviceGroup(result)
}

export const deleteDeviceGroup_api = (groupId: string): Promise<void> =>
  request.remove(`/device/group/${groupId}`)

export const bindDeviceGroupDevices_api = (groupId: string, deviceIds: string[]): Promise<void> =>
  request.post(`/device/group/${groupId}/_bind`, deviceIds)

export const unbindDeviceGroupDevices_api = (groupId: string, deviceIds: string[]): Promise<void> =>
  request.post(`/device/group/${groupId}/_unbind`, deviceIds)

export const getDeviceGroupSummary_api = async (groupId: string): Promise<DeviceGroupSummary> => {
  const response = await request.post(
    '/device/group/device/_summary',
    buildGroupDeviceQueryBody(groupId, { pageSize: 0 }),
  ) as ApiResponse<DeviceGroupSummaryResponse>
  const result = unwrapResult<DeviceGroupSummaryResponse>(response) ?? {}

  return toDeviceGroupSummary(result)
}

export const getDeviceSummary_api = async (params: DeviceGroupDeviceQueryParams = {}): Promise<DeviceGroupSummary> => {
  const response = await request.post(
    '/device/group/device/_summary',
    buildRuntimeQueryBody({ ...params, pageSize: 0 }),
  ) as ApiResponse<DeviceGroupSummaryResponse>
  const result = unwrapResult<DeviceGroupSummaryResponse>(response) ?? {}

  return toDeviceGroupSummary(result)
}

export const batchDeviceNodeSummary_api = async (
  requests: Array<{ id: string; query: DeviceGroupDeviceQueryParams }>,
): Promise<DeviceGroupNodeSummary[]> => {
  const response = await request.post(
    '/device/group/device/_summary/_batch',
    requests.map((item) => ({
      id: item.id,
      query: buildRuntimeQueryBody({ ...item.query, pageSize: 0 }),
    })),
  ) as ApiResponse<DeviceGroupNodeSummary[]> | DeviceGroupNodeSummary[]
  const result = unwrapResult<DeviceGroupNodeSummary[]>(response) ?? []

  return result.filter((item) => Boolean(item.id))
    .map(toDeviceGroupNodeSummary)
}

export const queryRuntimeDevices_api = async (
  params: DeviceGroupDeviceQueryParams = {},
): Promise<DeviceGroupDevicePageResult> => {
  const response = await request.post(
    '/device/group/device/_runtime-query',
    buildRuntimeQueryBody(params),
  ) as ApiResponse<PagerResult<RuntimeDeviceResponse>>
  const result = unwrapResult<PagerResult<RuntimeDeviceResponse>>(response) ?? {}
  const rows = result.data ?? []
  const alarmInfo = params.withAlarmInfo === false ? {} : await queryRuntimeDeviceAlarmInfo(rows)

  return {
    data: rows.map((item) => toRuntimeDevice(item, alarmInfo[String(item.id || '')])),
    total: Number(result.total ?? 0),
    pageIndex: Number(result.pageIndex ?? params.pageIndex ?? 0),
    pageSize: Number(result.pageSize ?? params.pageSize ?? 10),
  }
}

export const queryDeviceGroupRuntimeDevices_api = async (
  groupId: string,
  params: DeviceGroupDeviceQueryParams = {},
): Promise<DeviceGroupDevicePageResult> => {
  const response = await request.post(
    '/device/group/device/_runtime-query',
    buildGroupDeviceQueryBody(groupId, params),
  ) as ApiResponse<PagerResult<RuntimeDeviceResponse>>
  const result = unwrapResult<PagerResult<RuntimeDeviceResponse>>(response) ?? {}
  const rows = result.data ?? []
  const alarmInfo = params.withAlarmInfo === false ? {} : await queryRuntimeDeviceAlarmInfo(rows)

  return {
    data: rows.map((item) => toRuntimeDevice(item, alarmInfo[String(item.id || '')])),
    total: Number(result.total ?? 0),
    pageIndex: Number(result.pageIndex ?? params.pageIndex ?? 0),
    pageSize: Number(result.pageSize ?? params.pageSize ?? 10),
  }
}

const queryDeviceTrend_api = async (
  scope: { groupId?: string; spaceId?: string | string[] },
  range: DeviceGroupTrendQuery = '7d',
  metrics: readonly DeviceGroupTrendMetricKey[] = ['onlineRate', 'uplink'],
): Promise<DeviceGroupTrendMetric[]> => {
  const config = trendRangeConfig(range)
  const queries = buildDeviceTrendDashboardQueries(scope, {
    time: config.time,
    format: config.format,
    limit: config.limit,
    from: config.from,
    to: config.to,
  }, metrics)
  const response = await request.post('/dashboard/_multi', queries) as ApiResponse<DeviceTrendDashboardResponse[]> | DeviceTrendDashboardResponse[]
  const result = unwrapResult<DeviceTrendDashboardResponse[]>(response) ?? []

  return toDeviceTrendMetrics(result, metrics, config.labelFormat)
}

export const queryDeviceGroupTrend_api = async (
  groupId: string,
  range: DeviceGroupTrendQuery = '7d',
): Promise<DeviceGroupTrendMetric[]> => {
  return queryDeviceTrend_api({ groupId }, range)
}

export const queryAllDeviceTrend_api = async (
  range: DeviceGroupTrendQuery = '7d',
): Promise<DeviceGroupTrendMetric[]> => {
  return queryDeviceTrend_api({}, range)
}

/** Queries one device dashboard metric so focused tools do not fetch unrelated trend data. */
export const queryAllDeviceMetricTrend_api = async (
  metric: DeviceGroupTrendMetricKey,
  range: DeviceGroupTrendQuery = '7d',
): Promise<DeviceGroupTrendMetric> => {
  const [result] = await queryDeviceTrend_api({}, range, [metric])
  return result
}

export const querySpaceGroupTrend_api = async (
  spaceId: string | string[],
  range: DeviceGroupTrendQuery = '7d',
): Promise<DeviceGroupTrendMetric[]> => {
  return queryDeviceTrend_api({ spaceId }, range)
}

export const queryDeviceGroupYesterdayOnlineRate_api = async (
  groupId: string,
): Promise<number | null> => {
  return queryYesterdayOnlineRate({ groupId })
}

export const querySpaceGroupYesterdayOnlineRate_api = async (
  spaceId: string | string[],
): Promise<number | null> => {
  return queryYesterdayOnlineRate({ spaceId })
}

const queryYesterdayOnlineRate = async (
  scope: { groupId?: string; spaceId?: string | string[] },
): Promise<number | null> => {
  const yesterday = dayjs().subtract(1, 'day')
  const textFormat = 'YYYY-MM-DD HH:mm:ss'
  const params = {
    ...scope,
    time: '1d',
    format: 'yyyy-MM-dd',
    limit: 1,
    from: yesterday.startOf('day').format(textFormat),
    to: yesterday.endOf('day').format(textFormat),
  }
  const response = await request.post('/dashboard/_multi', [
    {
      dashboard: 'device',
      object: 'status',
      measurement: 'record',
      dimension: 'onlineRate',
      group: 'device-group-online-rate',
      params,
    },
  ]) as ApiResponse<DeviceTrendDashboardResponse[]> | DeviceTrendDashboardResponse[]
  const result = unwrapResult<DeviceTrendDashboardResponse[]>(response) ?? []
  const value = result.find((item) => item.group === 'device-group-online-rate')?.data?.value
  return toFiniteDeviceTrendMeasurement(value) ?? null
}
