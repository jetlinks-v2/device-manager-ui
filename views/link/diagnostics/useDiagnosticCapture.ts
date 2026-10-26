import { ref, watch, type Ref } from 'vue'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import { captureDiagnostic, saveDiagnosticFile } from '../../../api/link/diagnostics'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { diagnosticErrorState } from './status'

/** 采集与下载沿用一个请求，切换目标会取消客户端请求且不会重试副作用。 */
export function useDiagnosticCapture(nodeId: Ref<string>) {
  const access = useDiagnosticsAccess()
  const operation = useDiagnosticQuery<boolean>()
  const seconds = ref(10)
  watch([nodeId, access], () => operation.clear(), { flush: 'sync' })
  function capture(kind: 'jfr' | 'heap-dump', live = false) {
    if (operation.state.value.status === 'loading') return
    const target = nodeId.value
    return operation.run(async signal => {
      const result = await captureDiagnostic(target, kind, seconds.value, signal, live)
      if (signal.aborted) return false
      await saveDiagnosticFile(result, `${kind}-${target}-${Date.now()}.${kind === 'jfr' ? 'jfr' : 'hprof'}`, signal)
      return true
    }, !!target && (kind === 'jfr' ? access.value.exportJfr : access.value.heap), { errorState: diagnosticErrorState })
  }
  return { operation, seconds, capture }
}
