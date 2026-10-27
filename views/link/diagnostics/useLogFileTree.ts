import { computed, onScopeDispose, ref, shallowRef, type Ref } from 'vue'
import type { LogFile, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { logChildren, logEntries } from '../../../api/link/diagnostics'
import { logFileKey, sortLogCatalog } from './logCatalog'
import { diagnosticErrorState } from './status'

interface Branch { files?: LogFile[]; state: ViewState }
export interface LogFileTreeNode {
  key: string
  title: string
  file?: LogFile
  isLeaf: boolean
  selectable: boolean
  children?: LogFileTreeNode[]
  branchKey?: string
  state?: ViewState
}

export const isLogDirectory = (file: LogFile) => !!file.directory || /\.zip$/i.test(file.name) && !file.entry

/** 节点内的目录缓存；分支并行加载互不覆盖，折叠与隐藏不销毁已确认目录。 */
export function useLogFileTree(node: Ref<string>, allowed: Ref<boolean>) {
  const roots = shallowRef<LogFile[]>([]), branches = shallowRef<Record<string, Branch>>({}), expandedKeys = ref<string[]>([])
  const pending = new Map<string, { controller: AbortController; promise: Promise<LogFile[]> }>()
  let generation = 0
  function locate(key: string, files = roots.value, parents: LogFile[] = []): { file: LogFile; parents: LogFile[] } | undefined {
    for (const file of files) {
      const current = logFileKey(file)
      if (current === key) return { file, parents }
      if (!parents.some(parent => logFileKey(parent) === current)) {
        const found = locate(key, branches.value[current]?.files ?? [], [...parents, file])
        if (found) return found
      }
    }
  }
  function setRoots(files: LogFile[]) { roots.value = sortLogCatalog(files) }
  function setExpanded(keys: Array<string | number>) { expandedKeys.value = keys.map(String) }
  function reveal(parents: LogFile[]) { setExpanded([...new Set([...expandedKeys.value, ...parents.map(logFileKey)])]) }
  function patch(key: string, branch: Branch) { branches.value = { ...branches.value, [key]: branch } }
  /** 所有调用方共享同一分支请求；只使用已发现的服务端文件身份，不从文件名拼接路径。 */
  function load(key: string, refresh = false): Promise<LogFile[]> {
    const target = locate(key)?.file
    if (!allowed.value || !target || !isLogDirectory(target)) return Promise.reject(new Error('Log directory unavailable'))
    const running = pending.get(key)
    if (running) return running.promise
    const previous = branches.value[key]
    if (!refresh && previous?.files && ['ready', 'empty'].includes(previous.state.status)) return Promise.resolve(previous.files)
    const controller = new AbortController(), current = generation, nodeId = node.value
    patch(key, { ...previous, state: { status: 'loading' } })
    const promise = Promise.resolve().then(async () => {
      try {
        const files = target.directory ? await logChildren(nodeId, target, controller.signal)
          : (await logEntries(nodeId, target, controller.signal)).map(entry => ({ ...target, entry, name: entry, exportName: target.name }))
        if (controller.signal.aborted || current !== generation || !allowed.value || nodeId !== node.value) throw new DOMException('Aborted', 'AbortError')
        const sorted = sortLogCatalog(files)
        patch(key, { files: sorted, state: { status: sorted.length ? 'ready' : 'empty' } })
        return sorted
      } catch (error) {
        if (!controller.signal.aborted && current === generation && allowed.value) patch(key, { ...previous, state: diagnosticErrorState(error) })
        throw error
      } finally { if (pending.get(key)?.controller === controller) pending.delete(key) }
    })
    pending.set(key, { controller, promise })
    return promise
  }
  function cancel() {
    generation++
    const next = { ...branches.value }
    for (const [key, request] of pending) {
      request.controller.abort()
      const branch = branches.value[key]
      if (branch?.files) next[key] = { files: branch.files, state: { status: branch.files.length ? 'ready' : 'empty' } }
      else delete next[key]
    }
    branches.value = next
    pending.clear()
  }
  function clear() { cancel(); roots.value = []; branches.value = {}; expandedKeys.value = [] }
  async function refreshExpanded() {
    // 只刷新展开的目录，串行读取避免一次刷新对节点突发大量请求。
    for (const key of [...expandedKeys.value]) { if (!allowed.value) break; if (locate(key)) await load(key, true).catch(() => undefined) }
  }
  function treeNodes(files: LogFile[], ancestors: Set<string> = new Set()): LogFileTreeNode[] {
    return files.filter(file => !ancestors.has(logFileKey(file))).map(file => {
      const key = logFileKey(file), directory = isLogDirectory(file), branch = branches.value[key]
      let children = directory && branch?.files ? treeNodes(branch.files, new Set([...ancestors, key])) : undefined
      if (directory && branch && ['error', 'forbidden', 'unsupported', 'empty'].includes(branch.state.status)) {
        children ??= []
        children.push({ key: `${key}:status`, title: '', isLeaf: true, selectable: false, branchKey: key, state: branch.state })
      }
      return { key, title: file.name, file, isLeaf: !directory, selectable: !directory, children: directory && branch ? children ?? [{ key: `${key}:status`, title: '', isLeaf: true, selectable: false, branchKey: key, state: branch.state }] : undefined }
    })
  }
  const nodes = computed(() => treeNodes(roots.value))
  const loadedKeys = computed(() => Object.entries(branches.value).filter(([, branch]) => ['ready', 'empty'].includes(branch.state.status)).map(([key]) => key))
  onScopeDispose(cancel)
  return { roots, nodes, expandedKeys, loadedKeys, locate, setRoots, setExpanded, reveal, load, cancel, clear, refreshExpanded }
}
