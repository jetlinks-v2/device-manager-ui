import i18n from '@jetlinks-web-core/locales'
import { getIotDeviceRiskKinds } from '@device-manager-ui/hooks/useIotDeviceStatus'

import type {
  GroupDashboardEvent,
  GroupDashboardAlarmItem,
  GroupDashboardQuickAction,
  GroupDashboardTrendPoint,
  GroupDashboardTrendSeries,
  GroupDashboardTypeDistributionItem,
  GroupDashboardTypeStat,
} from './groupDetailDashboard.types'
import type { GroupDetailDeviceRow, GroupDetailSectionStat } from './groupDetail.types'

const TYPE_COLORS = ['var(--jet-theme-primary)', 'var(--jet-theme-success)', 'var(--jet-theme-warning)', 'var(--jet-theme-error)', 'var(--jet-theme-primary)', 'var(--jet-theme-text-disabled)']
const $t = i18n.global.t

export function buildOverviewLegend(devices: GroupDetailDeviceRow[]) {
  const total = devices.length || 1
  const items = [
    { label: $t('IotDeviceGroups.legend.onlineDevices'), value: devices.filter((item) => item.status === 'online').length, color: 'var(--jet-theme-success)' },
    { label: $t('IotDeviceGroups.legend.offlineDevices'), value: devices.filter((item) => item.status === 'offline').length, color: 'var(--jet-theme-text-disabled)' },
    { label: $t('IotDeviceGroups.legend.alarmDevices'), value: devices.filter((item) => item.status === 'alarm').length, color: 'var(--jet-theme-error)' },
    { label: $t('IotDeviceGroups.legend.noDataDevices'), value: devices.filter((item) => item.status === 'no-data').length, color: 'var(--jet-theme-primary)' },
  ]
  return items.map((item) => ({
    ...item,
    share: Math.round((item.value / total) * 1000) / 10,
  }))
}

export function buildRunStats(
  devices: GroupDetailDeviceRow[],
  onlineRatePercent: number,
): Array<GroupDetailSectionStat & { delta: string; deltaTone: 'ok' | 'warn' | 'err' }> {
  const alarmCount = devices.reduce((sum, item) => sum + (item.alarms?.length ?? 0), 0)
  const todayMessages = devices.reduce((sum, item) => sum + (36 + seededNumber(`${item.id}-${item.productName}`, 180)), 0)
  const averageLatency = Math.round(devices.reduce((sum, item) => sum + deriveLatency(item), 0) / (devices.length || 1))
  const yesterdayOnlineRate = clamp(onlineRatePercent - 2 + seededNumber(`online-${devices.length}`, 4), 68, 99)
  const yesterdayAlarm = Math.max(alarmCount + seededSignedNumber(`alarm-${devices.length}`, 2), 0)
  const yesterdayMessages = Math.max(todayMessages - 800 + seededSignedNumber(`msg-${devices.length}`, 460), 100)
  const yesterdayLatency = Math.max(averageLatency + seededSignedNumber(`latency-${devices.length}`, 10), 18)

  return [
    {
      label: $t('IotDeviceGroups.stat.onlineRate'),
      value: `${onlineRatePercent}%`,
      hint: $t('IotDeviceGroups.stat.onlineRateHint'),
      tone: onlineRatePercent >= 90 ? 'ok' : onlineRatePercent >= 75 ? 'warn' : 'err',
      delta: formatSignedPercent(onlineRatePercent - yesterdayOnlineRate),
      deltaTone: onlineRatePercent >= yesterdayOnlineRate ? 'ok' : 'err',
    },
    {
      label: $t('IotDeviceGroups.runStat.todayAlarm'),
      value: alarmCount,
      hint: $t('IotDeviceGroups.runStat.todayAlarmHint'),
      tone: alarmCount ? 'warn' : 'ok',
      delta: formatSignedCount(alarmCount - yesterdayAlarm),
      deltaTone: alarmCount <= yesterdayAlarm ? 'ok' : 'err',
    },
    {
      label: $t('IotDeviceGroups.runStat.todayMessages'),
      value: todayMessages.toLocaleString(),
      hint: $t('IotDeviceGroups.runStat.todayMessagesHint'),
      tone: 'neutral',
      delta: formatSignedPercent(((todayMessages - yesterdayMessages) / Math.max(yesterdayMessages, 1)) * 100),
      deltaTone: todayMessages >= yesterdayMessages ? 'err' : 'ok',
    },
  ]
}

export function buildAlarmItems(
  devices: GroupDetailDeviceRow[],
): GroupDashboardAlarmItem[] {
  const activeAlarmDevices = devices.filter((item) => item.status === 'alarm' || (item.alarms?.length ?? 0) > 0).length
  const urgentDevices = devices.filter((item) => item.risk === 'urgent').length
  const offlineDevices = devices.filter((item) => item.status === 'offline' || item.status === 'no-data').length
  const dataIssueDevices = devices.filter((item) => {
    const riskKinds = getIotDeviceRiskKinds(item)
    return riskKinds.includes('data-deviation') || riskKinds.includes('fault-code')
  }).length

  return [
    { label: $t('IotDeviceGroups.alarmItem.activeAlarm'), value: activeAlarmDevices, tone: activeAlarmDevices ? 'err' : 'ok' },
    { label: $t('IotDeviceGroups.alarmItem.urgentDevices'), value: urgentDevices, tone: urgentDevices ? 'err' : 'ok' },
    { label: $t('IotDeviceGroups.alarmItem.offlineNoData'), value: offlineDevices, tone: offlineDevices ? 'warn' : 'ok' },
    { label: $t('IotDeviceGroups.alarmItem.dataIssue'), value: dataIssueDevices, tone: dataIssueDevices ? 'warn' : 'ok' },
  ]
}

export function buildTrendSeries(
  devices: GroupDetailDeviceRow[],
  onlineRatePercent: number,
): GroupDashboardTrendSeries[] {
  const labels = ['16:00', '20:00', '00:00', '04:00', '08:00', '12:00', '16:00']
  const alarms = devices.reduce((sum, item) => sum + (item.alarms?.length ?? 0), 0)
  const uplink = devices.reduce((sum, item) => sum + (36 + seededNumber(`${item.id}-${item.productName}`, 180)), 0)
  const downlink = Math.round(uplink * 0.27)

  return [
    {
      key: 'onlineRate',
      title: $t('IotDeviceGroups.trend.onlineRateTitle'),
      unit: '%',
      value: `${onlineRatePercent}%`,
      accent: 'var(--jet-theme-success)',
      points: buildMetricTrend(labels, onlineRatePercent, 3.2, 76, 100, $t('IotDeviceGroups.trend.onlineRateHigh')),
    },
    {
      key: 'alarmCount',
      title: $t('IotDeviceGroups.trend.alarmCountTitle'),
      unit: $t('IotDeviceGroups.unit.count'),
      value: `${alarms}`,
      accent: 'var(--jet-theme-error)',
      points: buildMetricTrend(labels, Math.max(alarms, 1), 1.2, 0, Math.max(alarms + 2, 3), $t('IotDeviceGroups.trend.alarmShiftRise')),
    },
    {
      key: 'uplink',
      title: $t('IotDeviceGroups.trend.uplinkTitle'),
      unit: $t('IotDeviceGroups.unit.message'),
      value: uplink.toLocaleString(),
      accent: 'var(--jet-theme-primary)',
      points: buildMetricTrend(labels, Math.round(uplink / 12), 180, 260, Math.round(uplink / 5), $t('IotDeviceGroups.trend.uplinkStable')),
    },
    {
      key: 'downlink',
      title: $t('IotDeviceGroups.trend.downlinkTitle'),
      unit: $t('IotDeviceGroups.unit.message'),
      value: downlink.toLocaleString(),
      accent: 'var(--jet-theme-primary)',
      points: buildMetricTrend(labels, Math.max(Math.round(downlink / 8), 1), 8, 0, Math.max(Math.round(downlink / 3), 8), $t('IotDeviceGroups.trend.downlinkDaytime')),
    },
  ]
}

export function buildTypeDistribution(typeStats: GroupDashboardTypeStat[]): GroupDashboardTypeDistributionItem[] {
  const total = typeStats.reduce((sum, item) => sum + item.total, 0) || 1
  return typeStats.map((item, index) => ({
    label: item.label,
    value: item.total,
    share: Math.round((item.total / total) * 1000) / 10,
    color: TYPE_COLORS[index % TYPE_COLORS.length],
  }))
}

export function buildQuickActions(): GroupDashboardQuickAction[] {
  return [
    { key: 'config', label: $t('IotDeviceGroups.quickAction.config'), icon: 'lucide:send', tone: 'primary' },
    { key: 'restart', label: $t('IotDeviceGroups.quickAction.restart'), icon: 'lucide:rotate-cw' },
    { key: 'upgrade', label: $t('IotDeviceGroups.quickAction.upgrade'), icon: 'lucide:wand-sparkles' },
    { key: 'export', label: $t('IotDeviceGroups.quickAction.export'), icon: 'lucide:file-output' },
    { key: 'append', label: $t('IotDeviceGroups.quickAction.append'), icon: 'lucide:plus' },
  ]
}

export function buildGroupEvents(
  devices: GroupDetailDeviceRow[],
  groupName: string,
): GroupDashboardEvent[] {
  const alarmDevice = devices.find((item) => item.status === 'alarm') ?? devices.find((item) => item.risk === 'urgent')
  const offlineDevice = devices.find((item) => item.status === 'offline' || item.status === 'no-data')
  const addedCount = Math.max(2, Math.min(12, Math.round(devices.length / 6)))
  const upgradedCount = Math.max(8, Math.min(120, Math.round(devices.length * 0.8)))

  return [
    {
      id: 'event-alarm',
      timeLabel: '10:30',
      title: $t('IotDeviceGroups.event.offlineAlarmTitle'),
      summary: offlineDevice
        ? $t('IotDeviceGroups.event.offlineAlarmDeviceSummary', { device: offlineDevice.name, group: groupName })
        : $t('IotDeviceGroups.event.offlineAlarmGroupSummary', { group: groupName }),
      tone: 'err',
    },
    {
      id: 'event-config',
      timeLabel: '09:15',
      title: $t('IotDeviceGroups.event.configSuccessTitle'),
      summary: $t('IotDeviceGroups.event.configSuccessSummary', { count: Math.max(12, Math.round(devices.length * 0.68)) }),
      tone: 'ok',
    },
    {
      id: 'event-add',
      timeLabel: $t('IotDeviceGroups.time.yesterdayTime', { time: '16:45' }),
      title: $t('IotDeviceGroups.event.deviceAddedTitle', { count: addedCount }),
      summary: $t('IotDeviceGroups.event.deviceAddedSummary', { count: addedCount }),
      tone: 'info',
    },
    {
      id: 'event-upgrade',
      timeLabel: $t('IotDeviceGroups.time.yesterdayTime', { time: '10:22' }),
      title: $t('IotDeviceGroups.event.upgradeSuccessTitle'),
      summary: $t('IotDeviceGroups.event.upgradeSuccessSummary', { count: upgradedCount }),
      tone: 'ok',
    },
    {
      id: 'event-alarm-focus',
      timeLabel: '08:12',
      title: $t('IotDeviceGroups.event.alarmFocusTitle'),
      summary: alarmDevice
        ? $t('IotDeviceGroups.event.alarmFocusDeviceSummary', { device: alarmDevice.name })
        : $t('IotDeviceGroups.event.alarmFocusGroupSummary', { group: groupName }),
      tone: alarmDevice ? 'warn' : 'ok',
    },
  ]
}

export function formatProjectLabel(projectId: string) {
  const dict: Record<string, string> = {
    doraemon: $t('IotDeviceGroups.project.doraemon'),
  }
  return dict[projectId] || projectId
}

export function buildMockCreatedAt(groupId: string) {
  const month = String(1 + seededNumber(`${groupId}-m`, 6)).padStart(2, '0')
  const day = String(10 + seededNumber(`${groupId}-d`, 16)).padStart(2, '0')
  const hour = String(9 + seededNumber(`${groupId}-h`, 8)).padStart(2, '0')
  const minute = String(10 + seededNumber(`${groupId}-min`, 40)).padStart(2, '0')
  return `2024-${month}-${day} ${hour}:${minute}:00`
}

export function buildGroupTypeLabel(devices: GroupDetailDeviceRow[]) {
  const winner = [...devices.reduce((map, item) => {
    map.set(item.productName, (map.get(item.productName) ?? 0) + 1)
    return map
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return winner || devices[0]?.deviceType || $t('IotDeviceGroups.groupType.default')
}

function deriveLatency(device: GroupDetailDeviceRow) {
  const base = 38 + seededNumber(`${device.id}-latency`, 28)
  if (device.status === 'alarm') return base + 14
  if (device.status === 'offline' || device.status === 'no-data') return base + 18
  if (device.risk === 'watch') return base + 8
  return base
}

function buildMetricTrend(
  labels: string[],
  base: number,
  amplitude: number,
  min: number,
  max: number,
  description: string,
): GroupDashboardTrendPoint[] {
  return labels.map((label, index) => {
    const wave = Math.sin((index / Math.max(labels.length - 1, 1)) * Math.PI * 2)
    const offset = seededSignedNumber(`${label}-${base}`, amplitude)
    const value = clamp(Math.round((base + wave * amplitude + offset) * 100) / 100, min, max)
    return { label, value, description }
  })
}

function seededNumber(text: string, max: number) {
  return Math.abs([...text].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)) % max
}

function seededSignedNumber(text: string, amplitude: number) {
  return seededNumber(text, amplitude * 2 + 1) - amplitude
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatSignedPercent(value: number) {
  const abs = Math.round(Math.abs(value) * 100) / 100
  return `${value >= 0 ? '↑' : '↓'} ${abs}%`
}

function formatSignedCount(value: number) {
  return `${value >= 0 ? '↑' : '↓'} ${Math.abs(value)}`
}
