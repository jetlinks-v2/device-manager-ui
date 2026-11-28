import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { deviceObservationCurrentPoint, formatDeviceObservationValue, type DeviceObservationSample, type DeviceObservationMetric } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics/types'

/** 摘要与详情共用速率口径；未知计数不补零，首对有效样本前保留局部骨架。 */
export function useDeviceConnectionMetrics(source: { history: DeviceObservationSample[]; state: ViewState; paused: boolean; requesting: boolean }) {
  const { t, locale } = useI18n()
  const point = computed(() => deviceObservationCurrentPoint(source.history))
  const format = (value: number | undefined, key: DeviceObservationMetric) => value === undefined ? t('IotDeviceDetail.connection.notProvided') : formatDeviceObservationValue(value, key, String(locale.value), t(`runtimeDiagnostics.deviceSessions.${key === 'messages' ? 'messagesUnit' : 'pendingUnit'}`))
  function waiting(key: DeviceObservationMetric) {
    if (source.paused || ['error','forbidden','unsupported'].includes(source.state.status) || key === 'pending' || point.value?.[key] !== undefined) return false
    if (source.state.status === 'loading' && !source.state.sampledAt) return true
    const sample = source.history.at(-1)
    return !!sample?.connections?.length && sample.connections.every(connection => connection[key] !== undefined)
  }
  const metrics = computed(() => (['receive','send','messages','pending'] as const).map(key => ({ key, value: format(point.value?.[key], key), loading: waiting(key) })))
  const traffic = computed(() => ({ key: 'traffic' as const, value: format(point.value?.receive !== undefined && point.value.send !== undefined ? point.value.receive + point.value.send : undefined, 'receive'), loading: waiting('receive') || waiting('send') }))
  return { metrics, traffic }
}
