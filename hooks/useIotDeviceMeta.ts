import type {
  IotDeviceBusinessStatus,
  IotDeviceConnectionStatus,
  IotDeviceRisk,
  IotDeviceStatus,
  IotTelemetryStatus,
} from '../types'
import i18n from '@jetlinks-web-core/locales'

const t = (key: string) => i18n.global.t(key)

export const IOT_DEVICE_CONNECTION_STATUS_META: Record<IotDeviceConnectionStatus, {
  label: string
  tone: 'ok' | 'warn' | 'err' | 'info' | 'muted'
}> = {
  online: { get label() { return t('IotDeviceMeta.connection.online') }, tone: 'ok' },
  offline: { get label() { return t('IotDeviceMeta.connection.offline') }, tone: 'err' },
  disabled: { get label() { return t('IotDeviceMeta.connection.disabled') }, tone: 'muted' },
}

export const IOT_DEVICE_BUSINESS_STATUS_META: Record<IotDeviceBusinessStatus, {
  label: string
  tone: 'ok' | 'warn' | 'err' | 'info' | 'muted'
}> = {
  'no-data': { get label() { return t('IotDeviceMeta.business.noData') }, tone: 'warn' },
  alarm: { get label() { return t('IotDeviceMeta.business.alarm') }, tone: 'err' },
  maintenance: { get label() { return t('IotDeviceMeta.business.maintenance') }, tone: 'info' },
}

export const IOT_DEVICE_STATUS_META: Record<IotDeviceStatus, {
  label: string
  tone: 'ok' | 'warn' | 'err' | 'info' | 'muted'
}> = {
  ...IOT_DEVICE_CONNECTION_STATUS_META,
  'no-data': IOT_DEVICE_BUSINESS_STATUS_META['no-data'],
  alarm: IOT_DEVICE_BUSINESS_STATUS_META.alarm,
}

export const IOT_DEVICE_RISK_META: Record<IotDeviceRisk, {
  label: string
  tone: 'ok' | 'warn' | 'err'
}> = {
  normal: { get label() { return t('IotDeviceMeta.risk.normal') }, tone: 'ok' },
  watch: { get label() { return t('IotDeviceMeta.risk.watch') }, tone: 'warn' },
  urgent: { get label() { return t('IotDeviceMeta.risk.urgent') }, tone: 'err' },
}

export const IOT_TELEMETRY_STATUS_META: Record<IotTelemetryStatus, {
  label: string
  tone: 'ok' | 'warn' | 'err' | 'muted'
}> = {
  normal: { get label() { return t('IotDeviceMeta.telemetry.normal') }, tone: 'ok' },
  warning: { get label() { return t('IotDeviceMeta.telemetry.warning') }, tone: 'warn' },
  critical: { get label() { return t('IotDeviceMeta.telemetry.critical') }, tone: 'err' },
  stale: { get label() { return t('IotDeviceMeta.telemetry.stale') }, tone: 'muted' },
}

export function useIotDeviceMeta() {
  function connectionStatusMeta(status: IotDeviceConnectionStatus) {
    return IOT_DEVICE_CONNECTION_STATUS_META[status]
  }

  function businessStatusMeta(status: IotDeviceBusinessStatus) {
    return IOT_DEVICE_BUSINESS_STATUS_META[status]
  }

  function statusMeta(status: IotDeviceStatus) {
    return IOT_DEVICE_STATUS_META[status]
  }

  function riskMeta(risk: IotDeviceRisk) {
    return IOT_DEVICE_RISK_META[risk]
  }

  function telemetryMeta(status: IotTelemetryStatus) {
    return IOT_TELEMETRY_STATUS_META[status]
  }

  return {
    connectionStatusMeta,
    businessStatusMeta,
    statusMeta,
    riskMeta,
    telemetryMeta,
    statusOptions: Object.entries(IOT_DEVICE_CONNECTION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
    businessStatusOptions: Object.entries(IOT_DEVICE_BUSINESS_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
    riskOptions: Object.entries(IOT_DEVICE_RISK_META).map(([value, meta]) => ({ value, label: meta.label })),
  }
}
