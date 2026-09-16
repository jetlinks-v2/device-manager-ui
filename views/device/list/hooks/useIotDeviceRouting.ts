import type { IotRiskKind } from '../types'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'

const encodePathSegment = (value: string) => encodeURIComponent(value)

type IotRouteLike = {
  name?: unknown
  path?: string
  params?: Record<string, unknown>
  query?: Record<string, unknown>
}

const firstRouteValue = (value: unknown) => Array.isArray(value) ? value[0] : value

/** 物联应用的设备列表仅承载普通设备，不展示资源中心的设备类型切换。 */
export function isIotDeviceListEntry(route?: IotRouteLike) {
  return route?.path?.startsWith('/iot-center/') ?? false
}

// 设备页同时挂在运营端和项目态菜单下，跳转时必须沿用当前路由上下文。
const isProjectIotRoute = (route?: IotRouteLike) => {
  if (!route) return true

  const routeName = firstRouteValue(route.name)
  if (typeof routeName === 'string' && routeName.startsWith('project/iot')) return true
  if (typeof route.path === 'string' && route.path.startsWith('/project/')) return true

  return firstRouteValue(route.params?.projectId) != null
}

export function resolveIotProjectId(route: IotRouteLike, fallback = 'doraemon') {
  const value = firstRouteValue(route.params?.projectId ?? route.query?.projectId ?? route.params?.id)
  if (value != null && value !== '') return String(value)
  return getProjectIdFromLocation() || fallback
}

export function buildIotDeviceListPath(projectId: string, route?: IotRouteLike) {
  // 资源中心与物联应用使用不同的菜单根路径，详情必须挂在当前入口对应的列表子路由下。
  return route?.path?.startsWith('/iot-center/')
    ? '/iot-center/device/list'
    : '/resources/devices/list/device'
}

/** 返回当前设备列表入口对应的菜单 code，供父路由和菜单型跳转共享。 */
export function getIotDeviceListMenuCode(route?: IotRouteLike) {
  // 资源中心的设备清单实际由 /device 子菜单承载；父菜单只负责容器与跳转。
  return route?.path?.startsWith('/iot-center/') || route?.path?.startsWith('/resources/devices/list/device')
    ? 'iot-user/device/list'
    : 'iot-user-device-list'
}

export function buildIotDeviceDetailPath(
  projectId: string,
  deviceId: string,
  query?: Record<string, string | undefined>,
  route?: IotRouteLike,
) {
  const search = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const searchText = search.toString()
  return `${buildIotDeviceListPath(projectId, route)}/Detail/${encodePathSegment(deviceId)}${searchText ? `?${searchText}` : ''}`
}

export function buildIotDeviceDiagnosisPath(projectId: string, deviceId: string, route?: IotRouteLike) {
  return buildIotDeviceDetailPath(projectId, deviceId, { tab: 'advanced', sub: 'health' }, route)
}

export function buildIotDeviceHealthPath(projectId: string, deviceId?: string, todoId?: string, route?: IotRouteLike) {
  const query = new URLSearchParams()
  if (deviceId) query.set('deviceId', deviceId)
  if (todoId) query.set('todoId', todoId)
  const searchText = query.toString()
  const basePath = isProjectIotRoute(route)
    ? `/project/${encodePathSegment(projectId)}/iot-user/health`
    : '/iot-user/device/health'

  return `${basePath}${searchText ? `?${searchText}` : ''}`
}

export function buildIotDeviceOverviewPath(projectId: string, anomalyKind: IotRiskKind | 'all' = 'all') {
  const path = buildIotDeviceListPath(projectId)
  if (anomalyKind === 'all') return path
  return `${path}?anomalyKind=${encodeURIComponent(anomalyKind)}`
}

export function parseIotAnomalyKind(value: unknown): IotRiskKind | 'all' {
  if (value === 'data-deviation' || value === 'offline-frequent' || value === 'fault-code') {
    return value
  }
  return 'all'
}

export function mapIotHealthSegmentToAnomalyKind(value: unknown): IotRiskKind | 'all' {
  switch (value) {
    case 'deviation':
      return 'data-deviation'
    case 'offlineFrequent':
      return 'offline-frequent'
    case 'fault':
      return 'fault-code'
    default:
      return 'all'
  }
}
