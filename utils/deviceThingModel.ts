export type DeviceThingModelMetadata = {
  properties?: Array<Record<string, any>>
  functions?: Array<Record<string, any>>
  events?: Array<Record<string, any>>
  tags?: Array<Record<string, any>>
}

const emptyMetadata = (): Required<DeviceThingModelMetadata> => ({
  properties: [],
  functions: [],
  events: [],
  tags: [],
})

/** 将运行时返回的 JSON 字符串或对象规范为原版物模型可使用的结构。 */
export function normalizeDeviceThingModelMetadata(value: unknown): Required<DeviceThingModelMetadata> {
  if (!value) return emptyMetadata()

  let source: any = value
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value)
    } catch {
      return emptyMetadata()
    }
  }

  if (!source || typeof source !== 'object') return emptyMetadata()

  return {
    properties: Array.isArray(source.properties) ? source.properties : [],
    functions: Array.isArray(source.functions) ? source.functions : [],
    events: Array.isArray(source.events) ? source.events : [],
    tags: Array.isArray(source.tags) ? source.tags : [],
  }
}

const hasDefinitions = (metadata: Required<DeviceThingModelMetadata>) => (
  metadata.properties.length > 0
  || metadata.functions.length > 0
  || metadata.events.length > 0
  || metadata.tags.length > 0
)

/**
 * 设备未独立编辑时始终使用产品物模型；独立编辑后才读取设备自身物模型。
 * 重置设备物模型会把 independentMetadata 置回 false，因此会自然回到产品配置。
 */
export function resolveEffectiveDeviceThingModel(input: {
  productMetadata?: unknown
  deviceMetadata?: unknown
  independentMetadata?: boolean
}): Required<DeviceThingModelMetadata> {
  const productMetadata = normalizeDeviceThingModelMetadata(input.productMetadata)
  const deviceMetadata = normalizeDeviceThingModelMetadata(input.deviceMetadata)

  if (input.independentMetadata && hasDefinitions(deviceMetadata)) return deviceMetadata
  if (hasDefinitions(productMetadata)) return productMetadata
  return deviceMetadata
}

/** 新写入只认 expands.isKeyMetric；读取时兼容已存在的等价历史标记。 */
export function isKeyMetricProperty(property: Record<string, any> | undefined | null): boolean {
  const expands = property?.expands ?? property ?? {}
  return [
    expands.focus,
    expands.focused,
    expands.attention,
    expands.concern,
    expands.keyMetric,
    expands.isKeyMetric,
    expands.showInOverview,
    property?.isKeyMetric,
  ].some((value) => value === true || value === 'true' || value === 1 || value === '1')
}

/** 概览和实时订阅只使用明确标记的有效物模型属性，不回退到遥测或模板 mock 数据。 */
export function collectOverviewPropertyKeys(metadata: unknown, limit?: number): string[] {
  const keys = normalizeDeviceThingModelMetadata(metadata)
    .properties
    .filter(isKeyMetricProperty)
    .map((property) => property.id || property.property || property.key || property.name)
    .filter(Boolean)
    .map(String)

  return typeof limit === 'number' ? keys.slice(0, limit) : keys
}
