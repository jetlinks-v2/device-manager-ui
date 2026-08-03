import { DEVICE_LIBRARY } from '../device-library/adapters/deviceLibrary.seed'
import i18n from '@jetlinks-web-core/locales'
import type { DeviceDataPoint } from '../device-library/types'
import { err, ok } from '../shared/serviceResult'
import { projectDataAccessService } from '../projectSupport'
import { createProjectAreaMockAdapter } from '../projectSupport'
import type { ProjectArea } from '../projectSupport'
import { createIotDeviceSeed } from './iotDevice.seed'
import type {
  IotDevice,
  IotDeviceAdapter,
  IotDeviceBusinessStatus,
  IotDeviceCommandCategory,
  IotDeviceCommandDefinition,
  IotDeviceCommandExecution,
  IotDeviceCommandExecutionStatus,
  IotDeviceCommandParam,
  IotDeviceCommandRiskLevel,
  IotDeviceConnectionStatus,
  IotDeviceFilters,
  IotDeviceGroup,
  IotDeviceGroupBasis,
  IotDeviceHealthDiagnosis,
  IotDeviceTodo,
  IotGroupAggregates,
  IotGroupKeyMetricAverage,
  IotGroupRuleStats,
  IotHealthFaultRow,
  IotHealthFaultSection,
  IotHealthFeaturePoint,
  IotHealthFeatureSection,
  IotHealthListView,
  IotHealthRiskRow,
  IotHealthTimelineSection,
  IotLifecycleStage,
  IotDeviceInsight,
  IotDeviceRisk,
  IotDeviceStatus,
  IotInsightKind,
  IotNaturalLanguageFilterResult,
  IotRiskKind,
  IotTelemetryStatus,
  IotTodoActionKind,
  IotTodoRecord,
  IotTodoSource,
  IotTodoStatus,
} from '../../types'
import {
  getIotDeviceBusinessStatuses,
  getIotDeviceConnectionStatus,
  getIotDeviceRiskKinds,
  hasIotDeviceBusinessStatus,
  matchesIotDeviceFilters,
} from '../../hooks/useIotDeviceStatus'

const projectAreaAdapter = createProjectAreaMockAdapter()
const AREA_TREE_GROUP_PREFIX = 'group-area-tree-'
const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})

const DEVICE_CATEGORY_LABEL = {
  video: '视频接入',
  meter: '计量仪表',
  sensor: '感知终端',
  industrial: '工业采集',
  integration: '系统接入',
} as const

function getDeviceTypeLabel(category: string | undefined) {
  if (!category) return '感知终端'
  return DEVICE_CATEGORY_LABEL[category as keyof typeof DEVICE_CATEGORY_LABEL] ?? category
}

/* DEVICES 作为模块级 mock 数据。基础数据来自区域管理 + 设备库 seed；createDevice 把新建 instance unshift 到数组开头，
   session 内持久；刷新页面即重置（第一阶段不写 localStorage）。 */
const DEVICES: IotDevice[] = createIotDeviceSeed()

async function getVisibleProjectDevices(projectId: string) {
  const accessResult = await projectDataAccessService.getActiveAccess(projectId)
  if (!accessResult.ok) {
    return err(accessResult.error.code, accessResult.error.message, accessResult.error.detail)
  }

  const projectDevices = DEVICES.filter((device) => device.projectId === projectId)
  return ok(projectDataAccessService.filterBusinessByArea(
    accessResult.data,
    projectDevices,
    (device) => ({
      areaId: device.areaId,
      text: [device.area, device.location, device.name, device.identifier, device.productName],
    }),
  ))
}

function cloneDevice(device: IotDevice): IotDevice {
  return {
    ...device,
    connectionStatus: getIotDeviceConnectionStatus(device),
    businessStatuses: getIotDeviceBusinessStatuses(device),
    aiSummary: {
      ...device.aiSummary,
      reasons: [...device.aiSummary.reasons],
      actions: [...device.aiSummary.actions],
      evidence: [...device.aiSummary.evidence],
    },
    telemetry: device.telemetry.map((point) => ({ ...point })),
    alarms: device.alarms.map((alarm) => ({ ...alarm, payload: { ...alarm.payload } })),
    logs: device.logs.map((log) => ({ ...log })),
    rules: device.rules.map((rule) => ({ ...rule })),
    relations: device.relations.map((relation) => ({ ...relation })),
    tags: [...device.tags],
    imageUrl: device.imageUrl,
    currentFaultCodes: device.currentFaultCodes?.map((fault) => ({ ...fault, payload: { ...fault.payload } })),
  }
}

function summarizeAreas(devices: IotDevice[]) {
  const areas = unique(devices.map((item) => item.area))
  if (areas.length <= 2) return areas.join('、')
  return `${areas.slice(0, 2).join('、')} 等 ${areas.length} 个区域`
}

function createInsights(devices: IotDevice[]): IotDeviceInsight[] {
  const noData = devices.filter((item) => hasIotDeviceBusinessStatus(item, 'no-data'))
  const offline = devices.filter((item) => !hasIotDeviceBusinessStatus(item, 'no-data') && getIotDeviceConnectionStatus(item) === 'offline')
  const alarms = devices.filter((item) => hasIotDeviceBusinessStatus(item, 'alarm'))
  const threshold = devices.filter((item) => item.rules.some((rule) => rule.status === '建议调整'))
  const thresholdAreas = summarizeAreas(threshold)

  const connectionInsights: IotDeviceInsight[] = [
    ...noData.map((device) => ({
      id: `insight-no-data-${device.id}`,
      kind: 'no-data' as const,
      title: `${device.name} 无数据`,
      summary: `${device.name} 已超过业务容忍时间未上报，当前点位位于 ${device.area}${device.location ? ` · ${device.location}` : ''}。`,
      reason: '需要优先判断设备供电、现场网络和上游采集链路是否正常。',
      action: '先进入设备健康详情确认异常摘要，再安排现场复核。',
      deviceIds: [device.id],
      priority: device.risk === 'normal' ? 'watch' as const : device.risk,
    })),
    ...offline.map((device) => ({
      id: `insight-offline-${device.id}`,
      kind: 'offline' as const,
      title: `${device.name} 设备离线`,
      summary: `${device.name} 当前处于离线状态，最近状态更新时间为 ${device.lastSeen}。`,
      reason: '建议优先确认现场供电、网络链路和接入恢复情况。',
      action: '进入设备健康详情查看连接异常摘要，并继续排查。',
      deviceIds: [device.id],
      priority: device.risk === 'normal' ? 'watch' as const : device.risk,
    })),
  ]

  /* insight.title 必须是设备状态层的描述（"X 台设备出现 Y 问题"），
     不是工单层的派工动作。派工 / 现场确认这类语义在 evidence/action 里参考即可。 */
  const insights: IotDeviceInsight[] = [
    ...connectionInsights,
    {
      id: 'insight-alarm',
      kind: 'alarm',
      title: `${summarizeAreas(alarms)} 有设备告警中`,
      summary: `${alarms.length} 台设备触发告警，覆盖 ${unique(alarms.map((item) => item.productName)).join('、')}。`,
      reason: '告警来自区域真实业务风险点，需优先确认现场状态，再判断是否为测试、施工或工况波动。',
      action: '在告警中心进行现场确认；必要时联动视频或同区域设备复核。',
      deviceIds: alarms.map((item) => item.id),
      priority: 'urgent',
    },
    {
      id: 'insight-threshold',
      kind: 'threshold',
      title: `${thresholdAreas} 有设备阈值建议复核`,
      summary: `${threshold.length} 台设备的观察线或闭店策略与当前业务时段存在偏差。`,
      reason: '这些设备仍可正常上报，但关键指标已接近观察线，适合结合区域业务时段复核阈值。',
      action: '可在设备详情诊断中复核异常依据，或在告警中心配置业务时段策略。',
      deviceIds: threshold.map((item) => item.id),
      priority: 'watch',
    },
  ]
  return insights.filter((item) => item.deviceIds.length > 0)
}

/* 今日待办派生：把 insights 升级为可执行任务。
   - source = 'ai-derived' → 视觉区分为派生候选
   - 第一阶段不带 ETA，dueAt 用业务可读的相对时间；后续接告警中心后再正式定时
   - mock 写入动作（accept / complete / snooze / dismiss）由 createTodoStore 维护一份 in-memory 状态 */

/* insight.kind → 待办主操作类型映射（决议见 walkthrough · 今日待办反馈）
   抽象的"接受/拒绝"被替换为按设备问题类型分类的具体业务动作。 */
const ACTION_BY_INSIGHT_KIND: Record<IotInsightKind, { kind: IotTodoActionKind; label: string }> = {
  'no-data': { kind: 'diagnose', label: '诊断设备' },
  offline: { kind: 'diagnose', label: '诊断离线' },
  alarm: { kind: 'verify-alarm', label: '现场确认' },
  threshold: { kind: 'adjust-rule', label: '调整规则' },
  grouping: { kind: 'view-grouping', label: '查看分组' },
}

function deriveTodos(insights: IotDeviceInsight[], devices: IotDevice[]): IotDeviceTodo[] {
  const out: IotDeviceTodo[] = []
  const ownerOf = (deviceIds: string[]) => {
    const owners = unique(deviceIds.map((id) => devices.find((d) => d.id === id)?.owner ?? '').filter(Boolean))
    return owners[0] ?? '值班负责人'
  }
  const occurredAtOf = (insight: IotDeviceInsight) => {
    const relatedDevices = devices.filter((device) => insight.deviceIds.includes(device.id))
    const timeCandidates = relatedDevices.flatMap((device) => {
      if (insight.kind === 'alarm') {
        return device.alarms.map((alarm) => alarm.occurredAt)
      }
      if (insight.kind === 'threshold') {
        return device.logs.map((log) => log.happenedAt)
      }
      return [device.lastSeen]
    }).filter(Boolean)
    return timeCandidates[0] ?? undefined
  }
  for (const insight of insights) {
    const ownerLabel = ownerOf(insight.deviceIds)
    const action = ACTION_BY_INSIGHT_KIND[insight.kind] ?? { kind: 'diagnose' as const, label: '诊断设备' }
    out.push({
      id: `todo-${insight.id}`,
      source: 'ai-derived',
      /* title 是"设备出了什么问题"（设备状态层），不是"派谁去做什么"（工单 / 派工层）。
         派人 / 现场确认 / 通知值班 这类工单调度由告警中心承接（决议见 P32 + P37）。 */
      title: insight.title,
      detail: insight.summary,
      ownerKey: ownerLabel,
      ownerLabel,
      status: 'pending',
      priority: insight.priority,
      occurredAt: occurredAtOf(insight),
      dueAt: insight.priority === 'urgent' ? '今日处理' : '本班次内',
      deviceIds: [...insight.deviceIds],
      /* 把分析依据 + 推荐处置都放 evidence。处置只是参考，真实派工动作在告警中心。 */
      evidence: [insight.reason, insight.action].filter(Boolean),
      sourceLabel: '派生候选',
      actionKind: action.kind,
      actionLabel: action.label,
    })
  }
  return out
}

interface TodoStore {
  /** todoId → status；初始派生默认是 'pending' */
  status: Map<string, IotTodoStatus>
  /** todoId → source 覆盖；'accept' 后变为 'manual' */
  source: Map<string, IotTodoSource>
  records: Map<string, IotTodoRecord[]>
  /** dismissed todos 不再返回给 UI */
  dismissed: Set<string>
}

function createTodoStore(): TodoStore {
  return {
    status: new Map(),
    source: new Map(),
    records: new Map(),
    dismissed: new Set(),
  }
}

function nowRecordTime() {
  return '刚刚'
}

function appendTodoRecord(store: TodoStore, todoId: string, actor: string, action: string) {
  const current = store.records.get(todoId) ?? []
  store.records.set(todoId, [
    ...current,
    {
      id: `${todoId}-record-${current.length + 1}`,
      actor,
      actedAt: nowRecordTime(),
      action,
    },
  ])
}

function mapTodoStatusFromAction(action?: string): IotTodoStatus {
  switch (action) {
    case '通知负责人':
    case '已派人到现场':
      return 'assigned'
    case '保留观察':
      return 'pending-review'
    default:
      return 'completed'
  }
}

function applyTodoStore(todos: IotDeviceTodo[], store: TodoStore): IotDeviceTodo[] {
  return todos
    .filter((todo) => !store.dismissed.has(todo.id))
    .map((todo) => {
      const overrideSource = store.source.get(todo.id)
      const overrideStatus = store.status.get(todo.id)
      const next: IotDeviceTodo = { ...todo }
      if (overrideSource) {
        next.source = overrideSource
        if (overrideSource !== 'ai-derived') next.sourceLabel = undefined
      }
      if (overrideStatus) next.status = overrideStatus
      next.records = [...(store.records.get(todo.id) ?? [])]
      return next
    })
}

function riskRank(risk: IotDeviceRisk) {
  return { urgent: 0, watch: 1, normal: 2 }[risk]
}

/* 设备列表排序：风险 → 状态 → 名字。
   - 风险（urgent → watch → normal）保证紧急事件在前
   - 状态（alarm → no-data → offline → online → disabled）让"业务真在出问题"的设备优先于轻量异常
   - 名字 zh-CN 升序保证同优先级稳定排列，可预测 */
const STATUS_RANK: Record<IotDeviceStatus, number> = {
  alarm: 0,
  'no-data': 1,
  offline: 2,
  online: 3,
  disabled: 4,
}

function compareDevices(a: IotDevice, b: IotDevice) {
  const r = riskRank(a.risk) - riskRank(b.risk)
  if (r !== 0) return r
  const aStatus = hasIotDeviceBusinessStatus(a, 'alarm')
    ? 'alarm'
    : hasIotDeviceBusinessStatus(a, 'no-data')
      ? 'no-data'
      : getIotDeviceConnectionStatus(a)
  const bStatus = hasIotDeviceBusinessStatus(b, 'alarm')
    ? 'alarm'
    : hasIotDeviceBusinessStatus(b, 'no-data')
      ? 'no-data'
      : getIotDeviceConnectionStatus(b)
  const s = STATUS_RANK[aStatus] - STATUS_RANK[bStatus]
  if (s !== 0) return s
  return a.name.localeCompare(b.name, 'zh-CN')
}

function matchKeyword(device: IotDevice, keyword: string) {
  const haystack = [
    device.name,
    device.productName,
    device.deviceType,
    device.area,
    device.location,
    device.owner,
    device.summary,
    ...device.tags,
  ].join(' ')
  return haystack.toLowerCase().includes(keyword.toLowerCase())
}

function filterDevices(devices: IotDevice[], filters: IotDeviceFilters) {
  return devices
    .filter((device) => device.projectId === filters.projectId)
    .filter((device) => !filters.keyword || matchKeyword(device, filters.keyword))
    .filter((device) => matchesIotDeviceFilters(device, filters))
    .filter((device) => !filters.anomalyKind || filters.anomalyKind === 'all' || deriveRiskKinds(device).includes(filters.anomalyKind))
    .filter((device) => !filters.risk || filters.risk === 'all' || device.risk === filters.risk)
    .filter((device) => !filters.area || filters.area === 'all' || device.area === filters.area)
    .filter((device) => !filters.productName || filters.productName === 'all' || device.productName === filters.productName)
    .filter((device) => !filters.owner || filters.owner === 'all' || device.owner === filters.owner)
    .filter((device) => !filters.deviceIds?.length || filters.deviceIds.includes(device.id))
    .sort(compareDevices)
}

function deriveNaturalCriteria(projectId: string, text: string, devices: IotDevice[]): IotNaturalLanguageFilterResult {
  const criteria: Partial<IotDeviceFilters> = { projectId }
  const suggestions: string[] = []

  const areaRules: Array<[RegExp, string]> = [
    [/中庭|商场|购物/i, '星环购物中心 · 中央中庭'],
    [/服务台/i, '星环购物中心 · 服务台'],
    [/消防通道|疏散门/i, '星环购物中心 · 消防通道'],
    [/车库|停车|排水沟|B1|B2/i, '星环购物中心 · 东侧车库'],
    [/卸货/i, '星环购物中心 · 卸货通道'],
    [/加油|油岛|1号岛/i, '晨光能源站 · 1号加油岛'],
    [/卸油/i, '晨光能源站 · 卸油区'],
    [/便利店/i, '晨光能源站 · 便利店'],
    [/收银/i, '晨光能源站 · 收银区'],
    [/值班室/i, '晨光能源站 · 值班室'],
    [/中控|化工中控/i, '青岚化工厂 · 中控大厅'],
    [/反应釜|压力|振动/i, '青岚化工厂 · 反应釜区'],
    [/投料/i, '青岚化工厂 · 投料间'],
    [/储罐|液位/i, '青岚化工厂 · 储罐区'],
    [/装卸|栈台/i, '青岚化工厂 · 装卸栈台'],
    [/康养|接待大厅/i, '松龄颐养院 · 接待大厅'],
    [/护理/i, '松龄颐养院 · 护理站'],
    [/活动室/i, '松龄颐养院 · 活动室'],
    [/住区|老人|东侧住区/i, '松龄颐养院 · 东侧住区'],
    [/花园|灌溉|用水/i, '松龄颐养院 · 康复花园'],
    [/办公/i, '云栖科创园 · 开放办公区'],
    [/实验室|VOC/i, '云栖科创园 · 联合实验室'],
    [/会议/i, '云栖科创园 · 会议区'],
    [/数据中心|机房|主机房/i, '云栖科创园 · 主机房'],
    [/UPS|供电/i, '云栖科创园 · UPS间'],
    [/北门|访客/i, '云栖科创园 · 北门访客区'],
  ]
  for (const [pattern, area] of areaRules) {
    if (pattern.test(text)) criteria.area = area
  }

  if (/离线/i.test(text)) criteria.connectionStatus = 'offline'
  if (/停用|禁用/i.test(text)) criteria.connectionStatus = 'disabled'
  if (/无数据|没数据|不上报|未上报/i.test(text)) criteria.businessStatus = 'no-data'
  if (/告警|报警/i.test(text)) criteria.businessStatus = 'alarm'
  if (/紧急|优先|严重/i.test(text)) criteria.risk = 'urgent'
  if (/水浸|漏水|防汛/i.test(text)) criteria.keyword = '水浸'
  if (/烟感|烟雾|消防/i.test(text)) criteria.keyword = '烟感'
  if (/一氧化碳|\bCO\b/i.test(text)) criteria.keyword = 'CO'
  if (/VOC|可燃|LEL|油气|气体/i.test(text)) criteria.keyword = '气体'
  if (/电表|能耗|用电|功率/i.test(text)) criteria.keyword = '电表'
  if (/水表|流量|用水/i.test(text)) criteria.keyword = '流量'
  if (/摄像|NVR|视频|取流/i.test(text)) criteria.keyword = '摄像'
  if (/门禁|门磁|通行|门未关/i.test(text)) criteria.keyword = '门'
  if (/网关|采集器/i.test(text)) criteria.keyword = '网关'

  const matched = filterDevices(devices, criteria as IotDeviceFilters)

  if (!matched.length) {
    suggestions.push('换成“车库无数据设备”“投料间告警设备”或“北门离线视频设备”再试')
  } else {
    suggestions.push('可以继续输入“解释原因”查看这些设备的共同风险')
    suggestions.push('也可以打开单个设备，查看处理建议')
  }

  return {
    text,
    criteria,
    explanation: matched.length
      ? `已识别为 ${describeCriteria(criteria)}，共匹配 ${matched.length} 台设备。`
      : '未找到完全匹配的设备，保留原列表并给出可尝试的查询方式。',
    matchedDeviceIds: matched.map((item) => item.id),
    suggestions,
  }
}

function describeCriteria(criteria: Partial<IotDeviceFilters>) {
  const parts = [
    criteria.area && `区域=${criteria.area}`,
    criteria.connectionStatus && `连接状态=${statusLabel(criteria.connectionStatus)}`,
    criteria.businessStatus && `业务状态=${statusLabel(criteria.businessStatus)}`,
    criteria.risk && `风险=${criteria.risk === 'urgent' ? '紧急' : '观察'}`,
    criteria.keyword && `关键词=${criteria.keyword}`,
  ].filter(Boolean)
  return parts.length ? parts.join('、') : '当前项目设备搜索'
}

function statusLabel(status: IotDeviceConnectionStatus | IotDeviceBusinessStatus | 'all') {
  return {
    all: '全部',
    online: '在线',
    offline: '离线',
    disabled: '禁用',
    'no-data': '无数据',
    alarm: '告警中',
    maintenance: '维护中',
  }[status]
}

function buildSummary(devices: IotDevice[]) {
  return {
    total: devices.length,
    online: devices.filter((item) => getIotDeviceConnectionStatus(item) === 'online').length,
    offline: devices.filter((item) => getIotDeviceConnectionStatus(item) === 'offline').length,
    noData: devices.filter((item) => hasIotDeviceBusinessStatus(item, 'no-data')).length,
    alarm: devices.filter((item) => hasIotDeviceBusinessStatus(item, 'alarm')).length,
    urgent: devices.filter((item) => item.risk === 'urgent').length,
    /* 维护中：派生自 lifecycleStage = 维护中（决议见 module-iot.md §设备总览 + P30）。
       lifecycleStage 由 deriveLifecycleStage 从 status + risk 派生；
       后续接入 lifecycleStage 持久化时改读字段而非派生。 */
    maintenance: devices.filter((item) => deriveLifecycleStage(item) === 'maintenance').length,
  }
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function buildGroupSummary(devices: IotDevice[]) {
  return {
    total: devices.length,
    urgent: devices.filter((item) => item.risk === 'urgent').length,
    watch: devices.filter((item) => item.risk === 'watch').length,
    normal: devices.filter((item) => item.risk === 'normal').length,
    offline: devices.filter((item) => getIotDeviceConnectionStatus(item) === 'offline').length,
    noData: devices.filter((item) => hasIotDeviceBusinessStatus(item, 'no-data')).length,
    alarm: devices.filter((item) => hasIotDeviceBusinessStatus(item, 'alarm')).length,
  }
}

function createDeviceGroup(input: {
  id: string
  projectId: string
  name: string
  basis: IotDeviceGroupBasis
  description: string
  condition: string
  owner: string
  devices: IotDevice[]
  tags: string[]
  actions: string[]
  objective?: string
  alarmContacts?: string[]
  healthScore?: number
  riskLevel?: 'low' | 'medium' | 'high'
  automationRules?: string[]
}): IotDeviceGroup {
  return {
    id: input.id,
    projectId: input.projectId,
    name: input.name,
    basis: input.basis,
    description: input.description,
    condition: input.condition,
    owner: input.owner,
    deviceIds: input.devices.map((item) => item.id),
    tags: [...input.tags],
    objective: input.objective,
    alarmContacts: [...(input.alarmContacts ?? [])],
    healthScore: input.healthScore,
    riskLevel: input.riskLevel,
    automationRules: [...(input.automationRules ?? [])],
    summary: buildGroupSummary(input.devices),
    actions: [...input.actions],
  }
}

function buildGroupHealthScore(devices: IotDevice[]): number {
  if (!devices.length) return 0
  const urgent = devices.filter((device) => device.risk === 'urgent').length
  const watch = devices.filter((device) => device.risk === 'watch').length
  const unstable = devices.filter((device) => device.status !== 'online').length
  return Math.max(26, Math.min(98, 100 - urgent * 18 - watch * 9 - unstable * 7))
}

function deriveGroupRiskLevel(devices: IotDevice[]): 'low' | 'medium' | 'high' {
  if (devices.some((device) => device.risk === 'urgent')) return 'high'
  if (devices.some((device) => device.risk === 'watch' || device.status !== 'online')) return 'medium'
  return 'low'
}

function pickAlarmContacts(devices: IotDevice[]) {
  return unique(devices.map((device) => device.owner).filter(Boolean)).slice(0, 3)
}

/* 场景分组元数据：场景标签 → 场景名称、业务目标、处置动作与联动规则。 */
const SCENE_GROUP_META: Record<string, {
  name: string
  objective: string
  description: string
  scope: string
  actions: string[]
  automationRules: string[]
}> = {
  防汛: {
    name: '园区防汛',
    objective: '保证涉水风险点位在降雨和排水波动期间持续可见。',
    description: '水浸传感器和涉水风险点位，覆盖车库排水沟、主机房地板下等场景。',
    scope: '涉水风险点位和排水相关传感设备',
    actions: ['优先确认水浸触发是否真实', '无数据点位先复核电池和采集链路', '雨季或检修期间保留人工巡查'],
    automationRules: ['超过 30% 设备离线时升级为严重事件', '连续 10 分钟水浸告警时通知值班与工程负责人'],
  },
  消防: {
    name: '消防联动',
    objective: '让消防终端在演练、施工和真实告警之间快速分流。',
    description: '烟感和消防相关终端，处理时优先现场确认和告警闭环。',
    scope: '消防感知终端、烟感点位和通道安全设备',
    actions: ['现场确认烟雾或测试来源', '记录施工 / 演练影响', '保持消防告警通知启用'],
    automationRules: ['核心设备告警时通知消防联系人', '同一区域连续触发时自动升级为重点事件'],
  },
  能耗: {
    name: '夜间节能',
    objective: '按班次和区域观察电力负载，识别夜间异常能耗。',
    description: '电力计量终端，适合按区域、班次和设备运行时段观察负载。',
    scope: '电力计量终端和用电负载相关设备',
    actions: ['核对倍率和采集地址', '结合业务时段复核阈值', '观察连续趋势后再调整策略'],
    automationRules: ['夜间连续 2 小时超阈值时推送节能提醒'],
  },
  计量: {
    name: '冷链供水',
    objective: '持续观察冷链与后勤区域的水量变化，快速识别异常持续流量。',
    description: '水表 / 流量计等计量设备，用于园区、康养和工业场景的分区用水观察。',
    scope: '水表、流量计和分区用水观察设备',
    actions: ['核对单位和倍率', '观察夜间持续流量', '通讯异常时先排查采集器和表号'],
    automationRules: ['夜间持续流量超过阈值时自动生成巡查任务'],
  },
  安防: {
    name: 'VIP 区域安防',
    objective: '对出入口和重点区域保持更高频的状态关注和告警响应。',
    description: '门磁、紧急按钮、存在传感器等安防类终端，按班次和时段配置告警。',
    scope: '门磁、紧急按钮、存在感知和安防联动终端',
    actions: ['按区域班次复核规则', '长开或长时间静止事件需要现场确认', '保留夜间重点关注策略'],
    automationRules: ['夜间重点区域离线时立即通知值守负责人'],
  },
  环境: {
    name: '机房巡检',
    objective: '将温湿度、空气质量和供电支撑环境作为一个巡检单元管理。',
    description: '温湿度、空气质量、一氧化碳、VOC 等环境终端，用于舒适度、安全和通风观察。',
    scope: '温湿度、空气质量、一氧化碳和 VOC 等环境终端',
    actions: ['观察通风或新风联动是否生效', '阈值调整前确认区域业务时段', '异常持续时联动同区域设备复核'],
    automationRules: ['温湿度持续越限时同步通知设施运维'],
  },
  油气安全: {
    name: '油气安全',
    objective: '在加油与卸油期间保持作业风险一屏可见。',
    description: '可燃气体、静电接地和加油 / 卸油相关终端，面向能源站作业安全。',
    scope: '加油、卸油、可燃气体和静电接地相关设备',
    actions: ['先确认作业状态和通风条件', '高风险告警暂停临近作业', '处理后记录复位原因'],
    automationRules: ['可燃气体与静电接地同时异常时升级为严重事件'],
  },
  危化: {
    name: '危化作业',
    objective: '围绕工艺过程和装卸作业管理关键设备运行风险。',
    description: '化工投料、反应釜、储罐和装卸栈台相关终端，关注工况越限与联动状态。',
    scope: '投料、反应釜、储罐、装卸栈台等危化作业设备',
    actions: ['按危化流程确认现场', '工艺班组复核阀门和介质状态', '联动设备恢复后执行一次安全测试'],
    automationRules: ['连续异常增长时自动生成工单并同步工艺班组'],
  },
  工业采集: {
    name: '工业采集',
    objective: '把压力、液位和 IO 设备组织成可联动诊断的运营单元。',
    description: '压力、液位、振动和 IO 控制器等工业采集终端，支撑工况趋势与联动诊断。',
    scope: '压力、液位、振动和 IO 控制器等工业采集终端',
    actions: ['核对采集点表和量程', '趋势异常时复核现场仪表', '通讯异常先排查采集链路'],
    automationRules: ['核心工艺点位告警时自动升级告警等级'],
  },
  康养: {
    name: '康养照护',
    objective: '围绕护理站和值守班次管理照护设备运行状态。',
    description: '康养住区、活动室和护理站的存在、门磁、紧急按钮和环境终端。',
    scope: '康养住区、活动室、护理站的照护感知设备',
    actions: ['护理站先做电话或现场确认', '夜间重点关注住区设备', '保留照护事件处理记录'],
    automationRules: ['夜间异常时先通知护理站，再同步项目负责人'],
  },
  数据中心: {
    name: '数据中心环境',
    objective: '让机房环境、供电支撑和涉水风险作为一个运维单元协同查看。',
    description: '主机房和供电支撑空间的温湿度、水浸、烟感、电表和视频接入设备。',
    scope: '主机房、UPS、弱电井和供电支撑空间设备',
    actions: ['水浸告警优先现场确认', '温度越限复核局部送风', '供电支撑空间只纳入传感与计量终端'],
    automationRules: ['主机房水浸或温度持续越限时立即升级为重点事件'],
  },
  视频接入: {
    name: '视频接入',
    objective: '把摄像机、NVR 与取流链路作为统一的可用性单元查看。',
    description: '网络摄像机和 NVR 等可通过 ONVIF / GB28181 管理的视联设备。',
    scope: '摄像机、NVR 和取流状态相关设备',
    actions: ['取流失败先诊断网络与注册状态', 'NVR 存储异常通知弱电工程', '关键出入口保留人工复核'],
    automationRules: ['关键点位连续离线 15 分钟时同步安防中心'],
  },
  通行安防: {
    name: '通行安防',
    objective: '围绕门禁、门磁和出入口视频形成统一的通行事件响应单元。',
    description: '门禁控制器、门磁和出入口摄像机等通行复核设备。',
    scope: '门禁控制、门磁和出入口复核设备',
    actions: ['复核门体和锁状态', '长开事件按班次确认', '视频离线时同步安保中心'],
    automationRules: ['门禁异常且出入口视频离线时自动升级为高风险'],
  },
}

function generateDeviceIdentifier(input: {
  projectId: string
  productKey: string
  areaId: string
}) {
  const projectCode = input.projectId.slice(0, 3).toUpperCase()
  const productCode = input.productKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
  const areaCode = input.areaId.replace(/^area-/, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
  const serial = String(
    DEVICES.filter((device) => device.projectId === input.projectId).length + 1,
  ).padStart(3, '0')
  return `${projectCode}-${areaCode}-${productCode}-${serial}`
}

function pickPrimaryOwner(devices: IotDevice[]): string {
  const counts = new Map<string, number>()
  devices.forEach((d) => counts.set(d.owner, (counts.get(d.owner) ?? 0) + 1))
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? '值班负责人'
}

function createAreaGroups(projectId: string, devices: IotDevice[]): IotDeviceGroup[] {
  const areas = unique(devices.map((d) => d.area))
  return areas.map((area) => {
    const list = devices.filter((d) => d.area === area)
    return createDeviceGroup({
      id: `group-area-${area}`,
      projectId,
      name: area,
      basis: 'area',
      description: `${area} 内的所有设备，按物理空间分组用于巡检与值守交接。`,
      condition: `区域 = ${area}`,
      owner: pickPrimaryOwner(list),
      devices: list,
      tags: [area],
      objective: '从空间和值守范围观察设备是否影响当前业务区域。',
      alarmContacts: pickAlarmContacts(list),
      healthScore: buildGroupHealthScore(list),
      riskLevel: deriveGroupRiskLevel(list),
      automationRules: ['区域内连续离线增长时通知负责人', '同一空间多点异常时升级为区域事件'],
      actions: ['按当前空间值班节奏巡查', '紧急设备优先现场处理', '周报汇总区域稳定性'],
    })
  }).filter((group) => group.deviceIds.length > 0)
}

function createSceneGroups(projectId: string, devices: IotDevice[]): IotDeviceGroup[] {
  return Object.entries(SCENE_GROUP_META).map(([tag, meta]) => {
    const list = devices.filter((d) => d.tags.includes(tag))
    return createDeviceGroup({
      id: `group-scene-${tag}`,
      projectId,
      name: meta.name,
      basis: 'scene',
      description: meta.description,
      condition: meta.scope,
      owner: pickPrimaryOwner(list),
      devices: list,
      tags: [tag],
      objective: meta.objective,
      alarmContacts: pickAlarmContacts(list),
      healthScore: buildGroupHealthScore(list),
      riskLevel: deriveGroupRiskLevel(list),
      automationRules: [...meta.automationRules],
      actions: [...meta.actions],
    })
  }).filter((group) => group.deviceIds.length > 0)
}

function createOwnerGroups(projectId: string, devices: IotDevice[]): IotDeviceGroup[] {
  const owners = unique(devices.map((d) => d.owner))
  return owners.map((owner) => {
    const list = devices.filter((d) => d.owner === owner)
    return createDeviceGroup({
      id: `group-owner-${owner}`,
      projectId,
      name: owner,
      basis: 'owner',
      description: `负责人 = ${owner}，按值班角色集中查看设备并交接。`,
      condition: `负责人 = ${owner}`,
      owner,
      devices: list,
      tags: [owner],
      actions: ['班次开始时核对状态', '紧急设备优先派工', '记录处理结果'],
    })
  }).filter((group) => group.deviceIds.length > 0)
}

function createStatusGroups(projectId: string, devices: IotDevice[]): IotDeviceGroup[] {
  const todoDevices = devices.filter((d) =>
    getIotDeviceConnectionStatus(d) === 'offline'
    || hasIotDeviceBusinessStatus(d, 'no-data')
    || hasIotDeviceBusinessStatus(d, 'alarm'),
  )
  const watchDevices = devices.filter((d) => d.risk === 'watch' && getIotDeviceConnectionStatus(d) === 'online')
  const stableDevices = devices.filter((d) => d.risk === 'normal' && getIotDeviceConnectionStatus(d) === 'online')

  return [
    createDeviceGroup({
      id: 'group-status-todo',
      projectId,
      name: '待处理',
      basis: 'status',
      description: '当前存在离线、无数据或告警，需要业务处理的设备。',
      condition: '状态为离线 / 无数据 / 告警中',
      owner: pickPrimaryOwner(todoDevices),
      devices: todoDevices,
      tags: ['待处理', '交接'],
      actions: ['先确认现场断电 / 网络', '安排现场确认告警', '记录处理结果'],
    }),
    createDeviceGroup({
      id: 'group-status-watch',
      projectId,
      name: '观察中',
      basis: 'status',
      description: '在线但风险等级为观察的设备，需持续关注趋势。',
      condition: '状态在线 + 风险 = 观察',
      owner: pickPrimaryOwner(watchDevices),
      devices: watchDevices,
      tags: ['观察'],
      actions: ['持续观察阈值', '若进入紧急再升级处置'],
    }),
    createDeviceGroup({
      id: 'group-status-stable',
      projectId,
      name: '稳定运行',
      basis: 'status',
      description: '当前在线且无风险的设备，适合周报和例行巡检。',
      condition: '状态在线 + 风险 = 正常',
      owner: pickPrimaryOwner(stableDevices),
      devices: stableDevices,
      tags: ['稳定'],
      actions: ['保留当前阈值', '周报展示趋势'],
    }),
  ].filter((group) => group.deviceIds.length > 0)
}

function createTypeGroups(projectId: string, devices: IotDevice[]): IotDeviceGroup[] {
  const types = unique(devices.map((d) => d.deviceType))
  return types.map((type) => {
    const list = devices.filter((d) => d.deviceType === type)
    const onlineRate = list.length
      ? Math.round((list.filter((device) => device.status === 'online').length / list.length) * 100)
      : 0
    const alertRate = list.length
      ? Math.round(((list.filter((device) => device.status === 'alarm').length + list.filter((device) => device.risk === 'urgent').length) / list.length) * 100)
      : 0
    return createDeviceGroup({
      id: `group-type-${type}`,
      projectId,
      name: type,
      basis: 'type',
      description: `${type} 类设备集合，适合统一观察在线率、告警率和同类处置动作。`,
      condition: `设备类型 = ${type}`,
      owner: pickPrimaryOwner(list),
      devices: list,
      tags: [type],
      objective: '以资产类型为单位查看同类设备是否稳定运行。',
      alarmContacts: pickAlarmContacts(list),
      healthScore: buildGroupHealthScore(list),
      riskLevel: deriveGroupRiskLevel(list),
      automationRules: [`${type} 在线率连续下降时通知负责人`, `${type} 告警率超过 ${Math.max(alertRate, 15)}% 时升级为类型事件`],
      actions: [`按类型查看在线率 ${onlineRate}%`, `按类型查看告警率 ${alertRate}%`, '同类设备统一安排巡检'],
    })
  }).filter((group) => group.deviceIds.length > 0)
}

function createGroups(projectId: string, basis: IotDeviceGroupBasis, devices: IotDevice[]): IotDeviceGroup[] {
  switch (basis) {
    case 'area':
      return createAreaGroups(projectId, devices)
    case 'scene':
    case 'scenario':
      return createSceneGroups(projectId, devices)
    case 'type':
    case 'category':
      return createTypeGroups(projectId, devices)
    case 'owner':
      return createOwnerGroups(projectId, devices)
    case 'status':
      return createStatusGroups(projectId, devices)
    case 'custom':
      return []
  }
}

/* 当 groupId 形如 'group-{basis}-{...}' 时，从前缀解析 basis */
function parseBasisFromGroupId(groupId: string): IotDeviceGroupBasis | null {
  const m = groupId.match(/^group-(area|type|scene|scenario|owner|status|category)-/)
  return (m?.[1] as IotDeviceGroupBasis | undefined) ?? null
}

function parseAreaTreeGroupId(groupId: string): string | null {
  return groupId.startsWith(AREA_TREE_GROUP_PREFIX)
    ? groupId.slice(AREA_TREE_GROUP_PREFIX.length)
    : null
}

function collectAreaClosureIds(areaId: string, areas: ProjectArea[]): Set<string> {
  const childrenByParent = new Map<string | undefined, ProjectArea[]>()
  for (const area of areas) {
    const list = childrenByParent.get(area.parentId) ?? []
    list.push(area)
    childrenByParent.set(area.parentId, list)
  }

  const ids = new Set<string>([areaId])
  const queue = [areaId]
  while (queue.length) {
    const current = queue.shift()
    for (const child of childrenByParent.get(current) ?? []) {
      ids.add(child.id)
      queue.push(child.id)
    }
  }
  return ids
}

function createAreaTreeGroup(projectId: string, area: ProjectArea, devices: IotDevice[]): IotDeviceGroup {
  return createDeviceGroup({
    id: `${AREA_TREE_GROUP_PREFIX}${area.id}`,
    projectId,
    name: area.name,
    basis: 'area',
    description: area.description,
    condition: area.parentId ? `区域及下级空间 = ${area.name}` : '项目全部区域',
    owner: pickPrimaryOwner(devices),
    devices,
    tags: [area.code, ...area.aliases].filter(Boolean).slice(0, 4),
    objective: '从空间层级观察当前区域和下级区域是否存在集中风险。',
    alarmContacts: pickAlarmContacts(devices),
    healthScore: buildGroupHealthScore(devices),
    riskLevel: deriveGroupRiskLevel(devices),
    automationRules: ['父区域出现连续异常增长时升级为区域事件'],
    actions: devices.length
      ? ['按区域巡查异常设备', '同步当前负责人', '进入设备详情诊断']
      : ['在设备模块绑定区域'],
  })
}

/* ------- 组级聚合指标 + 规则统计 ------- */

function buildGroupAggregates(devices: IotDevice[]): IotGroupAggregates {
  const total = devices.length || 1
  const online = devices.filter((d) => d.status === 'online').length
  const onlineRate = devices.length ? online / total : 0
  const riskDistribution = {
    urgent: devices.filter((d) => d.risk === 'urgent').length,
    watch: devices.filter((d) => d.risk === 'watch').length,
    normal: devices.filter((d) => d.risk === 'normal').length,
  }

  /* 关键 metric 平均：仅当组内所有 device 同 productKey 时计算 */
  const productKeys = unique(devices.map((d) => d.productKey ?? '').filter(Boolean))
  const sharedProductKey = productKeys.length === 1 && devices.length === devices.filter((d) => d.productKey).length
    ? productKeys[0]
    : undefined

  let keyMetricAverages: IotGroupKeyMetricAverage[] | undefined
  if (sharedProductKey) {
    const product = getProductTemplate(sharedProductKey)
    const keyDataPoints = (product?.dataPoints ?? []).filter((dp) => dp.isKeyMetric && dp.key)
    keyMetricAverages = []
    for (const dp of keyDataPoints) {
      const samples: number[] = []
      for (const d of devices) {
        const point = d.telemetry.find((p) => p.key === dp.key)
        if (!point || !point.unit) continue
        const num = Number(point.value)
        if (!Number.isNaN(num)) samples.push(num)
      }
      if (samples.length === 0) continue
      const avg = samples.reduce((s, v) => s + v, 0) / samples.length
      keyMetricAverages.push({
        pointKey: dp.key!,
        name: dp.name,
        unit: devices[0]?.telemetry.find((p) => p.key === dp.key)?.unit,
        average: Math.round(avg * 100) / 100,
        sampleCount: samples.length,
      })
    }
    if (keyMetricAverages.length === 0) keyMetricAverages = undefined
  }

  return {
    onlineRate,
    riskDistribution,
    keyMetricAverages,
    sharedProductKey,
  }
}

function buildGroupRuleStats(devices: IotDevice[]): IotGroupRuleStats {
  const allRules = devices.flatMap((d) => d.rules)
  return {
    total: allRules.length,
    active: allRules.filter((r) => r.status === '启用').length,
    needsAdjust: allRules.filter((r) => r.status === '建议调整').length,
    paused: allRules.filter((r) => r.status === '停用').length,
  }
}

function deriveLifecycleStage(device: IotDevice): IotLifecycleStage {
  const connectionStatus = getIotDeviceConnectionStatus(device)
  if (connectionStatus === 'disabled') return 'retired'
  if (hasIotDeviceBusinessStatus(device, 'maintenance')) return 'maintenance'
  if (hasIotDeviceBusinessStatus(device, 'no-data') || hasIotDeviceBusinessStatus(device, 'alarm')) return 'watch'
  if (connectionStatus === 'offline') return 'watch'
  if (device.gatewayName || device.accessMode) return 'running'
  return 'connected'
}

function deriveHealthStatus(device: IotDevice): 'healthy' | 'watch' | 'urgent' | 'maintenance' {
  if (hasIotDeviceBusinessStatus(device, 'maintenance')) return 'maintenance'
  if (hasIotDeviceBusinessStatus(device, 'alarm') || hasIotDeviceBusinessStatus(device, 'no-data') || device.risk === 'urgent') return 'urgent'
  // 上一行已处理 risk === 'urgent' 情况，此处 device.risk 必为 'normal' | 'watch'
  if (getIotDeviceConnectionStatus(device) === 'offline') return 'watch'
  if (device.rules.some((rule) => rule.status === '建议调整')) return 'watch'
  if (device.telemetry.some((point) => point.status === 'warning')) return 'watch'
  return 'healthy'
}

/* ----- v3 设备健康（诊断台 + 维修知识中心） ----- */

function getProductTemplate(productKey: string | undefined) {
  if (!productKey) return null
  return DEVICE_LIBRARY.find((t) => t.id === productKey) ?? null
}

/** 同型号 + 该故障码在历史 N 个月的出现次数 mock。
   key 形如 'water-leak-sensor:WL01'。命中走 mock 记录，否则给一个保守默认。 */
const FAULT_HISTORY_MOCK: Record<string, { onDeviceMonths: number; onDeviceCount: number; onPeers: number }> = {
  'water-leak-sensor:WL01': { onDeviceMonths: 6, onDeviceCount: 4, onPeers: 9 },
  'smoke-detector:SD01': { onDeviceMonths: 6, onDeviceCount: 2, onPeers: 6 },
  'gas-lel-detector:G01': { onDeviceMonths: 3, onDeviceCount: 3, onPeers: 5 },
  'static-grounding-monitor:SG01': { onDeviceMonths: 6, onDeviceCount: 2, onPeers: 4 },
  'voc-toxic-gas-detector:T01': { onDeviceMonths: 6, onDeviceCount: 3, onPeers: 7 },
  'pressure-transmitter:PR01': { onDeviceMonths: 6, onDeviceCount: 5, onPeers: 11 },
  'io-relay-controller:IO01': { onDeviceMonths: 6, onDeviceCount: 2, onPeers: 3 },
  'nvr-recorder:NVR11': { onDeviceMonths: 6, onDeviceCount: 2, onPeers: 4 },
  'presence-radar-sensor:PRD01': { onDeviceMonths: 3, onDeviceCount: 3, onPeers: 6 },
  'temperature-humidity-sensor:TH11': { onDeviceMonths: 6, onDeviceCount: 4, onPeers: 10 },
  'access-controller:AC01': { onDeviceMonths: 6, onDeviceCount: 3, onPeers: 8 },
  'network-camera:VC01': { onDeviceMonths: 6, onDeviceCount: 5, onPeers: 14 },
  'carbon-monoxide-sensor:CO01': { onDeviceMonths: 6, onDeviceCount: 2, onPeers: 5 },
  'co2-air-quality-sensor:AQ01': { onDeviceMonths: 6, onDeviceCount: 3, onPeers: 8 },
  'water-flow-meter:WF01': { onDeviceMonths: 6, onDeviceCount: 2, onPeers: 5 },
}

function deriveRiskKinds(device: IotDevice): IotRiskKind[] {
  return getIotDeviceRiskKinds(device)
}

function buildRiskSummary(device: IotDevice, kinds: IotRiskKind[]): string {
  if (kinds.includes('fault-code')) {
    const fault = device.currentFaultCodes?.[0]
    return `当前活跃故障码 ${fault?.payload.faultCode ?? ''}` + (device.summary ? ` · ${device.summary}` : '')
  }
  if (kinds.includes('offline-frequent')) {
    if (hasIotDeviceBusinessStatus(device, 'no-data')) return `${device.lastSeen}起未上报`
    if (getIotDeviceConnectionStatus(device) === 'offline') return `离线 ${device.lastSeen}`
  }
  if (kinds.includes('data-deviation')) {
    const point = device.telemetry.find((p) => p.status === 'warning' || p.status === 'critical')
    if (point) return `${point.name} ${point.value}${point.unit ?? ''} · ${point.hint}`
  }
  return device.summary
}

function buildHealthListView(devices: IotDevice[]): IotHealthListView {
  const rows: IotHealthRiskRow[] = []
  for (const device of devices) {
    const riskKinds = deriveRiskKinds(device)
    if (!riskKinds.length) continue
    rows.push({
      deviceId: device.id,
      deviceName: device.name,
      productName: device.productName,
      productKey: device.productKey,
      area: device.area,
      location: device.location,
      owner: device.owner,
      status: device.status,
      risk: device.risk,
      healthStatus: deriveHealthStatus(device),
      lifecycleStage: deriveLifecycleStage(device),
      riskKinds,
      riskSummary: buildRiskSummary(device, riskKinds),
      lastAnomalyAt: device.lastSeen,
    })
  }
  rows.sort((a, b) => riskRank(a.risk) - riskRank(b.risk))

  return {
    rows,
    counts: {
      all: rows.length,
      deviation: rows.filter((r) => r.riskKinds.includes('data-deviation')).length,
      offlineFrequent: rows.filter((r) => r.riskKinds.includes('offline-frequent')).length,
      fault: rows.filter((r) => r.riskKinds.includes('fault-code')).length,
    },
  }
}

const TREND_PROFILE: Record<IotTelemetryStatus, number[]> = {
  normal: [0.50, 0.48, 0.51, 0.49, 0.52, 0.50, 0.49, 0.51, 0.50, 0.48, 0.50, 0.51],
  warning: [0.50, 0.52, 0.55, 0.62, 0.66, 0.71, 0.74, 0.78, 0.82, 0.79, 0.78, 0.76],
  critical: [0.50, 0.56, 0.66, 0.75, 0.84, 0.92, 0.95, 0.92, 0.97, 0.96, 0.98, 0.99],
  /* stale: 中段以后突然平直无数据，UI 自行用断线表达 */
  stale: [0.50, 0.50, 0.51, 0.50, 0.51, 0.49, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
}

function buildFeatureSection(device: IotDevice): IotHealthFeatureSection {
  const product = getProductTemplate(device.productKey)
  const ranges = product?.telemetryNormalRanges ?? []

  /* 只展示业务关键指标（决议 walkthrough · 物模型 isKeyMetric）。
     优先 product.dataPoints[].isKeyMetric=true；fallback 启发式取所有 telemetry。 */
  const keyMetricKeys = new Set<string>()
  for (const dp of product?.dataPoints ?? []) {
    if (dp.isKeyMetric && dp.key) keyMetricKeys.add(dp.key)
  }
  const filtered = keyMetricKeys.size > 0
    ? device.telemetry.filter((p) => keyMetricKeys.has(p.key))
    : device.telemetry

  const points: IotHealthFeaturePoint[] = filtered.map((point) => {
    const range = ranges.find((r) => r.pointKey === point.key)
    return {
      pointKey: point.key,
      name: point.name,
      unit: point.unit,
      currentValue: point.value,
      status: point.status,
      normalRange: range ? { min: range.min, max: range.max, hint: range.hint } : undefined,
      typicalAvg: range?.typicalAvg,
      trend: TREND_PROFILE[point.status],
      isDeviating: point.status === 'warning' || point.status === 'critical',
    }
  })
  return {
    trendWindowLabel: '近 24 小时',
    points,
  }
}

function buildTimelineSection(device: IotDevice, allDevices: IotDevice[]): IotHealthTimelineSection {
  const peers = allDevices
    .filter(
      (d) =>
        d.id !== device.id &&
        d.productName === device.productName &&
        d.status === 'online' &&
        d.risk === 'normal',
    )
    .slice(0, 3)
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      status: d.status,
      lastSeen: d.lastSeen,
    }))

  const alarm = device.alarms[0]
  return {
    anomalyStartedAt: alarm?.occurredAt,
    anomalyDuration: hasIotDeviceBusinessStatus(device, 'no-data') ? device.lastSeen : undefined,
    observation: device.aiSummary.conclusion,
    peers,
    relatedEvents: device.logs.slice(0, 3).map((l) => ({
      happenedAt: l.happenedAt,
      description: `${l.title} · ${l.message}`,
    })),
  }
}

function buildFaultSection(device: IotDevice): IotHealthFaultSection | undefined {
  if (!device.currentFaultCodes?.length) return undefined
  const product = getProductTemplate(device.productKey)
  if (!product) return undefined
  const dict = product.faultCodeDict ?? []
  const knowledge = product.knowledgeBase ?? []
  const rows: IotHealthFaultRow[] = []
  for (const fault of device.currentFaultCodes) {
    const code = fault.payload.faultCode
    if (!code) continue
    const entry = dict.find((d) => d.code === code)
    if (!entry) continue
    const histKey = `${device.productKey}:${code}`
    const hist = FAULT_HISTORY_MOCK[histKey] ?? { onDeviceMonths: 6, onDeviceCount: 1, onPeers: 1 }
    const refs = (entry.knowledgeRefs ?? [])
      .map((refId) => {
        const kb = knowledge.find((k) => k.id === refId)
        return kb ? { id: kb.id, title: kb.title } : null
      })
      .filter((x): x is { id: string; title: string } => x !== null)
    rows.push({
      code: entry.code,
      name: entry.name,
      severity: entry.severity,
      cause: entry.cause,
      recommendedAction: entry.recommendedAction,
      occurrencesOnDevice: hist.onDeviceCount,
      monthsWindow: hist.onDeviceMonths,
      occurrencesOnPeers: hist.onPeers,
      knowledgeRefs: refs,
    })
  }
  return rows.length ? { rows } : undefined
}

function buildAdviceSection(device: IotDevice): IotDeviceHealthDiagnosis['advice'] {
  return {
    conclusion: device.aiSummary.conclusion,
    bullets: [...device.aiSummary.actions],
    evidence: [...device.aiSummary.evidence],
  }
}

function buildDeviceHealthDiagnosis(device: IotDevice, allDevices: IotDevice[]): IotDeviceHealthDiagnosis {
  return {
    deviceId: device.id,
    deviceName: device.name,
    identifier: device.identifier,
    productName: device.productName,
    productKey: device.productKey,
    area: device.area,
    location: device.location,
    owner: device.owner,
    status: device.status,
    risk: device.risk,
    healthStatus: deriveHealthStatus(device),
    lifecycleStage: deriveLifecycleStage(device),
    features: buildFeatureSection(device),
    timeline: buildTimelineSection(device, allDevices),
    faults: buildFaultSection(device),
    advice: buildAdviceSection(device),
  }
}

function commandCategory(point: DeviceDataPoint): IotDeviceCommandCategory {
  const text = `${point.key ?? ''} ${point.name} ${point.desc}`
  if (/开门|门禁|解除锁定|白名单/.test(text)) return 'security'
  if (/查询|读取|录像/.test(text)) return 'query'
  if (/复位|重启|校准|维护/.test(text)) return 'maintenance'
  return 'control'
}

function commandRisk(point: DeviceDataPoint): IotDeviceCommandRiskLevel {
  const text = `${point.key ?? ''} ${point.name} ${point.desc}`
  if (/开门|继电器|输出|解除锁定/.test(text)) return 'critical'
  if (/云台|复位|重启|控制/.test(text)) return 'caution'
  return 'normal'
}

function commandParams(point: DeviceDataPoint): IotDeviceCommandParam[] {
  switch (point.key) {
    case 'remoteOpen':
      return [
        {
          key: 'duration',
          name: '开门保持',
          type: 'number',
          required: true,
          unit: '秒',
          defaultValue: 5,
          description: '门锁保持解锁的时长。',
        },
        {
          key: 'reason',
          name: '操作原因',
          type: 'string',
          required: true,
          placeholder: '例如：访客通行、现场演练',
        },
      ]
    case 'relayCommand':
      return [
        {
          key: 'channel',
          name: '输出通道',
          type: 'enum',
          required: true,
          defaultValue: 'do1',
          options: [
            { label: 'DO1', value: 'do1' },
            { label: 'DO2', value: 'do2' },
            { label: 'DO3', value: 'do3' },
          ],
        },
        {
          key: 'action',
          name: '输出动作',
          type: 'enum',
          required: true,
          defaultValue: 'pulse',
          options: [
            { label: '脉冲输出', value: 'pulse' },
            { label: '闭合', value: 'close' },
            { label: '断开', value: 'open' },
          ],
        },
        {
          key: 'duration',
          name: '持续时间',
          type: 'number',
          required: false,
          unit: '秒',
          defaultValue: 3,
        },
      ]
    case 'ptzControl':
      return [
        {
          key: 'direction',
          name: '方向',
          type: 'enum',
          required: true,
          defaultValue: 'left',
          options: [
            { label: '左', value: 'left' },
            { label: '右', value: 'right' },
            { label: '上', value: 'up' },
            { label: '下', value: 'down' },
            { label: '放大', value: 'zoomIn' },
            { label: '缩小', value: 'zoomOut' },
          ],
        },
        {
          key: 'speed',
          name: '速度',
          type: 'number',
          required: true,
          defaultValue: 4,
          description: '建议 1-7，数字越大移动越快。',
        },
      ]
    case 'recordQuery':
      return [
        {
          key: 'channel',
          name: '通道编码',
          type: 'string',
          required: true,
          placeholder: '请输入通道编码',
        },
        {
          key: 'startAt',
          name: '开始时间',
          type: 'datetime',
          required: true,
          placeholder: 'YYYY-MM-DD HH:mm',
        },
        {
          key: 'endAt',
          name: '结束时间',
          type: 'datetime',
          required: true,
          placeholder: 'YYYY-MM-DD HH:mm',
        },
      ]
    default:
      return []
  }
}

function buildDeviceCommands(device: IotDevice): IotDeviceCommandDefinition[] {
  const product = getProductTemplate(device.productKey)
  const commandPoints = (product?.dataPoints ?? []).filter((point) => point.kind === 'command')
  const reachable = device.status === 'online' || device.status === 'alarm'
  return commandPoints.map((point) => ({
    id: point.key ?? point.name,
    name: point.name,
    identifier: point.key ?? point.name,
    description: point.desc,
    category: commandCategory(point),
    riskLevel: commandRisk(point),
    callMode: point.key === 'recordQuery' ? 'async' : 'sync',
    inputParams: commandParams(point),
    outputParams: point.key === 'recordQuery' ? [] : [{
      key: 'result',
      name: t('IotDeviceDetail.commandCenter.outputResult'),
      type: 'string',
      required: false,
    }],
    outputDescription: point.key === 'recordQuery' ? '返回命中的录像片段数量和查询状态。' : '返回设备确认、执行状态和链路记录。',
    enabled: reachable,
    disabledReason: reachable ? undefined : '设备当前不可达，暂不能下发指令。',
  }))
}

function validateCommandParams(command: IotDeviceCommandDefinition, params: Record<string, string | number | boolean>) {
  const missing = command.inputParams.filter((param) => {
    if (!param.required) return false
    const value = params[param.key]
    return value === undefined || value === ''
  })
  return missing.map((param) => param.name)
}

function buildCommandExecution(
  device: IotDevice,
  command: IotDeviceCommandDefinition,
  params: Record<string, string | number | boolean>,
): IotDeviceCommandExecution {
  const requestId = `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const waiting = device.status === 'offline' || device.status === 'no-data'
  const status: IotDeviceCommandExecutionStatus = waiting ? 'waiting' : 'success'
  const executedAt = '刚刚'
  const request = {
    deviceId: device.identifier,
    productKey: device.productKey,
    function: command.identifier,
    params,
  }
  const response = waiting
    ? { status: 'waiting', message: '设备当前不可达，指令已进入等待队列。' }
    : { status: 'ack', message: `${command.name}已被设备确认。` }

  return {
    id: requestId,
    commandId: command.id,
    commandName: command.name,
    identifier: command.identifier,
    status,
    requestId,
    executedAt,
    duration: waiting ? '-' : command.callMode === 'async' ? '已受理' : '86ms',
    summary: waiting ? '设备当前不可达，指令等待下一次连接恢复。' : `${command.name}执行完成，链路记录已归档。`,
    requestPayload: JSON.stringify(request, null, 2),
    responsePayload: JSON.stringify(response, null, 2),
    steps: [
      {
        id: `${requestId}-model`,
        title: '物模型校验',
        node: device.productName,
        status: 'success',
        happenedAt: executedAt,
        content: `已按 ${command.identifier} 校验功能与参数。`,
      },
      {
        id: `${requestId}-queue`,
        title: '写入下行队列',
        node: device.gatewayName ?? device.accessMode,
        status,
        happenedAt: executedAt,
        content: waiting ? '设备未建立有效连接，等待恢复后继续投递。' : '指令已写入下行队列并投递到接入通道。',
      },
      {
        id: `${requestId}-ack`,
        title: waiting ? '等待设备响应' : '设备响应',
        node: device.name,
        status,
        happenedAt: executedAt,
        content: waiting ? '尚未收到设备 ACK。' : '设备返回 ACK，执行结果已同步到设备日志。',
      },
    ],
  }
}

export function createIotDeviceMockAdapter(): IotDeviceAdapter {
  /* 每个 projectId 一份 todo store，session 内持久。
     第一阶段不写 localStorage（避免噪声），刷新页面即重置。 */
  const todoStores = new Map<string, TodoStore>()

  function getTodoStore(projectId: string): TodoStore {
    let store = todoStores.get(projectId)
    if (!store) {
      store = createTodoStore()
      todoStores.set(projectId, store)
    }
    return store
  }

  function buildTodos(projectId: string, devices: IotDevice[], insights: IotDeviceInsight[]) {
    return applyTodoStore(deriveTodos(insights, devices), getTodoStore(projectId))
  }

  async function findTodo(projectId: string, todoId: string): Promise<IotDeviceTodo | null> {
    const devicesResult = await getVisibleProjectDevices(projectId)
    if (!devicesResult.ok) return null
    const insights = createInsights(devicesResult.data)
    return buildTodos(projectId, devicesResult.data, insights).find((todo) => todo.id === todoId) ?? null
  }

  return {
    async getWorkbench(filters) {
      const projectDevicesResult = await getVisibleProjectDevices(filters.projectId)
      if (!projectDevicesResult.ok) return projectDevicesResult
      const projectDevices = projectDevicesResult.data
      const devices = filterDevices(projectDevices, filters).map(cloneDevice)
      const insights = createInsights(projectDevices)
      const todos = buildTodos(filters.projectId, projectDevices, insights)
      return ok({
        devices,
        insights,
        todos,
        summary: buildSummary(projectDevices),
        facets: {
          areas: unique(projectDevices.map((item) => item.area)),
          productNames: unique(projectDevices.map((item) => item.productName)),
          owners: unique(projectDevices.map((item) => item.owner)),
        },
      })
    },

    async acceptTodo(projectId, todoId) {
      const store = getTodoStore(projectId)
      const todo = await findTodo(projectId, todoId)
      if (!todo) return err('NOT_FOUND', '未找到该待办', { projectId, todoId })
      store.source.set(todoId, 'manual')
      appendTodoRecord(store, todoId, todo.ownerLabel, '接手处理')
      const next = await findTodo(projectId, todoId)
      return next ? ok(next) : err('NOT_FOUND', '待办状态写入失败', { projectId, todoId })
    },

    async completeTodo(projectId, todoId, action) {
      const store = getTodoStore(projectId)
      const todo = await findTodo(projectId, todoId)
      if (!todo) return err('NOT_FOUND', '未找到该待办', { projectId, todoId })
      store.status.set(todoId, mapTodoStatusFromAction(action))
      appendTodoRecord(store, todoId, todo.ownerLabel, action ?? '已处理')
      const next = await findTodo(projectId, todoId)
      return next ? ok(next) : err('NOT_FOUND', '待办状态写入失败', { projectId, todoId })
    },

    async snoozeTodo(projectId, todoId, action) {
      const store = getTodoStore(projectId)
      const todo = await findTodo(projectId, todoId)
      if (!todo) return err('NOT_FOUND', '未找到该待办', { projectId, todoId })
      store.status.set(todoId, 'snoozed')
      appendTodoRecord(store, todoId, todo.ownerLabel, action ?? '暂缓处理')
      const next = await findTodo(projectId, todoId)
      return next ? ok(next) : err('NOT_FOUND', '待办状态写入失败', { projectId, todoId })
    },

    async dismissTodo(projectId, todoId) {
      const store = getTodoStore(projectId)
      store.dismissed.add(todoId)
      return ok({ id: todoId })
    },

    async resetProjectData(projectId) {
      const seedDevices = createIotDeviceSeed().filter((device) => device.projectId === projectId)
      if (!seedDevices.length) return err('NOT_FOUND', '未找到项目物联设备 seed', { projectId })

      DEVICES.splice(
        0,
        DEVICES.length,
        ...seedDevices,
        ...DEVICES.filter((device) => device.projectId !== projectId),
      )
      todoStores.delete(projectId)

      return ok({
        projectId,
        resetAt: new Date().toISOString(),
        deviceCount: seedDevices.length,
        deviceIds: seedDevices.map((device) => device.id),
      })
    },

    async getGroups(projectId, basis = 'area') {
      const devicesResult = await getVisibleProjectDevices(projectId)
      if (!devicesResult.ok) return devicesResult
      const devices = devicesResult.data
      const groups = createGroups(projectId, basis, devices)
      const coveredDeviceIds = new Set(groups.flatMap((group) => group.deviceIds))
      return ok({
        groups,
        devices: devices.map(cloneDevice),
        summary: {
          totalGroups: groups.length,
          coveredDevices: coveredDeviceIds.size,
          urgentGroups: groups.filter((group) => group.summary.urgent > 0).length,
          suggestedGroups: groups.filter((group) => group.basis === 'scene' || group.basis === 'scenario').length,
        },
      })
    },

    async getGroupDetail(projectId, groupId) {
      const allDevicesResult = await getVisibleProjectDevices(projectId)
      if (!allDevicesResult.ok) return allDevicesResult
      const allDevices = allDevicesResult.data

      const areaTreeAreaId = parseAreaTreeGroupId(groupId)
      if (areaTreeAreaId) {
        const areaSettingsResult = await projectAreaAdapter.getSettings(projectId)
        if (!areaSettingsResult.ok) return err('NOT_FOUND', '未找到项目区域配置', { projectId, groupId })
        const area = areaSettingsResult.data.areas.find((item) => item.id === areaTreeAreaId)
        if (!area) return err('NOT_FOUND', '未找到该区域', { projectId, groupId, areaId: areaTreeAreaId })

        const areaIds = collectAreaClosureIds(areaTreeAreaId, areaSettingsResult.data.areas)
        const groupDevices = allDevices.filter((device) => device.areaId && areaIds.has(device.areaId))
        const group = createAreaTreeGroup(projectId, area, groupDevices)
        return ok({
          group,
          devices: groupDevices.map(cloneDevice),
          aggregates: buildGroupAggregates(groupDevices),
          ruleStats: buildGroupRuleStats(groupDevices),
        })
      }

      const basis = parseBasisFromGroupId(groupId)
      if (!basis) return err('NOT_FOUND', '未识别的分组 id', { groupId })
      const groups = createGroups(projectId, basis, allDevices)
      const group = groups.find((g) => g.id === groupId)
      if (!group) return err('NOT_FOUND', '未找到该分组', { projectId, groupId })
      const groupDevices = allDevices.filter((d) => group.deviceIds.includes(d.id))
      return ok({
        group,
        devices: groupDevices.map(cloneDevice),
        aggregates: buildGroupAggregates(groupDevices),
        ruleStats: buildGroupRuleStats(groupDevices),
      })
    },

    async notifyGroupOwners(projectId, groupId) {
      const basis = parseBasisFromGroupId(groupId)
      if (!basis) return err('NOT_FOUND', '未识别的分组 id', { groupId })
      const allDevicesResult = await getVisibleProjectDevices(projectId)
      if (!allDevicesResult.ok) return allDevicesResult
      const allDevices = allDevicesResult.data
      const groups = createGroups(projectId, basis, allDevices)
      const group = groups.find((g) => g.id === groupId)
      if (!group) return err('NOT_FOUND', '未找到该分组', { projectId, groupId })
      const groupDevices = allDevices.filter((d) => group.deviceIds.includes(d.id))
      const owners = unique(groupDevices.map((d) => d.owner).filter(Boolean))
      /* mock 批量通知，不真发消息 */
      return ok({ owners, sentAt: new Date().toISOString() })
    },

    async notifyDeviceOwners(projectId, deviceIds) {
      const allDevicesResult = await getVisibleProjectDevices(projectId)
      if (!allDevicesResult.ok) return allDevicesResult
      const requestedIds = new Set(deviceIds)
      const devices = allDevicesResult.data.filter((device) => requestedIds.has(device.id))
      const owners = unique(devices.map((device) => device.owner).filter(Boolean))
      /* mock 批量通知，不真发消息 */
      return ok({ owners, sentAt: new Date().toISOString() })
    },

    async getHealthList(projectId) {
      const devicesResult = await getVisibleProjectDevices(projectId)
      if (!devicesResult.ok) return devicesResult
      const devices = devicesResult.data
      return ok(buildHealthListView(devices))
    },

    async getDeviceHealthDiagnosis(projectId, deviceId) {
      const allDevicesResult = await getVisibleProjectDevices(projectId)
      if (!allDevicesResult.ok) return allDevicesResult
      const allDevices = allDevicesResult.data
      const device = allDevices.find((item) => item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      return ok(buildDeviceHealthDiagnosis(device, allDevices))
    },

    async copyHealthAdvice(projectId, deviceId) {
      const allDevicesResult = await getVisibleProjectDevices(projectId)
      if (!allDevicesResult.ok) return allDevicesResult
      const allDevices = allDevicesResult.data
      const device = allDevices.find((item) => item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      const advice = buildAdviceSection(device)
      const text = [advice.conclusion, '', '建议：', ...advice.bullets.map((b) => `- ${b}`), '', '依据：', ...advice.evidence.map((e) => `- ${e}`)].join('\n')
      return ok({ text })
    },

    async notifyOwner(projectId, deviceId) {
      const allDevicesResult = await getVisibleProjectDevices(projectId)
      if (!allDevicesResult.ok) return allDevicesResult
      const allDevices = allDevicesResult.data
      const device = allDevices.find((item) => item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      /* 第一阶段是 mock 通知，不真发消息（决议见 module-iot.md §设备健康 §处置建议） */
      return ok({ owner: device.owner, sentAt: new Date().toISOString() })
    },

    async createDevice(input) {
      if (!input.name.trim()) return err('VALIDATION_FAILED', '请填写设备名')
      if (!input.areaId.trim()) return err('VALIDATION_FAILED', '请选择区域')
      if (!input.area.trim()) return err('VALIDATION_FAILED', '请填写区域')
      if (!input.location.trim()) return err('VALIDATION_FAILED', '请填写位置')
      if (!input.scenario.trim()) return err('VALIDATION_FAILED', '请选择业务场景')
      if (!input.owner.trim()) return err('VALIDATION_FAILED', '请选择责任角色')
      if (!input.productKey.trim()) return err('VALIDATION_FAILED', '请选择产品')
      const product = getProductTemplate(input.productKey)
      const accessMeta = product?.supportedModels[0]
      const identifier = generateDeviceIdentifier({
        projectId: input.projectId,
        productKey: input.productKey,
        areaId: input.areaId,
      })
      const newDevice: IotDevice = {
        id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId: input.projectId,
        name: input.name.trim(),
        productName: product?.name ?? '未关联产品',
        productKey: input.productKey,
        deviceType: getDeviceTypeLabel(product?.category),
        areaId: input.areaId.trim(),
        area: input.area.trim(),
        location: input.location.trim(),
        owner: input.owner.trim(),
        status: 'online',
        risk: 'normal',
        lastSeen: '刚刚',
        accessMode: accessMeta?.accessName ?? product?.accessName ?? '默认接入',
        gatewayName: undefined,
        identifier,
        imageUrl: input.imageUrl,
        summary: '新加入设备，等待首次稳定运行观察。',
        aiSummary: {
          conclusion: '设备刚加入项目，建议保留 24 小时观察期。',
          reasons: ['尚未形成连续上报基线', '规则覆盖待业务负责人确认'],
          actions: ['等待首次心跳与基础上报', '24 小时后复核稳定性'],
          evidence: ['刚刚加入'],
        },
        telemetry: [],
        alarms: [],
        logs: [],
        rules: [],
        relations: [
          { label: '业务场景', value: input.scenario.trim(), hint: '用于业务场景分组与筛选' },
          { label: '所在空间', value: `${input.area.trim()} · ${input.location.trim()}`, hint: '业务部署位置' },
          ...(input.imageUrl ? [{ label: '设备图片', value: '已上传', hint: input.imageUrl }] : []),
        ],
        tags: unique([input.scenario.trim(), ...(input.tags ? [...input.tags] : [])]),
      }
      DEVICES.unshift(newDevice)
      return ok(cloneDevice(newDevice))
    },

    async getDevice(projectId, deviceId) {
      const devicesResult = await getVisibleProjectDevices(projectId)
      if (!devicesResult.ok) return devicesResult
      const device = devicesResult.data.find((item) => item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      return ok(cloneDevice(device))
    },

    async listDeviceCommands(projectId, deviceId) {
      const devicesResult = await getVisibleProjectDevices(projectId)
      if (!devicesResult.ok) return devicesResult
      const device = devicesResult.data.find((item) => item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      return ok(buildDeviceCommands(device))
    },

    async executeDeviceCommand(input) {
      const devicesResult = await getVisibleProjectDevices(input.projectId)
      if (!devicesResult.ok) return devicesResult
      const device = devicesResult.data.find((item) => item.id === input.deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId: input.projectId, deviceId: input.deviceId })
      const command = buildDeviceCommands(device).find((item) => item.id === input.commandId)
      if (!command) return err('NOT_FOUND', '未找到该功能', { commandId: input.commandId })
      const missing = validateCommandParams(command, input.params)
      if (missing.length) return err('VALIDATION_FAILED', `请填写${missing.join('、')}`)
      return ok(buildCommandExecution(device, command, input.params))
    },

    async setDeviceEnabled(projectId, deviceId, enabled) {
      const device = DEVICES.find((item) => item.projectId === projectId && item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })

      if (enabled) {
        device.connectionStatus = 'online'
        device.status = 'online'
        device.risk = 'normal'
        device.lastSeen = '刚刚'
        device.businessStatuses = device.businessStatuses?.filter((status) => status !== 'maintenance')
        device.summary = '设备已启用，等待下一次稳定上报。'
      } else {
        device.connectionStatus = 'disabled'
        device.status = 'disabled'
        device.risk = 'normal'
        device.businessStatuses = []
        device.lastSeen = '已禁用'
        device.summary = '设备已禁用，不参与当前运行态势与告警判断。'
      }

      return ok(cloneDevice(device))
    },

    async deleteDevice(projectId, deviceId) {
      const index = DEVICES.findIndex((item) => item.projectId === projectId && item.id === deviceId)
      if (index < 0) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      DEVICES.splice(index, 1)
      return ok({ id: deviceId })
    },

    async runNaturalLanguageFilter(projectId, text) {
      if (!text.trim()) return err('VALIDATION_FAILED', '请输入要查找的设备范围')
      const devicesResult = await getVisibleProjectDevices(projectId)
      if (!devicesResult.ok) return devicesResult
      return ok(deriveNaturalCriteria(projectId, text.trim(), devicesResult.data))
    },

    async diagnoseDevice(projectId, deviceId) {
      const devicesResult = await getVisibleProjectDevices(projectId)
      if (!devicesResult.ok) return devicesResult
      const device = devicesResult.data.find((item) => item.id === deviceId)
      if (!device) return err('NOT_FOUND', '未找到该设备', { projectId, deviceId })
      return ok({
        deviceId,
        title: `${device.name} · AI 诊断`,
        conclusion: device.aiSummary.conclusion,
        possibleCauses: [...device.aiSummary.reasons],
        nextActions: [...device.aiSummary.actions],
        evidence: [...device.aiSummary.evidence],
      })
    },
  }
}
