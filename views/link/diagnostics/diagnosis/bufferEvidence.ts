import type { MBeanDescriptor } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { gaugeCount } from '../overview/gaugeHistory'

export interface BufferEvidence {
  objectName: string; name: string; epoch: number
  pending?: string; dead?: string; written?: string; attempted?: string; dropped?: string
  operations?: string; slowOperations?: string; writerPending?: string; writerFallback?: string; lastError?: string
}
export interface BufferEvidenceSample { observedAt: number; queues: BufferEvidence[] }
const maximumLong = 9223372036854775807n
function counter(value: unknown) {
  const count = gaugeCount(value)
  return count !== undefined && BigInt(count) <= maximumLong ? count : undefined
}

/** 有界读取 Monitor 的生产者格式；out 是处理尝试，耗时桶是已结束批次，均不代表成功。 */
export function monitorEvidence(value: unknown) {
  if (typeof value !== 'string' || value.length > 16384) return {}
  const queue = /(?:^|;)\s*queue\(in (\d+),out (\d+),dropped (\d+)\);/.exec(value)
  const consume = /(?:^|;)\s*consume\(opt (\d+),cost (\d+) ms\);/.exec(value)
  const distribution = /dist\[0-50ms\((\d+)\),50-200ms\((\d+)\),0\.2-1s\((\d+)\),1-5s\((\d+)\),>5s\((\d+)\)\]/.exec(value)
  const slow = distribution ? [counter(distribution[4]), counter(distribution[5])] : []
  return {
    written: counter(queue?.[1]), attempted: counter(queue?.[2]), dropped: counter(queue?.[3]),
    operations: counter(consume?.[1]),
    slowOperations: slow.length === 2 && slow.every(value => value !== undefined) ? (BigInt(slow[0]!) + BigInt(slow[1]!)).toString() : undefined,
  }
}

/** 诊断与图表共享同一请求及 reset 代次；缺失属性保持未知，不补零或读昂贵操作。 */
export function bufferEvidence(beans: readonly MBeanDescriptor[], observedAt: number, epochs: ReadonlyMap<string, number>): BufferEvidenceSample {
  return { observedAt, queues: beans.filter(bean => bean.domain === 'org.jetlinks' && bean.type === 'PersistenceBuffer').map(bean => {
    const attribute = (name: string) => bean.attributes.find(item => item.name === name && item.available)?.value
    const error = attribute('LastError')
    return { objectName: bean.objectName, name: bean.name, epoch: epochs.get(bean.objectName) ?? 0,
      pending: counter(attribute('Remainder')), dead: counter(attribute('DeadSize')),
      writerPending: counter(attribute('WriterPending')), writerFallback: counter(attribute('WriterFallback')),
      lastError: typeof error === 'string' && error.trim() && error.trim() !== 'nil' ? error : undefined,
      ...monitorEvidence(attribute('Monitor')) }
  }) }
}

/** 本页证据有界；空队列样本表示缺测或暂停边界，不能跨越求差。 */
export function appendBufferEvidence(history: readonly BufferEvidenceSample[] = [], sample: BufferEvidenceSample): BufferEvidenceSample[] {
  return [...history.filter(point => point.observedAt > sample.observedAt - 300000 && point.observedAt < sample.observedAt), sample].slice(-128)
}
