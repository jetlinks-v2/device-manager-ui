// Detail fixtures deliberately use config-only children without gateway entity IDs.
export const outlineProviderIds = ['mqtt-server-gateway', 'mqtt-client-gateway', 'websocket-server', 'coap-server-gateway', 'tcp-server-gateway', 'udp-device-gateway', 'http-server-gateway', 'child-device', 'plugin_gateway', 'composite-device-gateway', 'fixed-media', 'onvif', 'gb28181-2016', 'OneNet', 'OneNet-platform', 'Ctwing', 'modbus-tcp', 'opc-ua', 'collector-gateway', 'official-edge-gateway', 'edge-child-device', 'agent-device-gateway', 'agent-media-device-gateway', 'media-plugin']
const providerNames = ['MQTT服务', 'MQTT客户端', 'WebSocket服务', 'CoAP服务', 'TCP服务', 'UDP服务', 'HTTP服务', '网关子设备', '插件接入', '复合网关', '固定地址视频', 'Onvif', 'GB28181', 'OneNet旧版', 'OneNet新版', 'Ctwing', 'Modbus TCP', 'OPC UA', '数据采集', '边缘网关', '边缘子设备', 'Agent设备', 'Agent视频设备', '视频插件']
const clone = value => JSON.parse(JSON.stringify(value))

export function createOutlineFixture(provider, options = {}) {
  const reads = [], writes = [], failures = new Set()
  const networks = [
    { id: 'network-a', name: 'MQTT网络 A', description: '网络 A 的说明', addresses: [{ address: 'mqtt://127.0.0.1:1883', health: 1 }, { address: 'mqtt://127.0.0.2:1883', health: -1 }] },
    { id: 'network-b', name: 'HTTP网络 B', description: '网络 B 的说明', addresses: [{ address: 'https://127.0.0.1:8443', health: 1 }] },
  ]
  const protocols = [
    { id: 'protocol-a', name: 'MQTT协议 A', description: '协议 A 的说明' },
    { id: 'protocol-b', name: 'HTTP协议 B', description: '协议 B 的说明' },
  ]
  const plugin = { id: 'plugin-1', name: '采集插件 C', version: '1.2.3', description: '插件 C 的说明' }
  const providers = outlineProviderIds.map((id, index) => ({ id, name: providerNames[index], description: `${providerNames[index]}接入说明` }))
  const cloud = { apiAddress: 'https://example.test/api', apiKey: 'api-test', validateToken: 'token-test', aesKey: '', appKey: 'app-test', appSecret: 'secret-test', description: '云配置说明' }
  const pluginConfig = { retries: 0, enabled: false, modes: ['mode-a', 'mode-b'] }
  const children = [
    { name: 'MQTT通道 A', provider: 'mqtt-server-gateway', channel: 'network', channelId: 'network-a', protocol: 'protocol-a', transport: 'MQTT', configuration: { custom: 'a' } },
    { name: 'HTTP通道 B', provider: 'http-server-gateway', channel: 'network', channelId: 'network-b', protocol: 'protocol-b', transport: 'HTTP', configuration: { custom: 'b' } },
    { name: '插件通道 C', provider: 'plugin_gateway', channel: 'plugin', channelId: 'plugin-1', configuration: pluginConfig },
  ]
  const sharedSignal = { domain: '3402000000', sipId: '34020000002000000001', shareCluster: !options.independent, hostPort: { host: '0.0.0.0', port: 5060, publicHost: '', publicPort: 0 }, cluster: [{ clusterNodeId: 'node-1', enabled: false, host: '0.0.0.0', port: 0, publicHost: '127.0.0.1', publicPort: 5061 }] }
  const configuration = provider === 'composite-device-gateway' ? { gateways: options.emptyChildren ? [] : children }
    : provider === 'gb28181-2016' ? sharedSignal
      : ['plugin_gateway', 'media-plugin'].includes(provider) ? pluginConfig : cloud
  const gateway = { id: 'existing-gateway', name: '已有网关', i18nName: '详情验证网关', bizKey: '', createTime: 1793923200000, description: '详情验证说明', provider,
    channel: ({ 'OneNet-platform': 'OneNet', OneNet: 'OneNet', Ctwing: 'Ctwing', 'gb28181-2016': 'gb28181', 'plugin_gateway': 'plugin', 'media-plugin': 'plugin' })[provider] || 'network',
    channelId: ['plugin_gateway', 'media-plugin'].includes(provider) ? plugin.id : networks[0].id,
    protocol: protocols[0].id, transport: provider.includes('http') ? 'HTTP' : 'MQTT', state: { value: 'disabled', text: '已禁用' }, configuration }
  const metadata = { others: { configMetadata: { properties: [
    { property: 'retries', name: '重试次数' }, { property: 'enabled', name: '启用选项' }, { property: 'modes', name: '模式列表' },
  ] } } }
  const protocolView = (id, transport) => ({ id: transport || 'MQTT', document: `# ${id}认证说明\n\n\`\`\`text\nclientId: deviceId\n${'long-path/'.repeat(options.long ? 80 : 2)}\n\`\`\``, routes: [
    { group: '属性', topic: `/${id}/report`, address: `/${id}/report`, example: { value: 0, enabled: false }, description: `路由-${id}`, upstream: true, downstream: false },
    { group: '属性', topic: `/${id}/read/reply`, address: `/${id}/read/reply`, description: '读取回复', upstream: true },
    { group: '事件', topic: `/${id}/event`, address: `/${id}/event`, description: '事件上报', upstream: true },
    { group: '属性', topic: `/${id}/write`, address: `/${id}/write`, description: '独立分组不能跨行合并', downstream: true },
  ] })
  async function request(method, url, body) {
    const record = { method, url, ...(body === undefined ? {} : { body: clone(body) }) }
    if (url === '/gateway/device' || /\/_startup$|\/_shutdown$/.test(url) || ['PATCH', 'REMOVE', 'DELETE', 'PUT'].includes(method)) {
      writes.push(record)
      throw new Error('Unexpected mutating request in outline')
    }
    reads.push(record)
    const scope = url.startsWith('/network/config/') ? 'network' : url === '/gateway/device/existing-gateway' ? 'detail' : url === '/gateway/device/detail/config' ? 'children' : ''
    if (options.failure === scope && !failures.has(scope)) { failures.add(scope); return { status: 500, success: false } }
    let result
    if (url === '/gateway/device/providers') result = providers
    else if (url === '/gateway/device/detail/_query') result = { data: [gateway], total: 1 }
    else if (url === '/gateway/device/existing-gateway') result = gateway
    else if (url === '/gateway/device/detail/config') result = [...body].reverse().map(child => ({ ...child, channelInfo: networks.find(item => item.id === child.channelId), protocolDetail: protocols.find(item => item.id === child.protocol) }))
    else if (url.startsWith('/gateway/device/')) throw new Error(`Config child queried as entity: ${url}`)
    else if (url.startsWith('/network/config/')) result = options.missingNetwork ? [] : networks
    else if (url.startsWith('/protocol/supports/')) result = options.missingProtocol ? [] : protocols
    else if (url.startsWith('/protocol/')) {
      const parts = url.split('/')
      result = protocolView(parts[2], parts[4])
    }
    else if (url === '/plugin/driver/_query/no-paging') result = [plugin]
    else if (url === '/plugin/driver/plugin-1/description') result = metadata
    else return undefined
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay))
    return { status: 200, success: true, result: clone(result) }
  }
  return { gateway, providers, networks, protocols, children, reads, writes, request }
}
