import { computed, inject, onActivated, onDeactivated, onScopeDispose, provide, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { MBeanDescriptor, MetricValue, TimeWindow, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeBeanOverview } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { loadResourceOverviewHistory } from '../../../visDashboard/SystemMonitor/services/history'
import { queryMBeans, queryOverviewMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans, nodeMetricCharts } from './normalize'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import { diagnosticContentState, diagnosticErrorState } from './status'
import { useClusterBufferContext } from '../RuntimeMonitor/useClusterBuffers'
import { useClusterSessionContext } from '../RuntimeMonitor/useClusterSessions'
import { useBufferReset } from './useBufferReset'
import { useNodeOperationalSignals } from './useNodeOperationalSignals'
import { diagnosticIntervalSeconds } from './preferences'

const nodeMetricsKey: InjectionKey<ReturnType<typeof useNodeMetrics>> = Symbol('runtime-node-metrics')
/** 页面只建立一份选中节点的MBean会话，左侧详情与概览消费同一份证据。 */
export function provideNodeMetrics(nodeId: Ref<string>, enabled: Ref<boolean>, scopeKey?: Ref<string>, connectionStale?: Ref<boolean>, headerEnabled?: Ref<boolean>) {
  const view = useNodeMetrics(nodeId, enabled, scopeKey, connectionStale, headerEnabled)
  provide(nodeMetricsKey, view)
  return view
}
export function useNodeMetricsContext(nodeId: Ref<string>, enabled: Ref<boolean>) { return inject(nodeMetricsKey, undefined) ?? useNodeMetrics(nodeId, enabled) }

/** 历史与JVM轻读按当前工具激活；Buffer消费页面集群会话，绝不另建轮询。 */
export function useNodeMetrics(nodeId: Ref<string>, enabled: Ref<boolean>, scopeKey: Ref<string> = ref(''), connectionStale: Ref<boolean> = ref(false), headerEnabled: Ref<boolean> = ref(true)) {
  const { t } = useI18n()
  const access = useDiagnosticsAccess()
  const preferences = useDiagnosticPreferences(), saved = preferences?.value.value.historyRange
  const movingRange = ref<[Dayjs, Dayjs]>([dayjs().subtract(1, 'hour'), dayjs()])
  const selectedRange = ref<TimeWindow | undefined>(saved)
  const relativeSeconds = computed(() => selectedRange.value ? selectedRange.value.relativeSeconds : 3600)
  // 仅显式选择持久化范围语义；解析相对窗口不触发新的选择或第二次查询。
  const range = computed<[Dayjs, Dayjs]>({
    get: (): [Dayjs, Dayjs] => relativeSeconds.value !== undefined || !selectedRange.value ? movingRange.value : [dayjs(selectedRange.value.from), dayjs(selectedRange.value.to)],
    set: (value: [Dayjs, Dayjs]) => selectRange({ from: value[0].valueOf(), to: value[1].valueOf() }),
  })
  function selectRange(value: TimeWindow) { selectedRange.value = { ...value }; preferences?.update({ historyRange: { ...value } }) }
  const history = useDiagnosticQuery<Awaited<ReturnType<typeof loadResourceOverviewHistory>>>({ retainOnDeactivate: true })
  const jvmQuery = useDiagnosticQuery<MBeanDescriptor[]>({ retainOnDeactivate: true }), beans = shallowRef<MBeanDescriptor[]>()
  const lifetimeQuery = useDiagnosticQuery<MBeanDescriptor[]>({ retainOnDeactivate: true })
  const clusterBuffers = useClusterBufferContext(), active = ref(true)
  const bufferSnapshot = computed(() => clusterBuffers?.snapshots.value.get(nodeId.value))
  const bufferBeans = computed(() => bufferSnapshot.value?.beans ?? [])
  const bufferHistory = computed(() => bufferSnapshot.value?.history ?? [])
  const bufferState = computed<ViewState>(() => !access.value.monitor ? { status: 'forbidden' } : bufferSnapshot.value?.state ?? { status: 'ready' })
  function refreshBuffers() { clusterBuffers?.refresh(nodeId.value) }
  const lastState = ref<ViewState>({ status: 'ready' })
  let generation = 0
  let clock: ReturnType<typeof setInterval> | undefined, lifetimeAcquired = false, lifetimeTrusted = false
  const lifetimeBase = shallowRef<{ startTime?: number; uptime?: number; observedAt: number }>(), lifetimeElapsed = ref(0)
  const canReadHeader = computed(() => active.value && headerEnabled.value && !!nodeId.value && access.value.monitor)
  const canReadMBeans = computed(() => canReadHeader.value && enabled.value)
  const clusterSessions = useClusterSessionContext()
  const operational = useNodeOperationalSignals(nodeId, computed(() => active.value && headerEnabled.value && enabled.value), scopeKey, computed(() => clusterSessions?.snapshots.value.get(nodeId.value)?.supported), computed(() => diagnosticIntervalSeconds(preferences?.value.value.bufferIntervalSeconds)))
  const bufferResetAccess = computed(() => ({ allowed: canReadMBeans.value && access.value.monitor && access.value.invoke }))
  const bufferReset = useBufferReset(nodeId, canReadMBeans, scopeKey, bufferBeans, computed(() => access.value.monitor && access.value.invoke), clusterBuffers)
  function tickLifetime() { if (lifetimeBase.value) lifetimeElapsed.value = Math.max(0, performance.now() - lifetimeBase.value.observedAt) }
  function pauseClock() { if (clock) tickLifetime(); clearInterval(clock); clock = undefined }
  function resumeClock() {
    if (!canReadHeader.value || !lifetimeTrusted || connectionStale.value || lifetimeBase.value?.uptime === undefined) return
    pauseClock(); tickLifetime(); clock = setInterval(tickLifetime, 1000)
  }
  function markDisconnected() { pauseClock(); lifetimeTrusted = false; lifetimeAcquired = false }
  function applyLifetime(result: MBeanDescriptor[]) {
    const observed = runtimeBeanOverview(result)
    if (observed.startTime === undefined && observed.uptime === undefined) return
    pauseClock(); lifetimeBase.value = { startTime: observed.startTime, uptime: observed.uptime, observedAt: performance.now() }; lifetimeElapsed.value = 0
    lifetimeAcquired = true; lifetimeTrusted = true; resumeClock()
  }
  async function loadLifetime() {
    if (!canReadHeader.value || enabled.value || lifetimeAcquired || lifetimeQuery.state.value.status === 'loading') return
    const current = generation, target = nodeId.value
    await lifetimeQuery.run(async signal => normalizeMBeans(await queryMBeans(target, signal, 'java.lang:type=Runtime', ['StartTime', 'Uptime'])), true, { errorState: diagnosticErrorState })
    if (current !== generation || !canReadHeader.value) return
    if (lifetimeQuery.data.value) applyLifetime(lifetimeQuery.data.value)
    else if (['forbidden', 'unsupported'].includes(lifetimeQuery.state.value.status)) {
      beans.value = undefined; lifetimeBase.value = undefined; lifetimeElapsed.value = 0; markDisconnected(); lastState.value = lifetimeQuery.state.value
    }
  }
  function loadHistory() {
    if (!active.value || !enabled.value || !nodeId.value) return
    if (access.value.query) {
      if (relativeSeconds.value !== undefined) { const to = dayjs(); movingRange.value = [to.subtract(relativeSeconds.value, 'second'), to] }
      const queryRange = range.value
      void history.run(() => loadResourceOverviewHistory(queryRange), true, { errorState: diagnosticErrorState, retainData: true })
    }
    else history.clear({ status: 'forbidden' })
  }
  async function loadMBeans() {
    if (!canReadMBeans.value || jvmQuery.state.value.status === 'loading') return
    lifetimeQuery.cancel()
    const current = generation, target = nodeId.value
    const includeLifetime = !lifetimeAcquired
    await jvmQuery.run(async signal => {
      const result = await queryOverviewMBeans(target, signal, includeLifetime)
      return result.sources.flatMap(value => normalizeMBeans(value))
    }, true, { errorState: diagnosticErrorState })
    if (current !== generation || !canReadMBeans.value) return
    const result = jvmQuery.data.value
    if (result) {
      beans.value = result
      if (includeLifetime) applyLifetime(result)
      else {
        const startTime = runtimeBeanOverview(result).startTime
        if (startTime !== undefined && lifetimeBase.value?.startTime !== undefined && startTime !== lifetimeBase.value.startTime) {
          markDisconnected(); void loadMBeans(); return
        }
      }
      lastState.value = { status: 'ready', sampledAt: Date.now() }
    } else {
      const state = jvmQuery.state.value
      if (['forbidden', 'unsupported'].includes(state.status)) {
        beans.value = undefined; lifetimeBase.value = undefined; lifetimeElapsed.value = 0; markDisconnected(); lastState.value = state
      } else {
        markDisconnected()
        lastState.value = beans.value ? { ...state, status: 'stale', sampledAt: lastState.value.sampledAt } : state
      }
    }
  }
  function resetMBeans() {
    generation++; jvmQuery.clear(); lifetimeQuery.clear(); beans.value = undefined
    pauseClock(); lifetimeBase.value = undefined; lifetimeElapsed.value = 0; lifetimeAcquired = false; lifetimeTrusted = false
    lastState.value = { status: access.value.monitor ? 'ready' : 'forbidden' }
  }
  function load() { loadHistory(); void loadMBeans(); void operational.refresh() }
  function refresh() { loadHistory(); void operational.refresh(); if (canReadMBeans.value) clusterSessions?.refresh(nodeId.value) }
  function pauseMBeans() {
    generation++; jvmQuery.cancel(); lifetimeQuery.cancel()
  }
  watch([nodeId, scopeKey, () => access.value.monitor], () => { resetMBeans(); if (canReadMBeans.value) void loadMBeans(); else void loadLifetime() }, { immediate: true, flush: 'sync' })
  watch([enabled, active, headerEnabled], () => { pauseMBeans(); if (canReadMBeans.value) void loadMBeans(); else void loadLifetime(); if (canReadHeader.value) resumeClock(); else pauseClock() }, { flush: 'sync' })
  watch([nodeId, scopeKey, () => access.value.query], () => { history.clear(); loadHistory() }, { immediate: true })
  watch([enabled, active], () => { if (enabled.value && active.value) loadHistory(); else history.cancel() }, { flush: 'sync' })
  watch(selectedRange, loadHistory)
  watch(connectionStale, value => { if (value) markDisconnected(); else { resumeClock(); if (canReadMBeans.value) void loadMBeans(); else void loadLifetime() } })
  // 短时重启可能落在两次连接采样之间；实例变化只触发一次真实 JVM 基线核对。
  let instanceOwner = '', monitorInstance: string | undefined
  watch([nodeId, scopeKey, () => clusterSessions?.snapshots.value.get(nodeId.value)?.communication?.history.findLast(point => point.startTime !== undefined)?.startTime], ([node, scope, instance]) => {
    const owner = `${scope}\0${node}`
    if (owner !== instanceOwner) { instanceOwner = owner; monitorInstance = instance; return }
    if (instance === undefined) return
    const changed = monitorInstance !== undefined && monitorInstance !== instance
    monitorInstance = instance
    if (!changed) return
    pauseMBeans(); markDisconnected()
    if (canReadMBeans.value) void loadMBeans(); else void loadLifetime()
  }, { immediate: true, flush: 'sync' })
  onDeactivated(() => { active.value = false })
  onActivated(() => { active.value = true })
  onScopeDispose(() => { resetMBeans(); history.clear() })
  const charts = computed(() => nodeMetricCharts(history.data.value, nodeId.value, t))
  const historyState = computed(() => diagnosticContentState(history.state.value, history.data.value !== undefined))
  const metrics = computed<MetricValue[]>(() => {
    const threading = beans.value?.find(bean => bean.domain === 'java.lang' && bean.type === 'Threading')
    const threadCount = threading?.attributes.find(attribute => attribute.name === 'ThreadCount' && attribute.available)?.value
    const gc = beans.value?.filter(bean => bean.domain === 'java.lang' && bean.type === 'GarbageCollector').flatMap(bean => bean.attributes.filter(attribute => attribute.name === 'CollectionCount' && attribute.available && attribute.value !== null && attribute.value !== '').map(attribute => Number(attribute.value))).filter(value => Number.isFinite(value) && value >= 0)
    const lifetime = lifetimeBase.value, uptime = lifetime?.uptime === undefined ? undefined : lifetime.uptime + lifetimeElapsed.value
    return access.value.monitor ? [
        { key: 'threads', label: t('runtimeDiagnostics.threads'), value: typeof threadCount === 'number' ? threadCount : undefined },
        { key: 'gc', label: t('runtimeDiagnostics.gc'), value: gc?.length ? gc.reduce((total, value) => total + value, 0) : undefined },
        { key: 'startTime', label: t('runtimeDiagnostics.startTime'), value: lifetime?.startTime === undefined ? undefined : new Date(lifetime.startTime).toLocaleString() },
        { key: 'uptime', label: t('runtimeDiagnostics.uptime'), value: uptime === undefined ? undefined : t('runtimeDiagnostics.uptimeDuration', { days: Math.floor(uptime / 86400000), hours: Math.floor(uptime / 3600000) % 24, minutes: Math.floor(uptime / 60000) % 60, seconds: Math.floor(uptime / 1000) % 60 }) },
      ] : []
  })
  const mbeanState = computed<ViewState>(() => jvmQuery.state.value.status === 'loading' && !beans.value ? jvmQuery.state.value : lastState.value)
  const jvm = { ...jvmQuery, data: beans }
  return { range, relativeSeconds, selectRange, history, historyState, jvm, metrics, charts, load, refresh, loadMBeans, loadHistory, mbeanState, bufferBeans, bufferState, bufferHistory, refreshBuffers, bufferResetAccess, bufferReset, operational, access }
}
