export interface DeviceStateBatchQuery {
  deviceIds: string[]
}

export interface DeviceStateRow {
  deviceId: string
  state: string | null
  stateText: string | null
}

export interface DeviceDetailQuery {
  deviceId: string
}

export interface DeviceDetailData {
  deviceId: string
  deviceName: string | null
  state: string | null
  stateText: string | null
  productName: string | null
  deviceType: string | null
  organizationName: string | null
  accessMode: string | null
  address: string | null
  description: string | null
  lastActiveTime: number | null
}
