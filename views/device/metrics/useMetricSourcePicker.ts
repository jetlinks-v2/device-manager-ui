import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { localizedTemplate } from '@jetlinks-web-core/components/Metric/template/text'
import { metricOutputName } from '@jetlinks-web-core/components/Metric/presentation'
import { queryMetricDevices, queryMetricProducts, loadMetricDevice, loadMetricProductSources, loadMetricBuiltins, type MetricOutputSource } from '../../../api/metricSources'
import { loadMetricObjectTypes, queryMetricBusinessObjects, type SourceObjectType } from '../../../api/metricBusinessSources'
import type { MetricInputMapping, MetricSourcePicker, MetricSourceSelection } from '@jetlinks-web-core/components'
import type { MetricDeviceOption, MetricPropertyOption } from './metricSources'
import { useMetricOutputSources } from './useMetricOutputSources'
import { useMetricMemberStatistics } from './useMetricMemberStatistics'
import { useBusinessSources } from './sources/useBusinessSources'
import { mappingSourceKind, propertyMethod, sourceItems, sourceGroups, type SourceMethod } from './sources/catalog'

/** 一个宿主只有一个选择生命周期；对象、目录、参数与迟到响应在同一代内归属。 */
export function useMetricSourcePicker(locale:Ref<string> = ref('zh')) {
  const request = shallowRef<Parameters<MetricSourcePicker>[0]>()
  const objectType = ref('device'), objectId = ref(''), objectName = ref('')
  const object = computed(()=>({type:objectType.value,id:objectId.value,name:objectName.value || objectId.value}))
  const objectTypes = ref<SourceObjectType[]>([]), devices = ref<MetricDeviceOption[]>([])
  const properties = ref<MetricPropertyOption[]>([]), events = ref<MetricPropertyOption[]>([])
  const builtins = ref<Awaited<ReturnType<typeof loadMetricBuiltins>>>([])
  const builtinScope = computed(()=>({type:objectType.value,id:objectId.value})), includeChildren = ref(false)
  const keyword = ref(''), dataKeyword = ref(''), scoped = ref(true), page = ref(1), total = ref(0)
  const choosingObject = ref(false), showAllSources = ref(false), metricsExpanded = ref(false)
  const objectTypesError = ref(false)
  const loading = ref(false), propertyLoading = ref(false), builtinLoading = ref(false)
  const queryError = ref(false), propertyError = ref(false), builtinError = ref(false)
  const category = ref<SourceMethod['kind']|'unsupported'>('property'), propertyId = ref('')
  const selectedKey = ref(''), methodKey = ref('')
  let queryVersion = 0, propertyVersion = 0, builtinVersion = 0, objectTypesVersion = 0, restore = true
  let resolveSelection:((selection?:MetricSourceSelection)=>void) | undefined
  let lastDeclaration:{session:string;type:string;id:string;name:string} | undefined
  const open = computed(()=>!!request.value), inherited = computed(()=>request.value?.context.scope === 'children')
  const currentMember = computed(()=>objectType.value === 'member')
  const historyInput = computed(()=>request.value?.purpose !== 'declaration' && !!request.value?.input.source?.lookback)
  const deviceId = computed(()=>objectType.value === 'device' ? objectId.value : '')
  const hasOwnerBuiltins = computed(()=>!!objectId.value && !currentMember.value)
  const ownerBuiltin = computed(()=>category.value === 'builtin' && hasOwnerBuiltins.value)
  const suggestedSources = computed(()=>request.value?.hint?.sources || [])
  const error = computed(()=>queryError.value || propertyError.value)
  const businessObject = computed(()=>currentMember.value ? {type:'device',id:'',name:object.value.name} : object.value)
  const queriesVisible = computed(()=>showAllSources.value || !suggestedSources.value.length || suggestedSources.value.includes('businessQuery') || category.value === 'businessQuery')
  const business = useBusinessSources(request,businessObject,queriesVisible)
  const metricSources = useMetricOutputSources(request,deviceId,computed(()=>open.value && !choosingObject.value && metricsExpanded.value),object)
  const statistics = useMetricMemberStatistics(request,builtinScope,includeChildren,finish)
  const methods = computed<SourceMethod[]>(()=>[
    ...properties.value.map(item=>propertyMethod(item)), ...events.value.map(item=>propertyMethod(item,true)),
    ...builtins.value.map(item=>({...item,key:`builtin:${item.id}`,kind:'builtin' as const,valueType:{type:item.valueType || 'long'},capabilities:['current' as const]})),
    ...metricSources.items.value.map(item=>({key:`metric:${item.config.id}:${item.output.metricId}`,kind:'metric' as const,id:item.output.metricId,name:metricOutputName(item.output,localizedTemplate(item.template,locale.value)) || item.output.metricId,
      group:item.config.name || item.template.name,unit:item.output.unit,icon:'NodeIndexOutlined',valueType:{type:item.output.valueType || 'double'},capabilities:['current' as const,'subscribe' as const,...(item.output.persist && !item.output.latestOnly ? ['history' as const] : [])]})),
    ...business.methods.value,
  ])
  const items = computed(()=>sourceItems(methods.value))
  const groups = computed(()=>sourceGroups(items.value,dataKeyword.value,suggestedSources.value,showAllSources.value,selectedKey.value))
  const selected = computed(()=>items.value.find(item=>item.key === selectedKey.value))
  const method = computed(()=>selected.value?.methods.find(item=>item.key === methodKey.value))
  const selectedProperty = computed(()=>properties.value.find(item=>item.id === propertyId.value && (category.value === 'property' ? !item.platform : category.value === 'builtin' && item.platform)))
  const propertyAllowed = computed(()=>objectType.value === 'device' || currentMember.value || objectType.value === 'product' && request.value?.purpose === 'declaration')
  const canConfirm = computed(()=>{
    if (!request.value || choosingObject.value || statistics.active.value || category.value === 'unsupported') return false
    if (method.value && issue(method.value)) return false
    if (category.value === 'businessEvent' || category.value === 'businessQuery') return business.canConfirm.value
    if (category.value === 'metric') return !!method.value && !metricSources.loading.value && !metricSources.error.value
    if (category.value === 'event') return !propertyLoading.value && !propertyError.value && events.value.some(item=>item.id === propertyId.value) && propertyAllowed.value
    if (category.value === 'property' || selectedProperty.value?.platform) return !propertyLoading.value && !propertyError.value && !!selectedProperty.value && propertyAllowed.value && (!historyInput.value || !selectedProperty.value.platform || selectedProperty.value.history)
    return !builtinLoading.value && !builtinError.value && !historyInput.value && (request.value.purpose === 'declaration' || request.value.scheduled !== false) && builtins.value.some(item=>item.id === propertyId.value && (request.value?.purpose === 'declaration' || !item.configurationRequired))
  })
  const requiresConfirmation = computed(()=>request.value?.purpose !== 'declaration' && !!method.value && (selected.value!.methods.length > 1 || category.value === 'businessQuery'
    || category.value === 'businessEvent'
    || category.value === 'builtin' && !!builtins.value.find(item=>item.id === propertyId.value)?.supportsChildren))

/** 能力提示反映模板当前的读取需求；产品属性不能误存成产品ID的设备读取。 */
  function issue(item:SourceMethod):string | undefined {
    if (request.value?.purpose === 'declaration') return
    if (['property','event'].includes(item.kind) || item.kind === 'builtin' && item.id.startsWith('$')) {
      if (!propertyAllowed.value) return 'productPropertyBinding'
    }
    if (historyInput.value && !item.capabilities.includes('history')) return 'sourceNoHistory'
    if (item.kind === 'builtin' && !item.id.startsWith('$') && request.value?.scheduled === false) return 'builtinScheduleRequired'
    return undefined
  }
  function cancel() {
    queryVersion++; propertyVersion++; builtinVersion++; objectTypesVersion++
    statistics.close(); request.value = undefined
    loading.value = false; propertyLoading.value = false; builtinLoading.value = false
    resolveSelection?.(); resolveSelection = undefined
  }
  /** 原来源未变时保留宿主扩展；不将旧对象的扩展带到新对象，也不重建未编辑的Provider配置。 */
  function sameObject(mapping:MetricInputMapping) {
    const context = request.value!.context
    return (mapping.thingType || context.targetType || context.ownerType) === (currentMember.value ? 'device' : objectType.value)
      && (currentMember.value ? !mapping.thingId : (mapping.thingId || mapping.providerSource?.configuration.thingId || context.targetId || context.ownerId) === objectId.value)
  }
  function finish(selection:MetricSourceSelection) {
    if (request.value?.purpose === 'declaration' && request.value.session && objectId.value) {
      lastDeclaration = {session:request.value.session,type:objectType.value,id:objectId.value,name:objectName.value}
    }
    const original = request.value?.mapping, next = selection.mapping
    if (original && sameObject(original) && original.kind === next.kind && original.id === next.id && original.configId === next.configId
      && original.providerSource?.provider === next.providerSource?.provider && original.providerSource?.sourceType === next.providerSource?.sourceType) selection.mapping = {...original,...next}
    resolveSelection?.(selection); resolveSelection = undefined; cancel()
  }
  const pickSource:MetricSourcePicker = next=>{
    cancel(); restore = true; request.value = next
    selectedKey.value = ''; methodKey.value = ''; properties.value = []; events.value = []; builtins.value = []; devices.value = []
    showAllSources.value = false; keyword.value = ''; dataKeyword.value = ''; scoped.value = true; page.value = 1
    objectTypes.value = []; objectTypesError.value = false; metricsExpanded.value = next.mapping?.kind === 'metric' || next.input.source?.kind === 'metric'
    queryError.value = false; propertyError.value = false; builtinError.value = false
    const mapping = next.mapping, context = next.context
    const remembered = !mapping && next.purpose === 'declaration' && next.session === lastDeclaration?.session ? lastDeclaration : undefined
    const mappedId = mapping?.thingId || String(mapping?.providerSource?.configuration.thingId || '')
    objectType.value = inherited.value && !mappedId && (!mapping?.thingType || mapping.thingType === 'device') ? 'member' : mapping?.thingType || remembered?.type || (next.purpose === 'declaration' ? 'device' : context.ownerType)
    objectId.value = currentMember.value ? context.ownerId : mappedId || remembered?.id || (next.purpose === 'declaration' ? '' : context.ownerId)
    objectName.value = remembered?.name || (objectId.value === context.ownerId ? context.label || objectId.value : objectId.value)
    includeChildren.value = !!mapping?.includeChildren
    propertyId.value = mapping?.id || ''
    category.value = mappingSourceKind(mapping)
    if (!mapping && suggestedSources.value.length) category.value = (['property','event','builtin','metric','businessEvent','businessQuery'] as const).find(item=>suggestedSources.value.includes(item)) || 'property'
    choosingObject.value = !objectId.value
    const pending = new Promise<MetricSourceSelection | undefined>(resolve=>{resolveSelection=resolve})
    if (objectId.value) void loadObject(); else changeObject()
    if (objectId.value && next.purpose === 'declaration') void loadObjectTypes()
    if (mapping?.statistics) statistics.open(mapping)
    return pending
  }
  async function loadBuiltins() {
    const token = ++builtinVersion; builtins.value = []; builtinError.value = false; builtinLoading.value = !!objectId.value && !currentMember.value
    if (!builtinLoading.value) return
    try { const result = await loadMetricBuiltins(objectType.value,objectId.value); if (token === builtinVersion) builtins.value = result }
    catch { if (token === builtinVersion) builtinError.value = true }
    finally { if (token === builtinVersion) builtinLoading.value = false }
  }
  async function loadObject() {
    const token = ++propertyVersion; properties.value = []; events.value = []; propertyError.value = false
    propertyLoading.value = ['device','product','member'].includes(objectType.value) && !!objectId.value
    void loadBuiltins()
    if (!propertyLoading.value) return
    try {
      const result = objectType.value === 'device' ? await loadMetricDevice(objectId.value) : await loadMetricProductSources(objectId.value)
      if (token !== propertyVersion) return
      properties.value = result.properties; events.value = result.events || []
      const source = 'device' in result ? result.device : result.product
      if (source) objectName.value = source.name
    } catch { if (token === propertyVersion) propertyError.value = true }
    finally { if (token === propertyVersion) propertyLoading.value = false }
  }
  /** 仅当前对象类型分页查候选；切换和清空时立即使旧请求失效。 */
  async function search() {
    if (!request.value) return
    const token = ++queryVersion; loading.value = true; queryError.value = false
    try {
      const result = objectType.value === 'device' ? await queryMetricDevices(request.value.context,keyword.value,page.value-1,scoped.value)
        : objectType.value === 'product' ? await queryMetricProducts(keyword.value,page.value-1) : await queryMetricBusinessObjects(objectType.value,keyword.value,page.value-1)
      if (token !== queryVersion) return
      devices.value = result.data.map((item:{id:string;name?:string;productId?:string})=>({...item,name:item.name || item.id})); total.value = result.total
    } catch { if (token === queryVersion) queryError.value = true }
    finally { if (token === queryVersion) loading.value = false }
  }
  async function selectObject(id:string,name?:string) {
    objectId.value = id; objectName.value = name || devices.value.find(item=>item.id === id)?.name || id
    choosingObject.value = false; selectedKey.value = ''; methodKey.value = ''; propertyId.value = ''; restore = false; business.selected.value = undefined
    statistics.close(); await loadObject()
  }
  function changeObjectType(type:string) { objectType.value = type; page.value = 1; keyword.value = ''; queryVersion++; void search() }
  function changeObject() {
    statistics.close(); choosingObject.value = true
    if (currentMember.value) objectType.value = 'device'
    void search()
    void loadObjectTypes()
  }
  async function loadObjectTypes() {
    const token = ++objectTypesVersion
    objectTypesError.value = false
    try { const types = await loadMetricObjectTypes(); if (request.value && token === objectTypesVersion) objectTypes.value = types }
    catch { if (token === objectTypesVersion) objectTypesError.value = true }
  }
  function useOwner() {
    const context = request.value?.context
    if (!context) return
    objectType.value = inherited.value ? 'member' : context.ownerType
    void selectObject(context.ownerId,context.label)
  }
  function selectMethod(item:SourceMethod,restoring=false) {
    restore = false
    selectedKey.value = items.value.find(value=>value.methods.some(value=>value.key === item.key))?.key || item.key
    methodKey.value = item.key; category.value = item.kind; propertyId.value = item.id
    if (item.kind === 'businessEvent' || item.kind === 'businessQuery') business.select(item,restoring)
    if (request.value?.purpose !== 'declaration' && item.kind === 'builtin' && builtins.value.find(value=>value.id === item.id)?.configurationRequired && !restoring) statistics.open()
  }
  /** 简单来源一次选择即完成；需要参数、字段或读取方式时才保留确认步骤。 */
  function chooseMethod(item:SourceMethod) {
    selectMethod(item)
    if (!requiresConfirmation.value) confirm()
  }
  /** 重开按完整来源身份定位；同名属性、事件、查询或输出不会串选。 */
  watch(methods,values=>{
    if (!restore || !request.value?.mapping) return
    const mapping = request.value.mapping, provider = mapping.providerSource
    const kind = mappingSourceKind(mapping)
    const found = values.find(item=>item.kind === kind && (kind === 'businessEvent' ? item.id === provider?.sourceType
      : kind === 'businessQuery' ? item.id === mapping.id && item.service === provider?.configuration.commandService
      : item.id === mapping.id && (kind !== 'metric' || item.key === `metric:${mapping.configId}:${mapping.id}`)))
    if (found) selectMethod(found,true)
  })
  function confirmMetric(item:MetricOutputSource,label:string) {
    if (!request.value || inherited.value || !metricSources.items.value.includes(item) || item.config.id === request.value.configId || historyInput.value && (!item.output.persist || item.output.latestOnly)) return
    finish({mapping:{kind:'metric',configId:item.config.id,thingType:item.config.targetType,thingId:item.config.targetId,id:item.output.metricId},label})
  }
  function confirm() {
    if (!canConfirm.value) return
    if (category.value === 'businessEvent' || category.value === 'businessQuery') { const selection = business.selection(); if (selection) finish(selection); return }
    if (category.value === 'metric') { const item = metricSources.items.value.find(item=>methodKey.value === `metric:${item.config.id}:${item.output.metricId}`); if (item) confirmMetric(item,`${object.value.name} / ${method.value?.name}`); return }
    if (category.value === 'event') {
      const item = events.value.find(item=>item.id === propertyId.value)!
      const original = request.value?.mapping
      const source = original && sameObject(original) && mappingSourceKind(original) === 'event' && original.id === item.id ? original.providerSource : undefined
      finish({mapping:{kind:'provider',thingType:'device',...(objectType.value === 'device' ? {thingId:objectId.value} : {}),id:item.id,providerSource:{...source,provider:source?.provider || 'device-events',sourceType:'event',configuration:{...source?.configuration,...(objectType.value !== 'device' ? {templateId:objectId.value} : {})}}},label:`${object.value.name} / ${item.name}`,declaration:{id:item.id,name:item.name,valueType:item.valueType}}); return
    }
    const item = selectedProperty.value
    if (item) { finish({mapping:{kind:'property',thingType:'device',...(objectType.value === 'device' ? {thingId:objectId.value} : {}),id:item.id},label:`${object.value.name} / ${item.name}`,declaration:{id:item.id,name:item.name,unit:item.unit,valueType:item.valueType}}); return }
    const builtin = builtins.value.find(item=>item.id === propertyId.value)!
    finish({mapping:{kind:'builtin',thingType:objectType.value,thingId:objectId.value,id:builtin.id,includeChildren:!!builtin.supportsChildren && includeChildren.value},label:`${object.value.name} / ${builtin.name}`,declaration:{id:builtin.id,name:builtin.name,unit:builtin.unit,valueType:{type:builtin.valueType || 'long'}}})
  }
  onScopeDispose(cancel)
  return {request,open,inherited,currentMember,object,objectType,objectTypes,objectId,objectName,devices,properties,events,builtins,builtinScope,includeChildren,
    deviceId,propertyId,category,keyword,dataKeyword,scoped,page,total,loading,propertyLoading,builtinLoading,builtinError,error,propertyError,
    choosingObject,showAllSources,suggestedSources,historyInput,hasOwnerBuiltins,ownerBuiltin,canConfirm,requiresConfirmation,statistics,metricSources,business,
    items,groups,selected,method,selectedKey,methodKey,issue,selectMethod,chooseMethod,pickSource,selectObject,selectDevice:selectObject,changeObjectType,changeObject,useOwner,objectTypesError,loadObjectTypes,metricsExpanded,
    changeScope:(value:boolean)=>{scoped.value=value;page.value=1;void search()},changePage:(value:number)=>{page.value=value;void search()},
    search,loadObject,loadProduct:loadObject,loadBuiltins,confirmMetric,confirm,cancel,finish}
}
export type MetricSourcePickerState = ReturnType<typeof useMetricSourcePicker>
