import type {
  IotDevice,
  IotDeviceGroup,
  IotGroupAggregates,
  IotGroupRuleStats,
} from '@device-manager-ui/types'

export interface GroupDetailSectionStat {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'ok' | 'warn' | 'err'
}

export interface GroupDetailDeviceRow extends IotDevice {
  healthScore: number
  statusLabel: string
  summaryText: string
  tagsPreview: string[]
}

export interface GroupDetailViewModel {
  group: IotDeviceGroup
  devices: GroupDetailDeviceRow[]
  aggregates: IotGroupAggregates
  ruleStats: IotGroupRuleStats
  onlineRatePercent: number
  heroTags: string[]
  metricStats: GroupDetailSectionStat[]
  ruleStatsCards: GroupDetailSectionStat[]
}
