import { request } from '@jetlinks-web/core'
import { collectMetricResources } from '@jetlinks-web-core/components/Metric/extensions/registry'

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
export interface SourceObjectType { id:string; name:string; description?:string; icon?:string; metricSource?:{root:boolean;icon?:string}; i18nName?:string }
const options = { hiddenError:true }
async function read<T>(url:string):Promise<T> {
  const response:{status?:number;message?:string;result:T} = await request.get(url,undefined,options)
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}
const objectPath=(type:string,id:string)=>`/ontology/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}`
export const loadObjectSourceCapabilities=(type:string,id:string)=>read<ObjectSourceCapability[]>(`${objectPath(type,id)}/capabilities`)
export const loadObjectSourceMetadata=(type:string,id:string,capability:string)=>read<BusinessCommand>(`${objectPath(type,id)}/capabilities/${encodeURIComponent(capability)}/metadata`)
/** 关系类型全集不是来源根目录；业务维度及显式root声明负责UI发现，后端绑定仍按原权限执行。 */
export async function loadMetricObjectTypes():Promise<SourceObjectType[]> {
  const types = await read<SourceObjectType[]>('/relation/types')
  const roots = new Map<string,SourceObjectType>(collectMetricResources().dimensions.map(({provider})=>[provider.ownerType,
    {id:provider.ownerType,name:typeof provider.label === 'function' ? provider.label() : provider.label,icon:provider.icon}]))
  for (const type of types) {
    if (!roots.has(type.id) && !type.metricSource?.root) continue
    const registered = roots.get(type.id)
    roots.set(type.id,{...type,...registered,name:registered?.name || type.i18nName || type.name,icon:type.metricSource?.icon || registered?.icon})
  }
  return [...roots.values()]
}
export async function queryMetricBusinessObjects(type:string,keyword:string,pageIndex=0) {
  const response:{status?:number;message?:string;result?:{data:{id:string;name?:string}[];total:number}} = await request.post('/relation/objects/_query',{type,query:{pageIndex,pageSize:20,terms:keyword ? [{column:'name',termType:'like',value:`%${keyword}%`}] : []}},options)
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return {data:response.result?.data || [],total:response.result?.total || 0}
}
