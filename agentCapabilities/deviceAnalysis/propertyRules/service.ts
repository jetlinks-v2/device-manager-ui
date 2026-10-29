import i18n from '@jetlinks-web-core/locales'
import { createDomainAgentRecordSetCardinality, createDomainAgentToolResult, resolveDomainAgentInteger } from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { queryDefaultAlarmLevels, queryDeviceAlarmNotifyMethods, queryDeviceAlarmNotifyUsers } from '../../../views/device/alarm/api'
import type { ThingModelProperty } from '../../../views/device/alarm/types'
import { propertyIdOf } from '../../../views/device/alarm/utils'
import { loadRules } from '../../../views/device/components/PropertyRules/service'
import { getMetadata, inputError, normalizeText, runDeviceTool } from '../deviceAnalysis.shared'
import { explainPropertyRule, readRuleAlarm, type EffectivePropertyRule, type PropertyRuleExplanation, type RuleResources } from './explain'

export interface PropertyRuleSubject {
  id: string
  productId: string
  properties: ThingModelProperty[]
}

/** Read saved effective rules in a bounded property page; all requests retain the caller's project and asset permissions. */
export async function queryDevicePropertyRules(subject: PropertyRuleSubject, args: Record<string, unknown>) {
  return runDeviceTool<PropertyRuleExplanation[]>([], async () => {
    if (!subject.productId) throw inputError('DEVICE_PRODUCT_REQUIRED', 'ruleProductRequired')
    const propertyId = normalizeText(args.propertyId)
    const properties = propertyId ? subject.properties.filter(property => propertyIdOf(property) === propertyId) : subject.properties
    if (propertyId && !properties.length) throw inputError('PROPERTY_NOT_FOUND', 'propertyNotFound', { propertyId })
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const page = properties.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
    // Either scope failing makes the effective result unknown; never silently fall back to product rules.
    const { product, device } = page.length
      ? await loadRules({ productId: subject.productId, deviceId: subject.id }, page.map(propertyIdOf))
      : { product: [], device: [] }
    const products = new Map(product.map(rule => [rule.property, rule]))
    const devices = new Map(device.map(rule => [rule.property, rule]))
    const effective: EffectivePropertyRule[] = page.map(property => ({ property,
      product: products.get(propertyIdOf(property)), device: devices.get(propertyIdOf(property)) }))
    const alarms = effective.map(readRuleAlarm).filter(row => row !== null)
    const notifications = alarms.filter(row => row.notification.enabled).map(row => row.notification)
    const userIds = [...new Set(notifications.flatMap(config => config.userIds))]
    const resources: RuleResources = {}
    // These are display-only lookups, once per page. Failure cannot change the configured conditions.
    const auxiliary = await Promise.allSettled([
      alarms.length ? queryDefaultAlarmLevels().then(levels => { resources.levels = levels }) : Promise.resolve(),
      notifications.length ? queryDeviceAlarmNotifyMethods().then(methods => { resources.methods = methods }) : Promise.resolve(),
      userIds.length ? queryDeviceAlarmNotifyUsers({ paging: false, userIds }).then(result => {
        resources.users = result.data.map(({ id, name }) => ({ id, name }))
      }) : Promise.resolve(),
    ])
    const t = (key: string, params?: Record<string, string | number>) => i18n.global.t(key, params ?? {})
    const data = effective.map(rule => explainPropertyRule(rule, resources, t))
    const warnings = [...new Set(data.flatMap(rule => rule.warnings))]
    if (auxiliary.some(result => result.status === 'rejected')) warnings.push(t('PropertyRuleAgent.resourceUnknown'))
    const hasNext = (pageIndex + 1) * pageSize < properties.length
    const partial = auxiliary.some(result => result.status === 'rejected') || data.some(rule => rule.interpretation !== 'complete'
      || rule.alarm && (!rule.alarm.level.label || rule.alarm.notification?.resolution !== 'complete'))
    return createDomainAgentToolResult({
      domain: 'device', status: partial ? 'partial' : undefined,
      summary: { deviceId: subject.id, productId: subject.productId, scope: 'property-preprocessing',
        configurationOnly: true, returned: data.length, total: properties.length, pageIndex, pageSize },
      data, total: properties.length,
      cardinality: createDomainAgentRecordSetCardinality({ returnedCount: data.length, totalCount: properties.length }),
      truncated: hasNext, nextPage: hasNext ? pageIndex + 1 : undefined,
      // Absence is scoped to this property configuration, never all possible alarm sources.
      supportsAbsenceClaim: false, warnings: warnings.length ? warnings : undefined,
    })
  })
}

export const devicePropertyRulesService = {
  /** Resolve the authorized device first; product identity is never supplied by the model. */
  propertyRules: (args: Record<string, unknown>) => runDeviceTool<PropertyRuleExplanation[]>([], async () => {
    const deviceId = normalizeText(args.deviceId)
    if (!deviceId) throw inputError('DEVICE_ID_REQUIRED', 'deviceIdRequired')
    const { device, metadata } = await getMetadata(deviceId)
    return queryDevicePropertyRules({ id: device.id, productId: normalizeText(device.productId), properties: metadata.properties }, args)
  }),
}
