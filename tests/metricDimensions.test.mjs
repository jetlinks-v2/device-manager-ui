import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'
import { loadMetricTestModule } from './metricTestModule.mjs'
const store='export const useAuthStore=()=>globalThis.__metricHost.auth;export const useMenuStore=()=>globalThis.__metricHost.menu'
const mocks={
  '@jetlinks-web-core/locales':'export default {global:{t:key=>key}}',
  '@jetlinks-web-core/store':store,
  './api/metricNavigation':'export const queryMetricGroupTree=async()=>({data:[],total:0});export const queryMetricOwnerPage=async()=>({data:[],total:0})',
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

test('business destinations are optional when menus are absent, without revoking object viewing',()=>{
  for(const code of ['iot-user-device-list','device/Product','space/Situation']) allowed.add(`${code}:view`)
  globalThis.__metricHost.resource=(_module,type)=>type==='hooks'?()=>({pickSource:async()=>undefined}):{name:'Navigator'}
  for(const provider of [...Object.values(device),space.space]) {
    assert.equal(provider.available(),true)
    assert.equal(provider.toBusiness({ownerId:'id',label:'Object'}),undefined)
  }
  allowed.clear()
})

const {useMetricLinks}=await loadMetricTestModule('../views/device/metrics/useMetricLinks.ts',{
  '@jetlinks-web-core/store':store,
  'vue-router':'export const useRoute=()=>globalThis.__metricLinks.route;export const useRouter=()=>({resolve:to=>({fullPath:JSON.stringify(to)})})',
})
test('cross-entry and alarm navigation keep exact IDs and require their own authorized menus',()=>{
  const calls=[]
  globalThis.__metricLinks={route:{path:'/business',hash:'',query:{projectId:'p'}}}
  globalThis.__metricHost.menu.jumpPage=(...args)=>calls.push(args)
  const links=useMetricLinks(), reference={ownerType:'deviceGroup',ownerId:'g',configId:'config-2',outputId:'output-2'}
  links.openWorkspace(reference);links.createAlarm(reference)
  assert.equal(calls.length,0)
  menus.add('device/Metric');allowed.add('device/Metric:view')
  useMetricLinks().openWorkspace(reference)
  assert.deepEqual(calls[0],['device/Metric',{query:{projectId:'p',metricOwnerType:'deviceGroup',metricOwnerId:'g',metricConfigId:'config-2',metricOutputId:'output-2'}}])
  menus.add('rule-engine/Scene');allowed.add('rule-engine/Scene:add');allowed.add('rule-engine/Alarm/Configuration:update')
  // Auth/menu fixtures are plain sets; recreate computed state after changing the fixture.
  const enabled=useMetricLinks()
  enabled.createAlarm(reference)
  assert.equal(calls[1][0],'rule-engine/Scene/Editor')
  const returnTo=JSON.parse(calls[1][1].query.metricReturnTo)
  assert.equal(returnTo.query.metricConfigId,'config-2')
  assert.equal(returnTo.query.metricOutputId,'output-2')
  assert.equal(returnTo.query.scopeId,'g')
  allowed.clear();menus.clear()
})

const {useMetricSourceAdapter}=await loadMetricTestModule('../views/device/metrics/useMetricSourceAdapter.ts',{
  '../../../api/metricSources':'export const queryMetricDevices=async()=>({data:[],total:0});export const loadMetricDevice=async id=>({device:{id,name:id},properties:[]})',
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
