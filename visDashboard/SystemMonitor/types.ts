import type { Dayjs } from 'dayjs'
import type { EChartsCoreOption } from 'echarts/core'

export type FocusScope = 'cpu' | 'memory' | 'network'
export type FocusSelections = Record<FocusScope, string[]>
export type TimeShortcut = 'hour' | 'day' | 'week'
export type MonitorTimeRange = [Dayjs, Dayjs]
export interface MonitorState { loading: boolean; error: boolean; empty: boolean }
export interface NodeOption { label: string; value: string; color: string; metric?: string; detail?: string }
export interface TrendView extends MonitorState {
  title: string
  activeMetric: string
  metricOptions: Array<{ label: string; value: string }>
  timeRange: MonitorTimeRange
  shortcut?: TimeShortcut
  disabled: boolean
  chartOptions: EChartsCoreOption
  nodeOptions: NodeOption[]
  selectedNodes: string[]
  metricScope?: { label: string; tooltip: string }
  legendItems?: Array<{ kind: string; label: string }>
  selectMetric: (value: string | number) => void
  selectRange: (value: MonitorTimeRange | [string, string] | null) => void
  selectShortcut: (value: TimeShortcut) => void
  refresh: () => void
  selectNodes: (value: string[]) => void
  resetNodes: () => void
}
