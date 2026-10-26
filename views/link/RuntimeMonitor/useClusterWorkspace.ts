import { computed, inject, onActivated, onDeactivated, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import { useDiagnosticScope } from '../diagnostics/useDiagnosticScope'
import { requestNode } from '../../../api/link/dashboard'
import { diagnosticResult, queryMonitorNodes, type DiagnosticNode } from '../../../api/link/diagnostics'
import { useDiagnosticsAccess } from '../diagnostics/useDiagnosticsAccess'
import { provideDiagnosticPreferences } from '../diagnostics/useDiagnosticPreferences'
import { diagnosticTools, type DiagnosticTool } from '../diagnostics/preferences'
import { provideSystemMonitorRuntime } from '../../../visDashboard/SystemMonitor/hooks/useSystemMonitorRuntime'
import { hasNodeMonitoringData } from './nodeSummary'
import { isRuntimeMonitorRoute } from './routeScope'

/** URL为当前对象/工具的唯一来源；用户偏好仅在有权且有效的节点集合中恢复。 */
const workspaceContext: InjectionKey<ReturnType<typeof createClusterWorkspace>> = Symbol('runtime-cluster-workspace')
function createClusterWorkspace(viewActive?: Ref<boolean>, workspaceActive?: Ref<boolean>) {
  const access = useDiagnosticsAccess()
  const router = useRouter(); const route = useRoute()
  const activated = ref(true)
  const ownerActive = computed(() => activated.value && (workspaceActive?.value ?? isRuntimeMonitorRoute(route)))
  const active = computed(() => ownerActive.value && (viewActive?.value ?? (isRuntimeMonitorRoute(route) && !['tracing', 'connections'].includes(String(route.query.view)) && route.query.tool !== 'sessions')))
  const scope = useDiagnosticScope()
  const preferences = provideDiagnosticPreferences(scope)
  const runtime = provideSystemMonitorRuntime({ enabled: computed(() => active.value && access.value.query && !!scope.value.accountId), persistFocus: false })
  const membership = useDiagnosticQuery<DiagnosticNode[]>({ retainOnDeactivate: true })
  const discoveryScope = ref('')
  const search = ref('')
  const requested = ref(''), tab = ref('overview')
  // 隐藏集群保持最后节点/工具，只由当前集群 URL 更新本地快照。
  watch([active, () => route.query.nodeId, () => route.query.tool], () => {
    if (!active.value) return
    requested.value = typeof route.query.nodeId === 'string' ? route.query.nodeId : ''
    tab.value = typeof route.query.tool === 'string' ? route.query.tool : 'overview'
  }, { immediate: true, flush: 'sync' })
  const selected = computed(() => !access.value.enter || !scope.value.accountId ? '' : nodes.value.length ? (nodes.value.some(node => node.id === requested.value) ? requested.value : '') : !canDiscover.value ? requested.value : '')
  const canDiscover = computed(() => ownerActive.value && !!scope.value.accountId && (access.value.monitor || access.value.query))
  const nodes = computed(() => {
    const live = new Map(runtime.nodes.value.map(node => [node.nodeId, node]))
    return (membership.data.value ?? (access.value.query ? runtime.nodes.value.map(node => ({ id: node.nodeId, alias: undefined })) : []))
      .map(node => ({ ...node, live: live.get(node.id) }))
      // 同组按名称/ID固定排序，压力变化不会让正在定位的节点跳位。
      .sort((left, right) => Number(hasNodeMonitoringData(right.live)) - Number(hasNodeMonitoringData(left.live))
        || (left.alias || left.id).localeCompare(right.alias || right.id) || left.id.localeCompare(right.id))
  })
  // 搜索只过滤树内容，不能把多实例误判成单实例布局。
  const showNodeSelector = computed(() => nodes.value.length > 1)
  const scopeKey = computed(() => preferences.key.value ?? JSON.stringify(scope.value))
  const filtered = computed(() => nodes.value.filter(node => `${node.id} ${node.alias ?? ''}`.toLowerCase().includes(search.value.toLowerCase())))
  const current = computed(() => nodes.value.find(node => node.id === selected.value))
  async function loadNodes() {
    if (!canDiscover.value || membership.state.value.status === 'loading') return
    const targetScope = scopeKey.value
    // 发现刷新期间保留完整目录，避免无资源上报的节点被短暂移除并重复创建采样会话。
    await membership.run(signal => access.value.monitor ? queryMonitorNodes(signal) : diagnosticResult<DiagnosticNode[]>(requestNode()), canDiscover.value, { retainData: true })
    if (canDiscover.value && targetScope === scopeKey.value && membership.state.value.status === 'ready') discoveryScope.value = targetScope
  }
  function select(nodeId: string) {
    if (!active.value || !access.value.enter || !nodes.value.some(node => node.id === nodeId)) return
    preferences.update({ nodeId })
    void router.replace({ query: { ...route.query, nodeId, traceId: undefined, spanId: undefined, bean: undefined } })
  }
  function allowedTool(tool: string): tool is DiagnosticTool {
    return diagnosticTools.includes(tool as DiagnosticTool) && (tool === 'overview' || tool === 'jvm' && (access.value.threads || access.value.jfr || access.value.heap) || tool === 'mbean' && access.value.monitor || tool === 'logs' && access.value.logs)
  }
  function selectTab(tool: string) {
    if (!active.value || !access.value.enter || !allowedTool(tool)) return
    preferences.update({ tool })
    void router.replace({ query: { ...route.query, tool } })
  }
  // 身份变化立即隔离旧节点与实时值，再在新权限上下文中发现，URL显式定位仍优先。
  watch(scopeKey, () => { discoveryScope.value = ''; membership.clear(); runtime.nodes.value = []; if (active.value) runtime.refresh() }, { flush: 'sync' })
  watch([ownerActive, access, scopeKey, () => runtime.topologyVersion.value], () => {
    if (canDiscover.value) void loadNodes()
    else if (!scope.value.accountId || !access.value.enter || !(access.value.monitor || access.value.query)) { discoveryScope.value = ''; membership.clear() }
    else membership.cancel()
  }, { immediate: true })
  onDeactivated(() => { activated.value = false })
  onActivated(() => { activated.value = true; if (canDiscover.value && !membership.data.value && membership.state.value.status !== 'loading') void loadNodes() })
  watch([nodes, requested, active], ([values]) => {
    if (!active.value || !access.value.enter || !values.length) return
    const cached = preferences.value.value.nodeId
    const next = values.some(node => node.id === requested.value) ? requested.value : values.some(node => node.id === cached) ? cached! : values[0].id
    if (next !== requested.value) select(next)
    else preferences.update({ nodeId: next })
  }, { immediate: true })
  watch([tab, access, active], () => {
    if (!active.value || !access.value.enter) return
    const cached = preferences.value.value.tool
    const next = typeof route.query.tool === 'string' && allowedTool(tab.value) ? tab.value : cached && allowedTool(cached) ? cached : 'overview'
    if (tab.value !== next || route.query.tool === undefined && next !== 'overview') selectTab(next)
  }, { immediate: true })
  return { runtime, access, membership, discoveryScope, search, selected, tab, nodes, filtered, current, showNodeSelector, canDiscover, scopeKey, active, ownerActive, preferences, select, selectTab, loadNodes }
}
export function useClusterWorkspace() { return inject(workspaceContext, undefined) ?? createClusterWorkspace() }
export function provideClusterWorkspace(...args: Parameters<typeof createClusterWorkspace>) { const value = createClusterWorkspace(...args); provide(workspaceContext, value); return value }
