import dayjs from 'dayjs'
import i18n from '@jetlinks-web-core/locales'

import type {
  IotDevice,
  IotDeviceConnectionStatus,
  IotDeviceRisk,
  IotDeviceStatus,
} from '@device-manager-ui/types'

export type RuntimeDeviceResponse = {
  id?: string
  identifier?: string
  name?: string
  productId?: string
  productName?: string
  state?: string | { value?: string; text?: string }
  connectTime?: number | null
  lastReportTime?: number | null
}

export type RuntimeDeviceAlarmInfo = {
  alarmCount: number
  alarmSummary: string
}

export interface DeviceGroupRuntimeDevice extends IotDevice {
  productId?: string
  runtimeState: string
  connectTime?: number | null
  lastReportTime?: number | null
  alarmCount: number
  alarmSummary: string
}

const formatTime = (value: unknown) => {
  const timestamp = Number(value || 0)
  if (!timestamp) return i18n.global.t('IotDeviceDetail.detail.noReport')
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

const readStateValue = (state: RuntimeDeviceResponse['state']) => {
  if (typeof state === 'string') return state
  return String(state?.value || '')
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
    risk: 'normal',
  }
}

export const toRuntimeDevice = (
  item: RuntimeDeviceResponse = {},
  alarmInfo: RuntimeDeviceAlarmInfo = { alarmCount: 0, alarmSummary: i18n.global.t('IotDeviceDetail.common.none') },
): DeviceGroupRuntimeDevice => {
  const alarmCount = Number(alarmInfo.alarmCount ?? 0)
  const state = readStateValue(item.state)
  const status = toRuntimeStatus(state, alarmCount)
  const alarmSummary = alarmInfo.alarmSummary || i18n.global.t('IotDeviceDetail.common.none')

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
    runtimeState: state,
    connectTime: item.connectTime ?? null,
    lastReportTime: item.lastReportTime ?? null,
    alarmCount,
    alarmSummary,
  }
}
