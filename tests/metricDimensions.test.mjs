import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'
import { loadMetricTestModule } from './metricTestModule.mjs'
const store='export const useAuthStore=()=>globalThis.__metricHost.auth;export const useMenuStore=()=>globalThis.__metricHost.menu'
const mocks={
  '@jetlinks-web-core/locales':'export default {global:{t:key=>key}}',
  '@jetlinks-web-core/store':store,
  './api/metricNavigation':'export const queryMetricGroupTree=async()=>({data:[],total:0});export const queryMetricOwnerPage=async()=>({data:[],total:0});export const resolveMetricObjects=async()=>[]',
  './views/device/metrics/useMetricSourceAdapter':'export const useMetricSourceAdapter=()=>({pickSource:async()=>undefined})',
}
const {default:device}=await loadMetricTestModule('../metricDimensions.ts',mocks)
const {default:space}=await loadMetricTestModule('../../jetlinks-space-ui/metricDimensions.ts',{
  '@jetlinks-web-core/locales':mocks['@jetlinks-web-core/locales'], '@jetlinks-web-core/store':store,
  '@jetlinks-web-core/utils/module-registry':'export const moduleRegistry={getResourceItem:(...args)=>globalThis.__metricHost.resource(...args)}',
  './metricNavigation':'export const queryMetricSpaceTree=async()=>({data:[],total:0})',
})
const allowed=new Set(),menus=new Set()
globalThis.__metricHost={auth:{hasPermission:codes=>(Array.isArray(codes)?codes:[codes]).some(code=>allowed.has(code))},menu:{hasMenu:code=>menus.has(code),getMenu:code=>menus.has(code)?{routeName:`project/${code}`}:undefined},resource:()=>undefined}

test('business modules register recognizable dimension icons',()=>{
  assert.equal(device.device.icon,'DesktopOutlined')
  assert.equal(device.deviceGroup.icon,'FolderOutlined')
  assert.equal(device.product.icon,'AppstoreOutlined')
  assert.equal(space.space.icon,'EnvironmentOutlined')
})

test('four dimensions reuse business maintenance rights independently of rule permissions',()=>{
  for(const provider of [...Object.values(device),space.space]) assert.equal(provider.available(),false)
  for(const code of ['iot-user-device-list','device/Product','space/Situation']) {allowed.add(`${code}:view`);menus.add(code);menus.add(`${code}/Detail`)}
  globalThis.__metricHost.resource=(_module,type)=>type==='hooks'?()=>({pickSource:async()=>undefined}):{name:'Navigator'}
  for(const provider of [...Object.values(device),space.space]) {
    assert.equal(provider.available(),true)
    assert.equal(provider.canEdit({ownerId:'id',label:'label'}),false)
    assert.ok(typeof provider.label()==='string')
  }
  allowed.add('iot-user-device-list:update');allowed.add('device/Product:update');allowed.add('space/Situation:metricSave')
  for(const provider of [...Object.values(device),space.space]) assert.equal(provider.canEdit({ownerId:'id',label:'label'}),true)
  assert.equal(device.device.toBusiness({ownerId:'d',label:'D'}).name,'project/iot-user-device-list/Detail')
  assert.deepEqual(device.deviceGroup.toBusiness({ownerId:'g',label:'G'}).query,{scopeType:'group',scopeId:'g',metricView:'metrics'})
  assert.deepEqual(device.product.toBusiness({ownerId:'p',label:'P'}).params,{id:'p'})
  assert.deepEqual(space.space.toBusiness({ownerId:'s',label:'S'}).query,{spaceId:'s',metricView:'metrics'})
  globalThis.__metricHost.resource=()=>undefined
  assert.equal(space.space.available(),false)
  allowed.clear();menus.clear()
})

test('each dimension requires both its business menu and view permission',()=>{
  for(const code of ['iot-user-device-list','device/Product','space/Situation']) allowed.add(`${code}:view`)
  globalThis.__metricHost.resource=(_module,type)=>type==='hooks'?()=>({pickSource:async()=>undefined}):{name:'Navigator'}
  for(const provider of [...Object.values(device),space.space]) {
    assert.equal(provider.available(),false)
    assert.equal(provider.toBusiness({ownerId:'id',label:'Object'}),undefined)
  }
  allowed.clear()
  for(const code of ['iot-user-device-list','device/Product','space/Situation']) menus.add(code)
  for(const provider of [...Object.values(device),space.space]) assert.equal(provider.available(),false)
  menus.clear()
})

test('device menu aliases cannot combine a menu from one code with permissions from another',()=>{
  menus.add('iot-user-device-list');allowed.add('device/Instance:view')
  assert.equal(device.device.available(),false)
  assert.equal(device.deviceGroup.available(),false)
  allowed.add('iot-user-device-list:view')
  assert.equal(device.device.available(),true)
  assert.equal(device.deviceGroup.available(),true)
  menus.delete('iot-user-device-list')
  assert.equal(device.device.available(),false)
  assert.equal(device.deviceGroup.available(),false)
  allowed.clear();menus.clear()
})

const {useMetricLinks}=await loadMetricTestModule('../views/device/metrics/useMetricLinks.ts',{
  '@jetlinks-web-core/store':store,
  'vue-router':'export const useRoute=()=>globalThis.__metricLinks.route;export const useRouter=()=>({resolve:to=>({fullPath:JSON.stringify(to)})})',
})
test('cross-entry navigation keeps exact IDs and requires its authorized menu',()=>{
  const calls=[]
  globalThis.__metricLinks={route:{path:'/business',hash:'',query:{projectId:'p'}}}
  globalThis.__metricHost.menu.jumpPage=(...args)=>calls.push(args)
  const links=useMetricLinks(), reference={ownerType:'deviceGroup',ownerId:'g',configId:'config-2',outputId:'output-2'}
  links.openWorkspace(reference)
  assert.equal(calls.length,0)
  menus.add('device/Metric');allowed.add('device/Metric:view')
  useMetricLinks().openWorkspace(reference)
  assert.deepEqual(calls[0],['device/Metric',{query:{projectId:'p',metricOwnerType:'deviceGroup',metricOwnerId:'g',metricConfigId:'config-2',metricOutputId:'output-2'}}])
  allowed.clear();menus.clear()
})

const {useMetricSourceAdapter}=await loadMetricTestModule('../views/device/metrics/useMetricSourceAdapter.ts',{
  '../../../api/metricBusinessSources': 'export const loadMetricObjectTypes=async()=>[];export const queryMetricBusinessObjects=async()=>({data:[],total:0});',
  '../../../../api/metricBusinessSources': 'export const loadMetricEvents=async()=>[];export const loadMetricCommandServices=async()=>[];export const loadMetricCommands=async()=>[];',
  'vue-i18n':'import {ref} from "vue";export const useI18n=()=>({t:key=>key.replace(/^metricSources\\./,""),mergeLocaleMessage:()=>{},locale:ref("zh")})',
  '../../../api/metricSources':`export const queryMetricDevices=async()=>({data:[],total:0});export const loadMetricDevice=async id=>({device:{id,name:id},properties:[{id:"$online",name:"在线状态",platform:true,history:true}]});export const loadMetricProduct=async()=>[{id:"power",name:"Power"},{id:"$online",name:"在线状态",platform:true,history:true}];export const loadMetricBuiltins=async()=>[];
    const item={config:{id:"source",name:"Temperature",state:"enabled",scope:"single",targetType:"device",targetId:"d1"},template:{id:"t",version:"1",name:"Temperature",options:{},inputDefinitions:[],parameterDefinitions:[],definitions:[],outputs:[{metricId:"average",label:"Average",persist:true,unit:"℃"}]},output:{metricId:"average",label:"Average",persist:true,unit:"℃"}};
    export const loadMetricOutputs=async()=>[item];export const loadMetricOutput=async()=>item;export const loadMetricProductSources=async id=>({properties:await loadMetricProduct(id),events:[]});export const describeMetricProvider=async()=>({});export const readMetricProvider=async()=>undefined;
    export const loadMetricInheritedOutputs=async()=>[];export const loadMetricProductName=async id=>id;export const queryMetricProducts=async()=>({data:[],total:0});`,
})
test('inline source selection reuses the device model and does not open a second modal',async()=>{
  const scope=effectScope(), context=ref({ownerType:'device',ownerId:'d1'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  const state=adapter.pickSource.editor.setup()().props.state
  try {
    const pending=adapter.pickSource({context:context.value,input:{id:'running'},inline:true})
    await new Promise(resolve=>setImmediate(resolve));await nextTick()
    assert.equal(adapter.host.setup()(),null)
    assert.equal(state.deviceId.value,'d1')
    assert.equal(state.propertyLoading.value,false)
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.id === '$online'));state.confirm()
    assert.equal((await pending).mapping.thingId,'d1')
  } finally {scope.stop()}
})
test('source descriptions resolve business names and report a removed property explicitly',async()=>{
  const scope=effectScope(), context=ref({ownerType:'product',ownerId:'pumps',scope:'children'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  try {
    const descriptions=await adapter.pickSource.describe(context.value,{
      power:{kind:'property',id:'power'},missing:{kind:'property',id:'removed'},online:{kind:'property',id:'$online'},external:{kind:'metric',id:'other'}
    })
    assert.equal(descriptions.power.label,'currentDevice / Power')
    assert.equal(descriptions.missing.error,'sourceMissing')
    assert.equal(descriptions.online.label,'currentDevice / online')
    assert.equal(descriptions.external.error,'unsupported')
  } finally {scope.stop()}
})

test('same-object context refresh keeps inline source selection while changing owner cancels it',async()=>{
  const scope=effectScope(),context=ref({ownerType:'device',ownerId:'d1',label:'Device'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  const state=adapter.pickSource.editor.setup()().props.state
  try {
    const pending=adapter.pickSource({context:context.value,input:{id:'power'},inline:true})
    await flushSource()
    context.value={...context.value,label:'Renamed device'}
    await nextTick()
    assert.equal(state.open.value,true)
    assert.equal(state.deviceId.value,'d1')
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind === 'builtin'))
    context.value={...context.value}
    await nextTick()
    assert.equal(state.category.value,'builtin')
    assert.equal(state.open.value,true)
    context.value={ownerType:'device',ownerId:'d2',label:'Other device'}
    await nextTick()
    assert.equal(await pending,undefined)
    assert.equal(state.open.value,false)
  } finally {scope.stop()}
})

test('existing metrics bind public outputs, exclude self and recover authorized names',async()=>{
  const scope=effectScope(),context=ref({ownerType:'device',ownerId:'d1',targetType:'device',targetId:'d1'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  const state=adapter.pickSource.editor.setup()().props.state
  try {
    const pending=adapter.pickSource({context:context.value,configId:'dependent',input:{id:'value'},inline:true})
    await flushSource()
    assert.equal(state.choosingObject.value,false)
    state.metricsExpanded.value=true;await flushSource()
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.kind === 'metric'))
    assert.equal(state.metricSources.items.value.length,1)
    const item=state.metricSources.items.value[0]
    state.confirmMetric(item,'d1 / Average')
    assert.deepEqual((await pending).mapping,{kind:'metric',configId:'source',thingType:'device',thingId:'d1',id:'average'})
    const descriptions=await adapter.pickSource.describe(context.value,{value:{kind:'metric',configId:'source',thingType:'device',thingId:'d1',id:'average'}})
    assert.equal(descriptions.value.label,'Temperature / Average')
    const self=adapter.pickSource({context:context.value,configId:'source',input:{id:'value',source:{kind:'metric'}},inline:true})
    await flushSource()
    assert.equal(state.metricSources.items.value.length,0)
    state.cancel();await self
  } finally {scope.stop()}
})
const flushSource=async()=>{await new Promise(resolve=>setImmediate(resolve));await nextTick()}
test('product inheritance picks the current member property without fixing a device ID',async()=>{
  const scope=effectScope(),context=ref({ownerType:'product',ownerId:'pumps'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  const state=adapter.host.setup()().props.state
  try {
    const pending=adapter.pickSource({context:{...context.value,scope:'children'},input:{id:'reading'}})
    await new Promise(resolve=>setImmediate(resolve));await nextTick()
    assert.equal(state.inherited.value,true)
    assert.deepEqual(state.devices.value,[])
    assert.equal(state.deviceId.value,'')
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.id === 'power'))
    assert.equal(state.canConfirm.value,true)
    state.confirm()
    assert.deepEqual((await pending).mapping,{kind:'property',thingType:'device',id:'power'})
  } finally {scope.stop()}
})
test('public source adapter owns its modal and cancels pending selection when owner changes or unmounts',async()=>{
  const scope=effectScope(),context=ref({ownerType:'space',ownerId:'s1'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  const state=adapter.host.setup()().props.state
  const first=adapter.pickSource({context:context.value,input:{id:'power'}})
  assert.equal(state.open.value,true)
  context.value={ownerType:'space',ownerId:'s2'};await nextTick()
  assert.equal(await first,undefined)
  assert.equal(state.open.value,false)
  const second=adapter.pickSource({context:context.value,input:{id:'power'}})
  scope.stop()
  assert.equal(await second,undefined)
})

test('source confirmation keeps the visible built-in name and stable mapping ID',async()=>{
  const scope=effectScope(),context=ref({ownerType:'device',ownerId:'d1'})
  const adapter=scope.run(()=>useMetricSourceAdapter(context))
  const state=adapter.host.setup()().props.state
  try {
    const pending=adapter.pickSource({context:context.value,input:{id:'running'}})
    await state.selectDevice('d1')
    state.selectMethod(state.items.value.flatMap(item=>item.methods).find(item=>item.id === '$online'))
    state.confirm()
    const selection=await pending
    assert.equal(selection.label,'d1 / 在线状态')
    assert.equal(selection.mapping.id,'$online')
    assert.equal(selection.mapping.thingId,'d1')
  } finally {scope.stop()}
})
