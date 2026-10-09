import { ref } from 'vue'
import { allResources, resourceClusters, supports } from '../../../../api/link/type'
import { getProviders, getStoragList } from '../../../../api/product'

export interface ResourcePackageEnvironment {
  resources: any[]
  clusters: any[]
  networkTypes: any[]
  gatewayProviders: any[]
  storagePolicies: any[]
}

interface NetworkPortBinding {
  host: string
  port: number
  transport: 'TCP' | 'UDP'
}

/**
 * 复用网络组件页面的环境数据源，为导入确认提供客户端预检；服务端启动仍是最终端口校验。
 */
export const useResourcePackagePreflight = () => {
  const environment = ref<ResourcePackageEnvironment>({
    resources: [], clusters: [], networkTypes: [], gatewayProviders: [], storagePolicies: [],
  })
  const errors = ref<string[]>([])
  const loading = ref(false)

  const load = async () => {
    loading.value = true
    try {
      const [resources, clusters, networkTypes, gatewayProviders, storagePolicies] = await Promise.all([
        allResources(), resourceClusters(), supports(), getProviders(), getStoragList(),
      ])
      environment.value = {
        resources: resources.result || [],
        clusters: clusters.result || [],
        networkTypes: networkTypes.result || [],
        gatewayProviders: gatewayProviders.result || [],
        storagePolicies: storagePolicies.result || [],
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 对照网络组件页面的端口资源规则预检。
   * 当资源包要覆盖同 ID 且端口绑定完全相同的本地网络组件时，该组件自身的已占用端口不应阻断更新。
   */
  const validate = (product: Record<string, any>, network?: Record<string, any>, localNetworks: Record<string, any>[] = []) => {
    const messages: string[] = []
    const policy = product.storePolicy
    if (policy && !environment.value.storagePolicies.some(item => item.id === policy)) {
      messages.push('产品存储策略在当前环境不可用')
    }
    const networkType = getEnumValue(network?.type)
    if (networkType && !environment.value.networkTypes.some(item => item.id === networkType)) {
      messages.push('网络组件类型在当前环境不受支持')
    }
    const bindings = getPortBindings(network)
    const current = localNetworks.find(item => item.id === network?.id)
    const isCurrentNetworkBinding = !!current && isSamePortBindings(bindings, getPortBindings(current))
    bindings.forEach(({ host, port, transport }) => {
      if (isCurrentNetworkBinding) return
      const candidates = environment.value.resources.filter(resource => host === '0.0.0.0' || resource.host === host)
      if (!candidates.length || candidates.some(resource => !resource.ports?.[transport]?.includes(port))) {
        messages.push(`监听端口 ${host}:${port} 不在当前可用 ${transport} 端口资源中`)
      }
    })
    errors.value = messages
    return messages.length === 0
  }

  return { environment, errors, loading, load, validate }
}

/** 将单机与集群网络组件收敛成可比较的监听端口集合。 */
const getPortBindings = (network?: Record<string, any>): NetworkPortBinding[] => {
  if (!network) return []
  const configurations = network.shareCluster === false
    ? (network.cluster || []).map((item: any) => item.configuration)
    : [network.configuration]
  return configurations
    .filter(Boolean)
    .map((configuration: any) => ({
      port: Number(configuration.port || configuration.publicPort || configuration.remotePort),
      host: configuration.host || configuration.publicHost || configuration.remoteHost || '0.0.0.0',
      transport: String(configuration.transport || getEnumValue(network.type) || '').toUpperCase().includes('UDP') ? 'UDP' : 'TCP',
    }))
    .filter(binding => binding.port > 0)
    .sort((left, right) => `${left.transport}:${left.host}:${left.port}`.localeCompare(`${right.transport}:${right.host}:${right.port}`))
}

const isSamePortBindings = (left: NetworkPortBinding[], right: NetworkPortBinding[]) => left.length === right.length
  && left.every((binding, index) => binding.host === right[index].host
    && binding.port === right[index].port
    && binding.transport === right[index].transport)

const getEnumValue = (value: any) => value && typeof value === 'object' ? value.value : value
