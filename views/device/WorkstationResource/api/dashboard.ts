import { request } from '@jetlinks-web/core'

export const getOverview = () =>
  request.get('/resource/dashboard/overview')
