export type GatewayCvModelRuntimeFormatKind = 'zlmediaPackage' | 'unknown'

export interface RuntimeGatewayDevice {
  id?: string
  state?: MaybeEnumValue
  accessProvider?: string
}

export interface EnumDictValue<T extends string = string> {
  value?: T
  text?: string
}

export type MaybeEnumValue<T extends string = string> = T | EnumDictValue<T>

export interface AiModelDetail {
  id: string
  name?: string
  currentVersion?: string | number
  formats?: string[][]
  loadType?: string
  provider?: string
  driverId?: string
  driverName?: string
  domain?: MaybeEnumValue
  state?: MaybeEnumValue
  taskTarget?: string
  taskTargetName?: string
  target?: MaybeEnumValue
  description?: string
  createTime?: string | number
  others?: Record<string, unknown>
  versionInfo?: ModelVersionInfo
}

export interface ModelVersionFile {
  fileKey?: string
  path?: string
  name?: string
  slot?: string
  slotKey?: string
  fileRole?: string
  md5?: string
  size?: string | number
  modelVersion?: string | number
  format?: string | string[]
}

export interface ModelVersionChanged {
  added?: string[]
  modified?: string[]
  deleted?: string[]
  noop?: string[]
}

export interface ModelVersionDiffFile {
  fileKey?: string
  name?: string
  path?: string
  format?: string[] | string
  currentMd5?: string
  historyMd5?: string
}

export interface ModelVersionRecord {
  version?: string | number
  current?: boolean
  entry?: string
  operation?: string
  operationTime?: string | number
  createTime?: string | number
  operatorId?: string
  operatorName?: string
  sourceType?: string
  sourceFileUrl?: string
  changed?: ModelVersionChanged
  fileCount?: number
  addedCount?: number
  changedCount?: number
  removedCount?: number
  reusedCount?: number
  addedFiles?: ModelVersionDiffFile[]
  changedFiles?: ModelVersionDiffFile[]
  removedFiles?: ModelVersionDiffFile[]
  reusedFiles?: ModelVersionDiffFile[]
  files?: ModelVersionFile[]
  modelFiles?: ModelVersionFile[]
}

export interface ModelVersionHistoryRecord {
  version?: string | number
  operation?: string
  operationTime?: string | number
  operatorName?: string
}

export interface ModelVersionInfo {
  current?: string | number | ModelVersionRecord
  currentVersion?: string | number
  versions: ModelVersionRecord[]
  histories?: ModelVersionHistoryRecord[]
}

export interface EdgeGatewayModelSyncStatus {
  model?: AiModelDetail
  taskTarget?: string
  versionInfo?: ModelVersionInfo
}

export type EdgeGatewayModelUpgradeUnsupportedReason = 'cloudModelMissing' | 'packageModelRequired'

export interface EdgeGatewayModelUpgradeCheckResult {
  modelId?: string
  upgradable?: boolean
  upgradeUnsupported?: boolean
  upgradeUnsupportedReason?: EdgeGatewayModelUpgradeUnsupportedReason
  added?: ModelUpgradeFileDiff[]
  upgraded?: ModelUpgradeFileDiff[]
  removed?: ModelUpgradeFileDiff[]
  unchanged?: ModelUpgradeFileDiff[]
  filtered?: ModelUpgradeFileDiff[]
}

export interface ModelUpgradeFileDiff {
  fileKey?: string
  name?: string
  path?: string
  format?: string[] | string
  platformMd5?: string
  edgeMd5?: string
  size?: string | number
}

export interface EdgeGatewayCvOverviewResponse {
  onlineCameraCount?: number
  deployedModelCount?: number
  upgradableCount?: number
}

export interface EdgeGatewayModelDeploymentItem {
  modelId?: string
  modelName?: string
  taskTarget?: string
  edgeVersion?: string | number
  platformVersion?: string | number
  upgradeable?: boolean
  usedCameraCount?: number
  usageScene?: string
  currentSize?: string | number
  runtimeDisplay?: string
  modelState?: MaybeEnumValue
}

export interface EdgeGatewayModelUpgradeResult {
  modelId?: string
  taskTarget?: string
  success?: boolean
  errorMessage?: string
}

export interface EdgeGatewayModelUpgradeRequest {
  taskTarget?: string
}

export interface EdgeGatewayBatchModelUpgradeRequest {
  items?: Array<EdgeGatewayModelUpgradeRequest & { modelId?: string }>
}

export interface EdgeGatewayModelUsageCamera {
  deviceId?: string
  channelId?: string
  deviceName?: string
  online?: boolean
}

export interface EdgeGatewayModelUsageTask {
  id?: string
  name?: string
  taskId?: string
  taskName?: string
  sceneName?: string
}

export interface EdgeGatewayModelUsageResponse {
  modelId?: string
  taskTarget?: string
  cameras?: EdgeGatewayModelUsageCamera[]
  tasks?: EdgeGatewayModelUsageTask[]
}

export interface AiModelUsedSource {
  id?: string
  name?: string
  sourceId?: string
  sourceName?: string
  deviceId?: string
  deviceName?: string
  channelId?: string
  channelName?: string
  taskId?: string
  taskName?: string
  tasks?: EdgeGatewayModelUsageTask[]
  productName?: string
  count?: number
  [key: string]: unknown
}

export interface AiTaskSource {
  id?: string
  name?: string
  sourceId?: string
  sourceName?: string
  deviceId?: string
  deviceName?: string
  channelId?: string
  channelName?: string
  masterChannelId?: string
  masterChannelName?: string
  type?: string
  [key: string]: unknown
}

export interface AiTaskDetail {
  id?: string
  name?: string
  modelId?: string
  modelName?: string
  taskTarget?: string
  state?: MaybeEnumValue
  configuration?: {
    sources?: AiTaskSource[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface GatewayCvModelItem {
  id: string
  name: string
  model: AiModelDetail
  deployment?: EdgeGatewayModelDeploymentItem
  taskTarget?: string
  edgeVersion?: string | number
  platformVersion?: string | number
  upgradeable: boolean
  candidateVersionText: string
  runtimeText: string
  versionInfo: ModelVersionInfo
  currentVersion?: ModelVersionRecord
  currentVersionValue?: string
  currentVersionText: string
  usesDefaultVersion?: boolean
  currentSizeText: string
  currentSizeBytes?: number
  sceneName: string
  runtimeFormatKind: GatewayCvModelRuntimeFormatKind
  usedSourceCount: number
  historyVersionCount: number
  stateValue: string
  stateText: string
  upgradeCheckResult?: EdgeGatewayModelUpgradeCheckResult
}

export interface GatewayCvModelSummary {
  onlineCameraCount: number
  deployedModelCount: number
  upgradableCount: number
}

export interface GatewayCvModelUsedSourcePage {
  data: AiModelUsedSource[]
  total: number
  pageIndex: number
  pageSize: number
}

export type GatewayCvModelActionContext = {
  gateway: RuntimeGatewayDevice
  model: GatewayCvModelItem
  version: ModelVersionRecord
}

// 评估接口仍未提供，前端不从候选版本或来源描述中伪造评估指标。
export interface GatewayCvModelUpgradeCandidate {
  modelId: string
  targetVersion?: string | number
  platformModelId?: string
}
