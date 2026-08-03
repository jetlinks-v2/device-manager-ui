import type {
  IotDevice,
  IotDeviceBusinessStatus,
  IotDeviceConnectionStatus,
  IotDeviceFilters,
  IotRiskKind,
} from '../types'

const BUSINESS_STATUS_ORDER: IotDeviceBusinessStatus[] = ['no-data', 'alarm', 'maintenance']

export function getIotDeviceConnectionStatus(device: IotDevice): IotDeviceConnectionStatus {
  if (device.connectionStatus) return device.connectionStatus
  if (device.status === 'offline') return 'offline'
  if (device.status === 'disabled') return 'disabled'
  return 'online'
}

export function isIotDeviceInMaintenance(device: IotDevice) {
  return device.businessStatuses?.includes('maintenance') || (getIotDeviceConnectionStatus(device) === 'offline' && device.risk === 'urgent')
}

export function getIotDeviceBusinessStatuses(device: IotDevice): IotDeviceBusinessStatus[] {
  const statuses = new Set<IotDeviceBusinessStatus>(device.businessStatuses ?? [])
  if (device.status === 'no-data') statuses.add('no-data')
  if (device.status === 'alarm') statuses.add('alarm')
  if (isIotDeviceInMaintenance(device)) statuses.add('maintenance')
  return BUSINESS_STATUS_ORDER.filter((status) => statuses.has(status))
}

export function hasIotDeviceBusinessStatus(device: IotDevice, status: IotDeviceBusinessStatus) {
  return getIotDeviceBusinessStatuses(device).includes(status)
}

export function getIotDeviceRiskKinds(device: IotDevice): IotRiskKind[] {
  const out: IotRiskKind[] = []
  if (device.currentFaultCodes?.length) out.push('fault-code')
  if (getIotDeviceConnectionStatus(device) === 'offline' || hasIotDeviceBusinessStatus(device, 'no-data')) out.push('offline-frequent')
  if (device.telemetry.some((point) => point.status === 'warning' || point.status === 'critical')) out.push('data-deviation')
  return out
}

export function matchesIotDeviceFilters(device: IotDevice, filters: Pick<IotDeviceFilters, 'connectionStatus' | 'businessStatus' | 'status' | 'anomalyKind'>) {
  if (filters.connectionStatus && filters.connectionStatus !== 'all' && getIotDeviceConnectionStatus(device) !== filters.connectionStatus) {
    return false
  }

  if (filters.businessStatus && filters.businessStatus !== 'all' && !hasIotDeviceBusinessStatus(device, filters.businessStatus)) {
    return false
  }

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'online' || filters.status === 'offline' || filters.status === 'disabled') {
      if (getIotDeviceConnectionStatus(device) !== filters.status) return false
    } else if (!hasIotDeviceBusinessStatus(device, filters.status)) {
      return false
    }
  }

  if (!filters.anomalyKind || filters.anomalyKind === 'all') return true

  return getIotDeviceRiskKinds(device).includes(filters.anomalyKind)
}
