export interface AreaItem {
  id: string
  code: string
  name: string
  photoUrl?: string
  workstationIds: string[]
  remark?: string
  updatedAt?: string
}

export interface WorkstationItem {
  id: string
  code: string
  name: string
  photoUrl?: string
  areaId: string
  deviceIds: string[]
  remark?: string
}

export interface DeviceItem {
  id: string
  code: string
  name: string
  productId: string
  metadata?: string
}

export interface LockItem {
  id: string
  workstationId: string
  deviceId: string
  reason: string
  createdAt: string
}

export interface WorkstationOccupancyItem {
  id: string
  workstationId: string
  occupiedDeviceIds: string[]
  lockIds: string[]
  reasonList: string[]
  reason: string
  occupiedDeviceCount: number
  deviceSummary: string
  createdAt: string
}

export interface ControlLogItem {
  id: string
  workstationId: string
  deviceId: string
  modelType: 'property' | 'function'
  modelId: string
  status: 'success' | 'error'
  message: string
  lockType: 'existing' | 'none'
  createdAt: string
}

export interface ThingModelItem {
  id: string
  name: string
  inputs?: any[]
  valueType?: any
}

export interface ControlParamField {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum'
  min?: number
  max?: number
  options?: { label: string; value: any }[]
  defaultValue?: any
}

export type ResourceTabKey = 'area' | 'workstation' | 'occupancy' | 'control' | 'controlLog'

export interface ActionItem {
  key: string
  text: string
  icon: string
  onClick: () => void
  disabled?: boolean
  tooltip?: { title: string }
  popConfirm?: { title: string; onConfirm: () => void }
}
