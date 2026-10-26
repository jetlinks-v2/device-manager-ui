import { bufferHistoryPoints, bufferThroughputPoints, type BufferHistorySample } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { BufferQueue, ClusterBufferSnapshot } from './useClusterBuffers'

interface BufferWindow { from: number; to: number; seconds: number }
interface BufferObservation { pendingDelta?: number; writtenRate?: number; attemptedRate?: number; window?: BufferWindow }
export type NodeBufferQueue = BufferQueue
export interface NodeBufferOverview extends BufferObservation {
  pending?: number; dead?: number
  queues: NodeBufferQueue[]; firstSample: boolean; backlogQueues: number
}

/** 用已展示证据的真实采样时间定位窗口，过期快照仍展示原窗口，不跨过失败点。 */
function observation(history: readonly BufferHistorySample[], sampledAt: number | undefined, objectName?: string): BufferObservation {
  if (!sampledAt) return {}
  const ordered = bufferHistoryPoints(history, objectName)
  const index = ordered.findIndex(point => point.sampledAt === sampledAt), previousPoint = ordered[index - 1]
  if (!previousPoint) return {}
  const previous = history.findLast(sample => sample.sampledAt === previousPoint.sampledAt)!
  const current = history.findLast(sample => sample.sampledAt === sampledAt)!
  const selected = (sample: BufferHistorySample) => sample.buffers.filter(queue => !objectName || queue.objectName === objectName)
  const previousQueues = selected(previous), before = new Map(previousQueues.map(queue => [queue.objectName, queue]))
  const queues = selected(current)
  const rates = bufferThroughputPoints(history, objectName).find(rate => rate.sampledAt === sampledAt)
  const sameEpoch = queues.length > 0 && queues.length === before.size && previousQueues.length === before.size && queues.length === new Set(queues.map(queue => queue.objectName)).size && queues.every(queue => {
    const old = before.get(queue.objectName)
    return old && (queue.counterEpoch === undefined || Number.isSafeInteger(queue.counterEpoch) && queue.counterEpoch >= 0) && queue.counterEpoch === old.counterEpoch
  })
  // 有精确计数但共享速率算法拒绝窗口，表示倒退或无效计数；待处理增减也不能跨越该边界。
  const comparableCounter = (key: 'written' | 'attempted', rate: number | undefined) =>
    ![...queues, ...before.values()].some(queue => queue[key] !== undefined) || rate !== undefined
  const comparable = sameEpoch && comparableCounter('written', rates?.writtenRate) && comparableCounter('attempted', rates?.attemptedRate)
  const [beforeCount, currentCount] = bufferHistoryPoints([previous, current], objectName)
  const pendingDelta = comparable && currentCount?.pending !== undefined && beforeCount?.pending !== undefined ? currentCount.pending - beforeCount.pending : undefined
  const hasRate = rates?.writtenRate !== undefined || rates?.attemptedRate !== undefined
  return { pendingDelta, writtenRate: rates?.writtenRate, attemptedRate: rates?.attemptedRate,
    window: hasRate || pendingDelta !== undefined ? { from: previousPoint.sampledAt, to: sampledAt, seconds: (sampledAt - previousPoint.sampledAt) / 1000 } : undefined }
}

/** 默认仅列最多两个异常队列，保留最大堆积与失败代表；速率统一在节点汇总展示。 */
export function nodeBufferOverview(snapshot: ClusterBufferSnapshot): NodeBufferOverview {
  const queues = snapshot.queues.filter(queue => (queue.pending ?? 0) > 0 || (queue.dead ?? 0) > 0)
  const ordered = [...queues].sort((left, right) => (right.pending ?? -1) - (left.pending ?? -1) || (right.dead ?? -1) - (left.dead ?? -1))
  const priority = ordered.slice(0, 2)
  const failed = [...queues].filter(queue => (queue.dead ?? 0) > 0).sort((left, right) => right.dead! - left.dead!)[0]
  if (failed && !priority.includes(failed)) priority[priority.length - 1] = failed
  return { ...observation(snapshot.history, snapshot.state.sampledAt), pending: snapshot.pending, dead: snapshot.dead,
    queues: priority, firstSample: snapshot.history.length < 2, backlogQueues: queues.length }
}

export const bufferQuantity = (value: number) => value.toLocaleString()
export const bufferRate = (value: number) => value > 0 && value < 0.01 ? '<0.01' : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
