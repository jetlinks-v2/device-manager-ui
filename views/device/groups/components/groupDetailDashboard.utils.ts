import i18n from '@jetlinks-web-core/locales'
import { getIotDeviceBusinessStatuses, getIotDeviceRiskKinds } from '@device-manager-ui/hooks/useIotDeviceStatus'
import type { IotDevice } from '@device-manager-ui/types'
import { buildIotDeviceOverviewPath } from '@device-manager-ui/views/device/list/hooks/useIotDeviceRouting'

import type {
  GroupDashboardExceptionItem,
  GroupDashboardOwnerLoad,
  GroupDashboardStatusSlice,
  GroupDashboardTableRow,
  GroupDashboardTypeStat,
  GroupDashboardWatchDevice,
} from './groupDetailDashboard.types'
import type { GroupDetailDeviceRow } from './groupDetail.types'

const $t = i18n.global.t

export function toGroupDetailDeviceRow(
  device: IotDevice,
  statusMeta: (status: IotDevice['status']) => { label: string },
): GroupDetailDeviceRow {
  const healthScore = Math.max(
    28,
    Math.min(
      98,
      100
        - (device.risk === 'urgent' ? 28 : 0)
        - (device.risk === 'watch' ? 12 : 0)
        - (device.status !== 'online' ? 16 : 0),
    ),
  )

  return {
    ...device,
    healthScore,
    statusLabel: statusMeta(device.status).label,
    summaryText: device.summary || device.aiSummary.conclusion,
    tagsPreview: [...device.tags].slice(0, 3),
  }
}

export function toGroupDashboardTableRow(
  device: GroupDetailDeviceRow,
): GroupDashboardTableRow {
  const anomalyTags = buildAnomalyTags(device)
  return {
    ...device,
    signalStrength: clamp(42 + seededNumber(device.id, 36), 35, 96),
    todayMessages: 36 + seededNumber(`${device.id}-${device.productName}`, 180),
    anomalyTags,
  }
}

export function buildStatusSlices(devices: GroupDetailDeviceRow[], fallbackTotal = devices.length): GroupDashboardStatusSlice[] {
  const total = fallbackTotal || devices.length || 1
  const source: Array<Pick<GroupDashboardStatusSlice, 'key' | 'label' | 'value' | 'tone'>> = [
    { key: 'online', label: $t('IotDeviceGroups.status.online'), value: devices.filter((item) => item.status === 'online').length, tone: 'ok' as const },
    { key: 'offline', label: $t('IotDeviceGroups.status.offline'), value: devices.filter((item) => item.status === 'offline').length, tone: 'err' as const },
    { key: 'alarm', label: $t('IotDeviceGroups.status.alarm'), value: devices.filter((item) => item.status === 'alarm').length, tone: 'err' as const },
    { key: 'no-data', label: $t('IotDeviceGroups.status.noData'), value: devices.filter((item) => item.status === 'no-data').length, tone: 'warn' as const },
  ]

  return source.map((item) => ({
    ...item,
    share: Math.round((item.value / total) * 100),
    description: item.value
      ? $t('IotDeviceGroups.statusSlice.description', { value: item.value, label: item.label })
      : $t('IotDeviceGroups.statusSlice.empty', { label: item.label }),
  }))
}

export function buildTypeStats(devices: GroupDetailDeviceRow[]): GroupDashboardTypeStat[] {
  return [...devices.reduce((map, item) => {
    const current = map.get(item.deviceType) ?? { label: item.deviceType, total: 0, online: 0, attention: 0 }
    current.total += 1
    if (item.status === 'online') current.online += 1
    if (item.risk !== 'normal' || item.status !== 'online') current.attention += 1
    map.set(item.deviceType, current)
    return map
  }, new Map<string, GroupDashboardTypeStat>()).values()]
    .sort((a, b) => b.total - a.total || b.attention - a.attention)
    .slice(0, 6)
}

export function buildExceptionItems(devices: GroupDetailDeviceRow[], projectId: string): GroupDashboardExceptionItem[] {
  const offlineDevices = devices.filter((item) => getIotDeviceRiskKinds(item).includes('offline-frequent'))
  const alarmDevices = devices.filter((item) => item.status === 'alarm' || (item.alarms?.length ?? 0) > 0)
  const deviationDevices = devices.filter((item) => getIotDeviceRiskKinds(item).includes('data-deviation'))
  const faultDevices = devices.filter((item) => getIotDeviceRiskKinds(item).includes('fault-code'))

  return [
    createExceptionItem('offline-frequent', $t('IotDeviceGroups.exception.offlineDevices'), offlineDevices, $t('IotDeviceGroups.exception.offlineFrequentDesc'), buildIotDeviceOverviewPath(projectId, 'offline-frequent')),
    createExceptionItem('alarm', $t('IotDeviceGroups.exception.alarmDevices'), alarmDevices, $t('IotDeviceGroups.exception.alarmDevicesDesc'), buildIotDeviceOverviewPath(projectId)),
    createExceptionItem('data-deviation', $t('IotDeviceGroups.exception.dataAbnormalDevices'), faultDevices.length ? faultDevices : deviationDevices, $t('IotDeviceGroups.exception.dataAbnormalDevicesDesc'), buildIotDeviceOverviewPath(projectId, 'data-deviation')),
  ]
}

export function buildOwnerLoads(devices: GroupDetailDeviceRow[]): GroupDashboardOwnerLoad[] {
  return [...devices.reduce((map, item) => {
    const current = map.get(item.owner) ?? { owner: item.owner || $t('IotDeviceGroups.owner.unassigned'), total: 0, urgent: 0, attention: 0 }
    current.total += 1
    if (item.risk === 'urgent') current.urgent += 1
    if (item.risk !== 'normal' || item.status !== 'online') current.attention += 1
    map.set(item.owner, current)
    return map
  }, new Map<string, GroupDashboardOwnerLoad>()).values()]
    .sort((a, b) => b.urgent - a.urgent || b.attention - a.attention || b.total - a.total)
    .slice(0, 6)
}

export function buildWatchDevices(
  devices: GroupDetailDeviceRow[],
  riskMeta: (risk: GroupDetailDeviceRow['risk']) => { label: string; tone: 'ok' | 'warn' | 'err' },
): GroupDashboardWatchDevice[] {
  return [...devices]
    .sort((a, b) => {
      const scoreA = (a.risk === 'urgent' ? 40 : a.risk === 'watch' ? 20 : 0) + (a.status !== 'online' ? 16 : 0)
      const scoreB = (b.risk === 'urgent' ? 40 : b.risk === 'watch' ? 20 : 0) + (b.status !== 'online' ? 16 : 0)
      return scoreB - scoreA || a.healthScore - b.healthScore
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      owner: item.owner,
      area: item.area,
      statusLabel: item.statusLabel,
      riskLabel: riskMeta(item.risk).label,
      tone: item.risk === 'urgent' ? 'err' : item.risk === 'watch' || item.status !== 'online' ? 'warn' : 'ok',
      healthScore: item.healthScore,
    }))
}

export function countMaintenanceDevices(devices: GroupDetailDeviceRow[]) {
  return devices.filter((item) => getIotDeviceBusinessStatuses(item).includes('maintenance')).length
}

function createExceptionItem(
  key: GroupDashboardExceptionItem['key'],
  label: string,
  devices: GroupDetailDeviceRow[],
  description: string,
  overviewPath: string,
): GroupDashboardExceptionItem {
  return {
    key,
    label,
    value: devices.length,
    tone: key === 'alarm' || key === 'fault-code' ? 'err' : 'warn',
    description,
    deviceIds: devices.map((item) => item.id),
    topDevices: devices.slice(0, 3).map((item) => item.name),
    overviewPath,
  }
}

function buildAnomalyTags(device: GroupDetailDeviceRow) {
  const tags: string[] = []
  if (device.status === 'offline' || device.status === 'no-data') tags.push($t('IotDeviceGroups.status.offline'))
  if (device.status === 'alarm') tags.push($t('IotDeviceGroups.status.alarmShort'))
  if (getIotDeviceRiskKinds(device).includes('data-deviation')) tags.push($t('IotDeviceGroups.anomaly.dataAbnormal'))
  if (seededNumber(`${device.id}-battery`, 11) <= 1) tags.push($t('IotDeviceGroups.anomaly.lowBattery'))
  return tags
}

function seededNumber(text: string, max: number) {
  return Math.abs([...text].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)) % max
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
