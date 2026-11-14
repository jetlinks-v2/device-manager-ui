import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'
const calls=[]
globalThis.__runtimeMetricPost=async(...args)=>{calls.push(args);return {status:200,result:[]}}
const api=await loadMetricTestModule('../runtimeMetrics.ts',{
  '@jetlinks-web/core':'export const request={post:(...args)=>globalThis.__runtimeMetricPost(...args)}',
})
test('catalog and aggregate query declared capabilities with explicit subjects and a bounded time window',async()=>{
  await api.deviceMetricsSupported('gateway')
  assert.deepEqual(calls.pop().slice(0,2),['/ontology/catalog/device/capabilities/metricCatalog/_query',{
    subjects:[{typeId:'device',id:'gateway'}],parameters:{},
  }])
  const query={thingIds:['gateway'],pointType:'health',metrics:[{pointId:'cpu',aggregation:'AVG',alias:'cpu'}],
    from:Date.parse('2026-11-14T00:00:00Z'),to:Date.parse('2026-11-14T01:00:00Z'),limit:30}
  await api.deviceMetricsAggregate(query)
  const [path,body]=calls.pop()
  assert.equal(path,'/ontology/catalog/device/capabilities/metrics/_query')
  assert.deepEqual(body.subjects,[{typeId:'device',id:'gateway'}])
  assert.equal(body.from,query.from);assert.equal(body.to,query.to)
  assert.equal(body.parameters.limit,30);assert.equal(body.parameters.thingIds,undefined)
  await assert.rejects(api.deviceMetricsAggregate({...query,thingIds:[]}),/Missing runtime device/)
})
