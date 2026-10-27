import { computed, onActivated, onDeactivated, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { TraceSpan } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryMonitorNodes, logNodes, diagnosticResult, type DiagnosticNode } from '../../../api/link/diagnostics'
import { requestNode } from '../../../api/link/dashboard'
import { normalizeTrace } from '../diagnostics/normalize'
import { useDiagnosticsAccess } from '../diagnostics/useDiagnosticsAccess'
import { useDiagnosticScope } from '../diagnostics/useDiagnosticScope'
import { diagnosticErrorState } from '../diagnostics/status'
import { useTraceSession } from '../../../store/traceWorkspace'
import { parseTraceInput } from './parseTraceInput'
import { combinedTraceSpans } from './edgeTrace'

/** 工作区在同身份的跨页排查中保留；app只与授权目录精确匹配，不猜测第三方scope。 */
export function useClusterTrace(pageActive?: Ref<boolean>) {
  const access = useDiagnosticsAccess(), scope = useDiagnosticScope(), route = useRoute(), router = useRouter()
  const activated = ref(true)
  const ownsRoute = computed(() => activated.value && (pageActive?.value ?? true) && (/(?:^|\/)infrastructure\/tracing\/?$/.test(route.path)
    || /(?:^|\/)infrastructure\/runtime-monitor\/?$/.test(route.path) && route.query.view === 'tracing'))
  const directory = useDiagnosticQuery<DiagnosticNode[]>({ retainOnDeactivate: true })
  const workspace = useTraceSession()
  const traceId = computed(() => workspace.active.value?.traceId ?? '')
  const query = { data: computed(() => workspace.active.value?.data), state: computed(() => workspace.active.value?.state ?? { status: 'ready' as const }) }
  const spans = computed(() => normalizeTrace(workspace.active.value ? combinedTraceSpans(workspace.active.value) : [], directory.data.value ?? []))
  const state = computed(() => access.value.trace ? query.state.value : { status: 'forbidden' as const })
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  function syncUrl(method: 'push' | 'replace' = 'replace') {
    if (!ownsRoute.value) return
    const tab = workspace.active.value
    void router[method]({ query: { ...route.query, traceId: tab?.traceId || undefined, span: tab?.selectedId || undefined, spanId: undefined, nodeId: tab?.focusNode || undefined } })
  }
  function fromRoute() {
    if (!ownsRoute.value) { workspace.suspend(); return }
    if (!access.value.trace || !scope.value.accountId) return
    const id = text(route.query.traceId)
    if (id) {
      const parsed = parseTraceInput(id)
      if (!parsed.valid) { workspace.newQuery(); workspace.input.value = id; workspace.inputError.value = true; return }
      const tab = workspace.open(parsed.traceId, { selectedId: text(route.query.span) || text(route.query.spanId), focusNode: text(route.query.nodeId), preserveInput: true })
      if (!tab) { workspace.showDraft(id); return }
      if (parsed.traceId !== id) syncUrl()
      workspace.resume()
    // 空 URL 返回既有草稿时保留输入；从一条结果进入空查询才清空正文身份。
    } else if (workspace.active.value) workspace.newQuery()
  }
  function search() {
    if (!ownsRoute.value || !access.value.trace) return
    const parsed = parseTraceInput(workspace.input.value)
    workspace.inputError.value = !parsed.valid
    if (parsed.valid && workspace.open(parsed.traceId)) syncUrl('push')
  }
  function activate(key: string) { if (!ownsRoute.value || !access.value.trace) return; workspace.activate(key); workspace.resume(); syncUrl() }
  function newQuery() { if (ownsRoute.value && access.value.trace) workspace.newQuery() }
  function close(key: string) {
    if (!ownsRoute.value || !access.value.trace || !workspace.tabs.value.some(tab => tab.key === key)) return
    workspace.close(key); workspace.resume(); syncUrl()
  }
  function refresh() { if (ownsRoute.value && access.value.trace) void workspace.refresh() }
  function select(span?: TraceSpan) {
    const tab = workspace.active.value
    if (!ownsRoute.value || !access.value.trace || !tab) return
    tab.selectedId = span && 'key' in span && typeof span.key === 'string' ? span.key : span?.id ?? ''
    syncUrl()
  }
  function verified(span: TraceSpan) { return !!span.nodeId && !!directory.data.value?.some(node => node.id === span.nodeId) && spans.value.some(item => item.id === span.id && item.traceId === span.traceId && item.nodeId === span.nodeId) }
  function logs(span: TraceSpan) {
    if (!ownsRoute.value || !access.value.enter || !access.value.logs || !verified(span)) return
    const logFrom = /^\d+$/.test(span.startNanos) ? String(BigInt(span.startNanos) / 1000000n) : undefined
    const logTo = /^\d+$/.test(span.endNanos) ? String(BigInt(span.endNanos) / 1000000n) : undefined
    void router.push({ path: '/infrastructure/runtime-monitor', query: { view: 'cluster', nodeId: span.nodeId, tool: 'logs', traceId: span.traceId, spanId: span.id, logFrom, logTo } })
  }
  function node(span: TraceSpan) {
    if (!ownsRoute.value || !access.value.enter || !verified(span)) return
    const tool = access.value.query || access.value.monitor ? 'overview' : access.value.logs ? 'logs' : 'jvm'
    void router.push({ path: '/infrastructure/runtime-monitor', query: { view: 'cluster', nodeId: span.nodeId, tool } })
  }
  watch([() => scope.value.accountId, () => scope.value.projectId, () => access.value.trace], fromRoute, { immediate: true })
  watch(() => [ownsRoute.value, route.path, route.query.view, route.query.traceId, route.query.span, route.query.spanId, route.query.nodeId], fromRoute)
  // 暂停保留同身份目录；身份或权限变化同步清除，防止新结果映射到旧授权节点。
  watch([access, scope], () => directory.clear(), { flush: 'sync' })
  watch([access, scope, ownsRoute], () => {
    if (!scope.value.accountId || !access.value.trace) { directory.clear(); return }
    if (!ownsRoute.value) { directory.cancel(); return }
    if (access.value.monitor || access.value.logs || access.value.query) void directory.run(signal => access.value.monitor ? queryMonitorNodes(signal) : access.value.logs ? logNodes(signal) : diagnosticResult<DiagnosticNode[]>(requestNode()), true, { errorState: diagnosticErrorState })
  }, { immediate: true })
  onDeactivated(() => { activated.value = false; workspace.suspend() })
  onActivated(() => { activated.value = true; if (ownsRoute.value) { fromRoute(); workspace.resume() } })
  return { route, access, active: ownsRoute, input: workspace.input, query, spans, traceId, state, directory, workspace, search, refresh, select, logs, node, activate, newQuery, close }
}
