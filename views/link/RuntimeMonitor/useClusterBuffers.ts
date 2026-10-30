import { computed, inject, onScopeDispose, provide, shallowReactive, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import type { BufferHistorySample, MBeanDescriptor, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeBeanOverview } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { normalizeMBeans } from '../diagnostics/normalize'
import { diagnosticErrorState } from '../diagnostics/status'
import type { BufferInterval } from '../diagnostics/preferences'
import { appendBufferEvidence, bufferEvidence, type BufferEvidenceSample } from '../diagnostics/diagnosis/bufferEvidence'
import { useMBeanCollection } from '../diagnostics/collection/useMBeanCollection'

export type BufferQueue = ReturnType<typeof runtimeBeanOverview>['buffers'][number]
export interface ClusterBufferSnapshot {
  beans: MBeanDescriptor[]; queues: BufferQueue[]; history: BufferHistorySample[]
  diagnosticHistory?: BufferEvidenceSample[]; state: ViewState; pending?: number; dead?: number; hasBacklog: boolean
}
const bufferContext: InjectionKey<ReturnType<typeof useClusterBuffers>> = Symbol('runtime-cluster-buffers')
const emptySnapshot = (): ClusterBufferSnapshot => ({ beans: [], queues: [], history: [], state: { status: 'loading' }, hasBacklog: false })

/** 已知队列缺字段时总量保持未知；一个真实正数足以提示堆积，不推断其他队列为零。 */
export function summarizeBufferQueues(queues: BufferQueue[]) {
  const total = (key: 'pending' | 'dead') => queues.length && queues.every(queue => queue[key] !== undefined)
    ? queues.reduce((sum, queue) => sum + queue[key]!, 0) : undefined
  return { pending: total('pending'), dead: total('dead'), hasBacklog: queues.some(queue => (queue.pending ?? 0) > 0 || (queue.dead ?? 0) > 0) }
}

/** 集群 Buffer 只声明投影；页面管理器拥有周期和传输，业务层保留历史与重置代次。 */
export function useClusterBuffers(nodeIds: Ref<string[]>, enabled: Ref<boolean>, scopeKey: Ref<string>, _interval: Ref<BufferInterval>, discoveryScope: Ref<string>, permitted: Ref<boolean> = enabled) {
  const entries = shallowReactive(new Map<string, ClusterBufferSnapshot>())
  const snapshots = shallowRef<ReadonlyMap<string, ClusterBufferSnapshot>>(entries)
  const epochs = new Map<string, Map<string, number>>(), suspended = shallowReactive(new Set<string>())
  const canCollect = computed(() => enabled.value && permitted.value && discoveryScope.value === scopeKey.value)
  let generation = 0
  function interrupt(nodeId: string) {
    const previous = entries.get(nodeId)
    if (previous) entries.set(nodeId, { ...previous, diagnosticHistory: appendBufferEvidence(previous.diagnosticHistory, { observedAt: Date.now(), queues: [] }) })
  }
  watch([scopeKey, discoveryScope, permitted], () => { generation++; entries.clear(); epochs.clear(); suspended.clear() }, { flush: 'sync' })
  watch(canCollect, collecting => { if (!collecting) for (const node of entries.keys()) interrupt(node) }, { flush: 'sync' })
  watch(nodeIds, ids => {
    for (const node of entries.keys()) if (!ids.includes(node)) { entries.delete(node); epochs.delete(node); suspended.delete(node) }
    for (const node of ids) if (!entries.has(node)) entries.set(node, emptySnapshot())
  }, { immediate: true, flush: 'sync' })
  const collection = useMBeanCollection(() => ({ nodeIds: nodeIds.value.filter(node => !suspended.has(node)), enabled: canCollect.value,
    name: 'org.jetlinks:type=PersistenceBuffer,*', attributes: ['Remainder', 'DeadSize', 'Monitor', 'WriterPending', 'Wip'] }), result => {
    if (!canCollect.value || suspended.has(result.nodeId)) return
    const previous = entries.get(result.nodeId) ?? emptySnapshot()
    if (result.status === 'rejected') {
      const failure = diagnosticErrorState(result.reason)
      if (['forbidden', 'unsupported'].includes(failure.status)) entries.set(result.nodeId, { ...emptySnapshot(), state: failure })
      else entries.set(result.nodeId, { ...previous, history: append(previous.history, [], result.collectedAt), diagnosticHistory: appendBufferEvidence(previous.diagnosticHistory, { observedAt: result.collectedAt, queues: [] }), state: { ...failure, status: previous.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous.state.sampledAt } })
      return
    }
    const beans = normalizeMBeans(result.value), queues = runtimeBeanOverview(beans).buffers, sampledAt = result.collectedAt
    const counterEpochs = epochs.get(result.nodeId) ?? new Map<string, number>()
    const buffers = queues.map(({ objectName, pending, dead, written, attempted }) => ({ objectName,
      ...(pending === undefined ? {} : { pending }), ...(dead === undefined ? {} : { dead }),
      ...(written === undefined ? {} : { written }), ...(attempted === undefined ? {} : { attempted }), counterEpoch: counterEpochs.get(objectName) ?? 0 }))
    const incomplete = queues.some(queue => queue.pending === undefined || queue.dead === undefined)
    entries.set(result.nodeId, { beans, queues, history: append(previous.history, buffers, sampledAt), diagnosticHistory: appendBufferEvidence(previous.diagnosticHistory, bufferEvidence(beans, sampledAt, counterEpochs)), state: { status: incomplete ? 'stale' : 'ready', sampledAt }, ...summarizeBufferQueues(queues) })
  })
  function append(history: BufferHistorySample[], buffers: BufferHistorySample['buffers'], sampledAt: number) {
    return [...history.filter(sample => sample.sampledAt >= sampledAt - 300000), { sampledAt, buffers }].slice(-301)
  }
  function refresh(_nodeId: string) { if (canCollect.value) collection.refresh() }
  /** 操作前撤销该节点 Buffer 需求，旧 revision 立即失效；完成后重新首采建立新基线。 */
  function beginReset(nodeId: string, objectName: string) {
    if (!canCollect.value || !nodeIds.value.includes(nodeId) || suspended.has(nodeId) || !objectName) return
    const current = generation, counterEpochs = epochs.get(nodeId) ?? new Map<string, number>()
    counterEpochs.set(objectName, (counterEpochs.get(objectName) ?? 0) + 1); epochs.set(nodeId, counterEpochs)
    suspended.add(nodeId); interrupt(nodeId)
    let finished = false
    return { finish(_success: boolean) {
      if (finished || generation !== current) return
      finished = true; suspended.delete(nodeId)
    } }
  }
  onScopeDispose(() => { generation++; entries.clear(); epochs.clear(); suspended.clear() })
  return { snapshots, refresh, beginReset }
}
export function provideClusterBuffers(...args: Parameters<typeof useClusterBuffers>) {
  const view = useClusterBuffers(...args); provide(bufferContext, view); return view
}
export const useClusterBufferContext = () => inject(bufferContext, undefined)
