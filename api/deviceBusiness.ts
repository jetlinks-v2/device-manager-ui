import dayjs from 'dayjs'
import { request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'

import type {
  IotDevice,
  IotDeviceConnectionStatus,
  IotDeviceRisk,
  IotDeviceStatus,
} from '@device-manager-ui/types'
import { withIotDeviceListDefaultTerms } from './deviceListDefaultTerms'

export type BusinessDeviceQueryTerm = {
  column?: string
  termType?: string
  value?: unknown
  type?: string
  terms?: BusinessDeviceQueryTerm[]
}

export type BusinessDeviceQueryParams = {
  pageIndex?: number
  pageSize?: number
  terms?: BusinessDeviceQueryTerm[]
  sorts?: Array<{
    name: string
    order?: 'asc' | 'desc' | string
  }>
}

export interface DeviceBusinessType {
  id: string
  code: string
  name: string
  description?: string
  sortIndex: number
  creatorId?: string
  createTime?: number
  modifierId?: string | null
  modifyTime?: number
}

export interface DeviceBusinessTypeDetail extends DeviceBusinessType {
  deviceCount: number
}

export interface CreateDeviceBusinessTypeInput {
  code: string
  name: string
  description?: string
  sortIndex?: number
}

export interface DeviceBusinessTypeSummary {
  deviceCount: number
  total: number
  urgent: number
  watch: number
  normal: number
  online: number
  offline: number
  noData: number
  alarm: number
  onlineRate: number
  averageHealth: number | null
}

export interface DeviceBusinessRuntimeDevice extends IotDevice {
  productId?: string
  runtimeState: string
  connectTime?: number | null
  lastReportTime?: number | null
  alarmCount: number
  alarmSummary: string
}

export interface DeviceBusinessDevicePageResult {
  data: DeviceBusinessRuntimeDevice[]
  total: number
  pageIndex: number
  pageSize: number
}

type ApiResponse<T> = {
  success?: boolean
  status?: number
  result?: T
  message?: string
}

type PagerResult<T> = {
  data?: T[]
  total?: number
  pageIndex?: number
  pageSize?: number
}

type DeviceBusinessTypeResponse = Partial<DeviceBusinessType>

type DeviceBusinessTypeDetailResponse = DeviceBusinessTypeResponse & {
  deviceCount?: number
}

type DeviceBusinessTypeSummaryResponse = Partial<DeviceBusinessTypeSummary>

type RuntimeDeviceResponse = {
  id?: string
  identifier?: string
  name?: string
  productId?: string
  productName?: string
  state?: string
  connectTime?: number | null
  lastReportTime?: number | null
  alarmCount?: number
  alarmSummary?: string
}

const unwrapResult = <T>(response: ApiResponse<T> | T): T => {
  if (response && typeof response === 'object' && 'result' in response) {
    return (response as ApiResponse<T>).result as T
  }

  return response as T
}

const normalizeLikeTermValue = (term: BusinessDeviceQueryTerm): BusinessDeviceQueryTerm => {
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

const buildRuntimeQueryBody = (params: BusinessDeviceQueryParams = {}) => ({
  pageIndex: params.pageIndex ?? 0,
  pageSize: params.pageSize ?? 10,
  sorts: params.sorts ?? [{ name: 'createTime', order: 'desc' }],
  terms: withIotDeviceListDefaultTerms((params.terms ?? []).map(normalizeLikeTermValue)),
})

const formatTime = (value: unknown) => {
  const timestamp = Number(value || 0)
  if (!timestamp) return i18n.global.t('IotDeviceDetail.detail.noReport')
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

const toBusinessType = (item: DeviceBusinessTypeResponse = {}): DeviceBusinessType => ({
  id: String(item.id || ''),
  code: String(item.code || ''),
  name: String(item.name || item.code || '--'),
  description: item.description || '',
  sortIndex: Number(item.sortIndex ?? 0),
  creatorId: item.creatorId,
  createTime: item.createTime,
  modifierId: item.modifierId,
  modifyTime: item.modifyTime,
})

const toBusinessTypeDetail = (item: DeviceBusinessTypeDetailResponse = {}): DeviceBusinessTypeDetail => ({
  ...toBusinessType(item),
  deviceCount: Number(item.deviceCount ?? 0),
})

const emptyBusinessSummary = (deviceCount = 0): DeviceBusinessTypeSummary => ({
  deviceCount,
  total: deviceCount,
  urgent: 0,
  watch: 0,
  normal: deviceCount,
  online: 0,
  offline: 0,
  noData: 0,
  alarm: 0,
  onlineRate: 0,
  averageHealth: null,
})

const toBusinessTypeSummary = (item: DeviceBusinessTypeSummaryResponse = {}): DeviceBusinessTypeSummary => {
  const deviceCount = Number(item.deviceCount ?? item.total ?? 0)

  return {
    ...emptyBusinessSummary(deviceCount),
    total: Number(item.total ?? deviceCount),
    urgent: Number(item.urgent ?? 0),
    watch: Number(item.watch ?? 0),
    normal: Number(item.normal ?? 0),
    online: Number(item.online ?? 0),
    offline: Number(item.offline ?? 0),
    noData: Number(item.noData ?? 0),
    alarm: Number(item.alarm ?? 0),
    onlineRate: Number(item.onlineRate ?? 0),
    averageHealth: typeof item.averageHealth === 'number' ? item.averageHealth : null,
  }
}

const toRuntimeStatus = (state?: string, alarmCount = 0): {
  connectionStatus: IotDeviceConnectionStatus
  status: IotDeviceStatus
  risk: IotDeviceRisk
} => {
  const normalized = String(state || '').toLowerCase()
  const connectionStatus: IotDeviceConnectionStatus = normalized === 'online'
    ? 'online'
    : normalized === 'offline'
      ? 'offline'
      : 'disabled'

  if (alarmCount > 0) {
    return {
      connectionStatus,
      status: 'alarm',
      risk: 'urgent',
    }
  }

  return {
    connectionStatus,
    status: connectionStatus,
    risk: connectionStatus === 'online' ? 'normal' : 'watch',
  }
}

const toRuntimeDevice = (item: RuntimeDeviceResponse = {}): DeviceBusinessRuntimeDevice => {
  const alarmCount = Number(item.alarmCount ?? 0)
  const status = toRuntimeStatus(item.state, alarmCount)
  const alarmSummary = item.alarmSummary || i18n.global.t('IotDeviceDetail.common.none')

  return {
    id: String(item.id || ''),
    projectId: '',
    name: item.name || item.id || '--',
    productName: item.productName || '--',
    productId: item.productId,
    productKey: item.productId,
    deviceType: item.productName || '--',
    area: '--',
    location: '--',
    owner: '--',
    connectionStatus: status.connectionStatus,
    businessStatuses: alarmCount > 0 ? ['alarm'] : [],
    status: status.status,
    risk: status.risk,
    lastSeen: formatTime(item.lastReportTime),
    accessMode: '--',
    identifier: item.identifier || item.id || '--',
    summary: '',
    aiSummary: {
      conclusion: '',
      reasons: [],
      actions: [],
      evidence: [],
    },
    telemetry: [],
    alarms: alarmCount > 0
      ? [{
          id: `${item.id || 'device'}-runtime-alarm`,
          source: 'iot-event',
          subType: 'alarm',
          occurredAt: new Date().toISOString(),
          status: 'new',
          severity: 'urgent',
          subjectKind: 'device',
          subjectRef: String(item.id || ''),
          subjectName: item.name || item.id || '',
          title: alarmSummary,
          desc: alarmSummary,
          payload: {
            kind: 'alarm',
            level: '紧急',
            summary: alarmSummary,
          },
        }]
      : [],
    logs: [],
    rules: [],
    relations: [],
    tags: [],
    currentFaultCodes: [],
    runtimeState: item.state || '',
    connectTime: item.connectTime ?? null,
    lastReportTime: item.lastReportTime ?? null,
    alarmCount,
    alarmSummary,
  }
}

export const queryDeviceBusinessTypeDetailList_api = async (): Promise<DeviceBusinessTypeDetail[]> => {
  const response = await request.get('/device-business/type/detail/_list') as ApiResponse<DeviceBusinessTypeDetailResponse[]>
  const list = unwrapResult<DeviceBusinessTypeDetailResponse[]>(response) ?? []

  return list
    .map(toBusinessTypeDetail)
    .filter((item) => Boolean(item.id))
}

export const createDeviceBusinessType_api = async (input: CreateDeviceBusinessTypeInput): Promise<DeviceBusinessType> => {
  const response = await request.post('/device-business/type', {
    code: input.code,
    name: input.name,
    description: input.description,
    sortIndex: input.sortIndex ?? 0,
  }) as ApiResponse<DeviceBusinessTypeResponse>
  const result = unwrapResult<DeviceBusinessTypeResponse>(response) ?? {}

  return toBusinessType(result)
}

export const getDeviceBusinessTypeSummary_api = async (typeId: string): Promise<DeviceBusinessTypeSummary> => {
  const response = await request.get(`/device-business/type/${typeId}/_summary`) as ApiResponse<DeviceBusinessTypeSummaryResponse>
  const result = unwrapResult<DeviceBusinessTypeSummaryResponse>(response) ?? {}

  return toBusinessTypeSummary(result)
}

export const queryDeviceBusinessTypeRuntimeDevices_api = async (
  typeId: string,
  params: BusinessDeviceQueryParams = {},
): Promise<DeviceBusinessDevicePageResult> => {
  const response = await request.post(
    `/device-business/type/${typeId}/device/_runtime-query`,
    buildRuntimeQueryBody(params),
  ) as ApiResponse<PagerResult<RuntimeDeviceResponse>>
  const result = unwrapResult<PagerResult<RuntimeDeviceResponse>>(response) ?? {}

  return {
    data: (result.data ?? []).map(toRuntimeDevice),
    total: Number(result.total ?? 0),
    pageIndex: Number(result.pageIndex ?? params.pageIndex ?? 0),
    pageSize: Number(result.pageSize ?? params.pageSize ?? 10),
  }
}
