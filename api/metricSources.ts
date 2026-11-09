import { query, detail } from './instance'
import { detail as productDetail, queryProductList } from './product'
import { parseMetadata, propertyIdOf, propertyNameOf, formatPropertyUnit } from '../views/device/alarm/utils'
import { metricSourceTerms, type MetricDeviceOption, type MetricPropertyOption } from '../views/device/metrics/metricSources'
import type { MetricContext } from '@jetlinks-web-core/components'
import { metricApi } from '@jetlinks-web-core/components'
import { request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'

export const readMetricProvider = (source:Parameters<NonNullable<typeof metricApi.readSource>>[0]) => metricApi.readSource!(source)

type PlatformProperty = { id:string; name:string; description:string; valueType:string; schema?:Record<string,unknown>; history:boolean; icon:string;unit?:string;group?:string }
let platformCache: { locale:string; time:number; promise:Promise<MetricPropertyOption[]> } | undefined
/** 由后端声明平台保留来源；共享短期元数据缓存，批量反显不会逐配置请求目录。 */
export function loadMetricPlatformProperties():Promise<MetricPropertyOption[]> {
  const locale = String(i18n.global.locale.value)
  if (platformCache?.locale === locale && Date.now() - platformCache.time < 30000) return platformCache.promise
  const promise = request.get('/device/metric/sources/platform', undefined, { hiddenError:true }).then((response: {
    status?:number; message?:string; result?:PlatformProperty[]
  }) => {
    requireSourceSuccess(response)
    return (response.result || []).map(item => ({ ...item, platform:true, valueType:{ type:item.valueType,...item.schema,...(item.unit ? {unit:item.unit} : {}) } }))
  }).catch((error:unknown) => {
    // 不把目录故障伪装成仅支持在线状态；失败不缓存，来源面板可以立即重试。
    if (platformCache?.promise === promise) platformCache = undefined
    throw error
  })
  platformCache = { locale,time:Date.now(),promise }; return promise
}

/** 内置项目由来源业务模块描述，不在前端维护产品／空间／分组统计清单。 */
export const loadMetricBuiltins = (type:string, id:string) => metricApi.builtinSources(type, id)
export const describeMetricProvider = (spec:Parameters<NonNullable<typeof metricApi.describeSource>>[0]) => metricApi.describeSource!(spec)

const requireSourceSuccess = <T extends { status?: number; message?: string }>(response: T): T => {
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response
}

const metricProperties = (properties:ReturnType<typeof parseMetadata>['properties']):MetricPropertyOption[] => properties.map(property => ({
  id:propertyIdOf(property), name:propertyNameOf(property), unit:formatPropertyUnit(property.valueType?.unit),
  description:'description' in property && typeof property.description === 'string' ? property.description : undefined,
  valueType:property.valueType ? { ...property.valueType } : undefined,
  group:metadataGroup(property),
})).filter(property => property.id)

/** 保留物模型显式分组；缺少分组时交给目录的“未分组”，不猜名称或标识前缀。 */
function metadataGroup(item:object):string | undefined {
  const value = item as {group?:unknown; expands?:{group?:unknown;groupName?:unknown}}
  const group = value.group ?? value.expands?.groupName ?? value.expands?.group
  return typeof group === 'string' ? group : undefined
}

/** 事件沿用物模型 valueType；完整事件是一个对象输入，字段由公式引用。 */
function metricEvents(raw:unknown):MetricPropertyOption[] {
  const metadata = typeof raw === 'string' ? JSON.parse(raw) : raw
  return metadata && typeof metadata === 'object' && Array.isArray(metadata.events) ? metadata.events.map((event: {id:string;name?:string;valueType?:Record<string,unknown>}) => ({ id:event.id,name:event.name || event.id,valueType:event.valueType,group:metadataGroup(event) })) : []
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
  let events = metricEvents(device.metadata)
  if ((!properties.length || !events.length) && device.productId) {
    const product = await productDetail(device.productId)
    requireSourceSuccess(product)
    if (!properties.length) properties = parseMetadata(product.result?.metadata).properties
    if (!events.length) events = metricEvents(product.result?.metadata)
  }
  return {
    device: { id: device.id, name: device.name || device.id, productId: device.productId } as MetricDeviceOption,
    properties: [...await loadMetricPlatformProperties(), ...metricProperties(properties)],
    events,
  }
}

/** 产品继承选择产品声明的属性，设备加入该产品后按当前设备身份解析。 */
export async function loadMetricProduct(id: string) {
  return (await loadMetricProductSources(id)).properties
}
export async function loadMetricProductSources(id:string) {
  const response = requireSourceSuccess(await productDetail(id))
  if (!response.result) throw new Error('Product metadata unavailable')
  return { product:{id:response.result.id,name:response.result.name || id},properties:[...await loadMetricPlatformProperties(), ...metricProperties(parseMetadata(response.result.metadata).properties)],events:metricEvents(response.result.metadata) }
}

/** 重开来源配置时按实际身份恢复名称，不把候选分页当作对象存在性或显示名依据。 */
export async function loadMetricProductName(id:string) {
  const response = requireSourceSuccess(await productDetail(id))
  if (!response.result) throw new Error('Product metadata unavailable')
  return response.result.name || id
}

/** 只读取当前对象有权访问的配置及其固定发布快照，不暴露内部定义作为可绑定输出。 */
export async function loadMetricOutputs(type:string, id:string) {
  const configs = await metricApi.byOwner(type, id)
  return (await Promise.all(configs.filter(config => config.id && config.state === 'enabled' && config.scope !== 'children').map(async config => ({
    config, template:await metricApi.configTemplate(config.id!),
  })))).flatMap(({ config, template }) => template.outputs.map(output => ({ config, template, output })))
}

/** 成员统计只引用产品下逐设备执行的已启用配置及其持久化公开输出。 */
export async function loadMetricInheritedOutputs(productId:string) {
  const configs = await metricApi.byOwner('product', productId)
  return (await Promise.all(configs.filter(config => config.id && config.state === 'enabled' && config.scope === 'children'
    && config.targetType === 'device').map(async config => ({ config, template:await metricApi.configTemplate(config.id!) }))))
    .flatMap(({ config, template }) => template.outputs.filter(output => output.persist && !output.latestOnly).map(output => ({ config, template, output })))
}

export async function queryMetricProducts(keyword:string, pageIndex:number) {
  const response = requireSourceSuccess(await queryProductList({ pageIndex, pageSize:20, sorts:[{ name:'name', order:'asc' }],
    terms:keyword.trim() ? [{ column:'name', termType:'like', value:`%${keyword.trim()}%` }] : [] }))
  const page = response.result as { data?: { id:string; name:string }[]; total?:number } | undefined
  return { data:page?.data || [], total:page?.total || 0 }
}

export async function loadMetricOutput(configId:string) {
  const config = await metricApi.getConfig(configId)
  return { config, template:await metricApi.configTemplate(configId) }
}
export type MetricOutputSource = Awaited<ReturnType<typeof loadMetricOutputs>>[number]
