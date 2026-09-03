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
