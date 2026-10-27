import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import type { MBeanDescriptor, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryOperationalMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans } from './normalize'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { diagnosticErrorState } from './status'
import { appendGaugeSample, gaugeCount, interruptGaugeHistory, type GaugeSample } from './overview/gaugeHistory'
import { defaultDiagnosticInterval, diagnosticIntervalSeconds, type BufferInterval } from './preferences'

export interface OperationalSignal { objectName: string; title: string; facts: Array<{ label: string; value: string }>; warning?: string; stale?: boolean }
export interface PropertyCacheSnapshot {
  supported: boolean | undefined
  state: ViewState
  objectName?: string
  inMemorySize?: string
  dirtyCount?: string
  queueDepth?: string
  lastCommitTime?: string
  lastFlushDuration?: string
  history: GaugeSample[]
}
interface OperationalSnapshot { signals: OperationalSignal[]; state: ViewState; cache?: PropertyCacheSnapshot; heap?: HeapEvidenceSnapshot }
export interface HeapEvidenceSnapshot { state: ViewState; usage?: number; interrupted?: boolean }
const summary = (name: string) => `runtimeDiagnostics.mbeanSummary.${name}`
const empty = (): OperationalSnapshot => ({ signals: [], state: { status: 'ready' } })
function attribute(bean: MBeanDescriptor, name: string) { return bean.attributes.find(value => value.name === name && value.available)?.value }
function exactBean(source: PromiseSettledResult<Record<string, unknown>> | undefined, type: string) {
  return source?.status === 'fulfilled' ? normalizeMBeans(source.value).find(bean => bean.domain === 'org.jetlinks' && bean.type === type) : undefined
}

/** 实际 JMX 轻读堆的 used/max；不使用旧实时 payload 或 committed 充当最大容量。 */
export function heapEvidenceSnapshot(source: PromiseSettledResult<Record<string, unknown>> | undefined, sampledAt: number, previous?: HeapEvidenceSnapshot): HeapEvidenceSnapshot {
  if (source?.status === 'rejected') {
    const failure = diagnosticErrorState(source.reason)
    return ['forbidden', 'unsupported'].includes(failure.status) ? { state: failure } : { ...previous, interrupted: true, state: { ...failure, status: 'stale', sampledAt: previous?.state.sampledAt } }
  }
  const bean = source?.status === 'fulfilled' ? normalizeMBeans(source.value).find(bean => bean.domain === 'java.lang' && bean.type === 'Memory') : undefined
  const raw = bean && attribute(bean, 'HeapMemoryUsage'), value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : undefined
  const used = gaugeCount(value?.used), max = gaugeCount(value?.max)
  const valid = used !== undefined && max !== undefined && BigInt(max) > 0n && BigInt(used) <= BigInt(max)
  const usage = valid ? Number(BigInt(used) * 10000n / BigInt(max)) / 100 : undefined
  return { state: { status: 'ready', sampledAt }, usage }
}

/** 默认概览只保留当前可操作的关注证据；内部拓扑和累计值留在 MBean。 */
function attentionSignals(sources: PromiseSettledResult<Record<string, unknown>>[], previous: OperationalSignal[]): OperationalSignal[] {
  const result: OperationalSignal[] = []
  for (const [index, type] of [[0, 'EventBus'], [2, 'SystemMonitorCollector']] as const) {
    if (sources[index]?.status === 'rejected') {
      const failure = diagnosticErrorState(sources[index].reason)
      if (failure.status === 'forbidden' || failure.status === 'unsupported') continue
      result.push(...previous.filter(value => value.title === `runtimeDiagnostics.catalog.${type}.name`).map(value => ({ ...value, stale: true })))
      continue
    }
    const bean = exactBean(sources[index], type)
    if (!bean) continue
    const facts: OperationalSignal['facts'] = []
    if (type === 'EventBus') {
      for (const name of ['StructuredBufferedEventCount', 'StructuredPendingSyncPeerCount']) {
        const value = gaugeCount(attribute(bean, name))
        if (value !== undefined && BigInt(value) > 0n) facts.push({ label: summary(name), value })
      }
    } else {
      const failed = gaugeCount(attribute(bean, 'LastFailureTime')), succeeded = gaugeCount(attribute(bean, 'LastSuccessTime'))
      // 失败累计值不代表当前异常；只有失败时间晚于已知成功才提示关注。
      if (failed !== undefined && BigInt(failed) > 0n && succeeded !== undefined && BigInt(failed) > BigInt(succeeded) && Number.isSafeInteger(Number(failed))) {
        const date = new Date(Number(failed))
        if (Number.isFinite(date.valueOf())) facts.push({ label: 'runtimeDiagnostics.collectorRecentFailure', value: date.toLocaleString() })
      }
    }
    if (facts.length) result.push({ objectName: bean.objectName, title: `runtimeDiagnostics.catalog.${type}.name`, facts })
  }
  return result
}

/** ThingsDataManager 独立确认能力；缺属性、失败与禁止均不能填充伪零。 */
function cacheSnapshot(source: PromiseSettledResult<Record<string, unknown>> | undefined, previous: PropertyCacheSnapshot | undefined, sampledAt: number): PropertyCacheSnapshot {
  if (source?.status === 'rejected') {
    const failure = diagnosticErrorState(source.reason)
    if (failure.status === 'forbidden' || failure.status === 'unsupported') return { supported: undefined, state: failure, history: [] }
    return { ...previous, supported: previous?.supported, history: appendGaugeSample(previous?.history, sampledAt), state: { ...failure, status: previous?.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous?.state.sampledAt } }
  }
  const bean = exactBean(source, 'ThingsDataManager')
  if (!bean) return { supported: false, state: { status: 'empty', sampledAt }, history: [] }
  const inMemorySize = gaugeCount(attribute(bean, 'InMemorySize'))
  return { supported: true, state: { status: 'ready', sampledAt }, objectName: bean.objectName, inMemorySize,
    dirtyCount: gaugeCount(attribute(bean, 'DirtyCount')), queueDepth: gaugeCount(attribute(bean, 'QueueDepth')),
    lastCommitTime: gaugeCount(attribute(bean, 'LastCommitTime')), lastFlushDuration: gaugeCount(attribute(bean, 'LastFlushDuration')),
    history: appendGaugeSample(previous?.objectName === bean.objectName ? previous.history : [], sampledAt, inMemorySize) }
}

/** 概览激活时按统一频率完成后计时；节点/工具暂停保留证据，身份与撤权释放证据。 */
export function useNodeOperationalSignals(nodeId: Ref<string>, enabled: Ref<boolean>, scopeKey: Ref<string>, sessionSupported: Ref<boolean | undefined> = ref(undefined), interval: Ref<BufferInterval> = ref(defaultDiagnosticInterval)) {
  const access = useDiagnosticsAccess(), saved = new Map<string, OperationalSnapshot>(), snapshot = shallowRef<OperationalSnapshot>(empty())
  const allowed = computed(() => enabled.value && !!nodeId.value && access.value.monitor)
  let timer: ReturnType<typeof setTimeout> | undefined, generation = 0, disposed = false
  let finishedAt: number | undefined
  let job: { nodeId: string; generation: number; controller: AbortController } | undefined

  function commit(value: OperationalSnapshot) {
    snapshot.value = value
    saved.set(nodeId.value, value)
    if (saved.size > 30) saved.delete(saved.keys().next().value!)
  }
  function pause(retain = true) {
    generation++; clearTimeout(timer); timer = undefined; job?.controller.abort(); job = undefined
    const previous = saved.get(nodeId.value)
    if (retain && previous) commit({ ...previous, heap: previous.heap ? { ...previous.heap, interrupted: true } : undefined, cache: previous.cache ? { ...previous.cache, history: interruptGaugeHistory(previous.cache.history) } : undefined })
  }
  function clear() { pause(); saved.clear(); snapshot.value = empty() }
  function schedule() {
    clearTimeout(timer); timer = undefined
    if (!disposed && allowed.value && !job && finishedAt !== undefined) timer = setTimeout(() => { void refresh() }, Math.max(0, finishedAt + diagnosticIntervalSeconds(interval.value) * 1000 - Date.now()))
  }
  async function refresh() {
    if (!allowed.value || disposed || job) return
    clearTimeout(timer); timer = undefined
    const current = { nodeId: nodeId.value, generation, controller: new AbortController() }, includeCache = sessionSupported.value === true
    job = current
    const isCurrent = () => !disposed && job === current && current.generation === generation && allowed.value && nodeId.value === current.nodeId
    try {
      const sources = await queryOperationalMBeans(current.nodeId, current.controller.signal, includeCache)
      if (!isCurrent()) return
      const previous = snapshot.value, failed = sources.length > 0 && sources.every(source => source.status === 'rejected'), sampledAt = Date.now()
      const failure = failed && sources[0].status === 'rejected' ? diagnosticErrorState(sources[0].reason) : undefined
      const state: ViewState = failure ? { ...failure, status: previous.state.sampledAt === undefined || failure.status === 'forbidden' || failure.status === 'unsupported' ? failure.status : 'stale', sampledAt: previous.state.sampledAt } : { status: 'ready', sampledAt }
      commit({ signals: attentionSignals(sources, previous.signals), state, heap: heapEvidenceSnapshot(sources[3], sampledAt, previous.heap), cache: includeCache ? cacheSnapshot(sources[1], previous.cache, sampledAt) : undefined })
    } catch (error) {
      if (!isCurrent()) return
      const failure = diagnosticErrorState(error), previous = snapshot.value
      commit({ signals: failure.status === 'forbidden' || failure.status === 'unsupported' ? [] : previous.signals.map(value => ({ ...value, stale: true })), state: failure, heap: heapEvidenceSnapshot({ status: 'rejected', reason: error }, Date.now(), previous.heap),
        cache: includeCache ? cacheSnapshot({ status: 'rejected', reason: error }, previous.cache, Date.now()) : undefined })
    } finally {
      if (isCurrent()) { job = undefined; finishedAt = Date.now(); schedule() }
    }
  }
  // 单一 watcher 合并相同变化，避免身份切换和激活分别启动重复请求。
  watch([nodeId, scopeKey, () => access.value.monitor, enabled, sessionSupported], (next, previous) => {
    const identityChanged = !!previous && next[1] !== previous[1], permissionChanged = !!previous && next[2] !== previous[2]
    // 先在原节点保存断点，再恢复新节点；Tab 变更不会清空整个 saved。
    const previousNodeId = previous?.[0]
    if (previousNodeId !== undefined && next[0] !== previousNodeId) {
      const old = saved.get(previousNodeId)
      if (old?.cache) saved.set(previousNodeId, { ...old, cache: { ...old.cache, history: interruptGaugeHistory(old.cache.history) } })
    }
    pause(!previous || next[0] === previous[0])
    if (identityChanged || permissionChanged) { saved.clear(); snapshot.value = empty() }
    else snapshot.value = saved.get(nodeId.value) ?? empty()
    if (sessionSupported.value !== true && snapshot.value.cache) commit({ ...snapshot.value, cache: undefined })
    if (!access.value.monitor) { snapshot.value = { signals: [], state: { status: 'forbidden' } }; return }
    if (allowed.value) void refresh()
  }, { immediate: true, flush: 'sync' })
  watch(interval, schedule, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; clear() })
  return { signals: computed(() => access.value.monitor ? snapshot.value.signals : []), heap: computed(() => access.value.monitor ? snapshot.value.heap : undefined), cache: computed(() => access.value.monitor && sessionSupported.value === true ? snapshot.value.cache : undefined), state: computed(() => snapshot.value.state), refresh }
}
