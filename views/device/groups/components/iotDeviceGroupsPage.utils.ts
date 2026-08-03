import type { ConditionFilterChangePayload, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import i18n from '@jetlinks-web-core/locales'
import type { DeviceGroupQueryTerm, DeviceGroupRuntimeDevice, DeviceGroupSummary } from '@device-manager-ui/api/deviceGroup'
import type { ProjectAreaType } from '@device-manager-ui/modules/defaults/types'
import type { IotDevice, IotDeviceGroup, IotGroupRiskLevel } from '@device-manager-ui/types'

import { buildTrendSeries } from './groupDetailDashboard.metrics'
import { buildDeviceGroupStatusSlices } from './deviceGroupStatusSlices'
import {
  buildExceptionItems,
  toGroupDetailDeviceRow,
} from './groupDetailDashboard.utils'
import type {
  GroupDashboardExceptionItem,
  GroupDashboardStatusSlice,
  GroupDashboardTrendSeries,
} from './groupDetailDashboard.types'
import type { GroupItem, GroupOverviewModel, GroupOverviewStat } from './iotDeviceGroupsPage.types'

const $t = i18n.global.t

export function groupSummary(devices: IotDevice[]): IotDeviceGroup['summary'] {
  return {
    total: devices.length,
    urgent: devices.filter((device) => device.risk === 'urgent').length,
    watch: devices.filter((device) => device.risk === 'watch').length,
    normal: devices.filter((device) => device.risk === 'normal').length,
    offline: devices.filter((device) => device.status === 'offline').length,
    noData: devices.filter((device) => device.status === 'no-data').length,
    alarm: devices.filter((device) => device.status === 'alarm').length,
  }
}

export function buildHealthScore(devices: IotDevice[]): number {
  if (!devices.length) return 0
  const urgent = devices.filter((device) => device.risk === 'urgent').length
  const watch = devices.filter((device) => device.risk === 'watch').length
  const unstable = devices.filter((device) => device.status !== 'online').length
  return Math.max(26, Math.min(98, 100 - urgent * 18 - watch * 9 - unstable * 7))
}

export function buildRiskLevel(devices: IotDevice[]): IotGroupRiskLevel {
  if (devices.some((device) => device.risk === 'urgent')) return 'high'
  if (devices.some((device) => device.risk === 'watch' || device.status !== 'online')) return 'medium'
  return 'low'
}

export function buildMockGroupHealthScore(seed: string) {
  const offset = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 16
  return 78 + offset
}

export function buildAlarmContacts(devices: IotDevice[]) {
  return [...new Set(devices.map((device) => device.owner).filter(Boolean))].slice(0, 3)
}

export function pickPrimaryOwner(devices: IotDevice[]) {
  const counts = new Map<string, number>()
  for (const device of devices) {
    counts.set(device.owner, (counts.get(device.owner) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? $t('IotDeviceGroups.owner.duty')
}

export function riskLevelLabel(level: IotGroupRiskLevel) {
  if (level === 'high') return $t('IotDeviceGroups.risk.high')
  if (level === 'medium') return $t('IotDeviceGroups.risk.medium')
  return $t('IotDeviceGroups.risk.low')
}

export function riskTone(level: IotGroupRiskLevel): GroupOverviewModel['riskTone'] {
  if (level === 'high') return 'err'
  if (level === 'medium') return 'warn'
  return 'ok'
}

export function deviceRiskRank(device: IotDevice) {
  if (device.risk === 'urgent') return 0
  if (device.risk === 'watch') return 1
  if (device.status !== 'online') return 2
  return 3
}

export function deviceHealthScore(device: IotDevice) {
  if (device.risk === 'urgent') return 42
  if (device.risk === 'watch') return 68
  if (device.status === 'offline') return 58
  if (device.status === 'no-data') return 62
  if (device.status === 'alarm') return 54
  return 93
}

export function isBusinessRuntimeDevice(device: IotDevice): device is DeviceGroupRuntimeDevice {
  return 'runtimeState' in device
}

export function cloneTerms(terms: ConditionFilterTerm[] = []): ConditionFilterTerm[] {
  return terms.filter(Boolean).map((item) => {
    const childTerms = Array.isArray(item.terms)
      ? cloneTerms(item.terms as ConditionFilterTerm[]) as ConditionFilterTerm['terms']
      : undefined

    return {
      ...item,
      value: Array.isArray(item.value) ? [...item.value] : item.value,
      terms: childTerms,
    }
  })
}

export function cloneDeviceGroupDeviceTerms(terms: ConditionFilterTerm[] = []): DeviceGroupQueryTerm[] {
  return terms.filter(Boolean).map((item) => ({
    column: item.column,
    termType: item.termType,
    value: Array.isArray(item.value) ? [...item.value] : item.value,
    type: item.type,
    terms: Array.isArray(item.terms)
      ? cloneDeviceGroupDeviceTerms(item.terms as ConditionFilterTerm[])
      : undefined,
  }))
}

export function normalizeDeviceQueryColumn(column?: string) {
  return column === 'identifier' ? 'id' : column
}

export function normalizeRuntimeDeviceQueryTerms(terms: ConditionFilterTerm[] = []): DeviceGroupQueryTerm[] {
  return cloneDeviceGroupDeviceTerms(terms)
    .map(normalizeRuntimeDeviceQueryTerm)
    .filter((item): item is DeviceGroupQueryTerm => Boolean(item))
}

export function normalizeLocalDeviceFilterTerms(terms: ConditionFilterTerm[] = []): ConditionFilterTerm[] {
  return cloneTerms(terms)
    .map(normalizeLocalDeviceFilterTerm)
    .filter((item): item is ConditionFilterTerm => Boolean(item))
}

export function buildAreaDeviceQueryTerms(spaceIds: string[], terms: ConditionFilterTerm[] = []): DeviceGroupQueryTerm[] {
  const ids = [...new Set(spaceIds.filter(Boolean))]
  if (!ids.length) return normalizeRuntimeDeviceQueryTerms(terms)

  return [
    {
      column: 'id',
      termType: 'space-bind$device',
      value: ids.length === 1 ? ids[0] : ids,
    },
    ...normalizeRuntimeDeviceQueryTerms(terms),
  ]
}

export function buildUnboundAreaDeviceQueryTerms(spaceIds: string[], terms: ConditionFilterTerm[] = []): DeviceGroupQueryTerm[] {
  const ids = [...new Set(spaceIds.filter(Boolean))]
  if (!ids.length) return normalizeRuntimeDeviceQueryTerms(terms)

  return [
    {
      column: 'id',
      termType: 'space-bind$not$device',
      value: ids.length === 1 ? ids[0] : ids,
    },
    ...normalizeRuntimeDeviceQueryTerms(terms),
  ]
}

export function toDeviceFilterOptions(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN'))
    .map((value) => ({ label: String(value), value: String(value) }))
}

export function getDeviceFieldValue(device: IotDevice, column?: string) {
  switch (column) {
    case 'name':
      return device.name
    case 'identifier':
      return device.identifier
    case 'productName':
      return device.productName
    case 'area':
      return device.area
    case 'owner':
      return device.owner
    case 'status':
      return device.status
    case 'risk':
      return device.risk
    default:
      return undefined
  }
}

export function normalizeFilterValue(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

export function includesFilterValue(source: unknown, target: unknown) {
  return normalizeFilterValue(source).includes(normalizeFilterValue(target))
}

export function equalsFilterValue(source: unknown, target: unknown) {
  return normalizeFilterValue(source) === normalizeFilterValue(target)
}

export function isEmptyFilterValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0
  return value === undefined || value === null || String(value).trim() === ''
}

export function matchDeviceClause(term: ConditionFilterTerm, device: IotDevice) {
  const fieldValue = getDeviceFieldValue(device, term.column)
  const termValueList = Array.isArray(term.value) ? term.value : [term.value]

  switch (term.termType) {
    case 'like':
      return termValueList.some((value) => includesFilterValue(fieldValue, value))
    case 'nlike':
    case 'not':
      return termValueList.every((value) => !includesFilterValue(fieldValue, value) && !equalsFilterValue(fieldValue, value))
    case 'eq':
      return termValueList.some((value) => equalsFilterValue(fieldValue, value))
    case 'in':
      return termValueList.some((value) => equalsFilterValue(fieldValue, value))
    case 'nin':
      return termValueList.every((value) => !equalsFilterValue(fieldValue, value))
    case 'isnull':
      return isEmptyFilterValue(fieldValue)
    case 'notnull':
      return !isEmptyFilterValue(fieldValue)
    default:
      return true
  }
}

export function matchDeviceFilterTerms(terms: ConditionFilterTerm[] = [], device: IotDevice): boolean {
  if (!terms.length) return true

  return terms.filter(Boolean).reduce<boolean | undefined>((result, term) => {
    const current = Array.isArray(term.terms)
      ? matchDeviceFilterTerms(term.terms as ConditionFilterTerm[], device)
      : matchDeviceClause(term, device)

    if (result === undefined) return current
    return term.type === 'or' ? result || current : result && current
  }, undefined) ?? true
}

function normalizeRuntimeDeviceQueryTerm(term: DeviceGroupQueryTerm): DeviceGroupQueryTerm | null {
  if (Array.isArray(term.terms)) {
    const terms = term.terms
      .map(normalizeRuntimeDeviceQueryTerm)
      .filter((item): item is DeviceGroupQueryTerm => Boolean(item))

    return terms.length ? { ...term, terms } : null
  }

  // 设备实例后端以 id 作为设备 ID 字段，前端展示仍沿用 identifier。
  const column = normalizeDeviceQueryColumn(term.column)

  if (term.column === 'status') {
    return {
      ...term,
      column: 'state',
      value: normalizeRuntimeStateValue(term.value),
    }
  }

  if (term.column === 'risk') return null

  return { ...term, column }
}

function normalizeLocalDeviceFilterTerm(term: ConditionFilterTerm): ConditionFilterTerm | null {
  if (Array.isArray(term.terms)) {
    const terms = term.terms
      .map((item) => normalizeLocalDeviceFilterTerm(item as ConditionFilterTerm))
      .filter((item): item is ConditionFilterTerm => Boolean(item))

    return terms.length ? { ...term, terms: terms as ConditionFilterTerm['terms'] } : null
  }

  return term.column === 'risk' ? term : null
}

function normalizeRuntimeStateValue(value: unknown) {
  const normalize = (item: unknown) => item === 'no-data' || item === 'disabled' ? 'notActive' : item
  return Array.isArray(value) ? value.map(normalize) : normalize(value)
}

export function resolveSubmittedTerms(payload?: ConditionFilterChangePayload, draftTerms: ConditionFilterTerm[] = []) {
  return cloneTerms(payload?.terms || draftTerms)
}

export function onlineDuration(device: IotDevice) {
  const noReport = $t('IotDeviceGroups.status.noReport')
  const lastSeen = device.lastSeen || noReport
  if (isBusinessRuntimeDevice(device)) {
    if (device.status === 'online' && device.connectTime) return $t('IotDeviceGroups.duration.online', { duration: formatRuntimeDuration(Date.now() - device.connectTime) })
    if (device.connectionStatus === 'disabled') return $t('IotDeviceGroups.status.notActive')
    return lastSeen === noReport ? noReport : $t('IotDeviceGroups.duration.offline', { time: lastSeen })
  }
  if (device.status === 'offline') return $t('IotDeviceGroups.duration.offline', { time: lastSeen })
  if (device.status === 'no-data') return $t('IotDeviceGroups.duration.noData', { time: lastSeen })
  if (device.status === 'alarm') return $t('IotDeviceGroups.duration.alarm', { time: lastSeen })
  const stableHours = 2 + (hashNumber(device.identifier || device.id || device.name) % 21)
  return $t('IotDeviceGroups.duration.online', { duration: $t('IotDeviceGroups.duration.hour', { hours: stableHours }) })
}

export function formatRuntimeDuration(duration: number) {
  const totalMinutes = Math.max(1, Math.floor(duration / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return $t('IotDeviceGroups.duration.minute', { minutes })
  if (!minutes) return $t('IotDeviceGroups.duration.hour', { hours })
  return $t('IotDeviceGroups.duration.hourMinute', { hours, minutes })
}

export function hashNumber(text?: string) {
  let total = 0
  for (const char of text || '') total += char.charCodeAt(0)
  return total
}

export function areaIcon(type: ProjectAreaType): string {
  const iconMap: Record<ProjectAreaType, string> = {
    site: 'DeploymentUnitOutlined',
    building: 'BankOutlined',
    floor: 'ApartmentOutlined',
    zone: 'ScanOutlined',
    room: 'LoginOutlined',
    point: 'EnvironmentOutlined',
  }
  return iconMap[type]
}

export function buildAreaOverviewModel(input: {
  group: GroupItem
  devices: IotDevice[]
  projectId: string
  pathSegments: string[]
  summary?: DeviceGroupSummary
  yesterdayOnlineRate?: number | null
  statusMeta: (status: IotDevice['status']) => { label: string }
}): GroupOverviewModel {
  const rows = input.devices.map((device) => toGroupDetailDeviceRow(device, input.statusMeta))
  const summary = input.summary ?? emptyDeviceGroupSummary()
  const onlineRate = Math.round(summary.onlineRate || 0)
  const averageHealth = 0
  const runStats = buildAreaStats(input.group, rows, onlineRate, averageHealth, input.summary, input.yesterdayOnlineRate)

  return {
    pathSegments: input.pathSegments,
    icon: input.group.area ? areaIcon(input.group.area.type) : 'ApartmentOutlined',
    riskLabel: riskLevelLabel(input.group.riskLevel),
    riskTone: riskTone(input.group.riskLevel),
    stats: runStats,
    trendSeries: buildTrendSeries(rows, onlineRate),
    statusSlices: buildDeviceGroupStatusSlices({ summary, t: $t }),
    events: [],
    exceptionItems: buildExceptionItems(rows, input.projectId),
  }
}

export function buildTypeOverviewModel(input: {
  group: GroupItem
  summary?: DeviceGroupSummary
  yesterdayOnlineRate?: number | null
  pathSegments: string[]
}): GroupOverviewModel {
  const summary = input.summary ?? emptyDeviceGroupSummary()

  const stats = buildTypeStats(input.group, summary, input.yesterdayOnlineRate)

  return {
    pathSegments: input.pathSegments,
    icon: 'ClusterOutlined',
    riskLabel: riskLevelLabel(input.group.riskLevel),
    riskTone: riskTone(input.group.riskLevel),
    stats,
    trendSeries: buildTypeTrendSeries(summary, input.group),
    statusSlices: buildDeviceGroupStatusSlices({ summary, t: $t }),
    events: [],
    exceptionItems: buildTypeExceptionItems(summary, input.group),
  }
}

function emptyDeviceGroupSummary(): DeviceGroupSummary {
  return {
    deviceCount: 0,
    total: 0,
    watch: 0,
    normal: 0,
    online: 0,
    offline: 0,
    noData: 0,
    onlineRate: 0,
  }
}

function buildAreaStats(
  group: GroupItem,
  rows: Array<ReturnType<typeof toGroupDetailDeviceRow>>,
  onlineRate: number,
  averageHealth: number,
  summary?: DeviceGroupSummary,
  yesterdayOnlineRate?: number | null,
): GroupOverviewStat[] {
  const total = summary?.deviceCount ?? summary?.total ?? 0
  const offlineOrNoDataCount = summary
    ? summary.offline + summary.noData
    : 0
  const dataAbnormalCount = summary
    ? summary.watch
    : 0
  const onlineCompare = typeof yesterdayOnlineRate === 'number'
    ? {
        label: $t('IotDeviceGroups.stat.yesterdayOnlineRate'),
        value: formatSignedPercent(onlineRate - yesterdayOnlineRate),
        tone: onlineRate >= yesterdayOnlineRate ? 'ok' as const : 'err' as const,
      }
    : undefined

  return [
    { label: $t('IotDeviceGroups.stat.deviceCount'), value: total, unit: $t('IotDeviceGroups.unit.device'), hint: $t('IotDeviceGroups.stat.deviceCountHint'), tone: 'default' },
    { label: $t('IotDeviceGroups.stat.onlineRate'), value: onlineRate, unit: '%', hint: $t('IotDeviceGroups.stat.onlineRateHint'), tone: onlineRate >= 75 ? 'ok' : 'warn', compare: onlineCompare },
    { label: $t('IotDeviceGroups.stat.offlineNoData'), value: offlineOrNoDataCount, unit: $t('IotDeviceGroups.unit.device'), hint: $t('IotDeviceGroups.stat.offlineNoDataHint'), tone: offlineOrNoDataCount ? 'warn' : 'ok' },
    { label: $t('IotDeviceGroups.stat.dataAbnormal'), value: dataAbnormalCount, unit: $t('IotDeviceGroups.unit.device'), hint: $t('IotDeviceGroups.stat.dataAbnormalHint'), tone: dataAbnormalCount ? 'warn' : 'ok' },
    { label: $t('IotDeviceGroups.stat.healthScore'), value: averageHealth, hint: $t('IotDeviceGroups.stat.healthScoreHint'), tone: averageHealth >= 80 ? 'brand' : averageHealth >= 65 ? 'warn' : 'err' },
  ]
}

function buildTypeStats(group: GroupItem, summary: DeviceGroupSummary, yesterdayOnlineRate?: number | null): GroupOverviewStat[] {
  const onlineRate = Math.round(summary.onlineRate || 0)
  const total = summary.deviceCount ?? summary.total ?? 0
  const offlineOrNoDataCount = summary.offline + summary.noData
  const dataAbnormalCount = summary.watch
  const onlineCompare = typeof yesterdayOnlineRate === 'number'
    ? {
        label: $t('IotDeviceGroups.stat.yesterdayOnlineRate'),
        value: formatSignedPercent(onlineRate - yesterdayOnlineRate),
        tone: onlineRate >= yesterdayOnlineRate ? 'ok' as const : 'err' as const,
      }
    : undefined
  return [
    { label: $t('IotDeviceGroups.stat.deviceCount'), value: total, unit: $t('IotDeviceGroups.unit.device'), hint: $t('IotDeviceGroups.stat.deviceCountHint'), tone: 'default' },
    { label: $t('IotDeviceGroups.stat.onlineRate'), value: onlineRate, unit: '%', hint: $t('IotDeviceGroups.stat.onlineRateHint'), tone: onlineRate >= 75 ? 'ok' : 'warn', compare: onlineCompare },
    { label: $t('IotDeviceGroups.stat.offlineNoData'), value: offlineOrNoDataCount, unit: $t('IotDeviceGroups.unit.device'), hint: $t('IotDeviceGroups.stat.offlineNoDataHint'), tone: offlineOrNoDataCount ? 'warn' : 'ok' },
    { label: $t('IotDeviceGroups.stat.dataAbnormal'), value: dataAbnormalCount, unit: $t('IotDeviceGroups.unit.device'), hint: $t('IotDeviceGroups.stat.dataAbnormalHint'), tone: dataAbnormalCount ? 'warn' : 'ok' },
    { label: $t('IotDeviceGroups.stat.healthScore'), value: group.healthScore, hint: $t('IotDeviceGroups.stat.healthScoreHint'), tone: group.healthScore >= 80 ? 'brand' : group.healthScore >= 65 ? 'warn' : 'err' },
  ]
}

function buildTypeTrendSeries(summary: DeviceGroupSummary, group: GroupItem): GroupDashboardTrendSeries[] {
  const onlineRate = buildMockTypeOnlineRate(group)
  const uplink = buildMockTypeMessageCount(group)

  return [
    {
      key: 'onlineRate',
      title: $t('IotDeviceGroups.trend.onlineRateTitle'),
      unit: '%',
      value: `${onlineRate}%`,
      accent: 'var(--jet-theme-success)',
      points: buildMetricTrend(buildMockTypeOnlineTrend(group, onlineRate), 0, 100),
    },
    {
      key: 'uplink',
      title: $t('IotDeviceGroups.trend.messageCountTitle'),
      unit: $t('IotDeviceGroups.unit.message'),
      value: formatCompactTrendValue(uplink),
      accent: 'var(--jet-theme-primary)',
      points: buildMetricTrend(buildMockTypeMessageTrend(group, uplink), 0, Math.max(uplink, 1)),
    },
    {
      key: 'downlink',
      title: $t('IotDeviceGroups.trend.downlinkTitle'),
      unit: $t('IotDeviceGroups.unit.message'),
      value: formatCompactTrendValue(Math.round(uplink * 0.24)),
      accent: 'var(--jet-theme-primary)',
      points: buildMetricTrend([12, 18, 16, 24, 26, 22, 28], 0, 32),
    },
  ]
}

function buildTypeExceptionItems(summary: DeviceGroupSummary, group: GroupItem): GroupDashboardExceptionItem[] {
  return [
    {
      key: 'offline-frequent',
      label: $t('IotDeviceGroups.exception.offlineDevices'),
      value: summary.offline + summary.noData,
      tone: summary.offline + summary.noData ? 'warn' : 'err',
      description: $t('IotDeviceGroups.exception.offlineDevicesDesc', { name: group.name }),
      deviceIds: [],
      topDevices: [],
      overviewPath: '',
    },
    {
      key: 'data-deviation',
      label: $t('IotDeviceGroups.exception.watchDevices'),
      value: summary.watch,
      tone: summary.watch ? 'warn' : 'err',
      description: $t('IotDeviceGroups.exception.watchDevicesDesc', { name: group.name }),
      deviceIds: [],
      topDevices: [],
      overviewPath: '',
    },
  ]
}

function buildMetricTrend(values: number[], min: number, max: number) {
  const labels = ['5/14', '5/15', '5/16', '5/17', '5/18', '5/19', $t('IotDeviceGroups.time.today')]
  return values.map((value, index) => ({
    label: labels[index] ?? `T${index + 1}`,
    value: clamp(Math.round(value * 100) / 100, min, max),
    description: $t('IotDeviceGroups.trend.last7Days'),
  }))
}

function buildMockTypeOnlineRate(group: GroupItem) {
  return clamp(82 + seededNumber(`${group.id}-online-rate`, 15) - 4, 76, 96)
}

function buildMockTypeMessageCount(group: GroupItem) {
  return 1200 + seededNumber(`${group.id}-uplink`, 3600)
}

function formatCompactTrendValue(value: number) {
  const rounded = Math.round(value)
  if (Math.abs(rounded) >= 10000) {
    const wan = rounded / 10000
    return $t('IotDeviceGroups.unit.tenThousand', { value: Number.isInteger(wan) ? wan.toFixed(0) : wan.toFixed(1) })
  }
  return rounded.toLocaleString()
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? Math.abs(rounded).toLocaleString() : Math.abs(rounded).toFixed(1)
  if (!rounded) return $t('IotDeviceGroups.trend.flat')
  return `${rounded > 0 ? '+' : '-'}${text}%`
}

function buildMockTypeOnlineTrend(group: GroupItem, base: number) {
  const offsets = [-3, -1, 0, 2, 1, 3, 2]
  return offsets.map((offset, index) => base + offset + seededSignedNumber(`${group.id}-online-${index}`, 1))
}

function buildMockTypeMessageTrend(group: GroupItem, base: number) {
  const factors = [0.72, 0.78, 0.84, 0.81, 0.9, 0.94, 1]
  return factors.map((factor, index) => Math.round(base * factor + seededSignedNumber(`${group.id}-msg-${index}`, 80)))
}

function seededNumber(text: string, max: number) {
  if (max <= 0) return 0
  return Math.abs([...text].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)) % max
}

function seededSignedNumber(text: string, amplitude: number) {
  return seededNumber(text, amplitude * 2 + 1) - amplitude
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
