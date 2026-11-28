import { request } from '@jetlinks-web/core'
import type { DeviceSessionInfo } from '@jetlinks-web-core/components/RuntimeDiagnostics/types'

export const queryDeviceConnectionSessions_api = (deviceId: string) =>
  request.get(`/device/instance/${encodeURIComponent(deviceId)}/sessions`) as Promise<{ status: number; result?: DeviceSessionInfo[] }>
