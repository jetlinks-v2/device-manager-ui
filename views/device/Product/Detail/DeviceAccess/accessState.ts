import { cloneDeep } from 'lodash-es'
import type { ConfigMetadata, ProductItem } from '../../typings'

export interface AccessGateway {
  id: string
  name?: string
  provider?: string
  channel?: string
  channelId?: string
  protocol?: string
  transport?: string
  protocolDetail?: { name?: string }
  transportDetail?: { metadata?: string; allConfig?: ConfigMetadata[] }
}

export interface AccessSelection {
  access: AccessGateway
  metadata: ConfigMetadata[]
  productTypes?: { id: string; name: string; metadata?: Record<string, unknown> }[]
}

/** 一次保存固定产品、网关、配置与物模型，异步期间不再读取可变页面状态。 */
export interface AccessSaveData {
  id: string
  product: ProductItem
  access: AccessGateway
  values: Record<string, unknown> & { storePolicy: string }
  metadata: Record<string, unknown>
  productTypeId?: string
}

/** 只删除旧网关专属字段，保留新旧共享字段及未归属于旧协议的通用配置。 */
export function reconcileAccessConfiguration(
  values: Record<string, unknown>, previous: ConfigMetadata[], next: ConfigMetadata[],
): Record<string, unknown> {
  const result = cloneDeep(values)
  const nextProperties = next.flatMap(group => group.properties || [])
  const nextKeys = new Set(nextProperties.map(property => property.property))
  for (const group of previous) {
    for (const property of group.properties || []) {
      if (!nextKeys.has(property.property)) delete result[property.property]
    }
  }
  for (const property of nextProperties) {
    if (result[property.property] === undefined && property.type?.expands?.defaultValue !== undefined) {
      result[property.property] = cloneDeep(property.type.expands.defaultValue)
    }
  }
  return result
}
