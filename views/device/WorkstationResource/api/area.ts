import { request } from '@jetlinks-web/core'

export const queryArea = (data?: Record<string, any>) =>
  request.post('/resource/work-area/_query', data)

export const queryAreaNoPaging = (data?: Record<string, any>) =>
  request.post('/resource/work-area/_query/no-paging', data)

export const getAreaDetail = (id: string) =>
  request.get(`/resource/work-area/${id}`)

export const saveArea = (data: Record<string, any>) =>
  request.post('/resource/work-area', data)

export const updateArea = (id: string, data: Record<string, any>) =>
  request.put(`/resource/work-area/${id}`, data)

export const deleteArea = (id: string) =>
  request.remove(`/resource/work-area/${id}`)
