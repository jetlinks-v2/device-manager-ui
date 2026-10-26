import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { appendDeviceObservation, deviceObservationSample, deviceObservationColors, deviceObservationMetrics, type DeviceObservationEntry, type DeviceObservationMetric } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryDeviceSessions } from '../../../../api/link/diagnostics'
import { normalizeDeviceSessions } from '../../diagnostics/useDeviceSessions'
import { diagnosticErrorState } from '../../diagnostics/status'

interface ObservationJob { id: string; dueAt: number; finishedAt?: number; controller?: AbortController; halted?: boolean; manual?: boolean }
interface ObservationPreferences { devices: Array<{ id: string; label: string }>; interval: number; metrics: DeviceObservationMetric[] }
const intervals = [5, 10, 30, 60]
const storageKey = (scope: string) => `runtime-device-observation:v1:${scope}`

/** 五设备共享有界调度；每设备完成后计时，暂停保留快照，身份/授权变化清除证据。 */
export function useDeviceObservation(active: Ref<boolean>, permitted: Ref<boolean>, capability: Ref<boolean>, scope: Ref<string>, supported: Ref<boolean | undefined> = ref(undefined)) {
  const entries = shallowRef<DeviceObservationEntry[]>([]), interval = ref(5), metrics = ref<DeviceObservationMetric[]>([...deviceObservationMetrics]), paused = ref(false)
  const jobs = new Map<string, ObservationJob>(), running = new Set<ObservationJob>()
  const readable = computed(() => active.value && permitted.value && capability.value)
  let timer: ReturnType<typeof setTimeout> | undefined, disposed = false, restoring = false
  const current = (job: ObservationJob, manual = false) => !disposed && active.value && permitted.value && capability.value && (manual || !paused.value) && jobs.get(job.id) === job
  function update(id: string, patch: Partial<DeviceObservationEntry>) { entries.value = entries.value.map(entry => entry.id === id ? { ...entry, ...patch } : entry) }
  function persist() {
    if (restoring || !scope.value || !permitted.value) return
    const value: ObservationPreferences = { devices: entries.value.map(({ id, label }) => ({ id, label })), interval: interval.value, metrics: metrics.value }
    try { localStorage.setItem(storageKey(scope.value), JSON.stringify(value)) } catch { /* 存储不可用只影响偏好恢复。 */ }
  }
  function interrupt() {
    clearTimeout(timer); timer = undefined
    for (const [id, job] of jobs) { job.controller?.abort(); jobs.set(id, { id, dueAt: Date.now(), halted: job.halted }) }
    running.clear()
    entries.value = entries.value.map(entry => ({ ...entry, collecting: false, history: entry.history.length ? appendDeviceObservation(entry.history, { sampledAt: Date.now(), interrupted: true }) : [] }))
  }
  function clear() { interrupt(); jobs.clear(); entries.value = [] }
  async function sample(job: ObservationJob, manual = false) {
    const controller = new AbortController(); job.controller = controller; running.add(job); update(job.id, { collecting: true })
    try {
      const sessions = normalizeDeviceSessions(await queryDeviceSessions(job.id, controller.signal))
      if (sessions.some(session => session.deviceId && session.deviceId !== job.id)) throw new Error('Device session identity mismatch')
      if (!current(job, manual)) return
      const previous = entries.value.find(entry => entry.id === job.id)!, sampledAt = Date.now()
      update(job.id, { sessions, history: appendDeviceObservation(previous.history, deviceObservationSample(sessions, sampledAt)), state: { status: sessions.length ? 'ready' : 'empty', sampledAt } })
    } catch (error) {
      if (!current(job, manual)) return
      const previous = entries.value.find(entry => entry.id === job.id)!, failure = diagnosticErrorState(error)
      if (failure.status === 'forbidden' || failure.status === 'unsupported') {
        job.halted = true
        update(job.id, { sessions: [], history: [], state: failure })
      } else update(job.id, { history: appendDeviceObservation(previous.history, { sampledAt: Date.now(), interrupted: true }), state: { ...failure, status: previous.state.sampledAt === undefined ? 'error' : 'stale', sampledAt: previous.state.sampledAt } })
    } finally {
      running.delete(job)
      if (current(job, manual)) { job.controller = undefined; job.manual = false; job.finishedAt = Date.now(); job.dueAt = job.finishedAt + interval.value * 1000; update(job.id, { collecting: false }) }
      pump()
    }
  }
  function pump() {
    clearTimeout(timer); timer = undefined
    if (!active.value || !permitted.value || !capability.value || disposed) return
    const ready = [...jobs.values()].filter(job => !job.halted && !running.has(job) && (!paused.value || job.manual)).sort((a, b) => a.dueAt - b.dueAt)
    for (const job of ready) { if (running.size >= 3 || job.dueAt > Date.now()) break; void sample(job, job.manual) }
    const next = ready.filter(job => !running.has(job))
    if (running.size < 3 && next.length) timer = setTimeout(pump, Math.max(0, next[0].dueAt - Date.now()))
  }
  function add(id: string, label = id) {
    const value = id.trim()
    if (!permitted.value || !value || value.length > 256) return false
    if (jobs.has(value)) {
      if (label.trim() && label.trim() !== value) { update(value, { label: label.trim() }); persist() }
      return true
    }
    if (entries.value.length >= 5) return false
    // 暂停期间新增设备仍取得一次初始快照，随后保持暂停，不显示永不结束的假采集。
    jobs.set(value, { id: value, dueAt: Date.now(), manual: paused.value })
    const color = deviceObservationColors.find(value => !entries.value.some(entry => entry.color === value)) ?? deviceObservationColors[0]
    entries.value = [...entries.value, { id: value, label: label.trim() || value, color, sessions: [], history: [], state: { status: 'loading' }, collecting: false }]
    persist(); pump(); return true
  }
  function remove(id: string) {
    const job = jobs.get(id); job?.controller?.abort(); if (job) running.delete(job)
    jobs.delete(id); entries.value = entries.value.filter(entry => entry.id !== id); persist(); pump()
  }
  function refresh(id?: string) {
    if (!active.value || !permitted.value || !capability.value) return
    for (const job of jobs.values()) if ((!id || job.id === id) && !running.has(job)) { job.halted = false; job.dueAt = Date.now(); job.manual = true }
    // 暂停观测时仍允许一次显式刷新，随后回到暂停状态。
    pump()
  }
  // 每次进入且授权/能力就绪时立即取一次快照，暂停偏好只停止后续周期采样。
  watch(readable, enabled => {
    if (!enabled) { interrupt(); return }
    for (const job of jobs.values()) if (!job.halted && !running.has(job)) { job.dueAt = Date.now(); job.manual = paused.value }
    pump()
  }, { immediate: true, flush: 'sync' })
  watch(paused, value => { if (readable.value) { if (value) interrupt(); else pump() } }, { flush: 'sync' })
  watch(supported, value => {
    if (value === false) {
      interrupt()
      entries.value = entries.value.map(entry => ({ ...entry, sessions: [], history: [], state: { status: 'unsupported' } }))
    }
  }, { flush: 'sync' })
  watch([scope, permitted], ([key, permission], previous) => {
    if (previous?.[0] === key && permission) return
    clear()
    if (!permission || !key) return
    restoring = true
    interval.value = 5; metrics.value = [...deviceObservationMetrics]; paused.value = false
    try {
      const value = JSON.parse(localStorage.getItem(storageKey(key)) || '{}') as Partial<ObservationPreferences>
      if (intervals.includes(Number(value.interval))) interval.value = Number(value.interval)
      // 旧单指标偏好保留设备与频率；首次使用多指标布局默认全部显示。
      if (Array.isArray(value.metrics)) metrics.value = deviceObservationMetrics.filter(metric => value.metrics!.includes(metric))
      for (const device of Array.isArray(value.devices) ? value.devices.slice(0, 5) : []) if (typeof device.id === 'string') add(device.id, typeof device.label === 'string' ? device.label : device.id)
    } catch { /* 损坏偏好不影响查询。 */ }
    finally { restoring = false }
  }, { immediate: true, flush: 'sync' })
  watch(interval, () => {
    if (!intervals.includes(interval.value)) interval.value = 5
    for (const job of jobs.values()) if (job.finishedAt !== undefined && !job.manual) job.dueAt = job.finishedAt + interval.value * 1000
    persist(); pump()
  })
  watch(metrics, persist)
  onScopeDispose(() => { disposed = true; clear() })
  return { entries, interval, metrics, paused, add, remove, refresh }
}
