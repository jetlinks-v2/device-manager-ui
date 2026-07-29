export type DeviceMonitoringState = 'online' | 'offline' | 'notActive'

export interface DeviceSummaryData {
  total: number
  online: number
  offline: number
  notActive: number
  other: number
  onlineRate: number
  healthyOnline: number | null
  abnormalOnline: number | null
  sampleTime: number
}

export interface DeviceLocationQuery {
  pageIndex: number
  pageSize: number
  state?: DeviceMonitoringState
}

export interface DeviceLocationRow {
  deviceId: string | null
  deviceName: string | null
  longitude: number
  latitude: number
  state: string | null
  stateText: string | null
  productId: string | null
  productName: string | null
  lastOnlineTime: number | null
}

export interface DeviceLocationPageData {
  data: DeviceLocationRow[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface DeviceOnlineHistoryQuery {
  startTime?: number
  endTime?: number
}

export interface DeviceOnlineHistoryRow {
  timestamp: number
  onlineCount: number
  deviceTotal: number | null
  onlineRate: number | null
}
