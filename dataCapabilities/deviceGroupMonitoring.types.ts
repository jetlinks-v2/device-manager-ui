export type DeviceGroupMetric = number | null

export type DeviceGroupRuntimeState = 'online' | 'offline' | 'notActive'

export interface DeviceGroupListQuery {
  limit: number
}

export interface DeviceGroupRow {
  groupId: string
  groupName: string
}

export interface DeviceGroupSummaryBatchQuery {
  groupIds: string[]
}

export interface DeviceGroupSummaryRow {
  groupId: string
  total: DeviceGroupMetric
  online: DeviceGroupMetric
  offline: DeviceGroupMetric
  notActive: DeviceGroupMetric
  onlineRate: DeviceGroupMetric
}

export interface DeviceGroupDevicesQuery {
  groupId: string
  pageIndex: number
  pageSize: number
}

export interface DeviceGroupDeviceRow {
  deviceId: string
  identifier: string | null
  deviceName: string | null
  productName: string | null
  state: DeviceGroupRuntimeState | null
  lastReportTime: number | null
}

export interface DeviceGroupDevicePageData {
  data: DeviceGroupDeviceRow[]
  total: number
  pageIndex: number
  pageSize: number
}
