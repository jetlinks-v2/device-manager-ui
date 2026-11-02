import { Observable } from 'rxjs'
import { createDiagnosticsStream, unwrapDiagnosticRecord } from './diagnosticStream'

export interface MBeanCollectionQuery { id: string; nodeIds: string[]; name: string; attributes: string[] }
export interface MBeanCollectionPlan { interval?: string; queries: MBeanCollectionQuery[] }
export interface MBeanCollectionBean {
  objectName: string; domain: string; beanType: string; name: string
  values: Record<string, unknown>; unavailableAttributes: string[]
  operations?: Array<Record<string, unknown>> | null
}
export interface MBeanCollectionSample {
  type: 'sample'; queryId: string; nodeId: string; sequence: number; collectedAt: number
  status: 'ready' | 'unsupported' | 'error' | 'forbidden'; beans: MBeanCollectionBean[]
}
export type MBeanCollectionRecord = MBeanCollectionSample | { type: 'heartbeat'; collectedAt: number }

/** 页面持续消费复用平台 NDJSON reader；普通 JSON 单轮调用方仍可直接使用同一后端接口。 */
export function streamMBeanCollection(plan: MBeanCollectionPlan): Observable<MBeanCollectionRecord> {
  return new Observable(observer => {
    const subscription = createDiagnosticsStream().post('/system/monitor/mbean/_batch', { ...plan }).subscribe({
      next(value) {
        try { observer.next(unwrapDiagnosticRecord<MBeanCollectionRecord>(value)) }
        catch (error) { observer.error(error) }
      },
      error: error => observer.error(error),
      complete: () => observer.complete(),
    })
    return () => subscription.unsubscribe()
  })
}
