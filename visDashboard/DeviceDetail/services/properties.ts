import { iotDeviceDetailRealApi, formatApiTime, subscribeDeviceProperties } from '../../../views/device/list/services/iotDeviceDetailReal.service'
import { resolveEffectiveDeviceThingModel, isKeyMetricProperty } from '../../../utils/deviceThingModel'
import { recordOf, resultOf, textOf } from './summary'
import type { RealtimePropertyRow } from '../shared'

export interface PropertySnapshot { productId: string; rows: RealtimePropertyRow[] }

function definitionUnit(valueType: Record<string, unknown>): string {
  const nested = recordOf(valueType.unit)
  return String(valueType.unitName || valueType.unitText || valueType.unitLabel
    || (typeof valueType.unit === 'string' ? valueType.unit : undefined)
    || nested.name || nested.text || nested.label || nested.symbol || nested.id
    || valueType.name || valueType.text || valueType.label || valueType.symbol || valueType.id || '')
}

/** 独立画布没有详情宿主时，只加载物模型中明确关注的属性，不回退到全部属性。 */
export async function loadProperties(deviceId: string): Promise<PropertySnapshot> {
  const detail = recordOf(resultOf(await iotDeviceDetailRealApi.getDeviceDetail(deviceId)))
  const metadata = resolveEffectiveDeviceThingModel({ productMetadata: detail.productMetadata ?? detail.deriveMetadata,
    deviceMetadata: detail.metadata, independentMetadata: Boolean(detail.independentMetadata) })
  const productId = String(detail.productId || '')
  const rows: RealtimePropertyRow[] = metadata.properties.filter(isKeyMetricProperty).map((item): RealtimePropertyRow => {
    const valueType = recordOf(item.valueType), expands = recordOf(item.expands), id = String(item.id || '')
    return { id, identifier: id, name: String(item.name || id), value: '--', unit: definitionUnit(valueType),
      dataType: String(valueType.type || 'string'), valueType, accessMode: 'none', writable: false,
      updatedAt: '--', groupId: String(expands.groupId || '__default__'), groupName: String(expands.groupName || ''),
      description: String(item.description || ''), tone: 'stale', expands, focused: true }
  }).filter(item => item.id)
  if (!rows.length) return { productId, rows }
  const result = resultOf(await iotDeviceDetailRealApi.queryDashboard([{ dashboard: 'device', object: productId || deviceId,
    measurement: 'properties', dimension: 'history', params: { deviceId, history: 1, properties: rows.map(item => item.id) } }]))
  if (!Array.isArray(result)) throw new Error('Invalid property snapshot')
  for (const item of result) {
    const data = recordOf(recordOf(item).data), value = recordOf(data.value)
    mergeProperty(rows, { ...data, ...value })
  }
  return { productId, rows }
}
export function mergeProperty(rows: RealtimePropertyRow[], value: Record<string, unknown>) {
  const row = rows.find(item => item.id.toLowerCase() === String(value.property || value.id || '').toLowerCase())
  if (!row) return
  const raw = value.formatValue ?? value.value
  row.value = raw === undefined || raw === null ? '--' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
  row.updatedAt = value.timeString ? textOf(value.timeString) : formatApiTime(value.timestamp, '--')
  row.tone = 'normal'
}
export { subscribeDeviceProperties }
