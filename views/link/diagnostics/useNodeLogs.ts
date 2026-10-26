import { computed, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { LogFile, LogDisplayConfig, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { logRoots, logChildren, logEntries, readLog, statLog, downloadLog, saveDiagnosticFile, type LogWindow } from '../../../api/link/diagnostics'
import { entriesForLogWindows, joinedLogWindow, mergeLogWindows } from './logWindows'
import { latestLogFile, logFileKey, sortLogCatalog } from './logCatalog'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import { diagnosticErrorState } from './status'

export { logFileKey } from './logCatalog'

/** 有界文件窗口按游标读取；enabled 控制独立的只读能力发现，tab 仅控制文件阅读。 */
export function useNodeLogs(node: Ref<string>, tab: Ref<string>, enabled: Ref<boolean> = computed(() => tab.value === 'logs')) {
  const access = useDiagnosticsAccess(), preferences = useDiagnosticPreferences(), { t } = useI18n()
  const catalog = useDiagnosticQuery<LogFile[]>({ retainOnDeactivate: true }), windowQuery = useDiagnosticQuery<LogWindow>({ retainOnDeactivate: true }), exportQuery = useDiagnosticQuery<unknown>({ retainOnDeactivate: true })
  const providers = useDiagnosticQuery<LogFile[]>({ retainOnDeactivate: true })
  const catalogData = shallowRef<LogFile[]>(), windowData = shallowRef<LogWindow>(), notice = ref(''), filter = ref(''), following = ref(false), parents = ref<LogFile[]>([])
  const file = shallowRef<LogFile>(), selectedParents = ref<LogFile[]>([])
  const fileId = computed(() => file.value ? logFileKey(file.value) : '')
  const filePath = computed(() => file.value ? [...selectedParents.value.map(item => item.name), file.value.name].join(' / ') : '')
  const chunks = shallowRef<LogWindow[]>([]), clipped = ref(false), loadingDirection = ref('')
  const consoleAvailable = computed(() => !!providers.data.value?.some(file => file.providerId === 'java'))
  const config = computed(() => preferences?.value.value.nodes[node.value]?.logDisplay)
  let timer: ReturnType<typeof setTimeout> | undefined, generation = 0, catalogGeneration = 0, lastSize: number | undefined
  let providerGeneration = 0, providerRequest: Promise<LogFile[] | undefined> | undefined
  const active = ref(true)
  const allowed = computed(() => active.value && access.value.logs && tab.value === 'logs' && !!node.value)
  const providerAllowed = computed(() => active.value && enabled.value && access.value.logs && !!node.value)
  const catalogState = computed(() => !catalogData.value && !providers.data.value ? providers.state.value : catalog.state.value)
  const entries = computed(() => entriesForLogWindows(chunks.value))
  const state = computed<ViewState>(() => {
    if (!access.value.logs) return { status: 'forbidden' }
    const current = windowQuery.state.value
    if (!windowData.value) return current
    // 已有窗口是阅读缓存：后台跟随与刷新不能周期性遮罩正文或重建滚动容器。
    if (current.status === 'loading') return { status: 'ready' }
    if (current.status === 'error') return { status: 'stale', message: current.message }
    return current
  })
  function configure(value: LogDisplayConfig) { pause(); if (active.value && access.value.logs && node.value) preferences?.updateNode(node.value, { logDisplay: value }) }
  function search(value: string) { pause(); filter.value = value }
  function stop() { clearTimeout(timer); timer = undefined }
  function pause() { following.value = false; stop() }
  function pauseCatalog() { catalogGeneration++; catalog.cancel() }
  function pauseRequests() { generation++; pause(); loadingDirection.value = ''; windowQuery.cancel(); pauseCatalog(); exportQuery.cancel() }
  function resetWindow() { generation++; pause(); windowData.value = undefined; chunks.value = []; clipped.value = false; loadingDirection.value = ''; windowQuery.clear(); exportQuery.clear(); notice.value = ''; lastSize = undefined }
  async function read(position?: number, direction = 'backward', follow = false, merge = false) {
    stop()
    const target = file.value, current = ++generation, targetNode = node.value
    if (!target || target.directory || !allowed.value) return
    let rotated = false
    loadingDirection.value = merge ? direction : ''
    await windowQuery.run(async signal => {
      const stat = await statLog(targetNode, target, signal)
      rotated = lastSize !== undefined && stat.size !== undefined && stat.size < lastSize
      const result = await readLog(targetNode, target, signal, rotated ? undefined : position, rotated ? 'backward' : direction)
      if (!signal.aborted) lastSize = stat.size
      return result
    }, true, { errorState: diagnosticErrorState })
    if (current !== generation || !allowed.value || follow && !following.value) return
    loadingDirection.value = ''
    const result = windowQuery.data.value
    if (result) {
      if (rotated || !merge && windowData.value && result.endPosition < windowData.value.endPosition) notice.value = t('RuntimeMonitor.logRotated')
      const next = mergeLogWindows(chunks.value, result, merge && !rotated ? direction === 'forward' ? 'forward' : 'backward' : undefined)
      chunks.value = next.chunks; clipped.value = merge && !rotated ? clipped.value || next.clipped : next.clipped
      windowData.value = joinedLogWindow(chunks.value)
    } else {
      pause()
      if (['forbidden', 'unsupported'].includes(windowQuery.state.value.status)) {
        const failure = windowQuery.state.value
        resetWindow(); windowQuery.clear(failure)
      }
    }
    schedule()
  }
  function schedule() { stop(); if (following.value && allowed.value && file.value) timer = setTimeout(() => void read(windowData.value?.endPosition, 'forward', true, true), 3000) }
  function follow(value: boolean) {
    if (!value) { pause(); return }
    if (!allowed.value || !file.value || file.value.entry || /\.(zip|gz)$/i.test(file.value.name)) { notice.value = t('RuntimeMonitor.archiveFollowUnavailable'); return }
    // 恢复始终从服务端最新窗口读取；展示组件只在新entries落地后滚动，不先跳旧窗口底部。
    following.value = true; void read(undefined, 'backward', true)
  }
  function cancelProviders() { providerGeneration++; providers.cancel(); providerRequest = undefined }
  /** roots 只读能力发现独立于文件/控制台来源；刷新保留已确认能力，不把未知当成不支持。 */
  async function discoverProviders(refresh = false): Promise<LogFile[] | undefined> {
    if (!providerAllowed.value) return
    if (providerRequest) return providerRequest
    if (!refresh && providers.data.value) return providers.data.value
    const current = providerGeneration, targetNode = node.value
    const request = (async () => {
      await providers.run(signal => logRoots(targetNode, signal), true, { errorState: diagnosticErrorState, retainData: true })
      if (current === providerGeneration && providerAllowed.value && providers.state.value.status === 'ready') return providers.data.value
    })()
    providerRequest = request
    try { return await request } finally { if (providerRequest === request) providerRequest = undefined }
  }
  async function roots(refresh = true) {
    if (!allowed.value) return
    const requestedCatalog = catalogGeneration
    const roots = await discoverProviders(refresh)
    if (!allowed.value || requestedCatalog !== catalogGeneration) return
    if (!roots) { catalog.clear(providers.state.value); return }
    const browsed = await navigateCatalog([], async () => roots)
    if (!allowed.value || !browsed) return
    if (file.value) return
    const current = catalogGeneration
    // 发现有界目录后整体提交，用户在期间主动导航则取消，不覆盖其选择。
    let selected: Awaited<ReturnType<typeof latestLogFile>>
    await catalog.run(async signal => { selected = await latestLogFile(node.value, roots, signal); return selected?.siblings ?? roots }, true, { errorState: diagnosticErrorState, retainData: true })
    if (current !== catalogGeneration || !allowed.value || file.value || !selected || catalog.state.value.status !== 'ready') return
    parents.value = selected.parents; catalogData.value = sortLogCatalog(selected.siblings); file.value = selected.file; selectedParents.value = [...selected.parents]
    await read()
  }
  /** 目录与面包屑一起提交；取消切换时保留上一次完整目录和阅读窗口。 */
  async function navigateCatalog(nextParents: LogFile[], loader: (signal: AbortSignal) => Promise<LogFile[]>) {
    pauseCatalog()
    const current = catalogGeneration
    await catalog.run(loader, true, { errorState: diagnosticErrorState, isEmpty: rows => !rows.length, retainData: true })
    if (current !== catalogGeneration || !allowed.value) return
    if (['ready', 'empty'].includes(catalog.state.value.status)) {
      parents.value = nextParents; catalogData.value = sortLogCatalog(catalog.data.value ?? [])
      return catalogData.value
    }
  }
  /** ZIP返回上级保留归档身份；所有路径均为服务端逻辑ID。 */
  function children(target: LogFile, signal: AbortSignal) {
    return target.directory ? logChildren(node.value, target, signal) : logEntries(node.value, target, signal).then(entries => entries.map(entry => ({ ...target, entry, name: entry, exportName: target.name })))
  }
  async function select(key: string) {
    if (!allowed.value) return
    const target = catalogData.value?.find(item => logFileKey(item) === key)
    if (!target) return
    if (target.directory || /\.zip$/i.test(target.name) && !target.entry) {
      await navigateCatalog([...parents.value, target], signal => children(target, signal))
      return false
    }
    if (fileId.value === key) return true
    resetWindow(); file.value = target; selectedParents.value = [...parents.value]; await read()
    return true
  }
  async function parent() {
    return navigate(parents.value.length - 2)
  }
  async function navigate(index: number) {
    if (!allowed.value) return
    const nextParents = parents.value.slice(0, Math.max(0, index + 1)), target = nextParents.at(-1)
    if (!target) return roots()
    await navigateCatalog(nextParents, signal => children(target, signal))
  }
  function refreshCatalog() { return navigate(parents.value.length - 1) }
  function page(position?: number, direction = 'backward') {
    if (position == null || windowQuery.state.value.status === 'loading') return
    pause(); return read(position, direction, false, true)
  }
  function download() {
    const target = file.value
    if (!target || !target.operations.includes('download') || !allowed.value || !access.value.exportLogs || exportQuery.state.value.status === 'loading') return
    void exportQuery.run(async signal => {
      const result = await downloadLog(node.value, target, signal)
      if (signal.aborted) return false
      await saveDiagnosticFile(result, target.exportName ?? target.name, signal); return true
    }, true, { errorState: diagnosticErrorState })
  }
  // 实际节点/日志授权变化才清能力；其他按钮权限更新与目录刷新不清控制台证据。
  watch([node, () => access.value.logs], () => { cancelProviders(); providers.clear(); if (providerAllowed.value) void discoverProviders() }, { immediate: true, flush: 'sync' })
  watch([node, access], () => {
    pauseCatalog(); resetWindow(); file.value = undefined; selectedParents.value = []; parents.value = []; catalogData.value = undefined; catalog.clear()
    if (allowed.value) void roots(false)
  }, { immediate: true })
  watch(providerAllowed, value => { if (!value) cancelProviders(); else if (!providers.data.value) void discoverProviders() })
  watch([tab, active], () => { if (!allowed.value) pauseRequests(); else if (!catalogData.value && catalog.state.value.status !== 'loading') void roots(false) })
  onDeactivated(() => { active.value = false; pauseRequests(); cancelProviders() })
  onActivated(() => { active.value = true; if (allowed.value && !catalogData.value && catalog.state.value.status !== 'loading') void roots(false) })
  onScopeDispose(() => { generation++; catalogGeneration++; cancelProviders(); stop() })
  return { catalog: { ...catalog, data: catalogData, state: catalogState }, providers, discoverProviders, windowQuery, windowData, exportQuery, notice, fileId, file, filePath, selectedParents, filter, following, entries, state, config, configure, parents, roots, refreshCatalog, navigate, read, page, select, parent, follow, search, download, clipped, loadingDirection, consoleAvailable }
}
