import { defineStore, storeToRefs } from 'pinia'
import { getCurrentInstance, onDeactivated, onScopeDispose, watch } from 'vue'
import { queryTrace } from '../api/link/diagnostics'
import { useDiagnosticScope } from '../views/link/diagnostics/useDiagnosticScope'
import { useDiagnosticsAccess } from '../views/link/diagnostics/useDiagnosticsAccess'
import { diagnosticErrorState } from '../views/link/diagnostics/status'
import { useTraceWorkspace } from '../views/link/Tracing/useTraceWorkspace'

/** 仅保留本次排查的有界内存证据，页面卸载不会抹掉其他对比链路。 */
const useTraceWorkspaceStore = defineStore('device-manager-trace-workspace', () => {
  const scope = useDiagnosticScope(), access = useDiagnosticsAccess()
  const workspace = useTraceWorkspace({ load: queryTrace, errorState: diagnosticErrorState, allowed: () => !!scope.value.accountId && access.value.trace })
  // 由 Store 持有观察者：离页后登出、换项目或撤权也须立即清理，迟到结果不可回写。
  watch([() => scope.value.accountId, () => scope.value.projectId, () => access.value.trace], workspace.reset, { flush: 'sync' })
  return workspace
})

/** 页面只持有会话的阅读权；离页取消未完成请求，返回由当前 URL 恢复活动标签。 */
export function useTraceSession() {
  const store = useTraceWorkspaceStore()
  onScopeDispose(store.suspend)
  if (getCurrentInstance()) onDeactivated(store.suspend)
  return {
    ...storeToRefs(store), limit: store.limit,
    open: store.open, newQuery: store.newQuery, showDraft: store.showDraft, activate: store.activate, close: store.close,
    refresh: store.refresh, reset: store.reset, suspend: store.suspend, resume: store.resume,
  }
}
