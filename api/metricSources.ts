import { query, detail } from './instance'
import { detail as productDetail, queryProductList } from './product'
import { parseMetadata, propertyIdOf, propertyNameOf, formatPropertyUnit } from '../views/device/alarm/utils'
import { metricSourceTerms, type MetricDeviceOption, type MetricPropertyOption } from '../views/device/metrics/metricSources'
import type { MetricContext } from '@jetlinks-web-core/components'
import { metricApi } from '@jetlinks-web-core/components'
import { request } from '@jetlinks-web/core'

export const readMetricProvider = (source:Parameters<NonNullable<typeof metricApi.readSource>>[0]) => metricApi.readSource!(source)

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
  expands:'expands' in property ? property.expands as Record<string,unknown> : undefined,
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
  return metadata && typeof metadata === 'object' && Array.isArray(metadata.events) ? metadata.events.map((event: {id:string;name?:string;valueType?:Record<string,unknown>;expands?:Record<string,unknown>}) => ({ id:event.id,name:event.name || event.id,valueType:event.valueType,expands:event.expands,group:metadataGroup(event) })) : []
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

/** 输入目录只读取本体实例模型，平台观测和业务物模型由来源合并并授权。 */
async function objectMetadata(type:string, id:string) {
  const response = requireSourceSuccess(await request.get(`/ontology/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}/metadata`, undefined, { hiddenError:true }))
  return response.result
}
function sourceProperties(metadata:unknown):MetricPropertyOption[] {
  return metricProperties(parseMetadata(metadata).properties).map(property => {
    const source = property.expands?.metricSource as {platform?:boolean;history?:boolean;icon?:string;group?:string} | undefined
    return source ? {...property,...source} : property
  })
}
/** 目录发现使用当前对象实例，不额外查询样例设备或另一业务服务的列表。 */
export async function loadMetricObjectSources(type:string,id:string) {
  const metadata = await objectMetadata(type,id)
  return {properties:sourceProperties(metadata),events:metricEvents(metadata)}
}
export async function loadMetricDevice(id:string) {
  const [response, metadata] = await Promise.all([detail(id).then(requireSourceSuccess), objectMetadata('device', id)])
  if (!response.result) throw new Error('Device unavailable')
  return {device:response.result as MetricDeviceOption, properties:sourceProperties(metadata), events:metricEvents(metadata)}
}
export async function loadMetricProduct(id:string) { return (await loadMetricProductSources(id)).properties }
export async function loadMetricProductSources(id:string) {
  const [response, metadata] = await Promise.all([productDetail(id).then(requireSourceSuccess), objectMetadata('product', id)])
  if (!response.result) throw new Error('Product unavailable')
  return {product:response.result,properties:sourceProperties(metadata),events:metricEvents(metadata)}
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
