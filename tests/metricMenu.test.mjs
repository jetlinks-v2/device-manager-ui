import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'
const mocks={'@jetlinks-web-core/locales':'export default {global:{t:key=>key}}'}
const { metricMenuCatalog }=await loadMetricTestModule('../metricMenu.ts',mocks)
const {default:deviceMenu}=await loadMetricTestModule('../baseMenu.ts',mocks)
const {default:ruleMenu}=await loadMetricTestModule('../../rule-engine-manager-ui/baseMenu.ts',mocks)
const {mergeModuleMenuCatalog,reconcileAuthorizedMenuLayout}=await loadMetricTestModule('../../../jetlinks-web-core/src/utils/module-menu-layout.ts')
const flatten=menus=>menus.flatMap(item=>[item,...flatten(item.children||[])])
test('menu migration preserves template identity, old URL and independent permissions; rule module is optional',()=>{
  const original=[{code:'resources-devices',children:[{code:'device/Instance',buttons:[{id:'view',permissions:[{permission:'device-instance',actions:['query']}]}]}]}]
  const once=metricMenuCatalog(original),twice=metricMenuCatalog(once)
  assert.deepEqual(twice,once)
  assert.equal(flatten(once).filter(item=>item.code==='device/MetricTemplate').length,1)
  const parent=once.find(item=>item.code==='rule-engine')
  assert.equal(parent.id,'91aa7c753b1c030dfad612aa0a45d453')
  assert.equal(parent.name,'DeviceMetrics.ruleAndCalculation')
  const template=flatten(once).find(item=>item.code==='device/MetricTemplate')
  assert.equal(template.id,'device-metric-template')
  assert.equal(template.url,'/resources/devices/metric-templates')
  assert.equal(template.options.routeTarget,'rule-engine')
  assert.deepEqual(template.buttons.find(button=>button.id==='save').permissions,[{permission:'metric-template',actions:['query','save','delete']}])
  const workspace=flatten(once).find(item=>item.code==='device/Metric')
  assert.ok(workspace)
  assert.equal(workspace.options.routeTarget,'rule-engine')
  assert.ok(workspace.buttons.every(button=>button.permissions.every(permission=>!permission.permission.startsWith('rule-'))))
  assert.equal(original.length,1)
  assert.equal(original[0].children[0].buttons[0].permissions.length,1)
})

test('actual catalogs merge one rules group and reconcile only authorized leaves without granting new ones',()=>{
  const catalog=mergeModuleMenuCatalog([...ruleMenu(),...deviceMenu()])
  assert.equal(catalog.filter(item=>item.code==='rule-engine').length,1)
  const legacy={code:'resources-devices',name:'设备',url:'/resources/devices',owner:'iot',children:[{code:'device/MetricTemplate',id:'device-metric-template',name:'模板',url:'/resources/devices/metric-templates',buttons:[{id:'view',permissions:[{permission:'metric-template',actions:['query']}]}]}]}
  const result=reconcileAuthorizedMenuLayout([legacy],catalog)
  assert.deepEqual(result.issues,[])
  assert.equal(result.menus.find(item=>item.code==='rule-engine').children[0].code,'device/MetricTemplate')
  assert.equal(flatten(result.menus).filter(item=>item.code==='device/Metric').length,0)
  const old={...legacy,code:'rule-engine',id:'91aa7c753b1c030dfad612aa0a45d453',name:'规则引擎'}
  assert.equal(reconcileAuthorizedMenuLayout([old],catalog).menus.find(item=>item.code==='rule-engine').name,'IotSceneLinkage.metric.ruleAndCalculation')
  assert.equal(reconcileAuthorizedMenuLayout([{...old,name:'自定义规则'}],catalog).menus.find(item=>item.code==='rule-engine').name,'自定义规则')
  const withoutRule=mergeModuleMenuCatalog(deviceMenu())
  assert.equal(reconcileAuthorizedMenuLayout([legacy],withoutRule).menus.find(item=>item.code==='rule-engine').children[0].code,'device/MetricTemplate')
})
