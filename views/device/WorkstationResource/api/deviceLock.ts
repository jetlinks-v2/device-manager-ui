import { request } from '@jetlinks-web/core'

// 占用聚合（工位维度）
export const queryLockByWorkstation = (data?: Record<string, any>) =>
  request.post('/resource/device-lock/occupancy/_query', data)

// 占用明细（设备维度，带设备名）
export const queryLock = (data?: Record<string, any>) =>
  request.post('/resource/device-lock/detail/_query', data)

export const applyLock = (data: Record<string, any>) =>
  request.post('/resource/device-lock/_apply', data)

export const releaseLockById = (lockId: string) =>
  request.remove(`/resource/device-lock/${lockId}`)

export const batchReleaseLock = (data: Record<string, any>) =>
  request.post('/resource/device-lock/_batch-release', data)

export const releaseLockByWorkstation = (workstationId: string) =>
  request.remove(`/resource/device-lock/_release-by-workstation/${workstationId}`)

export const getLockByDevice = (deviceId: string) =>
  request.get(`/resource/device-lock/_by-device/${deviceId}`)
