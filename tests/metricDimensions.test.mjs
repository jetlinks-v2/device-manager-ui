import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'
const store='export const useAuthStore=()=>globalThis.__metricHost.auth;export const useMenuStore=()=>globalThis.__metricHost.menu'
const mocks={
  '@jetlinks-web-core/locales':'export default {global:{t:key=>key}}',
  '@jetlinks-web-core/store':store,
  './api/metricNavigation':'export const queryMetricGroupTree=async()=>({data:[],total:0});export const queryMetricOwnerPage=async()=>({data:[],total:0});export const resolveMetricObjects=async()=>[]',
  '@rule-engine-manager-ui/metric':'export const useMetricSourceAdapter=()=>({pickSource:async()=>undefined})',
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
  assert.deepEqual(device.deviceGroup.readScopes().map(scope=>scope.memberType),['device','deviceGroup'])
  assert.equal(device.deviceGroup.readScopes()[0].label,'DeviceMetrics.devices')
  assert.equal(device.deviceGroup.readScopes()[1].label,'DeviceMetrics.descendantGroups')
  assert.equal(device.product.readScopes()[0].tree,undefined,'product membership does not declare a tree')
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
  menus.add('rule-engine/Metric');allowed.add('rule-engine/Metric:view')
  useMetricLinks().openWorkspace(reference)
  assert.deepEqual(calls[0],['rule-engine/Metric',{query:{projectId:'p',metricOwnerType:'deviceGroup',metricOwnerId:'g',metricConfigId:'config-2',metricOutputId:'output-2'}}])
  allowed.clear();menus.clear()
})
