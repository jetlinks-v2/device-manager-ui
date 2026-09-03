import type {
  AiModelDetail,
  EdgeGatewayCvOverviewResponse,
  EdgeGatewayModelDeploymentItem,
  GatewayCvModelItem,
  GatewayCvModelRuntimeFormatKind,
  GatewayCvModelSummary,
  MaybeEnumValue,
  ModelVersionDiffFile,
  ModelVersionInfo,
  ModelVersionRecord,
} from '../gatewayCvModel.types'

const EMPTY_TEXT = '--'

export type ModelVersionDiffAction = 'added' | 'changed' | 'removed' | 'reused'

export type ModelVersionDiffRow = ModelVersionDiffFile & {
  action: ModelVersionDiffAction
  filePath: string
  formatText: string
  rowId: string
}

export function textValue(...values: unknown[]) {
  const value = values.find(item => item !== undefined && item !== null && String(item).trim())
  return value === undefined ? undefined : String(value)
}

export function enumValue(value: MaybeEnumValue | undefined) {
  if (value && typeof value === 'object') return textValue(value.value)
  return textValue(value)
}

export function enumText(value: MaybeEnumValue | undefined) {
  if (value && typeof value === 'object') return textValue(value.text, value.value)
  return textValue(value)
}

export function normalizeVersionInfo(input?: Partial<ModelVersionInfo> | ModelVersionRecord[]): ModelVersionInfo {
  if (Array.isArray(input)) {
    return {
      versions: input.filter(hasVersionIdentity),
      histories: [],
    }
  }

  return {
    current: normalizeCurrentVersion(input?.current ?? input?.currentVersion),
    currentVersion: textValue(input?.currentVersion),
    versions: Array.isArray(input?.versions) ? input.versions.filter(hasVersionIdentity) : [],
    histories: Array.isArray(input?.histories) ? input.histories : [],
  }
}

function normalizeCurrentVersion(current: ModelVersionInfo['current']) {
  if (current && typeof current === 'object') {
    return hasVersionIdentity(current) ? current : undefined
  }
  return textValue(current)
}

export function currentVersionKey(current: ModelVersionInfo['current']) {
  if (!current) return undefined
  return typeof current === 'object' ? versionIdentity(current) : textValue(current)
}

export function versionIdentity(version?: ModelVersionRecord) {
  return textValue(version?.version)
}

export function findCurrentVersion(versionInfo: ModelVersionInfo): ModelVersionRecord | undefined {
  if (versionInfo.current && typeof versionInfo.current === 'object' && hasVersionIdentity(versionInfo.current)) {
    return versionInfo.current
  }

  const currentKey = currentVersionKey(versionInfo.current) || textValue(versionInfo.currentVersion)
  if (currentKey) {
    const matched = versionInfo.versions.find(version => versionIdentity(version) === currentKey)
    if (matched) return matched
  }
  return versionInfo.versions[0]
}

export function formatVersion(value: unknown) {
  const text = textValue(value)
  return text ? `v${text.replace(/^v/i, '')}` : EMPTY_TEXT
}

export function formatBytes(value: unknown) {
  const size = Number(value)
  if (!Number.isFinite(size) || size < 0) return EMPTY_TEXT
  if (size === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let output = size
  let index = 0
  while (output >= 1024 && index < units.length - 1) {
    output /= 1024
    index += 1
  }

  const text = output >= 10 || Number.isInteger(output)
    ? String(Math.round(output * 10) / 10).replace(/\.0$/, '')
    : output.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${text} ${units[index]}`
}

export function sumVersionFilesSize(version?: ModelVersionRecord) {
  const files = version?.files?.length ? version.files : version?.modelFiles
  if (!files?.length) return undefined
  const total = files.reduce((sum, file) => {
    const size = Number(file.size)
    return Number.isFinite(size) && size > 0 ? sum + size : sum
  }, 0)
  return total
}

export function runtimeFormatKind(model: AiModelDetail): GatewayCvModelRuntimeFormatKind {
  return model.driverId === 'zlmedia' && model.loadType === 'package_model'
    ? 'zlmediaPackage'
    : 'unknown'
}

export function formatDateTime(value: unknown) {
  if (!value) return EMPTY_TEXT
  const date = new Date(typeof value === 'number' ? value : String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function buildGatewayCvModelItem(
  model: AiModelDetail,
  versionInput?: Partial<ModelVersionInfo> | ModelVersionRecord[],
  usedSourceCount = 0,
): GatewayCvModelItem {
  const versionSource = withModelCurrentVersion(model, versionInput)
  const versionInfo = normalizeVersionInfo(versionSource)
  const currentVersion = findCurrentVersion(versionInfo)
  const currentSizeBytes = sumVersionFilesSize(currentVersion)
  const currentVersionValue = textValue(
    currentVersion?.version,
    versionInfo.currentVersion,
    currentVersionKey(versionInfo.current),
    model.currentVersion,
  )
  const usesDefaultVersion = !currentVersionValue
    && model.loadType === 'from_driver'
    && versionInfo.versions.length === 0
  const formatKind = runtimeFormatKind(model)

  return {
    id: textValue(model.id) || '',
    name: textValue(model.name, model.id) || EMPTY_TEXT,
    model,
    versionInfo,
    currentVersion,
    currentVersionValue,
    currentVersionText: formatVersion(currentVersionValue),
    usesDefaultVersion,
    currentSizeText: formatBytes(currentSizeBytes),
    currentSizeBytes,
    sceneName: textValue(model.taskTargetName, enumText(model.target)) || EMPTY_TEXT,
    runtimeFormatKind: formatKind,
    runtimeText: '',
    usedSourceCount: Math.max(0, Number(usedSourceCount) || 0),
    historyVersionCount: versionInfo.versions.length,
    stateValue: enumValue(model.state) || '',
    stateText: enumText(model.state) || EMPTY_TEXT,
    taskTarget: textValue(model.taskTarget, model.target && typeof model.target === 'object' ? model.target.value : model.target),
    edgeVersion: currentVersionValue,
    platformVersion: undefined,
    upgradeable: false,
    candidateVersionText: EMPTY_TEXT,
  }
}

function withModelCurrentVersion(
  model: AiModelDetail,
  versionInput?: Partial<ModelVersionInfo> | ModelVersionRecord[],
): Partial<ModelVersionInfo> | ModelVersionRecord[] | undefined {
  if (Array.isArray(versionInput)) {
    return {
      current: model.versionInfo?.current ?? model.versionInfo?.currentVersion ?? model.currentVersion,
      currentVersion: model.versionInfo?.currentVersion ?? model.currentVersion,
      versions: versionInput,
    }
  }

  const source = versionInput || model.versionInfo
  if (!source) return undefined

  return {
    ...source,
    // 历史版本接口只补充版本行；卡片仍以边端模型详情中的 currentVersion 作为当前运行兜底。
    current: source.current ?? source.currentVersion ?? model.versionInfo?.current ?? model.versionInfo?.currentVersion ?? model.currentVersion,
    currentVersion: source.currentVersion ?? model.versionInfo?.currentVersion ?? model.currentVersion,
  }
}

export function normalizeGatewayCvOverview(input?: EdgeGatewayCvOverviewResponse): GatewayCvModelSummary {
  return {
    onlineCameraCount: positiveNumber(input?.onlineCameraCount),
    deployedModelCount: positiveNumber(input?.deployedModelCount),
    upgradableCount: positiveNumber(input?.upgradableCount),
  }
}

export function buildGatewayCvOverviewFromItems(items: GatewayCvModelItem[]): GatewayCvModelSummary {
  return {
    onlineCameraCount: items.reduce((total, item) => total + positiveNumber(item.usedSourceCount), 0),
    deployedModelCount: items.length,
    upgradableCount: items.filter(item => item.upgradeable).length,
  }
}

export function buildGatewayCvModelItemFromDeployment(deployment: EdgeGatewayModelDeploymentItem): GatewayCvModelItem {
  const modelId = textValue(deployment.modelId) || ''
  const stateValue = enumValue(deployment.modelState) || ''
  const stateText = enumText(deployment.modelState) || stateValue || EMPTY_TEXT
  const edgeVersion = textValue(deployment.edgeVersion)
  const platformVersion = textValue(deployment.platformVersion)
  const currentSizeBytes = numberValue(deployment.currentSize)

  return {
    id: modelId,
    name: textValue(deployment.modelName, deployment.modelId) || EMPTY_TEXT,
    model: {
      id: modelId,
      name: textValue(deployment.modelName),
      currentVersion: edgeVersion,
      taskTarget: textValue(deployment.taskTarget),
      taskTargetName: textValue(deployment.usageScene),
      state: deployment.modelState,
    },
    deployment,
    versionInfo: emptyVersionInfo(),
    taskTarget: textValue(deployment.taskTarget),
    edgeVersion,
    platformVersion,
    upgradeable: deployment.upgradeable === true,
    candidateVersionText: formatVersion(platformVersion),
    currentVersionValue: edgeVersion,
    currentVersionText: formatVersion(edgeVersion),
    currentSizeText: formatBytes(currentSizeBytes),
    currentSizeBytes,
    sceneName: textValue(deployment.usageScene) || EMPTY_TEXT,
    runtimeFormatKind: 'unknown',
    runtimeText: textValue(deployment.runtimeDisplay) || EMPTY_TEXT,
    usedSourceCount: positiveNumber(deployment.usedCameraCount),
    historyVersionCount: 0,
    stateValue,
    stateText,
  }
}

export function versionChangedTotal(version: ModelVersionRecord) {
  const changed = version.changed
  return (changed?.added?.length || 0)
    + (changed?.modified?.length || 0)
    + (changed?.deleted?.length || 0)
    + (changed?.noop?.length || 0)
}

export function hasModelVersionDiffDetails(version: ModelVersionRecord) {
  return buildModelVersionDiffRows(version).length > 0
}

export function buildModelVersionDiffRows(version: ModelVersionRecord): ModelVersionDiffRow[] {
  return [
    ...toVersionDiffRows(version.addedFiles, 'added'),
    ...toVersionDiffRows(version.changedFiles, 'changed'),
    ...toVersionDiffRows(version.removedFiles, 'removed'),
    ...toVersionDiffRows(version.reusedFiles, 'reused'),
  ]
}

function toVersionDiffRows(files: ModelVersionDiffFile[] | undefined, action: ModelVersionDiffAction): ModelVersionDiffRow[] {
  return (files || []).map((file, index) => {
    const filePath = displayVersionDiffFilePath(file)
    return {
      ...file,
      action,
      filePath,
      formatText: formatVersionDiffFileFormat(file.format),
      rowId: `${action}:${file.fileKey || filePath}:${index}`,
    }
  })
}

function displayVersionDiffFilePath(file: ModelVersionDiffFile) {
  const path = file.path?.trim()
  const name = file.name?.trim()
  if (path && name && path.endsWith(name)) return path
  if (path && name && path !== name) return path.endsWith('/') ? `${path}${name}` : `${path}/${name}`
  return path || name || file.fileKey || EMPTY_TEXT
}

function formatVersionDiffFileFormat(format: ModelVersionDiffFile['format']) {
  if (Array.isArray(format)) return format.filter(Boolean).join(' / ') || EMPTY_TEXT
  return textValue(format) || EMPTY_TEXT
}

function hasVersionIdentity(value: ModelVersionRecord | undefined): value is ModelVersionRecord {
  return Boolean(versionIdentity(value))
}

function emptyVersionInfo(): ModelVersionInfo {
  return { versions: [], histories: [] }
}

function positiveNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
