import { request } from '@jetlinks-web/core'
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment'
import { getProviders } from './accessConfig'

export interface GatewayProvider {
  id: string
  name: string
  type?: string
  channel?: string
  [key: string]: unknown
}

const MEDIA_PROVIDERS = new Set(['fixed-media', 'gb28181-2016', 'onvif', 'media-plugin', 'agent-media-device-gateway'])
const COLLECTOR_PROVIDERS = new Set(['collector-gateway', 'modbus-tcp', 'opc-ua'])

async function hasManagementModule(path: string): Promise<boolean> {
  try {
    const response: { success?: boolean; result?: unknown } = await request.get(
      path, undefined, { hiddenError: true, timeout: 10000 },
    )
    // 目录为空只表示尚无提供商；命令服务、运行模块和已有设备均不能代表管理接口存在。
    return response.success === true && Array.isArray(response.result)
  } catch {
    return false
  }
}

/** 新增及编辑配置使用可用接入方式；历史列表和只读详情继续使用原始 Provider 元数据。 */
export async function getAvailableGatewayProviders() {
  const response = await getProviders()
  if (!response.success || !Array.isArray(response.result)) throw new Error('Gateway providers request failed')
  const providers = response.result as GatewayProvider[]
  if (!isPrivateDeployment()) return { ...response, result: providers }

  // 仅探测候选列表涉及的模块，每次读取当前请求上下文，不缓存跨账号或项目的结果。
  const [media, collector] = await Promise.all([
    providers.some(provider => MEDIA_PROVIDERS.has(provider.id))
      ? hasManagementModule('/media/server/providers') : false,
    providers.some(provider => COLLECTOR_PROVIDERS.has(provider.id))
      ? hasManagementModule('/data-collect/channel/providers') : false,
  ])
  return {
    ...response,
    result: providers.filter(provider =>
      (!MEDIA_PROVIDERS.has(provider.id) || media) && (!COLLECTOR_PROVIDERS.has(provider.id) || collector)),
  }
}
