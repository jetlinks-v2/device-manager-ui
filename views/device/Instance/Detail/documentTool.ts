import {
  queryDeviceDocuments,
  queryProductDocuments
} from '../../../../api/instance'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type TranslateFn = (key: string, params?: Record<string, any>) => string

type DeviceClientToolContext = {
  device: Record<string, any>
}

type DocumentSource = 'device' | 'product'

interface DeviceDocumentToolDependencies {
  t: TranslateFn
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
  asArray: <T = any>(value: unknown) => T[]
  responseResult: (response: any) => any
  compactInlineValue: (value: unknown, maxLength?: number) => unknown
  stringifyToolResult: (value: unknown) => string
  withWriteToPathInput: (inputs: any[]) => any[]
  writeToolResultToSessionFile: (
    args: Record<string, any>,
    call: AiClientToolCall,
    result: Record<string, any>,
    options?: {
      content?: string
      summary?: Record<string, any>
    }
  ) => Promise<any> | any
  getDeviceId: (context: DeviceClientToolContext) => string
}

const DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  accessguide: 'access-guide',
  access: 'access-guide',
  guide: 'access-guide',
  接入: 'access-guide',
  接入指南: 'access-guide',
  maintenance: 'maintenance',
  repair: 'maintenance',
  knowledge: 'maintenance',
  维修: 'maintenance',
  维修知识库: 'maintenance',
  protocol: 'protocol-doc',
  protocoldoc: 'protocol-doc',
  协议: 'protocol-doc',
  协议文档: 'protocol-doc',
  market: 'market-doc',
  marketdoc: 'market-doc',
  设备库: 'market-doc',
  设备库文档: 'market-doc',
  other: 'other',
  其他: 'other'
}

const normalizeDocumentTypes = (value: unknown) => {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '')
      .split(/[,\s，、/|]+/)
      .filter(Boolean)
  return Array.from(new Set(raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => {
      const normalized = item.toLowerCase().replace(/[\s_\-./|,，、]+/g, '')
      return DOCUMENT_TYPE_ALIASES[normalized] || item
    })))
}

const documentFileName = (document: Record<string, any>) => {
  const fileId = String(document.fileId || '').split(/[?#]/)[0]
  return document.fileName || fileId.split(/[\\/]/).pop() || fileId
}

const documentExtension = (document: Record<string, any>) => {
  const fileName = documentFileName(document).split(/[?#]/)[0]
  const matched = String(fileName || '').match(/\.([a-zA-Z0-9]+)$/)
  return matched?.[1]?.toLowerCase() || ''
}

const documentFileUrl = (fileId: string) => (fileId ? getFileUrlById(fileId) : undefined)

const normalizeFileId = (value: unknown) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const fileMarker = '/file/'
  const markerIndex = text.indexOf(fileMarker)
  if (markerIndex >= 0) {
    const fileId = text.slice(markerIndex + fileMarker.length).split(/[?#]/)[0]
    try {
      return decodeURIComponent(fileId)
    } catch {
      return fileId
    }
  }
  return text
}

const normalizeDocument = (
  deps: DeviceDocumentToolDependencies,
  document: Record<string, any>,
  source: 'device' | 'product'
) => {
  const fileId = normalizeFileId(document.fileId)
  const fileName = documentFileName({ ...document, fileId })
  const extension = documentExtension({ ...document, fileId, fileName })
  const fileUrl = documentFileUrl(fileId)
  return {
    id: document.id,
    name: document.name || fileName,
    documentType: document.documentType,
    documentTypeName: document.documentTypeName,
    objectType: document.objectType,
    objectId: document.objectId,
    source,
    fileId,
    fileName,
    extension,
    sortIndex: document.sortIndex,
    createTime: document.createTime,
    contentType: document.contentType,
    url: fileUrl,
    fileUrl,
    summary: deps.compactInlineValue(document.summary || document.description, 1000),
    fileReference: fileId
      ? {
        type: 'platform-file-id',
        fileId,
        fileName,
        extension: extension || undefined,
        url: fileUrl,
        fileUrl
      }
      : undefined,
    contentInline: false,
    contentOmitted: true
  }
}

const matchDocument = (
  document: Record<string, any>,
  documentTypes: string[],
  keyword: string
) => {
  if (documentTypes.length && !documentTypes.includes(document.documentType)) {
    return false
  }
  if (!keyword) {
    return true
  }
  const text = [
    document.name,
    document.fileName,
    document.fileId,
    document.documentType,
    document.documentTypeName
  ].join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

const queryTargetDocuments = async (
  deps: DeviceDocumentToolDependencies,
  source: DocumentSource,
  id: string
) => {
  const params = {
    paging: false,
    sorts: [
      { name: 'sortIndex', order: 'asc' },
      { name: 'createTime', order: 'desc' }
    ]
  }
  try {
    const resp = source === 'device'
      ? await queryDeviceDocuments(id, params)
      : await queryProductDocuments(id, params)
    return {
      data: deps.asArray<Record<string, any>>(deps.responseResult(resp))
        .map((item) => normalizeDocument(deps, item, source))
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeToolError(source, id, error)
    }
  }
}

const normalizeToolError = (source: DocumentSource, id: string, error: any) => ({
  source,
  id,
  status: error?.response?.status ?? error?.status,
  code: error?.response?.data?.code ?? error?.data?.code ?? error?.code,
  message: error?.response?.data?.message ?? error?.data?.message ?? error?.message ?? String(error)
})

const toTimeNumber = (value: unknown) => Number(value) || 0

const queryDocuments = async (
  deps: DeviceDocumentToolDependencies,
  args: Record<string, any>,
  context: DeviceClientToolContext
) => {
  const deviceId = deps.getDeviceId(context)
  if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
  const includeProduct = args.includeProductDocuments !== false
  const productId = String(context.device?.productId || '').trim()
  const documentTypes = normalizeDocumentTypes(args.documentTypes ?? args.documentType ?? args.type)
  const keyword = String(args.keyword || '').trim()
  const tasks = [queryTargetDocuments(deps, 'device', deviceId)]
  if (includeProduct && productId) {
    tasks.push(queryTargetDocuments(deps, 'product', productId))
  }
  // 产品文档可能受产品资产权限影响；设备自身文档可用时仍返回部分结果给智能体解释。
  const results = await Promise.all(tasks)
  const errors = results
    .map((item) => item.error)
    .filter(Boolean)
  const data = results
    .flatMap((item) => item.data)
    .filter((item) => matchDocument(item, documentTypes, keyword))
    .sort((a, b) => (
      (a.source === b.source ? 0 : (a.source === 'device' ? -1 : 1))
      || Number(a.sortIndex ?? 0) - Number(b.sortIndex ?? 0)
      || toTimeNumber(b.createTime) - toTimeNumber(a.createTime)
    ))
  return {
    deviceId,
    productId: includeProduct ? productId || undefined : undefined,
    includeProductDocuments: includeProduct,
    documentTypes: documentTypes.length ? documentTypes : undefined,
    keyword: keyword || undefined,
    partial: errors.length > 0,
    errors: errors.length ? errors : undefined,
    data
  }
}

const toDocumentReferenceResult = (document: Record<string, any>, t: TranslateFn) => ({
  ...document,
  url: document.url || documentFileUrl(normalizeFileId(document.fileId)),
  fileUrl: document.fileUrl || document.url || documentFileUrl(normalizeFileId(document.fileId)),
  // URL 供后端统一下载/挂载到会话文件容器；正文仍不经前端 WebSocket 回传。
  fileReference: document.fileReference || (document.fileId
    ? {
      type: 'platform-file-id',
      fileId: document.fileId,
      fileName: document.fileName,
      extension: document.extension || undefined,
      url: document.url || documentFileUrl(normalizeFileId(document.fileId)),
      fileUrl: document.fileUrl || document.url || documentFileUrl(normalizeFileId(document.fileId))
    }
    : undefined),
  contentInline: false,
  contentOmitted: true,
  contentOmittedReason: t('DeviceDetail.agentTools.documentReference.contentOmittedReason'),
  nextAction: document.fileId
    ? t('DeviceDetail.agentTools.documentReference.nextAction.importFile')
    : t('DeviceDetail.agentTools.documentReference.nextAction.noFileId')
})

const resolveDocumentReference = async (
  deps: DeviceDocumentToolDependencies,
  args: Record<string, any>,
  context: DeviceClientToolContext
) => {
  const queryResult = await queryDocuments(deps, args, context)
  const fileId = normalizeFileId(args.fileId)
  const document = fileId
    ? queryResult.data.find((item) => normalizeFileId(item.fileId) === fileId) || {
      fileId,
      fileName: documentFileName({ fileId }),
      extension: documentExtension({ fileId })
    }
    : queryResult.data[0]
  const candidateLimit = deps.clampNumber(args.candidateLimit, 1, 10, 5)
  return {
    deviceId: queryResult.deviceId,
    productId: queryResult.productId,
    matched: !!document,
    partial: queryResult.partial,
    errors: queryResult.errors,
    document: document ? toDocumentReferenceResult(document, deps.t) : undefined,
    candidates: queryResult.data
      .slice(0, candidateLimit)
      .map((item) => toDocumentReferenceResult(item, deps.t)),
    totalCandidates: queryResult.data.length,
    contentInline: false,
    contentOmitted: true
  }
}

export const createDeviceDocumentClientTools = (
  deps: DeviceDocumentToolDependencies
): AiClientToolDefinition<DeviceClientToolContext>[] => [
  {
    id: 'device_documents_query',
    name: 'device_documents_query',
    description: deps.t('DeviceDetail.agentTools.documentsQuery.description'),
    inputs: deps.withWriteToPathInput([
      {
        id: 'documentTypes',
        name: 'documentTypes',
        description: deps.t('DeviceDetail.agentTools.documentsQuery.inputs.documentTypes'),
        required: false,
        valueType: { type: 'array', elementType: { type: 'string' } }
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: deps.t('DeviceDetail.agentTools.documentsQuery.inputs.keyword'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'includeProductDocuments',
        name: 'includeProductDocuments',
        description: deps.t('DeviceDetail.agentTools.documentsQuery.inputs.includeProductDocuments'),
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'limit',
        name: 'limit',
        description: deps.t('DeviceDetail.agentTools.documentsQuery.inputs.limit'),
        required: false,
        valueType: 'int'
      }
    ]),
    output: { type: 'object' },
    help: deps.t('DeviceDetail.agentTools.documentsQuery.help'),
    execute: async (args, context, call) => {
      const result = await queryDocuments(deps, args, context)
      const limit = deps.clampNumber(args.limit, 1, 100, 20)
      const visibleData = result.data.slice(0, limit)
      const payload = {
        ...result,
        total: result.data.length,
        returned: visibleData.length,
        truncated: result.data.length > visibleData.length,
        data: visibleData
      }
      const fullPayload = {
        ...result,
        total: result.data.length,
        returned: result.data.length,
        truncated: false
      }
      return deps.writeToolResultToSessionFile(args, call, payload, {
        content: deps.stringifyToolResult(fullPayload),
        summary: {
          deviceId: result.deviceId,
          productId: result.productId,
          total: result.data.length,
          returned: result.data.length,
          truncated: false,
          fullResultWritten: true,
          inlinePreviewLimit: limit,
          inlinePreviewReturned: visibleData.length,
          inlinePreviewTruncated: result.data.length > visibleData.length,
          dataPreview: visibleData
        }
      })
    }
  },
  {
    id: 'device_document_reference',
    name: 'device_document_reference',
    description: deps.t('DeviceDetail.agentTools.documentReference.description'),
    inputs: [
      {
        id: 'fileId',
        name: 'fileId',
        description: deps.t('DeviceDetail.agentTools.documentReference.inputs.fileId'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'documentType',
        name: 'documentType',
        description: deps.t('DeviceDetail.agentTools.documentReference.inputs.documentType'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: deps.t('DeviceDetail.agentTools.documentReference.inputs.keyword'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'includeProductDocuments',
        name: 'includeProductDocuments',
        description: deps.t('DeviceDetail.agentTools.documentReference.inputs.includeProductDocuments'),
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'candidateLimit',
        name: 'candidateLimit',
        description: deps.t('DeviceDetail.agentTools.documentReference.inputs.candidateLimit'),
        required: false,
        valueType: 'int'
      }
    ],
    output: { type: 'object' },
    help: deps.t('DeviceDetail.agentTools.documentReference.help'),
    execute: async (args, context) => {
      const result = await resolveDocumentReference(deps, args, context)
      if (!result.matched) {
        return {
          ...result,
          reason: deps.t('DeviceDetail.agentTools.documentReference.reason.notFound')
        }
      }
      return result
    }
  }
]
