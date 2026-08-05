import { request } from '@jetlinks-web/core'

type RequestConfig = Record<string, unknown>

export const queryDeviceGroups = (
  data: Record<string, unknown>,
  config?: RequestConfig,
) => request.post('/device/group/_query', data, config)

export const queryDeviceGroupSummaries = (
  data: Array<Record<string, unknown>>,
  config?: RequestConfig,
) => request.post('/device/group/device/_summary/_batch', data, config)

export const queryDeviceGroupRuntimeDevices = (
  data: Record<string, unknown>,
  config?: RequestConfig,
) => request.post('/device/group/device/_runtime-query', data, config)
