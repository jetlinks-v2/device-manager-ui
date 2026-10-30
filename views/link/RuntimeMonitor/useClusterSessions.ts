import { computed, inject, onScopeDispose, provide, ref, shallowReactive, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import type { MBeanDescriptor, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { normalizeMBeans } from '../diagnostics/normalize'
import { diagnosticErrorState } from '../diagnostics/status'
import { appendGaugeSample, gaugeCount, interruptGaugeHistory, type GaugeSample } from '../diagnostics/overview/gaugeHistory'
import { defaultDiagnosticInterval, type BufferInterval } from '../diagnostics/preferences'
import { appendDeviceMessageSample, deviceMessageClockDiscontinuity, deviceMessageCounterNames, deviceMessageSample, interruptDeviceMessageHistory, type DeviceMessageSample, type NodeDeviceMessageSnapshot } from './device-runtime/deviceMessageHistory'
import { useMBeanCollection } from '../diagnostics/collection/useMBeanCollection'
import type { MBeanResult } from '../diagnostics/collection/manager'
import type { createMBeanCollectionManager } from '../diagnostics/collection/manager'

export interface NodeSessionSnapshot {
  state: ViewState; supported: boolean | undefined; objectName?: string; sessions?: string; keepOnline?: string
  history?: GaugeSample[]; communication?: NodeDeviceMessageSnapshot
}
interface CommunicationIdentity { generation?: string; sequence?: string; segments?: DeviceMessageSample[][] }
const sessionContext: InjectionKey<ReturnType<typeof useClusterSessions>> = Symbol('runtime-cluster-sessions')
const emptySnapshot = (): NodeSessionSnapshot => ({ state: { status: 'loading' }, supported: undefined })
function availableAttribute(bean: MBeanDescriptor, name: string) { return bean.attributes.find(attribute => attribute.name === name && attribute.available)?.value }

/** 会话能力与通信统计声明独立投影，共用页面流；失败、真实零和未注册保持各自语义。 */
export function useClusterSessions(nodeIds: Ref<string[]>, enabled: Ref<boolean>, scopeKey: Ref<string>, discoveryScope: Ref<string>, permitted: Ref<boolean> = enabled, _interval: Ref<BufferInterval> = ref(defaultDiagnosticInterval), owner?: ReturnType<typeof createMBeanCollectionManager>) {
  const entries = shallowReactive(new Map<string, NodeSessionSnapshot>()), identities = new Map<string, CommunicationIdentity>()
  const snapshots = shallowRef<ReadonlyMap<string, NodeSessionSnapshot>>(entries)
  const canCollect = computed(() => enabled.value && permitted.value && discoveryScope.value === scopeKey.value)
  watch([scopeKey, discoveryScope, permitted], () => { entries.clear(); identities.clear() }, { flush: 'sync' })
  watch(nodeIds, ids => {
    for (const id of entries.keys()) if (!ids.includes(id)) { entries.delete(id); identities.delete(id) }
    for (const id of ids) if (!entries.has(id)) entries.set(id, emptySnapshot())
  }, { immediate: true, flush: 'sync' })
  watch(canCollect, collecting => {
    if (!collecting) for (const [id, snapshot] of entries) entries.set(id, { ...snapshot, history: interruptGaugeHistory(snapshot.history), communication: snapshot.communication ? { ...snapshot.communication, history: interruptDeviceMessageHistory(snapshot.communication.history) } : undefined })
  }, { flush: 'sync' })

  function session(result: MBeanResult) {
    if (!canCollect.value) return
    const previous = entries.get(result.nodeId) ?? emptySnapshot()
    if (result.status === 'rejected') {
      const failure = diagnosticErrorState(result.reason)
      entries.set(result.nodeId, ['forbidden', 'unsupported'].includes(failure.status)
        ? { communication: previous.communication, state: failure, supported: undefined }
        : { ...previous, history: appendGaugeSample(previous.history, result.collectedAt), state: { ...failure, status: previous.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous.state.sampledAt } })
      return
    }
    const bean = normalizeMBeans(result.value).find(bean => bean.domain === 'org.jetlinks' && bean.type === 'DeviceSessionManager')
    if (!bean) { entries.set(result.nodeId, { communication: previous.communication, state: { status: 'empty', sampledAt: result.collectedAt }, supported: false }); return }
    const sessions = gaugeCount(availableAttribute(bean, 'Sessions'))
    entries.set(result.nodeId, { communication: previous.communication, state: { status: 'ready', sampledAt: result.collectedAt }, supported: true,
      objectName: bean.objectName, sessions, keepOnline: gaugeCount(availableAttribute(bean, 'KeepOnlineSize')),
      history: appendGaugeSample(previous.history, result.collectedAt, sessions) })
  }

  function communication(result: MBeanResult) {
    if (!canCollect.value) return
    const node = entries.get(result.nodeId) ?? emptySnapshot(), previous = node.communication
    if (result.status === 'rejected') {
      const failure = diagnosticErrorState(result.reason)
      if (['forbidden', 'unsupported'].includes(failure.status)) {
        identities.delete(result.nodeId)
        entries.set(result.nodeId, { ...node, communication: { supported: undefined, state: failure, history: [] } })
      } else entries.set(result.nodeId, { ...node, communication: { ...previous, supported: previous?.supported, state: { ...failure, status: previous?.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous?.state.sampledAt }, history: interruptDeviceMessageHistory(previous?.history) } })
      return
    }
    const bean = normalizeMBeans(result.value).find(bean => bean.domain === 'org.jetlinks' && bean.type === 'DeviceMessageMonitor' && bean.name === 'DeviceMessageMonitor')
    if (!bean) { identities.delete(result.nodeId); entries.set(result.nodeId, { ...node, communication: { supported: false, state: { status: 'empty', sampledAt: result.collectedAt }, history: [] } }); return }
    const identity = identities.get(result.nodeId) ?? {}, sample = deviceMessageSample(bean)
    const previousSample = previous?.history.findLast(point => point.startTime !== undefined)
    const oldWindow = sample !== undefined && sample.startTime === identity.generation && sample.qps?.sequence !== undefined && identity.sequence !== undefined && BigInt(sample.qps.sequence) < BigInt(identity.sequence)
    if (!sample || oldWindow) {
      entries.set(result.nodeId, { ...node, communication: { ...previous, objectName: bean.objectName, supported: true, state: { status: previous?.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous?.state.sampledAt }, history: interruptDeviceMessageHistory(previous?.history) } })
      return
    }
    if (deviceMessageClockDiscontinuity(previousSample, sample) && previous?.history.length) identity.segments = [...(identity.segments ?? []), previous.history].slice(-2)
    if (identity.generation !== sample.startTime) { identity.generation = sample.startTime; identity.sequence = undefined }
    if (sample.qps?.sequence !== undefined) identity.sequence = sample.qps.sequence
    identities.set(result.nodeId, identity)
    entries.set(result.nodeId, { ...node, communication: { supported: true, objectName: bean.objectName, state: { status: 'ready', sampledAt: sample.timestamp }, partial: Object.keys(sample.counters ?? {}).length !== Object.keys(deviceMessageCounterNames).length, history: appendDeviceMessageSample(previous?.history, sample) } })
  }
  const declaration = (name: string, attributes: string[]) => () => ({ nodeIds: nodeIds.value, enabled: canCollect.value, name, attributes })
  const collection = useMBeanCollection(declaration('org.jetlinks:type=DeviceSessionManager,*', ['Sessions', 'KeepOnlineSize']), session, owner)
  useMBeanCollection(declaration('org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor', ['StartTime', 'SnapshotTime', 'ReceivedBytesTotal', 'SentBytesTotal', 'UpstreamMessagesTotal', 'PropertyReportsTotal', 'PropertyValuesTotal', 'EventReportsTotal', 'ReceivedPacketsTotal', 'SentPacketsTotal', 'QpsSnapshot']), communication, owner)
  function refresh(_nodeId: string) { if (canCollect.value) collection.refresh() }
  onScopeDispose(() => { entries.clear(); identities.clear() })
  return { snapshots, refresh }
}

export function provideClusterSessions(...args: Parameters<typeof useClusterSessions>) {
  const value = useClusterSessions(...args); provide(sessionContext, value); return value
}
export const useClusterSessionContext = () => inject(sessionContext, undefined)
