import { computed, onActivated, onDeactivated, onScopeDispose, ref, watch } from 'vue'
import { useDocumentVisibility, useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { appendDeviceObservation, deviceObservationSample, defaultDiagnosticSamplingInterval, type DiagnosticSamplingInterval, type DeviceObservationSample } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DeviceSessionInfo, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics/types'
import { queryDeviceConnectionSessions_api } from '../../api/deviceConnection'
import { getIotDeviceListMenuCode } from '../../views/device/list/hooks/useIotDeviceRouting'

/** 在线摘要与展开面板共用采样；对象、权限及页面生命周期隔离迟到响应。 */
export function useDeviceConnectionObservation(props: { deviceId: string; projectId?: string; status: string }) {
  const { t } = useI18n(), auth = useAuthStore(), menu = useMenuStore(), route = useRoute()
  const open = ref(false), paused = ref(false), active = ref(true), requesting = ref(false)
  const narrow = useMediaQuery('(max-width: 600px)'), visibility = useDocumentVisibility()
  const interval = ref<DiagnosticSamplingInterval>(defaultDiagnosticSamplingInterval)
  const sessions = ref<DeviceSessionInfo[]>([]), history = ref<DeviceObservationSample[]>([])
  const state = ref<ViewState>({ status: 'ready' })
  const access = computed(() => ({ allowed: !!props.deviceId && (auth.hasPermission([`${getIotDeviceListMenuCode(route)}:query`, 'device/Instance:query']) || menu.hasMenu(getIotDeviceListMenuCode(route))) }))
  const eligible = computed(() => (open.value || props.status === 'online') && active.value && visibility.value === 'visible' && access.value.allowed)
  const collecting = computed(() => eligible.value && !paused.value && !['forbidden', 'unsupported'].includes(state.value.status))
  let generation = 0, disposed = false, timer: ReturnType<typeof setTimeout> | undefined
  const current = (epoch: number, id: string) => !disposed && epoch === generation && id === props.deviceId
  function stop() { generation++; if (timer !== undefined) clearTimeout(timer); timer = undefined; requesting.value = false }
  function interrupt() {
    if (history.value.length && !history.value.at(-1)?.interrupted) history.value = appendDeviceObservation(history.value, { sampledAt: Date.now(), interrupted: true }).slice(-3)
  }
  async function load() {
    if (!eligible.value || requesting.value || disposed) return
    const epoch = generation, id = props.deviceId
    requesting.value = true
    if (!state.value.sampledAt) state.value = { status: 'loading' }
    try {
      const result = await queryDeviceConnectionSessions_api(id)
      if (!current(epoch, id)) return
      if (result.status !== 200 || !Array.isArray(result.result)) throw Object.assign(new Error(t('IotDeviceDetail.connection.loadFailed')), { status: result.status })
      sessions.value = result.result
      const sampledAt = Date.now()
      history.value = appendDeviceObservation(history.value, deviceObservationSample(result.result, sampledAt)).slice(-3)
      state.value = { status: result.result.length ? 'ready' : 'empty', sampledAt }
    } catch (error) {
      if (!current(epoch, id)) return
      const failure = error as { status?: number; response?: { status?: number } }
      const status = failure?.response?.status ?? failure?.status
      if (status === 403 || status === 401 || status === 404 || status === 501) {
        sessions.value = []; history.value = []
        state.value = { status: status === 403 || status === 401 ? 'forbidden' : 'unsupported', message: t('IotDeviceDetail.connection.loadFailed') }
      } else {
        interrupt()
        state.value = { ...state.value, status: 'error', message: t('IotDeviceDetail.connection.loadFailed') }
      }
    } finally {
      if (current(epoch, id)) {
        requesting.value = false
        if (collecting.value) {
          // 首对累计计数以1秒间隔建立速率，随后恢复用户的采样周期。
          const initialRate = history.value.length === 1 && !!history.value[0].connections?.length
          const delay = initialRate ? Math.min(interval.value, 1) : interval.value
          timer = setTimeout(() => { timer = undefined; void load() }, delay * 1000)
        }
      }
    }
  }
  function refresh() { if (requesting.value) return; stop(); interrupt(); if (eligible.value) { state.value = { ...state.value, status: 'ready' }; void load() } }
  watch([collecting, interval], () => { stop(); interrupt(); if (collecting.value) void load(); else if (state.value.status === 'loading') state.value = { status: 'ready' } }, { flush: 'sync', immediate: true })
  watch([() => props.deviceId, () => props.projectId], () => {
    stop(); open.value = false; sessions.value = []; history.value = []; state.value = { status: 'ready' }
    if (collecting.value) void load()
  }, { flush: 'sync' })
  watch(() => access.value.allowed, allowed => { if (!allowed) { stop(); sessions.value = []; history.value = []; state.value = { status: 'forbidden' } } else if (state.value.status === 'forbidden') state.value = { status: 'ready' } }, { flush: 'sync' })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false; open.value = false })
  onScopeDispose(() => { disposed = true; stop() })
  return { open, narrow, paused, interval, sessions, history, state, access, requesting, collecting, refresh }
}
