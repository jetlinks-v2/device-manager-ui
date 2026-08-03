import { request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'

import type { DeviceGroupDeviceQueryParams, DeviceGroupQueryTerm } from './deviceGroup'
import type { RuntimeDeviceAlarmInfo, RuntimeDeviceResponse } from './deviceGroupRuntime'

type ApiResponse<T> = {
  result?: T
}

type PagerResult<T> = {
  data?: T[]
}

type AlarmAggregationResponse = {
  targetId?: string
  alarmCount?: number
}

type AlarmRecordResponse = {
  targetId?: string
  actualDesc?: string
  triggerDesc?: string
  alarmName?: string
}

export interface AlarmRecordSummary {
  alarmCount: number
}

export interface AlarmRecordNodeSummary {
  id: string
  alarmCount: number
}

type AlarmRecordSummaryResponse = Partial<AlarmRecordSummary>

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
  sorts: params.sorts ?? [{ name: 'lastAlarmTime', order: 'desc' }],
  terms: (params.terms ?? []).map(normalizeLikeTermValue),
})

const toAlarmRecordSummary = (item: AlarmRecordSummaryResponse = {}): AlarmRecordSummary => ({
  alarmCount: Number(item.alarmCount ?? 0),
})

const toAlarmRecordNodeSummary = (item: Partial<AlarmRecordNodeSummary> = {}): AlarmRecordNodeSummary => ({
  id: String(item.id || ''),
  alarmCount: Number(item.alarmCount ?? 0),
})

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return i18n.global.t('IotDeviceGroups.status.alarm')
}

const buildAlarmQueryTerms = (deviceIds: string[]) => [
  { column: 'state', termType: 'eq', value: 'warning' },
  { column: 'targetId', termType: 'in', value: deviceIds },
]

export const getDeviceAlarmSummary_api = async (
  params: DeviceGroupDeviceQueryParams = {},
): Promise<AlarmRecordSummary> => {
  const response = await request.post(
    '/alarm/record/device/_summary',
    buildQueryBody({ ...params, pageSize: 0 }),
  ) as ApiResponse<AlarmRecordSummaryResponse> | AlarmRecordSummaryResponse
  const result = unwrapResult<AlarmRecordSummaryResponse>(response) ?? {}

  return toAlarmRecordSummary(result)
}

export const batchDeviceAlarmNodeSummary_api = async (
  requests: Array<{ id: string; query: DeviceGroupDeviceQueryParams }>,
): Promise<AlarmRecordNodeSummary[]> => {
  const response = await request.post(
    '/alarm/record/device/_summary/_batch',
    requests.map((item) => ({
      id: item.id,
      query: buildQueryBody({ ...item.query, pageSize: 0 }),
    })),
  ) as ApiResponse<AlarmRecordNodeSummary[]> | AlarmRecordNodeSummary[]
  const result = unwrapResult<AlarmRecordNodeSummary[]>(response) ?? []

  return result.filter((item) => Boolean(item.id))
    .map(toAlarmRecordNodeSummary)
}

// 设备分组接口只返回设备运行态，告警信息按当前页设备 ID 从规则模块补齐。
export const queryRuntimeDeviceAlarmInfo = async (rows: RuntimeDeviceResponse[]): Promise<Record<string, RuntimeDeviceAlarmInfo>> => {
  const deviceIds = [...new Set(rows.map((item) => String(item.id || '')).filter(Boolean))]
  if (!deviceIds.length) return {}

  try {
    const [countResponse, recordResponse] = await Promise.all([
      request.post('/alarm/record/device/_aggregation', {
        columns: [{ column: 'id', alias: 'alarmCount', aggregation: 'COUNT' }],
        groupBy: [{ column: 'targetId', alias: 'targetId' }],
        filter: { terms: buildAlarmQueryTerms(deviceIds) },
      }) as Promise<ApiResponse<AlarmAggregationResponse[]> | AlarmAggregationResponse[]>,
      request.post('/alarm/record/device/_query', {
        paging: false,
        sorts: [{ name: 'lastAlarmTime', order: 'desc' }],
        terms: buildAlarmQueryTerms(deviceIds),
      }) as Promise<ApiResponse<PagerResult<AlarmRecordResponse>> | PagerResult<AlarmRecordResponse>>,
    ])
    const countRows = unwrapResult<AlarmAggregationResponse[]>(countResponse) ?? []
    const recordRows = unwrapResult<PagerResult<AlarmRecordResponse>>(recordResponse)?.data ?? []
    const alarmInfo: Record<string, RuntimeDeviceAlarmInfo> = {}

    for (const item of countRows) {
      const deviceId = String(item.targetId || '')
      if (!deviceId) continue
      alarmInfo[deviceId] = {
        alarmCount: Number(item.alarmCount ?? 0),
        alarmSummary: i18n.global.t('IotDeviceDetail.common.none'),
      }
    }

    for (const item of recordRows) {
      const deviceId = String(item.targetId || '')
      if (!deviceId) continue
      const current = alarmInfo[deviceId] ?? { alarmCount: 0, alarmSummary: i18n.global.t('IotDeviceDetail.common.none') }
      alarmInfo[deviceId] = {
        ...current,
        alarmSummary: firstText(item.actualDesc, item.triggerDesc, item.alarmName),
      }
    }

    return alarmInfo
  } catch {
    return {}
  }
}
