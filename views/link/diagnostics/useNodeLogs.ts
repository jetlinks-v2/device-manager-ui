import { computed, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { LogFile, LogDisplayConfig, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { logRoots, readLog, statLog, downloadLog, saveDiagnosticFile, type LogWindow } from '../../../api/link/diagnostics'
import { entriesForLogWindows, joinedLogWindow, mergeLogWindows } from './logWindows'
import { latestLogFile, logFileKey, sortLogCatalog } from './logCatalog'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import { diagnosticErrorState } from './status'
import { isLogDirectory, useLogFileTree } from './useLogFileTree'

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
  let lastWindowState: ViewState = { status: 'ready' }
  let providerGeneration = 0, providerRequest: Promise<LogFile[] | undefined> | undefined
  const active = ref(true)
  const allowed = computed(() => active.value && access.value.logs && tab.value === 'logs' && !!node.value)
  const providerAllowed = computed(() => active.value && enabled.value && access.value.logs && !!node.value)
  const tree = useLogFileTree(node, allowed), selectingKey = ref(''), selectionFailed = ref(false)
  const catalogState = computed(() => !catalogData.value && !providers.data.value ? providers.state.value : catalog.state.value)
  const entries = computed(() => entriesForLogWindows(chunks.value))
  const state = computed<ViewState>(() => {
    if (!access.value.logs) return { status: 'forbidden' }
    const current = windowQuery.state.value
    if (!windowData.value) return current
    // 新文件的拒绝属于切换失败，不能把已成功读取的另一文件误判为失去权限。
    if (selectionFailed.value) return { status: 'stale', message: current.message }
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
  function pauseRequests() { generation++; pause(); selectingKey.value = ''; loadingDirection.value = ''; windowQuery.cancel(); pauseCatalog(); tree.cancel(); exportQuery.cancel() }
  function resetWindow() { generation++; pause(); windowData.value = undefined; chunks.value = []; clipped.value = false; loadingDirection.value = ''; selectionFailed.value = false; lastWindowState = { status: 'ready' }; windowQuery.clear(); exportQuery.clear(); notice.value = ''; lastSize = undefined }
  async function read(position?: number, direction = 'backward', follow = false, merge = false, selection?: { file: LogFile; parents: LogFile[] }) {
    stop()
    const target = selection?.file ?? file.value, current = ++generation, targetNode = node.value
    if (!target || target.directory || !allowed.value) return
    selectionFailed.value = false
    selectingKey.value = selection ? logFileKey(target) : ''
    let rotated = false
    let nextSize: number | undefined
    loadingDirection.value = merge ? direction : ''
    await windowQuery.run(async signal => {
      const stat = await statLog(targetNode, target, signal)
      rotated = !selection && lastSize !== undefined && stat.size !== undefined && stat.size < lastSize
      const result = await readLog(targetNode, target, signal, rotated ? undefined : position, rotated ? 'backward' : direction)
      if (!signal.aborted) nextSize = stat.size
      return result
    }, true, { errorState: diagnosticErrorState })
    if (current !== generation || !allowed.value || follow && !following.value) return
    selectingKey.value = ''
    loadingDirection.value = ''
    const result = windowQuery.data.value
    if (result) {
      lastWindowState = { ...windowQuery.state.value }
      if (selection) {
        pause(); file.value = target; selectedParents.value = [...selection.parents]
        chunks.value = []; windowData.value = undefined; clipped.value = false; notice.value = ''; exportQuery.clear()
        tree.reveal(selection.parents)
      }
      lastSize = nextSize
      if (rotated || !merge && windowData.value && result.endPosition < windowData.value.endPosition) notice.value = t('RuntimeMonitor.logRotated')
      const next = mergeLogWindows(chunks.value, result, merge && !rotated ? direction === 'forward' ? 'forward' : 'backward' : undefined)
      chunks.value = next.chunks; clipped.value = merge && !rotated ? clipped.value || next.clipped : next.clipped
      windowData.value = joinedLogWindow(chunks.value)
    } else {
      pause()
      selectionFailed.value = !!selection
      if (!selection && ['forbidden', 'unsupported'].includes(windowQuery.state.value.status)) {
        const failure = windowQuery.state.value
        resetWindow(); windowQuery.clear(failure)
      }
    }
    schedule()
    return !!result
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
      if (current === providerGeneration && providerAllowed.value && providers.state.value.status === 'ready') {
        tree.setRoots(providers.data.value ?? [])
        return providers.data.value
      }
      if (current === providerGeneration && ['forbidden', 'unsupported'].includes(providers.state.value.status)) tree.clear()
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
    await catalog.run(async signal => { selected = await latestLogFile(node.value, roots, signal, (_node, directory) => tree.load(logFileKey(directory), refresh)); return selected?.siblings ?? roots }, true, { errorState: diagnosticErrorState, retainData: true })
    if (current !== catalogGeneration || !allowed.value || file.value || !selected || catalog.state.value.status !== 'ready') return
    parents.value = selected.parents; catalogData.value = sortLogCatalog(selected.siblings)
    await read(undefined, 'backward', false, false, selected)
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
  function children(target: LogFile) {
    return tree.load(logFileKey(target), true)
  }
  async function select(key: string) {
    if (!allowed.value) return
    const location = tree.locate(key), target = location?.file
    if (!location || !target) return
    if (isLogDirectory(target)) {
      await navigateCatalog([...location.parents, target], () => children(target))
      return false
    }
    pauseCatalog()
    if (fileId.value === key) {
      // 点回当前文件意味着取消尚未提交的切换，迟到响应不得再替换正文。
      if (selectingKey.value || selectionFailed.value) { generation++; windowQuery.clear(lastWindowState); selectingKey.value = ''; loadingDirection.value = '' }
      selectionFailed.value = false
      return true
    }
    pause()
    return await read(undefined, 'backward', false, false, location)
  }
  async function parent() {
    return navigate(parents.value.length - 2)
  }
  async function navigate(index: number) {
    if (!allowed.value) return
    const nextParents = parents.value.slice(0, Math.max(0, index + 1)), target = nextParents.at(-1)
    if (!target) return roots()
    await navigateCatalog(nextParents, () => children(target))
  }
  function refreshCatalog() { return navigate(parents.value.length - 1) }
  async function refreshTree() { if (await discoverProviders(true)) await tree.refreshExpanded() }
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
  watch([node, () => access.value.logs], () => {
    pauseCatalog(); tree.clear(); resetWindow(); selectingKey.value = ''; file.value = undefined; selectedParents.value = []; parents.value = []; catalogData.value = undefined; catalog.clear()
    if (allowed.value) void roots(false)
  }, { immediate: true })
  watch(providerAllowed, value => { if (!value) cancelProviders(); else if (!providers.data.value) void discoverProviders() })
  watch([tab, active], () => { if (!allowed.value) pauseRequests(); else if (!catalogData.value && catalog.state.value.status !== 'loading') void roots(false) })
  onDeactivated(() => { active.value = false; pauseRequests(); cancelProviders() })
  onActivated(() => { active.value = true; if (allowed.value && !catalogData.value && catalog.state.value.status !== 'loading') void roots(false) })
  onScopeDispose(() => { generation++; catalogGeneration++; cancelProviders(); stop() })
  return { catalog: { ...catalog, data: catalogData, state: catalogState }, providers, discoverProviders, tree, selectingKey, refreshTree, windowQuery, windowData, exportQuery, notice, fileId, file, filePath, selectedParents, filter, following, entries, state, config, configure, parents, roots, refreshCatalog, navigate, read, page, select, parent, follow, search, download, clipped, loadingDirection, consoleAvailable }
}
