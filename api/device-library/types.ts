import type { IotDevice, IotDeviceConnectionStatus } from '@device-manager-ui/views/device/list/types'

export type MaybeEnum = string | {
  value?: string
  text?: string
  label?: string
  name?: string
}
export type IotDeviceTypeValue = 'device' | 'childrenDevice' | 'gateway'

type DeviceTag = {
  key?: string
  name?: string
  value?: string
}

type DeviceRelation = {
  label?: string
  name?: string
  value?: string
  hint?: string
}

export type DeviceExtension = {
  iot?: {
    projectId?: string
    areaId?: string
    area?: string
    location?: string
    scenario?: string
    owner?: string
    tags?: string[]
  }
  projectId?: string
  areaId?: string
  area?: string
  location?: string
  scenario?: string
  owner?: string
  tags?: string[]
}

type IotTemplateExtension = {
  templateId?: string
  category?: IotDeviceProductCategory
  sourceProduct?: string
  supportedManufacturers?: string[]
  modelKeywords?: string[]
}

export type DeviceQueryTerm = {
  column?: string
  termType?: string
  value?: unknown
  type?: string
  terms?: DeviceQueryTerm[]
  skipKeywordExpand?: boolean
}

export type DeviceQueryParams = {
  pageIndex?: number
  pageSize?: number
  terms?: DeviceQueryTerm[]
  sorts?: Array<{
    name: string
    order?: 'asc' | 'desc' | string
  }>
}

export type DeviceDetailResponse = {
  id?: string
  name?: string
  productId?: string
  productName?: string
  productManufacturer?: string
  productModel?: string
  productPhotoUrl?: string
  devicePhotoUrl?: string
  photoUrl?: string
  deviceType?: MaybeEnum
  state?: MaybeEnum
  address?: string
  orgName?: string
  classifiedName?: string
  accessName?: string
  accessProvider?: string
  description?: string
  describe?: string
  identifier?: string
  configuration?: Record<string, unknown>
  extensions?: DeviceExtension
  createTime?: number
  registerTime?: number
  registryTime?: number
  onlineTime?: number
  offlineTime?: number
  creatorName?: string
  modifierName?: string
  tags?: DeviceTag[]
  relations?: DeviceRelation[]
}

export type PagerResult<T> = {
  data?: T[]
  total?: number
  pageIndex?: number
  pageSize?: number
}

export type ApiResponse<T> = {
  success?: boolean
  result?: T
  message?: string
}

export type FileUploadResponse = {
  accessUrl?: string
  url?: string
  fileUrl?: string
}

export type DeviceDocumentType =
  | 'access-guide'
  | 'protocol-doc'
  | 'maintenance'
  | 'market-doc'
  | 'other'

export type DeviceDocumentBind = {
  id?: string
  fileId?: string
  documentType?: DeviceDocumentType | string
  objectType?: string
  objectId?: string
  name?: string
  sortIndex?: number
  createTime?: number
  modifyTime?: number
}

export type ProjectRuntimeContext = {
  projectId: string
  apiUrl: string
  token: string
  domain?: string
}

export type IotDeviceProductCategory =
  | 'video'
  | 'meter'
  | 'sensor'
  | 'industrial'
  | 'integration'

export type IotDeviceTemplateTagGroup = {
  key: string
  label: string
  values: string[]
}

export type IotDeviceProductTemplate = {
  id: string
  name: string
  summary: string
  category: IotDeviceProductCategory
  accessName: string
  sourceProduct: string
  manufacturer?: string
  model?: string
  tags?: string[]
  tagIds?: string[]
  tagGroups?: IotDeviceTemplateTagGroup[]
  installed?: boolean
  installedProductId?: string
  supportedManufacturers: string[]
  modelKeywords: string[]
  templateId?: string
  deviceType?: string
  productName?: string
  photoUrl?: string
  faultCodeDict?: unknown[]
  version?: string
  accessId?: string
  accessProvider?: string
  networkWay?: string
  transportProtocol?: string
  messageProtocol?: string
  protocolName?: string
  gatewayBizKey?: string
  configuration?: Record<string, unknown>
  accessModes?: string[]
  supportedModels?: DeviceTemplateProductInput['supportedModels']
  dataPoints?: DeviceTemplateProductInput['dataPoints']
}

export type DeviceLibraryProductFilterOption = {
  templateId: string
  productId: string
  productName: string
  accessName?: string
  accessProvider?: string
}

export type IotDeviceLibraryTag = {
  id: string
  name: string
}

export type IotDeviceLibraryTagGroup = {
  id: string
  name: string
  tags: IotDeviceLibraryTag[]
}

export type DeviceLibraryTemplateQueryInput = {
  projectId?: string
  pageIndex?: number
  pageSize?: number
  keyword?: string
  tags?: string[]
  deviceType?: string
}

export type DeviceLibraryTemplatePageResult = {
  data: DeviceTemplateProductInput[]
  total: number
  pageIndex: number
  pageSize: number
}
export type ProductDetailResponse = {
  id?: string
  name?: string
  createTime?: number | string
  projectId?: string
  photoUrl?: string
  description?: string
  describe?: string
  classifiedId?: string
  classifiedName?: string
  templateId?: string
  manufacturer?: string
  model?: string
  accessId?: string
  accessName?: string
  accessProvider?: string
  networkWay?: string
  transportProtocol?: string
  deviceType?: MaybeEnum
  state?: number | string
  messageProtocol?: string
  protocolName?: string
  gatewayBizKey?: string
  metadata?: unknown
  configuration?: Record<string, unknown>
  storePolicy?: string
  extensions?: {
    iotTemplate?: IotTemplateExtension
  }
}

export type DeviceLibraryGatewayDetail = {
  id?: string
  provider?: string
  bizKey?: string
  protocol?: string
  transport?: string
}

export type DeviceGatewayDetailResponse = DeviceLibraryGatewayDetail & {
  state?: MaybeEnum
}

export type CreateDeviceApiInput = {
  projectId: string
  productKey: string
  productName?: string
  productDeviceType?: string
  parentId?: string
  name: string
  areaId?: string
  area?: string
  location?: string
  scenario?: string
  owner?: string
  groupId?: string
  imageUrl?: string
  description?: string
  tags?: string[]
}

export type UpdateDeviceBasicInfoApiInput = {
  id: string
  projectId: string
  productKey?: string
  productName?: string
  productDeviceType?: string
  name: string
  areaId?: string
  area?: string
  location?: string
  scenario?: string
  owner?: string
  imageUrl?: string
  description?: string
  tags?: string[]
}

export type DeviceTemplateProductInput = {
  id: string
  name: string
  i18nMessages?: Record<string, Record<string, string>>
  summary?: string
  category?: IotDeviceProductCategory
  photoUrl?: string
  description?: string
  describe?: string
  classifiedId?: string
  classifiedName?: string
  accessId?: string
  sourceProduct?: string
  manufacturer?: string
  model?: string
  tags?: string[]
  tagIds?: string[]
  tagGroups?: IotDeviceTemplateTagGroup[]
  installed?: boolean
  installedProductId?: string
  supportedManufacturers?: string[]
  modelKeywords?: string[]
  deviceType?: MaybeEnum
  accessName?: string
  accessProvider?: string
  networkWay?: string
  transportProtocol?: string
  messageProtocol?: string
  protocolName?: string
  gatewayBizKey?: string
  metadata?: unknown
  configuration?: Record<string, unknown>
  storePolicy?: string
  accessModes?: string[]
  version?: string
  supportedModels?: Array<{
    manufacturer?: string
    models?: string[]
    accessMode?: string
    accessName?: string
    requirements?: string[]
  }>
  dataPoints?: Array<{
    key?: string
    name?: string
    desc?: string
    kind?: string
  }>
  faultCodeDict?: unknown[]
  telemetryNormalRanges?: unknown[]
  knowledgeBase?: unknown[]
}

export type CreateProductFromTemplateInput = {
  projectId: string
  template: DeviceTemplateProductInput
  productId?: string
}

export type JoinDeviceLibraryInput = {
  projectId: string
  template: DeviceTemplateProductInput
  productName?: string
  device?: Omit<CreateDeviceApiInput, 'productKey' | 'productName' | 'productDeviceType'>
}

export type DeviceLibraryInstallProgress = {
  type: string
  message: string
  extra?: unknown
  payload?: unknown
}

export type DeviceLibraryInstallOptions = {
  onProgress?: (progress: DeviceLibraryInstallProgress) => void
  updateProduct?: boolean
}

export type IotDeviceAreaOption = {
  id: string
  name: string
  type?: string
  parentId?: string
}

export type IotDeviceRoleOption = {
  id: string
  name: string
}

export type TreeNodeResponse = {
  id?: string
  name?: string
  type?: string
  parentId?: string
  children?: TreeNodeResponse[]
}

export type RoleResponse = {
  id?: string
  name?: string
}

export type DevicePageResult = {
  data: IotDevice[]
  total: number
  pageIndex: number
  pageSize: number
}
