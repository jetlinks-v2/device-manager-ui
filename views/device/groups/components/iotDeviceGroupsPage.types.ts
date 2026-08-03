import type { ConditionFilterCommonField, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { DeviceGroup, DeviceGroupSummary } from '@device-manager-ui/api/deviceGroup'
import type { IotDeviceGroupView } from '@device-manager-ui/hooks/useIotDeviceGroupMeta'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import type { IotDevice, IotDeviceGroup, IotGroupRiskLevel } from '@device-manager-ui/types'

import type {
  GroupDashboardEvent,
  GroupDashboardExceptionItem,
  GroupDashboardStatusSlice,
  GroupDashboardTrendSeries,
} from './groupDetailDashboard.types'

export type StateKind = 'urgent' | 'watch' | 'ok'

export interface GroupItem {
  id: string
  sourceId: string
  view: IotDeviceGroupView
  viewLabel: string
  name: string
  owner: string
  objective: string
  description: string
  condition: string
  deviceIds: string[]
  tags: string[]
  summary: IotDeviceGroup['summary']
  healthScore: number
  riskLevel: IotGroupRiskLevel
  alarmContacts: string[]
  automationRules: string[]
  actions: string[]
  area?: ProjectArea
  areaScopeIds?: string[]
  isVirtual?: boolean
  bizTypeMeta?: {
    code: string
    sortIndex: number
  }
}

export interface AreaTreeNode {
  key: string
  title: string
  item: GroupItem
  depth: number
  children?: AreaTreeNode[]
  isRoot?: boolean
  isUnbound?: boolean
}

export interface GroupOverviewStat {
  label: string
  value: number | string
  unit?: string
  hint: string
  tone?: 'default' | 'ok' | 'warn' | 'err' | 'brand'
  compare?: {
    label: string
    value: string
    tone: 'ok' | 'warn' | 'err'
  }
}

export interface GroupOverviewModel {
  pathSegments: string[]
  icon: string
  riskLabel: string
  riskTone: 'ok' | 'warn' | 'err'
  stats: GroupOverviewStat[]
  trendSeries: GroupDashboardTrendSeries[]
  statusSlices: GroupDashboardStatusSlice[]
  events: GroupDashboardEvent[]
  exceptionItems: GroupDashboardExceptionItem[]
}

export interface DeviceFilterContext {
  terms: ConditionFilterTerm[]
  commonFields: ConditionFilterCommonField[]
  fields: ConditionFilterField[]
}

export interface TypeGroupSummaryContext {
  group: DeviceGroup
  summary?: DeviceGroupSummary
}

export interface DeviceTableQueryParams {
  pageIndex?: number
  pageSize?: number
}

export interface DeviceTableQueryResult<T> {
  success: boolean
  result: {
    data: T[]
    total: number
    pageIndex: number
    pageSize: number
  }
}

export interface AreaTreeSearchResult {
  visible: boolean
  matched: boolean
}

export type DeviceListItem = IotDevice
