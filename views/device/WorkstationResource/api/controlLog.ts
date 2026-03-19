import { request } from '@jetlinks-web/core'

export const queryControlLog = (data?: Record<string, any>) =>
  request.post('/resource/control-log/_query', data)

export const countControlLog = (data?: Record<string, any>) =>
  request.post('/resource/control-log/_count', data)
