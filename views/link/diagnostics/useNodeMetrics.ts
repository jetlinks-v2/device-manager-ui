import { computed, inject, onActivated, onDeactivated, onScopeDispose, provide, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { MBeanDescriptor, MetricValue, TimeWindow, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeBeanOverview } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { loadResourceOverviewHistory } from '../../../visDashboard/SystemMonitor/services/history'
import { useMBeanCollection } from './collection/useMBeanCollection'
import { normalizeMBeans, nodeMetricCharts } from './normalize'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import { diagnosticContentState, diagnosticErrorState } from './status'
import { useClusterBufferContext } from '../RuntimeMonitor/useClusterBuffers'
import { useClusterSessionContext } from '../RuntimeMonitor/useClusterSessions'
import { useBufferReset } from './useBufferReset'
import { useNodeOperationalSignals } from './useNodeOperationalSignals'
import { diagnosticIntervalSeconds } from './preferences'
import { selectNodeResourceHistory, useResourceHistoryCache, type ResourceHistorySnapshot } from './overview/useResourceHistory'

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
  const sharedHistory = useResourceHistoryCache()
  const history = useDiagnosticQuery<ResourceHistorySnapshot>({ retainOnDeactivate: true })
  // 仅显式选择持久化范围语义；解析相对窗口不触发新的选择或第二次查询。
  const range = computed<[Dayjs, Dayjs]>({
    get: (): [Dayjs, Dayjs] => relativeSeconds.value !== undefined || !selectedRange.value
      ? history.data.value && history.data.value.relativeSeconds === relativeSeconds.value ? history.data.value.range : movingRange.value
      : [dayjs(selectedRange.value.from), dayjs(selectedRange.value.to)],
    set: (value: [Dayjs, Dayjs]) => selectRange({ from: value[0].valueOf(), to: value[1].valueOf() }),
  })
  function selectRange(value: TimeWindow) { selectedRange.value = { ...value }; preferences?.update({ historyRange: { ...value } }) }
  const jvmQuery = useDiagnosticQuery<MBeanDescriptor[]>({ retainOnDeactivate: true }), beans = shallowRef<MBeanDescriptor[]>()
  const clusterBuffers = useClusterBufferContext(), active = ref(true)
  const bufferSnapshot = computed(() => clusterBuffers?.snapshots.value.get(nodeId.value))
  const bufferBeans = computed(() => bufferSnapshot.value?.beans ?? [])
  const bufferHistory = computed(() => bufferSnapshot.value?.history ?? [])
  const bufferState = computed<ViewState>(() => !access.value.monitor ? { status: 'forbidden' } : bufferSnapshot.value?.state ?? { status: 'ready' })
  function refreshBuffers() { clusterBuffers?.refresh(nodeId.value) }
  const lastState = ref<ViewState>({ status: 'ready' })
  let clock: ReturnType<typeof setInterval> | undefined, lifetimeTrusted = false
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
  function markDisconnected() { pauseClock(); lifetimeTrusted = false }
  function applyLifetime(result: MBeanDescriptor[]) {
    const observed = runtimeBeanOverview(result)
    if (observed.startTime === undefined && observed.uptime === undefined) {
      markDisconnected(); lifetimeBase.value = undefined; lifetimeElapsed.value = 0; return
    }
    pauseClock(); lifetimeBase.value = { startTime: observed.startTime, uptime: observed.uptime, observedAt: performance.now() }; lifetimeElapsed.value = 0
    lifetimeTrusted = true; resumeClock()
  }
  function loadHistory(force = true) {
    if (!active.value || !enabled.value || !nodeId.value) return
    if (access.value.query) {
      if (relativeSeconds.value !== undefined) { const to = dayjs(); movingRange.value = [to.subtract(relativeSeconds.value, 'second'), to] }
      const seconds = relativeSeconds.value, queryRange = seconds === undefined ? range.value : movingRange.value, target = nodeId.value
      void history.run(async signal => {
        const result = sharedHistory ? await sharedHistory.load(queryRange, signal, seconds, force)
          : { history: await loadResourceOverviewHistory(queryRange, signal), range: queryRange, relativeSeconds: seconds, sampledAt: Date.now() }
        return { ...result, history: selectNodeResourceHistory(result.history, target) }
      }, true, { errorState: diagnosticErrorState, retainData: true })
    }
    else history.clear({ status: 'forbidden' })
  }
  const jvmCollection = useMBeanCollection(() => ({ nodeIds: [nodeId.value], enabled: canReadHeader.value,
    name: 'java.lang:*', attributes: ['StartTime', 'Uptime', ...(enabled.value ? ['ThreadCount', 'PeakThreadCount', 'DaemonThreadCount', 'CollectionCount', 'CollectionTime'] : [])] }), result => {
    if (!canReadHeader.value || result.nodeId !== nodeId.value) return
    if (result.status === 'fulfilled') {
      const next = normalizeMBeans(result.value)
      beans.value = next; jvmQuery.data.value = next
      applyLifetime(next)
      lastState.value = { status: 'ready', sampledAt: result.collectedAt }
      jvmQuery.state.value = lastState.value
    } else {
      const state = diagnosticErrorState(result.reason)
      if (['forbidden', 'unsupported'].includes(state.status)) { beans.value = undefined; jvmQuery.data.value = undefined; lifetimeBase.value = undefined; lifetimeElapsed.value = 0 }
      markDisconnected()
      lastState.value = beans.value ? { ...state, status: 'stale', sampledAt: lastState.value.sampledAt } : state
      jvmQuery.state.value = lastState.value
    }
  })
  function loadMBeans() { if (canReadHeader.value) jvmCollection.refresh() }
  function resetMBeans() {
    jvmQuery.clear(); beans.value = undefined
    pauseClock(); lifetimeBase.value = undefined; lifetimeElapsed.value = 0; lifetimeTrusted = false
    lastState.value = { status: access.value.monitor ? 'ready' : 'forbidden' }
  }
  function load() { loadHistory(); void loadMBeans(); void operational.refresh() }
  function refresh() { loadHistory(); void operational.refresh(); if (canReadMBeans.value) clusterSessions?.refresh(nodeId.value) }
  function pauseMBeans() {
    jvmQuery.cancel()
  }
  watch([nodeId, scopeKey, () => access.value.monitor], resetMBeans, { immediate: true, flush: 'sync' })
  watch([enabled, active, headerEnabled], () => { pauseMBeans(); if (canReadHeader.value) resumeClock(); else pauseClock() }, { flush: 'sync' })
  watch([nodeId, scopeKey, () => access.value.query], () => { history.clear(); loadHistory(false) }, { immediate: true })
  watch([enabled, active], () => { if (enabled.value && active.value) loadHistory(false); else history.cancel() }, { flush: 'sync' })
  watch(selectedRange, () => loadHistory(false))
  watch(connectionStale, value => { if (value) markDisconnected(); else resumeClock() })
  // 短时重启可能落在两次连接采样之间；冻结旧基线，等待共享流的下一次真实 JVM 样本。
  let instanceOwner = '', monitorInstance: string | undefined
  watch([nodeId, scopeKey, () => clusterSessions?.snapshots.value.get(nodeId.value)?.communication?.history.findLast(point => point.startTime !== undefined)?.startTime], ([node, scope, instance]) => {
    const owner = `${scope}\0${node}`
    if (owner !== instanceOwner) { instanceOwner = owner; monitorInstance = instance; return }
    if (instance === undefined) return
    const changed = monitorInstance !== undefined && monitorInstance !== instance
    monitorInstance = instance
    if (!changed) return
    pauseMBeans(); markDisconnected()
  }, { immediate: true, flush: 'sync' })
  onDeactivated(() => { active.value = false })
  onActivated(() => { active.value = true })
  onScopeDispose(() => { resetMBeans(); history.clear() })
  const charts = computed(() => nodeMetricCharts(history.data.value?.history, nodeId.value, t))
  const historyState = computed(() => {
    const state = diagnosticContentState(history.state.value, history.data.value !== undefined)
    return history.data.value ? { ...state, sampledAt: history.data.value.sampledAt } : state
  })
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
