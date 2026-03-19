import { request } from '@jetlinks-web/core'

export const controlDevice = (workstationId: string, data: Record<string, any>) =>
  request.post(`/resource/workstation/${workstationId}/control`, data)
