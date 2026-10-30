import { deviceAlarmApi } from '../../alarm/api'
import type { ThingPropertyPreprocess } from '../../alarm/types'
import { isEmptyRule } from './codec'

export interface RuleScope { productId: string; deviceId?: string; name?: string; canUpdate?: boolean }

export async function loadRules(scope: RuleScope, property?: string | string[]) {
  const query = { paging: false, terms: property ? [{ column: 'property',
    ...(Array.isArray(property) ? { termType: 'in' } : {}), value: property }] : [] }
  const [product, device] = await Promise.all([
    deviceAlarmApi.queryProductAlarmList(scope.productId, query),
    scope.deviceId ? deviceAlarmApi.queryDeviceAlarmList(scope.productId, scope.deviceId, query) : Promise.resolve([]),
  ])
  return { product, device }
}

/** DELETE on a device is reserved for restoring inheritance; an empty override must be persisted. */
export function saveRule(scope: RuleScope, property: string, raw: ThingPropertyPreprocess) {
  if (scope.deviceId) return deviceAlarmApi.saveDeviceAlarm(scope.productId, scope.deviceId, property, raw)
  if (isEmptyRule(raw)) return deviceAlarmApi.deleteProductAlarm(scope.productId, property)
  return deviceAlarmApi.saveProductAlarm(scope.productId, property, raw)
}

export function restoreRule(scope: RuleScope, property: string) {
  if (!scope.deviceId) throw new Error('Device scope required')
  return deviceAlarmApi.deleteDeviceAlarm(scope.productId, scope.deviceId, property)
}
