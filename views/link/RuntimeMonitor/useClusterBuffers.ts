import { computed, inject, onScopeDispose, provide, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import type { BufferHistorySample, MBeanDescriptor, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeBeanOverview } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { queryBufferMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans } from '../diagnostics/normalize'
import { diagnosticErrorState } from '../diagnostics/status'
import { diagnosticIntervalSeconds, type BufferInterval } from '../diagnostics/preferences'
import { appendBufferEvidence, bufferEvidence, type BufferEvidenceSample } from '../diagnostics/diagnosis/bufferEvidence'

export type BufferQueue = ReturnType<typeof runtimeBeanOverview>['buffers'][number]
export interface ClusterBufferSnapshot {
  beans: MBeanDescriptor[]
  queues: BufferQueue[]
  history: BufferHistorySample[]
  diagnosticHistory?: BufferEvidenceSample[]
  state: ViewState
  pending?: number
  dead?: number
  hasBacklog: boolean
}
interface BufferJob { nodeId: string; dueAt: number; finishedAt?: number; controller?: AbortController; halted?: boolean; suspended?: boolean; counterEpochs: Map<string, number> }
const bufferContext: InjectionKey<ReturnType<typeof useClusterBuffers>> = Symbol('runtime-cluster-buffers')
const emptySnapshot = (): ClusterBufferSnapshot => ({ beans: [], queues: [], history: [], state: { status: 'loading' }, hasBacklog: false })

/** 已知队列缺字段时总量保持未知；一个真实正数足以提示堆积，不推断其他队列为零。 */
export function summarizeBufferQueues(queues: BufferQueue[]) {
  const total = (key: 'pending' | 'dead') => queues.length && queues.every(queue => queue[key] !== undefined)
    ? queues.reduce((sum, queue) => sum + queue[key]!, 0) : undefined
  return { pending: total('pending'), dead: total('dead'), hasBacklog: queues.some(queue => (queue.pending ?? 0) > 0 || (queue.dead ?? 0) > 0) }
}

/** 页面独占集群采样；发现即采、最多三并发、每节点完成后计时，不依赖实时资源或所选工具。 */
export function useClusterBuffers(nodeIds: Ref<string[]>, enabled: Ref<boolean>, scopeKey: Ref<string>, interval: Ref<BufferInterval>, discoveryScope: Ref<string>, permitted: Ref<boolean> = enabled) {
  const snapshots = shallowRef<ReadonlyMap<string, ClusterBufferSnapshot>>(new Map())
  const jobs = new Map<string, BufferJob>(), running = new Set<BufferJob>()
  let timer: ReturnType<typeof setTimeout> | undefined, disposed = false
  // 目录必须已在当前身份下完成发现；scope变更时旧拓扑仍在也不能发新身份请求。
  const canCollect = computed(() => enabled.value && permitted.value && discoveryScope.value === scopeKey.value)
  const intervalMs = () => diagnosticIntervalSeconds(interval.value) * 1000
  function update(nodeId: string, snapshot: ClusterBufferSnapshot) { snapshots.value = new Map([...snapshots.value, [nodeId, snapshot]]) }
  function clear() {
    clearTimeout(timer); timer = undefined
    jobs.forEach(job => job.controller?.abort()); jobs.clear(); running.clear(); snapshots.value = new Map()
  }
  function pause() {
    clearTimeout(timer); timer = undefined
    for (const [nodeId, previous] of jobs) {
      previous.controller?.abort()
      jobs.set(nodeId, { ...previous, controller: undefined, suspended: false, counterEpochs: new Map(previous.counterEpochs) })
      const snapshot = snapshots.value.get(nodeId)
      if (snapshot) update(nodeId, { ...snapshot, diagnosticHistory: appendBufferEvidence(snapshot.diagnosticHistory, { observedAt: Date.now(), queues: [] }) })
    }
    running.clear()
  }
  function append(history: BufferHistorySample[], buffers: BufferHistorySample['buffers'], sampledAt: number) {
    return [...history.filter(sample => sample.sampledAt >= sampledAt - 300000), { sampledAt, buffers }].slice(-301)
  }
  function current(job: BufferJob) { return !disposed && canCollect.value && jobs.get(job.nodeId) === job }
  async function sample(job: BufferJob) {
    const controller = new AbortController(); job.controller = controller; running.add(job)
    try {
      const beans = normalizeMBeans(await queryBufferMBeans(job.nodeId, controller.signal))
      if (!current(job)) return
      const previous = snapshots.value.get(job.nodeId) ?? emptySnapshot(), queues = runtimeBeanOverview(beans).buffers, sampledAt = Date.now()
      const buffers = queues.map(({ objectName, pending, dead, written, attempted }) => ({ objectName,
        ...(pending === undefined ? {} : { pending }), ...(dead === undefined ? {} : { dead }),
        ...(written === undefined ? {} : { written }), ...(attempted === undefined ? {} : { attempted }), counterEpoch: job.counterEpochs.get(objectName) ?? 0 }))
      const incomplete = queues.some(queue => queue.pending === undefined || queue.dead === undefined)
      update(job.nodeId, { beans, queues, history: append(previous.history, buffers, sampledAt), diagnosticHistory: appendBufferEvidence(previous.diagnosticHistory, bufferEvidence(beans, sampledAt, job.counterEpochs)), state: { status: incomplete ? 'stale' : 'ready', sampledAt }, ...summarizeBufferQueues(queues) })
    } catch (error) {
      if (!current(job)) return
      const failure = diagnosticErrorState(error), previous = snapshots.value.get(job.nodeId) ?? emptySnapshot()
      if (['forbidden', 'unsupported'].includes(failure.status)) {
        job.halted = true
        update(job.nodeId, { ...emptySnapshot(), state: failure })
      } else {
        update(job.nodeId, { ...previous, history: append(previous.history, [], Date.now()), diagnosticHistory: appendBufferEvidence(previous.diagnosticHistory, { observedAt: Date.now(), queues: [] }), state: { ...failure, status: previous.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous.state.sampledAt } })
      }
    } finally {
      running.delete(job)
      if (current(job)) { job.controller = undefined; job.finishedAt = Date.now(); job.dueAt = job.finishedAt + intervalMs() }
      pump()
    }
  }
  function pump() {
    clearTimeout(timer); timer = undefined
    if (disposed || !canCollect.value) return
    const now = Date.now()
    // 最早到期优先；稳定排序保留同轮发现FIFO，慢节点不能被前排周期请求饿死。
    const ready = [...jobs.values()].filter(job => !job.halted && !job.suspended && !running.has(job) && job.dueAt <= now).sort((left, right) => left.dueAt - right.dueAt)
    for (const job of ready) {
      if (running.size >= 3) break
      void sample(job)
    }
    if (running.size >= 3) return
    const next = [...jobs.values()].filter(job => !job.halted && !job.suspended && !running.has(job)).map(job => job.dueAt)
    if (next.length) timer = setTimeout(pump, Math.max(0, Math.min(...next) - Date.now()))
  }
  function reconcile() {
    if (!canCollect.value || disposed) return
    const ids = new Set(nodeIds.value.filter(Boolean))
    for (const [nodeId, job] of jobs) if (!ids.has(nodeId)) {
      job.controller?.abort(); jobs.delete(nodeId); running.delete(job)
      const next = new Map(snapshots.value); next.delete(nodeId); snapshots.value = next
    }
    for (const nodeId of ids) if (!jobs.has(nodeId)) {
      jobs.set(nodeId, { nodeId, dueAt: Date.now(), counterEpochs: new Map() }); update(nodeId, emptySnapshot())
    }
    pump()
  }
  function refresh(nodeId: string) {
    if (!canCollect.value) return
    const job = jobs.get(nodeId)
    if (!job || job.suspended || running.has(job)) return
    job.halted = false; job.dueAt = Date.now(); pump()
  }
  /** 重置跨过的在途样本不能成为新基线；仅隔离该节点，已有堆积历史完整保留。 */
  function beginReset(nodeId: string, objectName: string) {
    const previous = jobs.get(nodeId)
    if (!canCollect.value || !previous || previous.suspended || !objectName) return
    const job: BufferJob = { ...previous, controller: undefined, suspended: true, counterEpochs: new Map(previous.counterEpochs) }
    job.counterEpochs.set(objectName, (job.counterEpochs.get(objectName) ?? 0) + 1)
    jobs.set(nodeId, job); previous.controller?.abort(); running.delete(previous); pump()
    const snapshot = snapshots.value.get(nodeId)
    if (snapshot) update(nodeId, { ...snapshot, diagnosticHistory: appendBufferEvidence(snapshot.diagnosticHistory, { observedAt: Date.now(), queues: [] }) })
    let finished = false
    return { finish(success: boolean) {
      if (finished) return
      finished = true
      if (!current(job)) return
      job.suspended = false; job.finishedAt = Date.now(); job.dueAt = success ? Date.now() : job.finishedAt + intervalMs()
      pump()
    } }
  }
  watch([scopeKey, discoveryScope, permitted], () => {
    clear()
    if (permitted.value) reconcile()
  }, { immediate: true, flush: 'sync' })
  watch(canCollect, collecting => { if (collecting) reconcile(); else pause() }, { immediate: true, flush: 'sync' })
  watch(nodeIds, reconcile, { flush: 'sync' })
  watch(interval, () => {
    for (const job of jobs.values()) if (job.finishedAt !== undefined && !running.has(job)) job.dueAt = job.finishedAt + intervalMs()
    pump()
  }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; clear() })
  return { snapshots, refresh, beginReset }
}
export function provideClusterBuffers(...args: Parameters<typeof useClusterBuffers>) {
  const view = useClusterBuffers(...args); provide(bufferContext, view); return view
}
export const useClusterBufferContext = () => inject(bufferContext, undefined)
