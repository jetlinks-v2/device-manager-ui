import type { ServiceResult } from '@jetlinks-web-core/utils/service-result'

import type {
  Iot2DeviceTypeCategory,
  Iot2DeviceTypeIndustry,
  Iot2DeviceTypeProtocol,
  Iot2ProductTemplate,
  Iot2TemplateParameterOption,
  Iot2TemplateParameterValues,
} from '@device-manager-ui/views/device/shared/device-library/services/iot2.types'

export type IotDeviceLibraryFilterGroup = 'industry' | 'protocol' | 'category' | 'brand'

export interface IotDeviceLibraryTagOption {
  key: string
  label: string
  count: number
  group: IotDeviceLibraryFilterGroup
}

export interface IotDeviceLibraryQuery {
  projectId: string
  keyword: string
  searchField: 'all' | 'name' | 'brand' | 'model' | 'tag' | 'description'
  industry: 'all' | Iot2DeviceTypeIndustry
  protocol: 'all' | Iot2DeviceTypeProtocol
  category: 'all' | Iot2DeviceTypeCategory
  brand: string
  page: number
  pageSize: number
}

export interface IotDeviceLibraryTemplateCard {
  id: string
  name: string
  icon: string
  description: string
  brand: string
  model: string
  protocol: Iot2DeviceTypeProtocol
  category: Iot2DeviceTypeCategory
  industry: Iot2DeviceTypeIndustry
  tags: string[]
  version: string
  maintainer: string
  updatedAt: string
  usageCount: number
  popularity: number
  joined: boolean
  joinedProductName?: string
}

export interface IotDeviceLibraryListResult {
  projectId: string
  tenantId: string
  updatedAt: string
  items: IotDeviceLibraryTemplateCard[]
  total: number
  page: number
  pageSize: number
  filters: Record<IotDeviceLibraryFilterGroup, IotDeviceLibraryTagOption[]>
}

export interface IotDeviceLibraryJoinedProduct {
  id: string
  tenantId: string
  templateId: string
  productName: string
  createdAt: string
}

export interface IotDeviceLibraryTemplateDetail {
  projectId: string
  tenantId: string
  template: Iot2ProductTemplate
  joined: boolean
  joinedProductName?: string
  productCountHint: string
  marketInfo: IotDeviceLibraryMarketInfo
  documents: IotDeviceLibraryTemplateDocuments
  connectionHealthConfig: IotDeviceLibraryConnectionHealthConfig
  thingModelDefinition: IotDeviceLibraryThingModelDefinition
}

export interface IotDeviceLibraryVersionRecord {
  id: string
  version: string
  status: 'current' | 'history'
  releaseDate: string
  summary: string
  changeType: 'release' | 'compatible' | 'config'
  maintainer: string
}

export interface IotDeviceLibraryMarketInfo {
  resourceId: string
  providerName: string
  providerType: string
  currentVersion: string
  compatibility: string
  lastPublishedAt: string
  releaseChannel: string
  installHint: string
  supportStatement: string
  versionHistory: IotDeviceLibraryVersionRecord[]
}

export interface IotDeviceLibraryDocumentContent {
  title: string
  summary: string
  body: string
  updatedAt: string
}

export interface IotDeviceLibraryMaintenanceDoc {
  title: string
  summary: string
  body: string
  knowledgeBaseRef: string
  faultCodes: IotDeviceLibraryFaultCode[]
  updatedAt: string
}

export interface IotDeviceLibraryFaultCode {
  code: string
  level: 'critical' | 'major' | 'minor'
  title: string
  symptom: string
  suggestion: string
}

export interface IotDeviceLibraryTemplateDocuments {
  accessGuide: IotDeviceLibraryDocumentContent
  protocolDoc: IotDeviceLibraryDocumentContent
  maintenanceLibrary: IotDeviceLibraryMaintenanceDoc
  marketDoc: IotDeviceLibraryDocumentContent
}

export interface IotDeviceLibraryConnectionHealthConfig {
  noData: IotDeviceLibraryConnectionHealthRule
  offline: IotDeviceLibraryConnectionHealthRule
  fluctuation: IotDeviceLibraryConnectionHealthRule
}

export interface IotDeviceLibraryConnectionHealthRule {
  enabled: boolean
  title: string
  condition: string
  severity: 'watch' | 'urgent'
  description: string
  suggestion: string
}

export interface IotDeviceLibraryThingModelDefinition {
  description: string
  properties: IotDeviceLibraryThingModelProperty[]
  events: IotDeviceLibraryThingModelEvent[]
  functions: IotDeviceLibraryThingModelFunction[]
  tags: IotDeviceLibraryThingModelTag[]
}

export interface IotDeviceLibraryThingModelThresholdRule {
  metric: string
  operator: '>' | '>=' | '<' | '<=' | 'range' | 'deviation'
  value: string
  action: string
}

export interface IotDeviceLibraryThingModelConfigItem {
  identifier: string
  name: string
  dataType: string
  required?: boolean
}

export interface IotDeviceLibraryThingModelProperty {
  id: string
  name: string
  identifier: string
  dataType: string
  accessMode: string
  source: string
  tags: string[]
  description: string
  expandedConfig: IotDeviceLibraryThingModelExpandedConfig
}

export interface IotDeviceLibraryThingModelEvent {
  id: string
  name: string
  identifier: string
  dataType: string
  level: string
  description: string
  outputs: IotDeviceLibraryThingModelConfigItem[]
  expandedConfig: IotDeviceLibraryThingModelExpandedConfig
}

export interface IotDeviceLibraryThingModelFunction {
  id: string
  name: string
  identifier: string
  dataType: string
  callMode: string
  description: string
  inputs: IotDeviceLibraryThingModelConfigItem[]
  outputs: IotDeviceLibraryThingModelConfigItem[]
  expandedConfig: IotDeviceLibraryThingModelExpandedConfig
}

export interface IotDeviceLibraryThingModelTag {
  id: string
  name: string
  identifier: string
  dataType: string
  description: string
}

export interface IotDeviceLibraryThingModelExpandedConfig {
  displayName: string
  valueType: string
  reportStrategy: string
  items: IotDeviceLibraryThingModelConfigItem[]
  thresholds: IotDeviceLibraryThingModelThresholdRule[]
  deviationConfig: IotDeviceLibraryThingModelDeviationConfig
}

export interface IotDeviceLibraryThingModelDeviationConfig {
  normalRange: string
  warningRange: string
  alarmRange: string
  description: string
  suggestion: string
}

export interface IotDeviceLibraryJoinInput {
  projectId: string
  tenantId: string
  templateId: string
  productName: string
  config: Iot2TemplateParameterValues
}

export interface IotDeviceLibraryJoinResult {
  product: IotDeviceLibraryJoinedProduct
  nextDeviceTarget: string
}

export interface IotDeviceLibraryProjectOption {
  key: string
  label: string
  disabled?: boolean
  disabledReason?: string
}

export interface IotDeviceLibraryAdapter {
  listTemplates(query: IotDeviceLibraryQuery): Promise<ServiceResult<IotDeviceLibraryListResult>>
  getTemplate(projectId: string, templateId: string): Promise<ServiceResult<IotDeviceLibraryTemplateDetail>>
  joinProject(input: IotDeviceLibraryJoinInput): Promise<ServiceResult<IotDeviceLibraryJoinResult>>
  listParameterOptions(
    projectId: string,
    templateId: string,
    fieldKey: string,
    values: Iot2TemplateParameterValues,
  ): Promise<ServiceResult<Iot2TemplateParameterOption[]>>
}

