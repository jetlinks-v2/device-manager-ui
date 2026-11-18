import { request } from '@jetlinks-web/core'
import { collectMetricResources } from '@jetlinks-web-core/components/Metric/extensions/registry'
import { loadMetricObjectTypes as loadDeclaredObjectTypes, type MetricObjectType } from '@jetlinks-web-core/components/Metric/api'

export interface BusinessEvent { id:string; name:string; description?:string; group?:string; schema:Record<string,unknown> }
export interface BusinessCommand { id:string; name:string; description?:string; inputs?:{id:string;name?:string;valueType?:Record<string,unknown>}[]; output?:Record<string,unknown>; expands?:Record<string,unknown> }
/** 原本体声明的只读能力；保留绑定来源，前端不配置对象身份与时间参数。 */
export interface ObjectSourceCapability {
  id:string; name:string; kind:'query'|'event'|'action'
  event?:{transport?:'thingMessage'|'structuredEvent';definitionId:string}
  configurableParameters?:string[]
  bindings?:Record<string,{source:string;value?:unknown}>
  evidenceMapping?:{observedAt?:string}
}
export type SourceObjectType = MetricObjectType
const options = { hiddenError:true }
async function read<T>(url:string):Promise<T> {
  const response:{status?:number;message?:string;result:T} = await request.get(url,undefined,options)
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}
const objectPath=(type:string,id:string)=>`/ontology/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}`
export const loadObjectSourceCapabilities=(type:string,id:string)=>read<ObjectSourceCapability[]>(`${objectPath(type,id)}/capabilities`)
export const loadObjectSourceMetadata=(type:string,id:string,capability:string)=>read<BusinessCommand>(`${objectPath(type,id)}/capabilities/${encodeURIComponent(capability)}/metadata`)
/** 后端实际类型与业务维度取交集；额外根来源由后端显式声明，绑定仍按原权限执行。 */
export async function loadMetricObjectTypes():Promise<SourceObjectType[]> {
  const types = await loadDeclaredObjectTypes()
  const installed = new Map<string,SourceObjectType>(collectMetricResources().dimensions.map(({provider})=>[provider.ownerType,
    {id:provider.ownerType,name:typeof provider.label === 'function' ? provider.label() : provider.label,icon:provider.icon}]))
  const declared = new Set(types.map(type=>type.id))
  const roots = new Map<string,SourceObjectType>([...installed].filter(([key])=>declared.has(key)))
  for (const type of types) {
    if (!installed.has(type.id) && !type.metricSource?.root) continue
    const registered = installed.get(type.id)
    roots.set(type.id,{...type,...registered,name:registered?.name || type.i18nName || type.name,icon:type.metricSource?.icon || registered?.icon})
  }
  return [...roots.values()]
}
export async function queryMetricBusinessObjects(type:string,keyword:string,pageIndex=0,
  scopeTerms:{column:string;termType:string;value:unknown}[] = []) {
  const response:{status?:number;message?:string;result?:{data:{id:string;name?:string}[];total:number}} = await request.post('/relation/objects/_query',{
    type,query:{pageIndex,pageSize:20,sorts:[{name:'name',order:'asc'}],terms:[...scopeTerms,
      ...(keyword.trim() ? [{column:'name',termType:'like',value:`%${keyword.trim()}%`}] : [])]},
  },options)
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return {data:response.result?.data || [],total:response.result?.total || 0}
}
