import { query, detail } from './instance'
import { detail as productDetail } from './product'
import { parseMetadata, propertyIdOf, propertyNameOf, formatPropertyUnit } from '../views/device/alarm/utils'
import { metricSourceTerms, type MetricDeviceOption, type MetricPropertyOption } from '../views/device/metrics/metricSources'
import type { MetricContext } from '@jetlinks-web-core/components'

const requireSourceSuccess = <T extends { status?: number; message?: string }>(response: T): T => {
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response
}

/** 查询沿用设备资产授权，无在线状态限定，分页避免全量加载设备。 */
export async function queryMetricDevices(context: MetricContext, keyword: string, pageIndex: number, scoped: boolean) {
  const response = await query({ pageIndex, pageSize: 20, sorts: [{ name: 'name', order: 'asc' }], terms: [
    ...(scoped ? metricSourceTerms(context) : []),
    ...(keyword.trim() ? [{ column: 'name', termType: 'like', value: `%${keyword.trim()}%` }] : []),
  ] })
  requireSourceSuccess(response)
  const page = response.result as { data?: MetricDeviceOption[]; total?: number } | undefined
  return { data: page?.data || [], total: page?.total || 0 }
}

/** 离线设备从实体及产品物模型回填，不能依赖在线运行注册表。 */
export async function loadMetricDevice(id: string) {
  const response = await detail(id)
  requireSourceSuccess(response)
  const device = response.result
  if (!device) throw new Error('Device metadata unavailable')
  let properties = parseMetadata(device.metadata).properties
  if (!properties.length && device.productId) {
    const product = await productDetail(device.productId)
    requireSourceSuccess(product)
    properties = parseMetadata(product.result?.metadata).properties
  }
  return {
    device: { id: device.id, name: device.name || device.id, productId: device.productId } as MetricDeviceOption,
    properties: properties.map((property): MetricPropertyOption => ({
      id: propertyIdOf(property), name: propertyNameOf(property), unit: formatPropertyUnit(property.valueType?.unit),
    })).filter(property => property.id),
  }
}
