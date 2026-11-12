interface GatewayResource {
  id?: string
  name?: string
  description?: string
  addresses?: { address: string }[]
}

/** 概览只读候选项，不向表单或保存参数写入展示字段。 */
export function findGatewayResource(items: readonly GatewayResource[], id: unknown): GatewayResource | null {
  return items.find(item => item.id === id) || null
}
