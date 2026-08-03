import type { ServiceResult } from '@device-manager-ui/views/device/shared/services/shared/serviceResult'

export type Iot2TimeRange = 'today' | '7d' | '30d' | 'custom'
export type Iot2TrendWindow = '24h' | '7d' | '30d'
export type Iot2DeviceStatus = 'online' | 'offline' | 'alarm' | 'inactive'
export type Iot2AlarmSeverity = 'critical' | 'major' | 'minor'
export type Iot2AlarmStatus = 'unhandled' | 'processing' | 'closed'
export type Iot2KpiTone = 'default' | 'ok' | 'warn' | 'danger' | 'info' | 'muted'
export type Iot2DistributionDimension = 'product' | 'space' | 'tag'
export type Iot2GeoHeatMode = 'total' | 'onlineRate' | 'alarmDensity'

export type Iot2PermissionKey =
  | 'viewDeviceList'
  | 'viewAlertCenter'
  | 'viewConnectionQuality'
  | 'viewTraffic'
  | 'viewHealth'
  | 'viewMap'
  | 'viewSecurity'
  | 'viewSpace'
  | 'viewTagManagement'

export interface Iot2Option {
  key: string
  label: string
}

export interface Iot2OverviewFilters {
  projectId: string
  timeRange: Iot2TimeRange
  trendWindow: Iot2TrendWindow
  productKey: string
  groupKey: string
  customStart?: string
  customEnd?: string
}

export interface Iot2DrillTarget {
  path: string
  query?: Record<string, string>
}

export interface Iot2MetricTrend {
  direction: 'up' | 'down' | 'flat'
  value: string
  label: string
  tone: Iot2KpiTone
}

export interface Iot2KpiCard {
  key: 'total' | 'online' | 'alarm' | 'silent' | 'activation' | 'upgrade'
  title: string
  value: number
  unit: string
  subtitle: string
  detail: string
  trend: Iot2MetricTrend
  tone: Iot2KpiTone
  icon: string
  target: Iot2DrillTarget
}

export interface Iot2StatusDistributionItem {
  status: Iot2DeviceStatus
  label: string
  value: number
  percent: number
  target: Iot2DrillTarget
}

export interface Iot2DistributionItem {
  key: string
  label: string
  total: number
  problemCount: number
  percent: number
  target: Iot2DrillTarget
}

export interface Iot2DistributionGroup {
  dimension: Iot2DistributionDimension
  label: string
  items: Iot2DistributionItem[]
}

export interface Iot2AlarmTrendPoint {
  label: string
  critical: number
  major: number
  minor: number
}

export interface Iot2AlarmTrend {
  window: Iot2TrendWindow
  points: Iot2AlarmTrendPoint[]
}

export interface Iot2TopAlarmDevice {
  id: string
  name: string
  productName: string
  alarmCount: number
  latestAlarmAt: string
  severity: Iot2AlarmSeverity
  target: Iot2DrillTarget
}

export interface Iot2RealtimeAlarm {
  id: string
  severity: Iot2AlarmSeverity
  deviceId: string
  deviceName: string
  productName: string
  alarmType: string
  happenedAt: string
  status: Iot2AlarmStatus
  target: Iot2DrillTarget
}

export type Iot2ProductDistributionItem = Iot2DistributionItem

export interface Iot2ActivityMetric {
  key: 'daily' | 'weekly' | 'monthly'
  label: string
  value: number
  unit: string
  percent: number
  trend: Iot2MetricTrend
  target: Iot2DrillTarget
}

export interface Iot2ActivityTrendPoint {
  label: string
  activeDevices: number
  uplinkMessages: number
  downlinkMessages: number
}

export interface Iot2ProgressMetric {
  label: string
  value: string
  percent: number
  tone: Iot2KpiTone
  trend: Iot2MetricTrend
  summary: string
  target: Iot2DrillTarget
}

export interface Iot2DeviceActivity {
  metrics: Iot2ActivityMetric[]
  trend: Iot2ActivityTrendPoint[]
  reportNormalRate: Iot2ProgressMetric
}

export interface Iot2AlarmTypeDistributionItem {
  key: string
  label: string
  value: number
  percent: number
  tone: Iot2KpiTone
  target: Iot2DrillTarget
}

export interface Iot2ConnectionMetric {
  key: 'connectSuccessRate' | 'reconnectFrequency' | 'commandSuccessRate' | 'responseLatency'
  label: string
  value: string
  unit: string
  detail: string
  tone: Iot2KpiTone
  trend: Iot2MetricTrend
  target: Iot2DrillTarget
}

export interface Iot2ConnectionTrendPoint {
  label: string
  successRate: number
}

export interface Iot2ProtocolErrorItem {
  key: string
  protocol: string
  errorRate: number
  count: number
  target: Iot2DrillTarget
}

export interface Iot2ConnectionQuality {
  metrics: Iot2ConnectionMetric[]
  trend: Iot2ConnectionTrendPoint[]
  protocolErrors: Iot2ProtocolErrorItem[]
}

export interface Iot2HealthMetric {
  key: 'firmwarePending' | 'legacyFirmware' | 'lowBattery' | 'selfCheckFailed'
  label: string
  value: number
  unit: string
  detail: string
  percent?: number
  tone: Iot2KpiTone
  trend: Iot2MetricTrend
  target: Iot2DrillTarget
  note?: string
}

export interface Iot2DeviceHealth {
  metrics: Iot2HealthMetric[]
}

export interface Iot2SecurityMetric {
  key: 'authFailures' | 'suspectedSpoofing' | 'expiringKeys'
  label: string
  value: number
  unit: string
  detail: string
  tone: Iot2KpiTone
  trend: Iot2MetricTrend
  target: Iot2DrillTarget
}

export interface Iot2SecuritySummary {
  metrics: Iot2SecurityMetric[]
}

export interface Iot2GeoRegionPoint {
  key: string
  label: string
  x: number
  y: number
  total: number
  onlineRate: number
  alarmDensity: number
  target: Iot2DrillTarget
}

export interface Iot2GeoDistribution {
  hasGeoData: boolean
  modes: Array<{ key: Iot2GeoHeatMode; label: string }>
  regions: Iot2GeoRegionPoint[]
  emptyHint: string
  configTarget: Iot2DrillTarget
}

export interface Iot2QuickEntry {
  key: string
  label: string
  hint: string
  icon: string
  permission: Iot2PermissionKey
  target: Iot2DrillTarget
}

export interface Iot2DeviceOverview {
  projectId: string
  updatedAt: string
  refreshPolicy: {
    kpiSeconds: number
    alarmSeconds: number
    trendSeconds: number
  }
  permissions: Record<Iot2PermissionKey, boolean>
  filterOptions: {
    timeRanges: Iot2Option[]
    products: Iot2Option[]
    groups: Iot2Option[]
  }
  kpis: Iot2KpiCard[]
  statusDistribution: Iot2StatusDistributionItem[]
  distributionDimensions: Iot2DistributionGroup[]
  alarmTrend: Iot2AlarmTrend
  alertTypeDistribution: Iot2AlarmTypeDistributionItem[]
  alarmHandling: Iot2ProgressMetric
  topAlarmDevices: Iot2TopAlarmDevice[]
  realtimeAlarms: Iot2RealtimeAlarm[]
  productDistribution: Iot2ProductDistributionItem[]
  activity: Iot2DeviceActivity
  connectionQuality: Iot2ConnectionQuality
  deviceHealth: Iot2DeviceHealth
  securitySummary: Iot2SecuritySummary
  geoDistribution: Iot2GeoDistribution
  quickEntries: Iot2QuickEntry[]
}

export interface Iot2DeviceOverviewAdapter {
  getOverview(filters: Iot2OverviewFilters): Promise<ServiceResult<Iot2DeviceOverview>>
  listRealtimeAlarms(filters: Iot2OverviewFilters): Promise<ServiceResult<Iot2RealtimeAlarm[]>>
}

export type Iot2DeviceListStatus = Iot2DeviceStatus | 'disabled'
export type Iot2DeviceListAlarmStatus = 'all' | 'unhandled' | 'none'
export type Iot2DeviceListFirmwareStatus = 'all' | 'latest' | 'pending' | 'legacy'
export type Iot2DeviceListSortBy =
  | 'name'
  | 'status'
  | 'lastReportAt'
  | 'activatedAt'
  | 'alarmCount'
  | 'createdAt'
export type Iot2DeviceListSortOrder = 'asc' | 'desc'
export type Iot2DeviceListDensity = 'compact' | 'standard' | 'comfortable'
export type Iot2DeviceListSelectionMode = 'page' | 'all-matched'
export type Iot2DeviceListColumnKey =
  | 'name'
  | 'identity'
  | 'product'
  | 'group'
  | 'space'
  | 'status'
  | 'lastReportAt'
  | 'alarm'
  | 'ip'
  | 'protocol'
  | 'firmwareVersion'
  | 'signalStrength'
  | 'batteryLevel'
  | 'activatedAt'
  | 'latestAlarmAt'
  | 'location'
  | 'createdAt'
  | 'createdBy'
  | 'tags'

export type Iot2DeviceBatchAction =
  | 'enable'
  | 'disable'
  | 'moveGroup'
  | 'moveSpace'
  | 'addTag'
  | 'removeTag'
  | 'sendCommand'
  | 'firmwareUpgrade'
  | 'restart'
  | 'delete'

export interface Iot2DeviceListQuery {
  projectId: string
  keyword: string
  statuses: Iot2DeviceListStatus[]
  productKey: string
  groupKey: string
  spaceId: string
  includeChildSpaces: boolean
  protocol: string
  regionKey: string
  departmentKey: string
  province: string
  city: string
  district: string
  activatedFrom: string
  activatedTo: string
  lastReportFrom: string
  lastReportTo: string
  lastReportPreset: '' | 'silent24h'
  alarmStatus: Iot2DeviceListAlarmStatus
  firmwareStatus: Iot2DeviceListFirmwareStatus
  firmwareVersion: string
  tags: string[]
  activeWindow: '' | '1d' | '7d' | '30d'
  deviceId: string
  scope: string
  page: number
  pageSize: number
  sortBy: Iot2DeviceListSortBy
  sortOrder: Iot2DeviceListSortOrder
  density: Iot2DeviceListDensity
  savedFilterId: string
}

export interface Iot2DeviceListOption extends Iot2Option {
  count?: number
  parentKey?: string
}

export interface Iot2DeviceListFilterOptions {
  statuses: Array<{ key: Iot2DeviceListStatus; label: string; tone: Iot2KpiTone; count: number }>
  products: Iot2DeviceListOption[]
  groups: Iot2DeviceListOption[]
  spaces: Array<Iot2DeviceListOption & { level: number; path: string; type: Iot2SpaceType }>
  protocols: Iot2DeviceListOption[]
  regions: Iot2DeviceListOption[]
  departments: Iot2DeviceListOption[]
  provinces: Iot2DeviceListOption[]
  cities: Iot2DeviceListOption[]
  districts: Iot2DeviceListOption[]
  firmwareVersions: Iot2DeviceListOption[]
  tags: Iot2DeviceListOption[]
}

export interface Iot2DeviceSelectedCondition {
  key: string
  label: string
  value: string
  icon?: string
}

export interface Iot2DeviceListItem {
  id: string
  name: string
  deviceId: string
  serialNo: string
  imei: string
  mac: string
  productKey: string
  productName: string
  groupKey: string
  groupName: string
  spaceId: string
  spaceName: string
  spacePath: string
  spacePathIds: string[]
  spaceType: Iot2SpaceType
  protocol: string
  status: Iot2DeviceListStatus
  online: boolean
  disabled: boolean
  activated: boolean
  ip: string
  firmwareVersion: string
  firmwareStatus: Exclude<Iot2DeviceListFirmwareStatus, 'all'>
  signalStrength: number
  batteryLevel?: number
  regionKey: string
  regionName: string
  departmentKey: string
  departmentName: string
  province: string
  city: string
  district: string
  location: string
  lastReportAt: string
  lastReportRelative: string
  silentHours: number
  activatedAt: string
  alarmCount: number
  latestAlarmAt: string
  createdAt: string
  createdBy: string
  tags: string[]
  hasLocation: boolean
  commandSupported: boolean
}

export interface Iot2DeviceListSummary {
  total: number
  online: number
  offline: number
  alarm: number
  inactive: number
  disabled: number
  silent: number
  unhandledAlarmDevices: number
  upgradePending: number
}

export interface Iot2DeviceListPageResult {
  projectId: string
  updatedAt: string
  query: Iot2DeviceListQuery
  items: Iot2DeviceListItem[]
  total: number
  page: number
  pageSize: number
  summary: Iot2DeviceListSummary
  filterOptions: Iot2DeviceListFilterOptions
  refreshPolicy: {
    listSeconds: number
  }
}

export interface Iot2DeviceColumnPreference {
  key: Iot2DeviceListColumnKey
  label: string
  visible: boolean
  fixed?: boolean
  width: number
}

export interface Iot2DeviceListPreferences {
  density: Iot2DeviceListDensity
  pageSize: number
  columns: Iot2DeviceColumnPreference[]
}

export interface Iot2DeviceSavedFilter {
  id: string
  name: string
  description: string
  query: Partial<Iot2DeviceListQuery>
  createdAt: string
}

export interface Iot2DeviceQuickSummary {
  device: Iot2DeviceListItem
  recentReports: Array<{ key: string; label: string; value: string; status: 'normal' | 'warning' | 'critical' }>
  recentAlarms: Array<{ id: string; severity: Iot2AlarmSeverity; type: string; happenedAt: string; status: Iot2AlarmStatus }>
}

export type Iot2SpaceType = 'campus' | 'building' | 'floor' | 'area' | 'room' | 'custom'
export type Iot2SpaceViewMode = 'tree' | 'map'
export type Iot2SpaceTreeMode = 'all' | 'owned' | 'alarm' | 'empty'
export type Iot2SpaceDetailTab = 'overview' | 'devices' | 'children' | 'alarms' | 'settings'
export type Iot2SpaceMapMode = 'deviceCount' | 'onlineRate' | 'alarmDensity'

export interface Iot2SpaceCustomFieldSchema {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'switch'
  placeholder?: string
  options?: Iot2Option[]
  defaultValue?: string | number | boolean
}

export interface Iot2SpaceNode {
  id: string
  projectId: string
  parentId: string | null
  name: string
  code: string
  type: Iot2SpaceType
  level: number
  order: number
  pathIds: string[]
  pathNames: string[]
  pathText: string
  address: string
  longitude: number
  latitude: number
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  description: string
  tags: string[]
  deviceCount: number
  totalDeviceCount: number
  onlineRate: number
  alarmCount: number
  silentCount: number
  customFieldSchema: Iot2SpaceCustomFieldSchema[]
  customFields: Record<string, string | number | boolean>
  createdAt: string
  updatedAt: string
}

export interface Iot2SpaceTreeSummary {
  total: number
  maxDepth: number
  deviceBoundCount: number
  leafCount: number
  alarmCount: number
  emptyCount: number
}

export interface Iot2SpaceQuery {
  projectId: string
  keyword: string
  mode: Iot2SpaceTreeMode
  view: Iot2SpaceViewMode
  spaceId: string
  includeChildSpaces: boolean
}

export interface Iot2SpaceTreeResult {
  projectId: string
  updatedAt: string
  query: Iot2SpaceQuery
  items: Iot2SpaceNode[]
  summary: Iot2SpaceTreeSummary
}

export interface Iot2SpaceMetric {
  key: 'deviceTotal' | 'onlineRate' | 'alarmCount' | 'silentCount' | 'upgradePending' | 'childSpaces'
  label: string
  value: number
  unit: string
  tone: Iot2KpiTone
  detail: string
  target?: Iot2DrillTarget
}

export interface Iot2SpaceDetail {
  space: Iot2SpaceNode
  ancestors: Iot2SpaceNode[]
  children: Iot2SpaceNode[]
  metrics: Iot2SpaceMetric[]
  deviceStatusDistribution: Iot2StatusDistributionItem[]
  alarmTrend: Iot2AlarmTrend
  topDevices: Iot2DeviceListItem[]
  recentDevices: Iot2DeviceListItem[]
  recentAlarms: Iot2RealtimeAlarm[]
  mapPoint: {
    x: number
    y: number
    total: number
    onlineRate: number
    alarmDensity: number
  }
  deviceQuery: Partial<Iot2DeviceListQuery>
  customFieldSchema: Iot2SpaceCustomFieldSchema[]
}

export interface Iot2SpaceDraft {
  id?: string
  projectId: string
  parentId: string | null
  name: string
  code: string
  type: Iot2SpaceType
  address: string
  longitude: number
  latitude: number
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  description: string
  tags: string[]
  customFields: Record<string, string | number | boolean>
}

export interface Iot2SpaceImportResult {
  jobId: string
  fileName: string
  total: number
  createdCount: number
  updatedCount: number
  failedCount: number
  status: 'queued' | 'running' | 'completed' | 'failed'
  message: string
  createdAt: string
  updatedAt: string
}

export interface Iot2SpaceAdapter {
  listSpaces(query: Iot2SpaceQuery): Promise<ServiceResult<Iot2SpaceTreeResult>>
  getSpaceDetail(projectId: string, spaceId: string): Promise<ServiceResult<Iot2SpaceDetail>>
  saveSpace(projectId: string, draft: Iot2SpaceDraft): Promise<ServiceResult<Iot2SpaceNode>>
  deleteSpace(projectId: string, spaceId: string, mode?: 'cascade' | 'reassign'): Promise<ServiceResult<Iot2SpaceImportResult>>
  importSpaces(projectId: string, fileName: string): Promise<ServiceResult<Iot2SpaceImportResult>>
}

export type Iot2TagColor = 'neutral' | 'blue' | 'green' | 'orange' | 'red' | 'purple'

export interface Iot2DeviceTag {
  id: string
  name: string
  color: Iot2TagColor
  description: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface Iot2TagQuery {
  projectId: string
  keyword: string
}

export interface Iot2TagPageResult {
  projectId: string
  updatedAt: string
  query: Iot2TagQuery
  items: Iot2DeviceTag[]
  total: number
}

export interface Iot2TagDraft {
  id?: string
  name: string
  color: Iot2TagColor
  description: string
}

export interface Iot2TagAdapter {
  listTags(query: Iot2TagQuery): Promise<ServiceResult<Iot2TagPageResult>>
  saveTag(projectId: string, draft: Iot2TagDraft): Promise<ServiceResult<Iot2DeviceTag>>
  deleteTag(projectId: string, tagId: string): Promise<ServiceResult<Iot2TagPageResult>>
}

export type Iot2DeviceMapViewMode = 'outdoor' | 'indoor'
export type Iot2DeviceMapBaseLayer = 'standard' | 'satellite' | 'dark'
export type Iot2DeviceMapLayer =
  | 'points'
  | 'clusters'
  | 'heatmap'
  | 'onlineRate'
  | 'type'
  | 'spaceBoundary'
  | 'inspectors'
export type Iot2DeviceMapTool = 'pan' | 'measure' | 'rectangle' | 'circle' | 'path' | 'locate'
export type Iot2DeviceMapSortBy = 'distance' | 'status' | 'lastReport'

export interface Iot2DeviceMapViewport {
  centerLng: number
  centerLat: number
  zoom: number
  bounds?: {
    west: number
    south: number
    east: number
    north: number
  }
}

export interface Iot2DeviceMapQuery {
  projectId: string
  view: Iot2DeviceMapViewMode
  viewport: Iot2DeviceMapViewport
  layers: Iot2DeviceMapLayer[]
  baseLayer: Iot2DeviceMapBaseLayer
  productKeys: string[]
  spaceId: string
  includeChildSpaces: boolean
  statuses: Iot2DeviceListStatus[]
  tags: string[]
  timeRange: Iot2TimeRange
  keyword: string
  selectedDeviceId: string
  floorId: string
  sortBy: Iot2DeviceMapSortBy
}

export interface Iot2DeviceMapPoint {
  id: string
  deviceId: string
  name: string
  productKey: string
  productName: string
  productIcon: string
  status: Iot2DeviceListStatus
  longitude: number
  latitude: number
  x: number
  y: number
  floorId?: string
  indoorX?: number
  indoorY?: number
  spaceId: string
  spaceName: string
  spacePath: string
  alarmCount: number
  lastReportRelative: string
  location: string
  tags: string[]
  commandSupported: boolean
  keyMetrics: Array<{ key: string; label: string; value: string; tone: Iot2KpiTone }>
  target: Iot2DrillTarget
}

export interface Iot2DeviceMapCluster {
  id: string
  label: string
  level: 'city' | 'campus' | 'building'
  x: number
  y: number
  longitude: number
  latitude: number
  count: number
  online: number
  offline: number
  alarm: number
  inactive: number
  onlineRate: number
  alarmDensity: number
  targetViewport: Iot2DeviceMapViewport
}

export interface Iot2DeviceMapSpaceBoundary {
  id: string
  name: string
  type: Iot2SpaceType
  points: Array<{ x: number; y: number }>
  deviceCount: number
  alarmCount: number
  onlineRate: number
}

export interface Iot2DeviceMapInspector {
  id: string
  name: string
  role: string
  x: number
  y: number
  longitude: number
  latitude: number
  status: 'online' | 'busy' | 'offline'
  updatedAt: string
}

export interface Iot2DeviceMapRegionStat {
  id: string
  title: string
  rangeLabel: string
  total: number
  statusDistribution: Iot2StatusDistributionItem[]
  productDistribution: Array<{ productKey: string; label: string; value: number; percent: number }>
  spaces: Array<{ id: string; name: string; path: string; count: number }>
  topAlarms: Iot2RealtimeAlarm[]
  silentDevices: Iot2DeviceMapPoint[]
}

export interface Iot2DeviceMapFloorPlan {
  id: string
  spaceId: string
  buildingName: string
  floorName: string
  imageLabel: string
  width: number
  height: number
  zones: Array<{ id: string; name: string; x: number; y: number; width: number; height: number }>
}

export interface Iot2DeviceMapFilterOptions {
  products: Iot2DeviceListOption[]
  spaces: Array<Iot2DeviceListOption & { level: number; path: string; type: Iot2SpaceType }>
  statuses: Array<{ key: Iot2DeviceListStatus; label: string; tone: Iot2KpiTone; count: number }>
  tags: Iot2DeviceListOption[]
  floors: Array<Iot2Option & { spaceId: string }>
}

export interface Iot2DeviceMapSummary {
  total: number
  inView: number
  online: number
  offline: number
  alarm: number
  inactive: number
  noLocation: number
}

export interface Iot2DeviceMapResult {
  projectId: string
  updatedAt: string
  query: Iot2DeviceMapQuery
  points: Iot2DeviceMapPoint[]
  clusters: Iot2DeviceMapCluster[]
  heatPoints: Array<{ x: number; y: number; value: number; tone: Iot2KpiTone }>
  boundaries: Iot2DeviceMapSpaceBoundary[]
  inspectors: Iot2DeviceMapInspector[]
  selectedDevice?: Iot2DeviceMapPoint
  regionStat: Iot2DeviceMapRegionStat
  floorPlans: Iot2DeviceMapFloorPlan[]
  activeFloorPlan?: Iot2DeviceMapFloorPlan
  indoorPoints: Iot2DeviceMapPoint[]
  summary: Iot2DeviceMapSummary
  filterOptions: Iot2DeviceMapFilterOptions
}

export interface Iot2DeviceMapAdapter {
  getDeviceMap(query: Iot2DeviceMapQuery): Promise<ServiceResult<Iot2DeviceMapResult>>
}

export type Iot2DeviceDetailTab =
  | 'overview'
  | 'realtime'
  | 'history'
  | 'alarms'
  | 'commands'
  | 'connection'
  | 'firmware'
  | 'simulator'
  | 'logs'
  | 'lifecycle'
  | 'relations'
  | 'settings'

export type Iot2DeviceRealtimeTone = 'normal' | 'warning' | 'critical' | 'offline'
export type Iot2DeviceTrendTone = 'good' | 'bad' | 'neutral'
export type Iot2DeviceLifecycleStage =
  | 'created'
  | 'activated'
  | 'online'
  | 'offline'
  | 'report'
  | 'alarm'
  | 'command'
  | 'config'
  | 'maintenance'

export interface Iot2DeviceRealtimeItem {
  id: string
  name: string
  identifier: string
  groupName: string
  dataType: string
  value: string
  unit?: string
  updatedAt: string
  tone: Iot2DeviceRealtimeTone
  description: string
  accessMode?: 'read' | 'write' | 'readwrite'
  frequency?: string
  keyProperty?: boolean
  writable?: boolean
  readable?: boolean
  valueRange?: string
  sparkline?: Array<{ label: string; value: number; abnormal?: boolean }>
}

export interface Iot2DeviceEventRecord {
  id: string
  name: string
  identifier: string
  level: Iot2AlarmSeverity | 'info'
  happenedAt: string
  payload: string
  status: 'received' | 'suppressed' | 'converted'
}

export interface Iot2DeviceServiceRecord {
  id: string
  name: string
  identifier: string
  callMode: 'sync' | 'async'
  lastCalledAt: string
  successRate: number
  inputCount: number
  outputCount: number
  status: 'available' | 'limited' | 'disabled'
}

export interface Iot2DeviceCommandRecord {
  id: string
  commandName: string
  sentAt: string
  operator: string
  status: 'success' | 'running' | 'failed'
  durationMs: number
  payload: string
  response?: string
  errorReason?: string
  mode?: 'immediate' | 'scheduled' | 'periodic'
  serviceIdentifier?: string
}

export interface Iot2DeviceLifecycleLog {
  id: string
  happenedAt: string
  stage: Iot2DeviceLifecycleStage
  title: string
  detail: string
  actor: string
  tone: Iot2DeviceRealtimeTone
}

export interface Iot2DeviceMetricCard {
  key: 'alarm24h' | 'uplink24h' | 'downlink24h' | 'onlineRate7d'
  label: string
  value: string
  unit: string
  detail: string
  trend: Iot2MetricTrend
  tone: Iot2KpiTone
  tab: Iot2DeviceDetailTab
}

export interface Iot2DeviceTrendSeries {
  key: string
  label: string
  unit?: string
  tone: Iot2KpiTone
  points: Array<{ label: string; value: number; abnormal?: boolean }>
}

export interface Iot2DeviceTimelineEvent {
  id: string
  type: 'property' | 'online' | 'offline' | 'alarm' | 'command' | 'config'
  title: string
  summary: string
  happenedAt: string
  detail: string
  tone: Iot2DeviceRealtimeTone
}

export interface Iot2DeviceLocationSnapshot {
  longitude: number
  latitude: number
  address: string
  mapLabel: string
  accuracy: string
}

export interface Iot2DeviceHistoryData {
  query: {
    propertyKeys: string[]
    timeRange: '1h' | '24h' | '7d' | '30d'
    granularity: 'second' | 'minute' | 'hour' | 'day'
    aggregation: 'avg' | 'max' | 'min' | 'sum' | 'first' | 'last'
  }
  series: Iot2DeviceTrendSeries[]
  rows: Array<{ id: string; time: string; values: Record<string, string> }>
  downsampleHint: string
}

export interface Iot2DeviceAlarmRecord {
  id: string
  severity: Iot2AlarmSeverity
  name: string
  type: string
  triggeredAt: string
  triggerValue: string
  threshold: string
  status: Iot2AlarmStatus
  handler: string
  duration: string
  contextTrend: Iot2DeviceTrendSeries
  relatedEvents: string[]
  records: Array<{ time: string; actor: string; action: string; note: string }>
}

export interface Iot2DeviceConnectionSnapshot {
  status: string
  connectedAt: string
  currentIp: string
  clientId: string
  keepAlive: string
  protocolVersion: string
  encryption: string
  accessNode: string
}

export interface Iot2DeviceConnectionTimelineItem {
  id: string
  startAt: string
  endAt: string
  status: 'online' | 'offline'
  duration: string
  reason: string
}

export interface Iot2DeviceConnectionQualityMetric {
  key: string
  label: string
  value: string
  detail: string
  trend: Iot2MetricTrend
  tone: Iot2KpiTone
}

export interface Iot2DeviceProtocolError {
  key: string
  label: string
  count: number
  percent: number
  latestAt: string
}

export interface Iot2DeviceTrafficSummary {
  window: Iot2TrendWindow
  uplinkPackets: number
  downlinkPackets: number
  uplinkBytes: string
  downlinkBytes: string
  trend: Iot2DeviceTrendSeries[]
}

export interface Iot2DeviceFirmwareVersion {
  version: string
  releasedAt: string
  size: string
  changelog: string
  recommended: boolean
  forced: boolean
}

export interface Iot2DeviceFirmwareHistory {
  id: string
  changedAt: string
  fromVersion: string
  toVersion: string
  result: 'success' | 'failed' | 'running'
  duration: string
  operator: string
  failureReason?: string
  log: string
}

export interface Iot2DeviceFirmwareInfo {
  current: {
    version: string
    burnedAt: string
    size: string
    checksum: string
  }
  upgradeStatus: {
    stage: 'idle' | 'waiting' | 'downloading' | 'checking' | 'writing' | 'rebooting' | 'completed' | 'failed'
    percent: number
    message: string
    failureReason?: string
  }
  availableVersions: Iot2DeviceFirmwareVersion[]
  history: Iot2DeviceFirmwareHistory[]
}

export interface Iot2DeviceLogRecord {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  type: 'communication' | 'business' | 'exception' | 'debug'
  summary: string
  detail: string
  rawPayload?: string
  parsedPayload?: string
  contextId?: string
}

export interface Iot2DeviceRelationInfo {
  product: {
    productKey: string
    name: string
    icon: string
  }
  space: {
    id: string
    path: string
  }
  tags: string[]
  gateway?: {
    id: string
    name: string
    status: Iot2DeviceListStatus
  }
  childDevices: Iot2DeviceListItem[]
  applications: Array<{ id: string; name: string; status: string; description: string }>
  alarmRules: Array<{ id: string; name: string; source: string; status: Iot2DeviceTypeRuleStatus; latestTriggeredAt: string }>
  dataFlows: Array<{ id: string; name: string; target: Iot2DeviceTypeFlowTarget; status: Iot2DeviceTypeFlowStatus }>
}

export interface Iot2DeviceSettingsInfo {
  metadata: Array<{ key: string; label: string; value: string; editable: boolean; sensitive?: boolean }>
  customFields: Array<{ key: string; label: string; value: string; type: 'text' | 'number' | 'select' | 'switch' }>
  auth: {
    mode: string
    maskedSecret: string
    certificateNo: string
    lastRotatedAt: string
  }
  access: {
    endpoint: string
    topicPrefix: string
    httpUrl: string
  }
}

export interface Iot2DeviceDetail {
  device: Iot2DeviceListItem
  accessInfo: {
    endpoint: string
    topicPrefix: string
    authMode: string
    protocolVersion: string
    lastIp: string
  }
  runtime: {
    onlineDuration: string
    reportHealth: number
    message24h: number
    commandSuccessRate: number
    alarm24h: number
    uplink24h: number
    downlink24h: number
    onlineRate7d: number
  }
  keyMetrics: Iot2DeviceMetricCard[]
  thingModel: {
    properties: Iot2DeviceRealtimeItem[]
    events: Iot2DeviceEventRecord[]
    services: Iot2DeviceServiceRecord[]
  }
  overview: {
    keyProperties: Iot2DeviceRealtimeItem[]
    trendSeries: Iot2DeviceTrendSeries[]
    timeline: Iot2DeviceTimelineEvent[]
    location: Iot2DeviceLocationSnapshot
    quickActions: Array<{ key: Iot2DeviceDetailTab; label: string; icon: string; description: string }>
  }
  history: Iot2DeviceHistoryData
  alarms: Iot2DeviceAlarmRecord[]
  commands: Iot2DeviceCommandRecord[]
  connection: {
    snapshot: Iot2DeviceConnectionSnapshot
    timeline: Iot2DeviceConnectionTimelineItem[]
    quality: Iot2DeviceConnectionQualityMetric[]
    protocolErrors: Iot2DeviceProtocolError[]
    traffic: Iot2DeviceTrafficSummary
  }
  firmware: Iot2DeviceFirmwareInfo
  simulator: Iot2LinkDebugSession
  logs: Iot2DeviceLogRecord[]
  relations: Iot2DeviceRelationInfo
  settings: Iot2DeviceSettingsInfo
  lifecycleLogs: Iot2DeviceLifecycleLog[]
  recentAlarms: Iot2DeviceQuickSummary['recentAlarms']
  updatedAt: string
}

export interface Iot2DeviceBatchOperationInput {
  projectId: string
  action: Iot2DeviceBatchAction
  selectionMode: Iot2DeviceListSelectionMode
  selectedIds: string[]
  query: Iot2DeviceListQuery
  payload?: Record<string, string>
}

export interface Iot2DeviceBatchOperationResult {
  jobId: string
  action: Iot2DeviceBatchAction
  affectedCount: number
  successCount: number
  failedCount: number
  status: 'queued' | 'running' | 'completed' | 'failed'
  message: string
  items: Array<{ deviceId: string; deviceName: string; status: 'success' | 'failed'; message: string }>
  createdAt: string
  updatedAt: string
}

export interface Iot2DeviceListAdapter {
  listDevices(query: Iot2DeviceListQuery): Promise<ServiceResult<Iot2DeviceListPageResult>>
  getDeviceQuickSummary(projectId: string, deviceId: string): Promise<ServiceResult<Iot2DeviceQuickSummary>>
  getDeviceDetail(projectId: string, deviceId: string): Promise<ServiceResult<Iot2DeviceDetail>>
  getPreferences(projectId: string): Promise<ServiceResult<Iot2DeviceListPreferences>>
  savePreferences(projectId: string, preferences: Iot2DeviceListPreferences): Promise<ServiceResult<Iot2DeviceListPreferences>>
  listSavedFilters(projectId: string): Promise<ServiceResult<Iot2DeviceSavedFilter[]>>
  saveFilter(projectId: string, filter: Omit<Iot2DeviceSavedFilter, 'id' | 'createdAt'> & { id?: string }): Promise<ServiceResult<Iot2DeviceSavedFilter[]>>
  deleteFilter(projectId: string, filterId: string): Promise<ServiceResult<Iot2DeviceSavedFilter[]>>
  runBatchOperation(input: Iot2DeviceBatchOperationInput): Promise<ServiceResult<Iot2DeviceBatchOperationResult>>
  exportDevices(query: Iot2DeviceListQuery): Promise<ServiceResult<{ fileName: string; total: number; generatedAt: string }>>
  importDevices(projectId: string, fileName: string): Promise<ServiceResult<Iot2DeviceBatchOperationResult>>
}

export type Iot2DeviceTypeProtocol = 'MQTT' | 'CoAP' | 'HTTP' | 'Modbus' | 'OPC UA' | 'GB28181' | 'Custom'
export type Iot2DeviceTypeCategory = 'direct' | 'gateway' | 'sub-device' | 'network'
export type Iot2DeviceTypeStatus = 'published' | 'draft' | 'disabled'
export type Iot2DeviceTypeIndustry =
  | 'fire'
  | 'commercial-space'
  | 'smart-park'
  | 'energy'
  | 'logistics'
  | 'general'
export type Iot2DeviceTypeViewMode = 'card' | 'table'
export type Iot2DeviceTypeSortBy = 'updatedAt' | 'deviceCount' | 'onlineRate' | 'unhandledAlarms' | 'name' | 'createdAt'
export type Iot2DeviceTypeSortOrder = 'asc' | 'desc'
export type Iot2DeviceTypeBatchAction = 'publish' | 'disable' | 'delete' | 'exportThingModel' | 'changeIndustry'
export type Iot2DeviceTypeDetailTab =
  | 'overview'
  | 'thing-model'
  | 'access'
  | 'devices'
  | 'alarm-rules'
  | 'data-flow'
  | 'simulator'
  | 'versions'
export type Iot2ThingModelKind = 'properties' | 'events' | 'services'
export type Iot2ThingModelDataType = 'number' | 'string' | 'bool' | 'enum' | 'date' | 'struct' | 'array'
export type Iot2ThingModelAccessMode = 'read' | 'write' | 'readwrite'
export type Iot2ThingModelEventLevel = 'info' | 'alarm' | 'fault'
export type Iot2ThingModelServiceCallMode = 'sync' | 'async'
export type Iot2DeviceTypeRuleStatus = 'enabled' | 'disabled'
export type Iot2DeviceTypeFlowStatus = 'enabled' | 'disabled' | 'failed'
export type Iot2DeviceTypeFlowTarget = 'Kafka' | 'HTTP' | 'Database' | 'Webhook'
export type Iot2DeviceTypeVersionChangeType = 'compatible' | 'breaking' | 'config' | 'release'
export type Iot2ProductTemplateProvider = 'official' | 'custom' | 'third-party'
export type Iot2ProductTemplateStatus = 'published' | 'draft' | 'disabled'
export type Iot2ProductTemplateSortBy = 'recommended' | 'updatedAt' | 'usageCount' | 'name'
export type Iot2ProductTemplateSortOrder = 'asc' | 'desc'
export type Iot2TemplateParameterFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'checkbox-group'
  | 'switch'
  | 'date'
  | 'file'
  | 'note'
export type Iot2TemplateParameterValue = string | number | boolean | string[]
export type Iot2TemplateParameterValues = Record<string, Iot2TemplateParameterValue>

export interface Iot2ThingModelSummary {
  properties: number
  events: number
  services: number
}

export interface Iot2DeviceType {
  id: string
  productKey: string
  name: string
  icon: string
  description: string
  protocol: Iot2DeviceTypeProtocol
  category: Iot2DeviceTypeCategory
  industry: Iot2DeviceTypeIndustry
  status: Iot2DeviceTypeStatus
  authMode: string
  dataFormat: string
  codecMode: string
  modelVersion: string
  tags: string[]
  deviceCount: number
  onlineCount: number
  onlineRate: number
  unhandledAlarms: number
  urgentAlarms: number
  thingModel: Iot2ThingModelSummary
  createdBy: string
  createdAt: string
  updatedAt: string
  editable: boolean
}

export interface Iot2TemplateParameterOption {
  key: string
  label: string
  description?: string
}

export interface Iot2TemplateParameterValidation {
  required?: boolean
  pattern?: string
  min?: number
  max?: number
  message?: string
}

export interface Iot2TemplateParameterField {
  key: string
  label: string
  type: Iot2TemplateParameterFieldType
  groupKey: string
  groupLabel: string
  required?: boolean
  placeholder?: string
  tooltip?: string
  description?: string
  defaultValue?: Iot2TemplateParameterValue
  options?: Iot2TemplateParameterOption[]
  remoteOptionsKey?: string
  dependsOn?: string[]
  validation?: Iot2TemplateParameterValidation
  unit?: string
}

export interface Iot2ProductTemplate {
  id: string
  name: string
  icon: string
  description: string
  industry: Iot2DeviceTypeIndustry
  brand: string
  model: string
  protocol: Iot2DeviceTypeProtocol
  category: Iot2DeviceTypeCategory
  provider: Iot2ProductTemplateProvider
  status: Iot2ProductTemplateStatus
  version: string
  tags: string[]
  usageCount: number
  popularity: number
  maintainer: string
  updatedAt: string
  accessPreset: {
    endpoint: string
    topicPrefix: string
    protocolConfig: Array<{ key: string; label: string; value: string }>
  }
  authPreset: {
    mode: string
    keyRule: string
  }
  dataFormat: string
  codecMode: string
  codecDescription: string
  thingModel: {
    properties: Iot2DeviceTypeThingModelItem[]
    events: Iot2DeviceTypeThingModelItem[]
    services: Iot2DeviceTypeThingModelItem[]
  }
  defaultDataFlows: Array<{ name: string; target: Iot2DeviceTypeFlowTarget; filter: string }>
  defaultAlarmRules: Array<{ name: string; severity: Iot2AlarmSeverity; condition: string }>
  document: string
  parameterSchema: Iot2TemplateParameterField[]
}

export interface Iot2ProductTemplateQuery {
  projectId: string
  keyword: string
  industry: 'all' | Iot2DeviceTypeIndustry
  brand: string
  protocol: 'all' | Iot2DeviceTypeProtocol
  category: 'all' | Iot2DeviceTypeCategory
  provider: 'all' | Iot2ProductTemplateProvider
  status: 'all' | Iot2ProductTemplateStatus
  page: number
  pageSize: number
  sortBy: Iot2ProductTemplateSortBy
  sortOrder: Iot2ProductTemplateSortOrder
}

export interface Iot2ProductTemplateFilterOptions {
  industries: Array<Iot2Option & { count: number }>
  brands: Array<Iot2Option & { count: number }>
  protocols: Array<Iot2Option & { count: number }>
  categories: Array<Iot2Option & { count: number }>
  providers: Array<Iot2Option & { count: number }>
  statuses: Array<Iot2Option & { count: number; tone: Iot2KpiTone }>
}

export interface Iot2ProductTemplatePageResult {
  projectId: string
  updatedAt: string
  query: Iot2ProductTemplateQuery
  items: Iot2ProductTemplate[]
  total: number
  page: number
  pageSize: number
  filterOptions: Iot2ProductTemplateFilterOptions
}

export interface Iot2DeviceTypeQuery {
  projectId: string
  keyword: string
  protocol: 'all' | Iot2DeviceTypeProtocol
  category: 'all' | Iot2DeviceTypeCategory
  status: 'all' | Iot2DeviceTypeStatus
  industry: 'all' | Iot2DeviceTypeIndustry
  createdFrom: string
  createdTo: string
  page: number
  pageSize: number
  sortBy: Iot2DeviceTypeSortBy
  sortOrder: Iot2DeviceTypeSortOrder
  viewMode: Iot2DeviceTypeViewMode
}

export interface Iot2DeviceTypeFilterOptions {
  protocols: Array<Iot2Option & { count: number }>
  categories: Array<Iot2Option & { count: number }>
  statuses: Array<Iot2Option & { count: number; tone: Iot2KpiTone }>
  industries: Array<Iot2Option & { count: number }>
}

export interface Iot2DeviceTypeSummary {
  total: number
  published: number
  draft: number
  disabled: number
  emptyTypes: number
  alarms: number
}

export interface Iot2DeviceTypePageResult {
  projectId: string
  updatedAt: string
  query: Iot2DeviceTypeQuery
  items: Iot2DeviceType[]
  total: number
  page: number
  pageSize: number
  summary: Iot2DeviceTypeSummary
  filterOptions: Iot2DeviceTypeFilterOptions
}

export interface Iot2DeviceTypeSelectedCondition {
  key: string
  label: string
  value: string
}

export interface Iot2DeviceTypeScalePoint {
  label: string
  total: number
  online: number
}

export interface Iot2DeviceTypeAlarmRecord {
  id: string
  severity: Iot2AlarmSeverity
  deviceId: string
  deviceName: string
  alarmType: string
  happenedAt: string
}

export interface Iot2DeviceTypeThingModelItem {
  id: string
  name: string
  identifier: string
  dataType: string
  kind?: Iot2ThingModelKind
  unit?: string
  accessMode?: string
  valueRange?: string
  reported?: boolean
  groupName?: string
  description?: string
  alarmRuleCount?: number
  level?: string
  callMode?: string
  inputCount?: number
  outputCount?: number
  params?: Array<{ name: string; identifier: string; dataType: string; required?: boolean }>
}

export interface Iot2DeviceTypeAccessConfig {
  endpoint: string
  topicPrefix: string
  authMode: string
  dataFormat: string
  codecMode: string
  protocolConfig?: Array<{ key: string; label: string; value: string }>
  codecScript?: string
  accessDoc?: Array<{ title: string; content: string }>
  heartbeatTimeoutMinutes?: number
}

export interface Iot2DeviceTypeThingModelDetail {
  version: string
  pendingChanges: number
  groups: Array<{ key: string; label: string; count: number }>
  properties: Iot2DeviceTypeThingModelItem[]
  events: Iot2DeviceTypeThingModelItem[]
  services: Iot2DeviceTypeThingModelItem[]
}

export interface Iot2DeviceTypeAlarmRule {
  id: string
  name: string
  condition: string
  severity: Iot2AlarmSeverity
  status: Iot2DeviceTypeRuleStatus
  affectedDevices: number
  triggerCount24h: number
  latestTriggeredAt: string
  scope: string
}

export interface Iot2DeviceTypeDataFlowRule {
  id: string
  name: string
  target: Iot2DeviceTypeFlowTarget
  filter: string
  status: Iot2DeviceTypeFlowStatus
  delivered24h: number
  failed24h: number
  latestTriggeredAt: string
}

export type Iot2LinkDebugScope = 'device-type' | 'device'
export type Iot2LinkDebugDirection = 'uplink' | 'downlink'
export type Iot2LinkDebugStatus = 'success' | 'running' | 'failed' | 'waiting'
export type Iot2LinkDebugActionMode =
  | 'property-report'
  | 'event-report'
  | 'read-property'
  | 'write-property'
  | 'service-call'
export type Iot2LinkDebugLogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug'

export interface Iot2DeviceTypeSimulatorLog {
  id: string
  time: string
  level: Iot2LinkDebugLogLevel
  message: string
  traceId?: string
  direction?: Iot2LinkDebugDirection
  node?: string
}

export interface Iot2LinkDebugConnectionSummary {
  online: boolean
  connectionCount: number
  connectionAddress: string
  accessMode: string
  protocol: string
  connectedAt: string
  lastCommunicatedAt: string
  pendingMessages: number
}

export interface Iot2LinkDebugActionPreset {
  mode: Iot2LinkDebugActionMode
  label: string
  description: string
  payload: string
  targetOptions: Iot2Option[]
  defaultTarget: string
}

export interface Iot2LinkDebugStep {
  id: string
  title: string
  content: string
  status: Iot2LinkDebugStatus
  node: string
  happenedAt: string
}

export interface Iot2LinkTrace {
  id: string
  traceId: string
  title: string
  direction: Iot2LinkDebugDirection
  status: Iot2LinkDebugStatus
  summary: string
  source: string
  target: string
  protocol: string
  stepCount: number
  logCount: number
  startedAt: string
  duration: string
  requestPayload: string
  responsePayload: string
  steps: Iot2LinkDebugStep[]
}

export interface Iot2LinkDebugSession {
  scope: Iot2LinkDebugScope
  subjectId: string
  subjectName: string
  connection: Iot2LinkDebugConnectionSummary
  presets: Iot2LinkDebugActionPreset[]
  traces: Iot2LinkTrace[]
  logs: Iot2DeviceTypeSimulatorLog[]
  selectedTraceId: string
}

export interface Iot2DeviceTypeSimulator extends Iot2LinkDebugSession {
  virtualDeviceId: string
  online: boolean
  samplePayload: string
  serviceCommand: string
}

export interface Iot2DeviceTypeSimulationInput {
  mode: Iot2LinkDebugActionMode
  payload: string
  target?: string
  direction?: Iot2LinkDebugDirection
}

export interface Iot2DeviceTypeSimulationResult {
  accepted: boolean
  decodedPayload: string
  generatedAlarms: number
  logs: Iot2DeviceTypeSimulatorLog[]
}

export interface Iot2DeviceTypeVersionRecord {
  id: string
  version: string
  changeType: Iot2DeviceTypeVersionChangeType
  summary: string
  operator: string
  publishedAt: string
  affectedDevices: number
  rollbackable: boolean
}

export interface Iot2DeviceTypeChangeRecord {
  id: string
  field: string
  before: string
  after: string
  operator: string
  changedAt: string
}

export interface Iot2DeviceTypeDetail {
  product: Iot2DeviceType
  statusDistribution: Iot2StatusDistributionItem[]
  scaleTrend: Iot2DeviceTypeScalePoint[]
  recentDevices: Iot2DeviceListItem[]
  associatedDevices: Iot2DeviceListItem[]
  recentAlarms: Iot2DeviceTypeAlarmRecord[]
  accessConfig: Iot2DeviceTypeAccessConfig
  thingModel: Iot2DeviceTypeThingModelDetail
  thingModelPreview: {
    properties: Iot2DeviceTypeThingModelItem[]
    events: Iot2DeviceTypeThingModelItem[]
    services: Iot2DeviceTypeThingModelItem[]
  }
  alarmRules: Iot2DeviceTypeAlarmRule[]
  dataFlows: Iot2DeviceTypeDataFlowRule[]
  simulator: Iot2DeviceTypeSimulator
  versionHistory: Iot2DeviceTypeVersionRecord[]
  changeLogs: Iot2DeviceTypeChangeRecord[]
}

export interface Iot2DeviceTypeDraft {
  id?: string
  name: string
  productKey: string
  icon?: string
  description: string
  protocol: Iot2DeviceTypeProtocol
  category: Iot2DeviceTypeCategory
  industry: Iot2DeviceTypeIndustry
  status: Iot2DeviceTypeStatus
  tags: string[]
  authMode?: string
  dataFormat?: string
  codecMode?: string
  endpoint?: string
  topicPrefix?: string
  heartbeatTimeoutMinutes?: number
  creationMode?: 'template' | 'manual'
  templateId?: string
  templateVersion?: string
  templateParameters?: Iot2TemplateParameterValues
  thingModel?: {
    properties: Iot2DeviceTypeThingModelItem[]
    events: Iot2DeviceTypeThingModelItem[]
    services: Iot2DeviceTypeThingModelItem[]
  }
  advancedConfig?: {
    alarmTemplate: string
    retentionDays: number
    heartbeatTimeoutMinutes: number
    childDeviceMode: string
  }
}

export interface Iot2DeviceTypeBatchInput {
  projectId: string
  action: Iot2DeviceTypeBatchAction
  selectedIds: string[]
  query: Iot2DeviceTypeQuery
  payload?: Record<string, string>
}

export interface Iot2DeviceTypeBatchResult {
  jobId: string
  action: Iot2DeviceTypeBatchAction
  affectedCount: number
  successCount: number
  failedCount: number
  status: 'completed' | 'failed'
  message: string
  items: Array<{ productKey: string; name: string; status: 'success' | 'failed'; message: string }>
  createdAt: string
  updatedAt: string
}

export interface Iot2DeviceTypeAdapter {
  listDeviceTypes(query: Iot2DeviceTypeQuery): Promise<ServiceResult<Iot2DeviceTypePageResult>>
  getDeviceType(projectId: string, productId: string): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  saveDeviceType(projectId: string, draft: Iot2DeviceTypeDraft): Promise<ServiceResult<Iot2DeviceType>>
  duplicateDeviceType(projectId: string, productId: string): Promise<ServiceResult<Iot2DeviceType>>
  saveThingModelItem(projectId: string, productId: string, kind: Iot2ThingModelKind, item: Iot2DeviceTypeThingModelItem): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  deleteThingModelItem(projectId: string, productId: string, kind: Iot2ThingModelKind, itemId: string): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  publishThingModelVersion(projectId: string, productId: string, summary: string, changeType: Iot2DeviceTypeVersionChangeType): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  saveAccessConfig(projectId: string, productId: string, config: Iot2DeviceTypeAccessConfig): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  saveAlarmRule(projectId: string, productId: string, rule: Iot2DeviceTypeAlarmRule): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  saveDataFlowRule(projectId: string, productId: string, rule: Iot2DeviceTypeDataFlowRule): Promise<ServiceResult<Iot2DeviceTypeDetail>>
  runDeviceSimulation(projectId: string, productId: string, input: Iot2DeviceTypeSimulationInput): Promise<ServiceResult<Iot2DeviceTypeSimulationResult>>
  runBatchOperation(input: Iot2DeviceTypeBatchInput): Promise<ServiceResult<Iot2DeviceTypeBatchResult>>
  exportDeviceTypes(query: Iot2DeviceTypeQuery): Promise<ServiceResult<{ fileName: string; total: number; generatedAt: string }>>
  importThingModel(projectId: string, fileName: string): Promise<ServiceResult<Iot2DeviceTypeBatchResult>>
}

export interface Iot2ProductTemplateAdapter {
  listProductTemplates(query: Iot2ProductTemplateQuery): Promise<ServiceResult<Iot2ProductTemplatePageResult>>
  getProductTemplate(projectId: string, templateId: string): Promise<ServiceResult<Iot2ProductTemplate>>
  listParameterOptions(
    projectId: string,
    templateId: string,
    fieldKey: string,
    values: Iot2TemplateParameterValues
  ): Promise<ServiceResult<Iot2TemplateParameterOption[]>>
}

