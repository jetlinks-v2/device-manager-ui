import { request } from '@jetlinks-web/core'
import type { DataCapabilityRequest } from '@jetlinks-web-core/data-capability'

type RequestConfig = Record<string, unknown>

export const queryDeviceGroups = (
  data: Record<string, unknown>,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.post('/device/group/_query', data, config)

export const queryDeviceGroupSummaries = (
  data: Array<Record<string, unknown>>,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.post('/device/group/device/_summary/_batch', data, config)

export const queryDeviceGroupRuntimeDevices = (
  data: Record<string, unknown>,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.post('/device/group/device/_runtime-query', data, config)
