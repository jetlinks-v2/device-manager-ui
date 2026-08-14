import { request } from '@jetlinks-web/core'
import { IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS } from './deviceListDefaultTerms'

export type SceneEntity = Record<string, any>

export interface SceneNotifyMethod {
  id: string
  providerId: string
  name: string
  channelProvider: string
}

export interface SceneNotifyUser {
  id: string
  name: string
  username?: string
  email?: string
  telephone?: string
}

export interface SceneProviderInfo {
  provider: string
  name?: string
  description?: string
}

const pendingProductRequests = new Map<string, Promise<any>>()
const pendingDeviceQueries = new Map<string, Promise<any>>()

const mergePendingQuery = <T>(key: string, loader: () => Promise<T>) => {
  const pending = pendingDeviceQueries.get(key)
  if (pending) return pending as Promise<T>
  const requestPromise = loader()
  pendingDeviceQueries.set(key, requestPromise)
  requestPromise.then(
    () => pendingDeviceQueries.delete(key),
    () => pendingDeviceQueries.delete(key),
  )
  return requestPromise
}

export const queryScenes = (data: Record<string, any>) =>
  request.post('/scene/_query', data)

export const getSceneDetail = (id: string) =>
  request.get<SceneEntity>(`/scene/${id}`)

export const createSceneLinkage = (data: Record<string, any>) =>
  request.post('/scene', data)

export const updateSceneLinkage = (id: string, data: Record<string, any>) =>
  request.put(`/scene/${id}`, data)

export const deleteScene = (id: string) =>
  request.remove(`/scene/${id}`)

export const enableScene = (id: string) =>
  request.put(`/scene/${id}/_enable`)

export const disableScene = (id: string) =>
  request.put(`/scene/${id}/_disable`)

export const executeScene = (id: string) =>
  request.post(`/scene/${id}/_execute`)

export const queryProducts = (data: Record<string, any>) =>
  request.post('/device/product/_query', {
    ...data,
    terms: [
      {
        column: 'accessProvider',
        termType: 'nin',
        value: [...IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS],
      },
      ...(data.terms ?? []),
    ],
  })

export const queryDevices = (data: Record<string, any>) =>
  mergePendingQuery(`devices:no-paging:${JSON.stringify(data)}`, () =>
    request.post('/device-instance/_query/no-paging?paging=false', data),
  )

export const queryDevicesPage = (data: Record<string, any>) =>
  mergePendingQuery(`devices:page:${JSON.stringify(data)}`, () =>
    request.post('/device-instance/_query', data),
  )

export const getProduct = (id: string) => {
  const pending = pendingProductRequests.get(id)
  if (pending) return pending

  // 场景编辑需要使用产品的最新物模型；这里只合并并发请求，不缓存已完成结果。
  const requestPromise = request.get(`/device-product/${id}`)
  pendingProductRequests.set(id, requestPromise)
  requestPromise.then(
    () => pendingProductRequests.delete(id),
    () => pendingProductRequests.delete(id),
  )
  return requestPromise
}

export const queryDeviceAlarmPreprocesses = (data: Record<string, any>) =>
  request.post('/message/preprocessor/device-alarm/_query', data)

export const querySceneRecordsByScene = (id: string, data: Record<string, any>) =>
  request.post(`/scene/${id}/record/_query`, data)

export const querySceneContextRecords = (id: string, contextId: string, data: Record<string, any>) =>
  request.post(`/scene/${id}/record/${contextId}/_query`, data)

export const querySceneNotifyChannels = () =>
  request.get('/notify/channel/all')

export const querySceneNotifyUsers = (data: {
  pageIndex?: number
  pageSize?: number
  paging?: boolean
  userIds?: string[]
}) => {
  const { userIds, ...params } = data
  return request.post('/user/detail/_query', {
    ...params,
    terms: userIds?.length
      ? [{ column: 'id', termType: 'in', value: userIds }]
      : undefined,
    sorts: [{ name: 'name', order: 'asc' }],
  })
}

export const querySceneNotifyChannelTemplates = (providerId: string) =>
  request.get(`/notify/channel/${encodeURIComponent(providerId)}/_query-with-templates`)

export const parseSceneVariables = (data: Record<string, any>, params?: Record<string, number>) =>
  request.post('/scene/parse-variables', data, { params })

export const querySceneTermColumns = (data: Record<string, any>) =>
  request.post('/scene/parse-term-column', data)

export const querySceneSupportedTriggers = () =>
  request.get<SceneProviderInfo[]>('/scene/trigger/supports')

export const querySceneSupportedActions = () =>
  request.get<SceneProviderInfo[]>('/scene/action/supports')
