import {
  detail, getProviders, getNetworkList, getNetworkComponentList, getProtocolList,
  getConfigView, getChildConfigView, getPluginList, getPluginConfig, getCompositeProviderDetail,
} from '../../../../api/link/accessConfig'
import { NetworkTypeMapping, ProtocolMapping } from '../data'
import { agentProviders, builtinProviders, pluginProviders } from './types'
import type {
  GatewayRecord, GatewayOutlineModel, NamedResource, NetworkResource,
  OutlineIssue, PluginMetadata, ProtocolDocument,
} from './types'

interface ReadResponse<T> { success?: boolean; status?: number; result?: T }

/** 只接受成功的查询结果；失败由调用方转成可重试的详情提示。 */
async function resultOf<T>(request: Promise<ReadResponse<T>>): Promise<T> {
  const response = await request
  if (response.success === false || (response.success !== true && response.status !== 200) || response.result === undefined) {
    throw new Error('Gateway outline query failed')
  }
  return response.result
}

/** 同一次详情内相同资源共享请求，关闭后不保留跨网关缓存。 */
function cached<T>(cache: Map<string, Promise<T>>, key: string, read: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, read())
  return cache.get(key)!
}

/** 保留配置顺序和子项身份；资源补全结果不能替换用户的原配置。 */
function mergeChildren(configured: GatewayRecord[], enriched: GatewayRecord[]): GatewayRecord[] {
  const remaining = [...enriched]
  return configured.map(child => {
    const index = remaining.findIndex(item => child.id
      ? item.id === child.id
      : item.provider === child.provider && item.channelId === child.channelId && item.protocol === child.protocol && item.name === child.name)
    const resource = index < 0 ? {} : remaining.splice(index, 1)[0]
    return { ...resource, ...child, channelInfo: resource.channelInfo ?? child.channelInfo, protocolDetail: resource.protocolDetail ?? child.protocolDetail }
  })
}

/** 实体只在顶层读取；子项/草稿的 id 是配置标识，不能作为网关实体查询。 */
export async function loadGatewayOutline(source: GatewayRecord, draft = false): Promise<GatewayOutlineModel> {
  const initialIssues: OutlineIssue[] = []
  const networks = new Map<string, Promise<NetworkResource[]>>()
  const protocols = new Map<string, Promise<NamedResource[]>>()
  const documents = new Map<string, Promise<ProtocolDocument | ProtocolDocument[]>>()
  const plugins = new Map<string, Promise<NamedResource[]>>()
  const metadata = new Map<string, Promise<PluginMetadata>>()

  // 每个失败都保留为可见状态，允许其他独立分区继续展示。
  async function attempt<T>(scope: OutlineIssue, issues: OutlineIssue[], read: () => Promise<T>): Promise<T | undefined> {
    try { return await read() } catch { issues.push(scope); return undefined }
  }

  const [providers, entity] = await Promise.all([
    attempt('providers', initialIssues, () => resultOf<NamedResource[]>(getProviders())),
    source.id && !draft ? attempt('gateway', initialIssues, () => resultOf<GatewayRecord>(detail(source.id!))) : undefined,
  ])
  const gateway: GatewayRecord = { ...source, ...entity }

  /** 各类型仅加载自身使用的资源，不推导或改写任何保存字段。 */
  async function loadNode(data: GatewayRecord): Promise<GatewayOutlineModel> {
    const id = data.provider || ''
    const issues: OutlineIssue[] = []
    const model: GatewayOutlineModel = {
      gateway: data, provider: providers?.find(item => item.id === id), network: NetworkTypeMapping.has(id) ? data.channelInfo : undefined,
      protocol: data.protocolDetail, properties: [], documents: data.transportDetail ? [data.transportDetail] : [], children: [],
      builtin: builtinProviders.includes(id), issues,
    }
    const jobs: Promise<void>[] = []
    const networkType: string | string[] | undefined = NetworkTypeMapping.get(id)
    if (networkType && data.channelId) {
      jobs.push((async () => {
        const channelId = data.channelId!
        const key = JSON.stringify([networkType, channelId])
        const items = await attempt('network', issues, () => cached(networks, key, () => resultOf<NetworkResource[]>(
          Array.isArray(networkType) ? getNetworkComponentList({ networkTypes: networkType }, channelId) : getNetworkList(networkType, channelId, {}),
        )))
        if (items) {
          model.network = items.find(item => item.id === channelId) ?? data.channelInfo
          if (!items.some(item => item.id === channelId)) issues.push('network')
        }
      })())
    }
    if (pluginProviders.includes(id) && data.channelId) {
      jobs.push((async () => {
        const type = id === 'media-plugin' ? 'media' : 'deviceGateway'
        const [items, description] = await Promise.all([
          attempt('plugin', issues, () => cached(plugins, type, () => resultOf<NamedResource[]>(getPluginList({
            terms: [{ terms: [{ column: 'type', value: type, termType: 'eq' }] }],
            sorts: [{ name: 'createTime', order: 'desc' }], paging: false,
          })))),
          attempt('plugin', issues, () => cached(metadata, data.channelId!, () => resultOf<PluginMetadata>(getPluginConfig(data.channelId!)))),
        ])
        model.plugin = items?.find(item => item.id === data.channelId)
        if (items && !model.plugin) issues.push('plugin')
        model.properties = description?.others?.configMetadata?.properties || []
      })())
    }
    if (model.builtin) model.protocol = data.protocolDetail ?? model.provider
    const transport: string | undefined = ProtocolMapping.get(id)
    if (data.protocol && ProtocolMapping.has(id) && !model.builtin && !agentProviders.includes(id)) {
      jobs.push((async () => {
        const items = await attempt('protocol', issues, () => cached(protocols, transport || '', () => resultOf<NamedResource[]>(getProtocolList(
          transport || '', { 'sorts[0].name': 'createTime', 'sorts[0].order': 'desc', paging: false },
        ))))
        if (items) {
          model.protocol = items.find(item => item.id === data.protocol) ?? data.protocolDetail
          if (!items.some(item => item.id === data.protocol)) issues.push('protocol')
        }
        // 已有关联信息也不能代替协议传输文档，优先加载实际协议的文档与路由。
        const config = await attempt('document', issues, () => cached(documents, JSON.stringify([data.protocol, transport]), () => resultOf<ProtocolDocument | ProtocolDocument[]>(
          transport ? getConfigView(data.protocol!, transport) : getChildConfigView(data.protocol!),
        )))
        if (config) model.documents = Array.isArray(config) ? config : [config]
        else if (data.transportDetail) model.documents = [data.transportDetail]
      })())
    }
    await Promise.all(jobs)
    return model
  }

  const root = await loadNode(gateway)
  root.issues.push(...initialIssues)
  if (gateway.provider === 'composite-device-gateway') {
    const raw = gateway.configuration?.gateways
    const configured: GatewayRecord[] = Array.isArray(raw) ? raw.map(item => item && typeof item === 'object' ? item : {}) : []
    if (configured.length) {
      const enriched = await attempt('children', root.issues, () => resultOf<GatewayRecord[]>(getCompositeProviderDetail(configured)))
      root.children = await Promise.all(mergeChildren(configured, enriched || []).map(loadNode))
    }
  }
  return root
}
