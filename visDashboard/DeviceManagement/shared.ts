import { computed, type ComputedRef, type Ref } from 'vue'
import type { DeviceQueryTerm } from '../../api/device'

export type DashboardComponentProps = Record<string, unknown>
export type DashboardCardStyle = Record<string, unknown>

export type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning' | 'disabled'

export interface DashboardCardInfo {
  id?: string
  componentProps?: DashboardComponentProps
}

export interface DashboardCardProps {
  info?: DashboardCardInfo
  style?: DashboardCardStyle
  isEdit?: boolean
}

export interface DashboardConfigProps {
  configData?: DashboardCardInfo
}

export interface DashboardCountOption {
  value: string
  label: string
  name: string
}

export interface DashboardValueType {
  type?: string
  properties?: DashboardEventField[]
  elements?: Array<{
    text?: string
    value?: unknown
  }>
  trueText?: string
  falseText?: string
  trueValue?: unknown
  falseValue?: unknown
  bodyType?: string
  [key: string]: unknown
}

export interface DashboardEventField {
  id: string
  name: string
  valueType?: DashboardValueType
}

export interface DashboardEventMetadata extends DashboardEventField {}

export interface DashboardEventRecord extends Record<string, unknown> {
  timestamp?: number
  timeString?: string
  value?: unknown
}

export interface EventShowCardConfig {
  value: string
  targetId: string
  targetMetadata: string
  isAutoRefresh: boolean
  interval: number
}

export interface ImageMetricConfig {
  topTitle: string
  tooltip?: string
  img?: string
  bottomLeftTitle?: string
  bottomLeftStatus?: BadgeStatus
  bottomRightTitle?: string
  bottomRightStatus?: BadgeStatus
  type?: string
  isAutoRefresh?: boolean
  interval?: number
}

export interface ImageMetricData {
  primary: number | string
  secondary: number | string
  tertiary: number | string
}

export interface TrendMetricConfig {
  topTitle: string
  bottomTitle?: string
  tooltip?: string
  hoverTip?: boolean
  hoverTitle?: string
  color?: string
  type?: string
  isAutoRefresh?: boolean
  interval?: number
}

export interface TrendMetricData {
  primary: number | string
  secondary: number | string
  xData: string[]
  yData: number[]
}

export interface DeviceMessageChartData {
  xData: string[]
  yData: number[]
}

export type TimeShortcut = 'hour' | 'day' | 'week'

export interface DeviceMessageConfig {
  quickBtn: boolean
  defaultType: TimeShortcut
  topTitle: string
  hoverTip: boolean
  hoverTitle: string
  color: string
  isAutoRefresh: boolean
  interval: number
}

export interface DeviceMapConfig {
  topTitle: string
  isAutoRefresh: boolean
  interval: number
  presentation?: 'distribution'
  scope?: string
  /** 组合卡片由宿主提供标题与外框，地图仍保留自身加载、错误及交互状态。 */
  embedded?: boolean
  /** 嵌入宿主可提供图例挂载选择器，未指定时继续显示在地图右上角。 */
  legendTarget?: string
  /** 未设置时保留全部位置；显式传入（含空数组）时，先按设备查询校验可见 ID，再展示位置。 */
  deviceTerms?: DeviceQueryTerm[]
  /** 地图点位显示设备实时状态；未设置时保留原地图样式。 */
  showStatus?: boolean
}

export interface DeviceMapPoint {
  deviceId: string
  lnglat: [number, number]
  label: string
  state?: string | null
  stateText?: string | null
}

export interface TimeRangePayload {
  start: number
  end: number
  type?: TimeShortcut
}

export interface ResourceOverviewItem {
  id: string
  label: string
  value: number | string
  icon: string
}

export interface ResourceOverviewConfig {
  topTitle: string
  items: ResourceOverviewItem[]
}

export const getComponentConfig = <T extends object>(
  info: Ref<DashboardCardInfo | undefined>,
  key: string,
  defaults: T
): ComputedRef<T> =>
  computed(() => {
    const current = info.value?.componentProps?.[key] as Partial<T> | undefined
    return {
      ...defaults,
      ...(current || {})
    }
  })
