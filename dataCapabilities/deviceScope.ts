export interface DeviceScopeQueryTerm extends Record<string, unknown> {
  column: string
  value: string
}

export const IOT_DEVICE_EXCLUDED_ACCESS_PROVIDERS = [
  'agent-device-gateway',
  'agent-media-device-gateway',
  'official-edge-gateway',
  'fixed-media',
  'gb28181-2016',
  'media-plugin',
  'onvif',
] as const

export const IOT_DEVICE_SUPPORTED_ACCESS_PROVIDERS = [
  'mqtt-server-gateway',
  'websocket-server',
  'coap-server-gateway',
  'plugin_gateway',
  'media-plugin',
  'tcp-server-gateway',
  'OneNet-platform',
  'Ctwing',
  'child-device',
  'http-server-gateway',
  'agent-media-device-gateway',
  'fixed-media',
  'udp-device-gateway',
  'onvif',
  'agent-device-gateway',
  'gb28181-2016',
  'collector-gateway',
  'mqtt-client-gateway',
  'OneNet',
  'composite-device-gateway',
] as const

export const IOT_DEVICE_DASHBOARD_ACCESS_PROVIDERS = IOT_DEVICE_SUPPORTED_ACCESS_PROVIDERS.filter(
  provider => !IOT_DEVICE_EXCLUDED_ACCESS_PROVIDERS.includes(
    provider as typeof IOT_DEVICE_EXCLUDED_ACCESS_PROVIDERS[number],
  ),
)

export function createIotDeviceScopeTerm(): DeviceScopeQueryTerm {
  return {
    column: 'productId$product-info',
    value: `accessProvider nin (${IOT_DEVICE_EXCLUDED_ACCESS_PROVIDERS.join(',')})`,
  }
}
