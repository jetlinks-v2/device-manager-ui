import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { MetricInputMapping, MetricSourceRequest, MetricSourceSelection } from '@jetlinks-web-core/components'
import { metricSourceField, metricSourceSchema } from '@jetlinks-web-core/components/Metric/sourceSchema'
import { loadMetricEvents, loadMetricCommandServices, loadMetricCommands, type BusinessCommand, type BusinessEvent } from '../../../../api/metricBusinessSources'
import type { SourceMethod } from './catalog'

/** 只发现显式声明的业务数据；内部服务身份仅用于读取元数据和恢复旧绑定。 */
export function useBusinessSources(request:Ref<MetricSourceRequest | undefined>, object:Ref<{type:string;id:string;name:string}>, visible:Ref<boolean>) {
  const events = ref<BusinessEvent[]>([])
  const commands = ref<Record<string,BusinessCommand[]>>({})
  const eventLoading = ref(false), queryLoading = ref(false), failed = ref(false)
  const loading = computed(()=>eventLoading.value || queryLoading.value)
  const selected = ref<SourceMethod>(), valuePath = ref('$'), updateEvent = ref<string>()
  const parameters = ref<Record<string,unknown>>({}), parameterModes = ref<Record<string,string>>({})
  let generation = 0
  let discovery:Promise<void> | undefined
  const pendingServices = new Map<string,Promise<void>>()
  const discoverableServices = ref<string[]>([])
  function matchesObject(mapping:MetricInputMapping) {
    const context = request.value!.context
    return (mapping.thingType || context.targetType || (context.scope === 'children' ? 'device' : context.ownerType)) === object.value.type
      && (mapping.thingId || mapping.providerSource?.configuration.thingId || (context.scope === 'children' ? '' : context.targetId || context.ownerId)) === object.value.id
  }
  const legacyQuery = computed(()=>{
    const mapping = request.value?.mapping, source = mapping?.providerSource
    return mapping && matchesObject(mapping) && source?.provider === 'objects' && source.sourceType === 'query'
      ? {service:String(source.configuration.commandService || ''),id:mapping.id} : undefined
  })
  const methods = computed<SourceMethod[]>(()=>[
    ...events.value.map(event=>({key:`businessEvent:${event.id}`,kind:'businessEvent' as const,id:event.id,name:event.name || event.id,description:event.description,group:event.group,event,valueType:metricSourceSchema(event.schema || {}),capabilities:['subscribe' as const]})),
    ...Object.entries(commands.value).flatMap(([service,items])=>items.filter(command=>discoverableServices.value.includes(service) && command.expands?.metricSource && typeof command.expands.metricSource === 'object'
      || legacyQuery.value?.service === service && legacyQuery.value.id === command.id).map(command=>({key:`businessQuery:${service}:${command.id}`,kind:'businessQuery' as const,id:command.id,name:command.name || command.id,description:command.description,
      group:(command.expands?.metricSource as {group?:string} | undefined)?.group,
      service,command,valueType:command.output,capabilities:['current' as const]}))),
  ])
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
  const canConfirm = computed(()=>!!selected.value
    && (request.value?.purpose === 'declaration' || request.value?.context.scope === 'children' || !!object.value.id)
    && (request.value?.purpose === 'declaration' || !request.value?.input.source?.lookback)
    && (selected.value.kind === 'businessEvent' ? fields.value.some(item=>item.value === valuePath.value)
      : request.value?.purpose === 'declaration' || request.value?.scheduled !== false || !!updateEvent.value))

  /** 请求换代清空目录和参数，旧服务响应不能回填另一次选择。 */
  async function load() {
    const token = ++generation; pendingServices.clear(); discovery = undefined
    events.value = []; commands.value = {}; discoverableServices.value = []; failed.value = false; queryLoading.value = false; eventLoading.value = !!request.value
    if (!request.value) return
    if (visible.value) void loadQueries()
    try {
      const result = await loadMetricEvents()
      if (token !== generation) return
      events.value = result
    } catch { if (token === generation) failed.value = true }
    finally { if (token === generation) eventLoading.value = false }
  }
  /** 仅加载已声明的服务，最多四个并发；旧映射额外定点恢复，不扫描其余内部服务。 */
  function loadQueries():Promise<void> | undefined {
    if (!request.value || discovery) return discovery
    const token = generation; queryLoading.value = true
    const legacy = legacyQuery.value?.service
    const restore = legacy ? loadService(legacy) : Promise.resolve()
    discovery = (async()=>{
      try {
        const services = await loadMetricCommandServices(object.value.type)
        if (token !== generation) return
        discoverableServices.value = services.map(service=>service.id)
        for (let index=0; index<services.length && token === generation; index+=4) {
          await Promise.all(services.slice(index,index+4).map(service=>loadService(service.id)))
        }
      } catch { if (token === generation) failed.value = true }
      finally { await restore; if (token === generation) queryLoading.value = false }
    })()
    return discovery
  }
  function loadService(service:string):Promise<void> {
    if (commands.value[service]) return Promise.resolve()
    const pending = pendingServices.get(service)
    if (pending) return pending
    const token = generation
    const result = loadMetricCommands(service).then(items=>{
      if (token === generation) commands.value = {...commands.value,[service]:items}
    }).catch(()=>{ if (token === generation) failed.value = true })
      .finally(()=>{ if (token === generation) pendingServices.delete(service) })
    pendingServices.set(service,result)
    return result
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
    const sameObject = original && matchesObject(original)
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
      label:`${object.value.name} / ${method.name}`,declaration:{id:method.id,name:method.name,valueType:method.event ? metricSourceField(metricSourceSchema(method.event.schema || {}),valuePath.value) : method.command?.output}}
  }
  watch([()=>request.value,()=>object.value.type,()=>object.value.id],()=>{selected.value=undefined;parameters.value={};parameterModes.value={};void load()},{immediate:true})
  watch(visible,value=>{if (value) void loadQueries()})
  onScopeDispose(()=>{generation++})
  return {events,commands,methods,loading,failed,selected,valuePath,fields,parameters,parameterModes,updateEvent,canConfirm,load,loadService,select,selection}
}
export type BusinessSourcesState = ReturnType<typeof useBusinessSources>
