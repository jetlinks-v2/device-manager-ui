import { request } from '@jetlinks-web/core'

type RequestConfig = Record<string, unknown>

export const countDeviceInstances = (
  data: Record<string, unknown>,
  config?: RequestConfig,
) => request.post('/device-instance/_count', data, config)

export const queryDeviceInstanceStates = (
  data: Record<string, unknown>,
  config?: RequestConfig,
) => request.post('/device-instance/_query/no-paging?paging=false', data, config)

export const queryDeviceInstanceDetail = (
  deviceId: string,
  config?: RequestConfig,
) => request.get(
  `/device-instance/${encodeURIComponent(deviceId)}/detail`,
  {},
  config,
)
