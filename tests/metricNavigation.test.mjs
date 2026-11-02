import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule as load } from './metricTestModule.mjs'
import { effectScope, nextTick, ref } from 'vue'

const api = await load('../api/metricNavigation.ts', {
  './instance': 'export const query=(q)=>globalThis.__metricNav.device(q)',
  './product': 'export const queryProductList=(q)=>globalThis.__metricNav.product(q)',
  '@jetlinks-web/core': 'export const request={post:(...args)=>globalThis.__metricNav.request(...args)}',
})
const { useMetricNavigator, findMetricNode, filterMetricTree } = await load('../views/device/metrics/navigation/useMetricNavigator.ts')
const flush = async () => { await nextTick(); await new Promise(resolve => setImmediate(resolve)); await nextTick() }
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b}); return {promise,resolve,reject} }

test('device and product queries stay paged; exact IDs replace keyword search', async () => {
  const calls = []
  globalThis.__metricNav = Object.fromEntries(['device', 'product'].map(type => [type, async q => { calls.push(q); return { status: 200, result: { data: [{id:'allowed',name:'授权对象'}],total:41 } } }]))
  for (const type of ['device', 'product']) {
    const result = await api.queryMetricOwnerPage(type, ' meter ', 2)
    assert.deepEqual(result, { data: [{ ownerId:'allowed', label:'授权对象' }], total:41 })
    assert.deepEqual(calls.at(-1), { pageIndex:2,pageSize:20,sorts:[{name:'name',order:'asc'}],terms:[{column:'name',termType:'like',value:'%meter%'}] })
    await api.queryMetricOwnerPage(type, 'ignored', 0, 'route-id')
    assert.deepEqual(calls.at(-1).terms,[{column:'id',termType:'eq',value:'route-id'}])
    globalThis.__metricNav[type] = async () => ({success:false,message:'denied'})
    await assert.rejects(api.queryMetricOwnerPage(type,'',0),/denied/)
  }
})

test('group tree uses authorized ordinary query and keeps hierarchy without fetching counts', async () => {
  let request
  globalThis.__metricNav = { request: async (...args) => { request=args; return {status:200,result:{data:[{id:'child',name:'子组',parentId:'parent'},{id:'parent',name:'父组'}]}} } }
  const tree = await api.queryMetricGroupTree()
  assert.equal(request[0],'/device/group/_query')
  assert.equal(request[1].paging,false)
  assert.deepEqual(tree.data,[{ownerId:'parent',label:'父组',children:[{ownerId:'child',label:'子组'}]}])
  assert.equal(findMetricNode(tree.data,'child').label,'子组')
  assert.deepEqual(filterMetricTree(tree.data,'子'),tree.data)
  assert.deepEqual(filterMetricTree(tree.data,'absent'),[])
  globalThis.__metricNav.request=async()=>({status:403,message:'not allowed'})
  await assert.rejects(api.queryMetricGroupTree(),/not allowed/)
})

test('empty accessible sets remain empty and unnamed objects use authorized IDs',async()=>{
  let body
  globalThis.__metricNav={device:async q=>{body=q;return {result:{data:[{id:'device-no-name'}]}}},product:async()=>({result:{}}),request:async()=>({result:{data:[{id:'orphan',parentId:'hidden-parent'},{id:'self',parentId:'self'}]}})}
  assert.deepEqual(await api.queryMetricOwnerPage('device','  ',0),{data:[{ownerId:'device-no-name',label:'device-no-name'}],total:0})
  assert.deepEqual(body.terms,[])
  assert.deepEqual(await api.queryMetricOwnerPage('product','',0),{data:[],total:0})
  assert.deepEqual((await api.queryMetricGroupTree()).data,[{ownerId:'orphan',label:'orphan'},{ownerId:'self',label:'self'}])
  globalThis.__metricNav.request=async()=>({})
  assert.deepEqual(await api.queryMetricGroupTree(),{data:[],total:0})
})

test('route ID must resolve from authorized results; failure can retry the same ID', async () => {
  const scope=effectScope(), selected=ref('not-allowed'), emitted=[]
  let fail=false
  const state=scope.run(()=>useMetricNavigator(async (_keyword,_page,id)=> {
    if(fail) throw new Error('network')
    return {data:id==='allowed'?[{ownerId:'allowed',label:'Fresh label'}]:[],total:0}
  }, selected, value=>emitted.push(value)))
  await flush()
  assert.equal(emitted.at(-1),undefined)
  selected.value='allowed'; await flush()
  assert.equal(emitted.at(-1).label,'Fresh label')
  fail=true; await state.retry(); await flush()
  assert.equal(state.error.value,true)
  assert.equal(emitted.at(-1),undefined)
  fail=false; await state.retry(); await flush()
  assert.equal(emitted.at(-1).ownerId,'allowed')
  assert.equal(state.error.value,false)
  scope.stop()
})

test('owner changes and disposal cancel old validation; page failures do not masquerade as empty results', async () => {
  const first=deferred(),second=deferred(), scope=effectScope(),selected=ref('a'),emitted=[]
  let page=0
  const state=scope.run(()=>useMetricNavigator(async (_keyword,_page,id)=> {
    if(id==='a') return first.promise
    if(id==='b') return second.promise
    page++
    if(page>1) throw new Error('page failed')
    return {data:[{ownerId:'page',label:'Page'}],total:45}
  },selected,value=>emitted.push(value)))
  selected.value='b'; await flush()
  second.resolve({data:[{ownerId:'b',label:'B'}],total:1}); await flush()
  first.resolve({data:[{ownerId:'a',label:'A'}],total:1}); await flush()
  assert.equal(emitted.at(-1).ownerId,'b')
  await state.changePage(2)
  assert.equal(state.page.value,2)
  assert.equal(state.error.value,true)
  assert.equal(state.nodes.value[0].ownerId,'page')
  assert.equal(emitted.at(-1).ownerId,'b')
  assert.equal(state.select('fake'),false)
  assert.equal(state.select('page'),false)
  page=0; await state.search()
  assert.equal(state.select('page'),true)
  assert.equal(emitted.at(-1).ownerId,'page')
  const before=emitted.length
  selected.value='a'; await nextTick(); scope.stop(); await flush()
  assert.equal(emitted.length,before)
})

test('tree initialization reuses its authorized load; local search preserves ancestors without another request',async()=>{
  const scope=effectScope(),selected=ref('child'),emitted=[],pending=deferred();let calls=0
  const state=scope.run(()=>useMetricNavigator(async()=>{calls++;return pending.promise},selected,value=>emitted.push(value),true))
  pending.resolve({data:[{ownerId:'parent',label:'Parent',children:[{ownerId:'child',label:'Child'}]}],total:2});await flush()
  assert.equal(calls,1)
  state.keyword.value='child';await state.search()
  assert.equal(calls,1)
  assert.equal(state.visibleNodes.value[0].ownerId,'parent')
  assert.equal(emitted.at(-1).ownerId,'child')
  scope.stop()
})

test('failed selected ID remains retryable after parent clears the invalid confirmation',async()=>{
  const scope=effectScope(),selected=ref('device-30');let fail=true
  const emitted=[]
  const state=scope.run(()=>useMetricNavigator(async (_word,_page,id)=>{if(id&&fail)throw Error('failed');return {data:id?[{ownerId:id,label:'Fresh'}]:[],total:0}},selected,value=>{emitted.push(value);if(!value)selected.value=undefined}))
  await flush();assert.equal(state.error.value,true)
  fail=false;await state.retry();await flush()
  assert.equal(emitted.at(-1).ownerId,'device-30')
  scope.stop()
})
