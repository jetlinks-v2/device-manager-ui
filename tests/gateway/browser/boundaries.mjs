import { computed, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../locales/lang/zh.json'
import en from '../../../locales/lang/en.json'
import coreZh from '../../../../../jetlinks-web-core/src/locales/lang/zh.json'
import { createOutlineFixture } from '../outline-fixture.mjs'

export const options = new URLSearchParams(location.search)
export const fixtureId = options.get('provider') || 'http-server-gateway'
export const capture = reactive({ writes: [], callbacks: [], opens: [], messages: [], reads: [], errors: [] })
const outlineFixture = options.has('outline') ? createOutlineFixture(fixtureId, {
  independent: options.has('independent'), failure: options.get('outlineFailure'),
  emptyChildren: options.has('emptyChildren'), missingNetwork: options.has('missingNetwork'),
  missingProtocol: options.has('missingProtocol'), long: options.has('long'),
}) : undefined
export let router
export function setRouter(value) { router = value }
const ids = ['mqtt-server-gateway', 'mqtt-client-gateway', 'websocket-server', 'coap-server-gateway', 'tcp-server-gateway', 'udp-device-gateway', 'http-server-gateway', 'child-device', 'plugin_gateway', 'composite-device-gateway', 'fixed-media', 'onvif', 'gb28181-2016', 'OneNet', 'OneNet-platform', 'Ctwing', 'modbus-tcp', 'opc-ua', 'collector-gateway', 'official-edge-gateway', 'edge-child-device', 'agent-device-gateway', 'agent-media-device-gateway', 'media-plugin']
const names = ['MQTT服务', 'MQTT客户端', 'WebSocket服务', 'CoAP服务', 'TCP服务', 'UDP服务', 'HTTP服务', '网关子设备', '插件接入', '复合网关', '固定地址视频', 'Onvif', 'GB28181', 'OneNet旧版', 'OneNet新版', 'Ctwing', 'Modbus TCP', 'OPC UA', '数据采集', '边缘网关', '边缘子设备', 'Agent设备', 'Agent视频设备', '视频插件']
export const providers = ids.map((id, i) => ({ id, name: names[i], description: `${names[i]}接入设备，配置网络和消息处理方式`, channel: ({ 'child-device': 'child-device', 'fixed-media': 'fixed-media', onvif: 'onvif', 'gb28181-2016': 'gb28181', 'media-plugin': 'plugin', OneNet: 'OneNet', 'OneNet-platform': 'OneNet', Ctwing: 'Ctwing', 'edge-child-device': 'edge-child-device', 'official-edge-gateway': 'network', 'collector-gateway': 'collector' })[id] || 'network' }))
export const network = { id: 'network-1', name: '测试网络组件', type: options.get('transport') || (fixtureId.startsWith('agent-') ? 'HTTP_SERVER' : 'MQTT_SERVER'), addresses: [{ address: '127.0.0.1:1883', health: 1 }] }
export const protocol = { id: 'protocol-1', name: '测试消息协议', description: '设备消息编解码协议' }
const child = { id: 'child-1', name: '测试子网关', provider: 'tcp-server-gateway', channel: 'network', channelId: network.id, protocol: protocol.id, transport: 'TCP', channelInfo: network, protocolDetail: protocol }
const config = { apiAddress: 'https://example.test/api', apiKey: 'test-key', appKey: 'test-app', appSecret: 'test-secret', validateToken: 'test-token', aesKey: 'test-aes', retries: 0, enabled: false }
const signal = { domain: '3402000000', sipId: '34020000002000000001', shareCluster: !options.has('independent'), hostPort: { host: '0.0.0.0', port: 5060, publicHost: '127.0.0.1', publicPort: 5061 }, cluster: [{ clusterNodeId: 'node-1', host: '0.0.0.0', port: 5060, publicHost: '127.0.0.1', publicPort: 5061, enabled: true, id: 1 }] }
const chosen = providers.find(item => item.id === fixtureId)
const existing = { id: 'existing-gateway', name: '已有网关', bizKey: 'existing-key', description: '已有说明', provider: fixtureId, protocol: protocol.id, channel: chosen.channel, channelId: ['plugin_gateway', 'media-plugin'].includes(fixtureId) ? 'plugin-1' : network.id, channelInfo: network, protocolDetail: protocol, state: { value: 'disabled', text: '已禁用' }, configuration: fixtureId === 'gb28181-2016' ? signal : fixtureId === 'composite-device-gateway' ? { gateways: [child] } : config }
const copy = value => JSON.parse(JSON.stringify(value))
async function call(method, url, data) {
  const record = { method, url, ...(data === undefined ? {} : { body: copy(data) }) }
  if (outlineFixture) {
    const writesBefore = outlineFixture.writes.length
    try {
      const response = await outlineFixture.request(method, url, data)
      if (response !== undefined) {
        capture.reads.push(record)
        return response
      }
    } catch (error) {
      if (outlineFixture.writes.length > writesBefore) capture.writes.push(record)
      else capture.reads.push(record)
      throw error
    }
  }
  if (url === '/gateway/device' && ['POST', 'PATCH'].includes(method)) {
    capture.writes.push(record)
    return options.has('failure') ? { status: 400, success: false } : { status: 200, success: true, result: { ...copy(data), id: data.id || 'saved-gateway' } }
  }
  capture.reads.push(record)
  if ((url === '/media/server/providers' && options.has('withoutMedia'))
    || (url === '/data-collect/channel/providers' && options.has('withoutCollector'))) {
    return { status: 404, success: false }
  }
  let result = []
  if (url === '/gateway/device/providers') result = copy(providers)
  else if (url === '/gateway/device/detail/config') result = data
  else if (url === '/gateway/device/detail/_query') result = { data: [copy(existing)], total: 1 }
  else if (url.startsWith('/gateway/device/')) result = copy(existing)
  else if (url.startsWith('/network/config/')) result = [copy(network)]
  else if (url.startsWith('/protocol/supports/')) result = [protocol]
  else if (url.startsWith('/protocol/')) result = { id: 'MQTT', document: '# 协议文档\n完整的设备消息及 Topic 说明', routes: [{ topic: '/device/{id}/report', address: '/device/report', description: '上报消息', upstream: true }] }
  else if (url.includes('/plugin/driver/') && url.endsWith('/description')) result = { others: { configMetadata: { properties: [{ property: 'retries', name: '重试次数', type: { type: 'int', expands: { required: true } } }, { property: 'enabled', name: '启用选项', type: { type: 'boolean', trueValue: true, falseValue: false, trueText: '是', falseText: '否' } }] } } }
  else if (url.includes('/plugin/driver')) result = [{ id: 'plugin-1', name: '测试插件', version: '1.0.0' }]
  else if (url === '/network/resources/alive/_all') result = [{ host: '0.0.0.0', clusterNodeId: 'node-1', portList: [{ port: 5060, transports: ['UDP', 'TCP'] }] }]
  else if (url === '/network/resources/clusters') result = [{ id: 'node-1', name: '测试节点' }]
  else if ((url.includes('/product/') || url.includes('/device-product/'))) result = { data: [], total: options.has('bound') ? 1 : 0 }
  return { status: 200, success: true, result }
}
export const request = Object.fromEntries(['get', 'post', 'patch', 'remove', 'put'].map(method => [method, (url, data) => call(method.toUpperCase(), url, data)]))
export const createNdJson = () => () => { throw new Error('NDJSON is outside the gateway fixture') }
export const ndJson = createNdJson()
export const getBaseApi = () => '/fixture'
export const onlyMessage = (text, type) => capture.messages.push({ text, type })
export const randomString = length => 'x'.repeat(length)
export const accessConfigTypeFilter = items => items
export const usePermission = () => ({ hasPerm: computed(() => !options.has('denied')) })
export const useMenuStore = () => ({ getMenu: () => ({ path: '/gateway/detail/:id' }), jumpPage: (code, context) => router.push({ name: 'gateway-detail', ...context }) })
export const useTabSaveSuccessBack = () => ({ onBack: data => capture.callbacks.push(copy(data)) })
export const useTabSaveSuccess = (code, opts) => ({ onOpen: (data, extra) => {
  capture.opens.push({ code, data, extra })
  if (data.provider) opts?.onSuccess?.({ ...child, provider: JSON.parse(data.provider).id })
  return Promise.resolve()
} })
export const useRequest = (fn, opts) => ({ loading: ref(false), run: async (...args) => { const response = await fn(...args); if (response.success) opts.onSuccess?.(response); return response } })
const i18n = createI18n({ legacy: false, locale: options.get('locale') || 'zh', flatJson: true, messages: { zh: { ...coreZh, ...zh }, en }, missingWarn: false, fallbackWarn: false })
export default i18n
