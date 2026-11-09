import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { MetricSourceRequest, MetricSourceSelection } from '@jetlinks-web-core/components'
import { metricSourceField, metricSourceSchema } from '@jetlinks-web-core/components/Metric/sourceSchema'
import { loadMetricEvents, loadMetricCommandServices, loadMetricCommands, type BusinessCommand, type BusinessEvent } from '../../../../api/metricBusinessSources'
import type { SourceMethod } from './catalog'

/** 只发现元数据；查询服务按展开加载命令，选中后配置参数，浏览目录绝不执行业务查询。 */
export function useBusinessSources(request:Ref<MetricSourceRequest | undefined>, object:Ref<{type:string;id:string;name:string}>, keyword:Ref<string>, visible:Ref<boolean>) {
  const events = ref<BusinessEvent[]>([]), services = ref<{id:string;name:string}[]>([])
  const servicePage = ref(1)
  const commands = ref<Record<string,BusinessCommand[]>>({})
  const loading = ref(false), failed = ref(false), loadingService = ref(''), failedService = ref('')
  const selected = ref<SourceMethod>(), valuePath = ref('$'), updateEvent = ref<string>()
  const parameters = ref<Record<string,unknown>>({}), parameterModes = ref<Record<string,string>>({})
  let generation = 0
  let commandGeneration = 0
  const pendingServices = new Set<string>()
  const methods = computed<SourceMethod[]>(()=>[
    ...events.value.map(event=>({key:`businessEvent:${event.id}`,kind:'businessEvent' as const,id:event.id,name:event.name || event.id,description:event.description,group:event.group,event,valueType:metricSourceSchema(event.schema || {}),capabilities:['subscribe' as const]})),
    ...Object.entries(commands.value).flatMap(([service,items])=>items.map(command=>({key:`businessQuery:${service}:${command.id}`,kind:'businessQuery' as const,id:command.id,name:command.name || command.id,
      group:(command.expands?.metricSource as {group?:string} | undefined)?.group,
      service,command,valueType:command.output,capabilities:['current' as const]}))),
  ])
  // 元数据可包含大量服务；只渲染当前页，搜索已发现的数据和服务名，不遍历执行命令。
  const matchingServices = computed(()=>{
    if (!visible.value) return []
    const search = keyword.value.trim().toLocaleLowerCase()
    return services.value.filter(service=>!search || service.id === selected.value?.service || `${service.name} ${service.id}`.toLocaleLowerCase().includes(search)
      || (commands.value[service.id] || []).some(command=>`${command.name} ${command.id}`.toLocaleLowerCase().includes(search)))
  })
  const visibleServices = computed(()=>{
    const page = matchingServices.value.slice((servicePage.value-1)*10,servicePage.value*10)
    const current = matchingServices.value.find(service=>service.id === selected.value?.service)
    return current && !page.includes(current) ? [current,...page] : page
  })
  watch(keyword,()=>{servicePage.value=1})
  const fields = computed(()=>{
    const result = [{value:'$',label:''}]
    const visit = (schema:Record<string,unknown>,prefix='')=>{
      if (!Array.isArray(schema.properties)) return
      for (const field of schema.properties) {
        const path = prefix ? `${prefix}.${field.id}` : String(field.id)
        result.push({value:path,label:`${field.name || field.id} · ${path}`})
        visit(field.valueType || {},path)
      }
    }
    if (selected.value?.event) visit(metricSourceSchema(selected.value.event.schema || {}))
    return result
  })
  const canConfirm = computed(()=>!!selected.value && !loading.value
    && (request.value?.purpose === 'declaration' || request.value?.context.scope === 'children' || !!object.value.id)
    && !request.value?.input.source?.lookback
    && (selected.value.kind === 'businessEvent' ? fields.value.some(item=>item.value === valuePath.value)
      : request.value?.scheduled !== false || !!updateEvent.value))

  /** 请求换代清空目录和参数，旧服务响应不能回填另一次选择。 */
  async function load() {
    const token = ++generation; commandGeneration++; pendingServices.clear()
    events.value = []; services.value = []; commands.value = {}; servicePage.value = 1
    failed.value = false; failedService.value = ''; loadingService.value = ''; loading.value = !!request.value
    if (!request.value) return
    try {
      const result = await Promise.allSettled([loadMetricEvents(),loadMetricCommandServices()])
      if (token !== generation) return
      if (result[0].status === 'fulfilled') events.value = result[0].value
      if (result[1].status === 'fulfilled') services.value = result[1].value
      failed.value = result.some(item=>item.status === 'rejected')
      const source = request.value?.mapping?.providerSource
      if (source?.provider === 'objects' && typeof source.configuration.commandService === 'string') await loadService(source.configuration.commandService)
    } finally { if (token === generation) loading.value = false }
  }
  async function loadService(service:string) {
    if (commands.value[service] || pendingServices.has(service)) return
    const token = commandGeneration; pendingServices.add(service); loadingService.value = service; failedService.value = ''
    try { const items = await loadMetricCommands(service); if (token === commandGeneration) commands.value = {...commands.value,[service]:items} }
    catch { if (token === commandGeneration) failedService.value = service }
    finally { if (token === commandGeneration) { pendingServices.delete(service); if (loadingService.value === service) loadingService.value = '' } }
  }
  /** 仅恢复同一来源的参数；切换查询或对象不会沿用上一查询的隐藏绑定。 */
  function select(method:SourceMethod,restore=false) {
    selected.value = method; valuePath.value = '$'; parameters.value = {}; parameterModes.value = {}; updateEvent.value = undefined
    if (!restore) return
    const config = request.value?.mapping?.providerSource?.configuration || {}
    valuePath.value = String(config.valuePath || request.value?.mapping?.id || '$')
    parameters.value = {...config.parameters as Record<string,unknown>}
    for (const mode of ['objectIdParameter','cutoffParameter','occurrenceParameter']) if (typeof config[mode] === 'string') parameterModes.value[String(config[mode])] = mode
    updateEvent.value = (config.updates as {eventType?:string} | undefined)?.eventType
  }
  function selection():MetricSourceSelection | undefined {
    const method = selected.value
    if (!method || !canConfirm.value) return
    // 原映射的扩展字段在未更换来源时保留；只覆盖本编辑器明确负责的参数。
    const original = request.value?.mapping
    const context = request.value!.context
    const sameObject = original && (original.thingType || context.targetType || context.ownerType) === object.value.type
      && (original.thingId || original.providerSource?.configuration.thingId || (context.scope === 'children' ? '' : context.targetId || context.ownerId)) === object.value.id
    const same = sameObject && (method.kind === 'businessEvent' ? original?.providerSource?.provider === 'events' && original.providerSource.sourceType === method.id
      : original?.providerSource?.provider === 'objects' && original.id === method.id && original.providerSource.configuration.commandService === method.service)
    const configuration:Record<string,unknown> = {...(same ? original?.providerSource?.configuration : {}),...(object.value.id ? {thingId:object.value.id} : {})}
    if (method.kind === 'businessEvent') configuration.valuePath = valuePath.value
    else {
      for (const key of ['objectIdParameter','cutoffParameter','occurrenceParameter','updates']) delete configuration[key]
      configuration.commandService = method.service
      configuration.parameters = Object.fromEntries(Object.entries(parameters.value).filter(([id,value])=>(!parameterModes.value[id] || parameterModes.value[id] === 'constant') && value !== undefined))
      for (const [id,mode] of Object.entries(parameterModes.value)) if (mode !== 'constant') configuration[mode] = id
      const updates = original?.providerSource?.configuration.updates as Record<string,unknown> | undefined
      if (updateEvent.value) configuration.updates = {...(same && updates?.eventType === updateEvent.value ? updates : {}),eventType:updateEvent.value,...(object.value.id ? {thingId:object.value.id} : {}),updateOnly:true}
    }
    return {mapping:{...(same ? original : {}),kind:'provider',thingType:object.value.type,...(object.value.id ? {thingId:object.value.id} : {}),id:method.kind === 'businessEvent' ? valuePath.value : method.id,
      providerSource:{...(same ? original?.providerSource : {}),provider:method.kind === 'businessEvent' ? 'events' : 'objects',sourceType:method.kind === 'businessEvent' ? method.id : 'query',configuration}},
      label:`${object.value.name} / ${method.name}`,declaration:{name:method.name,valueType:method.event ? metricSourceField(metricSourceSchema(method.event.schema || {}),valuePath.value) : method.command?.output}}
  }
  watch(request,()=>{selected.value=undefined;parameters.value={};parameterModes.value={};void load()},{immediate:true})
  onScopeDispose(()=>{generation++;commandGeneration++})
  return {events,services:visibleServices,serviceCount:computed(()=>matchingServices.value.length),servicePage,commands,methods,loading,failed,loadingService,failedService,selected,valuePath,fields,parameters,parameterModes,updateEvent,canConfirm,load,loadService,select,selection}
}
export type BusinessSourcesState = ReturnType<typeof useBusinessSources>
