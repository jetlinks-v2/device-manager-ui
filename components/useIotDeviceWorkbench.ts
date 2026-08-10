import { computed, onMounted, reactive, ref } from 'vue'
import { useProjectRouter } from '@jetlinks-web-core/hooks'
import i18n from '@jetlinks-web-core/locales'

import { getIotDeviceConnectionStatus } from '../hooks/useIotDeviceStatus'
import { IOT_MOCK_PROJECT_ID, iotDeviceService } from '../services/iotDevice.service'
import type { IotDevice, IotDeviceFilters, IotDeviceTodo, IotDeviceWorkbench } from '../types'
import { useIotDeviceAlarmOverview } from './useIotDeviceAlarmOverview'
import { useIotDeviceOverviewMetrics } from './useIotDeviceOverviewMetrics'
import type { DeviceGroupTrendRange } from '../api/deviceGroup'

export type WidgetKind =
  | 'online-trend'
  | 'alarm-trend'
  | 'status-distribution'
  | 'alert-top'
  | 'alert-rank'
  | 'scene-health'
  | 'area-usage'
  | 'command-success'
  | 'message-stream'
  | 'quick-actions'
export type WidgetSize = 'wide' | 'normal' | 'compact'
export type WidgetGroupKey = 'basic' | 'ops' | 'business' | 'realtime'
export type DashboardTone = 'ok' | 'warn' | 'err' | 'info' | 'muted'
export type DashboardViewKey = 'default' | 'ops' | 'realtime'

export interface DashboardWidget {
  id: string
  kind: WidgetKind
  title: string
  size: WidgetSize
  config: {
    source: 'runtime' | 'alarm' | 'scene' | 'telemetry'
    timeRange: string
    refresh: string
    metric: string
    chart: 'line' | 'bar' | 'list' | 'gauge'
  }
}

export type DashboardWidgetPatch = Partial<Pick<DashboardWidget, 'title' | 'size'>> & {
  config?: Partial<DashboardWidget['config']>
}

export interface WidgetTemplate {
  kind: WidgetKind
  title: string
  desc: string
  icon: string
  group: WidgetGroupKey
  groupLabel: string
  size: WidgetSize
  chart: DashboardWidget['config']['chart']
  metric: string
}

export interface DeviceStatCard {
  key: string
  title: string
  value: number
  unit: string
  subtitle: string
  detail: string
  icon: string
  tone: DashboardTone | 'default'
  target: Partial<IotDeviceFilters>
  sparkline?: number[]
  breakdown?: Array<{
    label: string
    value: number
    tone: 'online' | 'offline' | 'disabled'
  }>
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: string
    label: string
    tone: DashboardTone
  }
}

export interface ActivityMetric {
  label: string
  value: number
  unit: string
  trend: string
  direction: 'up' | 'down' | 'flat'
  tone: DashboardTone
}

export interface PercentRow {
  label: string
  value: number
  state: string
  percent: number
}

export interface AlertTypeRow extends PercentRow {
  key: string
  detail: string
  icon: string
  target?: Partial<IotDeviceFilters>
}

export interface IotAlarmRankRow {
  id: string
  deviceId: string
  name: string
  count: number
}

export interface AreaRow {
  name: string
  total: number
  onlineRate: number
  alarmDensity: number
  risk: string
  x: number
  y: number
}

export interface RealtimeMessage {
  id: string
  deviceId?: string
  level: string
  levelLabel: string
  tone: DashboardTone
  deviceName: string
  title?: string
  text: string
  trigger?: string
  duration?: string
  time: string
  state?: string
}

export interface ConnectionMetric {
  label: string
  value: string
  unit: string
  detail: string
  tone: DashboardTone
  trendTone: DashboardTone
  direction: 'up' | 'down' | 'flat'
  trend: string
  target: Partial<IotDeviceFilters>
}

export interface PageSettings {
  name: string
  refresh: string
  density: string
  scope: 'personal' | 'team'
}

export function useIotDeviceWorkbench() {
const statNumberFormatter = new Intl.NumberFormat('zh-CN')
const $t = i18n.global.t

const { projectId, push } = useProjectRouter()
const resolvedProjectId = computed(() => projectId.value || IOT_MOCK_PROJECT_ID)

const workbench = ref<IotDeviceWorkbench | null>(null)
const overviewMetrics = useIotDeviceOverviewMetrics()
const deviceAlarmOverview = useIotDeviceAlarmOverview()
const editMode = ref(false)
const fullscreen = ref(false)
const selectedWidgetId = ref('widget-online-trend')
const componentPanelOpen = ref(false)
const componentPanelMode = ref<'components' | 'settings'>('components')
const activeDashboardView = ref<DashboardViewKey>('ops')
const layoutFeedback = ref('')
const floatToolsOpen = ref(false)
const floatMenuOpen = ref(false)

const filters = reactive<IotDeviceFilters>({
  projectId: resolvedProjectId.value,
  area: 'all',
  productName: 'all',
  connectionStatus: 'all',
  businessStatus: 'all',
  risk: 'all',
  anomalyKind: 'all',
})

const dashboardFilters = reactive({
  messageTrendRange: '24h' as DeviceGroupTrendRange,
  onlineRateTrendRange: '24h' as DeviceGroupTrendRange,
})

const pageSettings = reactive<PageSettings>({
  name: $t('IotWorkbench.settings.defaultName'),
  refresh: $t('IotWorkbench.option.refresh.30s'),
  density: 'comfortable',
  scope: 'personal',
})

const dashboardViews: Array<{ key: DashboardViewKey; label: string; desc: string }> = [
  { key: 'ops', label: $t('IotWorkbench.view.ops'), desc: $t('IotWorkbench.view.opsDesc') },
  { key: 'realtime', label: $t('IotWorkbench.view.realtime'), desc: $t('IotWorkbench.view.realtimeDesc') },
]

const widgetSourceOptions: Array<{ value: DashboardWidget['config']['source']; label: string }> = [
  { value: 'runtime', label: $t('IotWorkbench.option.source.runtime') },
  { value: 'alarm', label: $t('IotWorkbench.option.source.alarm') },
  { value: 'scene', label: $t('IotWorkbench.option.source.scene') },
  { value: 'telemetry', label: $t('IotWorkbench.option.source.telemetry') },
]

const widgetTimeRangeOptions = [
  { value: $t('IotWorkbench.option.time.24h'), label: $t('IotWorkbench.option.time.24h') },
  { value: $t('IotWorkbench.option.time.today'), label: $t('IotWorkbench.option.time.today') },
  { value: $t('IotWorkbench.option.time.7d'), label: $t('IotWorkbench.option.time.7d') },
  { value: $t('IotWorkbench.option.time.30d'), label: $t('IotWorkbench.option.time.30d') },
]

const trendRangeOptions: Array<{ value: DeviceGroupTrendRange; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

const refreshOptions = [
  { value: $t('IotWorkbench.option.refresh.10s'), label: $t('IotWorkbench.option.refresh.10s') },
  { value: $t('IotWorkbench.option.refresh.30s'), label: $t('IotWorkbench.option.refresh.30s') },
  { value: $t('IotWorkbench.option.refresh.1m'), label: $t('IotWorkbench.option.refresh.1m') },
  { value: $t('IotWorkbench.option.refresh.manual'), label: $t('IotWorkbench.option.refresh.manual') },
]

const widgetChartOptions: Array<{ value: DashboardWidget['config']['chart']; label: string }> = [
  { value: 'line', label: $t('IotWorkbench.option.chart.line') },
  { value: 'bar', label: $t('IotWorkbench.option.chart.bar') },
  { value: 'list', label: $t('IotWorkbench.option.chart.list') },
  { value: 'gauge', label: $t('IotWorkbench.option.chart.gauge') },
]

const widgetSizeOptions: Array<{ value: WidgetSize; label: string }> = [
  { value: 'wide', label: $t('IotWorkbench.option.size.wide') },
  { value: 'normal', label: $t('IotWorkbench.option.size.normal') },
  { value: 'compact', label: $t('IotWorkbench.option.size.compact') },
]

const pageDensityOptions = [
  { value: 'comfortable', label: $t('IotWorkbench.option.density.comfortable') },
  { value: 'compact', label: $t('IotWorkbench.option.density.compact') },
]

const pageScopeOptions: Array<{ value: 'personal' | 'team'; label: string }> = [
  { value: 'personal', label: $t('IotWorkbench.option.scope.personal') },
  { value: 'team', label: $t('IotWorkbench.option.scope.team') },
]

const dashboardViewWidgets: Record<DashboardViewKey, WidgetKind[]> = {
  default: ['alarm-trend', 'alert-top', 'alert-rank'],
  ops: ['alarm-trend', 'alert-top', 'alert-rank'],
  realtime: ['command-success'],
}

const availableWidgetTemplates: WidgetTemplate[] = [
  { kind: 'online-trend', title: $t('IotWorkbench.widget.onlineTrend'), desc: $t('IotWorkbench.widget.onlineTrendDesc'), icon: 'lucide:activity', group: 'basic', groupLabel: $t('IotWorkbench.widget.group.basic'), size: 'wide', chart: 'line', metric: 'activity' },
  { kind: 'alarm-trend', title: $t('IotWorkbench.widget.alarmTrend'), desc: $t('IotWorkbench.widget.alarmTrendDesc'), icon: 'lucide:chart-line', group: 'ops', groupLabel: $t('IotWorkbench.widget.group.ops'), size: 'wide', chart: 'line', metric: 'alarm-record' },
  { kind: 'status-distribution', title: $t('IotWorkbench.widget.statusDistribution'), desc: $t('IotWorkbench.widget.statusDistributionDesc'), icon: 'lucide:chart-no-axes-column', group: 'basic', groupLabel: $t('IotWorkbench.widget.group.basic'), size: 'normal', chart: 'bar', metric: 'status' },
  { kind: 'alert-top', title: $t('IotWorkbench.widget.messageStream'), desc: $t('IotWorkbench.widget.messageStreamDesc'), icon: 'lucide:radio-receiver', group: 'ops', groupLabel: $t('IotWorkbench.widget.group.ops'), size: 'normal', chart: 'list', metric: 'alarm-stream' },
  { kind: 'alert-rank', title: $t('IotWorkbench.widget.alertTop'), desc: $t('IotWorkbench.widget.alertTopDesc'), icon: 'lucide:triangle-alert', group: 'ops', groupLabel: $t('IotWorkbench.widget.group.ops'), size: 'wide', chart: 'list', metric: 'alarm-count' },
  { kind: 'scene-health', title: $t('IotWorkbench.widget.sceneHealth'), desc: $t('IotWorkbench.widget.sceneHealthDesc'), icon: 'lucide:radar', group: 'ops', groupLabel: $t('IotWorkbench.widget.group.ops'), size: 'normal', chart: 'bar', metric: 'alarm-config' },
  { kind: 'area-usage', title: $t('IotWorkbench.widget.areaUsage'), desc: $t('IotWorkbench.widget.areaUsageDesc'), icon: 'lucide:map', group: 'business', groupLabel: $t('IotWorkbench.widget.group.business'), size: 'wide', chart: 'bar', metric: 'geo' },
  { kind: 'message-stream', title: $t('IotWorkbench.widget.messageStream'), desc: $t('IotWorkbench.widget.messageStreamDesc'), icon: 'lucide:radio-receiver', group: 'realtime', groupLabel: $t('IotWorkbench.widget.group.realtime'), size: 'normal', chart: 'list', metric: 'alarm-stream' },
  { kind: 'command-success', title: $t('IotWorkbench.widget.commandSuccess'), desc: $t('IotWorkbench.widget.commandSuccessDesc'), icon: 'lucide:radio-tower', group: 'realtime', groupLabel: $t('IotWorkbench.widget.group.realtime'), size: 'normal', chart: 'gauge', metric: 'connection' },
]

const activeWidgets = ref<DashboardWidget[]>([
  createWidget('online-trend', 'widget-online-trend'),
  createWidget('status-distribution', 'widget-status-distribution'),
  createWidget('alarm-trend', 'widget-alarm-trend'),
  createWidget('alert-top', 'widget-alert-top'),
  createWidget('alert-rank', 'widget-alert-rank'),
  createWidget('command-success', 'widget-command-success'),
  // createWidget('area-usage', 'widget-area-usage'),
])

const devices = computed(() => workbench.value?.devices ?? [])
const ZERO_TREND_VALUES = [0, 0, 0, 0, 0, 0, 0]
const dashboardViewOptions = computed(() => dashboardViews.map((view) => ({
  value: view.key,
  label: view.label,
})))

const todoRows = computed(() => workbench.value?.todos ?? [])

const todoStatusSummary = computed(() => ({
  pending: todoRows.value.filter((todo) => todo.status === 'pending').length,
}))

const onlineRate = computed(() => {
  return overviewMetrics.onlineRate.value
})

const activeDeviceCount = computed(() => overviewMetrics.messageTotal.value)

const averageHealth = computed(() => 0)

function trendRangeLabel(range: DeviceGroupTrendRange, short = false) {
  if (range === '30d') return $t(short ? 'IotWorkbench.option.time.30d.short' : 'IotWorkbench.option.time.30d')
  if (range === '7d') return $t(short ? 'IotWorkbench.option.time.7d.short' : 'IotWorkbench.option.time.7d')
  return $t(short ? 'IotWorkbench.option.time.24h.short' : 'IotWorkbench.option.time.24h')
}

const messageTrendWindowLabel = computed(() => {
  return trendRangeLabel(dashboardFilters.messageTrendRange, true)
})

const onlineRateTrendWindowLabel = computed(() => {
  return trendRangeLabel(dashboardFilters.onlineRateTrendRange, true)
})

const deviceStatCards = computed<DeviceStatCard[]>(() => {
  const total = overviewMetrics.totalCount.value
  const online = overviewMetrics.onlineCount.value
  const offline = overviewMetrics.offlineCount.value
  const disabled = overviewMetrics.disabledCount.value
  const alarm = deviceAlarmOverview.alarmDeviceCount.value
  const alarmRecords = deviceAlarmOverview.recordTotal.value
  const alarmConfig = deviceAlarmOverview.total.value
  return [
    {
      key: 'total',
      title: $t('IotWorkbench.stat.total'),
      value: total,
      unit: $t('IotWorkbench.unit.device'),
      subtitle: $t('IotWorkbench.stat.totalSubtitle', { online, offline, disabled }),
      detail: $t('IotWorkbench.stat.totalDetail', { online, offline, disabled }),
      icon: 'lucide:hard-drive',
      tone: 'default',
      target: { connectionStatus: 'all', businessStatus: 'all', risk: 'all', anomalyKind: 'all' },
      sparkline: [],
      breakdown: [
        { label: $t('IotWorkbench.option.connection.online'), value: online, tone: 'online' },
        { label: $t('IotWorkbench.option.connection.offline'), value: offline, tone: 'offline' },
        { label: $t('IotWorkbench.option.connection.disabled'), value: disabled, tone: 'disabled' },
      ],
    },
    {
      key: 'online',
      title: $t('IotWorkbench.stat.online'),
      value: onlineRate.value,
      unit: '%',
      subtitle: '',
      detail: '',
      icon: 'lucide:wifi',
      tone: 'muted',
      target: { connectionStatus: 'online', businessStatus: 'all', risk: 'all', anomalyKind: 'all' },
      sparkline: overviewMetrics.onlineRateTrend.value.map((item) => item.value),
      trend: { direction: 'flat', value: $t('IotWorkbench.trend.flat'), label: $t('IotWorkbench.stat.realtime'), tone: 'muted' },
    },
    {
      key: 'alarm',
      title: $t('IotWorkbench.stat.alarm'),
      value: alarm,
      unit: $t('IotWorkbench.unit.message'),
      subtitle: $t('IotWorkbench.stat.alarmSubtitle', { total: alarmRecords }),
      detail: alarmRecords ? $t('IotWorkbench.stat.alarmDetail', { total: alarmRecords }) : $t('IotWorkbench.stat.alarmEmpty'),
      icon: 'lucide:bell-ring',
      tone: 'muted',
      target: { connectionStatus: 'all', businessStatus: 'alarm', risk: 'all', anomalyKind: 'all' },
      sparkline: deviceAlarmOverview.recordTrend.value.map((item) => item.value),
    },
    {
      key: 'alarm-config',
      title: $t('IotWorkbench.stat.alarmConfig'),
      value: alarmConfig,
      unit: $t('IotWorkbench.unit.message'),
      subtitle: $t('IotWorkbench.stat.alarmConfigSubtitle', { total: alarmConfig }),
      detail: alarmConfig ? $t('IotWorkbench.stat.alarmConfigDetail', { total: alarmConfig }) : $t('IotWorkbench.stat.alarmConfigEmpty'),
      icon: 'lucide:bell-plus',
      tone: 'muted',
      target: { connectionStatus: 'all', businessStatus: 'all', risk: 'all', anomalyKind: 'all' },
      sparkline: [],
    },
    {
      key: 'health-score',
      title: $t('IotWorkbench.stat.healthScore'),
      value: averageHealth.value,
      unit: '',
      subtitle: $t('IotWorkbench.stat.healthScoreSubtitle'),
      detail: $t('IotWorkbench.stat.healthScoreDetail'),
      icon: 'lucide:badge-check',
      tone: 'muted',
      target: { connectionStatus: 'all', businessStatus: 'all', risk: 'all', anomalyKind: 'all' },
      trend: { direction: 'flat', value: $t('IotWorkbench.trend.flat'), label: $t('IotWorkbench.trend.sevenDayAverage'), tone: 'muted' },
    },
  ]
})

const activityMetrics = computed(() => {
  const messageTotal = overviewMetrics.messageTotal.value
  const messagePeak = overviewMetrics.messagePeak.value
  const messageAverage = overviewMetrics.messageAverage.value
  const rangeLabel = trendRangeLabel(dashboardFilters.messageTrendRange)
  const peakLabel = dashboardFilters.messageTrendRange === '24h'
    ? $t('IotWorkbench.metric.hourPeak')
    : $t('IotWorkbench.metric.bucketPeak')
  return [
    {
      label: $t('IotWorkbench.metric.messageTotal'),
      value: messageTotal,
      unit: $t('IotWorkbench.unit.message'),
      trend: rangeLabel,
      direction: 'flat' as const,
      tone: messageTotal ? 'info' as const : 'muted' as const,
    },
    {
      label: $t('IotWorkbench.metric.messagePeak'),
      value: messagePeak,
      unit: $t('IotWorkbench.unit.message'),
      trend: peakLabel,
      direction: 'flat' as const,
      tone: messagePeak ? 'ok' as const : 'muted' as const,
    },
    {
      label: $t('IotWorkbench.metric.messageAverage'),
      value: messageAverage,
      unit: $t('IotWorkbench.unit.message'),
      trend: $t('IotWorkbench.metric.bucketAverage'),
      direction: 'flat' as const,
      tone: messageAverage ? 'info' as const : 'muted' as const,
    },
  ]
})

const statusDistribution = computed(() => {
  const total = Math.max(overviewMetrics.totalCount.value, 1)
  return [
    { label: $t('IotWorkbench.option.connection.online'), value: overviewMetrics.onlineCount.value, state: 'ok' },
    { label: $t('IotWorkbench.option.connection.offline'), value: overviewMetrics.offlineCount.value, state: 'urgent' },
    { label: $t('IotWorkbench.option.connection.disabled'), value: overviewMetrics.disabledCount.value, state: 'muted' },
  ].map((item) => ({ ...item, percent: Math.round((item.value / total) * 100) }))
})

const activeTrendValues = computed(() => {
  const values = overviewMetrics.messageValues.value
  return values.length ? values : ZERO_TREND_VALUES
})

const activeTrendPoints = computed(() => {
  const values = activeTrendValues.value
  const max = Math.max(1, ...values)
  return values.map((value, index) => ({
    // Empty-state points keep the chart shape without inventing a time axis.
    label: overviewMetrics.messageTrend.value[index]?.label ?? '',
    x: values.length <= 1 ? 34 : 34 + (index / (values.length - 1)) * 460,
    y: 28 + (1 - value / max) * 120,
  }))
})

const onlineRateTrendValues = computed(() => {
  const values = overviewMetrics.onlineRateTrend.value.map((point) => Number(point.value ?? 0))
  return values.length ? values : ZERO_TREND_VALUES
})

const onlineRateTrendPoints = computed(() => {
  const values = onlineRateTrendValues.value
  const max = Math.max(100, ...values)
  return values.map((value, index) => ({
    // Empty-state points keep the chart shape without inventing a time axis.
    label: overviewMetrics.onlineRateTrend.value[index]?.label ?? '',
    x: values.length <= 1 ? 34 : 34 + (index / (values.length - 1)) * 460,
    y: 28 + (1 - value / max) * 120,
  }))
})

const alarmRecordTrendValues = computed(() => {
  const values = deviceAlarmOverview.recordTrend.value.map((point) => Number(point.value ?? 0))
  return values.length ? values : ZERO_TREND_VALUES
})

const alarmRecordTrendPoints = computed(() => {
  const values = alarmRecordTrendValues.value
  const max = Math.max(1, ...values)
  return values.map((value, index) => ({
    // Empty-state points keep the chart shape without inventing a time axis.
    label: deviceAlarmOverview.recordTrend.value[index]?.label ?? '',
    x: values.length <= 1 ? 34 : 34 + (index / (values.length - 1)) * 460,
    y: 28 + (1 - value / max) * 120,
  }))
})

const alertTopDevices = computed<IotAlarmRankRow[]>(() => deviceAlarmOverview.pagedTopTargets.value)

const alertTypeRows = computed(() => {
  return [
    {
      key: 'config-total',
      label: $t('IotWorkbench.alarm.configTotal'),
      value: deviceAlarmOverview.total.value,
      detail: $t('IotWorkbench.alarm.configTotalDetail'),
      icon: 'lucide:settings',
      state: deviceAlarmOverview.total.value ? 'info' : 'muted',
      percent: 100,
    },
    ...deviceAlarmOverview.levelRows.value,
  ]
})

const areaRows = computed<AreaRow[]>(() => [])

const realtimeMessages = computed<RealtimeMessage[]>(() => deviceAlarmOverview.pagedLatestRecords.value)

const commandSuccessRate = computed(() => 0)

const connectionMetrics = computed(() => [
  {
    label: $t('IotWorkbench.connection.successRate'),
    value: '0',
    unit: '%',
    detail: $t('IotWorkbench.connection.successDetail', { offline: 0, noData: 0 }),
    tone: 'muted' as const,
    trendTone: 'muted' as const,
    direction: 'flat' as const,
    trend: $t('IotWorkbench.trend.flat'),
    target: { connectionStatus: 'offline' as const },
  },
  {
    label: $t('IotWorkbench.connection.commandRate'),
    value: `${commandSuccessRate.value}`,
    unit: '%',
    detail: $t('IotWorkbench.connection.commandDetail'),
    tone: 'muted' as const,
    trendTone: 'muted' as const,
    direction: 'flat' as const,
    trend: $t('IotWorkbench.trend.flat'),
    target: { risk: 'watch' as const },
  },
  {
    label: $t('IotWorkbench.connection.reconnect'),
    value: '0',
    unit: $t('IotWorkbench.unit.device'),
    detail: $t('IotWorkbench.connection.reconnectDetail'),
    tone: 'muted' as const,
    trendTone: 'muted' as const,
    direction: 'flat' as const,
    trend: $t('IotWorkbench.trend.flat'),
    target: { anomalyKind: 'offline-frequent' as const },
  },
  {
    label: $t('IotWorkbench.connection.latency'),
    value: '0',
    unit: 'ms',
    detail: $t('IotWorkbench.connection.latencyDetail'),
    tone: 'muted' as const,
    trendTone: 'muted' as const,
    direction: 'flat' as const,
    trend: $t('IotWorkbench.trend.flat'),
    target: { risk: 'watch' as const },
  },
])

const quickActions = computed(() => [
  { label: $t('IotWorkbench.quick.alarm'), count: 0, icon: 'lucide:bell-ring', target: { businessStatus: 'alarm' as const } },
  { label: $t('IotWorkbench.quick.offline'), count: 0, icon: 'lucide:wifi-off', target: { connectionStatus: 'offline' as const } },
  { label: $t('IotWorkbench.quick.maintenance'), count: 0, icon: 'lucide:wrench', target: { businessStatus: 'maintenance' as const } },
  { label: $t('IotWorkbench.quick.upgrade'), count: 0, icon: 'lucide:upload-cloud', target: { risk: 'watch' as const } },
  { label: $t('IotWorkbench.quick.risk'), count: 0, icon: 'lucide:shield-alert', target: { risk: 'urgent' as const } },
])

const activeDashboardViewMeta = computed(() => {
  return dashboardViews.find((view) => view.key === activeDashboardView.value) ?? dashboardViews[0]
})

const activeDashboardWidgets = computed(() => {
  const enabledKinds = new Set(dashboardViewWidgets[activeDashboardView.value])
  return activeWidgets.value.filter((widget) => enabledKinds.has(widget.kind))
})

const selectedWidget = computed(() => activeWidgets.value.find((widget) => widget.id === selectedWidgetId.value) ?? null)
const componentPanelTitle = computed(() => {
  if (componentPanelMode.value === 'settings') return pageSettings.name
  return selectedWidget.value ? selectedWidget.value.title : $t('IotWorkbench.drawer.add')
})

function widgetTemplate(kind: WidgetKind) {
  return availableWidgetTemplates.find((template) => template.kind === kind) ?? availableWidgetTemplates[0]
}

function createWidget(kind: WidgetKind, id = `${kind}-${Date.now()}`): DashboardWidget {
  const template = widgetTemplate(kind)
  return {
    id,
    kind,
    title: template.title,
    size: template.size,
    config: {
      source: template.group === 'business' ? 'scene' : template.group === 'ops' ? 'alarm' : 'runtime',
      timeRange: $t('IotWorkbench.option.time.24h'),
      refresh: $t('IotWorkbench.option.refresh.30s'),
      metric: template.metric,
      chart: template.chart,
    },
  }
}

function addWidget(kind: WidgetKind) {
  const widget = createWidget(kind, `${kind}-${Date.now()}-${activeWidgets.value.length}`)
  activeWidgets.value = [...activeWidgets.value, widget]
  selectedWidgetId.value = widget.id
  layoutFeedback.value = $t('IotWorkbench.feedback.added')
  editMode.value = true
}

function removeWidget(widgetId: string) {
  activeWidgets.value = activeWidgets.value.filter((widget) => widget.id !== widgetId)
  selectedWidgetId.value = activeWidgets.value[0]?.id ?? ''
  layoutFeedback.value = $t('IotWorkbench.feedback.removed')
}

function updateWidget(widgetId: string, patch: DashboardWidgetPatch) {
  activeWidgets.value = activeWidgets.value.map((widget) => {
    if (widget.id !== widgetId) return widget
    return {
      ...widget,
      ...patch,
      config: {
        ...widget.config,
        ...(patch.config ?? {}),
      },
    }
  })
}

function selectWidget(widgetId: string) {
  selectedWidgetId.value = widgetId
  componentPanelMode.value = 'components'
  componentPanelOpen.value = true
}

function openComponentPanel(widgetId?: string) {
  if (widgetId) selectedWidgetId.value = widgetId
  editMode.value = true
  componentPanelMode.value = 'components'
  componentPanelOpen.value = true
  floatMenuOpen.value = false
}

function openPageSettings() {
  componentPanelMode.value = 'settings'
  componentPanelOpen.value = true
  floatMenuOpen.value = false
}

function saveLayout(scope: 'personal' | 'team') {
  layoutFeedback.value = scope === 'personal'
    ? $t('IotWorkbench.feedback.personalSaved')
    : $t('IotWorkbench.feedback.teamSaved')
}

function updatePageSettings(patch: Partial<PageSettings>) {
  Object.assign(pageSettings, patch)
}

function formatStatValue(value: number) {
  return statNumberFormatter.format(value)
}

function trendIcon(direction: 'up' | 'down' | 'flat') {
  if (direction === 'up') return 'RiseOutlined'
  if (direction === 'down') return 'FallOutlined'
  return 'StockOutlined'
}

function applyMetricTarget(target: Partial<IotDeviceFilters>) {
  if (!('deviceIds' in target)) filters.deviceIds = undefined
  Object.assign(filters, target)
  loadWorkbench()
}

function focusArea(area: string) {
  filters.area = area
  filters.deviceIds = undefined
  loadWorkbench()
}

function isAlarmTodo(todo: IotDeviceTodo) {
  return todo.actionKind === 'verify-alarm'
}

function todoRiskKind(todo: IotDeviceTodo) {
  if (todo.actionKind === 'verify-alarm') return 'fault-code'
  const relatedDevices = devices.value.filter((item) => todo.deviceIds.includes(item.id))
  if (relatedDevices.some((item) => getIotDeviceConnectionStatus(item) === 'offline')) return 'offline-frequent'
  return 'data-deviation'
}

function todoRiskKindLabel(todo: IotDeviceTodo) {
  return {
    'offline-frequent': $t('IotWorkbench.todo.kind.connection'),
    'data-deviation': $t('IotWorkbench.todo.kind.deviation'),
    'fault-code': $t('IotWorkbench.todo.kind.alarm'),
  }[todoRiskKind(todo)]
}

function todoPriorityLabel(todo: IotDeviceTodo) {
  return {
    urgent: $t('IotWorkbench.todo.priority.urgent'),
    watch: $t('IotWorkbench.todo.priority.high'),
    normal: $t('IotWorkbench.todo.priority.medium'),
  }[todo.priority]
}

function findTodoAlarm(todo: IotDeviceTodo) {
  for (const deviceId of todo.deviceIds) {
    const device = devices.value.find((item) => item.id === deviceId)
    const alarm = [...(device?.alarms ?? [])]
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .find((item) => item.status !== 'resolved')
    if (alarm) return alarm
  }
  return null
}

function primaryTodoDevice(todo: IotDeviceTodo) {
  return devices.value.find((item) => item.id === todo.deviceIds[0]) ?? null
}

function todoDisplayTitle(todo: IotDeviceTodo) {
  if (isAlarmTodo(todo)) {
    return findTodoAlarm(todo)?.title ?? todo.title ?? $t('IotWorkbench.todo.defaultAlarm')
  }
  const device = primaryTodoDevice(todo)
  if (!device) return todo.title
  if (todoRiskKind(todo) === 'offline-frequent') return $t('IotWorkbench.todo.connectionTitle', { device: device.name })
  return $t('IotWorkbench.todo.deviationTitle', { device: device.name })
}

function todoMetaDeviceLabel(todo: IotDeviceTodo) {
  if (isAlarmTodo(todo)) {
    return todo.deviceIds.length
      ? $t('IotWorkbench.todo.deviceCount', { total: todo.deviceIds.length })
      : (todo.sourceLabel ?? $t('IotWorkbench.todo.defaultAlarm'))
  }
  return primaryTodoDevice(todo)?.name ?? $t('IotWorkbench.todo.targetDevice')
}

function todoConnectionExample(todo: IotDeviceTodo) {
  const device = primaryTodoDevice(todo)
  if (!device) return todo.detail
  const connectionType = todoConnectionType(todo, device)
  if (connectionType === 'no-data') {
    return $t('IotWorkbench.todo.noDataDetail', { device: device.name })
  }
  if (connectionType === 'offline') {
    return $t('IotWorkbench.todo.offlineDetail', { device: device.name })
  }
  return $t('IotWorkbench.todo.fluctuationDetail', { status: deviceStatusLabel(device.status), time: device.lastSeen })
}

function todoDeviationExample(todo: IotDeviceTodo) {
  const device = primaryTodoDevice(todo)
  if (!device) return todo.detail
  const point = findPrimaryDeviationPoint(device)
  if (!point) return todo.detail
  const unit = point.unit ?? ''
  const value = point.value ?? '-'
  return $t('IotWorkbench.todo.deviationDetail', { point: point.name, value, unit })
}

function todoDisplayDetail(todo: IotDeviceTodo) {
  if (isAlarmTodo(todo)) return todo.detail
  if (todoRiskKind(todo) === 'offline-frequent') return todoConnectionExample(todo)
  return todoDeviationExample(todo)
}

function findPrimaryDeviationPoint(device: IotDevice) {
  return device.telemetry.find((item) => item.status === 'warning' || item.status === 'critical') ?? device.telemetry[0]
}

function todoConnectionType(todo: IotDeviceTodo, device: IotDevice) {
  const title = `${todo.title} ${todo.detail}`.toLowerCase()
  if (device.status === 'no-data' || title.includes('无数据') || title.includes('未上报')) return 'no-data'
  if (device.status === 'offline' || title.includes('离线')) return 'offline'
  return 'fluctuation'
}

function deviceStatusLabel(status: IotDevice['status']) {
  return {
    online: $t('IotWorkbench.option.connection.online'),
    offline: $t('IotWorkbench.option.connection.offline'),
    disabled: $t('IotWorkbench.option.connection.disabled'),
    'no-data': $t('IotWorkbench.option.business.noData'),
    alarm: $t('IotWorkbench.option.business.alarm'),
  }[status] ?? $t('IotWorkbench.status.unknown')
}

function resolveOverviewTrendRange(): DeviceGroupTrendRange {
  return dashboardFilters.messageTrendRange
}

function updateMessageTrendRange(range: DeviceGroupTrendRange) {
  if (dashboardFilters.messageTrendRange === range) return
  dashboardFilters.messageTrendRange = range
  void overviewMetrics.loadMessageTrend(range)
}

function updateOnlineRateTrendRange(range: DeviceGroupTrendRange) {
  if (dashboardFilters.onlineRateTrendRange === range) return
  dashboardFilters.onlineRateTrendRange = range
  void overviewMetrics.loadOnlineRateTrend(range)
}

function updateAlarmTrendRange(range: DeviceGroupTrendRange) {
  void deviceAlarmOverview.updateTrendRange(range)
}

function updateAlarmRankRange(range: DeviceGroupTrendRange) {
  void deviceAlarmOverview.updateRankRange(range)
}

function applyQuickAction(target: Partial<IotDeviceFilters>) {
  applyMetricTarget(target)
}

function goTodoAction(todo: IotDeviceTodo) {
  if (isAlarmTodo(todo)) {
    push({
      path: '/iot-user/device/alarm',
      query: { projectId: resolvedProjectId.value },
    })
    return
  }

  const deviceId = todo.deviceIds[0]
  push({
    path: '/iot/health',
    query: {
      projectId: resolvedProjectId.value,
      todoId: todo.id,
      ...(deviceId ? { deviceId } : {}),
    },
  })
}

async function loadWorkbench() {
  filters.projectId = resolvedProjectId.value
  const [result] = await Promise.all([
    iotDeviceService.getWorkbench(filters),
    overviewMetrics.load(resolveOverviewTrendRange(), dashboardFilters.onlineRateTrendRange),
    deviceAlarmOverview.load(),
  ])
  if (result.ok) workbench.value = result.data
}

function goDeviceAlarmRecord(deviceId?: string) {
  if (!deviceId) return
  push({
    path: `/iot-user/device/list/Detail/${encodeURIComponent(deviceId)}`,
    query: {
      projectId: resolvedProjectId.value,
      tab: 'alarm',
    },
  })
}

onMounted(() => {
  void loadWorkbench()
})

return {
  projectId: resolvedProjectId,
  workbench,
  editMode,
  fullscreen,
  selectedWidgetId,
  componentPanelOpen,
  componentPanelMode,
  activeDashboardView,
  layoutFeedback,
  floatToolsOpen,
  floatMenuOpen,
  devices,
  todoRows,
  todoStatusSummary,
  deviceStatCards,
  formatStatValue,
  trendIcon,
  applyMetricTarget,
  dashboardViews,
  activeDashboardViewMeta,
  activeDashboardWidgets,
  selectedWidget,
  componentPanelTitle,
  availableWidgetTemplates,
  activeWidgets,
  widgetTemplate,
  addWidget,
  removeWidget,
  updateWidget,
  selectWidget,
  openComponentPanel,
  openPageSettings,
  saveLayout,
  updatePageSettings,
  pageSettings,
  dashboardViewOptions,
  widgetSourceOptions,
  widgetTimeRangeOptions,
  refreshOptions,
  widgetChartOptions,
  widgetSizeOptions,
  pageDensityOptions,
  pageScopeOptions,
  messageTrendRange: computed(() => dashboardFilters.messageTrendRange),
  onlineRateTrendRange: computed(() => dashboardFilters.onlineRateTrendRange),
  alarmTrendRange: computed(() => deviceAlarmOverview.trendRange.value),
  alarmRankRange: computed(() => deviceAlarmOverview.rankRange.value),
  trendRangeOptions,
  activityMetrics,
  messageTrendWindowLabel,
  onlineRateTrendWindowLabel,
  activeDeviceCount,
  activeTrendValues,
  activeTrendPoints,
  onlineRateTrendValues,
  onlineRateTrendPoints,
  alarmRecordTrendValues,
  alarmRecordTrendPoints,
  statusDistribution,
  alertTopDevices,
  alertTypeRows,
  areaRows,
  realtimeMessages,
  connectionMetrics,
  alarmRankPageIndex: computed(() => deviceAlarmOverview.rankPageIndex.value),
  alarmRankPageTotal: deviceAlarmOverview.rankPageTotal,
  latestAlarmPageIndex: computed(() => deviceAlarmOverview.latestPageIndex.value),
  latestAlarmPageTotal: deviceAlarmOverview.latestPageTotal,
  quickActions,
  applyQuickAction,
  updateMessageTrendRange,
  updateOnlineRateTrendRange,
  updateAlarmTrendRange,
  updateAlarmRankRange,
  changeAlarmRankPage: deviceAlarmOverview.changeRankPage,
  changeLatestAlarmPage: deviceAlarmOverview.changeLatestPage,
  goDeviceAlarmRecord,
  focusArea,
  todoRiskKind,
  todoRiskKindLabel,
  todoPriorityLabel,
  todoDisplayTitle,
  todoDisplayDetail,
  todoMetaDeviceLabel,
  goTodoAction,
}
}
