import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { effectScope, ref } from 'vue'
import { createMetricLoader, flush } from '../../../jetlinks-web-core/tests/helpers/metricRuntime.mjs'

let deviceReads=0, productReads=0, commandReads=0
const api={
  queryMetricDevices:async()=>({data:[],total:0}),queryMetricProducts:async()=>({data:[{id:'product',name:'消防网关产品'}],total:1}),
  loadMetricDevice:async id=>{deviceReads++;return {device:{id,name:'网关'},properties:[{id:'temperature',name:'温度',group:'环境',valueType:{type:'double'}}],events:[{id:'fire',name:'火警',valueType:{type:'object',properties:[{id:'active',valueType:{type:'boolean'}}]}}]}},
  loadMetricProductSources:async id=>{productReads++;return {product:{id,name:'消防网关产品'},properties:[{id:'temperature',name:'温度',group:'环境',valueType:{type:'double'}}],events:[]}},
  loadMetricBuiltins:async()=>[],loadMetricInheritedOutputs:async()=>[],loadMetricProductName:async id=>id,
}
const business={loadMetricEvents:async()=>[{id:'fire-analysis',name:'视频分析',group:'消防证据',schema:{type:'object',properties:{confidence:{type:'number'}}}}],
  loadMetricCommandServices:async()=>[{id:'inspection',name:'人工核查'}],loadMetricCommands:async()=>{commandReads++;return [{id:'get',name:'核查结果',inputs:[{id:'count',valueType:{type:'long'}}],output:{type:'boolean'},expands:{metricSource:{eventType:'fire-analysis'}}}]},
  loadMetricObjectTypes:async()=>[{id:'zone',name:'防火分区'}],queryMetricBusinessObjects:async()=>({data:[{id:'zone1',name:'一区'}],total:1})}
const sourceFile=name=>fileURLToPath(new URL(`../views/device/metrics/${name}`,import.meta.url))
const load=createMetricLoader({
  [fileURLToPath(new URL('../api/metricSources.ts',import.meta.url))]:api,
  [fileURLToPath(new URL('../api/metricBusinessSources.ts',import.meta.url))]:business,
  './useMetricOutputSources':{useMetricOutputSources:()=>({loading:ref(false),error:ref(false),items:ref([])})},
})
const {useMetricSourcePicker}=load(sourceFile('useMetricSourcePicker.ts'))
const {sourceItems,sourceGroups}=load(sourceFile('sources/catalog.ts'))
const context={ownerType:'device',ownerId:'gateway',targetType:'device'}

test('来源建议不限制旧绑定；设备事件保留整对象，未知Provider不被偷偷改写',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  try {
    let pending=state.pickSource({context,input:{id:'temperature'},hint:{sources:['event','businessQuery']},mapping:{kind:'property',thingType:'device',thingId:'gateway',id:'temperature',custom:false}})
    await flush();assert.equal(state.canConfirm.value,true);assert.equal(state.selected.value.name,'温度')
    assert.equal(state.groups.value.flatMap(group=>group.items).some(item=>item.key==='property:temperature'),true)
    state.confirm();const property=await pending;assert.equal(property.mapping.id,'temperature');assert.equal(property.mapping.custom,false)
    pending=state.pickSource({context,input:{id:'alarm'},hint:{sources:['businessEvent','event']},purpose:'declaration'})
    await state.selectObject('gateway');await flush()
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='event'))
    state.confirm();const result=await pending
    assert.equal(result.mapping.thingId,'gateway');assert.equal(result.mapping.providerSource.provider,'device-events')
    assert.equal(result.declaration.valueType.properties[0].id,'active')
    pending=state.pickSource({context,input:{id:'old'},mapping:{kind:'provider',id:'fire',providerSource:{provider:'future-module',sourceType:'query',configuration:{custom:0}}}})
    await flush();assert.equal(state.category.value,'unsupported');assert.equal(state.selected.value,undefined);assert.equal(state.canConfirm.value,false);state.cancel();assert.equal(await pending,undefined)
  } finally {scope.stop()}
})

test('产品直接导入物模型不查样例设备；绑定属性按设备解析，产品统计保留产品身份',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  try {
    const before=deviceReads, products=productReads
    let pending=state.pickSource({context,input:{id:'reading'},purpose:'declaration'})
    state.changeObjectType('product');await state.selectObject('product');await flush()
    assert.equal(deviceReads,before);assert.equal(productReads,products+1)
    const method=state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property')
    state.selectMethod(method);state.confirm();assert.deepEqual((await pending).declaration,{name:'温度',unit:undefined,valueType:{type:'double'}})
    pending=state.pickSource({context:{ownerType:'product',ownerId:'product',scope:'children'},input:{id:'reading'}})
    await flush();state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property'))
    state.confirm();assert.deepEqual((await pending).mapping,{kind:'property',thingType:'device',id:'temperature'})
    pending=state.pickSource({context:{ownerType:'product',ownerId:'product'},input:{id:'reading'}})
    await flush();state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property'))
    assert.equal(state.canConfirm.value,false);assert.equal(state.issue(state.method.value),'productPropertyBinding');state.cancel();await pending
  } finally {scope.stop()}
})

test('事件和查询共用目录，仅显式关联才合并；元数据按服务惰性加载，选择保留0和动态参数',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  try {
    const before=commandReads
    let pending=state.pickSource({context,input:{id:'assessment'},scheduled:false})
    await flush();assert.equal(commandReads,before)
    await state.business.loadService('inspection');await flush();assert.equal(commandReads,before+1)
    await state.business.loadService('inspection');assert.equal(commandReads,before+1)
    const merged=state.items.value.find(item=>item.key==='businessEvent:fire-analysis')
    assert.equal(merged.methods.length,2)
    const method=merged.methods.find(item=>item.kind==='businessQuery')
    state.selectMethod(method);state.business.parameters.value={count:0};assert.equal(state.canConfirm.value,false)
    state.business.updateEvent.value='fire-analysis';assert.equal(state.canConfirm.value,true)
    state.confirm();const result=await pending
    assert.equal(result.mapping.providerSource.configuration.parameters.count,0)
    assert.equal(result.mapping.providerSource.configuration.updates.eventType,'fire-analysis')
    pending=state.pickSource({context,input:{id:'ai'},mapping:{kind:'provider',thingType:'device',thingId:'gateway',id:'confidence',providerSource:{provider:'events',sourceType:'fire-analysis',configuration:{valuePath:'confidence',custom:false}}}})
    await flush();assert.equal(state.business.valuePath.value,'confidence');state.confirm()
    const event=await pending;assert.equal(event.declaration.valueType.type,'double');assert.equal(event.mapping.providerSource.configuration.custom,false)
  } finally {scope.stop()}
})

test('同名数据和未关联查询不合并；跨组搜索和UI提示不会更改候选契约',()=>{
  const event={key:'event:x',kind:'businessEvent',id:'x',name:'火警',group:'消防',capabilities:['subscribe']}
  const query={key:'query:x',kind:'businessQuery',id:'x',name:'火警',capabilities:['current'],command:{expands:{}}}
  const items=sourceItems([event,query]);assert.equal(items.length,2)
  assert.equal(sourceGroups(items,'火警',[],true,'').length,2)
  assert.equal(sourceGroups(items,'',['property'],false,'').length,0)
  assert.equal(sourceGroups(items,'',['property'],true,'').flatMap(group=>group.items).length,2)
})

test('切换对象与关闭隔离迟到元数据，查询参数不从上一个对象继承',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker),original=api.loadMetricDevice
  let finish
  try {
    api.loadMetricDevice=()=>new Promise(resolve=>{finish=resolve})
    const pending=state.pickSource({context,input:{id:'reading'}})
    state.changeObjectType('product');await state.selectObject('product');await flush()
    finish({device:{id:'gateway',name:'旧设备'},properties:[{id:'old',name:'旧属性'}],events:[]});await flush()
    assert.equal(state.object.value.name,'消防网关产品');assert.equal(state.properties.value.some(item=>item.id==='old'),false)
    state.cancel();assert.equal(await pending,undefined)
  } finally {api.loadMetricDevice=original;scope.stop()}
})

test('逐设备来源可以改为固定对象再返回当前设备，业务参数与扩展无损往返',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  const owner={ownerType:'product',ownerId:'product',targetType:'device',scope:'children'}
  try {
    let pending=state.pickSource({context:owner,input:{id:'assessment'},mapping:{kind:'provider',id:'get',custom:false,
      providerSource:{provider:'objects',sourceType:'query',configuration:{commandService:'inspection',parameters:{count:0,active:false},objectIdParameter:'device',custom:0,
        updates:{eventType:'fire-analysis',filter:{confirmed:true},updateOnly:true}}}}})
    await flush();assert.equal(state.currentMember.value,true);assert.equal(state.canConfirm.value,true)
    state.confirm();const restored=await pending
    assert.equal(restored.mapping.thingId,undefined)
    assert.equal(restored.mapping.custom,false)
    assert.equal(restored.mapping.providerSource.configuration.custom,0)
    assert.deepEqual(restored.mapping.providerSource.configuration.parameters,{count:0,active:false})
    assert.equal(restored.mapping.providerSource.configuration.objectIdParameter,'device')
    assert.deepEqual(restored.mapping.providerSource.configuration.updates.filter,{confirmed:true})
    pending=state.pickSource({context:owner,input:{id:'temperature'},mapping:{kind:'property',id:'temperature'}})
    await flush();state.changeObject();await state.selectObject('external');await flush()
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property'));state.confirm()
    assert.equal((await pending).mapping.thingId,'external')
    pending=state.pickSource({context:owner,input:{id:'temperature'},mapping:{kind:'property',thingType:'device',thingId:'external',id:'temperature'}})
    await flush();assert.equal(state.currentMember.value,false)
    state.useOwner();await flush();state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property'));state.confirm()
    assert.equal((await pending).mapping.thingId,undefined)
  } finally {scope.stop()}
})

test('部分业务目录失败不阻止属性选择；换对象清空查询参数，关闭隔离迟到命令',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  const events=business.loadMetricEvents,commands=business.loadMetricCommands
  let finish
  try {
    business.loadMetricEvents=async()=>{throw new Error('event directory unavailable')}
    let pending=state.pickSource({context,input:{id:'temperature'}})
    await flush();assert.equal(state.business.failed.value,true)
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property'))
    assert.equal(state.canConfirm.value,true);state.confirm();await pending
    business.loadMetricEvents=events
    pending=state.pickSource({context,input:{id:'assessment'}});await flush();await state.business.loadService('inspection');await flush()
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='businessQuery'))
    state.business.parameters.value={count:5}
    await state.selectObject('external');state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='businessQuery'))
    assert.deepEqual(state.business.parameters.value,{})
    state.cancel();await pending
    business.loadMetricCommands=()=>new Promise(resolve=>{finish=resolve})
    pending=state.pickSource({context,input:{id:'assessment'}});await flush()
    const loading=state.business.loadService('inspection')
    state.cancel();await flush();finish([{id:'late',name:'迟到命令'}]);await loading
    assert.deepEqual(state.business.commands.value,{})
    assert.equal(await pending,undefined)
  } finally {business.loadMetricEvents=events;business.loadMetricCommands=commands;scope.stop()}
})

test('大量查询服务分页搜索，浏览不预取命令，旧绑定跨页仍可见',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker),original=business.loadMetricCommandServices
  try {
    business.loadMetricCommandServices=async()=>Array.from({length:150},(_,i)=>({id:`service-${i}`,name:`巡检${i}`}))
    const reads=commandReads
    let pending=state.pickSource({context,input:{id:'reading'},hint:{sources:['property']}})
    await flush();assert.equal(state.business.services.value.length,0)
    state.showAllSources.value=true;await flush()
    assert.equal(state.business.services.value.length,10);assert.equal(state.business.serviceCount.value,150)
    state.business.servicePage.value=2;assert.equal(state.business.services.value[0].id,'service-10')
    state.dataKeyword.value='巡检149';await flush()
    assert.equal(state.business.servicePage.value,1);assert.equal(state.business.services.value.length,1)
    assert.equal(state.business.services.value[0].id,'service-149');assert.equal(commandReads,reads)
    state.cancel();await pending
    pending=state.pickSource({context,input:{id:'assessment'},mapping:{kind:'provider',thingType:'device',thingId:'gateway',id:'get',providerSource:{provider:'objects',sourceType:'query',configuration:{commandService:'service-149',parameters:{count:0}}}}})
    await flush();assert.equal(state.canConfirm.value,true)
    assert.equal(state.business.services.value.some(item=>item.id==='service-149'),true)
    assert.ok(state.business.services.value.length<=11)
    state.cancel();await pending
  } finally {business.loadMetricCommandServices=original;scope.stop()}
})

test('简单来源一击完成；必要参数保留确认，不兼容来源不会关闭',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  const find=kind=>state.items.value.flatMap(item=>item.methods).find(item=>item.kind===kind)
  try {
    let pending=state.pickSource({context,input:{id:'temperature'}})
    await flush();assert.equal(state.choosingObject.value,false)
    state.chooseMethod(find('property'))
    assert.equal((await pending).mapping.id,'temperature');assert.equal(state.open.value,false)
    pending=state.pickSource({context,input:{id:'alarm'},purpose:'declaration'})
    await state.selectObject('gateway');await flush();state.chooseMethod(find('event'))
    assert.equal((await pending).mapping.providerSource.provider,'device-events')
    pending=state.pickSource({context,input:{id:'alarm',source:{lookback:'2h'}}})
    await flush();state.chooseMethod(find('businessEvent'))
    assert.equal(state.open.value,true);assert.equal(state.canConfirm.value,false)
    assert.equal(state.issue(state.method.value),'sourceNoHistory');state.cancel();await pending
    pending=state.pickSource({context,input:{id:'reading'}})
    await flush();state.chooseMethod(find('businessEvent'))
    assert.equal(state.open.value,true);assert.equal(state.requiresConfirmation.value,true)
    state.business.valuePath.value='confidence';state.confirm()
    assert.equal((await pending).mapping.id,'confidence')
    pending=state.pickSource({context,input:{id:'assessment'},scheduled:true})
    await flush();await state.business.loadService('inspection');state.chooseMethod(find('businessQuery'))
    assert.equal(state.open.value,true);assert.equal(state.requiresConfirmation.value,true)
    state.business.parameters.value={count:0};state.confirm()
    assert.equal((await pending).mapping.providerSource.configuration.parameters.count,0)
  } finally {scope.stop()}
})

test('模板导入仅在同一编辑会话复用成功选中的对象；取消与旧映射不污染记忆',async()=>{
  const scope=effectScope(),state=scope.run(useMetricSourcePicker)
  const request=session=>({context,input:{id:'reading'},purpose:'declaration',session})
  const property=()=>state.items.value.flatMap(item=>item.methods).find(item=>item.kind==='property')
  try {
    let pending=state.pickSource(request('template:1'))
    state.changeObjectType('product');await state.selectObject('product');await flush();state.chooseMethod(property());await pending
    pending=state.pickSource(request('template:1'));await flush()
    assert.equal(state.choosingObject.value,false);assert.equal(state.objectType.value,'product');assert.equal(state.objectId.value,'product')
    state.changeObjectType('device');await state.selectObject('cancelled');state.cancel();await pending
    pending=state.pickSource(request('template:1'));await flush()
    assert.equal(state.objectId.value,'product');state.cancel();await pending
    pending=state.pickSource({...request('template:1'),mapping:{kind:'property',thingType:'device',thingId:'external',id:'temperature'}});await flush()
    assert.equal(state.objectType.value,'device');assert.equal(state.objectId.value,'external')
    state.cancel();await pending
    pending=state.pickSource(request('template:2'));await flush()
    assert.equal(state.choosingObject.value,true);assert.equal(state.objectId.value,'');state.cancel();await pending
    pending=state.pickSource(request(undefined));await flush()
    assert.equal(state.choosingObject.value,true);state.cancel();await pending
  } finally {scope.stop()}
})
