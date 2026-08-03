import {
  type DeviceTemplateProductInput,
  type DeviceLibraryGatewayDetail,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'

export type DeviceLibraryProductRestrictedField =
  | 'accessProvider'
  | 'networkWay'
  | 'transportProtocol'
  | 'messageProtocol'
  | 'accessId'
  | 'gatewayBizKey'
  | 'deviceType'

export type DeviceLibraryProductRestrictedContext = {
  targetGateway?: DeviceLibraryGatewayDetail | null
  currentGateway?: DeviceLibraryGatewayDetail | null
}

const exactValue = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return String(record.value ?? '').trim()
  }
  return String(value ?? '').trim()
}

function isChanged(productValue: unknown, targetValue: unknown) {
  const next = exactValue(targetValue)
  if (!next) return false
  const current = exactValue(productValue)
  return current !== next
}

function targetDeviceType(template: DeviceTemplateProductInput) {
  return exactValue(template.deviceType) || 'device'
}

export function detectRestrictedDeviceLibraryProductChanges(
  product: IotDeviceProductTemplate,
  template: DeviceTemplateProductInput,
  context: DeviceLibraryProductRestrictedContext = {},
): DeviceLibraryProductRestrictedField[] {
  const changes: DeviceLibraryProductRestrictedField[] = []
  const { targetGateway, currentGateway } = context

  // 对齐 MarketplaceDeviceTemplateProvider/AccessInstaller：先从 template 复制产品字段，再用 accessProvider + gatewayBizKey 解析网关并覆盖接入字段。
  if (isChanged(product.accessProvider, targetGateway?.provider)) changes.push('accessProvider')
  if (isChanged(product.networkWay, template.networkWay)) changes.push('networkWay')
  if (isChanged(product.transportProtocol, targetGateway?.transport)) changes.push('transportProtocol')
  if (isChanged(product.messageProtocol, targetGateway?.protocol)) changes.push('messageProtocol')
  if (isChanged(product.accessId, targetGateway?.id)) changes.push('accessId')
  if (isChanged(product.deviceType, targetDeviceType(template))) changes.push('deviceType')
  if (isChanged(currentGateway?.bizKey, targetGateway?.bizKey)) changes.push('gatewayBizKey')

  return Array.from(new Set(changes))
}
