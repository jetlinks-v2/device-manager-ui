import { computed, watch } from 'vue'
import { useNow } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { deviceObservationActivity, deviceSessionElapsed, formatDeviceSessionTimestamp } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DeviceConnectionObservation } from '../../deviceDetailConnection'

/** 只读取现有会话快照，不另起采样；连接、心跳和设备上报保持各自口径。 */
export function useDeviceConnectionContext(source: DeviceConnectionObservation, status: () => string) {
  const { t, locale } = useI18n()
  const now = useNow({ interval:10000 })
  const readable = computed(() => status() !== 'disabled' && source.access.allowed && !['forbidden','unsupported'].includes(source.state.status))
  const loading = computed(() => readable.value && source.state.status === 'loading' && !source.state.sampledAt)
  const current = computed(() => readable.value && status() === 'online' && !!source.state.sampledAt)
  const transport = computed(() => current.value ? [...new Set(source.sessions.map(session => session.transport).filter(Boolean))].join(' / ') : '')
  const connections = computed(() => current.value && source.sessions.every(session => Array.isArray(session.connections))
    ? source.sessions.reduce((count, session) => count + session.connections!.length, 0) : undefined)
  const sessions = computed(() => current.value && source.sessions.length > 1 ? source.sessions.length : undefined)
  const activity = computed(() => readable.value ? deviceObservationActivity(source.sessions).lastCommAt : undefined)
  watch(activity, () => { now.value = new Date() })
  const activityTime = computed(() => formatDeviceSessionTimestamp(activity.value, String(locale.value)))
  const activityText = computed(() => {
    if (!activityTime.value) return ''
    const elapsed = deviceSessionElapsed(activity.value, now.value.getTime())
    if (elapsed === undefined) return t('IotDeviceDetail.connection.communicationAt', { time:activityTime.value })
    if (elapsed < 60) return t('IotDeviceDetail.connection.communicationJustNow')
    const [divisor, unit] = elapsed >= 86400 ? [86400, 'day'] as const : elapsed >= 3600 ? [3600, 'hour'] as const : [60, 'minute'] as const
    const time = new Intl.RelativeTimeFormat(String(locale.value), { numeric:'always', style:'short' }).format(-Math.floor(elapsed / divisor), unit)
    return t('IotDeviceDetail.connection.communicationAgo', { time })
  })
  const unavailable = computed(() => !readable.value || source.paused || source.state.status === 'error')
  const hint = computed(() => !source.access.allowed || source.state.status === 'forbidden' ? t('runtimeDiagnostics.deviceSessions.forbidden')
    : source.state.status === 'unsupported' ? t('runtimeDiagnostics.deviceSessions.unsupported')
    : source.state.status === 'error' ? t('IotDeviceDetail.connection.refreshFailed')
    : source.paused ? t('runtimeDiagnostics.deviceSessions.paused') : t('IotDeviceDetail.connection.title'))
  const title = computed(() => [hint.value, activityTime.value && `${t('IotDeviceDetail.connection.lastCommunication')} · ${activityTime.value}`,
    source.state.sampledAt && t('IotDeviceDetail.connection.sampledAt', { time:formatDeviceSessionTimestamp(source.state.sampledAt, String(locale.value)) })].filter(Boolean).join('\n'))
  const label = computed(() => [hint.value, transport.value, connections.value !== undefined && t('IotDeviceDetail.connection.connectionCount', { count:connections.value }),
    sessions.value !== undefined && t('IotDeviceDetail.connection.sessionCount', { count:sessions.value }), activityText.value].filter(Boolean).join(' · '))
  const visible = computed(() => readable.value && (loading.value || !!transport.value || connections.value !== undefined || sessions.value !== undefined || !!activityText.value))
  return { loading, transport, connections, sessions, activityText, unavailable, title, label, visible }
}
