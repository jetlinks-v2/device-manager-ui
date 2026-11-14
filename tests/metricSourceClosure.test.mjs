import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { effectScope, ref } from 'vue'
import { createMetricLoader, flush } from './metricCoreRuntime.mjs'

const reads=[], metadataReads=[]
const metricOutputs=ref([])
const temperature={id:'temperature',name:'温度',valueType:{type:'double'},expands:{semanticId:'urn:temperature'}}
const query={id:'summary',name:'统计',kind:'query',configurableParameters:['limit'],bindings:{id:{source:'subjectId'}}}
let capabilities=[query], denied=false, metadata=async()=>({id:'read',name:'读取',inputs:[{id:'id'},{id:'limit',valueType:{type:'long'}}],output:{type:'object',properties:[{...temperature},{id:'count',name:'数量',valueType:{type:'long'}}]}})
const api={
  loadMetricObjectSources:async(type,id)=>{reads.push([type,id]);if(denied)throw Error('denied');return {properties:[temperature],events:[]}},
  loadMetricBuiltins:async()=>[],loadMetricInheritedOutputs:async()=>[],loadMetricProductName:async id=>id,
  queryMetricDevices:async()=>{throw Error('must not enumerate devices')},queryMetricProducts:async()=>({data:[],total:0}),
  describeMetricProvider:async()=>({schema:{type:'object',properties:{active:{type:'boolean',expands:{semanticId:'urn:active'}}}},capabilities:['subscribe']}),
}
const business={
  loadObjectSourceCapabilities:async(type,id)=>{reads.push(['capabilities',type,id]);if(denied)throw Error('denied');return capabilities},
  loadObjectSourceMetadata:async(type,id,capability)=>{metadataReads.push([type,id,capability]);return metadata(capability)},
  loadMetricObjectTypes:async()=>[],queryMetricBusinessObjects:async()=>({data:[],total:0}),
}
const load=createMetricLoader({
  [fileURLToPath(new URL('../api/metricSources.ts',import.meta.url))]:api,
  [fileURLToPath(new URL('../api/metricBusinessSources.ts',import.meta.url))]:business,
  './useMetricOutputSources':{useMetricOutputSources:()=>({loading:ref(false),error:ref(false),items:metricOutputs})},
})
const {useMetricSourcePicker}=load(fileURLToPath(new URL('../views/device/metrics/useMetricSourcePicker.ts',import.meta.url)))
const context={ownerType:'device',ownerId:'D1',targetType:'device',targetId:'D1',label:'当前设备'}
function fixture(){const scope=effectScope();return {scope,state:scope.run(useMetricSourcePicker)}}
const method=(state,id,path)=>state.items.value.flatMap(item=>item.methods).find(item=>item.id===id && (path===undefined || item.valuePath===path))

test('已有指标来源保留显式枚举和对象声明，不退化为顶层type或默认double',async()=>{
  const schema={type:'enum',valueType:{type:'int'},elements:[{value:0,text:'停止'},{value:1,text:'运行'}]}
  const spec={id:'source',name:'来源',inputDefinitions:[],parameterDefinitions:[],definitions:[{id:'state',resultType:schema}],outputs:[]}
  metricOutputs.value=[{config:{id:'C1'},template:spec,output:{metricId:'state',valueType:'enum'}}]
  const {scope,state}=fixture()
  try{
    const pending=state.pickSource({context,input:{id:'value',valueType:schema}});await flush()
    assert.deepEqual(JSON.parse(JSON.stringify(method(state,'state').valueType)),schema)
    state.cancel();await pending
    spec.definitions[0]={id:'state'};metricOutputs.value=[{config:{id:'C1'},template:spec,output:{metricId:'state'}}]
    const unknown=state.pickSource({context,input:{id:'value',valueType:{type:'double'}}});await flush()
    assert.equal(method(state,'state'),undefined)
    state.cancel();await unknown
  }finally{metricOutputs.value=[];scope.stop()}
})

test('绑定锁定实际目标，不查询或更换任意对象；声明导入仍可选对象',async()=>{
  const {scope,state}=fixture();reads.length=0
  try{
    const pending=state.pickSource({context:{...context,ownerType:'space',ownerId:'S1'},input:{id:'value',valueType:{type:'double'}}});await flush()
    assert.equal(state.objectId.value,'D1');assert.equal(state.objectType.value,'device');assert.equal(state.canChangeObject.value,false)
    state.changeObject();state.changeObjectType('product');await state.selectObject('other')
    assert.equal(state.objectId.value,'D1');assert.equal(state.choosingObject.value,false)
    assert.deepEqual(reads[0],['device','D1'])
    state.chooseMethod(method(state,'temperature'));assert.equal((await pending).mapping.thingId,'D1')
    const declaration=state.pickSource({context,input:{id:'value'},purpose:'declaration'});await state.selectObject('example');await flush()
    assert.equal(state.canChangeObject.value,true);state.chooseMethod(method(state,'temperature'));await declaration
  }finally{scope.stop()}
})

test('产品成员引用保持相对目标，模型来自归属对象，不枚举或误用产品汇总',async()=>{
  const {scope,state}=fixture();reads.length=0
  try{
    const pending=state.pickSource({context:{ownerType:'product',ownerId:'P1',targetType:'device',targetId:'*',scope:'children'},input:{id:'value',valueType:{type:'double'}}});await flush()
    assert.equal(state.currentMember.value,true);assert.deepEqual(reads[0],['product','P1'])
    assert.equal(state.business.methods.value.length,0)
    state.chooseMethod(method(state,'temperature'));const result=await pending
    assert.equal(result.mapping.thingType,'device');assert.equal(result.mapping.thingId,undefined)
  }finally{scope.stop()}
})

test('声明目录排除动作；查询输出保留类型语义，参数只开放显式配置项',async()=>{
  const {scope,state}=fixture();capabilities=[query,{id:'start',name:'启动',kind:'action'}];metadataReads.length=0
  try{
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'},semantics:{semanticId:'urn:temperature'}}});await flush()
    assert.deepEqual(metadataReads,[['device','D1','summary']])
    assert.deepEqual(state.business.methods.value.find(item=>item.valuePath==='temperature').command.inputs.map(item=>item.id),['limit'])
    assert.deepEqual(state.items.value.flatMap(item=>item.methods).filter(item=>item.kind==='businessQuery').map(item=>item.valuePath),['temperature'])
    state.chooseMethod(method(state,'summary','temperature'));state.business.parameters.value={limit:0};state.confirm()
    const result=await pending
    assert.equal(result.mapping.providerSource.provider,'ontology');assert.equal(result.mapping.providerSource.sourceType,'summary')
    assert.equal(result.mapping.providerSource.configuration.valuePath,'temperature');assert.equal(result.mapping.providerSource.configuration.parameters.limit,0)
  }finally{capabilities=[query];scope.stop()}
})

test('本体绑定按能力与字段恢复，保留零值参数和未编辑扩展',async()=>{
  const {scope,state}=fixture()
  try{
    const mapping={kind:'provider',thingType:'device',thingId:'D1',id:'temperature',custom:false,providerSource:{provider:'ontology',sourceType:'summary',configuration:{valuePath:'temperature',parameters:{limit:0},custom:0}}}
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'}},mapping});await flush()
    assert.equal(state.method.value.valuePath,'temperature');assert.equal(state.canConfirm.value,true)
    assert.equal(state.business.parameters.value.limit,0);state.confirm();const result=await pending
    assert.equal(result.mapping.custom,false);assert.equal(result.mapping.providerSource.configuration.custom,0)
  }finally{scope.stop()}
})

test('实时和历史读取需求按声明准入，不把当前摘要当历史或订阅',async()=>{
  const {scope,state}=fixture()
  try{
    for(const options of [{scheduled:false},{input:{id:'value',valueType:{type:'double'},source:{lookback:'1h'}}}]){
      const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'}},...options});await flush()
      assert.equal(method(state,'summary','count'),undefined)
      state.chooseMethod(state.business.methods.value.find(item=>item.valuePath==='count'));state.confirm()
      assert.equal(state.canConfirm.value,false);assert.equal(state.open.value,true)
      state.cancel();await pending
    }
    capabilities=[{...query,id:'history',bindings:{from:{source:'from'},to:{source:'to'}},evidenceMapping:{observedAt:'timestamp'}}]
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'},source:{lookback:'1h'}}});await flush()
    state.chooseMethod(method(state,'history','count'));state.confirm()
    assert.equal((await pending).mapping.providerSource.configuration.historyCapability,'history')
  }finally{capabilities=[query];scope.stop()}
})

test('结构化事件字段保留语义声明，可绑定事件字段',async()=>{
  const {scope,state}=fixture();capabilities=[{id:'changed',name:'状态变化',kind:'event',event:{transport:'structuredEvent',definitionId:'changed'}}]
  try{
    const pending=state.pickSource({context,scheduled:false,input:{id:'value',valueType:{type:'boolean'},semantics:{semanticId:'urn:active'}}});await flush()
    const candidate=method(state,'changed','active');assert.ok(candidate)
    state.chooseMethod(candidate);state.confirm()
    const result=await pending
    assert.equal(result.mapping.providerSource.sourceType,'changed');assert.equal(result.mapping.providerSource.configuration.valuePath,'active')
  }finally{capabilities=[query];scope.stop()}
})

test('有时间窗但缺观测时间的查询不冒充当前值',async()=>{
  const {scope,state}=fixture();capabilities=[{...query,bindings:{from:{source:'from'},to:{source:'to'}}}]
  try{
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'}}});await flush()
    assert.equal(method(state,'summary','count'),undefined)
    const unavailable=state.business.methods.value.find(item=>item.valuePath==='count')
    assert.equal(state.issue(unavailable),'sourceNoCurrent');state.chooseMethod(unavailable)
    assert.equal(state.canConfirm.value,false)
    state.cancel();await pending
  }finally{capabilities=[query];scope.stop()}
})

test('显式subject反显保留来源对象及运行目标',async()=>{
  const {scope,state}=fixture()
  try{
    const subject={type:'fleet',id:'F1'}
    const mapping={kind:'provider',thingType:'device',thingId:'D1',id:'count',providerSource:{provider:'ontology',sourceType:'summary',subject,configuration:{valuePath:'count',parameters:{limit:0}}}}
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'long'}},mapping});await flush()
    assert.equal(state.objectType.value,'fleet');assert.equal(state.objectId.value,'F1')
    state.confirm();const result=await pending
    assert.deepEqual(result.mapping.providerSource.subject,subject);assert.equal(result.mapping.thingType,'device');assert.equal(result.mapping.thingId,'D1')
  }finally{scope.stop()}
})

test('元数据发现四路有界，取消后迟到响应不回填',async()=>{
  const {scope,state}=fixture(),original=metadata,waiting=[];let active=0,max=0
  try{
    capabilities=Array.from({length:9},(_,id)=>({...query,id:String(id)}))
    metadata=()=>{active++;max=Math.max(max,active);return new Promise(resolve=>waiting.push(()=>{active--;resolve({output:{type:'long'}})}))}
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'}}});await flush();assert.equal(waiting.length,4)
    state.cancel();await pending;waiting.splice(0).forEach(resolve=>resolve());await flush()
    assert.equal(state.business.methods.value.length,0);assert.equal(max,4);assert.equal(waiting.length,0)
  }finally{metadata=original;capabilities=[query];scope.stop()}
})

test('权限撤销后目录及选择清空，重试不复用旧授权',async()=>{
  const {scope,state}=fixture()
  try{
    const pending=state.pickSource({context,input:{id:'value',valueType:{type:'double'}}});await flush();state.selectMethod(method(state,'summary','count'))
    denied=true;await Promise.all([state.loadObject(),state.business.load()]);await flush()
    assert.equal(state.business.methods.value.length,0);assert.equal(state.business.failed.value,true);assert.equal(state.canConfirm.value,false)
    denied=false;await Promise.all([state.loadObject(),state.business.load()]);await flush();assert.ok(method(state,'temperature'))
    state.cancel();await pending
  }finally{denied=false;scope.stop()}
})

test('未声明输入不开放目录，导入声明仍开放且保留原语义',async()=>{
  const {scope,state}=fixture()
  try{
    const pending=state.pickSource({context,input:{id:'value',valueType:{},semantics:{}}});await flush()
    assert.equal(state.inputUndeclared.value,true);assert.equal(state.items.value.length,0)
    state.showAllSources.value=true;await flush();assert.equal(state.groups.value.length,0)
    state.propertyId.value='temperature';state.confirm();assert.equal(state.canConfirm.value,false);assert.equal(state.open.value,true)
    state.cancel();await pending
    const reference=state.pickSource({context,input:{id:'value'},purpose:'declaration'});await state.selectObject('D1');await flush()
    assert.equal(state.inputUndeclared.value,false);assert.ok(method(state,'temperature'))
    state.chooseMethod(method(state,'temperature'))
    assert.deepEqual((await reference).declaration.semantics,{semanticId:'urn:temperature'})
  }finally{scope.stop()}
})

test('只有语义声明可选同语义数据，查看全部来源也不能绕过类型和语义',async()=>{
  const {scope,state}=fixture()
  try{
    const pending=state.pickSource({context,input:{id:'value',semantics:{semanticId:'urn:temperature'}}});await flush()
    assert.ok(method(state,'temperature'));assert.ok(method(state,'summary','temperature'));assert.equal(method(state,'summary','count'),undefined)
    state.showAllSources.value=true;await flush();assert.equal(method(state,'summary','count'),undefined)
    state.chooseMethod(method(state,'summary','temperature'));state.confirm()
    assert.deepEqual((await pending).declaration.semantics,{semanticId:'urn:temperature'})
    const invalid=state.pickSource({context,input:{id:'value',valueType:{type:'boolean'}},mapping:{kind:'property',thingType:'device',thingId:'D1',id:'temperature'}});await flush()
    assert.equal(state.method.value,undefined);assert.equal(state.canConfirm.value,false);assert.equal(state.items.value.length,0)
    state.propertyId.value='temperature';state.confirm();assert.equal(state.open.value,true)
    state.cancel();await invalid
  }finally{scope.stop()}
})
