import { computed, type ComputedRef, type Ref } from 'vue'

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
}

export interface DeviceMapPoint {
  lnglat: [number, number]
  label: string
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
