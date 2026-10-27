import { nanosBetween, nanosText } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { formatTraceDuration } from '@jetlinks-web-core/components/RuntimeDiagnostics/tracePresentation'
import type { TraceWorkspaceTab } from './useTraceWorkspace'

/** 最近记录与正文共用耗时格式；精确文本优先，未结束和无效区间不作为耗时证据。 */
export function traceRecentDuration(tab: TraceWorkspaceTab, locale = 'en'): string | undefined {
  const ranges = (tab.data ?? []).map(span => [nanosText(span.startWithNanos, span.startWithNanosText), nanosText(span.endWithNanos, span.endWithNanosText)] as const)
    .filter((range): range is [string, string] => range[0] !== undefined && range[1] !== undefined && BigInt(range[1]) > 0n && BigInt(range[1]) >= BigInt(range[0]))
  if (!ranges.length) return undefined
  const start = ranges.reduce((value, range) => BigInt(range[0]) < BigInt(value) ? range[0] : value, ranges[0][0])
  const end = ranges.reduce((value, range) => BigInt(range[1]) > BigInt(value) ? range[1] : value, ranges[0][1])
  return formatTraceDuration(nanosBetween(start, end), locale)
}

export const traceStateKey = (tab: TraceWorkspaceTab) => `Tracing.recentState.${tab.state.status}`
