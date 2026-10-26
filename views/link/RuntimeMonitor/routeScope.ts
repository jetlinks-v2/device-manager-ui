import type { RouteLocationNormalizedLoaded } from 'vue-router'

type WorkspaceRoute = Pick<RouteLocationNormalizedLoaded, 'name' | 'path'>
/** 两个已注册菜单身份共用工作区；Tracing-only 不跳转到未授权的 runtime 路由。 */
export const isRuntimeMonitorRoute = (route: WorkspaceRoute) => route.name === 'link/RuntimeMonitor' || route.path?.endsWith('/infrastructure/runtime-monitor') === true
export const isTracingRoute = (route: WorkspaceRoute) => route.name === 'link/Tracing' || /\/infrastructure\/tracing\/?$/.test(route.path)
export const isRuntimeWorkspaceRoute = (route: WorkspaceRoute) => isRuntimeMonitorRoute(route) || isTracingRoute(route)
