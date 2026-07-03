import {
  queryDeviceDocuments,
  queryProductDocuments
} from '../../../../api/instance'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceClientToolContext = {
  device: Record<string, any>
}

type DocumentSource = 'device' | 'product'

interface DeviceDocumentToolDependencies {
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
  if (!deviceId) throw new Error('deviceId missing')
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

const toDocumentReferenceResult = (document: Record<string, any>) => ({
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
  contentOmittedReason: '文档正文未通过前端工具读取，避免大文件内容通过 WebSocket 回传。',
  nextAction: document.fileId
    ? '需要正文级分析时，优先使用返回的 url/fileUrl 通过后端 fs_download 或统一文件通道导入当前会话文件容器，再把返回的会话文件路径作为 inputPath 传给文档分析工具。不要让前端读取并回传全文。'
    : '该文档未返回 fileId，无法形成可分析的文件引用。'
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
    document: document ? toDocumentReferenceResult(document) : undefined,
    candidates: queryResult.data
      .slice(0, candidateLimit)
      .map(toDocumentReferenceResult),
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
    description: '查询当前设备关联的文档绑定，可包含设备自身文档和所属产品文档。',
    inputs: deps.withWriteToPathInput([
      {
        id: 'documentTypes',
        name: 'documentTypes',
        description: '文档类型数组。可选：maintenance、access-guide、protocol-doc、market-doc、other；也支持“维修/接入指南/协议”等自然语言。',
        required: false,
        valueType: { type: 'array', elementType: { type: 'string' } }
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: '按文档名称、文件名或类型过滤。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'includeProductDocuments',
        name: 'includeProductDocuments',
        description: '是否同时返回所属产品文档，默认 true。',
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'limit',
        name: 'limit',
        description: '内联预览最多返回条数，默认20，最大100；传 writeToPath 时完整文档元数据写入文件。',
        required: false,
        valueType: 'int'
      }
    ]),
    output: { type: 'object' },
    help: '设备文档查询。用户问“有没有维修知识库”“接入指南在哪”“设备文档里怎么说”时先用此工具找文档；结果返回文档元数据、platform-file-id 和 url/fileUrl，不读取正文。需要分析大文档正文时，应通过后端 fs_download 或统一文件/文档工具把 url/fileUrl 导入或挂载到会话文件容器后，再用 inputPath 分析。',
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
    description: '定位当前设备文档的文件引用，返回 platform-file-id、url/fileUrl 元数据，不通过前端读取文档正文。',
    inputs: [
      {
        id: 'fileId',
        name: 'fileId',
        description: '文件ID。为空时会按 documentType/keyword 查找第一个匹配文档。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'documentType',
        name: 'documentType',
        description: '文档类型。可选 maintenance、access-guide、protocol-doc、market-doc、other；fileId 为空时用于定位文档。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: 'fileId 为空时按文档名称或文件名过滤。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'includeProductDocuments',
        name: 'includeProductDocuments',
        description: 'fileId 为空时是否同时查所属产品文档，默认 true。',
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'candidateLimit',
        name: 'candidateLimit',
        description: '同时返回的候选引用数量，默认5，最大10。',
        required: false,
        valueType: 'int'
      }
    ],
    output: { type: 'object' },
    help: '定位设备文档引用。先用 device_documents_query 查看候选；需要文档正文分析时，不要让前端下载并回传全文，而是把返回的 url/fileUrl 通过后端 fs_download 或统一文件/文档通道转换成会话文件路径后，再调用文档分析工具。',
    execute: async (args, context) => {
      const result = await resolveDocumentReference(deps, args, context)
      if (!result.matched) {
        return {
          ...result,
          reason: '未找到匹配的设备文档。'
        }
      }
      return result
    }
  }
]
