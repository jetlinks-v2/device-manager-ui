import { request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'
import { restoreDeviceLibraryAlarms_api } from '@device-manager-ui/api/device-library'
import {
  withIotDeviceListDefaultTerms,
} from '@device-manager-ui/api/deviceListDefaultTerms'
import { replaceAlarm } from '../components/PropertyRules/codec'
import { localizeDeviceLibraryPreprocessors, resolveI18nText } from './deviceLibraryI18n'
import { normalizeNotification, toDeviceAlarmPageRow, toDeviceAlarmRow } from './utils'
import type {
  AlarmLevelOption,
  DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser,
  DeviceAlarmPageResult,
  DeviceAlarmSource,
  DeviceAlarmTargetOption,
  DeviceAlarmTargetPage,
  DeviceAlarmLibraryTemplate,
  DeviceAlarmRow,
  ThingPropertyPreprocess,
} from './types'

type ApiResponse<T> = T | { result?: T; data?: T }
type MarketplaceCapabilityPackage = Record<string, any> & {
  resources?: Record<string, any>[]
}
type ProductAlarmNotificationSnapshot = {
  productId: string
  property: string
  notification: DeviceAlarmRow['notification']
}

const DEVICE_ALARM_NOTIFY_PROVIDER = 'alarm-device'

const unwrapResult = <T>(response: ApiResponse<T>): T => {
  if (response && typeof response === 'object') {
    if ('result' in response) return response.result as T
    if ('data' in response) return response.data as T
  }
  return response as T
}

const unwrapArray = <T>(response: unknown): T[] => {
  const result = unwrapResult<any>(response as ApiResponse<any>)
  if (Array.isArray(result)) return result as T[]
  if (Array.isArray(result?.data)) return result.data as T[]
  if (Array.isArray(result?.records)) return result.records as T[]
  return []
}

/** Failed or malformed configuration responses are unknown, never an authoritative empty rule list. */
function unwrapPreprocessList(response: unknown): ThingPropertyPreprocess[] {
  const result = unwrapResult(response as ApiResponse<unknown>)
  if (!Array.isArray(result)
    || isRecord(response) && (response.success === false || Number(response.status) >= 400)
    || result.some(row => !isRecord(row) || typeof row.property !== 'string' || !row.property)) {
    throw new Error(i18n.global.t('PropertyRules.loadFailed'))
  }
  return result
}

export const deviceAlarmApi = {
  queryDefaultAlarmLevels: () =>
    request.get('/alarm/config/default/level'),
  getProductDetail: (productId: string) =>
    request.get(`/device-product/${encodeURIComponent(productId)}`),
  queryProducts: (data: Record<string, any>) =>
    request.post('/device/product/_query', data),
  queryDevices: (data: Record<string, any>) =>
    request.post('/device-instance/_query', data),
  queryDeviceAlarmPage: (data: Record<string, any>) =>
    request.post('/message/preprocessor/device-alarm/_query', data),
  queryProductAlarmList: async (productId: string, data: Record<string, any>) =>
    unwrapPreprocessList(
      await request.post(`/message/preprocessor/product/${encodeURIComponent(productId)}/property/_list`, data),
    ),
  queryDeviceAlarmList: async (productId: string, deviceId: string, data: Record<string, any>) =>
    unwrapPreprocessList(
      await request.post(`/message/preprocessor/product/${encodeURIComponent(productId)}/${encodeURIComponent(deviceId)}/property/_list`, data),
    ),
  saveProductAlarm: (productId: string, propertyId: string, data: Record<string, any>) =>
    request.put(`/message/preprocessor/product/${encodeURIComponent(productId)}/property/${encodeURIComponent(propertyId)}`, data),
  saveDeviceAlarm: (productId: string, deviceId: string, propertyId: string, data: Record<string, any>) =>
    request.put(`/message/preprocessor/device/${encodeURIComponent(productId)}/${encodeURIComponent(deviceId)}/property/${encodeURIComponent(propertyId)}`, data),
  deleteProductAlarm: (productId: string, propertyId: string, data?: Record<string, any>) =>
    request.remove(`/message/preprocessor/product/${encodeURIComponent(productId)}/property/${encodeURIComponent(propertyId)}`, data),
  deleteDeviceAlarm: (productId: string, deviceId: string, propertyId: string, data?: Record<string, any>) =>
    request.remove(`/message/preprocessor/device/${encodeURIComponent(productId)}/${encodeURIComponent(deviceId)}/property/${encodeURIComponent(propertyId)}`, data),
  queryNotifyChannels: () =>
    request.get('/notify/channel/all'),
  queryNotifyTypes: () =>
    request.get('/notify/channel/providers'),
  queryNotifyUsers: (data: {
    pageIndex?: number
    pageSize?: number
    paging?: boolean
    userIds?: string[]
    keyword?: string
  }) => {
    const { userIds, keyword, ...params } = data
    return request.post('/user/detail/_query', {
      ...params,
      terms: userIds?.length
        ? [{ column: 'id', termType: 'in', value: userIds }]
        : keyword?.trim() ? [{ terms: [
          { column: 'name', termType: 'like', value: `%${keyword.trim()}%` },
          { column: 'username', termType: 'like', value: `%${keyword.trim()}%`, type: 'or' },
        ] }] : undefined,
      sorts: [{ name: 'name', order: 'asc' }, { name: 'id', order: 'asc' }],
    })
  },
  queryInstalledDeviceLibrary: (capabilityId: string) =>
    request.post(`/marketplace/capabilities/device-template/${encodeURIComponent(capabilityId)}/installed`, []),
  queryDeviceLibraryResources: () =>
    request.post('/marketplace/resource/detail/_query', {
      paging: false,
      sorts: [
        { name: 'sortIndex', order: 'asc' },
        { name: 'createTime', order: 'desc' },
      ],
      terms: [
        { column: 'type', termType: 'eq', value: 'device-template' },
      ],
    }, { projectContext: false }),
  queryCapabilityPackage: (capabilityId: string, version: string) =>
    request.get(
      `/marketplace/capabilities/${encodeURIComponent(capabilityId)}/versions/${encodeURIComponent(version)}/package`,
      {},
      { projectContext: false },
    ),
}

export async function queryDefaultAlarmLevels(): Promise<AlarmLevelOption[]> {
  const entity = unwrapResult<any>(await deviceAlarmApi.queryDefaultAlarmLevels())
  const rows = Array.isArray(entity?.levels) ? entity.levels : []
  return rows
    .map((item: Record<string, any>) => {
      const value = Number(item?.level)
      const label = String(item?.title ?? item?.i18nMessages?.zh ?? item?.name ?? value)
      return Number.isInteger(value) ? { label, value } : undefined
    })
    .filter((item: AlarmLevelOption | undefined): item is AlarmLevelOption => Boolean(item))
}

export async function queryProductMetadata(productId?: string): Promise<unknown> {
  const id = String(productId ?? '').trim()
  if (!id) return undefined
  const detail = unwrapResult<any>(await deviceAlarmApi.getProductDetail(id))
  return detail?.metadata ?? detail?.deriveMetadata ?? detail?.thingModel
}

export async function queryAlarmTargets(source: DeviceAlarmSource, keyword = ''): Promise<DeviceAlarmTargetOption[]> {
  const page = await queryAlarmTargetPage(source, { keyword, pageSize: 50 })
  return page.data
}

export async function queryAlarmTargetPage(
  source: DeviceAlarmSource,
  params: { keyword?: string; pageIndex?: number; pageSize?: number; productId?: string } = {},
): Promise<DeviceAlarmTargetPage> {
  const pageIndex = Math.max(0, Number(params.pageIndex ?? 0))
  const pageSize = Math.max(1, Number(params.pageSize ?? 20))
  const terms = params.keyword
    ? [{ column: 'name', termType: 'like', value: `%${params.keyword}%` }]
    : []
  if (source === 'product') {
    const result = unwrapResult<any>(await deviceAlarmApi.queryProducts({
      pageIndex,
      pageSize,
      sorts: [{ name: 'createTime', order: 'desc' }],
      terms,
    }))
    const page = normalizeAlarmTargetPage(result, pageIndex, pageSize)
    return {
      data: page.data
      .map((item) => ({
        label: String(item?.name ?? item?.id ?? ''),
        value: String(item?.id ?? ''),
        source,
        productId: String(item?.id ?? ''),
        metadata: item?.metadata,
      }))
      .filter((item) => item.value),
      total: page.total,
    }
  }

  const result = unwrapResult<any>(await deviceAlarmApi.queryDevices({
    pageIndex,
    pageSize,
    sorts: [{ name: 'createTime', order: 'desc' }],
    terms: withIotDeviceListDefaultTerms([
      ...(params.productId ? [{ column: 'productId', termType: 'eq', value: params.productId }] : []),
      ...terms,
    ]),
  }))
  const page = normalizeAlarmTargetPage(result, pageIndex, pageSize)
  return {
    data: page.data
    .map((item) => ({
      label: String(item?.name ?? item?.id ?? ''),
      value: String(item?.id ?? ''),
      source,
      productId: String(item?.productId ?? ''),
      deviceId: String(item?.id ?? ''),
      metadata: item?.metadata,
    }))
    .filter((item) => item.value && item.productId),
    total: page.total,
  }
}

function normalizeAlarmTargetPage(value: unknown, pageIndex: number, pageSize: number) {
  const page = isRecord(value) && isRecord(value.result)
    ? value.result
    : isRecord(value) && isRecord(value.data) && !Array.isArray(value.data)
      ? value.data
      : value
  const rows = Array.isArray(page)
    ? page
    : isRecord(page) && Array.isArray(page.data)
      ? page.data
      : isRecord(page) && Array.isArray(page.records)
        ? page.records
        : []
  return {
    data: rows,
    total: Number(isRecord(page) ? page.total ?? page.count ?? page.totalElements ?? pageIndex * pageSize + rows.length : pageIndex * pageSize + rows.length),
  }
}

export async function queryDeviceAlarmPage(data: Record<string, any>): Promise<DeviceAlarmPageResult> {
  const result = unwrapResult<any>(await deviceAlarmApi.queryDeviceAlarmPage(data))
  const rows = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.records)
      ? result.records
      : Array.isArray(result)
        ? result
        : []
  return {
    data: rows
      .map(normalizeDeviceAlarmPageRecord)
      .filter((item: ThingPropertyPreprocess | undefined): item is ThingPropertyPreprocess => Boolean(item)),
    total: Number(result?.total ?? rows.length),
  }
}

export async function queryDeviceAlarmNotifyMethods(): Promise<DeviceAlarmNotifyMethod[]> {
  const [types, providers] = await Promise.allSettled([
    deviceAlarmApi.queryNotifyTypes().then(unwrapNotifyList), deviceAlarmApi.queryNotifyChannels().then(unwrapNotifyList),
  ])
  if (types.status === 'rejected') throw types.reason
  return toNotifyMethods(types.value, providers.status === 'fulfilled' ? providers.value : undefined)
}

function unwrapNotifyList(response: unknown): unknown[] {
  const result = unwrapResult(response as ApiResponse<unknown>)
  if (!Array.isArray(result) || isRecord(response) && (response.success === false || Number(response.status) >= 400)) {
    throw new Error('Unable to load notification configuration')
  }
  return result
}

/** Select types only; accessible channel configuration is used solely for status and legacy readback. */
export function toNotifyMethods(types: unknown[], providers?: unknown[]): DeviceAlarmNotifyMethod[] {
  const available = (providers ?? []).filter(isRecord).filter(provider => isEnabledState(provider.state))
  return types.filter(isRecord).filter(type => stringify(type.receiverPolicy?.value ?? type.receiverPolicy) !== 'explicit').flatMap(type => {
    const id = stringify(type.id)
    if (!id) return []
    const key = notifyMethodKey(id)
    const channels = (topic: string) => available.filter(provider => provider.provider === topic)
      .flatMap(provider => normalizeRecords(provider.channels))
      .filter(channel => channel.channelProvider === id && isEnabledState(channel.state))
    const status = (topic: string): NonNullable<DeviceAlarmNotifyMethod['templates']>['trigger'] => {
      if (id === 'inside-mail') return 'unneeded'
      if (providers === undefined) return 'unknown'
      return channels(topic).some(channel => {
        const config = channel.channelConfiguration ?? channel.configuration ?? {}
        return Boolean(config.templateId && config.notifierId)
      }) ? 'ready' : 'missing'
    }
    return [{
      id, providerId: id, key, label: stringify(type.name) || id, desc: '', icon: notifyMethodIcon(key),
      channelIds: channels(DEVICE_ALARM_NOTIFY_PROVIDER).map(channel => stringify(channel.id)).filter(Boolean),
      templates: { trigger: status(DEVICE_ALARM_NOTIFY_PROVIDER), relieve: status('alarm-device-relieve') },
    }]
  })
}

export async function queryDeviceAlarmNotifyUsers(
  params: { pageIndex?: number; pageSize?: number; paging?: boolean; userIds?: string[]; keyword?: string } = {},
): Promise<{ data: DeviceAlarmNotifyUser[]; total: number }> {
  const pageIndex = Math.max(0, Number(params.pageIndex ?? 0))
  const pageSize = Math.max(1, Number(params.pageSize ?? 20))
  const page = normalizeAlarmTargetPage(
    await deviceAlarmApi.queryNotifyUsers({ ...params, pageIndex, pageSize }),
    pageIndex,
    pageSize,
  )
  return {
    data: page.data
    .map((user) => {
      const id = stringify(user.id ?? user.userId)
      if (!id) return undefined
      const name = stringify(user.name ?? user.username ?? id)
      const orgName = firstText(user.orgName, user.departmentName, collectOrgNames(user))
      const contact = maskMobile(firstText(user.telephone, user.phone, user.mobile)) || firstText(user.email)
      return {
        id,
        name,
        desc: [orgName, contact].filter(Boolean).join(' · '),
        tag: firstText(user.positionName, user.position, user.title),
      }
    })
    .filter((item): item is DeviceAlarmNotifyUser => Boolean(item)),
    total: page.total,
  }
}

function normalizeRecords(input: unknown): Record<string, any>[] {
  if (Array.isArray(input)) return input.filter(isRecord)
  if (isRecord(input) && Array.isArray(input.data)) return input.data.filter(isRecord)
  return []
}

export async function queryInstalledDeviceAlarmLibraries(): Promise<DeviceAlarmLibraryTemplate[]> {
  return unwrapArray<Record<string, any>>(await deviceAlarmApi.queryDeviceLibraryResources())
    .map(normalizeDeviceAlarmLibraryResource)
    .filter((item): item is DeviceAlarmLibraryTemplate => Boolean(item))
}

export async function queryDeviceAlarmLibraryDetail(library: DeviceAlarmLibraryTemplate): Promise<DeviceAlarmLibraryTemplate | undefined> {
  const capabilityId = stringify(library.id)
  if (!capabilityId) return undefined
  const installed = await queryInstalledDeviceAlarmLibraryRecord(capabilityId)
  if (!installed) return { ...library, propertyPreprocessors: [] }
  const version = firstText(installed.version, installed.data?.version, installed.result?.version, library.version)
  return queryDeviceAlarmLibraryPackageDetail({
    ...library,
    version,
    productId: installedDeviceLibraryProductId(installed),
    resourceId: firstText(installed.resourceId, installed.data?.resourceId, installed.result?.resourceId, library.resourceId),
  })
}

export async function restoreDeviceLibraryAlarms(library: DeviceAlarmLibraryTemplate,
                                                 configs: ThingPropertyPreprocess[],
                                                 clearDeviceConfig = false) {
  const properties = configs
    .map((item) => stringify(item.property))
    .filter(Boolean)
  const notifications = await queryProductAlarmNotificationSnapshots(properties)
  const result = await restoreDeviceLibraryAlarms_api({
    templateId: library.id,
    version: library.version,
    properties,
    clearDeviceConfig,
  })
  await restoreProductAlarmNotifications(stringify(result.productId), notifications)
  return result
}

async function queryDeviceAlarmLibraryPackageDetail(library: DeviceAlarmLibraryTemplate) {
  const capabilityId = stringify(library.id)
  const version = stringify(library.version)
  if (!capabilityId || !version) return { ...library, propertyPreprocessors: [] }
  const capabilityPackage = unwrapResult<MarketplaceCapabilityPackage>(
    await deviceAlarmApi.queryCapabilityPackage(capabilityId, version).catch(() => ({})),
  )
  return normalizeInstalledDeviceAlarmLibraryPackage(library, capabilityPackage)
}

async function queryProductAlarmNotificationSnapshots(properties: string[]) {
  if (!properties.length) return []
  const page = await queryDeviceAlarmPage({
    paging: false,
    terms: [
      { column: 'property', termType: 'in', value: properties },
    ],
  }).catch(() => ({ data: [], total: 0 }))
  return page.data
    .map(toDeviceAlarmPageRow)
    .filter((row): row is DeviceAlarmRow => Boolean(row))
    .filter((row) => row.source === 'product' && row.notificationConfigured)
    .map((row) => ({
      productId: row.productId || row.targetId,
      property: row.property,
      notification: normalizeNotification(row.notification),
    }))
    .filter((item) => item.productId && item.property)
}

async function queryRestoredProductAlarmRows(productId: string, properties: string[]) {
  if (!productId || !properties.length) return []
  const page = await queryDeviceAlarmPage({
    paging: false,
    terms: [
      { column: 'property', termType: 'in', value: properties },
    ],
  }).catch(() => ({ data: [], total: 0 }))
  return page.data
    .map(toDeviceAlarmPageRow)
    .filter((row): row is DeviceAlarmRow => Boolean(row))
    .filter((row) => row.source === 'product' && (row.productId || row.targetId) === productId)
}

async function restoreProductAlarmNotifications(productId: string, snapshots: ProductAlarmNotificationSnapshot[]) {
  if (!productId) return
  const matchedSnapshots = snapshots.filter((item) => item.productId === productId)
  if (!matchedSnapshots.length) return
  const restoredRows = await queryRestoredProductAlarmRows(
    productId,
    matchedSnapshots.map((item) => item.property),
  )
  await Promise.all(matchedSnapshots.map(async (snapshot) => {
    const row = restoredRows.find((item) => item.property === snapshot.property)
    if (!row) return
    // 设备库模板不维护通知链路；还原阈值后，只基于当前项目可见的产品告警行写回原通知配置。
    await deviceAlarmApi.saveProductAlarm(productId, snapshot.property, replaceAlarm(row.raw, {
      ...row,
      notification: snapshot.notification,
    }))
  }))
}

function normalizeDeviceAlarmPageRecord(input: unknown): ThingPropertyPreprocess | undefined {
  if (!isRecord(input)) return undefined
  if (!isRecord(input.alarm)) return input as ThingPropertyPreprocess
  return {
    ...input.alarm,
    productId: stringify(input.productId) || stringify(input.alarm.templateId),
    productName: stringify(input.productName),
    deviceId: stringify(input.deviceId) || stringify(input.alarm.thingId),
    deviceName: stringify(input.deviceName),
    targetId: stringify(input.targetId),
    targetName: stringify(input.targetName),
    propertyName: stringify(input.propertyName),
    notifyConfig: isRecord(input.notifyConfig) ? input.notifyConfig : undefined,
    notificationConfigured: isNotificationConfigured(input.notifyConfig),
    notificationEnabled: isNotificationEnabled(input.notifyConfig),
  } as ThingPropertyPreprocess
}

function normalizeDeviceAlarmLibraryResource(resource: Record<string, any>): DeviceAlarmLibraryTemplate | undefined {
  const capabilityId = firstText(resource.id, resource.code)
  if (!capabilityId) return undefined
  const metadata = isRecord(resource.metadata) ? resource.metadata : {}
  const template = isRecord(metadata.template) ? metadata.template : {}
  return {
    id: capabilityId,
    name: resolveI18nText(resource.i18nMessages,
                          'name',
                          firstMeaningfulName(resource.name, template.name, resource.code, capabilityId)),
    manufacturer: resolveI18nText(template.i18nMessages, 'manufacturer', firstText(template.manufacturer)),
    model: resolveI18nText(template.i18nMessages, 'model', firstText(template.model)),
    propertyPreprocessors: [],
  }
}

async function queryInstalledDeviceAlarmLibraryRecord(capabilityId: string): Promise<Record<string, any> | undefined> {
  const rows = unwrapArray<Record<string, any>>(
    await deviceAlarmApi.queryInstalledDeviceLibrary(capabilityId).catch(() => []),
  )
  return rows
    .filter(isInstalledDeviceTemplate)
    .find((item) => firstText(item.capabilityId, item.resourceId, item.resourcesId, capabilityId) === capabilityId)
}

function installedDeviceLibraryProductId(item: Record<string, any>) {
  return stringify(item.dataId)
}

function normalizeInstalledDeviceAlarmLibraryPackage(library: DeviceAlarmLibraryTemplate,
                                                    capabilityPackage: MarketplaceCapabilityPackage): DeviceAlarmLibraryTemplate | undefined {
  const resources = capabilityPackageResources(capabilityPackage)
  const templateResource = resolveTemplateResource({ resourceId: library.resourceId }, resources)
  const preprocessorResource = resolvePreprocessorResource(templateResource, resources)
  const metadata = isRecord(templateResource?.metadata) ? templateResource.metadata : {}
  const template = isRecord(metadata.template) ? metadata.template : {}
  const preprocessorMetadata = isRecord(preprocessorResource?.metadata) ? preprocessorResource.metadata : {}
  const propertyPreprocessors = Array.isArray(preprocessorMetadata.propertyPreprocessors)
    ? preprocessorMetadata.propertyPreprocessors.filter(isRecord) as ThingPropertyPreprocess[]
    : []
  return {
    ...library,
    resourceId: stringify(templateResource?.id) || library.resourceId,
    name: resolveI18nText(template.i18nMessages,
                          'name',
                          firstMeaningfulName(library.name,
                                              deviceLibraryName(library, capabilityPackage, templateResource, template, library.id))),
    manufacturer: resolveI18nText(template.i18nMessages,
                                  'manufacturer',
                                  firstText(template.manufacturer) || library.manufacturer || ''),
    model: resolveI18nText(template.i18nMessages, 'model', firstText(template.model) || library.model || ''),
    propertyPreprocessors: localizeDeviceLibraryPreprocessors(propertyPreprocessors, template),
  }
}

function deviceLibraryName(installed: Record<string, any>,
                           capabilityPackage: MarketplaceCapabilityPackage,
                           templateResource: Record<string, any> | undefined,
                           template: Record<string, any>,
                           capabilityId: string) {
  const capability = isRecord(capabilityPackage.capability) ? capabilityPackage.capability : {}
  const info = isRecord(capabilityPackage.info) ? capabilityPackage.info : {}
  const pkg = isRecord(capabilityPackage.pkg) ? capabilityPackage.pkg : {}
  const packageInfo = isRecord(capabilityPackage.packageInfo) ? capabilityPackage.packageInfo : {}
  return firstMeaningfulName(
    template.name,
    templateResource?.name,
    info.name,
    capabilityPackage.name,
    packageInfo.name,
    pkg.name,
    capability.name,
    installed.capability?.name,
    installed.data?.name,
    installed.result?.name,
    installed.extra?.name,
    installed.name,
    capabilityId,
  )
}

function firstMeaningfulName(...values: unknown[]) {
  return values
    .map(stringify)
    .find((value) => Boolean(value) && !isResourceTypeName(value)) || ''
}

function isResourceTypeName(value: string) {
  return ['device-template', 'thing-property-preprocessor'].includes(value.toLowerCase())
}

function isInstalledDeviceTemplate(installed: Record<string, any>) {
  const type = stringify(installed.type)
  return !type || type === 'device-template'
}

function capabilityPackageResources(capabilityPackage: MarketplaceCapabilityPackage | undefined) {
  if (!isRecord(capabilityPackage)) return []
  if (Array.isArray(capabilityPackage.resources)) return capabilityPackage.resources.filter(isRecord)
  const pkg = isRecord(capabilityPackage.pkg) ? capabilityPackage.pkg : {}
  if (Array.isArray(pkg.resources)) return pkg.resources.filter(isRecord)
  const capability = isRecord(capabilityPackage.capabilityPackage) ? capabilityPackage.capabilityPackage : {}
  return Array.isArray(capability.resources) ? capability.resources.filter(isRecord) : []
}

function resolveTemplateResource(installed: Record<string, any>, resources: Record<string, any>[]) {
  const installedResourceId = firstText(installed.resourceId, installed.data?.resourceId, installed.result?.resourceId)
  return resources.find((resource) =>
    stringify(resource.type) === 'device-template' && stringify(resource.id) === installedResourceId,
  ) ?? resources.find((resource) => stringify(resource.type) === 'device-template')
}

function resolvePreprocessorResource(templateResource: Record<string, any> | undefined,
                                     resources: Record<string, any>[]) {
  const templateResourceId = stringify(templateResource?.id)
  return resources
    .filter((resource) => stringify(resource.type) === 'thing-property-preprocessor')
    .find((resource) => {
      const metadata = isRecord(resource.metadata) ? resource.metadata : {}
      const linkedTemplate = isRecord(metadata.templateResource) ? metadata.templateResource : {}
      return firstText(metadata.templateResourceId, linkedTemplate.id) === templateResourceId
    }) ?? resources.find((resource) => stringify(resource.type) === 'thing-property-preprocessor')
}

function isNotificationConfigured(config: unknown) {
  if (!isRecord(config)) return false
  return (hasValues(config.channelProviders) || hasValues(config.notifyChannelIds))
    && (hasValues(config.userIds) || hasValues(config.dimensions))
}

function isNotificationEnabled(config: unknown) {
  if (!isRecord(config) || !isNotificationConfigured(config)) return false
  return config.enabled === undefined ? true : Boolean(config.enabled)
}

function hasValues(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

function notifyMethodKey(providerId: string): DeviceAlarmNotifyMethod['key'] {
  const id = providerId.toLowerCase()
  if (id.includes('email')) return 'email'
  if (id.includes('sms')) return 'sms'
  if (id.includes('voice') || id.includes('phone')) return 'phone'
  if (id.includes('webhook')) return 'webhook'
  if (id.includes('dingtalk')) return 'dingtalk'
  if (id.includes('weixin') || id.includes('wechat')) return 'wechat'
  return 'inbox'
}

function notifyMethodIcon(key: DeviceAlarmNotifyMethod['key']) {
  const iconMap: Record<DeviceAlarmNotifyMethod['key'], string> = {
    inbox: 'InboxOutlined',
    sms: 'MessageOutlined',
    email: 'MailOutlined',
    wechat: 'WechatOutlined',
    dingtalk: 'DingdingOutlined',
    phone: 'PhoneOutlined',
    webhook: 'ApiOutlined',
  }
  return iconMap[key]
}

function isEnabledState(value: unknown) {
  if (!isRecord(value)) return !value || stringify(value) === 'enabled'
  return stringify(value.value ?? value.id ?? value.text ?? value.name) === 'enabled'
}

function firstText(...values: unknown[]) {
  return values.map(stringify).find(Boolean) || ''
}

function collectOrgNames(user: Record<string, any>) {
  const names: string[] = []
  ;['orgList', 'parentOrgList', 'childrenOrgList'].forEach((key) => {
    const values = user[key]
    if (!Array.isArray(values)) return
    values.forEach((item) => {
      if (isRecord(item)) {
        const name = stringify(item.name)
        if (name) names.push(name)
      }
    })
  })
  return names.join(' / ')
}

function maskMobile(value: string) {
  return /^\d{11}$/.test(value) ? `${value.slice(0, 3)}****${value.slice(7)}` : value
}

function stringify(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
