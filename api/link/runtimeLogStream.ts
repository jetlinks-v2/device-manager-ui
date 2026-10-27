import { wsClient } from '@jetlinks-web/core'
import { Observable } from 'rxjs'

export interface RuntimeLogRecord { timestamp?: number; level?: string; message?: string; exceptionStack?: string; attributes?: Record<string, unknown> }
let sequence = 0

/** 复用平台已授权日志订阅；取消仅释放本订阅，不修改全局 socket 或错误回调。 */
export function runtimeLogStream(node: string): Observable<RuntimeLogRecord> {
  return new Observable(observer => wsClient.getWebSocket(`runtime-console-${++sequence}`, `/system/log/${node}/java/runtime`, {})
    .subscribe({
      next(message) {
        if (message.type === 'error') { observer.error(Object.assign(new Error(message.message || 'Log subscription failed'), { status: message.status })); return }
        const value = message.payload
        if (value && typeof value === 'object' && typeof value.message === 'string') observer.next(value as RuntimeLogRecord)
      },
      error: error => observer.error(error), complete: () => observer.complete(),
    }))
}
