import i18n from '@jetlinks-web-core/locales'
import type { ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'

/** 已有证据的只读更新不重建正文；权限/能力拒绝始终由原始状态显式阻断。 */
export function diagnosticContentState(state: ViewState, hasEvidence: boolean): ViewState {
  if (!hasEvidence) return state
  if (state.status === 'loading') return { ...state, status: 'ready' }
  if (state.status === 'error') return { ...state, status: 'stale' }
  return state
}

/** 同时适配平台HTTP异常、NDJSON Response和失败信封，404不伪装成空结果。 */
export function diagnosticErrorState(error: unknown): ViewState {
  const value = error as { status?: number; code?: number; response?: { status?: number }; message?: string } | null
  const status = Number(value?.response?.status ?? value?.status ?? value?.code)
  if (status === 403 || status === 401) return { status: 'forbidden', message: i18n.global.t('runtimeDiagnostics.forbidden') }
  if (status === 404 || status === 501) return { status: 'unsupported', message: i18n.global.t('RuntimeMonitor.capabilityUnavailable') }
  return { status: 'error', message: value?.message || i18n.global.t('runtimeDiagnostics.failed') }
}
