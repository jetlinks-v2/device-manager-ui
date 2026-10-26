import { computed, inject, onScopeDispose, provide, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import type { MBeanDescriptor, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryDeviceMessageMBeans, querySessionMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans } from '../diagnostics/normalize'
import { diagnosticErrorState } from '../diagnostics/status'
import { appendGaugeSample, gaugeCount, interruptGaugeHistory, type GaugeSample } from '../diagnostics/overview/gaugeHistory'
import { defaultDiagnosticInterval, diagnosticIntervalSeconds, type BufferInterval } from '../diagnostics/preferences'
import { appendDeviceMessageSample, deviceMessageClockDiscontinuity, deviceMessageCounterNames, deviceMessageSample, interruptDeviceMessageHistory, type DeviceMessageSample, type NodeDeviceMessageSnapshot } from './device-runtime/deviceMessageHistory'

export interface NodeSessionSnapshot {
  state: ViewState
  supported: boolean | undefined
  objectName?: string
  sessions?: string
  keepOnline?: string
  history?: GaugeSample[]
  communication?: NodeDeviceMessageSnapshot
}

interface SessionJob { nodeId: string; dueAt: number; finishedAt?: number; controller?: AbortController; halted?: boolean; sessionHalted?: boolean; communicationHalted?: boolean; communicationGeneration?: string; communicationSequence?: string; communicationSegments?: DeviceMessageSample[][] }

const sessionContext: InjectionKey<ReturnType<typeof useClusterSessions>> = Symbol('runtime-cluster-sessions')
const emptySnapshot = (): NodeSessionSnapshot => ({ state: { status: 'loading' }, supported: undefined })

function availableAttribute(bean: MBeanDescriptor, name: string) {
  return bean.attributes.find(attribute => attribute.name === name && attribute.available)?.value
}

function exactSessionMBean(beans: MBeanDescriptor[]) {
  return beans.find(bean => bean.domain === 'org.jetlinks' && bean.type === 'DeviceSessionManager')
}

/** 空目录是有效能力证据；非法 fulfilled 载荷不能被 normalize 的容错误判为没有能力。 */
function sourceBeans(raw: unknown) {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  if (!record(raw) || Object.values(raw).some(types => !record(types) || Object.values(types).some(items => !record(items) || Object.values(items).some(bean => !record(bean))))) throw new Error('Invalid MBean response')
  return normalizeMBeans(raw)
}

/**
 * 页面独占的会话能力发现。目录完成后才采样；按概览频率完成后计时，最多三并发。
 * 身份、发现目录和节点目录都会使旧 job 失效，因此中止请求的迟到响应不可回写。
 */
export function useClusterSessions(nodeIds: Ref<string[]>, enabled: Ref<boolean>, scopeKey: Ref<string>, discoveryScope: Ref<string>, permitted: Ref<boolean> = enabled, interval: Ref<BufferInterval> = ref(defaultDiagnosticInterval)) {
  const snapshots = shallowRef<ReadonlyMap<string, NodeSessionSnapshot>>(new Map())
  const jobs = new Map<string, SessionJob>()
  const running = new Set<SessionJob>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const canCollect = computed(() => enabled.value && permitted.value && discoveryScope.value === scopeKey.value)

  function update(nodeId: string, snapshot: NodeSessionSnapshot) {
    snapshots.value = new Map([...snapshots.value, [nodeId, snapshot]])
  }

  function clear() {
    clearTimeout(timer)
    timer = undefined
    jobs.forEach(job => job.controller?.abort())
    jobs.clear()
    running.clear()
    snapshots.value = new Map()
  }

  /** 视图切换只停止采样；同一身份的已完成能力证据仍供连接页和节点摘要复用。 */
  function pause() {
    clearTimeout(timer)
    timer = undefined
    for (const [nodeId, previous] of jobs) {
      previous.controller?.abort()
      // 新 job 身份使旧请求即使在恢复后才 settle 也不能回写或占用新并发槽位。
      jobs.set(nodeId, { ...previous, controller: undefined })
    }
    running.clear()
    snapshots.value = new Map([...snapshots.value].map(([nodeId, snapshot]) => [nodeId, { ...snapshot, history: interruptGaugeHistory(snapshot.history), communication: snapshot.communication ? { ...snapshot.communication, history: interruptDeviceMessageHistory(snapshot.communication.history) } : undefined }]))
  }

  function current(job: SessionJob) {
    return !disposed && canCollect.value && jobs.get(job.nodeId) === job
  }

  async function sampleSession(job: SessionJob, signal: AbortSignal) {
    try {
      const bean = exactSessionMBean(sourceBeans(await querySessionMBeans(job.nodeId, signal)))
      if (!current(job)) return
      const sampledAt = Date.now()
      if (!bean) {
        update(job.nodeId, { communication: snapshots.value.get(job.nodeId)?.communication, state: { status: 'empty', sampledAt }, supported: false })
        return
      }
      const sessions = gaugeCount(availableAttribute(bean, 'Sessions'))
      update(job.nodeId, {
        communication: snapshots.value.get(job.nodeId)?.communication,
        state: { status: 'ready', sampledAt }, supported: true, objectName: bean.objectName, sessions,
        keepOnline: gaugeCount(availableAttribute(bean, 'KeepOnlineSize')),
        history: appendGaugeSample(snapshots.value.get(job.nodeId)?.history, sampledAt, sessions),
      })
    } catch (error) {
      if (!current(job)) return
      const failure = diagnosticErrorState(error)
      const previous = snapshots.value.get(job.nodeId) ?? emptySnapshot()
      if (failure.status === 'forbidden' || failure.status === 'unsupported') {
        // 确定拒绝不能继续暴露上一轮支持态或计数。
        job.sessionHalted = true
        update(job.nodeId, { communication: previous.communication, state: failure, supported: undefined })
      } else {
        // 只有短暂失败才保留已完成快照，并明确标记过期。
        update(job.nodeId, { ...previous, history: appendGaugeSample(previous.history, Date.now()), state: { ...failure, status: previous.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous.state.sampledAt } })
      }
    }
  }

  async function sampleCommunication(job: SessionJob, signal: AbortSignal) {
    try {
      const beans = sourceBeans(await queryDeviceMessageMBeans(job.nodeId, signal))
      if (!current(job)) return
      const node = snapshots.value.get(job.nodeId) ?? emptySnapshot(), previous = node.communication
      const bean = beans.find(value => value.domain === 'org.jetlinks' && value.type === 'DeviceMessageMonitor' && value.name === 'DeviceMessageMonitor')
      if (!bean) { job.communicationGeneration = undefined; job.communicationSequence = undefined; job.communicationSegments = undefined; update(job.nodeId, { ...node, communication: { supported: false, state: { status: 'empty', sampledAt: Date.now() }, history: [] } }); return }
      const sample = deviceMessageSample(bean)
      const previousSample = previous?.history.findLast(point => point.startTime !== undefined)
      // StartTime是代次身份；仅单调源序号能判断旧窗，wall校时不影响新窗被接收。
      const oldWindow = sample !== undefined && sample.startTime === job.communicationGeneration && sample.qps?.sequence !== undefined && job.communicationSequence !== undefined && BigInt(sample.qps.sequence) < BigInt(job.communicationSequence)
      if (!sample || oldWindow) {
        update(job.nodeId, { ...node, communication: { ...previous, objectName: bean.objectName, supported: true, state: { status: previous?.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous?.state.sampledAt }, history: interruptDeviceMessageHistory(previous?.history) } })
        return
      }
      if (deviceMessageClockDiscontinuity(previousSample, sample) && previous?.history.length) job.communicationSegments = [...(job.communicationSegments ?? []), previous.history].slice(-2)
      if (job.communicationGeneration !== sample.startTime) { job.communicationGeneration = sample.startTime; job.communicationSequence = undefined }
      if (sample.qps?.sequence !== undefined) job.communicationSequence = sample.qps.sequence
      update(job.nodeId, { ...node, communication: { supported: true, objectName: bean.objectName, state: { status: 'ready', sampledAt: sample.timestamp }, partial: Object.keys(sample.counters ?? {}).length !== Object.keys(deviceMessageCounterNames).length, history: appendDeviceMessageSample(previous?.history, sample) } })
    } catch (error) {
      if (!current(job)) return
      const node = snapshots.value.get(job.nodeId) ?? emptySnapshot(), previous = node.communication, failure = diagnosticErrorState(error)
      if (failure.status === 'forbidden' || failure.status === 'unsupported') {
        job.communicationHalted = true
        job.communicationGeneration = undefined; job.communicationSequence = undefined; job.communicationSegments = undefined
        update(job.nodeId, { ...node, communication: { supported: undefined, state: failure, history: [] } })
      } else update(job.nodeId, { ...node, communication: { ...previous, supported: previous?.supported, state: { ...failure, status: previous?.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous?.state.sampledAt }, history: interruptDeviceMessageHistory(previous?.history) } })
    }
  }

  /** 同一节点 job 内按源顺序轻读，最多三个在途HTTP；一个源拒绝不能清理另一个源。 */
  async function sample(job: SessionJob) {
    const controller = new AbortController(); job.controller = controller; running.add(job)
    try {
      if (!job.sessionHalted) await sampleSession(job, controller.signal)
      if (current(job) && !job.communicationHalted) await sampleCommunication(job, controller.signal)
      if (current(job)) job.halted = !!job.sessionHalted && !!job.communicationHalted
    } finally {
      running.delete(job)
      if (current(job)) {
        job.controller = undefined
        job.finishedAt = Date.now()
        job.dueAt = job.finishedAt + diagnosticIntervalSeconds(interval.value) * 1000
      }
      pump()
    }
  }

  function pump() {
    clearTimeout(timer)
    timer = undefined
    if (disposed || !canCollect.value) return
    const now = Date.now()
    const ready = [...jobs.values()]
      .filter(job => !job.halted && !running.has(job) && job.dueAt <= now)
      .sort((left, right) => left.dueAt - right.dueAt)
    for (const job of ready) {
      if (running.size >= 3) break
      void sample(job)
    }
    if (running.size >= 3) return
    const next = [...jobs.values()].filter(job => !job.halted && !running.has(job)).map(job => job.dueAt)
    if (next.length) timer = setTimeout(pump, Math.max(0, Math.min(...next) - Date.now()))
  }

  /** 节点移除时立即释放并发槽位，不等待 AbortSignal 是否最终 settle。 */
  function reconcile() {
    if (disposed) return
    const ids = new Set(nodeIds.value.filter(Boolean))
    for (const [nodeId, job] of jobs) {
      if (ids.has(nodeId)) continue
      job.controller?.abort()
      jobs.delete(nodeId)
      running.delete(job)
      const next = new Map(snapshots.value)
      next.delete(nodeId)
      snapshots.value = next
    }
    if (!canCollect.value) return
    for (const nodeId of ids) {
      if (jobs.has(nodeId)) continue
      jobs.set(nodeId, { nodeId, dueAt: Date.now() })
      update(nodeId, emptySnapshot())
    }
    pump()
  }

  function refresh(nodeId: string) {
    const job = jobs.get(nodeId)
    if (!canCollect.value || !job || running.has(job)) return
    job.halted = false
    job.sessionHalted = false
    job.communicationHalted = false
    job.dueAt = Date.now()
    pump()
  }

  // 身份/scope 变更隔离旧证据；一级视图暂时失活只暂停，不能令 connections 入口消失。
  watch([scopeKey, discoveryScope, permitted], () => {
    clear()
    if (permitted.value) reconcile()
  }, { immediate: true, flush: 'sync' })
  watch(canCollect, collecting => { if (collecting) reconcile(); else pause() }, { immediate: true, flush: 'sync' })
  watch(nodeIds, reconcile, { flush: 'sync' })
  watch(interval, () => {
    for (const job of jobs.values()) if (job.finishedAt !== undefined && !running.has(job)) job.dueAt = job.finishedAt + diagnosticIntervalSeconds(interval.value) * 1000
    pump()
  }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; clear() })
  return { snapshots, refresh }
}

export function provideClusterSessions(...args: Parameters<typeof useClusterSessions>) {
  const value = useClusterSessions(...args)
  provide(sessionContext, value)
  return value
}

export const useClusterSessionContext = () => inject(sessionContext, undefined)
