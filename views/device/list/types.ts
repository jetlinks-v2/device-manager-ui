import type { ServiceResult } from './services/shared/serviceResult'
import type { PlatformEvent } from './services/platform-events'

export type IotDeviceConnectionStatus = 'online' | 'offline' | 'disabled'
export type IotDeviceBusinessStatus = 'no-data' | 'alarm' | 'maintenance'
export type IotDeviceStatus = IotDeviceConnectionStatus | 'no-data' | 'alarm'
export type IotDeviceRisk = 'normal' | 'watch' | 'urgent'
export type IotTelemetryStatus = 'normal' | 'warning' | 'critical' | 'stale'
export type IotDeviceLogLevel = 'info' | 'warning' | 'error'
export type IotInsightKind = 'offline' | 'no-data' | 'alarm' | 'threshold' | 'grouping'
export type IotEventLevel = '提醒' | '重要' | '紧急'

export interface IotTelemetryPoint {
  key: string
  name: string
  value: string
  unit?: string
  status: IotTelemetryStatus
  updatedAt: string
  hint: string
}

export interface IotEventPayload {
  /** 旧 IotInsightKind */
  kind: IotInsightKind
  level: IotEventLevel
  summary: string
  faultCode?: string
}

export type IotEvent = PlatformEvent<IotEventPayload>
export type IotDeviceAlarm = IotEvent

export interface IotDeviceLog {
  id: string
  level: IotDeviceLogLevel
  title: string
  message: string
  happenedAt: string
}

export interface IotDeviceRule {
  id: string
  name: string
  trigger: string
  action: string
  status: '启用' | '建议调整' | '停用'
}

export interface IotDeviceRelation {
  label: string
  value: string
  hint: string
}

export interface IotDeviceAiSummary {
  conclusion: string
  reasons: string[]
  actions: string[]
  evidence: string[]
}

export interface IotDevice {
  id: string
  projectId: string
  name: string
  productName: string
  /** 产品厂商，来自产品 manufacturer。 */
  productManufacturer?: string
  /** 产品型号，来自产品 model。 */
  productModel?: string
  /** 产品分类，来自产品 classifiedName。 */
  productCategory?: string
  /** 设备库 product templateId，用于查询 faultCodeDict / normalRanges / knowledgeBase */
  productKey?: string
  /** 真实产品 ID，与旧版 device-manager-ui 的 productId 对齐。 */
  productId?: string
  deviceType: string
  /** 真实设备类型枚举值，例如 gateway / childrenDevice。 */
  deviceTypeValue?: string
  area: string
  areaId?: string
  areaBindings?: Array<{ areaId: string; area: string }>
  groupId?: string
  groupName?: string
  groupBindings?: Array<{ id: string; name: string }>
  location: string
  /** 项目内业务设备类型/场景，存于 extensions.iot.scenario，不影响真实产品模板。 */
  scenario?: string
  owner: string
  /** 连接状态真值：设备总览默认只展示这三个状态 */
  connectionStatus?: IotDeviceConnectionStatus
  /** 扩展业务状态：无数据 / 告警中 / 维护中，可用于后续查询 */
  businessStatuses?: IotDeviceBusinessStatus[]
  status: IotDeviceStatus
  risk: IotDeviceRisk
  lastSeen: string
  lastSeenTimestamp?: number
  onlineAt?: number
  offlineAt?: number
  accessMode: string
  /** 接入方式展示名称，优先用于设备详情头部展示。 */
  accessName?: string
  /** 真实接入方式枚举值，与旧版 accessProvider 对齐。 */
  accessProvider?: string
  /** 真实设备实例协议 ID，透明编解码调试查询协议路由时使用。 */
  protocol?: string
  /** 真实设备实例传输协议，透明编解码调试区分 Topic / URL 时使用。 */
  transport?: string
  /** 设备实例能力特性，按旧版详情用于显示数据解析等功能页签。 */
  features?: Array<{ id?: string; name?: string; [key: string]: any }>
  gatewayName?: string
  identifier: string
  imageUrl?: string
  summary: string
  aiSummary: IotDeviceAiSummary
  telemetry: IotTelemetryPoint[]
  alarms: IotDeviceAlarm[]
  logs: IotDeviceLog[]
  rules: IotDeviceRule[]
  relations: IotDeviceRelation[]
  tags: string[]
  /** 真实设备详情中的物模型定义，供新详情按旧版能力查询属性、事件、标签和功能。 */
  thingModelMetadata?: {
    properties: any[]
    functions: any[]
    events: any[]
    tags: any[]
  }
  /** 真实设备标签值，保留 dataType/formatValue 等旧版字段。 */
  thingModelTags?: any[]
  /** 当前活跃故障码（来自设备协议字段映射；若设备库 product 已定义 faultCodeDict，UI 在设备详情诊断段展开） */
  currentFaultCodes?: IotDeviceFaultEvent[]
}

/** 设备实时上报的故障码 event（IoT 内部对象） */
export type IotDeviceFaultEvent = IotEvent

export interface IotDeviceInsight {
  id: string
  kind: IotInsightKind
  title: string
  summary: string
  reason: string
  action: string
  deviceIds: string[]
  priority: IotDeviceRisk
}

/* IotDeviceTodo —— 设备总览"今日待办"（替代旧 AI 关心摘要 / insight 列表）。
   详见 docs/requirements/module-iot.md §设备总览 §今日待办、decisions.md P32。 */

export type IotTodoSource = 'ai-derived' | 'rule' | 'manual'
export type IotTodoStatus = 'pending' | 'assigned' | 'pending-review' | 'completed' | 'snoozed'

export interface IotTodoRecord {
  id: string
  actor: string
  actedAt: string
  action: string
}

/* 待办主操作类型（决定主按钮文案 + 路由目标，决议见 walkthrough · 今日待办反馈）
   抽象的"接受/拒绝"被替换为按设备问题类型分类的具体业务动作。 */
export type IotTodoActionKind =
  | 'diagnose'        // 数据异常 / 离线 → 去设备详情诊断区
  | 'verify-alarm'    // 设备告警 → 去告警中心做现场确认
  | 'adjust-rule'     // 阈值不匹配业务时段 → 去告警中心 rule-assistant
  | 'view-grouping'   // 分组建议 → 去设备分组页
  | 'create-ticket'   // 设备掉线无法远程恢复 → 派工维修（v1 是升级 teaser）

export interface IotDeviceTodo {
  id: string
  source: IotTodoSource
  /** 一句话动作描述 */
  title: string
  /** 上下文展开（业务可读，含位置 / 数量信息） */
  detail: string
  /** 责任人（来自设备 owner 字段） */
  ownerKey: string
  ownerLabel: string
  status: IotTodoStatus
  priority: IotDeviceRisk
  /** 触发 / 发现时间，业务可读 */
  occurredAt?: string
  /** 截止时间 / 班次提示，业务可读 */
  dueAt?: string
  /** 关联设备 id（点击后可在主区聚焦） */
  deviceIds: string[]
  /** AI 派生时的依据来源；source !== 'ai-derived' 时不展示 */
  evidence?: string[]
  /** 来源提示（"派生候选" / "规则触发" / 手工添加为空） */
  sourceLabel?: string
  /** 主操作类型；UI 据此渲染按钮文案 + 决定跳转目标 */
  actionKind?: IotTodoActionKind
  /** 主按钮显示文案（"诊断设备" / "现场确认" / "调整规则" 等） */
  actionLabel?: string
  /** 处理记录，用于已处理/暂缓后的详情回看 */
  records?: IotTodoRecord[]
}

export interface IotDeviceFilters {
  projectId: string
  keyword?: string
  connectionStatus?: IotDeviceConnectionStatus | 'all'
  businessStatus?: IotDeviceBusinessStatus | 'all'
  status?: IotDeviceStatus | 'all'
  risk?: IotDeviceRisk | 'all'
  anomalyKind?: IotRiskKind | 'all'
  area?: string | 'all'
  productName?: string | 'all'
  owner?: string | 'all'
  deviceIds?: string[]
}

export interface IotDeviceWorkbench {
  devices: IotDevice[]
  /** AI 派生的"过滤候选"。原 IotAiPanel 队列、IotAiSearchModal 都已下线
      （v 当前版本：自然语言搜索合并到设备总览搜索框 mode toggle）。
      该字段保留作派生中间产物，供 deriveTodos 转成今日待办使用。 */
  insights: IotDeviceInsight[]
  /** 今日待办（替代旧 AI 关心摘要，主区可执行任务） */
  todos: IotDeviceTodo[]
  summary: {
    total: number
    online: number
    offline: number
    noData: number
    alarm: number
    urgent: number
    /** 维护中：来自 lifecycleStage = 维护中（决议见 module-iot.md §设备总览） */
    maintenance: number
  }
  facets: {
    areas: string[]
    productNames: string[]
    owners: string[]
  }
}

export type IotDeviceGroupBasis =
  | 'area'
  | 'type'
  | 'scene'
  | 'custom'
  | 'owner'
  | 'status'
  | 'category'
  | 'scenario'

export type IotGroupRiskLevel = 'low' | 'medium' | 'high'

export interface IotDeviceGroup {
  id: string
  projectId: string
  name: string
  basis: IotDeviceGroupBasis
  description: string
  condition: string
  owner: string
  deviceIds: string[]
  tags: string[]
  objective?: string
  alarmContacts?: string[]
  healthScore?: number
  riskLevel?: IotGroupRiskLevel
  automationRules?: string[]
  summary: {
    total: number
    urgent: number
    watch: number
    normal: number
    offline: number
    noData: number
    alarm: number
  }
  actions: string[]
}

export interface IotDeviceGroupsView {
  groups: IotDeviceGroup[]
  devices: IotDevice[]
  summary: {
    totalGroups: number
    coveredDevices: number
    urgentGroups: number
    suggestedGroups: number
  }
}

export type IotCustomGroupPurpose = 'handover' | 'follow-up' | 'health-watch' | 'notify'
export type IotCustomGroupVisibility = 'private' | 'project'
export type IotCustomGroupLastSeenWindow = '2h' | '24h' | '7d'

export interface IotCustomGroupQuery {
  areaIds?: string[]
  deviceTypes?: string[]
  productNames?: string[]
  owners?: string[]
  statuses?: IotDeviceStatus[]
  risks?: IotDeviceRisk[]
  tags?: string[]
  keyword?: string
  lastSeenWindow?: IotCustomGroupLastSeenWindow
}

export interface IotCustomDeviceGroup {
  id: string
  projectId: string
  name: string
  objective: string
  description: string
  condition: string
  purpose: IotCustomGroupPurpose
  owner: string
  alarmContacts: string[]
  query: IotCustomGroupQuery
  actions: string[]
  automationRules: string[]
  visibility: IotCustomGroupVisibility
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface IotCustomGroupDraftInput {
  projectId: string
  name: string
  objective: string
  description: string
  condition: string
  purpose: IotCustomGroupPurpose
  owner: string
  alarmContacts: string[]
  query: IotCustomGroupQuery
  actions: string[]
  automationRules: string[]
  visibility: IotCustomGroupVisibility
}

export interface IotCustomGroupPreview {
  matchedDeviceIds: string[]
  summary: IotDeviceGroup['summary']
}

export interface IotCustomGroupAdapter {
  list(projectId: string): Promise<ServiceResult<IotCustomDeviceGroup[]>>
  create(input: IotCustomGroupDraftInput): Promise<ServiceResult<IotCustomDeviceGroup>>
  delete(projectId: string, groupId: string): Promise<ServiceResult<{ id: string }>>
}

/* 分组详情用聚合（决议见 walkthrough · 分组重构）
   组级聚合指标：在线率 / 风险分布 / 关键 metric 平均（仅同 productKey 时）
   组级规则统计：从组内设备 rules 聚合 */

export interface IotGroupKeyMetricAverage {
  pointKey: string
  name: string
  unit?: string
  /** 平均值（数值型 telemetry 才有，按可解析 number 启发式） */
  average: number
  sampleCount: number
}

export interface IotGroupAggregates {
  /** 在线率 0-1 */
  onlineRate: number
  riskDistribution: { urgent: number; watch: number; normal: number }
  /** 关键 metric 平均（仅当组内 device productKey 都一致时填） */
  keyMetricAverages?: IotGroupKeyMetricAverage[]
  /** 组内 productKey 一致时填，方便 UI 标"同型号设备"语义 */
  sharedProductKey?: string
}

export interface IotGroupRuleStats {
  total: number
  active: number
  needsAdjust: number
  paused: number
}

export interface IotGroupDetail {
  group: IotDeviceGroup
  devices: IotDevice[]
  aggregates: IotGroupAggregates
  ruleStats: IotGroupRuleStats
}

export type IotLifecycleStage = 'pending-access' | 'connected' | 'running' | 'watch' | 'maintenance' | 'retired'
export type IotHealthStatus = 'healthy' | 'watch' | 'urgent' | 'maintenance'

/* v3 设备诊断 view-model。
   风险设备发现已收口到设备总览筛选，单设备诊断收口到设备详情中的诊断段。
   决议见 module-iot.md §设备详情中的诊断视图、decisions.md P31。 */

/** 风险类型（左栏 segmented + 行图标）。多种可共存。 */
export type IotRiskKind = 'data-deviation' | 'offline-frequent' | 'fault-code'

export interface IotHealthRiskRow {
  deviceId: string
  deviceName: string
  productName: string
  productKey?: string
  area: string
  location: string
  owner: string
  status: IotDeviceStatus
  risk: IotDeviceRisk
  healthStatus: IotHealthStatus
  lifecycleStage: IotLifecycleStage
  /** 当前风险类型集合，决定行的小图标 */
  riskKinds: IotRiskKind[]
  /** 一句业务可读的风险摘要 */
  riskSummary: string
  /** 最近异常时间（mono 文本，如 "2 小时 18 分钟前"） */
  lastAnomalyAt: string
}

export interface IotHealthListView {
  rows: IotHealthRiskRow[]
  /** 每个 segmented 选项的设备数量 */
  counts: {
    all: number
    deviation: number
    offlineFrequent: number
    fault: number
  }
}

/* 右栏：单设备诊断包（4 段 + identity） */

export interface IotHealthFeaturePoint {
  pointKey: string
  name: string
  unit?: string
  currentValue: string
  status: IotTelemetryStatus
  /** 来自设备库 product telemetryNormalRanges */
  normalRange?: { min?: number; max?: number; hint?: string }
  /** 同型号典型均值（横向对比） */
  typicalAvg?: number
  /** 24h / 7d 趋势采样点（0-1 归一化），UI 自行画线 */
  trend?: number[]
  /** 是否当前偏离 normalRange */
  isDeviating: boolean
}

export interface IotHealthFeatureSection {
  trendWindowLabel: string
  points: IotHealthFeaturePoint[]
}

export interface IotHealthTimelinePeer {
  deviceId: string
  deviceName: string
  status: IotDeviceStatus
  lastSeen: string
}

export interface IotHealthTimelineEvent {
  happenedAt: string
  description: string
}

export interface IotHealthTimelineSection {
  /** AI 派生：异常起点 */
  anomalyStartedAt?: string
  /** "持续 2 小时 18 分钟" */
  anomalyDuration?: string
  /** 一句结论 */
  observation: string
  /** 同类对照：同区域 / 同型号正常设备 */
  peers: IotHealthTimelinePeer[]
  /** 异常前后 30 分钟环境变化 */
  relatedEvents: IotHealthTimelineEvent[]
}

export interface IotHealthFaultRow {
  code: string
  name: string
  severity: 'info' | 'warning' | 'critical'
  cause: string
  recommendedAction: string
  /** 该设备过去 N 个月本故障出现次数（来自 IoT 内 fault event 历史） */
  occurrencesOnDevice: number
  /** 历史窗口（月） */
  monthsWindow: number
  /** 同型号其他设备出过该故障的设备数 */
  occurrencesOnPeers: number
  /** 关联设备库 knowledgeBase 条目（id + 标题，UI 跳转看完整说明书） */
  knowledgeRefs: Array<{ id: string; title: string }>
}

export interface IotHealthFaultSection {
  rows: IotHealthFaultRow[]
}

export interface IotHealthAdviceSection {
  /** 一句结论 */
  conclusion: string
  /** 综合建议要点 */
  bullets: string[]
  /** 依据来源（"基于过去 24h 数据"、"参考厂商说明书 §3.2"） */
  evidence: string[]
}

export interface IotDeviceHealthDiagnosis {
  deviceId: string
  deviceName: string
  identifier: string
  productName: string
  productKey?: string
  area: string
  location: string
  owner: string
  status: IotDeviceStatus
  risk: IotDeviceRisk
  healthStatus: IotHealthStatus
  lifecycleStage: IotLifecycleStage
  features: IotHealthFeatureSection
  timeline: IotHealthTimelineSection
  /** 仅在设备当前上报有故障码时填；否则 undefined → UI 整段 v-if 隐藏 */
  faults?: IotHealthFaultSection
  advice: IotHealthAdviceSection
}

export interface IotNaturalLanguageFilterResult {
  text: string
  criteria: Partial<IotDeviceFilters>
  explanation: string
  matchedDeviceIds: string[]
  suggestions: string[]
}

export interface IotDeviceDiagnosis {
  deviceId: string
  title: string
  conclusion: string
  possibleCauses: string[]
  nextActions: string[]
  evidence: string[]
}

export interface IotDeviceResetResult {
  projectId: string
  resetAt: string
  deviceCount: number
  deviceIds: string[]
}

/* 加入设备 β 流程的输入（决议见 module-iot.md §加入设备） */
export interface CreateIotDeviceInput {
  projectId: string
  /** 设备库 product templateId */
  productKey: string
  name: string
  areaId: string
  area: string
  location: string
  scenario: string
  owner: string
  imageUrl?: string
  tags?: string[]
}

export type IotDeviceCommandCategory = 'control' | 'query' | 'maintenance' | 'security'
export type IotDeviceCommandRiskLevel = 'normal' | 'caution' | 'critical'
export type IotDeviceCommandCallMode = 'sync' | 'async'
export type IotDeviceCommandParamType = 'string' | 'number' | 'boolean' | 'enum' | 'datetime' | 'object' | 'array'
export type IotDeviceCommandExecutionStatus = 'success' | 'waiting' | 'failed'

export interface IotDeviceCommandParamOption {
  label: string
  value: any
}

export interface IotDeviceCommandParam {
  key: string
  name: string
  type: IotDeviceCommandParamType
  required: boolean
  description?: string
  unit?: string
  defaultValue?: any
  placeholder?: string
  options?: IotDeviceCommandParamOption[]
}

export interface IotDeviceCommandDefinition {
  id: string
  name: string
  identifier: string
  description: string
  category: IotDeviceCommandCategory
  riskLevel: IotDeviceCommandRiskLevel
  callMode: IotDeviceCommandCallMode
  inputParams: IotDeviceCommandParam[]
  outputParams: IotDeviceCommandParam[]
  outputDescription: string
  enabled: boolean
  disabledReason?: string
}

export interface ExecuteIotDeviceCommandInput {
  projectId: string
  deviceId: string
  commandId: string
  params: Record<string, any>
}

export interface IotDeviceCommandExecutionStep {
  id: string
  title: string
  node: string
  status: IotDeviceCommandExecutionStatus
  happenedAt: string
  content: string
}

export interface IotDeviceCommandExecution {
  id: string
  commandId: string
  commandName: string
  identifier: string
  status: IotDeviceCommandExecutionStatus
  requestId: string
  executedAt: string
  duration: string
  summary: string
  requestPayload: string
  responsePayload: string
  steps: IotDeviceCommandExecutionStep[]
}

export interface IotDeviceAdapter {
  getWorkbench(filters: IotDeviceFilters): Promise<ServiceResult<IotDeviceWorkbench>>
  /** basis 默认 'area'（决议见 module-iot.md §设备分组 §维度切换） */
  getGroups(projectId: string, basis?: IotDeviceGroupBasis): Promise<ServiceResult<IotDeviceGroupsView>>
  /* 分组详情（组级聚合指标 + 规则统计 + 组内设备 list） */
  getGroupDetail(projectId: string, groupId: string): Promise<ServiceResult<IotGroupDetail>>
  /** 批量通知组内负责人（mock 实现，对组内 distinct owners 各发一条 mock 通知） */
  notifyGroupOwners(projectId: string, groupId: string): Promise<ServiceResult<{ owners: string[]; sentAt: string }>>
  /** 批量通知设备负责人（用于区域父节点等非持久化分组） */
  notifyDeviceOwners(projectId: string, deviceIds: string[]): Promise<ServiceResult<{ owners: string[]; sentAt: string }>>
  /* 设备诊断数据：兼容旧健康视图结构，同时供设备详情诊断段消费 */
  getHealthList(projectId: string): Promise<ServiceResult<IotHealthListView>>
  getDeviceHealthDiagnosis(projectId: string, deviceId: string): Promise<ServiceResult<IotDeviceHealthDiagnosis>>
  /** 处置建议段：复制建议。保留 mock 文本返回，供兼容视图复用 */
  copyHealthAdvice(projectId: string, deviceId: string): Promise<ServiceResult<{ text: string }>>
  notifyOwner(projectId: string, deviceId: string): Promise<ServiceResult<{ owner: string; sentAt: string }>>
  /** 加入设备：创建项目内 IotDevice instance，绑定到 productKey */
  createDevice(input: CreateIotDeviceInput): Promise<ServiceResult<IotDevice>>
  getDevice(projectId: string, deviceId: string): Promise<ServiceResult<IotDevice>>
  listDeviceCommands(projectId: string, deviceId: string): Promise<ServiceResult<IotDeviceCommandDefinition[]>>
  executeDeviceCommand(input: ExecuteIotDeviceCommandInput): Promise<ServiceResult<IotDeviceCommandExecution>>
  setDeviceEnabled(projectId: string, deviceId: string, enabled: boolean): Promise<ServiceResult<IotDevice>>
  deleteDevice(projectId: string, deviceId: string): Promise<ServiceResult<{ id: string }>>
  runNaturalLanguageFilter(projectId: string, text: string): Promise<ServiceResult<IotNaturalLanguageFilterResult>>
  diagnoseDevice(projectId: string, deviceId: string): Promise<ServiceResult<IotDeviceDiagnosis>>
  /* 今日待办写入动作（mock adapter 内部维护状态，service 层传给页面 view-model） */
  acceptTodo(projectId: string, todoId: string): Promise<ServiceResult<IotDeviceTodo>>
  completeTodo(projectId: string, todoId: string, action?: string): Promise<ServiceResult<IotDeviceTodo>>
  snoozeTodo(projectId: string, todoId: string, action?: string): Promise<ServiceResult<IotDeviceTodo>>
  dismissTodo(projectId: string, todoId: string): Promise<ServiceResult<{ id: string }>>
  resetProjectData(projectId: string): Promise<ServiceResult<IotDeviceResetResult>>
}

/* ============================================================
   IoT 时序场景包（阶段 1 mock）
   ============================================================ */

/**
 * IotScenePackOutputField · 时序场景包对外字段定义
 *
 * 跟视觉场景包的 ScenePackOutputField 形态一致（key / label / type / enumValues / unit / min / max）；
 * 留作"未来合并到统一 ScenePackOutputField"的过渡（阶段 2 数据模型反转时统一）。
 */
export interface IotScenePackOutputField {
  key: string
  label: string
  type: 'enum' | 'number' | 'string' | 'array' | 'boolean'
  enumValues?: string[]
  unit?: string
  min?: number
  max?: number
  description?: string
}

/**
 * IotScenePackTemplate · 时序场景包模板（阶段 1 mock）
 *
 * 阶段 1 仅提供 1 条 mock seed（振动故障诊断）。阶段 2 数据模型反转时
 * 与视觉场景包一起合并到顶层 scenePackCatalogService。
 */
export interface IotScenePackTemplate {
  /** 全局唯一 id（slug） */
  id: string
  name: string
  slug: string
  version: string
  description: string
  /** 推荐适配的设备 productKey 集合（参考用，picker 不强制过滤） */
  recommendedProductKeys?: string[]
  /** 推荐 schedule 文本提示（"全天"等） */
  recommendedScheduleHint?: string
  /** 推荐 scope 文本提示（"水泵 / 离心风机分组 · 至少 1 台"等） */
  recommendedScopeHint?: string
  /** 输出字段（rule-assistant 卡 1 场景包卡片展示用） */
  outputSchema: IotScenePackOutputField[]
  /** mock 标记 · 阶段 1 演示阶段返回 mock 命中 */
  mock: true
}

export interface IotScenePackListAvailableQuery {
  /** v1 仅 timeseries domain；保留扩展位 */
  domain: 'timeseries'
  /** 关键词模糊匹配 name / description */
  keyword?: string
}

export interface IotScenePackAdapter {
  listAvailable(query: IotScenePackListAvailableQuery): Promise<ServiceResult<IotScenePackTemplate[]>>
}
