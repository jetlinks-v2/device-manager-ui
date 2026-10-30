import { getCurrentInstance, inject, onScopeDispose, provide, watch, type InjectionKey, type Ref } from 'vue'
import { loadResourceOverviewHistory } from '../../../../visDashboard/SystemMonitor/services/history'
import type { MonitorTimeRange } from '../../../../visDashboard/SystemMonitor/types'

type ResourceHistory = Awaited<ReturnType<typeof loadResourceOverviewHistory>>
export interface ResourceHistorySnapshot {
  history: ResourceHistory
  range: MonitorTimeRange
  relativeSeconds?: number
  sampledAt: number
}
interface HistoryJob {
  key: string
  controller: AbortController
  consumers: Set<symbol>
  promise: Promise<ResourceHistorySnapshot>
}
const context: InjectionKey<ReturnType<typeof createResourceHistoryCache>> = Symbol('runtime-resource-history')
const cancelled = () => new DOMException('History request cancelled', 'AbortError')

/** 页面只保留一份全群历史；相对范围在一分钟历史桶内复用，显式刷新始终重新读取。 */
export function createResourceHistoryCache(loader = loadResourceOverviewHistory) {
  let completed: (ResourceHistorySnapshot & { key: string }) | undefined, pending: HistoryJob | undefined
  function cancel() { const job = pending; pending = undefined; job?.controller.abort() }
  function clear() { completed = undefined; cancel() }
  function consume(job: HistoryJob, signal: AbortSignal): Promise<ResourceHistorySnapshot> {
    return new Promise((resolve, reject) => {
      const consumer = Symbol(); job.consumers.add(consumer)
      const cleanup = () => { job.consumers.delete(consumer); signal.removeEventListener('abort', abort) }
      const abort = () => {
        cleanup()
        if (!job.consumers.size && pending === job) cancel()
        reject(cancelled())
      }
      if (signal.aborted) { abort(); return }
      signal.addEventListener('abort', abort, { once: true })
      job.promise.then(result => { cleanup(); if (!signal.aborted) resolve(result) }, error => { cleanup(); reject(error) })
    })
  }
  function load(range: MonitorTimeRange, signal: AbortSignal, relativeSeconds?: number, force = false): Promise<ResourceHistorySnapshot> {
    if (signal.aborted) return Promise.reject(cancelled())
    const key = relativeSeconds === undefined ? JSON.stringify(range.map(date => date.valueOf())) : `relative:${relativeSeconds}`
    if (!force && completed?.key === key && Date.now() - completed.sampledAt < 60000) return Promise.resolve(completed)
    if (!force && pending?.key === key) return consume(pending, signal)
    cancel()
    // 刷新失败不得再以之前的成功缓存掩盖权限拒绝或网络失败。
    completed = undefined
    const controller = new AbortController()
    const job: HistoryJob = { key, controller, consumers: new Set(), promise: Promise.resolve().then(async () => {
      const history = await loader(range, controller.signal)
      if (pending !== job || controller.signal.aborted) throw cancelled()
      const result = { key, history, range, relativeSeconds, sampledAt: Date.now() }
      completed = result
      return result
    }).finally(() => { if (pending === job) pending = undefined }) }
    pending = job
    return consume(job, signal)
  }
  return { load, cancel, clear }
}

/** 账号 / 项目 / 查询撤权同步清空；暂停只中止读取，同身份已完成证据仍可复用。 */
export function provideResourceHistoryCache(scope: Ref<string>, permitted: Ref<boolean>, active: Ref<boolean>) {
  const cache = createResourceHistoryCache()
  watch([scope, permitted], cache.clear, { flush: 'sync' })
  watch(active, value => { if (!value) cache.cancel() }, { flush: 'sync' })
  onScopeDispose(cache.clear)
  provide(context, cache)
  return cache
}
export const useResourceHistoryCache = () => getCurrentInstance() ? inject(context, undefined) : undefined

/** 节点 KeepAlive 仅保留本节点数据，全群副本由页面缓存独占。 */
export function selectNodeResourceHistory(history: ResourceHistory, nodeId: string): ResourceHistory {
  const pick = <T>(series: Record<string, T>): Record<string, T> => series[nodeId] === undefined ? {} : { [nodeId]: series[nodeId] }
  return {
    cpuSystem: history.cpuSystem.filter(series => series.nodeId === nodeId),
    cpuJvm: history.cpuJvm.filter(series => series.nodeId === nodeId),
    memorySystem: history.memorySystem.filter(series => series.nodeId === nodeId),
    memoryJvm: history.memoryJvm.filter(series => series.nodeId === nodeId),
    traffic: { ...history.traffic, nodes: history.traffic.nodes.filter(id => id === nodeId), series: {
      trafficUp: pick(history.traffic.series.trafficUp), trafficDown: pick(history.traffic.series.trafficDown),
    } },
    network: { nodes: history.network.nodes.filter(id => id === nodeId), series: {
      hostReceive: pick(history.network.series.hostReceive), hostSend: pick(history.network.series.hostSend),
      packetLoss: pick(history.network.series.packetLoss), interfaceErrors: pick(history.network.series.interfaceErrors),
      tcpRetransmission: pick(history.network.series.tcpRetransmission), tcpConnections: pick(history.network.series.tcpConnections),
    } },
  }
}
