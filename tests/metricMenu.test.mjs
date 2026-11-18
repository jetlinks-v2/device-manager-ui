import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'
const mocks={'@jetlinks-web-core/locales':'export default {global:{t:key=>key}}'}
const { metricMenuCatalog }=await loadMetricTestModule('../metricMenu.ts',mocks)
const {default:deviceMenu}=await loadMetricTestModule('../baseMenu.ts',mocks)
const {default:ruleMenu}=await loadMetricTestModule('../../rule-engine-manager-ui/baseMenu.ts',mocks)
const flatten=menus=>menus.flatMap(item=>[item,...flatten(item.children||[])])

test('device menus only declare permissions for their own detail entry points',()=>{
  const original=[{code:'device/Instance',buttons:[{id:'view',permissions:[{permission:'device-instance',actions:['query']}]}]}]
  const once=metricMenuCatalog(original)
  assert.deepEqual(metricMenuCatalog(once),once)
  assert.equal(original[0].buttons[0].permissions.length,1)
  assert.ok(once[0].buttons[0].permissions.some(item=>item.permission==='metric-config'))
  assert.ok(!flatten(deviceMenu()).some(item=>['rule-engine/Metric','rule-engine/MetricTemplate'].includes(item.code)))
})

test('rule module owns metric management and template routes with separate permissions',()=>{
  const catalog=flatten(ruleMenu())
  for(const [code,url,resource] of [
    ['rule-engine/Metric','/rule-engine/metrics','metric-config'],
    ['rule-engine/MetricTemplate','/rule-engine/metric-templates','metric-template'],
  ]) {
    const rows=catalog.filter(item=>item.code===code)
    assert.equal(rows.length,1)
    assert.equal(rows[0].url,url)
    assert.ok(rows[0].buttons.find(item=>item.id==='save').permissions.some(item=>item.permission===resource&&item.actions.includes('save')))
  }
})
