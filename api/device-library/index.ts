import { createNdJson, request } from '@jetlinks-web/core'
import { TOKEN_KEY } from '@jetlinks-web/constants'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getProjectStorage } from '@jetlinks-web-core/utils/project-storage'
import { langKey } from '@jetlinks-web-core/utils/consts'
import i18n from '@jetlinks-web-core/locales'

import type { IotDevice } from '@device-manager-ui/views/device/list/types'
import type {
  DeviceLibraryGatewayDetail,
  DeviceLibraryInstallOptions,
  DeviceLibraryInstallProgress,
  DeviceLibraryProductFilterOption,
  DeviceLibraryTemplatePageResult,
  DeviceLibraryTemplateQueryInput,
  DeviceTemplateProductInput,
  IotDeviceLibraryTag,
  IotDeviceLibraryTagGroup,
  IotDeviceProductCategory,
  IotDeviceProductTemplate,
  IotDeviceTemplateTagGroup,
  JoinDeviceLibraryInput,
  MaybeEnum,
} from './types'

const t = (key: string) => i18n.global.t(key)

type MarketplaceResource = Record<string, any>
type MarketplaceVersion = Record<string, any>
type ProductDetailResponse = {
  id?: string
  name?: string
  createTime?: number | string
  accessName?: string
  accessProvider?: string
}
type DeviceGatewayDetailResponse = DeviceLibraryGatewayDetail & {
  state?: MaybeEnum
}
type InstalledCapabilityResponse = {
  capabilityId?: string
  resourceId?: string
  resourcesId?: string
  type?: string
  id?: string
  dataId?: string
  productId?: string
  data?: { dataId?: string; productId?: string; id?: string }
  result?: { dataId?: string; productId?: string; id?: string }
  extra?: { dataId?: string; productId?: string; id?: string }
}
type RuntimeInstallObserver = {
  next?: (payload: any) => void
  error?: (error: unknown) => void
  complete?: () => void
}
type RuntimeInstallSource = {
  subscribe: (observer: RuntimeInstallObserver) => { unsubscribe: () => void }
}
type ProjectRuntimeContext = {
  projectId: string
  apiUrl: string
  token: string
  domain?: string
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

const currentLocale = () => String(i18n.global.locale.value || '').replace('_', '-')

const accessProviderI18nKeys: Record<string, string> = {
  'mqtt-server-gateway': 'Marketplace.Resource.deviceLibraryGatewayMqttDirect',
  'composite-device-gateway': 'Marketplace.Resource.deviceLibraryGatewayComposite',
  'websocket-server': 'Marketplace.Resource.deviceLibraryGatewayWebsocket',
  'coap-server-gateway': 'Marketplace.Resource.deviceLibraryGatewayCoap',
  plugin_gateway: 'Marketplace.Resource.deviceLibraryGatewayPlugin',
  'tcp-server-gateway': 'Marketplace.Resource.deviceLibraryGatewayTcpTransparent',
  'child-device': 'Marketplace.Resource.deviceLibraryGatewayChildDevice',
  'http-server-gateway': 'Marketplace.Resource.deviceLibraryGatewayHttpPush',
  'udp-device-gateway': 'Marketplace.Resource.deviceLibraryGatewayUdp',
  'gb28181-2016': 'Marketplace.Resource.deviceLibraryGatewayGb28181',
  'collector-gateway': 'Marketplace.Resource.deviceLibraryGatewayCollector',
  'mqtt-client-gateway': 'Marketplace.Resource.deviceLibraryGatewayMqttBroker',
}

const localizeAccessProviderName = (accessProvider: string, fallback: string) => {
  const key = accessProviderI18nKeys[accessProvider]
  if (!key) return fallback
  const localized = String(i18n.global.t(key)).trim()
  return localized && localized !== key ? localized : fallback
}

const normalizeProjectRuntimeApiUrl = (apiUrl?: string) =>
  (import.meta.env.VITE_APP_PROJECT_RUNTIME_API_URL || apiUrl || '').trim().replace(/\/$/, '')

const getProjectRuntimeContext = (_required = true): ProjectRuntimeContext => {
  const projectId = getProjectIdFromLocation()
  const projectStorage = getProjectStorage(projectId)
  const apiUrl = normalizeProjectRuntimeApiUrl(projectStorage?.apiUrl)
  const token = projectStorage?.token?.trim()
  const runtimeProjectId = firstString(projectStorage?.id, projectId)

  if (runtimeProjectId && apiUrl && token) {
    return { projectId: runtimeProjectId, apiUrl, token, domain: projectStorage?.domain }
  }

  throw new Error(t('IotDeviceApi.error.runtimeAccessMissing'))
}

const withProjectRuntimeRequest = (context: ProjectRuntimeContext) => {
  const headers: Record<string, string> = { [TOKEN_KEY]: context.token }
  if (context.domain) headers['X-Tenant-Domain'] = context.domain
  return { baseURL: context.apiUrl, headers }
}

const marketplaceNdJson = createNdJson({
  langKey,
  requestOptions(config) {
    return { headers: { ...((config.headers ?? {}) as Record<string, string>), Accept: 'application/x-ndjson' } }
  },
  handleRequest(config) {
    const context = getProjectRuntimeContext()
    return {
      ...config,
      baseURL: context.apiUrl,
      headers: { ...((config.headers ?? {}) as Record<string, string>), ...withProjectRuntimeRequest(context).headers },
    }
  },
})

const buildNoPagingBody = (terms: Record<string, unknown>[] = []) => ({
  paging: false,
  sorts: [{ name: 'createTime', order: 'desc' }],
  terms,
})

const normalizeDeviceTypeValue = (deviceType?: unknown) => {
  const raw = isRecord(deviceType)
    ? firstString(deviceType.value, deviceType.name)
    : firstString(deviceType)
  const key = raw.replace(/[-_]/g, '').toLowerCase()
  return ({
    device: 'device', direct: 'device', directdevice: 'device',
    childrendevice: 'childrenDevice', childdevice: 'childrenDevice', subdevice: 'childrenDevice',
    gateway: 'gateway', gatewaydevice: 'gateway',
  } as Record<string, string>)[key] ?? 'device'
}

const buildInstallDeviceBody = (input: JoinDeviceLibraryInput) => {
  if (!input.device) return undefined
  const device = input.device
  return {
    name: device.name.trim(),
    productId: '',
    productName: input.productName || input.template.name,
    deviceType: normalizeDeviceTypeValue(input.template.deviceType),
    parentId: device.parentId || undefined,
    photoUrl: device.imageUrl || undefined,
    describe: device.description?.trim() || [device.area, device.location, device.scenario, device.owner]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' · '),
    extensions: {
      iot: {
        projectId: input.projectId,
        areaId: device.areaId || '',
        area: device.area || '',
        location: device.location || '',
        scenario: device.scenario || '',
        owner: device.owner || '',
        ...(device.tags === undefined ? {} : { tags: device.tags }),
      },
    },
    groupId: device.groupId || undefined,
  }
}

const resolveI18nField = (messages: unknown, field: string, fallback: string) => {
  if (!isRecord(messages) || !isRecord(messages[field])) return fallback
  const locale = currentLocale()
  const values = messages[field]
  const text = firstString(values[locale], locale.includes('-') ? values[locale.split('-')[0]] : undefined)
  return text || fallback
}

const localizeThingValueType = (value: unknown): Record<string, any> => {
  if (!isRecord(value)) return {}
  const i18nMessages = value.i18nMessages
  return {
    ...value,
    unit: resolveI18nField(i18nMessages, 'unit', firstString(value.unit)),
    trueText: resolveI18nField(i18nMessages, 'trueText', firstString(value.trueText)),
    falseText: resolveI18nField(i18nMessages, 'falseText', firstString(value.falseText)),
    ...(Array.isArray(value.elements)
      ? {
          elements: value.elements.map((element) => isRecord(element)
            ? {
                ...element,
                text: resolveI18nField(element.i18nMessages, 'text', firstString(element.text)),
              }
            : element),
        }
      : {}),
    ...(Array.isArray(value.properties)
      ? { properties: value.properties.map(localizeThingModelItem) }
      : {}),
    ...(isRecord(value.elementType)
      ? { elementType: localizeThingValueType(value.elementType) }
      : {}),
  }
}

const localizeThingModelItem = (value: unknown): Record<string, any> => {
  if (!isRecord(value)) return {}
  const i18nMessages = value.i18nMessages
  return {
    ...value,
    name: resolveI18nField(i18nMessages, 'name', firstString(value.name)),
    description: resolveI18nField(i18nMessages, 'description', firstString(value.description)),
    ...(isRecord(value.valueType) ? { valueType: localizeThingValueType(value.valueType) } : {}),
    ...(isRecord(value.output) ? { output: localizeThingValueType(value.output) } : {}),
    ...(Array.isArray(value.inputs) ? { inputs: value.inputs.map(localizeThingModelItem) } : {}),
    ...(Array.isArray(value.outputs) ? { outputs: value.outputs.map(localizeThingModelItem) } : {}),
  }
}

const localizeThingModel = (value: unknown) => {
  if (!isRecord(value)) return {}
  return {
    ...value,
    properties: Array.isArray(value.properties) ? value.properties.map(localizeThingModelItem) : [],
    functions: Array.isArray(value.functions) ? value.functions.map(localizeThingModelItem) : [],
    events: Array.isArray(value.events) ? value.events.map(localizeThingModelItem) : [],
    tags: Array.isArray(value.tags) ? value.tags.map(localizeThingModelItem) : [],
  }
}

const imageUrlFromIconValue = (value: unknown) => {
  const text = firstString(value)
  if (!text) return ''
  if (/^img:\s*/i.test(text)) return text.replace(/^img:\s*/i, '').trim()
  return /^https?:\/\//i.test(text) || text.startsWith('//') || text.startsWith('data:image') || text.startsWith('/')
    ? text
    : ''
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

const unwrapPage = <T>(
  payload: unknown,
  fallbackPageIndex: number,
  fallbackPageSize: number,
) => {
  const result = isRecord(payload) && 'result' in payload
    ? payload.result
    : isRecord(payload) && 'data' in payload
      ? payload.data
      : payload
  const inferTotal = (dataLength: number) => fallbackPageIndex * fallbackPageSize + dataLength

  if (Array.isArray(result)) {
    return {
      data: result as T[],
      total: inferTotal(result.length),
      pageIndex: fallbackPageIndex,
      pageSize: fallbackPageSize,
    }
  }

  if (isRecord(result)) {
    const data = Array.isArray(result.data)
      ? result.data as T[]
      : Array.isArray(result.records)
        ? result.records as T[]
        : []
    return {
      data,
      total: Number(result.total ?? inferTotal(data.length)),
      pageIndex: Number(result.pageIndex ?? fallbackPageIndex),
      pageSize: Number(result.pageSize ?? fallbackPageSize),
    }
  }

  return {
    data: [],
    total: 0,
    pageIndex: fallbackPageIndex,
    pageSize: fallbackPageSize,
  }
}

const formatTime = (value: unknown) => {
  const timestamp = Number(value || 0)
  if (!timestamp) return '--'
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
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

const templateResourceOf = (source?: MarketplaceVersion) => {
  const resources = Array.isArray(source?.resources) ? source!.resources : []
  return resources.find((item: any) => item?.type === 'device-template') ?? resources[0]
}

function normalizeMarketplaceTag(node: any): IotDeviceLibraryTag | null {
  const id = firstString(node?.id, node?.key, node?.value, node?.name)
  if (!id) return null
  return {
    id,
    name: firstString(node?.name, node?.label, node?.text, id),
  }
}

function collectMarketplaceTags(nodes: any, acc: IotDeviceLibraryTag[] = []): IotDeviceLibraryTag[] {
  if (!Array.isArray(nodes)) return acc
  for (const node of nodes) {
    const tag = normalizeMarketplaceTag(node)
    if (tag) acc.push(tag)
    if (node?.children?.length) collectMarketplaceTags(node.children, acc)
  }
  return acc
}

function normalizeMarketplaceTagGroups(payload: unknown): IotDeviceLibraryTagGroup[] {
  const groups: IotDeviceLibraryTagGroup[] = []
  const collectGroups = (classifiers: any[] = []) => {
    classifiers.forEach((classifier) => {
      const id = firstString(classifier?.id, classifier?.key, classifier?.name)
      const tags = collectMarketplaceTags(classifier?.tags)
      if (id && tags.length) {
        groups.push({
          id,
          name: firstString(classifier?.name, classifier?.label, classifier?.text, id),
          tags,
        })
      }
      if (Array.isArray(classifier?.children)) collectGroups(classifier.children)
    })
  }

  collectGroups(unwrapArray<any>(payload))
  return groups
}

type MarketplaceTagLocaleLookup = {
  tagNames: Map<string, string>
  classifierNames: Map<string, string>
}

function createMarketplaceTagLocaleLookup(payload: unknown): MarketplaceTagLocaleLookup {
  const lookup: MarketplaceTagLocaleLookup = {
    tagNames: new Map(),
    classifierNames: new Map(),
  }
  const collectClassifiers = (classifiers: any[] = []) => {
    classifiers.forEach((classifier) => {
      const classifierId = firstString(classifier?.id, classifier?.key)
      const classifierName = firstString(classifier?.name, classifier?.label, classifier?.text)
      if (classifierId && classifierName) lookup.classifierNames.set(classifierId, classifierName)

      collectMarketplaceTags(classifier?.tags).forEach((tag) => lookup.tagNames.set(tag.id, tag.name))
      if (Array.isArray(classifier?.children)) collectClassifiers(classifier.children)
    })
  }

  collectClassifiers(unwrapArray<any>(payload))
  return lookup
}

function marketplaceTagAliases(tag: unknown) {
  if (typeof tag === 'string') return [tag.trim()].filter(Boolean)
  if (!isRecord(tag)) return []
  return [
    tag.id,
    tag.key,
    tag.value,
    tag.code,
    tag.name,
    tag.label,
    tag.text,
  ]
    .map((item) => firstString(item))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
}

function marketplaceTagLabel(tag: unknown, fallback = '') {
  if (typeof tag === 'string') return fallback || tag.trim()
  if (!isRecord(tag)) return fallback
  return firstString(tag.name, tag.label, tag.text, fallback)
}

function marketplaceTagGroupLabel(tag: unknown) {
  if (!isRecord(tag)) return ''
  return firstString(
    tag.classifierName,
    tag.categoryName,
    tag.groupName,
    isRecord(tag.classifier) ? tag.classifier.name : '',
    isRecord(tag.category) ? tag.category.name : '',
  )
}

function normalizeResourceTagSummary(value: unknown, lookup?: MarketplaceTagLocaleLookup) {
  const rawTags = Array.isArray(value) ? value : []
  const ids: string[] = []
  const labels: string[] = []
  const groupMap = new Map<string, IotDeviceTemplateTagGroup>()

  rawTags.forEach((tag) => {
    const aliases = marketplaceTagAliases(tag)
    const id = aliases[0] || ''
    const label = lookup?.tagNames.get(id) || marketplaceTagLabel(tag, id)
    if (!label) return
    if (id) ids.push(id)
    if (!labels.includes(label)) labels.push(label)

    const classifierId = isRecord(tag) ? firstString(tag.classifierId, tag.categoryId) : ''
    const groupLabel = lookup?.classifierNames.get(classifierId) || marketplaceTagGroupLabel(tag)
    if (!groupLabel) return
    const key = firstString(
      classifierId,
      groupLabel,
    )
    const group = groupMap.get(key) ?? { key, label: groupLabel, values: [] }
    if (!group.values.includes(label)) group.values.push(label)
    groupMap.set(key, group)
  })

  return {
    ids: [...new Set(ids)],
    labels,
    groups: [...groupMap.values()].filter((group) => group.values.length),
  }
}

function marketplaceResourceTagsOf(resource: MarketplaceResource) {
  return resource.tags
    ?? resource.info?.tags
    ?? resource.metadata?.info?.tags
    ?? resource.capabilityPackage?.info?.tags
    ?? resource.packageInfo?.tags
    ?? []
}

const toVersionTime = (version: MarketplaceVersion) => {
  const time = Number(version.releaseTime ?? version.createTime ?? version.updateTime)
  return Number.isFinite(time) ? time : 0
}

const latestPublishedVersion = (versions: MarketplaceVersion[]) => {
  const sorted = [...versions].sort((left, right) => {
    const timeGap = toVersionTime(right) - toVersionTime(left)
    if (timeGap !== 0) return timeGap
    return String(right.version ?? '').localeCompare(String(left.version ?? ''))
  })
  return sorted.find((item) => {
    const state = firstString(item.state, item.status, item.releaseState, item.publishState).toLowerCase()
    const published = !state || ['enabled', 'published', 'released', 'release', 'current'].includes(state)
    return published && templateResourceOf(item)
  }) ?? sorted.find((item) => {
    const state = firstString(item.state, item.status, item.releaseState, item.publishState).toLowerCase()
    return !state || ['enabled', 'published', 'released', 'release', 'current'].includes(state)
  }) ?? sorted[0]
}


const toDeviceLibraryCategory = (source: Record<string, any>, resource: MarketplaceResource): IotDeviceProductCategory => {
  const text = [
    source.industry,
    source.manufacturer,
    source.model,
    source.name,
    resource.name,
    source.description,
    resource.description,
  ].filter(Boolean).join(' ')

  if (/视频|摄像|camera|gb28181|onvif|security/i.test(text)) return 'video'
  if (/表|电|水表|流量|meter|energy/i.test(text)) return 'meter'
  if (/工控|PLC|modbus|工业|采集|控制|manufacturing/i.test(text)) return 'industrial'
  if (/平台|系统|对接|integration|http/i.test(text)) return 'integration'
  return 'sensor'
}

const toDeviceLibraryTemplateInput = (
  resource: MarketplaceResource,
  version?: MarketplaceVersion,
  versionResource?: MarketplaceResource,
  tagLookup?: MarketplaceTagLocaleLookup,
): DeviceTemplateProductInput => {
  const resourceMetadata = isRecord(resource.metadata) ? resource.metadata : {}
  const versionMetadata = isRecord(versionResource?.metadata) ? versionResource.metadata : {}
  const source = isRecord(versionMetadata.template)
    ? versionMetadata.template
    : isRecord(resourceMetadata.template)
      ? resourceMetadata.template
      : {}
  const accessProvider = firstString(
    source.accessProvider,
    versionResource?.accessProvider,
    versionMetadata.accessProvider,
    resource.accessProvider,
    resourceMetadata.accessProvider,
  )
  const accessName = firstString(source.accessName, source.accessProviderName, accessProvider, source.protocolName, source.protocol)
  // 设备库版本既可能直接返回物模型，也可能将其放在模板 metadata 中。
  const thingModel = isRecord(source.thingModel)
    ? source.thingModel
    : isRecord(source.metadata)
      ? source.metadata
      : {}
  const marketplaceTags = marketplaceResourceTagsOf(resource)
  const resourceTags = normalizeResourceTagSummary(marketplaceTags, tagLookup)
  const resourceI18nMessages = isRecord(resource.i18nMessages) ? resource.i18nMessages : undefined
  const defaultName = firstString(resource.name, source.name, versionResource?.name, resource.code, resource.id) || '--'
  const defaultDescription = firstString(resource.description)
  const defaultClassifiedName = firstString(source.classifiedName, source.industry)
  const sourceI18nMessages = isRecord(source.i18nMessages) ? source.i18nMessages : undefined
  const manufacturer = resolveI18nField(sourceI18nMessages, 'manufacturer', firstString(source.manufacturer))
  const model = resolveI18nField(sourceI18nMessages, 'model', firstString(source.model))
  const localizedThingModel = localizeThingModel(thingModel)
  const localizedAccessName = resolveI18nField(
    sourceI18nMessages,
    'accessName',
    localizeAccessProviderName(accessProvider, accessName),
  )

  return {
    id: String(resource.id || source.id || source.code || ''),
    name: resolveI18nField(resourceI18nMessages, 'name', defaultName),
    i18nMessages: resourceI18nMessages as Record<string, Record<string, string>> | undefined,
    summary: resolveI18nField(resourceI18nMessages, 'description', defaultDescription),
    category: toDeviceLibraryCategory(source, resource),
    photoUrl: imageUrlFromIconValue(resource.icon),
    description: resolveI18nField(resourceI18nMessages, 'description', defaultDescription),
    describe: resolveI18nField(resourceI18nMessages, 'description', defaultDescription),
    classifiedId: firstString(source.classifiedId),
    classifiedName: resolveI18nField(sourceI18nMessages, 'classifiedName', defaultClassifiedName),
    accessId: firstString(source.accessId),
    sourceProduct: firstString(manufacturer, model, resource.name),
    manufacturer,
    model,
    tags: resourceTags.labels,
    tagIds: resourceTags.ids,
    tagGroups: resourceTags.groups,
    supportedManufacturers: [manufacturer].filter((value): value is string => Boolean(firstString(value))),
    modelKeywords: [
      resource.id,
      resource.code,
      source.code,
      source.manufacturer,
      source.model,
      source.protocolName,
      source.protocol,
      source.messageProtocol,
      source.transportProtocol,
      ...(Array.isArray(marketplaceTags) ? marketplaceTags.map((tag: any) => firstString(tag.name, tag.label, tag.text, tag)) : []),
    ].map((value) => firstString(value)).filter(Boolean),
    deviceType: firstString(source.deviceType) || 'device',
    accessName: localizedAccessName,
    accessProvider,
    networkWay: firstString(source.networkWay),
    transportProtocol: firstString(source.transportProtocol),
    messageProtocol: firstString(source.messageProtocol),
    protocolName: firstString(source.protocolName),
    gatewayBizKey: firstString(source.gatewayBizKey),
    metadata: localizedThingModel,
    configuration: isRecord(source.configuration) ? source.configuration : undefined,
    storePolicy: firstString(source.storePolicy),
    accessModes: accessProvider ? [accessProvider] : [],
    version: firstString(version?.version, versionResource?.version),
    supportedModels: source.manufacturer || source.model || accessProvider
      ? [{
        manufacturer: firstString(source.manufacturer),
        models: [firstString(source.model)].filter(Boolean),
        accessMode: accessProvider,
        accessName: localizedAccessName,
        requirements: Array.isArray(source.requirements) ? source.requirements : [],
      }]
      : [],
    dataPoints: [
      ...toThingModelDataPoints(localizedThingModel.properties, 'telemetry'),
      ...toThingModelDataPoints(localizedThingModel.events, 'event'),
      ...toThingModelDataPoints(localizedThingModel.functions, 'function'),
    ],
    faultCodeDict: Array.isArray(source.faultCodeDict) ? source.faultCodeDict : undefined,
    telemetryNormalRanges: Array.isArray(source.telemetryNormalRanges) ? source.telemetryNormalRanges : undefined,
    knowledgeBase: Array.isArray(source.knowledgeBase) ? source.knowledgeBase : undefined,
  }
}

function toThingModelDataPoints(items: unknown, kind: 'telemetry' | 'event' | 'function') {
  if (!Array.isArray(items)) return []
  return items
    .filter(isRecord)
    .map((item) => ({
      key: firstString(item.id, item.identifier, item.key),
      name: firstString(item.name, item.id, item.identifier),
      desc: firstString(item.description, item.desc),
      kind,
    }))
}

const getMarketplaceCapabilityVersions = (id: string) =>
  request.get(`/marketplace/capabilities/${encodeURIComponent(id)}/versions`, {}, { projectContext: false })

async function resolveDeviceLibraryVersionResource(
  resource: MarketplaceResource,
  tagLookup?: MarketplaceTagLocaleLookup,
) {
  const detailVersion = isRecord(resource.version) ? resource.version as MarketplaceVersion : undefined
  const version = detailVersion ?? latestPublishedVersion(
    unwrapArray<MarketplaceVersion>(await getMarketplaceCapabilityVersions(String(resource.id)).catch(() => [])),
  )
  return toDeviceLibraryTemplateInput(resource, version, templateResourceOf(version), tagLookup)
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

const extractInstalledProductId = (payload: any): string => {
  const resource = [
    payload,
    payload?.data,
    payload?.result,
    payload?.extra,
  ].find(item => isRecord(item) && item.type === 'device-template') as Record<string, unknown> | undefined
  const raw =
    payload?.productId
    ?? payload?.data?.productId
    ?? payload?.result?.productId
    ?? payload?.extra?.productId
    ?? resource?.dataId

  return raw != null && raw !== '' ? String(raw) : ''
}

const extractCreatedDeviceId = (payload: any): string => {
  const resource = [
    payload,
    payload?.data,
    payload?.result,
    payload?.extra,
  ].find(item => isRecord(item) && item.type === 'device-instance') as Record<string, unknown> | undefined
  const attributes = [
    payload?.attributes,
    payload?.data?.attributes,
    payload?.result?.attributes,
    payload?.extra?.attributes,
    payload,
    payload?.data,
    payload?.result,
    payload?.extra,
  ].find(isRecord) as Record<string, unknown> | undefined
  const raw = attributes?.deviceId ?? resource?.dataId
  return raw != null && raw !== '' ? String(raw) : ''
}

const toDeviceLibraryInstallProgress = (payload: any): DeviceLibraryInstallProgress | null => {
  const message = firstString(payload?.message, payload?.msg)
  if (!message) return null
  return {
    type: firstString(payload?.type) || 'log',
    message,
    extra: payload?.extra,
    payload,
  }
}

async function queryRuntimeDeviceProductById(context: ProjectRuntimeContext, productId: string) {
  const id = productId.trim()
  if (!id) return undefined

  return (await queryRuntimeDeviceProductsByIds(context, [id])).get(id)
}

async function queryRuntimeDeviceProductsByIds(context: ProjectRuntimeContext, productIds: string[]) {
  const ids = [...new Set(productIds.map((item) => item.trim()).filter(Boolean))]
  const idSet = new Set(ids)
  if (!ids.length) return new Map<string, ProductDetailResponse>()

  try {
    const response = await request.post(
      '/device/product/_query/no-paging?paging=false',
      buildNoPagingBody([{
        column: 'id',
        termType: 'in',
        value: ids,
      }]),
      { ...withProjectRuntimeRequest(context), hiddenError: true },
    )
    const products = unwrapArray<ProductDetailResponse>(response)

    return products.reduce((acc, product) => {
      const id = firstString(product.id)
      if (idSet.has(id)) acc.set(id, product)
      return acc
    }, new Map<string, ProductDetailResponse>())
  } catch {
    return new Map<string, ProductDetailResponse>()
  }
}

const toInstalledCapabilityMap = async (rows: InstalledCapabilityResponse[], context: ProjectRuntimeContext) => {
  const candidates: Array<{ capabilityId: string; productId: string }> = []
  rows.forEach((item) => {
    const capabilityId = firstString(item.capabilityId, item.resourceId, item.resourcesId)
    const productId = firstString(
      item.productId,
      item.data?.productId,
      item.result?.productId,
      item.extra?.productId,
      item.dataId,
      item.data?.dataId,
      item.result?.dataId,
      item.extra?.dataId,
    )
    if (capabilityId && productId) candidates.push({ capabilityId, productId })
  })

  const productMap = await queryRuntimeDeviceProductsByIds(
    context,
    candidates.map((item) => item.productId),
  )

  // /installed 只作为安装记录索引；用当前项目运行时批量查询产品，触发数据权限并避免串项目产品被复用。
  return new Map(
    candidates
      .filter((item) => productMap.has(item.productId))
      .map((item) => [item.capabilityId, item.productId]),
  )
}

const toDeviceLibraryProductFilterOptions = async (
  rows: InstalledCapabilityResponse[],
  context: ProjectRuntimeContext,
): Promise<DeviceLibraryProductFilterOption[]> => {
  const candidates = rows
    .map((item) => {
      const templateId = firstString(item.capabilityId, item.resourceId, item.resourcesId)
      const productId = firstString(
        item.productId,
        item.data?.productId,
        item.result?.productId,
        item.extra?.productId,
        item.dataId,
        item.data?.dataId,
        item.result?.dataId,
        item.extra?.dataId,
      )
      return templateId && productId ? { templateId, productId } : null
    })
    .filter((item): item is { templateId: string; productId: string } => Boolean(item))

  const productMap = await queryRuntimeDeviceProductsByIds(
    context,
    candidates.map((item) => item.productId),
  )
  const optionKeys = new Set<string>()

  // installed 记录只表达设备库和产品绑定关系，产品名称以运行时批量查询结果为准。
  return candidates.reduce<DeviceLibraryProductFilterOption[]>((acc, item) => {
    const product = productMap.get(item.productId)
    const key = `${item.templateId}:${item.productId}`
    if (!product || optionKeys.has(key)) return acc
    optionKeys.add(key)
    acc.push({
      templateId: item.templateId,
      productId: item.productId,
      productName: firstString(product.name),
      accessName: firstString(product.accessName, product.accessProvider),
      accessProvider: firstString(product.accessProvider),
    })
    return acc
  }, [])
}

function installedDeviceLibraryProductId(item: InstalledCapabilityResponse) {
  return firstString(
    item.productId,
    item.data?.productId,
    item.result?.productId,
    item.extra?.productId,
    item.dataId,
    item.data?.dataId,
    item.result?.dataId,
    item.extra?.dataId,
  )
}

async function resolveInstalledDeviceLibraryRecord(context: ProjectRuntimeContext,
                                                   rows: InstalledCapabilityResponse[],
                                                   capabilityId: string): Promise<InstalledCapabilityResponse | undefined> {
  const id = capabilityId.trim()
  if (!id) return undefined

  // 升级设备库只能绑定一个产品目标；安装记录里还可能包含告警、设备实例等资源，不能混用它们的 dataId。
  const candidates = rows
    .filter((item) => {
      const installedCapabilityId = firstString(item.capabilityId, item.resourceId, item.resourcesId, id)
      const type = firstString(item.type)
      const productId = installedDeviceLibraryProductId(item)
      return installedCapabilityId === id && (!type || type === 'device-template') && Boolean(productId)
    })
  const productMap = await queryRuntimeDeviceProductsByIds(
    context,
    candidates.map(installedDeviceLibraryProductId),
  )
  const validCandidates = candidates.filter((item) => productMap.has(installedDeviceLibraryProductId(item)))
  if (!validCandidates.length) return undefined
  if (validCandidates.length === 1) return validCandidates[0]

  // 多条历史安装记录只按真实产品创建时间取最新；产品已被删除的记录视为未安装，后续重新走 _install。
  return validCandidates.sort((a, b) =>
    installedProductCreateTime(b, productMap) - installedProductCreateTime(a, productMap),
  )[0]
}

function installedProductCreateTime(item: InstalledCapabilityResponse,
                                    products: Map<string, ProductDetailResponse>) {
  return Number(products.get(installedDeviceLibraryProductId(item))?.createTime)
}

type DeviceLibraryInstallResult = {
  productId: string
  deviceId?: string
}

type DeviceLibraryInstallMode = '_install' | '_upgrade'

const waitDeviceLibraryInstall = (
  source: RuntimeInstallSource,
  options: DeviceLibraryInstallOptions = {},
): Promise<DeviceLibraryInstallResult> =>
  new Promise((resolve, reject) => {
    let productId = ''
    let deviceId = ''
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve({ productId, deviceId })
    }
    source.subscribe({
      next(payload: any) {
        // 安装进度只透传后端流消息，避免前端根据本地步骤推断安装状态。
        const progress = toDeviceLibraryInstallProgress(payload)
        if (progress) options.onProgress?.(progress)
        productId = extractInstalledProductId(payload) || productId
        deviceId = extractCreatedDeviceId(payload) || deviceId
        const message = payload?.message || payload?.msg
        const failed = payload?.success === false || payload?.type === 'error'
        if (failed) {
          settled = true
          reject(new Error(message || t('IotDeviceApi.error.joinLibraryFailed')))
        }
      },
      error(error: unknown) {
        if (productId) {
          finish()
          return
        }
        reject(error)
      },
      complete() {
        finish()
      },
    })
  })


export const queryDeviceLibraryTemplateGateway_api = async (
  template: Pick<DeviceTemplateProductInput, 'accessProvider' | 'gatewayBizKey'>,
): Promise<DeviceLibraryGatewayDetail | null> => {
  const context = getProjectRuntimeContext(true)
  const accessProvider = firstString(template.accessProvider)
  const gatewayBizKey = firstString(template.gatewayBizKey)
  if (!accessProvider || !gatewayBizKey) return null

  const response = await request.post(
    '/gateway/device/_query/no-paging?paging=false',
    buildNoPagingBody([
      { column: 'provider', termType: 'eq', value: accessProvider },
      { column: 'state', termType: 'eq', value: 'enabled' },
      { column: 'bizKey', termType: 'eq', value: gatewayBizKey },
    ]),
    { ...withProjectRuntimeRequest(context), hiddenError: true },
  )
  const matched = unwrapArray<DeviceGatewayDetailResponse>(response).filter((gateway) =>
    firstString(gateway.provider) === accessProvider && firstString(gateway.bizKey) === gatewayBizKey,
  )

  return matched.length === 1 ? matched[0] : null
}

export const queryDeviceLibraryTags_api = async (): Promise<IotDeviceLibraryTagGroup[]> => {
  const response = await queryMarketplaceTagClassifiers()
  return normalizeMarketplaceTagGroups(response)
}

function queryMarketplaceTagClassifiers() {
  return request.get('/marketplace/tag-classifiers?type=device-template', {}, { projectContext: false })
}

export const queryProjectInstalledDeviceLibrary_api = async (
  _projectId: string,
  capabilityIds: string[],
): Promise<Map<string, string>> => {
  const ids = capabilityIds.filter(Boolean)
  if (!ids.length) return new Map()

  const context = getProjectRuntimeContext(true)
  const rows = await mapWithConcurrency(
    ids,
    4,
    async (capabilityId) => {
      const response = await request.post(
        `/marketplace/capabilities/device-template/${encodeURIComponent(capabilityId)}/installed`,
        [],
        withProjectRuntimeRequest(context),
      )
      return unwrapArray<InstalledCapabilityResponse>(response).map((item) => ({
        ...item,
        capabilityId: firstString(item.capabilityId, item.resourceId, capabilityId),
      }))
    },
  )

  return toInstalledCapabilityMap(rows.flat(), context)
}

export const queryDeviceLibraryProductFilterOptions_api = async (
  _projectId: string,
): Promise<DeviceLibraryProductFilterOption[]> => {
  const context = getProjectRuntimeContext(true)
  const response = await request.post(
    '/marketplace/capabilities/device-template/installed',
    [],
    withProjectRuntimeRequest(context),
  )

  return toDeviceLibraryProductFilterOptions(
    unwrapArray<InstalledCapabilityResponse>(response),
    context,
  )
}

export const queryDeviceLibraryTemplates_api = async (
  input: DeviceLibraryTemplateQueryInput = {},
): Promise<DeviceLibraryTemplatePageResult> => {
  const pageIndex = Number(input.pageIndex ?? 0)
  const pageSize = Number(input.pageSize ?? 4)
  const keyword = input.keyword?.trim()
  const terms: Record<string, unknown>[] = [
    { column: 'type', termType: 'eq', value: 'device-template' },
  ]

  if (keyword) {
    terms.push({
      type: 'and',
      terms: [
        { column: 'name', termType: 'like', value: `%${keyword}%` },
        { column: 'code', termType: 'like', value: `%${keyword}%`, type: 'or' },
      ],
    })
  }

  if (input.tags?.length) {
    terms.push({
      column: 'id$marketplace-tag$children',
      value: [...input.tags],
    })
  }

  const response = await request.post('/marketplace/resource/detail/_query', {
    paging: true,
    pageIndex,
    pageSize,
    sorts: [
      { name: 'sortIndex', order: 'asc' },
      { name: 'createTime', order: 'desc' },
    ],
    terms,
  }, { projectContext: false })
  const page = unwrapPage<MarketplaceResource>(response, pageIndex, pageSize)
  const tagClassifiers = await queryMarketplaceTagClassifiers().catch(() => [])
  const tagLookup = createMarketplaceTagLocaleLookup(tagClassifiers)
  const templates = await mapWithConcurrency(
    page.data,
    6,
    (resource) => resolveDeviceLibraryVersionResource(resource, tagLookup),
  )

  return {
    data: templates
      .filter((template) => Boolean(template.id))
      .map((template) => ({ ...template, installed: false, installedProductId: undefined })),
    total: page.total,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  }
}

export const queryDeviceLibraryTemplateById_api = async (templateId: string): Promise<DeviceTemplateProductInput | null> => {
  const id = templateId.trim()
  if (!id) return null
  const response = await request.post('/marketplace/resource/detail/_query', {
    paging: false,
    terms: [
      { column: 'id', termType: 'eq', value: id },
      { column: 'type', termType: 'eq', value: 'device-template' },
    ],
  }, { projectContext: false })
  const resource = unwrapArray<MarketplaceResource>(response)[0]
  if (!resource) return null

  const tagClassifiers = await queryMarketplaceTagClassifiers().catch(() => [])
  return resolveDeviceLibraryVersionResource(
    resource,
    createMarketplaceTagLocaleLookup(tagClassifiers),
  )
}


export const joinDeviceLibraryToProject_api = async (
  input: JoinDeviceLibraryInput,
  options: DeviceLibraryInstallOptions = {},
): Promise<IotDeviceProductTemplate> => {
  const { productId } = await installDeviceLibrary(input, options)
  return resolveInstalledDeviceLibraryProduct(input, productId)
}

export const installDeviceLibraryAndCreateDevice_api = async (
  input: JoinDeviceLibraryInput,
  options: DeviceLibraryInstallOptions = {},
): Promise<{
  product: IotDeviceProductTemplate
  device: IotDevice
}> => {
  const { productId, deviceId } = await installDeviceLibrary(input, options)
  const product = await resolveInstalledDeviceLibraryProduct(input, productId)
  if (!deviceId) throw new Error(t('IotDeviceApi.error.installDeviceIdMissing'))
  const { getDeviceDetail_api } = await import('../device')
  const device = await getDeviceDetail_api(deviceId)
  if (!device) throw new Error(t('IotDeviceApi.error.installedDeviceMissing'))
  return { product, device }
}

export const restoreDeviceLibraryAlarms_api = async (
  input: {
    templateId: string
    version?: string
    properties?: string[]
    clearDeviceConfig?: boolean
  },
  options: DeviceLibraryInstallOptions = {},
): Promise<DeviceLibraryInstallResult> => {
  const context = getProjectRuntimeContext(true)
  const version = String(input.version ?? '').trim()
  if (!version) throw new Error(t('IotDeviceApi.error.restoreVersionMissing'))

  const installed = await queryInstalledDeviceLibraryRecord(context, input.templateId)
  if (!installed) throw new Error(t('IotDeviceApi.error.installLibraryFirst'))
  const installedProductId = installedDeviceLibraryProductId(installed)
  if (!installedProductId) throw new Error(t('IotDeviceApi.error.installLibraryFirst'))

  const source: RuntimeInstallSource = marketplaceNdJson.post(
    `/marketplace/capabilities/${encodeURIComponent(input.templateId)}/${encodeURIComponent(version)}/_upgrade`,
    {
      configuration: {
        projectId: context.projectId,
        restorePropertyPreprocessors: {
          properties: input.properties ?? [],
          clearDeviceConfig: Boolean(input.clearDeviceConfig),
        },
      },
      upgrade: {
        targetDataIds: [installedProductId],
      },
    },
  )
  const result = await waitDeviceLibraryInstall(source, options)
  if (!result.productId) {
    throw new Error(t('IotDeviceApi.error.installLibraryFirst'))
  }
  return result
}

const installDeviceLibrary = async (
  input: JoinDeviceLibraryInput,
  options: DeviceLibraryInstallOptions = {},
): Promise<DeviceLibraryInstallResult> => {
  const context = getProjectRuntimeContext(true)
  const versions = unwrapArray<MarketplaceVersion>(
    await getMarketplaceCapabilityVersions(input.template.id),
  )
  const version = latestPublishedVersion(versions)
  if (!version?.version) throw new Error(t('IotDeviceApi.error.installVersionMissing'))

  const installed = await queryInstalledDeviceLibraryRecord(context, input.template.id)
  const operation: DeviceLibraryInstallMode = installed ? '_upgrade' : '_install'
  const installedProductId = installed ? installedDeviceLibraryProductId(installed) : ''
  const source: RuntimeInstallSource = marketplaceNdJson.post(
    `/marketplace/capabilities/${encodeURIComponent(input.template.id)}/${encodeURIComponent(String(version.version))}/${operation}`,
    {
      configuration: {
        projectId: context.projectId,
        updateProduct: Boolean(options.updateProduct),
        device: buildInstallDeviceBody(input),
      },
      ...(installedProductId
        ? {
            upgrade: {
              targetDataIds: [installedProductId],
            },
          }
        : {}),
    },
  )
  const result = await waitDeviceLibraryInstall(source, options)
  if (!result.productId) {
    throw new Error(t('IotDeviceApi.error.installProductIdMissing'))
  }
  return result
}

async function queryInstalledDeviceLibraryRecord(context: ProjectRuntimeContext,
                                                 capabilityId: string): Promise<InstalledCapabilityResponse | undefined> {
  const id = capabilityId.trim()
  if (!id) return undefined
  const response = await request.post(
    `/marketplace/capabilities/device-template/${encodeURIComponent(id)}/installed`,
    [],
    { ...withProjectRuntimeRequest(context), hiddenError: true },
  ).catch(() => undefined)
  const rows = unwrapArray<InstalledCapabilityResponse>(response)
  return resolveInstalledDeviceLibraryRecord(context, rows, id)
}

const resolveInstalledDeviceLibraryProduct = async (
  input: JoinDeviceLibraryInput,
  productId: string,
): Promise<IotDeviceProductTemplate> => {
  const context = getProjectRuntimeContext(true)
  const { queryDeviceProducts_api } = await import('../device')
  const products = await queryDeviceProducts_api(
    context.projectId,
    normalizeDeviceTypeValue(input.template.deviceType),
  ).catch(() => [])
  const matched = products.find((product) =>
    product.id === productId || product.templateId === input.template.id,
  )
  if (matched) return matched
  if (!productId) throw new Error(t('IotDeviceApi.error.joinProductIdMissing'))
  if (!await queryRuntimeDeviceProductById(context, productId)) {
    throw new Error(t('IotDeviceApi.error.joinedProductMissing'))
  }

  return {
    id: productId,
    name: input.productName || input.template.name,
    summary: input.template.summary || input.template.description || '',
    category: input.template.category || 'integration',
    accessName: input.template.accessName || input.template.accessProvider || '--',
    sourceProduct: input.template.sourceProduct || input.template.name,
    manufacturer: input.template.manufacturer,
    model: input.template.model,
    supportedManufacturers: input.template.supportedManufacturers ?? [],
    modelKeywords: input.template.modelKeywords ?? [],
    templateId: input.template.id,
    deviceType: normalizeDeviceTypeValue(input.template.deviceType),
    productName: input.productName || input.template.name,
    photoUrl: input.template.photoUrl,
    faultCodeDict: input.template.faultCodeDict,
  }
}
