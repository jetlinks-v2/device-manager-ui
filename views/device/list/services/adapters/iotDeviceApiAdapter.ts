import { request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'
import { queryDeviceBoundGroups_api } from '@device-manager-ui/api/deviceGroup'
import { withIotDeviceListDefaultTerms } from '@device-manager-ui/api/deviceListDefaultTerms'
import {
  queryDeviceSpaceAreaBindings_api,
} from '@device-manager-ui/api/spaceArea'
import type { DeviceInstance } from '@device-manager-ui/types/Instance'
import type { DeviceMetadata } from '@device-manager-ui/types/Product'
import { err, ok, type ServiceResult } from '../shared/serviceResult'
import type {
  ExecuteIotDeviceCommandInput,
  IotDevice,
  IotDeviceAdapter,
  IotDeviceCommandCategory,
  IotDeviceCommandDefinition,
  IotDeviceCommandExecution,
  IotDeviceCommandParam,
  IotDeviceCommandParamType,
  IotDeviceConnectionStatus,
  IotDeviceFilters,
  IotDeviceRisk,
  IotDeviceStatus,
  IotDeviceWorkbench,
  IotTelemetryPoint,
  IotTelemetryStatus,
} from '../../types'
import { createIotDeviceMockAdapter } from './iotDeviceMockAdapter'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})

type ApiResponse<T = any> = {
  status?: number
  result?: T
  message?: string
}

type IotDeviceInstanceAccessInfo = Partial<DeviceInstance> & {
  accessName?: string
  accessProviderName?: string
  devicePhotoUrl?: string
}

const fallbackAdapter = createIotDeviceMockAdapter()

const deviceDetail = (id: string) => request.get<DeviceInstance>(`/device-instance/${id}/detail`)
const queryDevice = (data: Record<string, any>) => request.post('/device-instance/_query', {
  ...data,
  terms: withIotDeviceListDefaultTerms(data.terms ?? []),
})
const deployDevice = (id: string) => request.post(`/device-instance/${id}/deploy`)
const undeployDevice = (id: string) => request.post(`/device-instance/${id}/undeploy`)
const deleteDevice = (id: string) => request.remove(`/device-instance/${id}`)
const executeDeviceFunction = (deviceId: string, functionId: string, data: Record<string, any>) =>
  request.post(`/device/invoked/${deviceId}/function/${functionId}`, data)

function isSuccessResponse<T>(resp: ApiResponse<T>): resp is ApiResponse<T> & { result: T } {
  return resp?.status === 200 && resp.result !== undefined
}

async function toServiceResult<T>(requester: () => Promise<ApiResponse<T>>, message: string): Promise<ServiceResult<T>> {
  try {
    const resp = await requester()
    if (isSuccessResponse(resp)) return ok(resp.result)
    return err('INTERNAL', resp?.message || message, resp)
  } catch (error) {
    return err('NETWORK', message, error)
  }
}

function safeParseMetadata(value: unknown): DeviceMetadata {
  if (!value) return { properties: [], functions: [], events: [], tags: [] }
  if (typeof value === 'object') return value as DeviceMetadata
  if (typeof value !== 'string') return { properties: [], functions: [], events: [], tags: [] }

  try {
    const parsed = JSON.parse(value)
    return {
      properties: Array.isArray(parsed?.properties) ? parsed.properties : [],
      functions: Array.isArray(parsed?.functions) ? parsed.functions : [],
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
    }
  } catch {
    return { properties: [], functions: [], events: [], tags: [] }
  }
}

function formatTime(value: unknown, fallback = t('IotDeviceDetail.detail.noReport')): string {
  if (!value) return fallback
  const date = new Date(typeof value === 'number' ? value : String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function connectionStatusOf(instance: Partial<DeviceInstance>): IotDeviceConnectionStatus {
  if (instance.disabled) return 'disabled'
  const value = String(instance.state?.value ?? '').toLowerCase()
  if (value === 'disabled') return 'disabled'
  if (value === 'online') return 'online'
  if (value === 'notactive') return 'disabled'
  if (value === 'offline') return 'offline'
  return instance.onlineTime ? 'online' : 'offline'
}

function statusOf(instance: Partial<DeviceInstance>): IotDeviceStatus {
  return connectionStatusOf(instance)
}

function riskOf(instance: Partial<DeviceInstance>): IotDeviceRisk {
  return connectionStatusOf(instance) === 'offline' ? 'watch' : 'normal'
}

function telemetryStatusOf(instance: Partial<DeviceInstance>): IotTelemetryStatus {
  return connectionStatusOf(instance) === 'online' ? 'normal' : 'stale'
}

function valueTypeName(valueType: any): string {
  return valueType?.type || valueType?.id || valueType?.name || 'string'
}

function normalizeCommandParamType(type: string): IotDeviceCommandParamType {
  if (type === 'int' || type === 'long' || type === 'float' || type === 'double' || type === 'number') return 'number'
  if (type === 'boolean' || type === 'bool') return 'boolean'
  if (type === 'enum') return 'enum'
  if (type === 'date' || type === 'datetime') return 'datetime'
  if (type === 'object') return 'object'
  if (type === 'array') return 'array'
  return 'string'
}

function commandCategory(fn: any): IotDeviceCommandCategory {
  const text = `${fn.id ?? ''} ${fn.name ?? ''} ${fn.description ?? ''}`
  if (/查询|读取|read|get/i.test(text)) return 'query'
  if (/重启|复位|校准|维护|reset|restart/i.test(text)) return 'maintenance'
  if (/开门|门禁|解锁|lock|door/i.test(text)) return 'security'
  return 'control'
}

function mapFunctionParam(input: any): IotDeviceCommandParam {
  const type = normalizeCommandParamType(valueTypeName(input?.valueType ?? input))
  const options = Array.isArray(input?.valueType?.elements)
    ? input.valueType.elements.map((item: any) => ({
        label: item?.text || item?.name || item?.value || item?.id,
        value: item?.value ?? item?.id,
      }))
    : type === 'boolean'
      ? [
          { label: input?.valueType?.trueText || t('IotDeviceDetail.common.yes'), value: input?.valueType?.trueValue ?? true },
          { label: input?.valueType?.falseText || t('IotDeviceDetail.common.no'), value: input?.valueType?.falseValue ?? false },
        ]
    : undefined

  return {
    key: input?.id || input?.name || '',
    name: input?.name || input?.id || '',
    type,
    required: Boolean(input?.expands?.required),
    description: input?.description,
    unit: input?.valueType?.unitName || input?.valueType?.unitText || input?.valueType?.unit,
    defaultValue: input?.valueType?.expands?.defaultValue ?? input?.expands?.defaultValue,
    placeholder: input?.description,
    options,
  }
}

function mapMetadataFunctionOutputs(fn: any): IotDeviceCommandParam[] {
  const output = fn?.output
  // 物模型输出既可能是单个字段，也可能收敛在对象属性列表中；统一为功能摘要可消费的参数列表。
  const sources = Array.isArray(fn?.outputs)
    ? fn.outputs
    : Array.isArray(output?.properties)
      ? output.properties
      : Array.isArray(output)
        ? output
        : output
          ? [output]
          : []

  const params = sources
    .map(mapFunctionParam)
    .filter((item: IotDeviceCommandParam) => item.key)
  if (params.length || !output || typeof output !== 'object') return params

  return [mapFunctionParam({
    ...output,
    id: 'output',
    name: output.name || t('IotDeviceDetail.commandCenter.outputResult'),
  })]
}

function mapMetadataFunction(fn: any, instance: Partial<DeviceInstance>): IotDeviceCommandDefinition {
  const category = commandCategory(fn)

  return {
    id: fn.id || fn.name,
    name: fn.name || fn.id,
    identifier: fn.id || fn.name,
    description: fn.description || '',
    category,
    riskLevel: category === 'security' ? 'critical' : category === 'maintenance' ? 'caution' : 'normal',
    callMode: fn.async ? 'async' : 'sync',
    inputParams: Array.isArray(fn.inputs) ? fn.inputs.map(mapFunctionParam).filter((item: IotDeviceCommandParam) => item.key) : [],
    outputParams: mapMetadataFunctionOutputs(fn),
    outputDescription: fn.output?.name || fn.output?.description || t('IotDeviceApiAdapter.functionOutput'),
    enabled: true,
  }
}

function mapTelemetry(instance: Partial<DeviceInstance>, metadata: DeviceMetadata): IotTelemetryPoint[] {
  return (metadata.properties || []).map((property: any) => ({
    key: property.id || property.name,
    name: property.name || property.id,
    value: '--',
    unit: property.valueType?.unit,
    status: telemetryStatusOf(instance),
    updatedAt: formatTime(instance.onlineTime || instance.offlineTime),
    hint: property.description || t('IotDeviceApiAdapter.propertySource'),
  })).filter((item) => item.key)
}

function mapApiDevice(
  instance: Partial<DeviceInstance>,
  projectId: string,
  fallback?: IotDevice,
): IotDevice {
  const accessInfo = instance as IotDeviceInstanceAccessInfo
  const metadata = safeParseMetadata(instance.metadata || instance.deriveMetadata || instance.productMetadata)
  const connectionStatus = connectionStatusOf(instance)
  const status = statusOf(instance)
  const risk = riskOf(instance)
  const tags = Array.isArray(instance.tags)
    ? instance.tags.map((item: any) => item?.name || item?.id || item?.value || item).filter(Boolean)
    : fallback?.tags ?? []

  return {
    id: instance.id || fallback?.id || '',
    projectId,
    name: instance.name || fallback?.name || instance.id || '',
    productName: instance.productName || fallback?.productName || t('IotDeviceApiAdapter.noProduct'),
    productCategory: (instance as any).classifiedName || fallback?.productCategory || '--',
    productKey: instance.productId || fallback?.productKey,
    productId: instance.productId || fallback?.productId,
    deviceType: typeof instance.deviceType === 'string' ? instance.deviceType : instance.deviceType?.text || instance.classifiedName || fallback?.deviceType || t('DeviceAlarm.source.device'),
    deviceTypeValue: typeof instance.deviceType === 'string' ? instance.deviceType : instance.deviceType?.value || fallback?.deviceTypeValue,
    area: instance.orgName || fallback?.area || '--',
    areaId: instance.orgId || fallback?.areaId,
    groupId: fallback?.groupId,
    groupName: fallback?.groupName,
    location: instance.address || fallback?.location || t('IotDeviceApiAdapter.locationUnset'),
    owner: instance.creatorName || fallback?.owner || '--',
    connectionStatus,
    businessStatuses: fallback?.businessStatuses ?? [],
    status,
    risk,
    lastSeen: formatTime(instance.onlineTime || instance.offlineTime),
    accessMode: instance.accessProvider || instance.protocolName || instance.transportProtocol || fallback?.accessMode || t('IotDeviceApiAdapter.accessUnset'),
    accessName: accessInfo.accessName || accessInfo.accessProviderName || fallback?.accessName,
    accessProvider: instance.accessProvider || fallback?.accessProvider,
    protocol: (instance as any).protocol || (instance as any).messageProtocol || fallback?.protocol,
    transport: (instance as any).transport || (instance as any).transportProtocol || fallback?.transport,
    features: Array.isArray((instance as any).features) ? (instance as any).features : fallback?.features,
    gatewayName: fallback?.gatewayName,
    identifier: instance.id || fallback?.identifier || '',
    imageUrl: accessInfo.devicePhotoUrl || instance.photoUrl || fallback?.imageUrl,
    summary: instance.describe || instance.description || fallback?.summary || instance.state?.text || t('IotDeviceApiAdapter.realDataSummary'),
    aiSummary: fallback?.aiSummary ?? {
      conclusion: connectionStatus === 'online' ? t('IotDeviceApiAdapter.online') : t('IotDeviceApiAdapter.notOnline'),
      reasons: [instance.state?.text || t('IotDeviceApiAdapter.stateReason')],
      actions: connectionStatus === 'online' ? [t('IotDeviceApiAdapter.observeReports')] : [t('IotDeviceApiAdapter.checkAccess')],
      evidence: [t('IotDeviceApiAdapter.detailEvidence')],
    },
    telemetry: mapTelemetry(instance, metadata),
    alarms: fallback?.alarms ?? [],
    logs: fallback?.logs ?? [],
    rules: fallback?.rules ?? [],
    relations: [
      { label: t('DeviceAlarm.source.product'), value: instance.productName || '--', hint: instance.productId || '' },
      { label: t('IotDeviceList.add.libraryFilterProtocol'), value: instance.protocolName || instance.messageProtocol || '--', hint: instance.protocol || '' },
      { label: t('IotDeviceList.filter.accessMode'), value: accessInfo.accessName || instance.accessProvider || '--', hint: instance.accessId || '' },
      ...(fallback?.relations ?? []),
    ],
    tags,
    thingModelMetadata: metadata,
    thingModelTags: Array.isArray(instance.tags) ? instance.tags : [],
    currentFaultCodes: fallback?.currentFaultCodes,
    createdAt: formatTime(instance.createTime || instance.registryTime || instance.registerTime, '--'),
  }
}

async function mergeDeviceBindings(device: IotDevice, projectId: string): Promise<IotDevice> {
  const [areaBindings, groupBindingMap] = await Promise.all([
    queryDeviceSpaceAreaBindings_api([device.id], projectId).catch(() => []),
    queryDeviceBoundGroups_api([device.id]).catch(() => ({})),
  ])
  const firstArea = areaBindings[0]
  const groupBindings = groupBindingMap[device.id] ?? []
  const firstGroup = groupBindings[0]

  return {
    ...device,
    area: firstArea?.area || device.area,
    areaId: firstArea?.areaId || device.areaId,
    areaBindings: areaBindings.map((item) => ({ areaId: item.areaId, area: item.area || item.areaId })),
    groupId: firstGroup?.id || device.groupId,
    groupName: firstGroup?.name || device.groupName,
    groupBindings: groupBindings.map((item) => ({ id: item.id, name: item.name })),
  }
}

function extractRows(result: any): Partial<DeviceInstance>[] {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.result)) return result.result
  if (Array.isArray(result?.records)) return result.records
  return []
}

function buildQueryTerms(filters: IotDeviceFilters) {
  const terms: any[] = []
  if (filters.keyword?.trim()) {
    terms.push({
      terms: [
        { column: 'name', termType: 'like', value: filters.keyword.trim() },
        { column: 'id', termType: 'like', value: filters.keyword.trim(), type: 'or' },
      ],
    })
  }
  if (filters.connectionStatus && filters.connectionStatus !== 'all') {
    terms.push({ column: 'state', termType: 'eq', value: filters.connectionStatus === 'disabled' ? 'notActive' : filters.connectionStatus })
  }
  if (filters.productName && filters.productName !== 'all') {
    terms.push({ column: 'productName', termType: 'like', value: filters.productName })
  }
  if (filters.deviceIds?.length) {
    terms.push({ column: 'id', termType: 'in', value: filters.deviceIds })
  }
  return terms
}

function buildSummary(devices: IotDevice[]): IotDeviceWorkbench['summary'] {
  return {
    total: devices.length,
    online: devices.filter((device) => device.connectionStatus === 'online').length,
    offline: devices.filter((device) => device.connectionStatus === 'offline').length,
    noData: devices.filter((device) => device.status === 'no-data').length,
    alarm: devices.filter((device) => device.status === 'alarm').length,
    urgent: devices.filter((device) => device.risk === 'urgent').length,
    maintenance: devices.filter((device) => device.businessStatuses?.includes('maintenance')).length,
  }
}

function buildFacets(devices: IotDevice[]): IotDeviceWorkbench['facets'] {
  return {
    areas: Array.from(new Set(devices.map((item) => item.area).filter(Boolean))),
    productNames: Array.from(new Set(devices.map((item) => item.productName).filter(Boolean))),
    owners: Array.from(new Set(devices.map((item) => item.owner).filter(Boolean))),
  }
}

async function getFallbackDevice(projectId: string, deviceId: string): Promise<IotDevice | undefined> {
  const fallback = await fallbackAdapter.getDevice(projectId, deviceId)
  return fallback.ok ? fallback.data : undefined
}

async function getApiDevice(projectId: string, deviceId: string): Promise<ServiceResult<IotDevice>> {
  const [apiResult, fallback] = await Promise.all([
    toServiceResult(() => deviceDetail(deviceId), t('IotDeviceApiAdapter.error.detail')),
    getFallbackDevice(projectId, deviceId),
  ])

  if (!apiResult.ok) {
    return fallback ? ok(fallback) : apiResult
  }

  return ok(await mergeDeviceBindings(mapApiDevice(apiResult.data, projectId, fallback), projectId))
}

export function createIotDeviceApiAdapter(): IotDeviceAdapter {
  return {
    ...fallbackAdapter,

    async getWorkbench(filters) {
      const apiResult = await toServiceResult(
        () => queryDevice({ pageIndex: 0, pageSize: 1000, terms: buildQueryTerms(filters) }),
        t('IotDeviceApiAdapter.error.list'),
      )
      if (!apiResult.ok) return fallbackAdapter.getWorkbench(filters)

      const fallback = await fallbackAdapter.getWorkbench(filters)
      const fallbackMap = new Map((fallback.ok ? fallback.data.devices : []).map((device) => [device.id, device]))
      const devices = extractRows(apiResult.data).map((item) => mapApiDevice(item, filters.projectId, fallbackMap.get(item.id || '')))

      if (!devices.length) return fallbackAdapter.getWorkbench(filters)

      return ok({
        devices,
        insights: fallback.ok ? fallback.data.insights : [],
        todos: fallback.ok ? fallback.data.todos : [],
        summary: buildSummary(devices),
        facets: buildFacets(devices),
      })
    },

    async getDevice(projectId, deviceId) {
      return getApiDevice(projectId, deviceId)
    },

    async listDeviceCommands(projectId, deviceId) {
      const deviceResult = await toServiceResult(() => deviceDetail(deviceId), t('IotDeviceApiAdapter.error.functions'))
      if (!deviceResult.ok) return fallbackAdapter.listDeviceCommands(projectId, deviceId)
      const metadata = safeParseMetadata(deviceResult.data.metadata || deviceResult.data.deriveMetadata || deviceResult.data.productMetadata)
      const commands = (metadata.functions || []).map((item) => mapMetadataFunction(item, deviceResult.data)).filter((item) => item.id)
      return commands.length ? ok(commands) : fallbackAdapter.listDeviceCommands(projectId, deviceId)
    },

    async executeDeviceCommand(input: ExecuteIotDeviceCommandInput) {
      const commandResult = await this.listDeviceCommands(input.projectId, input.deviceId)
      const command = commandResult.ok ? commandResult.data.find((item) => item.id === input.commandId) : undefined
      if (!command) return fallbackAdapter.executeDeviceCommand(input)

      let apiResp: any
      try {
        apiResp = await executeDeviceFunction(input.deviceId, command.identifier, input.params)
      } catch (error) {
        return err('NETWORK', t('IotDeviceApiAdapter.error.execute'), error)
      }
      const success = apiResp?.success === true || apiResp?.status === 200
      if (!success) return err('INTERNAL', apiResp?.message || t('IotDeviceApiAdapter.error.execute'), apiResp)
      const responsePayload = apiResp?.result ?? apiResp?.data ?? apiResp

      const execution: IotDeviceCommandExecution = {
        id: `api-${Date.now()}`,
        commandId: command.id,
        commandName: command.name,
        identifier: command.identifier,
        status: 'success',
        requestId: responsePayload?.requestId || responsePayload?.messageId || `api-${Date.now()}`,
        executedAt: t('IotDeviceDetail.common.time.justNow'),
        duration: command.callMode === 'async' ? t('IotDeviceApiAdapter.accepted') : t('IotDeviceApiAdapter.returned'),
        summary: t('IotDeviceApiAdapter.commandSent', { name: command.name }),
        requestPayload: JSON.stringify(input.params, null, 2),
        responsePayload: JSON.stringify(responsePayload, null, 2),
        steps: [
          {
            id: 'api-send',
            title: t('IotDeviceApiAdapter.apiDispatch'),
            node: input.deviceId,
            status: 'success',
            happenedAt: t('IotDeviceDetail.common.time.justNow'),
            content: t('IotDeviceApiAdapter.apiCalled'),
          },
        ],
      }
      return ok(execution)
    },

    async setDeviceEnabled(projectId, deviceId, enabled) {
      const apiResult = await toServiceResult(
        () => enabled ? deployDevice(deviceId) : undeployDevice(deviceId),
        enabled ? t('IotDeviceApiAdapter.error.enable') : t('IotDeviceApiAdapter.error.disable'),
      )
      if (!apiResult.ok) return fallbackAdapter.setDeviceEnabled(projectId, deviceId, enabled)
      return getApiDevice(projectId, deviceId)
    },

    async deleteDevice(projectId, deviceId) {
      const apiResult = await toServiceResult(() => deleteDevice(deviceId), t('IotDeviceApiAdapter.error.delete'))
      if (!apiResult.ok) return fallbackAdapter.deleteDevice(projectId, deviceId)
      return ok({ id: deviceId })
    },
  }
}
