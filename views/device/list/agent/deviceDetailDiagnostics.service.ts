import router from '@jetlinks-web-core/router'
import {
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentEnum,
  resolveDomainAgentInteger,
  resolveDomainAgentStringList,
  searchDomainAgentItems,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import {
  queryDeviceProductDocuments_api,
  readDeviceDocumentFileText_api,
} from '@device-manager-ui/api/device'
import type { IotDevice } from '../types'
import { buildIotDeviceDetailPath } from '../hooks/useIotDeviceRouting'
import {
  iotDeviceDetailRealApi,
  parseMetadata,
} from '../services/iotDeviceDetailReal.service'
import { IOT_DEVICE_DETAIL_AGENT_TABS } from './deviceDetailAgent.constants'
import {
  asRecord,
  inputError,
  normalizeText,
  runDetailTool,
  safeText,
  unwrapResult,
  type DeviceDetailAgentArgs,
} from './deviceDetailAgent.shared'

const DOCUMENT_TYPES = ['access-guide', 'protocol-doc', 'maintenance', 'market-doc', 'other'] as const
const MAX_DOCUMENT_CHARS = 5000

export const createDeviceDetailDiagnosticsService = (device: IotDevice) => {
  const contextGet = () => Promise.resolve(createDomainAgentToolResult({
    domain: 'device',
    summary: {
      deviceId: device.id,
      deviceName: device.name,
      status: device.connectionStatus || device.status,
    },
    data: {
      id: device.id,
      name: device.name,
      identifier: device.identifier,
      productId: device.productId,
      productName: device.productName,
      deviceType: { value: device.deviceTypeValue, text: device.deviceType },
      status: { value: device.connectionStatus || device.status, text: device.status },
      area: device.area,
      groupName: device.groupName,
      accessProvider: device.accessProvider,
      accessName: device.accessName || device.accessMode,
      lastSeen: device.lastSeen,
      lastSeenTimestamp: device.lastSeenTimestamp,
      tags: device.tags.slice(0, 20),
      summary: device.summary,
    },
  }))

  const modelSearch = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    const keyword = normalizeText(args.keyword)
    const types = resolveDomainAgentStringList(args.types, { name: 'types', max: 4 })
    const sections = types.length ? types : ['properties', 'events', 'functions', 'tags']
    const limit = resolveDomainAgentInteger(args.limit, { name: 'limit', defaultValue: 20, min: 1, max: 100 })
    let metadata = device.thingModelMetadata
    if (!metadata) {
      const detail = asRecord(unwrapResult(await iotDeviceDetailRealApi.getDeviceDetail(device.id)))
      metadata = parseMetadata(detail.metadata || detail.deriveMetadata || detail.productMetadata)
    }
    const candidates = sections.flatMap((section) => {
      const items = Array.isArray(metadata[section as keyof typeof metadata])
        ? metadata[section as keyof typeof metadata]
        : []
      return items.map((value) => {
        const item = asRecord(value)
        return {
          type: section,
          id: normalizeText(item.id || item.key || item.property || item.event || item.function),
          name: safeText(item.name || item.id || item.key, 300),
          description: safeText(item.description, 600) || undefined,
        }
      })
    })
    const matched = searchDomainAgentItems(
      candidates,
      keyword,
      item => [item.id, item.name, item.description, item.type],
      limit,
    )
    return createDomainAgentToolResult({
      domain: 'device',
      filters: { keyword: keyword || undefined, terms: matched.terms, types: sections },
      summary: { deviceId: device.id, matched: matched.total, returned: matched.data.length },
      data: matched.data,
      total: matched.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: matched.data.length,
        totalCount: matched.total,
      }),
      truncated: matched.total > matched.data.length,
    })
  })

  const loadDocuments = async (types: readonly typeof DOCUMENT_TYPES[number][]) => {
    const productId = device.productId || device.productKey
    if (!productId) return { productId: '', settled: [], documents: [] as Awaited<ReturnType<typeof queryDeviceProductDocuments_api>> }
    const settled = await Promise.allSettled(types.map(type => queryDeviceProductDocuments_api(productId, type)))
    return {
      productId,
      settled,
      documents: settled.flatMap(result => result.status === 'fulfilled' ? result.value : []),
    }
  }

  const documentsQuery = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    const productId = device.productId || device.productKey
    if (!productId) return createDomainAgentToolResult({
      domain: 'device',
      status: 'empty',
      summary: { deviceId: device.id, documentCount: 0 },
      data: [],
      total: 0,
      cardinality: createDomainAgentRecordSetCardinality({ returnedCount: 0 }),
      supportsAbsenceClaim: true,
    })
    const requested = resolveDomainAgentStringList(args.documentTypes ?? args.documentType, { name: 'documentTypes', max: DOCUMENT_TYPES.length })
    const types = requested.length
      ? requested.map(value => resolveDomainAgentEnum(value, DOCUMENT_TYPES, { name: 'documentType' }))
      : [...DOCUMENT_TYPES]
    const keyword = normalizeText(args.keyword)
    const limit = resolveDomainAgentInteger(args.limit, { name: 'limit', defaultValue: 20, min: 1, max: 50 })
    const { settled, documents } = await loadDocuments(types)
    const candidates = documents.map(document => ({
      id: document.id,
      name: document.name,
      documentType: document.documentType,
      fileId: document.fileId,
      createTime: document.createTime,
    }))
    const matched = searchDomainAgentItems(
      candidates,
      keyword,
      document => [document.name, document.documentType],
      limit,
    )
    const partial = settled.some(result => result.status === 'rejected')
    return createDomainAgentToolResult({
      domain: 'device',
      status: partial ? 'partial' : matched.data.length ? undefined : 'empty',
      filters: { documentTypes: types, keyword: keyword || undefined, terms: matched.terms },
      summary: { deviceId: device.id, productId, matched: matched.total, returned: matched.data.length },
      data: matched.data,
      total: matched.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: matched.data.length,
        totalCount: matched.total,
      }),
      truncated: matched.total > matched.data.length,
    })
  })

  const documentReference = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const fileId = normalizeText(args.fileId)
    if (!fileId) throw inputError('DEVICE_DOCUMENT_REQUIRED', 'documentRequired')
    const { documents } = await loadDocuments(DOCUMENT_TYPES)
    const document = documents.find(item => normalizeText(item.fileId) === fileId)
    if (!document?.fileId) throw inputError('DEVICE_DOCUMENT_NOT_FOUND', 'documentNotFound')
    const content = safeText(await readDeviceDocumentFileText_api(document.fileId), MAX_DOCUMENT_CHARS)
    return createDomainAgentToolResult({
      domain: 'device',
      status: content ? undefined : 'empty',
      summary: { deviceId: device.id, fileId, chars: content.length },
      data: {
        fileId,
        name: document.name,
        documentType: document.documentType,
        content,
      },
      truncated: content.length >= MAX_DOCUMENT_CHARS,
    })
  })

  const openTab = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const tab = resolveDomainAgentEnum(args.tab, IOT_DEVICE_DETAIL_AGENT_TABS, { name: 'tab', defaultValue: 'overview' })
    const path = buildIotDeviceDetailPath(device.projectId, device.id, { tab })
    await router.push(path)
    return createDomainAgentToolResult({
      domain: 'device',
      summary: { deviceId: device.id, opened: true, tab },
      data: { opened: true, tab },
    })
  })

  return { contextGet, modelSearch, documentsQuery, documentReference, openTab }
}
