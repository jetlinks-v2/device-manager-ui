export type DeviceMonitoringState = 'online' | 'offline' | 'notActive'

export type DeviceMonitoringScope = 'iot'

export interface DeviceSummaryQuery {
  scope?: DeviceMonitoringScope
  deviceIds?: string[]
}

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
  scope?: DeviceMonitoringScope
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

export interface DeviceRuntimeTrendQuery {
  startTime?: number
  endTime?: number
  scope?: DeviceMonitoringScope
}

export interface DeviceRuntimeTrendRow {
  timestamp: number
  onlineRate: number | null
  messageCount: number
}

export interface DeviceCategoryDistributionQuery {
  limit: number
}

export interface DeviceCategoryDistributionRow {
  categoryId: string
  categoryName: string
  count: number
  rate: number
}
