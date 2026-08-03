import dayjs from 'dayjs'
import { request } from '@jetlinks-web/core'
import { TOKEN_KEY } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'
import { fileUpload } from '@jetlinks-web-core/api/comm'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getProjectStorage, isProjectStorageEnabled } from '@jetlinks-web-core/utils/project-storage'
import i18n from '@jetlinks-web-core/locales'

import type { IotDevice, IotDeviceConnectionStatus } from '@device-manager-ui/views/device/list/types'
import { IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS, withIotDeviceListDefaultTerms } from './deviceListDefaultTerms'
import { queryDeviceBoundGroups_api } from './deviceGroup'
import { queryDeviceSpaceAreaBindings_api } from './spaceArea'
import type {
  ApiResponse,
  CreateDeviceApiInput,
  CreateProductFromTemplateInput,
  DeviceDetailResponse,
  DeviceDocumentBind,
  DeviceDocumentType,
  DeviceExtension,
  DeviceGatewayDetailResponse,
  DeviceLibraryGatewayDetail,
  DevicePageResult,
  DeviceQueryParams,
  DeviceQueryTerm,
  DeviceTemplateProductInput,
  FileUploadResponse,
  IotDeviceAreaOption,
  IotDeviceProductCategory,
  IotDeviceProductTemplate,
  IotDeviceRoleOption,
  IotDeviceTypeValue,
  MaybeEnum,
  ProductDetailResponse,
  ProjectRuntimeContext,
  RoleResponse,
  TreeNodeResponse,
  UpdateDeviceBasicInfoApiInput,
} from './device-library/types'

export type * from './device-library/types'

const t = (key: string) => i18n.global.t(key)

const deviceStateMap: Record<string, IotDeviceConnectionStatus> = {
  online: 'online',
  offline: 'offline',
  notActive: 'disabled',
}

const deviceTypeTextMap: Record<string, string> = {
  get device() { return t('IotDeviceList.deviceType.device') },
  get childrenDevice() { return t('IotDeviceList.deviceType.childrenDevice') },
  get gateway() { return t('IotDeviceList.deviceType.gateway') },
}

const deviceTypeValueMap: Record<string, IotDeviceTypeValue> = {
  device: 'device',
  direct: 'device',
  directdevice: 'device',
  childrendevice: 'childrenDevice',
  childdevice: 'childrenDevice',
  subdevice: 'childrenDevice',
  gateway: 'gateway',
  gatewaydevice: 'gateway',
}

const accessModeTransportMap: Record<string, string> = {
  direct: 'MQTT',
  edge: 'MQTT',
  gb28181: 'GB28181',
  collector: 'TCP',
  'third-party': 'HTTP',
}

const normalizeProjectRuntimeApiUrl = (apiUrl?: string) => {
  return (import.meta.env.VITE_APP_PROJECT_RUNTIME_API_URL || apiUrl || '').trim().replace(/\/$/, '')
}

function getProjectRuntimeContext(required: true): ProjectRuntimeContext
function getProjectRuntimeContext(required?: false): ProjectRuntimeContext | undefined
function getProjectRuntimeContext(required = false): ProjectRuntimeContext | undefined {
  const projectId = getProjectIdFromLocation()
  const projectStorageEnabled = isProjectStorageEnabled()
  const projectStorage = projectStorageEnabled ? getProjectStorage(projectId) : undefined
  // 独立项目的自定义流式请求与全局请求保持同一会话和同源 /api。
  const apiUrl = projectStorageEnabled
    ? normalizeProjectRuntimeApiUrl(projectStorage?.apiUrl)
    : String(import.meta.env.VITE_APP_BASE_API || '/api').trim().replace(/\/$/, '')
  const token = projectStorageEnabled ? projectStorage?.token?.trim() : getToken()?.trim()
  const runtimeProjectId = firstString(projectStorage?.id, projectId)

  if (runtimeProjectId && apiUrl && token) {
    return {
      projectId: runtimeProjectId,
      apiUrl,
      token,
      domain: projectStorage?.domain,
    }
  }

  if (required) {
    throw new Error(t('IotDeviceApi.error.runtimeAccessMissing'))
  }

  return undefined
}

const withProjectRuntimeRequest = (context: ProjectRuntimeContext) => {
  const headers: Record<string, string> = {
    [TOKEN_KEY]: context.token,
  }

  if (context.domain) {
    headers['X-Tenant-Domain'] = context.domain
  }

  return {
    baseURL: context.apiUrl,
    headers,
  }
}

const toEnumValue = (value: MaybeEnum | undefined) => {
  if (value && typeof value === 'object') {
    return String(value.value ?? value.name ?? '')
  }

  return String(value ?? '')
}

export const normalizeDeviceTypeValue = (deviceType?: unknown): IotDeviceTypeValue => {
  const value = toEnumValue(deviceType as MaybeEnum).trim()
  const key = value.replace(/[-_]/g, '').toLowerCase()
  return deviceTypeValueMap[key] ?? 'device'
}

const toEnumText = (value: MaybeEnum | undefined, fallbackMap?: Record<string, string>) => {
  if (value && typeof value === 'object') {
    const raw = String(value.value ?? value.name ?? '')
    return String(value.text ?? value.label ?? fallbackMap?.[raw] ?? raw)
  }

  const raw = String(value ?? '')
  return fallbackMap?.[raw] ?? raw
}

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = value == null ? '' : String(value).trim()
    if (text) return text
  }
  return ''
}

const unwrapArray = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[]
  if (!isRecord(payload)) return []
  const result = 'result' in payload ? payload.result : 'data' in payload ? payload.data : payload
  if (Array.isArray(result)) return result as T[]
  if (isRecord(result)) {
    if (Array.isArray(result.data)) return result.data as T[]
    if (Array.isArray(result.records)) return result.records as T[]
  }
  return []
}

const formatTime = (value: unknown) => {
  const timestamp = Number(value || 0)
  return timestamp ? dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss') : '--'
}

const unwrapResult = <T>(response: ApiResponse<T> | T): T => {
  if (response && typeof response === 'object' && 'result' in response) {
    return (response as ApiResponse<T>).result as T
  }
  return response as T
}

const streamToUtf8Text = async (payload: unknown) => {
  const data = isRecord(payload) && 'data' in payload ? payload.data : payload
  if (typeof data === 'string') return data
  if (data instanceof Blob) return data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(data)
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    return new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  }
  return ''
}

const queryRuntimeDeviceProductById = async (context: ProjectRuntimeContext, productId: string) => {
  const id = productId.trim()
  if (!id) return undefined
  const response = await request.post(
    '/device/product/_query/no-paging?paging=false',
    buildNoPagingBody([{ column: 'id', termType: 'eq', value: id }]),
    { ...withProjectRuntimeRequest(context), hiddenError: true },
  )
  return unwrapArray<ProductDetailResponse>(response).find((product) => String(product.id) === id)
}

const pickExtension = (extensions: DeviceExtension | undefined) => ({
  projectId: extensions?.iot?.projectId ?? extensions?.projectId,
  areaId: extensions?.iot?.areaId ?? extensions?.areaId,
  area: extensions?.iot?.area ?? extensions?.area,
  location: extensions?.iot?.location ?? extensions?.location,
  scenario: extensions?.iot?.scenario ?? extensions?.scenario,
  owner: extensions?.iot?.owner ?? extensions?.owner,
  tags: extensions?.iot?.tags ?? extensions?.tags,
})

const normalizeLikeTermValue = (term: DeviceQueryTerm): DeviceQueryTerm => {
  const queryTerm = { ...term }
  delete queryTerm.skipKeywordExpand
  if (Array.isArray(term.terms)) {
    return {
      ...queryTerm,
      terms: term.terms.map(normalizeLikeTermValue),
    }
  }

  if (['like', 'nlike'].includes(String(term.termType || '')) && typeof term.value === 'string') {
    const value = term.value.trim()
    return {
      ...queryTerm,
      value: value.includes('%') ? value : `%${value}%`,
    }
  }

  return queryTerm
}

const expandKeywordTerm = (term: DeviceQueryTerm): DeviceQueryTerm => {
  if (Array.isArray(term.terms)) {
    return {
      ...term,
      terms: term.terms.map(expandKeywordTerm),
    }
  }

  if (term.skipKeywordExpand || term.column !== 'name' || String(term.termType || '') !== 'like' || typeof term.value !== 'string') {
    return normalizeLikeTermValue(term)
  }

  const value = normalizeLikeTermValue(term).value

  return {
    type: term.type,
    terms: [
      { column: 'name', termType: 'like', value },
      { column: 'id', termType: 'like', value, type: 'or' },
      { column: 'identifier', termType: 'like', value, type: 'or' },
      { column: 'productName', termType: 'like', value, type: 'or' },
      { column: 'productId$product-info', value: [{ column: 'manufacturer', termType: 'like', value }], type: 'or' },
      { column: 'productId$product-info', value: [{ column: 'model', termType: 'like', value }], type: 'or' },
    ],
  }
}

const buildQueryBody = (params: DeviceQueryParams = {}) => ({
  pageIndex: params.pageIndex ?? 0,
  pageSize: params.pageSize ?? 10,
  sorts: params.sorts ?? [{ name: 'createTime', order: 'desc' }],
  terms: params.terms?.map(expandKeywordTerm),
  context: {
    includeTags: true,
    includeRelations: true,
    includeBind: false,
    includeFirmwareInfos: false,
    includeParent: true,
  },
})

const buildDeviceListQueryBody = (params: DeviceQueryParams = {}) => ({
  ...buildQueryBody(params),
  terms: withIotDeviceListDefaultTerms((params.terms ?? []).map(expandKeywordTerm)),
})

const buildNoPagingBody = (terms: DeviceQueryTerm[] = []) => ({
  paging: false,
  sorts: [{ name: 'createTime', order: 'desc' }],
  terms,
})

const withDeviceTypeTerm = (terms: DeviceQueryTerm[] = [], deviceType?: string) => {
  if (!deviceType) return terms
  return [
    ...terms,
    {
      column: 'deviceType',
      termType: 'eq',
      value: deviceType,
    },
  ]
}

// 新增设备只允许选择普通设备产品；边缘网关、视频设备等走各自业务入口。
const IOT_DEVICE_PRODUCT_SELECT_DEFAULT_TERMS: DeviceQueryTerm[] = [
  {
    column: 'accessProvider',
    termType: 'nin',
    value: [...IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS],
  },
]

const toDevice = (item: DeviceDetailResponse): IotDevice => {
  const state = toEnumValue(item.state)
  const connectionStatus = deviceStateMap[state] ?? 'disabled'
  const deviceTypeValue = toEnumValue(item.deviceType)
  const extension = pickExtension(item.extensions)
  const tags = (item.tags ?? [])
    .map(tag => tag.name || tag.value || tag.key)
    .filter((tag): tag is string => Boolean(tag))
  const extensionTags = Array.isArray(extension.tags) ? extension.tags : []

  const relations = (item.relations ?? []).map(relation => ({
    label: relation.label || relation.name || '--',
    value: relation.value || '--',
    hint: relation.hint || '',
  }))

  const lastSeenSource = connectionStatus === 'online'
    ? item.onlineTime
    : item.offlineTime || item.registerTime || item.registryTime

  return {
    id: String(item.id || ''),
    projectId: extension.projectId || '',
    name: item.name || item.id || '--',
    productName: item.productName || '--',
    productManufacturer: item.productManufacturer,
    productModel: item.productModel,
    productCategory: item.classifiedName || '--',
    productId: item.productId,
    productKey: item.productId,
    deviceType: toEnumText(item.deviceType, deviceTypeTextMap) || '--',
    deviceTypeValue,
    area: extension.area || item.orgName || '--',
    areaId: extension.areaId,
    location: extension.location || item.address || item.orgName || '--',
    scenario: extension.scenario || '',
    owner: extension.owner || item.creatorName || item.modifierName || '--',
    connectionStatus,
    businessStatuses: [],
    status: connectionStatus,
    risk: 'normal',
    lastSeen: formatTime(lastSeenSource),
    lastSeenTimestamp: lastSeenSource,
    onlineAt: item.onlineTime,
    offlineAt: item.offlineTime,
    accessMode: item.accessName || item.accessProvider || '--',
    accessProvider: item.accessProvider,
    gatewayName: undefined,
    identifier: item.identifier || item.id || '--',
    // 设备保存接口写入的是 photoUrl，列表接口部分场景不会回填 devicePhotoUrl。
    imageUrl: item.devicePhotoUrl || item.photoUrl || item.productPhotoUrl || '',
    summary: item.description || item.describe || '',
    aiSummary: {
      conclusion: '',
      reasons: [],
      actions: [],
      evidence: [],
    },
    telemetry: [],
    alarms: [],
    logs: [],
    rules: [],
    relations,
    tags: Array.from(new Set([...extensionTags, ...tags])),
    currentFaultCodes: [],
    createdAt: formatTime(item.createTime),
  } as IotDevice & { createdAt?: string }
}

const enrichDeviceAreaGroups = async (devices: IotDevice[]): Promise<IotDevice[]> => {
  const ids = devices.map((item) => item.id).filter(Boolean)
  if (!ids.length) return devices

  const projectId = devices.find((item) => item.projectId)?.projectId || ''
  const [areaBindings, groupBindings] = await Promise.all([
    queryDeviceSpaceAreaBindings_api(ids, projectId).catch(() => []),
    queryDeviceBoundGroups_api(ids).catch(() => ({})),
  ])
  const areasByDeviceId = areaBindings.reduce<Record<string, typeof areaBindings>>((acc, item) => {
    acc[item.deviceId] = [...(acc[item.deviceId] ?? []), item]
    return acc
  }, {})

  return devices.map((device) => {
    const areas = areasByDeviceId[device.id] ?? []
    const groups = groupBindings[device.id] ?? []
    const firstArea = areas[0]
    const firstGroup = groups[0]

    return {
      ...device,
      area: firstArea?.area || device.area,
      areaId: firstArea?.areaId || device.areaId,
      areaBindings: areas.map((item) => ({ areaId: item.areaId, area: item.area || item.areaId })),
      groupId: firstGroup?.id || device.groupId,
      groupName: firstGroup?.name || device.groupName,
      groupBindings: groups.map((item) => ({ id: item.id, name: item.name })),
    }
  })
}

const resolveProductCategory = (item: ProductDetailResponse): IotDeviceProductCategory => {
  const text = [
    item.classifiedName,
    item.name,
    item.describe,
    toEnumText(item.deviceType, deviceTypeTextMap),
    item.accessName,
    item.accessProvider,
    item.transportProtocol,
  ].filter(Boolean).join(' ')

  if (/视频|摄像|camera|gb28181|onvif/i.test(text)) return 'video'
  if (/表|电|水表|流量|meter|energy/i.test(text)) return 'meter'
  if (/工控|PLC|modbus|工业|采集|控制/i.test(text)) return 'industrial'
  if (/网关|平台|系统|对接|同步|integration|http/i.test(text)) return 'integration'
  return 'sensor'
}

const toProductTemplate = (item: ProductDetailResponse): IotDeviceProductTemplate => {
  const deviceType = toEnumValue(item.deviceType) || 'device'
  const accessName = item.accessName || item.accessProvider || item.networkWay || item.transportProtocol || '--'
  const template = item.extensions?.iotTemplate
  const templateId = template?.templateId || item.templateId

  return {
    id: String(item.id || ''),
    name: item.name || item.id || '--',
    summary: item.describe || item.description || item.classifiedName || '--',
    category: template?.category || resolveProductCategory(item),
    accessName,
    sourceProduct: template?.sourceProduct || item.classifiedName || item.messageProtocol || '',
    manufacturer: item.manufacturer,
    model: item.model,
    supportedManufacturers: template?.supportedManufacturers?.length
      ? template.supportedManufacturers
      : [item.manufacturer].filter((value): value is string => Boolean(value)),
    modelKeywords: [
      item.id,
      templateId,
      item.manufacturer,
      item.model,
      item.classifiedId,
      item.classifiedName,
      item.networkWay,
      item.messageProtocol,
      ...(template?.modelKeywords ?? []),
    ]
      .filter((value): value is string => Boolean(value)),
    templateId,
    deviceType,
    productName: item.name,
    photoUrl: item.photoUrl,
    faultCodeDict: [],
    accessId: item.accessId,
    accessProvider: item.accessProvider,
    networkWay: item.networkWay,
    transportProtocol: item.transportProtocol,
    messageProtocol: item.messageProtocol,
    protocolName: item.protocolName,
    gatewayBizKey: item.gatewayBizKey,
    configuration: item.configuration,
  }
}

const buildDeviceExtensions = (input: CreateDeviceApiInput | UpdateDeviceBasicInfoApiInput) => {
  const iot = {
    projectId: input.projectId,
    areaId: input.areaId || '',
    area: input.area || '',
    location: input.location || '',
    scenario: input.scenario || '',
    owner: input.owner || '',
  } as NonNullable<DeviceExtension['iot']>

  if (input.tags !== undefined) {
    iot.tags = input.tags
  }

  return { iot }
}

const buildCreateDeviceBody = (input: CreateDeviceApiInput) => ({
  name: input.name.trim(),
  productId: input.productKey,
  productName: input.productName || input.productKey,
  deviceType: input.productDeviceType || 'device',
  parentId: input.parentId || undefined,
  photoUrl: input.imageUrl || undefined,
  describe: input.description?.trim() || [input.area, input.location, input.scenario, input.owner]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · '),
  extensions: buildDeviceExtensions(input),
})

const buildUpdateDeviceBasicInfoBody = (input: UpdateDeviceBasicInfoApiInput) => ({
  id: input.id,
  name: input.name.trim(),
  productId: input.productKey || undefined,
  productName: input.productName || undefined,
  deviceType: input.productDeviceType || undefined,
  photoUrl: input.imageUrl || '',
  describe: input.description?.trim() || [input.area, input.location, input.scenario, input.owner]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · '),
  extensions: buildDeviceExtensions(input),
})

const unwrapFileAccessUrl = (response: ApiResponse<FileUploadResponse> | FileUploadResponse) => {
  const result = 'result' in response ? response.result : response
  return result?.accessUrl || result?.url || result?.fileUrl || ''
}

export const uploadDevicePhoto_api = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file, file.name)
  const response = await fileUpload(formData) as ApiResponse<FileUploadResponse>
  const accessUrl = unwrapFileAccessUrl(response)
  if (!accessUrl) throw new Error(t('IotDeviceApi.error.iconUploadFailed'))
  return accessUrl
}

const normalizeProductIdPart = (value: string) =>
  value
    .trim()
    .replace(/[^0-9a-zA-Z_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildTemplateProductId = (projectId: string, templateId: string) => {
  const project = normalizeProductIdPart(projectId) || 'project'
  const template = normalizeProductIdPart(templateId) || 'template'

  return `${project}-${template}`.slice(0, 96)
}

const stringifyMetadata = (metadata: unknown) => {
  if (!metadata) return ''
  if (typeof metadata === 'string') return metadata
  try {
    return JSON.stringify(metadata)
  } catch {
    return ''
  }
}

const buildMetadataFromTemplate = (template: DeviceTemplateProductInput) => {
  const metadata = stringifyMetadata(template.metadata)
  if (metadata) return metadata

  const properties = (template.dataPoints ?? [])
    .filter((point) => point.key && point.name)
    .map((point) => ({
      id: point.key,
      name: point.name,
      expands: {
        description: point.desc,
        source: point.kind,
      },
      valueType: {
        type: 'string',
      },
    }))

  return JSON.stringify({
    properties,
    functions: [],
    events: [],
    tags: [],
  })
}

const buildCreateProductBody = (input: CreateProductFromTemplateInput) => {
  const template = input.template
  const productId = input.productId || buildTemplateProductId(input.projectId, template.id)
  const firstModel = template.supportedModels?.[0]
  const accessMode = firstModel?.accessMode || template.accessProvider || template.accessModes?.[0] || ''
  const accessName = firstModel?.accessName || template.accessName || accessMode || ''
  const classifiedName = template.classifiedName || template.sourceProduct

  return {
    id: productId,
    name: template.name,
    projectId: input.projectId,
    photoUrl: template.photoUrl,
    describe: template.summary || template.description || template.describe || template.sourceProduct || '',
    manufacturer: template.manufacturer,
    model: template.model,
    classifiedId: template.classifiedId,
    classifiedName,
    templateId: template.id,
    metadata: buildMetadataFromTemplate(template),
    configuration: template.configuration,
    storePolicy: template.storePolicy,
    accessId: template.accessId,
    messageProtocol: template.messageProtocol,
    protocolName: template.protocolName,
    transportProtocol: template.transportProtocol || accessModeTransportMap[accessMode] || accessMode || undefined,
    networkWay: template.networkWay || accessMode || undefined,
    deviceType: normalizeDeviceTypeValue(template.deviceType),
    accessName,
    accessProvider: accessMode || undefined,
    state: 1,
    extensions: {
      iotTemplate: {
        templateId: template.id,
        category: template.category,
        sourceProduct: template.sourceProduct,
        supportedManufacturers: template.supportedManufacturers ?? [],
        modelKeywords: template.modelKeywords ?? [],
        supportedModels: template.supportedModels ?? [],
        faultCodeDict: template.faultCodeDict ?? [],
        telemetryNormalRanges: template.telemetryNormalRanges ?? [],
        knowledgeBase: template.knowledgeBase ?? [],
      },
    },
  }
}

const toDeviceTemplateProductInput = (item: ProductDetailResponse): DeviceTemplateProductInput => {
  const accessName = item.accessName || item.accessProvider || item.networkWay || item.transportProtocol || '--'
  const accessMode = item.accessProvider || item.networkWay || item.transportProtocol || ''

  return {
    id: String(item.id || ''),
    name: item.name || item.id || '--',
    summary: item.description || item.describe || item.classifiedName || '',
    category: resolveProductCategory(item),
    photoUrl: item.photoUrl,
    description: item.description,
    describe: item.describe,
    classifiedId: item.classifiedId,
    classifiedName: item.classifiedName,
    accessId: item.accessId,
    sourceProduct: item.classifiedName || item.name || '',
    manufacturer: item.manufacturer,
    model: item.model,
    supportedManufacturers: [item.manufacturer].filter((value): value is string => Boolean(value)),
    modelKeywords: [
      item.id,
      item.manufacturer,
      item.model,
      item.classifiedId,
      item.classifiedName,
      item.accessName,
      item.accessProvider,
      item.messageProtocol,
      item.transportProtocol,
    ].filter((value): value is string => Boolean(value)),
    deviceType: item.deviceType,
    accessName,
    accessProvider: item.accessProvider,
    networkWay: item.networkWay,
    transportProtocol: item.transportProtocol,
    messageProtocol: item.messageProtocol,
    protocolName: item.protocolName,
    gatewayBizKey: item.gatewayBizKey,
    metadata: item.metadata,
    configuration: item.configuration,
    storePolicy: item.storePolicy,
    accessModes: accessMode ? [accessMode] : [],
  }
}

const flattenTree = (nodes: TreeNodeResponse[] = [], parentId?: string): IotDeviceAreaOption[] =>
  nodes.flatMap((node) => {
    const current = node.id && node.name
      ? [{
          id: String(node.id),
          name: String(node.name),
          type: node.type,
          parentId: node.parentId || parentId,
        }]
      : []

    return [
      ...current,
      ...flattenTree(node.children ?? [], node.id || parentId),
    ]
  })

export const queryDevicePage_api = async (params: DeviceQueryParams = {}): Promise<DevicePageResult> => {
  const response = await request.post('/device/instance/detail/_query', buildDeviceListQueryBody(params)) as ApiResponse<PagerResult<DeviceDetailResponse>>
  const result = response.result || {}
  const pageIndex = Number(result.pageIndex ?? params.pageIndex ?? 0)
  const pageSize = Number(result.pageSize ?? params.pageSize ?? 10)
  const data = await enrichDeviceAreaGroups((result.data ?? []).map(toDevice))

  return {
    data,
    total: Number(result.total ?? 0),
    pageIndex,
    pageSize,
  }
}

export const queryDeviceCountByProductId_api = async (productId: string): Promise<number> => {
  if (!productId) return 0
  const response = await request.post('/device/instance/detail/_query', buildDeviceListQueryBody({
    pageIndex: 0,
    pageSize: 1,
    terms: [{
      column: 'productId',
      termType: 'eq',
      value: productId,
    }],
  })) as ApiResponse<PagerResult<DeviceDetailResponse>>

  return Number(response.result?.total ?? 0)
}

export const countDevice_api = async (params: DeviceQueryParams = {}): Promise<number> => {
  const response = await request.post('/device-instance/_count', buildDeviceListQueryBody({ ...params, pageSize: 0 })) as ApiResponse<number> | number
  const result = unwrapResult<number>(response)
  return Number(result ?? 0)
}

export const getDeviceDetail_api = async (deviceId: string): Promise<IotDevice | null> => {
  const response = await request.post('/device/instance/detail/_query', buildQueryBody({
    pageIndex: 0,
    pageSize: 1,
    terms: [
      {
        column: 'id',
        termType: 'eq',
        value: deviceId,
      },
    ],
  })) as ApiResponse<PagerResult<DeviceDetailResponse>>
  const item = response.result?.data?.[0]

  if (!item) return null
  return (await enrichDeviceAreaGroups([toDevice(item)]))[0] ?? null
}

export const queryDeviceProducts_api = async (projectId?: string, deviceType?: string): Promise<IotDeviceProductTemplate[]> => {
  const runtimeProjectId = firstString(getProjectStorage(projectId)?.id, projectId)
  const response = await request.post(
    '/device/product/_query/no-paging?paging=false',
    buildNoPagingBody(withDeviceTypeTerm(IOT_DEVICE_PRODUCT_SELECT_DEFAULT_TERMS, deviceType)),
  ) as ApiResponse<ProductDetailResponse[]>
  const list = unwrapResult<ProductDetailResponse[]>(response) ?? []

  return list
    .filter((item) => !runtimeProjectId || !item.projectId || item.projectId === runtimeProjectId)
    .map(toProductTemplate)
    .filter((product) => Boolean(product.id))
}

export const queryDeviceProductById_api = async (productId: string): Promise<IotDeviceProductTemplate | null> => {
  const context = getProjectRuntimeContext(true)
  const product = await queryRuntimeDeviceProductById(context, productId)
  return product ? toProductTemplate(product) : null
}

export const queryDeviceGatewayById_api = async (accessId: string): Promise<DeviceLibraryGatewayDetail | null> => {
  if (!accessId) return null
  const context = getProjectRuntimeContext(true)
  const response = await request.get(
    `/gateway/device/${encodeURIComponent(accessId)}/detail`,
    {},
    { ...withProjectRuntimeRequest(context), hiddenError: true },
  )
  return unwrapResult<DeviceGatewayDetailResponse>(response) ?? null
}

export const queryDeviceTemplates_api = async (deviceType?: string): Promise<DeviceTemplateProductInput[]> => {
  const response = await request.post('/device/template/_query/no-paging?paging=false', buildNoPagingBody([
    ...withDeviceTypeTerm(IOT_DEVICE_PRODUCT_SELECT_DEFAULT_TERMS, deviceType),
    {
      column: 'state',
      termType: 'eq',
      value: 'enabled',
    },
  ])) as ApiResponse<ProductDetailResponse[]>
  const list = unwrapResult<ProductDetailResponse[]>(response) ?? []

  return list
    .map(toDeviceTemplateProductInput)
    .filter((template) => Boolean(template.id))
}

export const queryDeviceProductDocuments_api = async (
  productId: string,
  documentType: DeviceDocumentType = 'access-guide',
): Promise<DeviceDocumentBind[]> => {
  if (!productId) return []
  const response = await request.post(`/device/product/${encodeURIComponent(productId)}/documents/_query`, {
    paging: false,
    sorts: [
      { name: 'sortIndex', order: 'asc' },
      { name: 'createTime', order: 'desc' },
    ],
    terms: [
      {
        column: 'documentType',
        termType: 'eq',
        value: documentType,
      },
    ],
  })

  return unwrapArray<DeviceDocumentBind>(response)
}

export const readDeviceDocumentFileText_api = async (fileId: string): Promise<string> => {
  if (!fileId) return ''
  return streamToUtf8Text(await request.getStream(`/file/${encodeURIComponent(fileId)}`))
}

export const createProductFromDeviceTemplate_api = async (input: CreateProductFromTemplateInput): Promise<IotDeviceProductTemplate> => {
  const body = buildCreateProductBody(input)
  const response = await request.post(`/device/template/${encodeURIComponent(input.template.id)}/_create-product`, {
    productId: body.id,
    productName: body.name,
    projectId: body.projectId,
    configuration: body.configuration,
  }) as ApiResponse<ProductDetailResponse>
  const result = unwrapResult<ProductDetailResponse>(response) ?? {}

  return toProductTemplate({
    ...body,
    ...result,
    id: result.id || body.id,
    name: result.name || body.name,
    projectId: result.projectId || body.projectId,
    templateId: result.templateId || body.templateId,
    extensions: result.extensions || body.extensions,
  })
}

export const queryDeviceAreas_api = async (_projectId?: string): Promise<IotDeviceAreaOption[]> => {
  const response = await request.post('/organization/_all/tree', {}) as ApiResponse<TreeNodeResponse[]>
  const list = unwrapResult<TreeNodeResponse[]>(response) ?? []

  return flattenTree(list)
}

export const queryDeviceRoles_api = async (_projectId?: string): Promise<IotDeviceRoleOption[]> => {
  const response = await request.post('/role/_query/no-paging?paging=false', { paging: false }) as ApiResponse<RoleResponse[]>
  const list = unwrapResult<RoleResponse[]>(response) ?? []

  return list
    .map((role) => ({
      id: String(role.id || role.name || ''),
      name: String(role.name || role.id || ''),
    }))
    .filter((role) => Boolean(role.id && role.name))
}

export const createDevice_api = async (input: CreateDeviceApiInput): Promise<IotDevice> => {
  const response = await request.post('/device/instance', buildCreateDeviceBody(input)) as ApiResponse<DeviceDetailResponse>
  const result = unwrapResult<DeviceDetailResponse>(response) ?? {}

  return toDevice({
    ...result,
    productId: result.productId || input.productKey,
    productName: result.productName || input.productName,
    deviceType: result.deviceType || input.productDeviceType,
    photoUrl: result.photoUrl || input.imageUrl,
    extensions: result.extensions || buildDeviceExtensions(input),
  })
}

export const updateDeviceBasicInfo_api = async (input: UpdateDeviceBasicInfoApiInput): Promise<IotDevice> => {
  const body = buildUpdateDeviceBasicInfoBody(input)
  const response = await request.put(`/device-instance/${input.id}`, body) as ApiResponse<DeviceDetailResponse>
  const result = unwrapResult<DeviceDetailResponse>(response) ?? {}

  return toDevice({
    ...result,
    id: result.id || input.id,
    productId: result.productId || input.productKey,
    productName: result.productName || input.productName,
    deviceType: result.deviceType || input.productDeviceType,
    photoUrl: result.photoUrl || input.imageUrl,
    extensions: result.extensions || buildDeviceExtensions(input),
  })
}

export const deployDevice_api = (deviceId: string) => request.post(`/device/instance/${deviceId}/deploy`, {})

export const undeployDevice_api = (deviceId: string) => request.post(`/device/instance/${deviceId}/undeploy`, {})

export const batchDeployDevice_api = (deviceIds: string[]) => request.put('/device/instance/batch/_deploy', deviceIds)

export const batchUndeployDevice_api = (deviceIds: string[]) => request.put('/device/instance/batch/_unDeploy', deviceIds)

export const deleteDevice_api = (deviceId: string) => request.remove(`/device/instance/${deviceId}`)
