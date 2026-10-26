import { computed, onScopeDispose, ref } from 'vue'
import type { ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { nanosText } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import type { RawSpan } from '../../../api/link/diagnostics'

export interface TraceWorkspaceTab {
  key: string
  traceId: string
  input: string
  inputError?: boolean
  selectedId: string
  focusNode: string
  data?: RawSpan[]
  state: ViewState
  accessedAt: number
}
interface TraceLocation { selectedId?: string; focusNode?: string; preserveInput?: boolean }
interface TraceWorkspaceOptions {
  load: (id: string, signal: AbortSignal) => Promise<RawSpan[]>
  errorState: (error: unknown) => ViewState
  allowed: () => boolean
  limit?: number
}

/** 标题优先入口；根缺失时取最早有效Span，不能用接口返回顺序猜测开始时间。 */
export function traceEntryName(tab: TraceWorkspaceTab): string {
  const values = tab.data ?? []
  const roots = values.filter(span => !span.parentSpanId || /^0+$/.test(span.parentSpanId))
  const candidates = roots.length ? roots : values
  const timed = candidates.map(span => ({ span, start: nanosText(span.startWithNanos, span.startWithNanosText) }))
    .filter((value): value is { span: RawSpan; start: string } => value.start !== undefined)
    .sort((a, b) => BigInt(a.start) < BigInt(b.start) ? -1 : BigInt(a.start) > BigInt(b.start) ? 1 : 0)
  return timed[0]?.span.name || candidates[0]?.name || tab.traceId
}

/** 只简化平台明确的HTTP入口命名，业务Span及第三方名称保持原样。 */
export function traceTabLabel(name: string): string {
  const http = /^\/http\/(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)(\/[^\s]*)$/.exec(name)
  if (!http) return name
  let path = http[2]
  // 仅改变可读标题；原始编码始终留在入口和提示中，坏编码或控制字符保持原样。
  try {
    const decoded = decodeURIComponent(path)
    if (!/[\u0000-\u001f\u007f]/.test(decoded)) path = decoded
  } catch { /* 非法百分号编码仍可作为普通入口查看。 */ }
  return `${http[1]} ${path}`
}

/** 短 ID 常驻且在当前标签内唯一；同后缀时逐步扩展，不能仅靠悬停区分。 */
export function traceTabId(traceId: string, tabs: Pick<TraceWorkspaceTab, 'traceId'>[]): string {
  let length = 8
  while (length < traceId.length && tabs.some(tab => tab.traceId !== traceId && tab.traceId.endsWith(traceId.slice(-length)))) length += 4
  return traceId.slice(-length)
}

/** 请求与证据由显式所有者管理，页面实例和跨页会话可使用相同取消 / 代际规则。 */
export function useTraceWorkspace(options: TraceWorkspaceOptions) {
  const limit = options.limit ?? 8
  const tabs = ref<TraceWorkspaceTab[]>([]), activeKey = ref(''), draft = ref(''), draftError = ref(false), capacityReached = ref(false)
  const active = computed(() => tabs.value.find(tab => tab.key === activeKey.value))
  const inputError = computed({ get: () => active.value?.inputError ?? draftError.value, set: value => { if (active.value) active.value.inputError = value; else draftError.value = value } })
  const input = computed({ get: () => active.value?.input ?? draft.value, set: value => { if (active.value) active.value.input = value; else draft.value = value; inputError.value = false } })
  const requests = new Map<string, { controller: AbortController }>()
  let serial = 0, lastAccessedAt = 0
  // 同一毫秒内连续切换也有稳定的最近访问顺序。
  const accessedNow = () => (lastAccessedAt = Math.max(Date.now(), lastAccessedAt + 1))

  function cancel(key: string) { requests.get(key)?.controller.abort(); requests.delete(key) }
  function reset() {
    requests.forEach(request => request.controller.abort()); requests.clear()
    tabs.value = []; activeKey.value = ''; draft.value = ''; draftError.value = false; capacityReached.value = false
  }
  async function refresh(key = activeKey.value) {
    const tab = tabs.value.find(item => item.key === key)
    if (!tab?.traceId || !options.allowed()) return
    cancel(key)
    const request = { controller: new AbortController() }
    requests.set(key, request); tab.state = { status: 'loading' }
    try {
      const result = await options.load(tab.traceId, request.controller.signal)
      if (requests.get(key) !== request || !tabs.value.includes(tab) || !options.allowed()) return
      tab.data = result; tab.state = { status: result.length ? 'ready' : 'empty', sampledAt: Date.now() }
    } catch (error) {
      if (requests.get(key) !== request || !tabs.value.includes(tab) || !options.allowed()) return
      tab.state = options.errorState(error)
      if (tab.state.status === 'forbidden') tab.data = undefined
    } finally { if (requests.get(key) === request) requests.delete(key) }
  }
  function create(traceId: string, location: TraceLocation = {}) {
    if (tabs.value.length >= limit) { capacityReached.value = true; return }
    const tab: TraceWorkspaceTab = { key: `trace-${++serial}`, traceId, input: traceId, inputError: false, selectedId: location.selectedId ?? '', focusNode: location.focusNode ?? '', state: { status: 'ready' }, accessedAt: accessedNow() }
    tabs.value.push(tab); activeKey.value = tab.key; capacityReached.value = false
    return active.value!
  }
  function open(traceId: string, location: TraceLocation = {}) {
    if (!options.allowed() || !traceId) return
    let tab = tabs.value.find(item => item.traceId === traceId)
    if (tab) {
      activeKey.value = tab.key; tab.accessedAt = accessedNow()
      if (!location.preserveInput) { tab.input = traceId; tab.inputError = false }
      if (location.selectedId !== undefined) tab.selectedId = location.selectedId
      if (location.focusNode !== undefined) tab.focusNode = location.focusNode
      capacityReached.value = false
      return tab
    }
    tab = tabs.value.find(item => !item.traceId)
    if (tab) {
      Object.assign(tab, { traceId, input: traceId, inputError: false, selectedId: location.selectedId ?? '', focusNode: location.focusNode ?? '' })
      activeKey.value = tab.key; tab.accessedAt = accessedNow()
    } else tab = create(traceId, location)
    if (tab) void refresh(tab.key)
    return tab
  }
  function newQuery() { if (options.allowed()) { activeKey.value = ''; draft.value = ''; draftError.value = false; capacityReached.value = false } }
  function showDraft(value: string, error = false) { activeKey.value = ''; draft.value = value; draftError.value = error }
  function activate(key: string) { const tab = tabs.value.find(item => item.key === key); if (tab) { activeKey.value = key; tab.accessedAt = accessedNow() } }
  function close(key: string) {
    const index = tabs.value.findIndex(tab => tab.key === key)
    if (index < 0) return
    cancel(key); tabs.value.splice(index, 1); capacityReached.value = false
    if (activeKey.value === key) {
      activeKey.value = tabs.value[Math.min(index, tabs.value.length - 1)]?.key ?? ''
      if (!activeKey.value) { draft.value = ''; draftError.value = false }
    }
  }
  function suspend() {
    requests.forEach((request, key) => {
      request.controller.abort()
      const tab = tabs.value.find(item => item.key === key)
      if (tab) tab.state = { status: 'ready' }
    })
    requests.clear()
  }
  function resume() { if (active.value?.traceId && !active.value.data && active.value.state.status === 'ready') void refresh() }
  onScopeDispose(reset)
  return { tabs, activeKey, active, input, inputError, capacityReached, limit, open, newQuery, showDraft, activate, close, refresh, reset, suspend, resume }
}
