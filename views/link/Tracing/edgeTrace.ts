import type { EdgeTraceTarget, RawSpan } from '../../../api/link/diagnostics'
import { nanosText } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'

export interface EdgeTraceResult {
  target: EdgeTraceTarget
  status: 'pending' | 'loading' | 'ready' | 'empty' | 'forbidden' | 'unsupported' | 'error'
  data?: RawSpan[]
  message?: string
}
export const edgeTraceLimit = 8
export const edgeTraceConcurrency = 3

/** 只解析平台现有代理与命令模板；ThingId.toString() 的格式为 type:id。 */
export function edgeTraceTarget(name: string): EdgeTraceTarget | undefined {
  const proxy = /^\/agent-proxy\/([^/]+)\/([^/]+)$/.exec(name)
  const command = /^\/agent-command\/([^/:]+):([^/]+)\/[^/]+(?:\/[^/]+\/_execute|(?:\/[^/]+)?\/metadata)$/.exec(name)
  const thingType = proxy?.[1] ?? command?.[1], thingId = proxy?.[2] ?? command?.[2]
  // 标识始终作为单一路径段编码；拒绝路径、编码与控制字符，避免名称被解释成代理地址。
  if (!thingType || !thingId || !/^[a-zA-Z][\w.-]{0,63}$/.test(thingType)
    || thingId.length > 256 || /[\s/\\%?#\u0000-\u001f\u007f]/.test(thingId) || thingId === '.' || thingId === '..') return
  return { key: JSON.stringify([thingType, thingId]), thingType, thingId }
}

/** 只从平台结果发现直接关联边缘；边缘响应中的同名 Span 不触发递归扫描。 */
export function edgeTraceTargets(spans: RawSpan[]): EdgeTraceTarget[] {
  const targets = new Map<string, EdgeTraceTarget>()
  spans.forEach(span => { const target = edgeTraceTarget(span.name); if (target) targets.set(target.key, target) })
  return [...targets.values()]
}

/** 去除同一 Span 的重复副本；内容冲突仍保留，交给树组件明确显示歧义。 */
export function combinedTraceSpans(tab: { data?: RawSpan[]; edges?: EdgeTraceResult[] }): RawSpan[] {
  const result: RawSpan[] = [], seen = new Set<string>()
  const append = (span: RawSpan, edgeSource?: EdgeTraceTarget) => {
    const fingerprint = JSON.stringify([span.traceId.toLowerCase(), span.spanId, span.parentSpanId, span.name, span.app,
      nanosText(span.startWithNanos, span.startWithNanosText) ?? span.startWithNanos,
      nanosText(span.endWithNanos, span.endWithNanosText) ?? span.endWithNanos, span.attributes, span.events])
    if (seen.has(fingerprint)) return
    seen.add(fingerprint); result.push(edgeSource ? { ...span, edgeSource } : span)
  }
  ;(tab.data ?? []).forEach(span => append(span))
  ;(tab.edges ?? []).forEach(edge => { if (edge.status === 'ready') edge.data?.forEach(span => append(span, edge.target)) })
  return result
}
