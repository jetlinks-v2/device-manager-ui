import { request } from '@jetlinks-web/core'
import type { DataCapabilityRequest } from '@jetlinks-web-core/data-capability'

type RequestConfig = Record<string, unknown>

export const countDeviceInstances = (
  data: Record<string, unknown>,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.post('/device-instance/_count', data, config)

export const queryDeviceInstanceStates = (
  data: Record<string, unknown>,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.post('/device-instance/_query/no-paging?paging=false', data, config)

export const queryDeviceInstanceDetail = (
  deviceId: string,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.get(
  `/device-instance/${encodeURIComponent(deviceId)}/detail`,
  {},
  config,
)

export const queryDeviceInstanceDetailPage = (
  data: Record<string, unknown>,
  config?: RequestConfig,
  client: DataCapabilityRequest = request,
) => client.post('/device/instance/detail/_query', data, config)
