import { request } from '@jetlinks-web/core'
import { collectMetricResources } from '@jetlinks-web-core/components/Metric/extensions/registry'

export interface BusinessEvent { id:string; name:string; description?:string; group?:string; schema:Record<string,unknown> }
export interface BusinessCommand { id:string; name:string; description?:string; inputs?:{id:string;name?:string;valueType?:Record<string,unknown>}[]; output?:Record<string,unknown>; expands?:Record<string,unknown> }
interface SourceCommandService { id:string; metadata?:{metricSource?:{objectTypes?:string[]}} }
export interface SourceObjectType { id:string; name:string; description?:string; icon?:string; metricSource?:{root:boolean;icon?:string}; i18nName?:string }
const options = { hiddenError:true }
async function read<T>(url:string):Promise<T> {
  const response:{status?:number;message?:string;result:T} = await request.get(url,undefined,options)
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}
export const loadMetricEvents = () => read<BusinessEvent[]>('/metric/configs/sources/events')
/** 内部服务不是业务选项；只有显式声明当前对象类型的服务才发现其查询元数据。 */
export async function loadMetricCommandServices(objectType:string) {
  return (await read<SourceCommandService[]>('/command-supports/services'))
    .filter(service=>Array.isArray(service.metadata?.metricSource?.objectTypes) && service.metadata.metricSource.objectTypes.includes(objectType))
}
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
/** 命令元数据沿用服务目录与远端路由，只展示显式声明为只读查询的命令。 */
export async function loadMetricCommands(service:string) {
  return (await read<BusinessCommand[]>(`/command-supports/service/${encodeURIComponent(service)}/commands`))
    .filter(command=>command.expands?.functionKind === 'query')
}
