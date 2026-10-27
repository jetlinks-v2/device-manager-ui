import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import type { RealtimeNode } from '../../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import { useClusterBufferContext } from '../../RuntimeMonitor/useClusterBuffers'
import { useDiagnosticsAccess } from '../useDiagnosticsAccess'
import { useDiagnosticPreferences } from '../useDiagnosticPreferences'
import { diagnosticIntervalSeconds } from '../preferences'
import type { HeapEvidenceSnapshot, PropertyCacheSnapshot } from '../useNodeOperationalSignals'
import { bufferBottlenecks, cacheBottlenecks, prioritizeBottlenecks, resourceBottlenecks, type Bottleneck, type CacheEvidence, type ResourceEvidence } from './bottleneckRules'

/** 消费现有实时回报和 Buffer 快照；本地时钟只检查新鲜度，绝不生成采样证据。 */
export function useNodeBottlenecks(nodeId: Ref<string>, live: Ref<RealtimeNode | undefined>, active: Ref<boolean>, stale: Ref<boolean>, scopeKey: Ref<string>, cache: Ref<PropertyCacheSnapshot | undefined>, heap: Ref<HeapEvidenceSnapshot | undefined>) {
  const access = useDiagnosticsAccess(), buffers = useClusterBufferContext(), preferences = useDiagnosticPreferences()
  const resources = shallowRef<ResourceEvidence[]>([]), resourceIssues = shallowRef<Bottleneck[]>([]), bufferIssues = shallowRef<Bottleneck[]>([])
  const cacheHistory = shallowRef<CacheEvidence[]>([]), cacheIssues = shallowRef<Bottleneck[]>([])
  const heaps = shallowRef<ResourceEvidence[]>([]), heapIssues = shallowRef<Bottleneck[]>([])
  const now = ref(Date.now()), suspended = ref(!active.value)
  let timer: ReturnType<typeof setInterval> | undefined
  let lastCacheGapAt = -Infinity
  let lastCpuSampleAt = 0, lastHeapSampleAt = 0
  const bufferSnapshot = computed(() => buffers?.snapshots.value.get(nodeId.value))
  const maxBufferGap = computed(() => diagnosticIntervalSeconds(preferences?.value.value.bufferIntervalSeconds) * 1500 + 10000)
  const permitted = computed(() => access.value.enter)
  function clear() { resources.value = []; resourceIssues.value = []; bufferIssues.value = []; cacheHistory.value = []; cacheIssues.value = []; heaps.value = []; heapIssues.value = []; lastCacheGapAt = -Infinity; lastCpuSampleAt = lastHeapSampleAt = 0 }
  function interrupt() {
    if (resources.value.length) resources.value = [...resources.value, { observedAt: Date.now() }].slice(-180)
    if (cacheHistory.value.length) cacheHistory.value = [...cacheHistory.value, { observedAt: Date.now() }].slice(-128)
    if (heaps.value.length) heaps.value = [...heaps.value, { observedAt: Date.now() }].slice(-128)
    suspended.value = true
  }
  watch([scopeKey, nodeId, permitted], clear, { flush: 'sync' })
  watch(() => access.value.query, granted => { if (!granted) { resources.value = []; resourceIssues.value = [] } }, { flush: 'sync' })
  watch(() => access.value.monitor, granted => { if (!granted) { bufferIssues.value = []; cacheIssues.value = []; cacheHistory.value = []; heaps.value = []; heapIssues.value = []; lastHeapSampleAt = 0 } }, { flush: 'sync' })
  watch([active, stale], ([enabled, disconnected]) => {
    clearInterval(timer); timer = undefined
    if (!enabled || disconnected) interrupt()
    if (enabled) timer = setInterval(() => { now.value = Date.now() }, 5000)
  }, { immediate: true, flush: 'sync' })
  // 只响应新的实时对象，节点/Tab 的重新激活不会把旧 live 值盖上新时间。
  watch(live, value => {
    if (!active.value || stale.value || !permitted.value || !access.value.query || !value || value.nodeId !== nodeId.value) return
    const receivedAt = Date.now(), observedAt = value.cpuSampleAt
    // 重复 / 倒序 / 缺失 producer 时间不能让旧 CPU 快照成为持续异常；延迟数据只保留为旧证据。
    if (observedAt === undefined || !Number.isSafeInteger(observedAt) || observedAt <= lastCpuSampleAt) return
    if (receivedAt - observedAt > 20000 || observedAt > receivedAt + 5000) {
      resources.value = [...resources.value, { observedAt: receivedAt }].slice(-180); suspended.value = true
      return
    }
    lastCpuSampleAt = observedAt
    now.value = receivedAt; suspended.value = false
    resources.value = [...resources.value.filter(sample => sample.observedAt > observedAt - 180000 && sample.observedAt < observedAt), {
      observedAt, cpuJvm: value.cpuJvm, cpuSystem: value.cpuSystem, loadPressure: value.cpuLoadPressure,
    }].slice(-180)
    resourceIssues.value = resourceBottlenecks(resources.value, Math.max(receivedAt, observedAt), new Set(resourceIssues.value.map(value => value.key)))
  }, { immediate: true, flush: 'sync' })
  watch(heap, snapshot => {
    if (!active.value || !access.value.monitor) return
    if (!snapshot || ['forbidden', 'unsupported'].includes(snapshot.state.status)) { heaps.value = []; heapIssues.value = []; return }
    const observedAt = snapshot.state.sampledAt
    if (snapshot.interrupted || snapshot.state.status !== 'ready') {
      if (heaps.value.length) heaps.value = [...heaps.value, { observedAt: Date.now() }].slice(-128)
      return
    }
    if (observedAt === undefined || observedAt <= lastHeapSampleAt) return
    lastHeapSampleAt = observedAt
    heaps.value = [...heaps.value.filter(point => point.observedAt > observedAt - 180000 && point.observedAt < observedAt), { observedAt, heapUsage: snapshot.usage }].slice(-128)
    heapIssues.value = resourceBottlenecks(heaps.value, Date.now(), new Set(heapIssues.value.map(value => value.key)), maxBufferGap.value)
  }, { immediate: true, flush: 'sync' })
  watch(bufferSnapshot, snapshot => {
    if (!permitted.value || !access.value.monitor || !snapshot || ['forbidden', 'unsupported'].includes(snapshot.state.status)) { bufferIssues.value = []; return }
    const latest = snapshot.diagnosticHistory?.at(-1)
    // 某条队列缺字段不能阻断其他独立队列；失败保留的旧快照没有本轮有效样本。
    if (latest?.queues.length && latest.observedAt === snapshot.state.sampledAt) {
      bufferIssues.value = bufferBottlenecks(snapshot.diagnosticHistory ?? [], Date.now(), maxBufferGap.value)
    }
  }, { immediate: true, flush: 'sync' })
  watch(cache, snapshot => {
    if (!active.value || !access.value.monitor) return
    if (snapshot?.supported === false || snapshot?.state.status === 'forbidden' || snapshot?.state.status === 'unsupported') { cacheHistory.value = []; cacheIssues.value = []; return }
    const previousAt = cacheHistory.value.at(-1)?.observedAt
    const interruption = snapshot?.history.findLast(point => point.value === undefined && point.timestamp > lastCacheGapAt && (previousAt === undefined || point.timestamp >= previousAt))
    if (interruption) {
      lastCacheGapAt = interruption.timestamp
      cacheHistory.value = [...cacheHistory.value, { observedAt: interruption.timestamp }].slice(-128)
    }
    const observedAt = snapshot?.state.sampledAt
    if (snapshot?.state.status !== 'ready' || observedAt === undefined) {
      if (cacheHistory.value.length) cacheHistory.value = [...cacheHistory.value, { observedAt: Date.now() }].slice(-128)
      return
    }
    if (cacheHistory.value.at(-1)?.observedAt === observedAt || observedAt < (cacheHistory.value.at(-1)?.observedAt ?? 0)) return
    cacheHistory.value = [...cacheHistory.value.filter(point => point.observedAt > observedAt - 180000 && point.observedAt < observedAt), { observedAt, objectName: snapshot.objectName, dirty: snapshot.dirtyCount, queue: snapshot.queueDepth, committedAt: snapshot.lastCommitTime }].slice(-128)
    cacheIssues.value = cacheBottlenecks(cacheHistory.value, Date.now(), maxBufferGap.value)
  }, { immediate: true, flush: 'sync' })
  const issues = computed(() => {
    if (!permitted.value) return []
    const retainedResources = suspended.value || stale.value || !active.value || !resources.value.length || now.value - resources.value.at(-1)!.observedAt > 20000
    const snapshot = bufferSnapshot.value
    const latestBuffers = snapshot?.diagnosticHistory?.at(-1)
    const retainedBuffers = !active.value || !latestBuffers?.queues.length || latestBuffers.observedAt !== snapshot?.state.sampledAt || now.value - (snapshot?.state.sampledAt ?? 0) > maxBufferGap.value
    const retainedCache = !active.value || cache.value?.state.status !== 'ready' || cache.value.history.at(-1)?.value === undefined || now.value - (cache.value?.state.sampledAt ?? 0) > maxBufferGap.value
    const retainedHeap = !active.value || heap.value?.interrupted || heap.value?.state.status !== 'ready' || now.value - (heap.value.state.sampledAt ?? 0) > maxBufferGap.value
    return prioritizeBottlenecks([
      ...resourceIssues.value.map(value => ({ ...value, retained: retainedResources })),
      ...bufferIssues.value.map(value => ({ ...value, retained: retainedBuffers })),
      ...cacheIssues.value.map(value => ({ ...value, retained: retainedCache })),
      ...heapIssues.value.map(value => ({ ...value, retained: retainedHeap })),
    ])
  })
  onScopeDispose(() => { clearInterval(timer); clear() })
  return { issues }
}
