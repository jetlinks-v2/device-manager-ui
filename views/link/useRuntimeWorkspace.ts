import { computed, inject, nextTick, onActivated, onDeactivated, provide, ref, watch, type InjectionKey } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import { useDiagnosticsAccess } from './diagnostics/useDiagnosticsAccess'
import { useDiagnosticScope } from './diagnostics/useDiagnosticScope'
import { isRuntimeWorkspaceRoute, isTracingRoute } from './RuntimeMonitor/routeScope'

export type RuntimeView = 'cluster' | 'tracing' | 'connections'
type RuntimeNavigation = (next: RuntimeView, query?: LocationQueryRaw) => void
const navigationContext: InjectionKey<RuntimeNavigation> = Symbol('runtime-workspace-navigation')
export const useRuntimeWorkspaceNavigation = () => inject(navigationContext, undefined)
const fields: Record<RuntimeView, string[]> = {
  cluster: ['nodeId', 'tool', 'bean', 'traceId', 'spanId', 'logFrom', 'logTo'],
  tracing: ['traceId', 'span', 'spanId', 'nodeId'],
  connections: ['deviceId'],
}
/** 每个视图拥有自己的 URL 快照，切换不把 Trace 定位误用成日志过滤或连接节点。 */
export function runtimeViewQuery(view: RuntimeView, query: LocationQuery | LocationQueryRaw): LocationQueryRaw {
  return Object.fromEntries(fields[view].filter(key => query[key] !== undefined).map(key => [key, query[key]]))
}
/** 全群任一节点确认支持即开放；未知/瞬时失败不等价于全部 absent。 */
export function clusterSessionSupport(nodeIds: string[], snapshots: ReadonlyMap<string, { supported?: boolean }>): boolean | undefined {
  if (nodeIds.some(id => snapshots.get(id)?.supported === true)) return true
  return nodeIds.length && nodeIds.every(id => snapshots.get(id)?.supported === false) ? false : undefined
}

export function useRuntimeWorkspace() {
  const route = useRoute(), router = useRouter(), access = useDiagnosticsAccess(), scope = useDiagnosticScope()
  const activated = ref(true), root = ref<HTMLElement>()
  const active = computed(() => activated.value && isRuntimeWorkspaceRoute(route))
  const view = computed<RuntimeView>(() => {
    if (isTracingRoute(route) && access.value.trace) return 'tracing'
    if ((route.query.view === 'connections' || route.query.tool === 'sessions') && access.value.sessions) return 'connections'
    if (route.query.view === 'tracing' && access.value.trace) return 'tracing'
    return access.value.enter ? 'cluster' : access.value.trace ? 'tracing' : 'cluster'
  })
  const queries = new Map<RuntimeView, LocationQueryRaw>()
  const scroll = new Map<RuntimeView, { top: number; left: number }>()
  const panel = () => root.value?.closest<HTMLElement>('.content-panel')
  function saveScroll(target: RuntimeView) { const element = panel(); if (element) scroll.set(target, { top: element.scrollTop, left: element.scrollLeft }) }
  async function restoreScroll(target: RuntimeView) {
    await nextTick()
    const element = panel(), position = scroll.get(target)
    if (active.value && view.value === target && element) { element.scrollTop = position?.top ?? 0; element.scrollLeft = position?.left ?? 0 }
  }
  const routePath = computed(() => access.value.enter ? '/infrastructure/runtime-monitor' : '/infrastructure/tracing')
  /** 跨视图定位只覆盖目标字段，保留目标视图已提交的查询身份与浏览上下文。 */
  function navigateView(next: RuntimeView, query: LocationQueryRaw = {}) {
    if (!active.value) return
    if (next === 'cluster' && !access.value.enter || next === 'tracing' && !access.value.trace || next === 'connections' && !access.value.sessions) return
    queries.set(view.value, runtimeViewQuery(view.value, route.query)); saveScroll(view.value)
    void router.replace({ path: routePath.value, query: { ...queries.get(next), ...runtimeViewQuery(next, query), view: next } })
  }
  function selectView(next: string) {
    if (next === view.value || !['cluster', 'tracing', 'connections'].includes(next)) return
    navigateView(next as RuntimeView)
  }
  provide(navigationContext, navigateView)
  // 保存离开前的 query；外部深链进入时以该次 URL 为准，不能拿内存快照覆盖定位。
  watch(() => ({ owned: active.value, view: view.value, query: { ...route.query } }), (current, previous) => {
    if (previous?.owned) queries.set(previous.view, runtimeViewQuery(previous.view, previous.query))
    if (previous?.owned && previous.view !== current.view) saveScroll(previous.view)
    if (current.owned) { queries.set(current.view, runtimeViewQuery(current.view, current.query)); if (previous?.view !== current.view) void restoreScroll(current.view) }
  }, { flush: 'pre' })
  // 保留原菜单身份与 URL 定位；有 runtime 菜单才归一旧 tracing 地址。
  watch(() => [active.value, route.path, route.query.tool, access.value.enter, access.value.sessions], () => {
    if (!active.value) return
    if (isTracingRoute(route) && access.value.enter) void router.replace({ path: routePath.value, query: { ...runtimeViewQuery('tracing', route.query), view: 'tracing' } })
    else if (route.query.tool === 'sessions' && access.value.sessions) void router.replace({ path: routePath.value, query: { ...runtimeViewQuery('connections', route.query), view: 'connections' } })
  }, { immediate: true })
  watch([() => scope.value.accountId, () => scope.value.projectId], () => { queries.clear(); scroll.clear() }, { flush: 'sync' })
  watch(access, value => {
    if (!value.enter) { queries.delete('cluster'); scroll.delete('cluster') }
    if (!value.trace) { queries.delete('tracing'); scroll.delete('tracing') }
    if (!value.sessions) { queries.delete('connections'); scroll.delete('connections') }
  }, { flush: 'sync' })
  onDeactivated(() => { saveScroll(view.value); activated.value = false })
  onActivated(() => { activated.value = true; void restoreScroll(view.value) })
  return { root, active, view, access, selectView, navigateView }
}
