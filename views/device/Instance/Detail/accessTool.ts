import dayjs from 'dayjs'
import {
  detail as queryProductDetail,
  getConfigView,
  getProviders,
  queryList as queryAccessList
} from '../../../../api/product'
import { getCompositeProviderDetail } from '../../../../api/link/accessConfig'
import {
  existsDevicePrincipalSupport,
  getConfigMetadata,
  getDevicePrincipal,
  getDeviceSessions
} from '../../../../api/instance'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceDetailRecord = Record<string, any>

type DeviceClientToolContext = {
  device: DeviceDetailRecord
}

interface DeviceAccessToolDependencies {
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
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

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const truncateText = (value: unknown, maxLength = 4000) => {
  if (value === undefined || value === null) return value
  const text = typeof value === 'string' ? value : safeStringify(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

const normalizeToolError = (error: any) => ({
  message: error?.message || String(error),
  status: error?.status || error?.response?.status,
  code: error?.code || error?.response?.data?.code,
  detail: truncateText(error?.response?.data || error?.data || error)
})

const safeToolPart = async <T>(
  runner: () => Promise<T> | T
): Promise<{ ok: true; data: T } | { ok: false; error: ReturnType<typeof normalizeToolError> }> => {
  try {
    return { ok: true, data: await runner() }
  } catch (error) {
    return { ok: false, error: normalizeToolError(error) }
  }
}

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : [])

const getByPath = (source: Record<string, any>, path: string): unknown => {
  const segments = path.split('.').map((item) => item.trim()).filter(Boolean)
  let current: any = source
  for (const key of segments) {
    if (current == null || typeof current !== 'object' || !(key in current)) {
      return undefined
    }
    current = current[key]
  }
  return current
}

const parseLiteral = (value: string): unknown => {
  const text = String(value || '').trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null
  const numberValue = Number(text)
  return Number.isFinite(numberValue) && /^-?\d+(\.\d+)?$/.test(text) ? numberValue : text
}

const splitByPipe = (value: string) => String(value || '').split('|').map((item) => item.trim()).filter(Boolean)

const applyTemplateFilter = (name: string, value: unknown, args: unknown[]) => {
  switch (name) {
    case 'date': {
      const format = String(args[0] || 'YYYY-MM-DD HH:mm:ss')
      const date = dayjs(value as any)
      return date.isValid() ? date.format(format) : ''
    }
    case 'json':
      try {
        return JSON.stringify(value, null, Number(args[0] ?? 2) || 2)
      } catch {
        return ''
      }
    case 'upper':
      return value == null ? '' : String(value).toUpperCase()
    case 'lower':
      return value == null ? '' : String(value).toLowerCase()
    default:
      return value
  }
}

const renderProtocolDocument = (
  document: string,
  context: Record<string, any>
) => document.replace(/\$\{([^}]+)\}/g, (_, rawExpression: string) => {
  const [base, ...filters] = splitByPipe(rawExpression)
  const defaultIndex = base.indexOf('?:')
  const path = (defaultIndex >= 0 ? base.slice(0, defaultIndex) : base).trim()
  let value = getByPath(context, path)
  if ((value === undefined || value === null || value === '') && defaultIndex >= 0) {
    value = parseLiteral(base.slice(defaultIndex + 2))
  }
  for (const filter of filters) {
    const matched = /^([a-zA-Z_][\w-]*)(?:\((.*)\))?$/.exec(filter)
    if (!matched) continue
    const args = matched[2]
      ? matched[2].split(',').map((item) => parseLiteral(item.trim()))
      : []
    value = applyTemplateFilter(matched[1], value, args)
  }
  if (value === undefined || value === null) return ''
  return typeof value === 'object' ? safeStringify(value) : String(value)
})

const normalizePrincipal = (item: Record<string, any>) => ({
  id: item.id,
  metadata: item.metadata,
  identity: item.identity,
  credential: item.credential
})

const loadPrincipals = async (deviceId: string) => {
  const supportResp: any = await existsDevicePrincipalSupport()
  if (supportResp?.status !== 200 || !supportResp.result) {
    return []
  }
  const resp: any = await getDevicePrincipal(deviceId)
  return asArray<Record<string, any>>(resp?.result).map(normalizePrincipal)
}

const normalizeSession = (session: Record<string, any>) => ({
  deviceId: session.deviceId,
  serverId: session.serverId,
  address: session.address,
  connectTime: session.connectTime,
  lastCommTime: session.lastCommTime,
  transport: session.transport,
  connections: asArray<Record<string, any>>(session.connections).map((conn) => ({
    address: conn.address,
    pendingMessages: conn.pendingMessages,
    metrics: conn.metrics
  }))
})

const normalizeAddresses = (access: Record<string, any>) => (
  asArray<Record<string, any>>(access?.channelInfo?.addresses)
    .map((item) => ({
      address: item.address,
      health: item.health,
      healthy: item.health === undefined ? undefined : item.health !== -1
    }))
)

const formatConfigValue = (property: Record<string, any>, value: unknown) => {
  const type = property?.type || {}
  if (type.type === 'password') {
    return value === undefined || value === null || value === '' ? '' : '******'
  }
  if (type.type === 'enum') {
    return {
      value,
      text: asArray<Record<string, any>>(type.elements).find((item) => item.value === value)?.text || value
    }
  }
  if (type.type === 'boolean') {
    const options = [
      { value: type.falseValue, text: type.falseText },
      { value: type.trueValue, text: type.trueText }
    ]
    return {
      value,
      text: options.find((item) => item.value === value)?.text || value
    }
  }
  return value
}

const normalizeConfigGroups = (groups: unknown, device: DeviceDetailRecord) => {
  const configuration = device?.configuration || {}
  const cachedConfiguration = device?.cachedConfiguration || {}
  return asArray<Record<string, any>>(groups).map((group) => ({
    name: group.name,
    description: group.description,
    properties: asArray<Record<string, any>>(group.properties).map((property) => {
      const value = configuration[property.property]
      return {
        property: property.property,
        name: property.name,
        description: property.description,
        type: property.type?.type,
        value: formatConfigValue(property, value),
        pendingApply: cachedConfiguration[property.property] !== undefined && value !== cachedConfiguration[property.property]
      }
    })
  }))
}

const loadDeviceConfigGroups = async (device: DeviceDetailRecord) => {
  if (!device?.id) return []
  const resp: any = await getConfigMetadata(device.id)
  return normalizeConfigGroups(resp?.result, device)
}

const normalizeRoutes = (routes: unknown) => asArray<Record<string, any>>(routes).slice(0, 50).map((route) => ({
  group: route.group,
  topic: route.topic,
  address: route.address,
  example: route.example,
  upstream: route.upstream,
  downstream: route.downstream,
  description: route.description
}))

const loadAccessInfo = async (
  device: DeviceDetailRecord,
  principals: Record<string, any>[],
  includeProtocolDocument: boolean
) => {
  let accessId = device?.accessId
  if (!accessId && device?.productId) {
    const productResp: any = await queryProductDetail(device.productId)
    accessId = productResp?.result?.accessId
  }
  if (!accessId) {
    return { empty: true, reason: '当前设备和产品未配置接入方式。' }
  }

  const [accessResp, providersResp] = await Promise.all([
    queryAccessList({ terms: [{ column: 'id', value: accessId }] }),
    safeToolPart(() => getProviders())
  ])
  const access = accessResp?.result?.data?.[0]
  if (!access) {
    return { empty: true, accessId, reason: '未查询到接入方式详情。' }
  }

  const providers = providersResp.ok ? asArray<Record<string, any>>(providersResp.data?.result) : []
  const provider = providers.find((item) => item.id === access.provider)
  const errors: Record<string, any> = {}
  if (!providersResp.ok) {
    errors.providers = providersResp.error
  }
  let compositeGateways: Record<string, any>[] = []
  if (access.provider === 'composite-device-gateway') {
    const compositeResult = await safeToolPart(() => getCompositeProviderDetail(access.configuration?.gateways || []))
    if (compositeResult.ok) {
      compositeGateways = asArray<Record<string, any>>(compositeResult.data?.result)
    } else {
      errors.compositeGateways = compositeResult.error
    }
  }

  let protocolView: Record<string, any> = {}
  let protocolDocumentMarkdown = ''
  if (access.provider !== 'plugin_gateway') {
    const protocol = device.messageProtocol || access.protocol
    const transport = device.transportProtocol || access.transport
    if (protocol && transport) {
      const protocolResult = await safeToolPart(() => getConfigView(protocol, transport))
      if (protocolResult.ok) {
        protocolView = protocolResult.data?.result || {}
        if (includeProtocolDocument && protocolView.document) {
          const firstPrincipal = principals[0] || {}
          const principal = {
            ...firstPrincipal,
            identityType: firstPrincipal?.identity?.type,
            identifier: firstPrincipal?.identity?.identifier,
            credentialType: firstPrincipal?.credential?.type,
            token: firstPrincipal?.credential?.content?.token,
            username: firstPrincipal?.credential?.content?.username,
            password: firstPrincipal?.credential?.content?.password
          }
          protocolDocumentMarkdown = renderProtocolDocument(protocolView.document, {
            device,
            access,
            config: protocolView,
            principal,
            principals
          })
        }
      } else {
        errors.protocolView = protocolResult.error
      }
    }
  }

  return {
    empty: false,
    pluginOnly: access.provider === 'plugin_gateway',
    access: {
      id: access.id,
      name: access.name,
      description: access.description || provider?.description,
      provider: access.provider,
      providerName: provider?.name || provider?.description,
      protocol: access.protocol,
      transport: access.transport,
      state: access.state,
      addresses: normalizeAddresses(access),
      compositeGateways: compositeGateways.map((gateway) => ({
        id: gateway.id,
        name: gateway.name,
        provider: gateway.provider,
        description: gateway.description,
        addresses: normalizeAddresses(gateway),
        configGroups: normalizeConfigGroups(gateway.transportDetail?.allConfig, device)
      }))
    },
    protocolView: {
      protocol: device.messageProtocol || access.protocol,
      transport: device.transportProtocol || access.transport,
      routes: normalizeRoutes(protocolView.routes),
      documentAvailable: !!protocolView.document,
      documentLength: protocolDocumentMarkdown.length
    },
    protocolDocumentMarkdown,
    partial: Object.keys(errors).length > 0,
    errors
  }
}

export const createDeviceAccessClientTools = (
  deps: DeviceAccessToolDependencies
): AiClientToolDefinition<DeviceClientToolContext>[] => [
  {
    id: 'device_access_summary',
    name: 'device_access_summary',
    description: '获取当前设备的接入配置、接入地址、协议说明、在线会话和接入身份概览。',
    inputs: deps.withWriteToPathInput([
      {
        id: 'includeSessions',
        name: 'includeSessions',
        description: '是否查询在线会话和连接信息，默认 true。',
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'includeProtocolDocument',
        name: 'includeProtocolDocument',
        description: '是否返回协议说明 Markdown 摘要，默认 true。',
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'protocolDocumentMaxLength',
        name: 'protocolDocumentMaxLength',
        description: '协议说明内联预览最大字符数，默认5000，最大12000；传 writeToPath 时完整接入结果写入文件。',
        required: false,
        valueType: 'int'
      }
    ]),
    output: { type: 'object' },
    help: '设备接入诊断。用户问“这个设备怎么接入”“接入地址是什么”“认证需要什么字段”“协议文档怎么说”“为什么上线/认证失败”时优先使用此工具；它会汇总设备接入 Tab 中的接入方式、地址、配置、身份、协议说明和在线会话。',
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error('deviceId missing')

      const includeSessions = args.includeSessions !== false
      const includeProtocolDocument = args.includeProtocolDocument !== false
      const documentMaxLength = deps.clampNumber(args.protocolDocumentMaxLength, 800, 12000, 5000)

      const [sessionsResult, principalsResult, configResult] = await Promise.all([
        includeSessions ? safeToolPart(() => getDeviceSessions(deviceId)) : Promise.resolve({ ok: true, data: { result: [] } } as const),
        safeToolPart(() => loadPrincipals(deviceId)),
        safeToolPart(() => loadDeviceConfigGroups(context.device))
      ])
      const principals = principalsResult.ok ? principalsResult.data : []
      const accessResult = await safeToolPart(() => loadAccessInfo(context.device, principals, includeProtocolDocument))
      const accessData = accessResult.ok ? accessResult.data as Record<string, any> : undefined
      const protocolDocument = accessData?.protocolDocumentMarkdown || ''
      const visibleAccessData = accessData
        ? {
            ...accessData,
            protocolDocumentMarkdown: deps.compactInlineValue(protocolDocument, documentMaxLength),
            protocolDocumentOmitted: protocolDocument.length > documentMaxLength
          }
        : undefined
      const result = {
        device: {
          id: context.device.id,
          name: context.device.name,
          productId: context.device.productId,
          productName: context.device.productName,
          state: context.device.state,
          messageProtocol: context.device.messageProtocol || context.device.protocol,
          transportProtocol: context.device.transportProtocol,
          accessId: context.device.accessId,
          accessProvider: context.device.accessProvider,
          deviceType: context.device.deviceType,
          registryTime: context.device.registryTime
        },
        sessions: sessionsResult.ok
          ? asArray<Record<string, any>>(deps.responseResult(sessionsResult.data)).map(normalizeSession)
          : [],
        principals,
        configurationGroups: configResult.ok ? configResult.data : [],
        accessInfo: visibleAccessData,
        partial: !sessionsResult.ok || !principalsResult.ok || !configResult.ok || !accessResult.ok,
        errors: {
          sessions: sessionsResult.ok ? undefined : sessionsResult.error,
          principals: principalsResult.ok ? undefined : principalsResult.error,
          configuration: configResult.ok ? undefined : configResult.error,
          accessInfo: accessResult.ok ? undefined : accessResult.error
        }
      }

      return deps.writeToolResultToSessionFile(args, call, result, {
        content: deps.stringifyToolResult({
          ...result,
          accessInfo: accessData
        }),
        summary: {
          deviceId,
          accessId: accessData?.access?.id,
          accessName: accessData?.access?.name,
          sessionCount: result.sessions.length,
          principalCount: principals.length,
          protocolDocumentLength: protocolDocument.length,
          fullResultWritten: true,
          inlineProtocolDocumentLimit: documentMaxLength,
          inlineProtocolDocumentTruncated: protocolDocument.length > documentMaxLength
        }
      })
    }
  }
]
