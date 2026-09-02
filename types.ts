import type { ServiceResult } from '@jetlinks-web-core/utils/service-result'
import type { PlatformEvent } from '@device-manager-ui/services/platform-events'

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
  productManufacturer?: string
  productModel?: string
  /** 设备库 product templateId，用于查询 faultCodeDict / normalRanges / knowledgeBase */
  productKey?: string
  deviceType: string
  area: string
  areaId?: string
  location: string
  owner: string
  /** 连接状态真值：设备总览默认只展示这三个状态 */
  connectionStatus?: IotDeviceConnectionStatus
  /** 扩展业务状态：无数据 / 告警中 / 维护中，可用于后续查询 */
  businessStatuses?: IotDeviceBusinessStatus[]
  status: IotDeviceStatus
  risk: IotDeviceRisk
  lastSeen: string
  accessMode: string
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
  /** 当前活跃故障码（来自设备协议字段映射，用于总览异常类型聚合） */
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
  | 'diagnose'        // 数据异常 / 离线 → 在总览内聚焦
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
  /** AI 派生的过滤候选，供 deriveTodos 转成今日待办使用。 */
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

export interface IotDeviceGroupUpdateInput {
  name?: string
  owner?: string
  description?: string
}

export interface IotGroupKeyMetricAverage {
  pointKey: string
  name: string
  unit?: string
  average: number
  sampleCount: number
}

export interface IotGroupAggregates {
  onlineRate: number
  riskDistribution: { urgent: number; watch: number; normal: number }
  keyMetricAverages?: IotGroupKeyMetricAverage[]
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

export type IotRiskKind = 'data-deviation' | 'offline-frequent' | 'fault-code'

export interface IotDeviceResetResult {
  projectId: string
  resetAt: string
  deviceCount: number
  deviceIds: string[]
}

export interface IotDeviceAdapter {
  getWorkbench(filters: IotDeviceFilters): Promise<ServiceResult<IotDeviceWorkbench>>
  /** basis 默认 'area'（决议见 module-iot.md §设备分组 §维度切换） */
  getGroups(projectId: string, basis?: IotDeviceGroupBasis): Promise<ServiceResult<IotDeviceGroupsView>>
  getGroupDetail(projectId: string, groupId: string): Promise<ServiceResult<IotGroupDetail>>
  updateGroup(projectId: string, groupId: string, input: IotDeviceGroupUpdateInput): Promise<ServiceResult<IotDeviceGroup>>
  deleteGroup(projectId: string, groupId: string): Promise<ServiceResult<{ id: string }>>
  /** 批量通知组内负责人（mock 实现，对组内 distinct owners 各发一条 mock 通知） */
  notifyGroupOwners(projectId: string, groupId: string): Promise<ServiceResult<{ owners: string[]; sentAt: string }>>
  /** 批量通知设备负责人（用于区域父节点等非持久化分组） */
  notifyDeviceOwners(projectId: string, deviceIds: string[]): Promise<ServiceResult<{ owners: string[]; sentAt: string }>>
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
