import { request } from '@jetlinks-web/core'
import { err, ok, type ServiceResult } from '@jetlinks-web-core/utils/service-result'
import {
  DEFAULT_MODEL_PAGE_SIZE,
  emptyVersionInfo,
  unwrapResult,
  unwrapRows,
} from './gatewayCvModelRequest'
import type {
  AiModelDetail,
  EdgeGatewayModelUpgradeCheckResult,
  EdgeGatewayModelUpgradeUnsupportedReason,
  ModelVersionInfo,
  ModelVersionRecord,
  RuntimeGatewayDevice,
} from '../gatewayCvModel.types'

const AI_MODEL_COMMAND_SERVICE_ID = 'aiService:modelManager'
const AI_MODEL_COMMANDS = {
  versionDiff: 'QueryModelVersionDiff',
  rollback: 'RollbackModel',
  clean: 'CleanModelVersion',
} as const

type GatewayAiModelCommandId = typeof AI_MODEL_COMMANDS[keyof typeof AI_MODEL_COMMANDS]
type ModelVersionCommandResult = ModelVersionRecord | string | number | Array<ModelVersionRecord | string | number>

interface EdgeCommandBatchResult<T = unknown> {
  requestId?: string
  commandId?: string
  deviceId?: string
  success?: boolean
  message?: string
  result?: T
}

export async function queryCvModels(gateway: RuntimeGatewayDevice): Promise<ServiceResult<AiModelDetail[]>> {
  const proxyPath = edgeProxyPath(gateway)
  if (!proxyPath) return ok([])

  // 运行时已处于项目接口上下文，直接代理到当前边端网关，不再请求运营端项目 token。
  const queryBody = {
    paging: false,
    pageIndex: 0,
    pageSize: DEFAULT_MODEL_PAGE_SIZE,
    sorts: [{ name: 'createTime', order: 'desc' }],
  }

  try {
    const response = await request.post(
      `${proxyPath}/ai/model/detail/_query`,
      queryBody,
    )

    return ok(unwrapRows<AiModelDetail>(response).filter(item => Boolean(item.id)))
  } catch (error) {
    return err('NETWORK', 'cv_models_query_failed', error)
  }
}

export async function queryModelVersions(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<ModelVersionInfo>> {
  if (!modelId) return ok(emptyVersionInfo())

  try {
    // 历史版本是边端本地模型事实，避免依赖云端模型库存在同 ID 模型。
    const rows = await executeGatewayAiModelCommand<ModelVersionCommandResult>(
      gateway,
      AI_MODEL_COMMANDS.versionDiff,
      { modelId },
      true,
    )
    if (!rows.ok) return err(rows.error.code, rows.error.message, rows.error.detail)
    const versions = rows.data.flatMap((row): Array<ModelVersionRecord | string | number> => {
      const result = row.result
      if (Array.isArray(result)) return result
      return result === undefined || result === null ? [] : [result]
    })
    return ok(normalizeVersionInfoResponse(versions))
  } catch (error) {
    return err('NETWORK', 'cv_model_versions_query_failed', error)
  }
}

export async function enableCvModel(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<void>> {
  return updateCvModelState(gateway, modelId, 'enable')
}

export async function disableCvModel(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<void>> {
  return updateCvModelState(gateway, modelId, 'disable')
}

export async function checkCvModelUpgrade(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<EdgeGatewayModelUpgradeCheckResult>> {
  if (!modelId) return ok(emptyUpgradeCheckResult(modelId))

  const gatewayId = runtimeGatewayId(gateway)
  if (!gatewayId) return ok(emptyUpgradeCheckResult(modelId))

  try {
    // 检查升级由运行时 AI-edge 编排：平台包与网关文件差异在后端计算，后端再代理网关命令。
    const response = await request.post(
      `${aiModelUpgradePath(gatewayId, modelId)}/_check-upgrade`,
      {},
      {
        timeout: 120_000,
      },
    )
    return ok(unwrapResult<EdgeGatewayModelUpgradeCheckResult>(response) || emptyUpgradeCheckResult(modelId))
  } catch (error) {
    const unsupportedReason = resolveUpgradeUnsupportedReason(error)
    if (unsupportedReason) return ok(unsupportedUpgradeCheckResult(modelId, unsupportedReason))
    return err('NETWORK', 'cv_model_check_upgrade_failed', error)
  }
}

export async function upgradeCvModel(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<void>> {
  if (!modelId) return ok(undefined)

  const gatewayId = runtimeGatewayId(gateway)
  if (!gatewayId) return ok(undefined)

  try {
    await request.post(
      `${aiModelUpgradePath(gatewayId, modelId)}/_upgrade`,
      {},
      {
        timeout: 120_000,
      },
    )
    return ok(undefined)
  } catch (error) {
    return err('NETWORK', 'cv_model_upgrade_failed', error)
  }
}

export async function rollbackModelVersion(
  gateway: RuntimeGatewayDevice,
  modelId: string,
  version: string | number,
): Promise<ServiceResult<ModelVersionRecord | undefined>> {
  if (!modelId || !version) return ok(undefined)

  try {
    const rows = await executeGatewayAiModelCommand<ModelVersionRecord>(
      gateway,
      AI_MODEL_COMMANDS.rollback,
      { modelId, version },
      false,
    )
    if (!rows.ok) return err(rows.error.code, rows.error.message, rows.error.detail)
    return ok(rows.data[0]?.result)
  } catch (error) {
    return err('NETWORK', 'cv_model_version_rollback_failed', error)
  }
}

export async function cleanModelVersion(
  gateway: RuntimeGatewayDevice,
  modelId: string,
  version: string | number,
): Promise<ServiceResult<ModelVersionRecord | undefined>> {
  if (!modelId || !version) return ok(undefined)

  try {
    const rows = await executeGatewayAiModelCommand<ModelVersionRecord>(
      gateway,
      AI_MODEL_COMMANDS.clean,
      { modelId, version },
      false,
    )
    if (!rows.ok) return err(rows.error.code, rows.error.message, rows.error.detail)
    return ok(rows.data[0]?.result)
  } catch (error) {
    return err('NETWORK', 'cv_model_version_clean_failed', error)
  }
}

async function updateCvModelState(
  gateway: RuntimeGatewayDevice,
  modelId: string,
  action: 'enable' | 'disable',
): Promise<ServiceResult<void>> {
  const proxyPath = edgeProxyPath(gateway)
  if (!proxyPath || !modelId) return ok(undefined)

  try {
    await request.post(
      `${proxyPath}/ai/model/${encodeURIComponent(modelId)}/${action}`,
      {},
      {
        timeout: 120_000,
      },
    )
    return ok(undefined)
  } catch (error) {
    return err('NETWORK', `cv_model_${action}_failed`, error)
  }
}

function aiModelUpgradePath(gatewayId: string, modelId: string) {
  return `/ai/edge/gateway/${encodeURIComponent(gatewayId)}/model/${encodeURIComponent(modelId)}`
}

function emptyUpgradeCheckResult(modelId: string): EdgeGatewayModelUpgradeCheckResult {
  return {
    modelId,
    upgradable: false,
    added: [],
    upgraded: [],
    removed: [],
    unchanged: [],
    filtered: [],
  }
}

function unsupportedUpgradeCheckResult(
  modelId: string,
  reason: EdgeGatewayModelUpgradeUnsupportedReason,
): EdgeGatewayModelUpgradeCheckResult {
  return {
    ...emptyUpgradeCheckResult(modelId),
    upgradeUnsupported: true,
    upgradeUnsupportedReason: reason,
  }
}

function resolveUpgradeUnsupportedReason(error: unknown): EdgeGatewayModelUpgradeUnsupportedReason | undefined {
  const errorText = collectErrorText(error)
  if (errorText.includes('error.ai_model_not_found')) return 'cloudModelMissing'
  if (errorText.includes('error.ai_model_package_model_required')) return 'packageModelRequired'
  return undefined
}

function collectErrorText(value: unknown, seen = new WeakSet<object>()): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  const chunks: string[] = []
  if (value instanceof Error) {
    chunks.push(value.name, value.message, collectErrorText((value as Error & { cause?: unknown }).cause, seen))
  }

  const body = value as Record<string, unknown>
  ;['code', 'message', 'detail', 'error', 'response', 'data', 'result', 'reason'].forEach((key) => {
    chunks.push(collectErrorText(body[key], seen))
  })
  return chunks.filter(Boolean).join(' ')
}

function normalizeVersionInfoResponse(input?: ModelVersionInfo | Array<ModelVersionRecord | string | number>): ModelVersionInfo {
  if (Array.isArray(input)) {
    const versions = input
      .filter(value => value !== undefined && value !== null && String(value).trim())
      .map(toVersionRecord)
      .sort((left, right) => Number(right.version) - Number(left.version))
    return {
      current: versions.find(version => version.current === true),
      currentVersion: versions.find(version => version.current === true)?.version,
      versions,
      histories: [],
    }
  }

  return input || emptyVersionInfo()
}

function toVersionRecord(input: ModelVersionRecord | string | number): ModelVersionRecord {
  if (input && typeof input === 'object') return input
  return { version: input }
}

async function executeGatewayAiModelCommand<T>(
  gateway: RuntimeGatewayDevice,
  commandId: GatewayAiModelCommandId,
  params: Record<string, unknown>,
  stream: boolean,
): Promise<ServiceResult<Array<EdgeCommandBatchResult<T>>>> {
  const gatewayId = runtimeGatewayId(gateway)
  if (!gatewayId) return ok([])

  const commandRequest = {
    thingType: 'device',
    thingId: gatewayId,
    requestId: AI_MODEL_COMMAND_SERVICE_ID,
    commandId,
    params,
  }

  try {
    // 模型版本能力在网关命令服务中，不能拼 edge 本地 HTTP `/ai/model/{id}/versions/**`。
    const response = await request.post(
      `/edge/command/_batch?stream=${stream}`,
      [commandRequest],
    )
    const rows = unwrapCommandBatchRows<T>(response)
    const failed = rows.find(row => row.success === false)
    if (failed) {
      return err('NETWORK', failed.message || `cv_model_command_${commandId}_failed`, failed)
    }
    return ok(rows)
  } catch (error) {
    return err('NETWORK', `cv_model_command_${commandId}_failed`, error)
  }
}

function unwrapCommandBatchRows<T>(response: unknown): Array<EdgeCommandBatchResult<T>> {
  const rows = unwrapRows<EdgeCommandBatchResult<T>>(response)
  if (rows.length) return rows

  const root = unwrapResult<unknown>(response)
  if (root && typeof root === 'object') {
    const body = root as Record<string, unknown>
    if (body.success !== undefined || body.result !== undefined || body.commandId !== undefined) {
      return [body as EdgeCommandBatchResult<T>]
    }
  }
  return []
}

function runtimeGatewayId(gateway: RuntimeGatewayDevice) {
  return gateway.id?.trim() || ''
}

function edgeProxyPath(gateway: RuntimeGatewayDevice) {
  const gatewayId = runtimeGatewayId(gateway)
  return gatewayId ? `/edge/device/${encodeURIComponent(gatewayId)}/_` : ''
}
