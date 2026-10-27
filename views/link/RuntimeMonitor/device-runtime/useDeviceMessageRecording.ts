import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { queryDeviceMessageRecording } from '../../../../api/link/diagnostics'
import { normalizeMBeans } from '../../diagnostics/normalize'
import { diagnosticIntervalSeconds } from '../../diagnostics/preferences'
import { peakNeighborhood, readDeviceRecording, type DeviceRecording, type DeviceRecordingView, type DevicePeakSelection, type DeviceSecond } from './deviceMessageRecording'

function sourceBeans(raw: unknown) {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  if (!record(raw) || Object.values(raw).some(types => !record(types) || Object.values(types).some(items => !record(items) || Object.values(items).some(bean => !record(bean))))) throw new Error('Invalid MBean history source')
  return normalizeMBeans(raw)
}

/** 当前节点专属的只读历史采集；换节点 / 身份 / 离页取消迟到请求，返回时保留已完成证据。 */
export function useDeviceMessageRecording(nodeId: Ref<string>, enabled: Ref<boolean>, scope: Ref<string>, interval: Ref<unknown>, generation: Ref<string | undefined>) {
  const cache = new Map<string, DeviceRecording>()
  const data = shallowRef<DeviceRecording>(), state = ref<DeviceRecordingView['state']>('loading')
  const focus = shallowRef<DevicePeakSelection>(), focusedPoints = shallowRef<DeviceSecond[]>(), outside = ref(false), busy = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined, pending: AbortController | undefined, peakRequest: AbortController | undefined, revision = 0, disposed = false, halted = false
  const key = () => `${scope.value}\0${nodeId.value}`
  let owner = '', ownerGeneration: string | undefined

  function cancel() { clearTimeout(timer); pending?.abort(); pending = undefined; if (peakRequest && !focusedPoints.value) focus.value = undefined; peakRequest?.abort(); peakRequest = undefined; busy.value = false; revision++ }
  function live() { peakRequest?.abort(); peakRequest = undefined; busy.value = false; focus.value = undefined; focusedPoints.value = undefined; outside.value = false }
  function denied(error: unknown) {
    const failure = error as { status?: number; response?: { status?: number } } | undefined
    if (![401, 403].includes(failure?.status ?? failure?.response?.status ?? 0)) return false
    cancel(); cache.clear(); data.value = undefined; live(); halted = true; state.value = 'error'
    return true
  }

  async function refresh() {
    if (!enabled.value || disposed || pending) return
    clearTimeout(timer)
    halted = false
    const controller = new AbortController(), current = revision, identity = key()
    pending = controller
    try {
      const beans = sourceBeans(await queryDeviceMessageRecording(nodeId.value, controller.signal))
      if (controller.signal.aborted || revision !== current) return
      const next = readDeviceRecording(beans.find(bean => bean.type === 'DeviceMessageMonitor'))
      if (!next) { cache.delete(identity); data.value = undefined; live(); state.value = 'unsupported'; return }
      if (data.value && (data.value.generation !== next.generation || data.value.statisticsStartTime !== next.statisticsStartTime || data.value.firstSequence !== next.firstSequence)) live()
      data.value = next
      cache.set(identity, next)
      if (cache.size > 32) cache.delete(cache.keys().next().value!)
      state.value = 'ready'
    } catch (error) {
      if (!controller.signal.aborted && revision === current) {
        if (!denied(error)) state.value = data.value ? 'stale' : 'error'
      }
    } finally {
      if (pending === controller) {
        pending = undefined
        if (enabled.value && !disposed && !halted && state.value !== 'unsupported') timer = setTimeout(refresh, diagnosticIntervalSeconds(interval.value) * 1000)
      }
    }
  }

  /** 大窗口只在点击峰值时加载一次；统计实例改变时拒绝拼接旧代次。 */
  async function select(selection: DevicePeakSelection) {
    const before = data.value
    if (!before || !enabled.value) return
    live()
    focus.value = selection
    const recent = peakNeighborhood(before.points, selection.peak)
    if (recent.length) { focusedPoints.value = recent; return }
    const controller = new AbortController(), current = revision
    peakRequest = controller
    busy.value = true
    try {
      const beans = sourceBeans(await queryDeviceMessageRecording(nodeId.value, controller.signal, true))
      if (controller.signal.aborted || current !== revision) return
      const next = readDeviceRecording(beans.find(bean => bean.type === 'DeviceMessageMonitor'), true)
      if (!next || next.generation !== before.generation || next.statisticsStartTime !== before.statisticsStartTime || next.firstSequence !== before.firstSequence) throw new Error('Device history changed')
      const points = peakNeighborhood(next.points, selection.peak)
      outside.value = points.length === 0
      focusedPoints.value = points.length ? points : undefined
    } catch (error) {
      if (!controller.signal.aborted && current === revision && !denied(error)) { state.value = 'stale'; live() }
    } finally {
      if (peakRequest === controller) { peakRequest = undefined; busy.value = false }
    }
  }

  watch(scope, () => { cancel(); cache.clear(); data.value = undefined; live() }, { flush: 'sync' })
  watch([nodeId, enabled, scope, generation], () => {
    cancel()
    if (owner !== key() || ownerGeneration !== generation.value) {
      owner = key(); ownerGeneration = generation.value
      data.value = cache.get(owner)
      if (data.value && generation.value && data.value.generation !== generation.value) { cache.delete(owner); data.value = undefined }
      live()
    }
    state.value = data.value ? 'ready' : 'loading'
    if (enabled.value) void refresh()
  }, { immediate: true, flush: 'sync' })
  watch(interval, () => { clearTimeout(timer); if (enabled.value && !pending && !halted && state.value !== 'unsupported') timer = setTimeout(refresh, diagnosticIntervalSeconds(interval.value) * 1000) })
  onScopeDispose(() => { disposed = true; cancel(); cache.clear() })
  const view = computed<DeviceRecordingView>(() => ({ data: data.value, points: focusedPoints.value ?? data.value?.points ?? [], state: state.value, busy: busy.value, active: enabled.value, focus: focus.value, outside: outside.value }))
  return { view, select, live, refresh }
}
