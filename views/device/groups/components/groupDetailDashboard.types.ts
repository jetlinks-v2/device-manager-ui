import type { IotDeviceGroup, IotGroupRuleStats, IotRiskKind } from '@device-manager-ui/types'

import type { GroupDetailDeviceRow, GroupDetailSectionStat } from './groupDetail.types'

export interface GroupDashboardStatusSlice {
  key: 'online' | 'offline' | 'alarm' | 'no-data' | 'notActive'
  label: string
  value: number
  share: number
  tone: 'ok' | 'warn' | 'err'
  description: string
}

export interface GroupDashboardTrendPoint {
  label: string
  value: number
  description: string
}

export interface GroupDashboardTrendSeries {
  key: 'onlineRate' | 'alarmCount' | 'uplink' | 'downlink'
  title: string
  unit: string
  value: string
  accent: string
  points: GroupDashboardTrendPoint[]
}

export interface GroupDashboardTypeStat {
  label: string
  total: number
  online: number
  attention: number
}

export interface GroupDashboardTypeDistributionItem {
  label: string
  value: number
  share: number
  color: string
}

export interface GroupDashboardExceptionItem {
  key: IotRiskKind | 'alarm' | 'low-battery'
  label: string
  value: number
  tone: 'warn' | 'err'
  description: string
  deviceIds: string[]
  topDevices: string[]
  overviewPath: string
}

export interface GroupDashboardOwnerLoad {
  owner: string
  total: number
  urgent: number
  attention: number
}

export interface GroupDashboardMetricAverageRow {
  label: string
  average: string
  sampleText: string
}

export interface GroupDashboardAlarmItem {
  label: string
  value: number
  tone: 'ok' | 'warn' | 'err'
}

export interface GroupDashboardWatchDevice {
  id: string
  name: string
  owner: string
  area: string
  statusLabel: string
  riskLabel: string
  tone: 'ok' | 'warn' | 'err'
  healthScore: number
}

export interface GroupDashboardQuickAction {
  key: string
  label: string
  icon: string
  tone?: 'primary' | 'default'
}

export interface GroupDashboardEvent {
  id: string
  timeLabel: string
  title: string
  summary: string
  tone: 'ok' | 'warn' | 'err' | 'info'
}

export interface GroupDashboardTableRow extends GroupDetailDeviceRow {
  signalStrength: number
  todayMessages: number
  anomalyTags: string[]
}

export interface GroupDetailDashboardViewModel {
  group: IotDeviceGroup
  groupLabel: string
  projectLabel: string
  groupTypeLabel: string
  riskLabel: string
  riskTone: 'ok' | 'warn' | 'err'
  createdAt: string
  heroTags: string[]
  heroStats: GroupDetailSectionStat[]
  overviewLegend: Array<{ label: string; value: number; color: string; share: number }>
  runStats: Array<GroupDetailSectionStat & { delta: string; deltaTone: 'ok' | 'warn' | 'err' }>
  alarmTotal: number
  alarmItems: GroupDashboardAlarmItem[]
  statusSlices: GroupDashboardStatusSlice[]
  trendSeries: GroupDashboardTrendSeries[]
  typeStats: GroupDashboardTypeStat[]
  typeDistribution: GroupDashboardTypeDistributionItem[]
  exceptionItems: GroupDashboardExceptionItem[]
  ownerLoads: GroupDashboardOwnerLoad[]
  keyMetricRows: GroupDashboardMetricAverageRow[]
  devices: GroupDashboardTableRow[]
  watchDevices: GroupDashboardWatchDevice[]
  ruleStats: IotGroupRuleStats
  ruleCards: GroupDetailSectionStat[]
  quickActions: GroupDashboardQuickAction[]
  events: GroupDashboardEvent[]
  objective: string
  ownerCount: number
  attentionDeviceCount: number
  maintenanceCount: number
  notifyTargets: string[]
}
