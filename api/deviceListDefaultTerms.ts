export type IotDeviceListQueryTerm = {
  column?: string
  termType?: string
  value?: unknown
  type?: string
  terms?: IotDeviceListQueryTerm[]
}

export const IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS = [
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
  (provider) => !IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS.includes(provider as typeof IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS[number]),
)

export const IOT_DEVICE_LIST_DEFAULT_PRODUCT_TERM: IotDeviceListQueryTerm = {
  column: 'productId$product-info',
  value: `accessProvider nin (${IOT_DEVICE_LIST_EXCLUDED_ACCESS_PROVIDERS.join(',')})`,
}

export function withIotDeviceListDefaultTerms<T extends IotDeviceListQueryTerm>(terms: T[] = []): Array<T | IotDeviceListQueryTerm> {
  return [
    IOT_DEVICE_LIST_DEFAULT_PRODUCT_TERM,
    ...terms,
  ]
}
