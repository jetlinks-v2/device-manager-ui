import {
  normalizeDeviceTypeValue,
  type DeviceTemplateProductInput,
  type IotDeviceProductCategory,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import i18n from '@jetlinks-web-core/locales'

const DEVICE_CATEGORY_META: Record<IotDeviceProductCategory, { labelKey: string }> = {
  video: { labelKey: 'IotDeviceLibrary.category.video' },
  meter: { labelKey: 'IotDeviceLibrary.category.meter' },
  sensor: { labelKey: 'IotDeviceLibrary.category.sensor' },
  industrial: { labelKey: 'IotDeviceLibrary.category.industrial' },
  integration: { labelKey: 'IotDeviceLibrary.category.integration' },
}

export function categoryLabel(categoryKey: string) {
  const meta = DEVICE_CATEGORY_META[categoryKey as IotDeviceProductCategory] ?? DEVICE_CATEGORY_META.integration
  return i18n.global.t(meta.labelKey)
}

function normalizeTemplateCategory(categoryKey?: IotDeviceProductCategory) {
  return categoryKey && DEVICE_CATEGORY_META[categoryKey]
    ? categoryKey
    : 'integration'
}

export function toTemplateProductOption(template: DeviceTemplateProductInput): IotDeviceProductTemplate {
  const categoryKey = normalizeTemplateCategory(template.category)
  const supportedManufacturers = template.supportedManufacturers ?? []

  return {
    id: template.id,
    name: template.name,
    summary: template.summary || template.description || template.describe || template.classifiedName || '',
    category: categoryKey,
    accessName: template.accessName || template.accessProvider || template.transportProtocol || '--',
    sourceProduct: template.sourceProduct || template.classifiedName || template.name,
    manufacturer: template.manufacturer,
    model: template.model,
    tags: template.tags,
    tagIds: template.tagIds,
    tagGroups: template.tagGroups,
    installed: template.installed,
    installedProductId: template.installedProductId,
    supportedManufacturers,
    modelKeywords: [
      template.id,
      template.classifiedId,
      template.classifiedName,
      template.accessName,
      template.accessProvider,
      template.messageProtocol,
      template.transportProtocol,
      ...(template.modelKeywords ?? []),
    ].filter((value): value is string => Boolean(value)),
    templateId: template.id,
    deviceType: normalizeDeviceTypeValue(template.deviceType),
    photoUrl: template.photoUrl,
    faultCodeDict: template.faultCodeDict,
    version: template.version,
    accessProvider: template.accessProvider,
    networkWay: template.networkWay,
    transportProtocol: template.transportProtocol,
    messageProtocol: template.messageProtocol,
    protocolName: template.protocolName,
    accessModes: template.accessModes,
    supportedModels: template.supportedModels,
    dataPoints: template.dataPoints,
  }
}
