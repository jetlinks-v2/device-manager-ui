import { request } from '@jetlinks-web/core'
import { err, ok, type ServiceResult } from '@jetlinks-web-core/utils/service-result'
import {
  textValue,
  unwrapRows,
} from './gatewayCvModelRequest'
import {
  toUsageCameras,
} from '../utils/gatewayCvModelUsageFormat'
import type {
  EdgeGatewayModelUsageResponse,
  AiModelUsedSource,
  AiTaskDetail,
  AiTaskSource,
  GatewayCvModelUsedSourcePage,
  RuntimeGatewayDevice,
} from '../gatewayCvModel.types'

type EdgeProxyContext = {
  gatewayId: string
  proxyPath: string
}

type PageQuery = {
  pageIndex?: number
  pageSize?: number
}

export async function queryGatewayCvModelUsage(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<EdgeGatewayModelUsageResponse>> {
  const context = runtimeEdgeProxyContext(gateway)
  if (!context || !modelId) return ok({ modelId, cameras: [], tasks: [] })

  const tasks = await queryModelTasks(gateway, modelId, context)
  if (!tasks.ok) return err(tasks.error.code, tasks.error.message, tasks.error.detail)
  return ok(tasksToUsageResponse(modelId, tasks.data))
}

export async function queryUsedSourceCount(
  gateway: RuntimeGatewayDevice,
  modelId: string,
): Promise<ServiceResult<number>> {
  const context = runtimeEdgeProxyContext(gateway)
  if (!context || !modelId) return ok(0)

  const tasks = await queryModelTasks(gateway, modelId, context)
  if (!tasks.ok) return err(tasks.error.code, tasks.error.message, tasks.error.detail)
  return ok(tasksToUsageResponse(modelId, tasks.data).cameras?.length ?? 0)
}

export async function queryModelUsedSourceCounts(
  gateway: RuntimeGatewayDevice,
  modelIds: string[],
): Promise<ServiceResult<Record<string, number>>> {
  const context = runtimeEdgeProxyContext(gateway)
  const ids = uniqueIds(modelIds)
  if (!context || !ids.length) return ok({})

  // 概览没有独立统计接口，运行时用任务详情的 in 查询一次取回后按 modelId 汇总。
  const tasks = await queryModelTasks(gateway, ids, context)
  if (!tasks.ok) return err(tasks.error.code, tasks.error.message, tasks.error.detail)
  return ok(tasksToModelCameraCounts(ids, tasks.data))
}

export async function queryUsedSources(
  gateway: RuntimeGatewayDevice,
  modelId: string,
  query: PageQuery = {},
): Promise<ServiceResult<GatewayCvModelUsedSourcePage>> {
  const pageQuery = {
    pageIndex: query.pageIndex ?? 0,
    pageSize: query.pageSize ?? 10,
  }
  const context = runtimeEdgeProxyContext(gateway)
  if (!context || !modelId) return ok({ data: [], total: 0, ...pageQuery })

  const tasks = await queryModelTasks(gateway, modelId, context)
  if (!tasks.ok) return err(tasks.error.code, tasks.error.message, tasks.error.detail)
  return ok(toPage(tasksToUsedSources(tasks.data), pageQuery))
}

async function queryModelTasks(
  gateway: RuntimeGatewayDevice,
  modelId?: string | string[],
  context?: EdgeProxyContext,
): Promise<ServiceResult<AiTaskDetail[]>> {
  const runtime = context || runtimeEdgeProxyContext(gateway)
  if (!runtime) return ok([])
  const modelIds = uniqueIds(Array.isArray(modelId) ? modelId : modelId ? [modelId] : [])
  const terms = modelIds.length > 1
    ? [{ column: 'modelId', termType: 'in', value: modelIds }]
    : modelIds.length === 1
      ? [{ column: 'modelId', termType: 'eq', value: modelIds[0] }]
      : []

  try {
    const response = await request.post(
      `${runtime.proxyPath}/ai/task/detail/_query/no-paging`,
      {
        paging: false,
        sorts: [{ name: 'createTime', order: 'desc' }],
        terms,
      },
    )

    return ok(unwrapRows<AiTaskDetail>(response))
  } catch (error) {
    return err('NETWORK', 'cv_model_used_sources_query_failed', error)
  }
}

function tasksToUsedSources(tasks: AiTaskDetail[]): AiModelUsedSource[] {
  const rows = tasks.flatMap(task => normalizeTaskSources(task))
  const sourceMap = new Map<string, AiModelUsedSource>()

  rows.forEach((row, index) => {
    const key = sourceIdentity(row, index)
    if (!sourceMap.has(key)) {
      sourceMap.set(key, row)
    }
  })

  return Array.from(sourceMap.values())
}

function toPage(rows: AiModelUsedSource[], pageQuery: Required<PageQuery>): GatewayCvModelUsedSourcePage {
  const start = pageQuery.pageIndex * pageQuery.pageSize

  return {
    data: rows.slice(start, start + pageQuery.pageSize),
    total: rows.length,
    ...pageQuery,
  }
}

function tasksToUsageResponse(modelId: string, tasks: AiTaskDetail[]): EdgeGatewayModelUsageResponse {
  const sources = tasksToUsedSources(tasks)
  return {
    modelId,
    taskTarget: textValue(tasks.find(task => task.taskTarget)?.taskTarget),
    cameras: toUsageCameras(sources),
    tasks: usageTasksFromTasks(tasks),
  }
}

function usageTasksFromTasks(tasks: AiTaskDetail[]): EdgeGatewayModelUsageResponse['tasks'] {
  return tasks.map((task, index) => ({
    taskId: textValue(task.id, `task-${index}`),
    taskName: textValue(task.name),
    sceneName: textValue(task.configuration?.sceneName),
  }))
}

function normalizeTaskSources(task: AiTaskDetail): AiModelUsedSource[] {
  const sources = Array.isArray(task.configuration?.sources) ? task.configuration.sources : []
  return sources.map((source, index) => toUsedSource(task, source, index))
}

function toUsedSource(task: AiTaskDetail, source: AiTaskSource, index: number): AiModelUsedSource {
  const sourceId = textValue(source.sourceId, source.id, source.masterChannelId, source.channelId, source.deviceId)

  return {
    ...source,
    id: textValue(source.id, sourceId, `${task.id || 'task'}-${index}`),
    name: textValue(source.name, source.sourceName, source.masterChannelName, source.channelName, source.deviceName),
    sourceId,
    sourceName: textValue(source.sourceName, source.name, source.masterChannelName, source.channelName),
    deviceId: textValue(source.deviceId, source.masterChannelId),
    deviceName: textValue(source.deviceName, source.masterChannelName),
    channelId: textValue(source.channelId, source.masterChannelId),
    channelName: textValue(source.channelName, source.masterChannelName),
    taskId: task.id,
    taskName: task.name,
  }
}

function sourceIdentity(row: AiModelUsedSource, index: number) {
  return textValue(row.sourceId, row.channelId, row.deviceId, row.id, row.taskId, index) || String(index)
}

function runtimeEdgeProxyContext(gateway: RuntimeGatewayDevice): EdgeProxyContext | undefined {
  const gatewayId = gateway.id?.trim()
  if (!gatewayId) return undefined
  return {
    gatewayId,
    proxyPath: `/edge/device/${encodeURIComponent(gatewayId)}/_`,
  }
}

function uniqueIds(modelIds: string[]) {
  return Array.from(new Set(modelIds.map(id => id?.trim()).filter((id): id is string => Boolean(id))))
}

function tasksToModelCameraCounts(modelIds: string[], tasks: AiTaskDetail[]) {
  const counts = modelIds.reduce<Record<string, number>>((record, modelId) => {
    record[modelId] = 0
    return record
  }, {})
  const grouped = new Map<string, AiTaskDetail[]>()

  tasks.forEach((task) => {
    const modelId = textValue(task.modelId)
    if (!modelId || counts[modelId] === undefined) return

    const rows = grouped.get(modelId)
    if (rows) {
      rows.push(task)
    } else {
      grouped.set(modelId, [task])
    }
  })

  grouped.forEach((rows, modelId) => {
    counts[modelId] = tasksToUsageResponse(modelId, rows).cameras?.length ?? 0
  })

  return counts
}
