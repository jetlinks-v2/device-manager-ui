import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { effectScope, nextTick } from 'vue'
import { loadMetricTestModule } from './metricTestModule.mjs'

const { useMetricSourcePicker } = await loadMetricTestModule('../views/device/metrics/useMetricSourcePicker.ts', {
  '../../../api/metricBusinessSources': 'export const loadMetricObjectTypes=async()=>[];export const queryMetricBusinessObjects=async()=>({data:[],total:0});',
  '../../../../api/metricBusinessSources': 'export const loadMetricEvents=async()=>[];export const loadMetricCommandServices=async()=>[];export const loadMetricCommands=async()=>[];',
  '../../../api/metricSources': `export const queryMetricDevices=()=>{throw new Error('must not enumerate devices')};
    export const loadMetricDevice=(...args)=>globalThis.__metricBuiltinDevice(...args);
    export const loadMetricProduct=async()=>[];export const loadMetricProductSources=async()=>({properties:[],events:[]});
    export const loadMetricProductName=async id=>id;
    export const loadMetricBuiltins=(...args)=>globalThis.__metricBuiltinApi(...args);
    export const loadMetricInheritedOutputs=async()=>[];
    export const queryMetricProducts=async()=>({data:[],total:0});`,
  './useMetricOutputSources': `export const useMetricOutputSources=()=>({loading:{value:false},error:{value:false},items:{value:[]}})`,
  '@jetlinks-web-core/components': `export const metricSourceSchema=schema=>schema`,
})
const { addSimulationSample, sampleInputs } = await loadMetricTestModule('../../../jetlinks-web-core/src/components/Metric/template/simulation.ts')
const { structureMetricTemplate } = await loadMetricTestModule('../../../jetlinks-web-core/src/components/Metric/template/structureExpressions.ts')
const { createMetricStarters, starterMessages } = await loadMetricTestModule('../views/metric/Template/starters.ts', {
  '@jetlinks-web-core/components': `export { structureMetricTemplate } from ${JSON.stringify(fileURLToPath(new URL('../../../jetlinks-web-core/src/components/Metric/template/structureExpressions.ts',import.meta.url)))}`,
})

test('object scope example preserves the backend real-engine fixture after structured conversion', async () => {
  const translate = key => key.split('.').reduce((value, part) => value[part], starterMessages.zh)
  const fixture = createMetricStarters(translate).find(item => item.id === 'fleetConnections')
  const snapshot = JSON.parse(await readFile(new URL('../../../../modules/jetlinks-components/things-component/src/test/resources/metric-scenarios/object-builtin-counts.json', import.meta.url), 'utf8'))
  snapshot.template = structureMetricTemplate(snapshot.template).template
  assert.deepEqual(JSON.parse(JSON.stringify({ template:fixture.template, ...fixture.simulation })), snapshot)
})

test('object builtin selection restores scope and commits without enumerating devices', async () => {
  const scope = effectScope()
  const state = scope.run(useMetricSourcePicker)
  const calls = []
  globalThis.__metricBuiltinApi = async (...args) => { calls.push(args); return [{id:'deviceCount',name:'设备总数',supportsChildren:true}] }
  try {
    const pending = state.pickSource({ context:{ownerType:'space',ownerId:'workshop',label:'车间'}, input:{id:'count'},
      mapping:{kind:'builtin',thingType:'space',thingId:'workshop',id:'deviceCount',includeChildren:true} })
    await nextTick()
    assert.equal(state.choosingObject.value,false)
    assert.equal(state.ownerBuiltin.value,true)
    assert.equal(state.includeChildren.value,true)
    assert.deepEqual(calls,[['space','workshop']])
    assert.equal(state.canConfirm.value,true)
    state.confirm()
    assert.deepEqual((await pending).mapping,{kind:'builtin',thingType:'space',thingId:'workshop',id:'deviceCount',includeChildren:true})
  } finally { scope.stop() }
})

test('reopening a builtin binding preserves its source object instead of changing it to the owner', async () => {
  const scope = effectScope()
  const state = scope.run(useMetricSourcePicker)
  const calls = []
  globalThis.__metricBuiltinApi = async (...args) => { calls.push(args); return [{id:'deviceCount',name:'设备总数',supportsChildren:true}] }
  try {
    const pending = state.pickSource({ context:{ownerType:'space',ownerId:'workshop',label:'车间'}, input:{id:'count'},
      mapping:{kind:'builtin',thingType:'deviceGroup',thingId:'production-line',id:'deviceCount',includeChildren:true} })
    await nextTick()
    assert.deepEqual(calls,[['deviceGroup','production-line']])
    state.confirm()
    assert.deepEqual((await pending).mapping,{kind:'builtin',thingType:'deviceGroup',thingId:'production-line',id:'deviceCount',includeChildren:true})
  } finally { scope.stop() }
})

test('builtin history is unavailable and failed metadata never becomes a zero or selectable source', async () => {
  const scope = effectScope()
  const state = scope.run(useMetricSourcePicker)
  try {
    globalThis.__metricBuiltinApi = async () => [{id:'deviceCount',name:'设备总数',supportsChildren:false}]
    const pending = state.pickSource({ context:{ownerType:'product',ownerId:'p'}, input:{id:'count',source:{lookback:'PT1H'}},
      mapping:{kind:'builtin',id:'deviceCount'} })
    await nextTick()
    assert.equal(state.historyInput.value,true)
    assert.equal(state.canConfirm.value,false)
    globalThis.__metricBuiltinApi = async () => {throw new Error('denied')}
    await state.loadBuiltins()
    assert.equal(state.builtinError.value,true)
    assert.equal(state.canConfirm.value,false)
    state.cancel()
    assert.equal(await pending,undefined)
  } finally { scope.stop() }
})

test('simulation isolates builtin snapshots from identically named properties and descendant scopes', () => {
  const template={inputDefinitions:[{id:'count'}]}
  const facts={configuration:{targetType:'space',targetId:'workshop',inputMappings:{count:{kind:'builtin',id:'deviceCount',includeChildren:true}}},samples:[]}
  const next=addSimulationSample(template,facts,'count',1000)
  const sample=next.samples[0]
  assert.equal(sample.sourceKind,'builtin')
  assert.equal(sample.includeChildren,true)
  assert.deepEqual(sampleInputs(template,next,sample),['count'])
  assert.deepEqual(sampleInputs(template,next,{...sample,sourceKind:'property'}),[])
  assert.deepEqual(sampleInputs(template,next,{...sample,includeChildren:false}),[])
})

test('device alarm builtins retain their types and online history remains a property source', async () => {
  const scope = effectScope()
  const state = scope.run(useMetricSourcePicker)
  const calls = []
  globalThis.__metricBuiltinDevice = async id => ({device:{id,name:'水泵'},properties:[{id:'$online',name:'在线状态',platform:true,history:true,valueType:{type:'int'}}]})
  globalThis.__metricBuiltinApi = async (...args) => {
    calls.push(args)
    return [
      {id:'alarmActive',name:'是否告警中',valueType:'boolean',supportsChildren:false},
      {id:'longestAlarmDuration',name:'最长当前告警时长',valueType:'double',unit:'s',supportsChildren:false},
    ]
  }
  try {
    let pending = state.pickSource({context:{ownerType:'device',ownerId:'pump',label:'水泵'},input:{id:'alarm'},
      mapping:{kind:'builtin',thingType:'device',thingId:'pump',id:'alarmActive'}})
    await nextTick()
    assert.deepEqual(calls,[['device','pump']])
    assert.equal(state.builtins.value[0].valueType,'boolean')
    assert.equal(state.canConfirm.value,true)
    state.confirm()
    assert.deepEqual((await pending).mapping,{kind:'builtin',thingType:'device',thingId:'pump',id:'alarmActive',includeChildren:false})

    pending = state.pickSource({context:{ownerType:'device',ownerId:'pump'},input:{id:'state',source:{lookback:'PT1H'}},
      mapping:{kind:'property',thingType:'device',thingId:'pump',id:'$online'}})
    await nextTick()
    assert.equal(state.canConfirm.value,true)
    state.propertyId.value='longestAlarmDuration'
    assert.equal(state.canConfirm.value,false)
    state.propertyId.value='$online'
    state.confirm('在线状态')
    assert.deepEqual((await pending).mapping,{kind:'property',thingType:'device',thingId:'pump',id:'$online'})
  } finally { scope.stop() }
})
