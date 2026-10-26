import { createNdJson } from '@jetlinks-web/core'
import { getRequestBaseApi, getRequestHeaders } from '@jetlinks-web-core/utils/request-context'
import { langKey } from '@jetlinks-web-core/utils/consts'
import { map, Observable } from 'rxjs'

/** 沿用平台的分包解码、取消与身份上下文，订阅销毁只释放本页请求。 */
const createDiagnosticsStream = (onRequest?: () => void) => createNdJson({
  langKey,
  handleRequest(config) {
    const headers = new Headers(config.headers)
    Object.entries(getRequestHeaders()).forEach(([key, value]) => headers.set(key, value))
    headers.set('Accept', 'application/x-ndjson')
    // 仅表示本页请求已配置、开始等待响应；不声称远端Recording已经启动。
    onRequest?.()
    return { ...config, baseURL: getRequestBaseApi(), headers }
  },
})

/** 流可返回原始记录或平台信封，失败不能变成正常空快照。 */
export function unwrapDiagnosticRecord<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'success' in value) {
    const envelope = value as { success?: boolean; result?: unknown; message?: string; status?: number }
    if (envelope.success === false) throw Object.assign(new Error(envelope.message || 'Diagnostic request failed'), { status: envelope.status })
    return envelope.result as T
  }
  return value as T
}

export function streamDiagnostic<T>(nodeId: string, kind: 'thread' | 'jfr', signal?: AbortSignal, events: { onRequest?: () => void } = {}): Observable<T> {
  return new Observable<T>(observer => {
    const aborted = () => observer.error(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) { aborted(); return }
    signal?.addEventListener('abort', aborted, { once: true })
    const parameters = kind === 'jfr' ? { configurationName: 'profile' } : {}
    const subscription = createDiagnosticsStream(events.onRequest).post(`/system/monitor/${kind}/realtime?serverId=${encodeURIComponent(nodeId)}`, parameters, { signal })
      .pipe(map(value => unwrapDiagnosticRecord<T>(value))).subscribe(observer)
    // SDK版本之间的signal合并行为不同；外部取消始终unsubscribe，释放本页reader。
    return () => { signal?.removeEventListener('abort', aborted); subscription.unsubscribe() }
  })
}

/** 线程接口是有限流，必须收集完成的全部记录，不能把首个线程当整份快照。 */
export function collectDiagnosticStream<T>(source: Observable<T>, signal: AbortSignal): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = []
    let subscription: { unsubscribe(): void } | undefined
    const aborted = () => { subscription?.unsubscribe(); reject(new DOMException('Aborted', 'AbortError')) }
    if (signal.aborted) { aborted(); return }
    signal.addEventListener('abort', aborted, { once: true })
    subscription = source.subscribe({
      next: row => Array.isArray(row) ? rows.push(...row) : rows.push(row),
      error: error => { signal.removeEventListener('abort', aborted); reject(error) },
      complete: () => { signal.removeEventListener('abort', aborted); resolve(rows) },
    })
    if (signal.aborted) aborted()
  })
}
