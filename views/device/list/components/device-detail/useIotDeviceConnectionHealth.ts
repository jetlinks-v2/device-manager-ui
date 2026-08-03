import { computed, ref, watch, type Ref } from 'vue'

import i18n from '@jetlinks-web-core/locales'
import { queryDashboard } from '@jetlinks-web-core/api/comm'
import type { IotDevice } from '../../types'

export type ConnectionWindow = 'today' | 'week' | 'month'
export type ConnectionTimelineState = 'online' | 'offline'

export interface ConnectionTimelineSegment {
  state: ConnectionTimelineState
  startTime: number
  endTime: number
  duration: number
  ratio: number
}

export interface ConnectionTimelineBucket {
  label: string
  startTime: number
  endTime: number
  duration: number
  onlineDuration: number
  offlineDuration: number
  onlineRate: number
  segments: ConnectionTimelineSegment[]
}

export interface ConnectionTimelineValue {
  from: number
  to: number
  onlineDuration: number
  offlineDuration: number
  onlineRate: number
  buckets: ConnectionTimelineBucket[]
}

export interface ConnectionWindowConfig {
  size: number
  label: string
  from: number
  to: number
  interval: string
  format: string
  bucketDuration: number
  formatter: (index: number) => string
  disconnectBase: number
}

const $t = i18n.global.t

export const connectionWindows = [
  { key: 'today' as const, label: $t('IotDeviceDetail.connectionHealth.window.today') },
  { key: 'week' as const, label: $t('IotDeviceDetail.connectionHealth.window.week') },
  { key: 'month' as const, label: $t('IotDeviceDetail.connectionHealth.window.month') },
]

export function useIotDeviceConnectionHealth(
  device: Ref<IotDevice>,
  hasOfflineRisk: Ref<boolean>,
) {
  const connectionWindow = ref<ConnectionWindow>('week')
  const timelineData = ref<ConnectionTimelineValue | null>(null)
  const loading = ref(false)

  const connectionWindowConfig = computed(() => getConnectionWindowConfig(connectionWindow.value))

  const insight = computed(() => {
    const current = device.value
    const dashboardValue = timelineData.value
    if (dashboardValue?.buckets.length) {
      return buildConnectionInsight(current, connectionWindowConfig.value, dashboardValue)
    }

    const mockValue = createMockConnectionTimeline(current, connectionWindow.value, connectionWindowConfig.value, hasOfflineRisk.value)
    return buildConnectionInsight(current, connectionWindowConfig.value, mockValue)
  })

  async function loadConnectionTimeline() {
    const deviceId = device.value?.id
    if (!deviceId) {
      timelineData.value = null
      return
    }

    const config = connectionWindowConfig.value
    loading.value = true
    try {
      const response: any = await queryDashboard([
        {
          dashboard: 'device',
          object: 'session',
          measurement: 'online',
          dimension: 'timeline',
          group: 'deviceOnlineTimeline',
          params: {
            deviceId,
            from: config.from,
            to: config.to,
            interval: config.interval,
            time: config.interval,
            format: config.format,
          },
        },
      ] as any)
      const rows = Array.isArray(response?.result)
        ? response.result
        : Array.isArray(response?.data?.result)
          ? response.data.result
          : Array.isArray(response)
            ? response
            : []
      const value = rows[0]?.data?.value ?? rows[0]?.value ?? rows[0]?.data
      timelineData.value = normalizeConnectionTimelineValue(value)
    } catch (error) {
      timelineData.value = null
    } finally {
      loading.value = false
    }
  }

  watch(
    () => [device.value?.id, connectionWindow.value],
    () => {
      void loadConnectionTimeline()
    },
    { immediate: true },
  )

  return {
    connectionWindow,
    connectionWindows,
    connectionWindowConfig,
    insight,
    loading,
    reload: loadConnectionTimeline,
  }
}

function getConnectionWindowConfig(window: ConnectionWindow): ConnectionWindowConfig {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = now.getTime()
  const configs = {
    today: {
      size: 12,
      label: $t('IotDeviceDetail.connectionHealth.windowStatus.today'),
      from: startOfToday.getTime(),
      to: end,
      interval: '2h',
      format: 'HH:mm',
      bucketDuration: 2 * 60 * 60 * 1000,
      formatter: (index: number) => `${String(index * 2).padStart(2, '0')}:00`,
      disconnectBase: 1,
    },
    week: {
      size: 7,
      label: $t('IotDeviceDetail.connectionHealth.windowStatus.week'),
      from: end - 7 * 24 * 60 * 60 * 1000,
      to: end,
      interval: '1d',
      format: 'MM-dd',
      bucketDuration: 24 * 60 * 60 * 1000,
      formatter: (index: number) => formatTime(end - (6 - index) * 24 * 60 * 60 * 1000, 'MM-dd'),
      disconnectBase: 3,
    },
    month: {
      size: 30,
      label: $t('IotDeviceDetail.connectionHealth.windowStatus.month'),
      from: end - 30 * 24 * 60 * 60 * 1000,
      to: end,
      interval: '1d',
      format: 'MM-dd',
      bucketDuration: 24 * 60 * 60 * 1000,
      formatter: (index: number) => formatTime(end - (29 - index) * 24 * 60 * 60 * 1000, 'MM-dd'),
      disconnectBase: 5,
    },
  }
  return configs[window]
}

function buildConnectionInsight(device: IotDevice, config: ConnectionWindowConfig, value: ConnectionTimelineValue) {
  const disconnectCount = value.buckets.reduce((total, item) => {
    return total + item.segments.filter((segment) => segment.state === 'offline' && segment.duration > 0).length
  }, 0)
  const offlineDurations = value.buckets.flatMap((item) => item.segments
    .filter((segment) => segment.state === 'offline')
    .map((segment) => segment.duration))
  return {
    windowLabel: config.label,
    buckets: value.buckets,
    onlineRateValue: value.onlineRate,
    onlineRate: formatPercent(value.onlineRate),
    disconnectCount,
    onlineDuration: formatDuration(value.onlineDuration),
    latestOfflineDuration: formatDuration(Math.max(...offlineDurations, 0)),
    firstSeen: formatTime(value.from),
    lastOfflineAt: getLastOfflineTime(value.buckets) || $t('IotDeviceDetail.connectionHealth.noOfflineRecord'),
    events: [
      { time: formatTime(value.from), title: $t('IotDeviceDetail.connectionHealth.event.firstOnline'), detail: $t('IotDeviceDetail.connectionHealth.event.firstOnlineDetail', { name: device.name }) },
      { time: getLastOnlineTime(value.buckets) || device.lastSeen || formatTime(value.to), title: $t('IotDeviceDetail.connectionHealth.event.latestOnline'), detail: $t('IotDeviceDetail.connectionHealth.event.latestOnlineDetail', { status: deviceStatusLabel(device.status) }) },
      { time: getLastOfflineTime(value.buckets) || $t('IotDeviceDetail.connectionHealth.noOfflineRecord'), title: $t('IotDeviceDetail.connectionHealth.event.latestOffline'), detail: disconnectCount ? $t('IotDeviceDetail.connectionHealth.event.offlineFoundDetail') : $t('IotDeviceDetail.connectionHealth.event.noOfflineDetail') },
    ],
  }
}

function createMockConnectionTimeline(
  device: IotDevice,
  window: ConnectionWindow,
  config: ConnectionWindowConfig,
  hasOfflineRisk: boolean,
): ConnectionTimelineValue {
  const seed = hashSeed(device?.id ?? 'device-health')
  const buckets = Array.from({ length: config.size }, (_, index) => {
    const riskHit = hasOfflineRisk && ((seed + index * 3) % (window === 'today' ? 3 : 4) === 0)
    const finalOffline = device?.status === 'offline' && index >= config.size - 2
    const startTime = config.from + index * config.bucketDuration
    return createConnectionTimelineBucket(
      config.formatter(index),
      startTime,
      config.bucketDuration,
      seed,
      index,
      riskHit || finalOffline,
    )
  })
  const onlineDuration = buckets.reduce((total, item) => total + item.onlineDuration, 0)
  const offlineDuration = buckets.reduce((total, item) => total + item.offlineDuration, 0)
  return {
    from: config.from,
    to: config.to,
    onlineDuration,
    offlineDuration,
    onlineRate: ratio(onlineDuration, onlineDuration + offlineDuration),
    buckets,
  }
}

function createConnectionTimelineBucket(
  label: string,
  startTime: number,
  duration: number,
  seed: number,
  index: number,
  hasOffline: boolean,
): ConnectionTimelineBucket {
  const endTime = startTime + duration
  const offlineRatio = hasOffline
    ? clamp(0.18 + ((seed + index * 7) % 24) / 100, 0.12, 0.48)
    : clamp(((seed + index * 5) % 8) / 100, 0, 0.08)
  const offlineDuration = Math.round(duration * offlineRatio)
  const firstOnlineDuration = hasOffline
    ? Math.round((duration - offlineDuration) * clamp(0.35 + ((seed + index) % 25) / 100, 0.25, 0.7))
    : duration - offlineDuration
  const tailOnlineDuration = duration - offlineDuration - firstOnlineDuration
  const segments: ConnectionTimelineSegment[] = []
  let cursor = startTime

  if (firstOnlineDuration > 0) {
    segments.push(createConnectionSegment('online', cursor, cursor + firstOnlineDuration, duration))
    cursor += firstOnlineDuration
  }
  if (offlineDuration > 0) {
    segments.push(createConnectionSegment('offline', cursor, cursor + offlineDuration, duration))
    cursor += offlineDuration
  }
  if (tailOnlineDuration > 0) {
    segments.push(createConnectionSegment('online', cursor, endTime, duration))
  }

  const onlineDuration = segments
    .filter((segment) => segment.state === 'online')
    .reduce((total, segment) => total + segment.duration, 0)

  return {
    label,
    startTime,
    endTime,
    duration,
    onlineDuration,
    offlineDuration: duration - onlineDuration,
    onlineRate: ratio(onlineDuration, duration),
    segments,
  }
}

function normalizeConnectionTimelineValue(value: any): ConnectionTimelineValue | null {
  if (!value || !Array.isArray(value.buckets)) return null
  const buckets = value.buckets
    .map(normalizeConnectionTimelineBucket)
    .filter((item: ConnectionTimelineBucket | null): item is ConnectionTimelineBucket => Boolean(item))
  if (!buckets.length) return null

  const onlineDuration = toNumber(value.onlineDuration, buckets.reduce((total, item) => total + item.onlineDuration, 0))
  const offlineDuration = toNumber(value.offlineDuration, buckets.reduce((total, item) => total + item.offlineDuration, 0))
  const totalDuration = onlineDuration + offlineDuration
  return {
    from: toNumber(value.from, buckets[0].startTime),
    to: toNumber(value.to, buckets[buckets.length - 1].endTime),
    onlineDuration,
    offlineDuration,
    onlineRate: toNumber(value.onlineRate, ratio(onlineDuration, totalDuration)),
    buckets,
  }
}

function normalizeConnectionTimelineBucket(value: any): ConnectionTimelineBucket | null {
  if (!value || !Array.isArray(value.segments)) return null
  const startTime = toNumber(value.startTime ?? value.timestamp, 0)
  const endTime = toNumber(value.endTime, startTime)
  const duration = Math.max(toNumber(value.duration, endTime - startTime), 0)
  if (duration <= 0) return null

  const segments = value.segments
    .map((segment: any) => normalizeConnectionTimelineSegment(segment, duration))
    .filter((item: ConnectionTimelineSegment | null): item is ConnectionTimelineSegment => Boolean(item))
  const onlineDuration = toNumber(value.onlineDuration, segments
    .filter((segment) => segment.state === 'online')
    .reduce((total, segment) => total + segment.duration, 0))

  return {
    label: String(value.label ?? value.timeString ?? formatTime(startTime, 'MM-dd')),
    startTime,
    endTime,
    duration,
    onlineDuration,
    offlineDuration: toNumber(value.offlineDuration, Math.max(duration - onlineDuration, 0)),
    onlineRate: toNumber(value.onlineRate, ratio(onlineDuration, duration)),
    segments,
  }
}

function normalizeConnectionTimelineSegment(value: any, bucketDuration: number): ConnectionTimelineSegment | null {
  if (!value || (value.state !== 'online' && value.state !== 'offline')) return null
  const startTime = toNumber(value.startTime, 0)
  const endTime = toNumber(value.endTime, startTime)
  const duration = Math.max(toNumber(value.duration, endTime - startTime), 0)
  if (duration <= 0) return null
  return {
    state: value.state,
    startTime,
    endTime,
    duration,
    ratio: toNumber(value.ratio, ratio(duration, bucketDuration)),
  }
}

function createConnectionSegment(state: ConnectionTimelineState, startTime: number, endTime: number, bucketDuration: number): ConnectionTimelineSegment {
  return {
    state,
    startTime,
    endTime,
    duration: endTime - startTime,
    ratio: ratio(endTime - startTime, bucketDuration),
  }
}

export function connectionSegmentTitle(bucket: ConnectionTimelineBucket, segment: ConnectionTimelineSegment) {
  const currentState = segment.state === 'online' ? $t('IotDeviceDetail.common.status.online') : $t('IotDeviceDetail.common.status.offline')
  return [
    $t('IotDeviceDetail.connectionHealth.segment.onlineRate', { label: bucket.label, rate: formatPercent(bucket.onlineRate) }),
    $t('IotDeviceDetail.connectionHealth.segment.onlineDuration', { duration: formatDuration(bucket.onlineDuration) }),
    $t('IotDeviceDetail.connectionHealth.segment.offlineDuration', { duration: formatDuration(bucket.offlineDuration) }),
    `${currentState} ${formatTime(segment.startTime, 'fullSecond')} - ${formatTime(segment.endTime, 'fullSecond')}`,
  ].join('\n')
}

function getLastOfflineTime(buckets: ConnectionTimelineBucket[]) {
  const segment = buckets
    .flatMap((bucket) => bucket.segments)
    .filter((item) => item.state === 'offline')
    .sort((left, right) => right.endTime - left.endTime)[0]
  return segment ? `${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}` : ''
}

function getLastOnlineTime(buckets: ConnectionTimelineBucket[]) {
  const segment = buckets
    .flatMap((bucket) => bucket.segments)
    .filter((item) => item.state === 'online')
    .sort((left, right) => right.endTime - left.endTime)[0]
  return segment ? formatTime(segment.endTime) : ''
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`
}

function formatDuration(duration: number) {
  if (duration <= 0) return $t('IotDeviceDetail.common.duration.minutes', { count: 0 })
  const minutes = Math.round(duration / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const restMinutes = minutes % 60
  if (days) return $t('IotDeviceDetail.common.duration.daysHours', { days, hours })
  if (hours) return $t('IotDeviceDetail.common.duration.hoursMinutes', { hours, minutes: restMinutes })
  return $t('IotDeviceDetail.common.duration.minutes', { count: restMinutes })
}

function ratio(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 10000) / 10000
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function formatTime(value: number, mode: 'full' | 'fullSecond' | 'MM-dd' = 'full') {
  if (!value) return '-'
  const date = new Date(value)
  const pad = (numberValue: number) => String(numberValue).padStart(2, '0')
  const dateText = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timeText = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const timeTextWithSecond = `${timeText}:${pad(date.getSeconds())}`
  if (mode === 'MM-dd') return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  if (mode === 'fullSecond') return `${dateText} ${timeTextWithSecond}`
  return `${dateText} ${timeText}`
}

function hashSeed(text: string) {
  return text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function deviceStatusLabel(status: IotDevice['status']) {
  if (status === 'online') return $t('IotDeviceDetail.common.status.online')
  if (status === 'offline') return $t('IotDeviceDetail.common.status.offline')
  if (status === 'disabled') return $t('IotDeviceDetail.common.status.disabled')
  if (status === 'no-data') return $t('IotDeviceDetail.common.status.noData')
  if (status === 'alarm') return $t('IotDeviceDetail.common.status.alarm')
  return status
}
