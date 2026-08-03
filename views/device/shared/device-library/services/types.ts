import type { ServiceResult } from '@device-manager-ui/views/device/shared/services/shared/serviceResult'

export type DeviceCategory =
  | 'video'
  | 'meter'
  | 'sensor'
  | 'industrial'
  | 'integration'

export type DeviceAccessMode =
  | 'direct'
  | 'edge'
  | 'gb28181'
  | 'collector'
  | 'third-party'

export type DeviceDataKind =
  | 'status'
  | 'telemetry'
  | 'event'
  | 'command'
  | 'video'
  | 'alarm'

export type DeviceMaintainSource = 'official' | 'partner' | 'community'

export type DeviceScenario =
  | 'video-inspection'
  | 'energy-metering'
  | 'environment'
  | 'industrial-collect'
  | 'system-sync'
  | 'commercial-ops'
  | 'fire-safety'
  | 'fuel-safety'
  | 'chemical-safety'
  | 'care-assist'
  | 'access-control'
  | 'data-center'

export type DeviceIndustry =
  | 'park'
  | 'energy'
  | 'security'
  | 'building'
  | 'manufacturing'
  | 'water'
  | 'commercial'
  | 'chemical'
  | 'care'
  | 'data-center'

export interface DeviceDataPoint {
  /** 物模型 key —— 与设备实例的 IotTelemetryPoint.key 对齐，用于关联 normalRange / isKeyMetric 等 */
  key?: string
  name: string
  desc: string
  kind: DeviceDataKind
  /** 是否作为业务关键指标（设备详情 / 设备健康右栏 / 设备总览 quick peek 优先展示）。 */
  isKeyMetric?: boolean
}

export type FaultCodeSeverity = 'info' | 'warning' | 'critical'

export interface FaultCodeEntry {
  /** 故障码标识（来自设备协议上报字段值，例：'E01' / '0x42'） */
  code: string
  /** 故障码在协议侧的字段名 / 寄存器地址 */
  protocolField: string
  /** 业务可读的故障名 */
  name: string
  severity: FaultCodeSeverity
  /** 业务可读故障原因（markdown，建议 ≤ 200 字） */
  cause: string
  /** 厂商推荐处置（markdown，建议 ≤ 200 字） */
  recommendedAction: string
  /** 关联的知识库条目 id（可读完整说明书） */
  knowledgeRefs?: string[]
}

export interface DeviceNormalRange {
  /** 点位 key，与 dataPoints 内某一项对应；点位名作为兜底展示 */
  pointKey: string
  /** 业务可读名 */
  name: string
  min?: number
  max?: number
  /** 同型号典型均值，用于设备健康横向对比 */
  typicalAvg?: number
  unit: string
  /** 业务说明（如"高于此值持续 30 分钟则视为偏离"） */
  hint?: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  /** markdown 正文 */
  body: string
  tags: string[]
}

export interface DeviceModelSupport {
  brand: string
  models: string[]
  note: string
  accessMode: DeviceAccessMode
  accessName: string
  connectionHint: string
  requirements: string[]
}

export interface DeviceTemplate {
  id: string
  name: string
  summary: string
  category: DeviceCategory
  scenarios: DeviceScenario[]
  industries: DeviceIndustry[]
  supportedBrands: string[]
  supportedModels: DeviceModelSupport[]
  modelKeywords: string[]
  deviceType: '直连设备' | '子设备'
  sourceProduct: string
  accessModes: DeviceAccessMode[]
  accessName: string
  connectionHint: string
  maintainedBy: DeviceMaintainSource
  readiness: 'ready' | 'testing' | 'needs-gateway'
  dataKinds: DeviceDataKind[]
  dataPoints: DeviceDataPoint[]
  requirements: string[]
  testSteps: string[]
  projectDefaults: string[]
  /* v2 字段（物联模块设备健康前置依赖，可选） */
  faultCodeDict?: FaultCodeEntry[]
  telemetryNormalRanges?: DeviceNormalRange[]
  knowledgeBase?: KnowledgeEntry[]
}

export interface AdapterBrand {
  brand: string
  models: string[]
  modelsPreview: string[]
  modelCount: number
  accessModes: DeviceAccessMode[]
  accessNames: string[]
  accessBusiness: string[]
  accessTech: string[]
  note: string
  connectionHint: string
  requirements: string[]
}

export interface AdapterGroup {
  id: string
  templateId: string
  family: string
  summary: string
  category: DeviceCategory
  accessMode: DeviceAccessMode
  accessModes: DeviceAccessMode[]
  accessName: string
  accessNames: string[]
  accessBusiness: string
  accessTech: string
  maintainedBy: DeviceMaintainSource
  industries: DeviceIndustry[]
  scenarios: DeviceScenario[]
  brands: AdapterBrand[]
  requirements: string[]
  testSteps: string[]
  dataKinds: DeviceDataKind[]
  dataPoints: DeviceDataPoint[]
  /* v2 字段（从 DeviceTemplate 透传，可选） */
  faultCodeDict?: FaultCodeEntry[]
  telemetryNormalRanges?: DeviceNormalRange[]
  knowledgeBase?: KnowledgeEntry[]
}

export interface AddToProjectInput {
  adapterId: string
  brand: string
  modelNames: string[]
  projectId: string
  accessMode?: DeviceAccessMode
}

export interface AddToProjectResult {
  taskId: string
  projectId: string
  templateId: string
  addedAt: string
}

export interface DeviceLibraryAdapter {
  listTemplates(): Promise<ServiceResult<DeviceTemplate[]>>
  getTemplate(id: string): Promise<ServiceResult<DeviceTemplate>>
  listProjectTemplates(projectId: string): Promise<ServiceResult<DeviceTemplate[]>>
  listAdapters(): Promise<ServiceResult<AdapterGroup[]>>
  getAdapter(id: string): Promise<ServiceResult<AdapterGroup>>
  addToProject(input: AddToProjectInput): Promise<ServiceResult<AddToProjectResult>>
}

