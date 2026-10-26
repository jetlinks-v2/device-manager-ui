import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
const raw = (sessions = 0, available = true) => ({ org: {}, 'org.jetlinks': { DeviceSessionManager: { one: {
  '@objectName': 'org.jetlinks:type=DeviceSessionManager,name=one',
  '@attributes': [{ name: 'Sessions', available, readable: true, type: 'long' }, { name: 'KeepOnlineSize', available: true, readable: true, type: 'long' }],
  Sessions: sessions, KeepOnlineSize: '0',
} } } })

function harness(ids = ['a'], loader = async () => raw(), retainOnPause = false, communicationLoader = async () => ({})) {
  const cache = new Map(), nodes = vue.ref(ids), enabled = vue.ref(true), scopeKey = vue.ref('alice'), discoveryScope = vue.ref('alice'), interval = vue.ref(3), calls = [], messageCalls = []
  const api = { queryDeviceMessageMBeans: (node, signal) => { messageCalls.push({ node, signal }); return communicationLoader(node, signal) }, querySessionMBeans: (node, signal) => { calls.push({ node, signal }); return loader(node, signal) } }
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return vue
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return {}
      if (id.endsWith('api/link/diagnostics')) return api
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports); cache.set(path, module.exports); return module.exports
  }
  const module = load(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/useClusterSessions.ts')), effect = vue.effectScope(), permitted = retainOnPause ? vue.ref(true) : enabled
  return { ...effect.run(() => module.useClusterSessions(nodes, enabled, scopeKey, discoveryScope, permitted, interval)), effect, permitted, nodes, enabled, scopeKey, discoveryScope, interval, calls, messageCalls, api }
}

test('session discovery confirms exact MBeans including zero, projects only available values, and bounds concurrency', async () => {
  const pending = new Map(), h = harness(['a', 'b', 'c', 'd'], node => new Promise(done => pending.set(node, done)))
  try {
    assert.deepEqual(h.calls.map(call => call.node), ['a', 'b', 'c'])
    pending.get('a')(raw(0)); await flush(); assert.equal(h.calls.at(-1).node, 'd')
    pending.get('b')(raw(1, false)); pending.get('c')({ 'org.jetlinks': {} }); pending.get('d')(raw(2)); await flush()
    assert.equal(h.snapshots.value.get('a').supported, true); assert.equal(h.snapshots.value.get('a').sessions, '0')
    assert.equal(h.snapshots.value.get('b').sessions, undefined)
    assert.equal(h.snapshots.value.get('c').supported, false)
  } finally { h.effect.stop() }
})

test('session discovery isolates removals and clears confirmed denial while retaining transient stale evidence', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  let attempt = 0
  const h = harness(['a'], async () => {
    attempt++
    if (attempt === 1) return raw(4)
    if (attempt === 2) throw new Error('offline')
    throw { status: 403 }
  })
  try {
    await flush(); const sampledAt = h.snapshots.value.get('a').state.sampledAt
    t.mock.timers.tick(30000); await flush()
    assert.equal(h.snapshots.value.get('a').state.status, 'stale'); assert.equal(h.snapshots.value.get('a').sessions, '4')
    t.mock.timers.tick(30000); await flush()
    assert.equal(h.snapshots.value.get('a').state.status, 'forbidden'); assert.equal(h.snapshots.value.get('a').supported, undefined)
    assert.ok(sampledAt)
    h.nodes.value = []; await flush(); assert.equal(h.snapshots.value.size, 0)
  } finally { h.effect.stop() }
})

test('late session responses cannot cross node, discovery, scope, or revoked-permission boundaries', async () => {
  const pending = [], h = harness(['a', 'b', 'c', 'd'], (node, signal) => new Promise(done => pending.push({ node, signal, done })))
  try {
    assert.deepEqual(h.calls.map(call => call.node), ['a', 'b', 'c'])
    h.nodes.value = ['b', 'c', 'd']; await flush()
    assert.equal(pending.find(item => item.node === 'a').signal.aborted, true)
    assert.equal(h.calls.at(-1).node, 'd', 'removing a blocked node immediately releases its concurrency slot')
    pending.find(item => item.node === 'a').done(raw(99)); await flush()
    assert.equal(h.snapshots.value.has('a'), false)

    h.scopeKey.value = 'bob'; await flush()
    assert.equal(h.snapshots.value.size, 0)
    for (const item of pending) item.done(raw(8))
    await flush(); assert.equal(h.snapshots.value.size, 0, 'old discovery responses cannot repopulate a new identity')

    h.discoveryScope.value = 'bob'; await flush()
    const current = pending.slice(-3)
    h.enabled.value = false; await flush()
    assert.ok(current.every(item => item.signal.aborted))
    current.forEach(item => item.done(raw(7))); await flush()
    assert.equal(h.snapshots.value.size, 0, 'revocation clears and rejects late sensitive evidence')
  } finally { h.effect.stop() }
})

test('a slow session sample completes before its 3-second successor begins and never overlaps itself', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const pending = [], h = harness(['a'], (node, signal) => new Promise(done => pending.push({ node, signal, done })))
  try {
    assert.equal(pending.length, 1)
    pending[0].done(raw(1)); await flush()
    t.mock.timers.tick(2999); await flush(); assert.equal(pending.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(pending.length, 2)
    t.mock.timers.tick(60000); await flush(); assert.equal(pending.length, 2, 'an unresolved successor cannot overlap with itself')
    pending[1].done(raw(2)); await flush()
    assert.equal(h.snapshots.value.get('a').sessions, '2')
  } finally { h.effect.stop() }
})


test('pausing preserves session evidence but replaces request identity before resume; permission loss clears it', async () => {
  const pending = [], h = harness(['a'], (node, signal) => new Promise(done => pending.push({ signal, done })), true)
  try {
    pending[0].done(raw(1)); await flush()
    h.refresh('a'); assert.equal(pending.length, 2)
    h.enabled.value = false; await flush()
    assert.equal(pending[1].signal.aborted, true); assert.equal(h.snapshots.value.get('a').sessions, '1')
    h.enabled.value = true; await flush(); assert.equal(pending.length, 3)
    pending[1].done(raw(99)); await flush(); assert.equal(h.snapshots.value.get('a').sessions, '1')
    pending[2].done(raw(2)); await flush(); assert.equal(h.snapshots.value.get('a').sessions, '2')
    h.permitted.value = false; await flush(); assert.equal(h.snapshots.value.size, 0)
  } finally { h.effect.stop() }
})


test('page-level session history records only real samples, gaps and exact long values within ten minutes', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  let value = '9223372036854775806', missing = false
  const h = harness(['a'], async () => missing ? raw(2, false) : raw(value), true)
  try {
    await flush(); assert.deepEqual(h.snapshots.value.get('a').history, [{ timestamp: 1000, value }])
    value = '9223372036854775807'; t.mock.timers.tick(30000); await flush()
    assert.equal(h.snapshots.value.get('a').history.at(-1).value, value)
    missing = true; t.mock.timers.tick(30000); await flush()
    assert.equal(h.snapshots.value.get('a').history.at(-1).value, undefined)
    missing = false; value = 0
    for (let i = 0; i < 25; i++) { t.mock.timers.tick(30000); await flush() }
    const history = h.snapshots.value.get('a').history
    assert.ok(history.length <= 21); assert.ok(history.every(point => point.timestamp >= Date.now() - 600000))
    assert.equal(history.at(-1).value, '0')
    h.enabled.value = false; await flush(); assert.equal(h.snapshots.value.get('a').history.at(-1).value, undefined)
    h.nodes.value = []; await flush(); assert.equal(h.snapshots.value.size, 0, 'removed nodes are cleared even while the page is paused')
  } finally { h.effect.stop() }
})


test('session interval changes reschedule from completion without clearing history or overlapping pending requests', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const pending = [], h = harness(['a'], () => new Promise(done => pending.push(done)))
  try {
    pending[0](raw(1)); await flush()
    t.mock.timers.tick(1000); h.interval.value = 10
    t.mock.timers.tick(8999); await flush(); assert.equal(pending.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(pending.length, 2)
    const first = h.snapshots.value.get('a').history[0]
    h.interval.value = 3; t.mock.timers.tick(20000); await flush()
    assert.equal(pending.length, 2); assert.equal(h.calls[1].signal.aborted, false)
    pending[1](raw(2)); await flush()
    assert.deepEqual(h.snapshots.value.get('a').history[0], first)
    t.mock.timers.tick(2999); await flush(); assert.equal(pending.length, 2)
    t.mock.timers.tick(1); await flush(); assert.equal(pending.length, 3)
    h.interval.value = 60; h.enabled.value = false
    pending[2](raw(99)); await flush()
    assert.equal(h.snapshots.value.size, 0, 'revocation still clears evidence with configurable scheduling')
  } finally { h.effect.stop() }
})

test('three-second session sampling retains the complete ten-minute observation window', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const h = harness()
  try {
    await flush()
    for (let index = 0; index < 205; index++) { t.mock.timers.tick(3000); await flush() }
    const history = h.snapshots.value.get('a').history
    assert.equal(history.length, 201)
    assert.equal(history.at(-1).timestamp - history[0].timestamp, 600000)
  } finally { h.effect.stop() }
})

test('confirmed session capability resets on absence or forbidden and recovers with a genuine zero sample', async () => {
  let response = raw('3'), denied = false
  const h = harness(['a'], async () => { if (denied) throw { status: 403 }; return response })
  try {
    await flush(); assert.equal(h.snapshots.value.get('a').supported, true)
    response = { 'other.domain': raw()['org.jetlinks'] }; h.refresh('a'); await flush()
    assert.equal(h.snapshots.value.get('a').supported, false); assert.equal(h.snapshots.value.get('a').history, undefined)
    denied = true; h.refresh('a'); await flush(); assert.equal(h.snapshots.value.get('a').supported, undefined)
    assert.equal(h.snapshots.value.get('a').sessions, undefined)
    denied = false; response = raw(0); h.refresh('a'); await flush()
    assert.equal(h.snapshots.value.get('a').supported, true); assert.equal(h.snapshots.value.get('a').sessions, '0')
    assert.equal(h.snapshots.value.get('a').history.length, 1)
  } finally { h.effect.stop() }
})

const messageRaw = (snapshot = 4000, total = '30', unavailable = []) => ({ 'org.jetlinks': { DeviceMessageMonitor: { DeviceMessageMonitor: {
 '@objectName': 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor',
 '@attributes': ['StartTime', 'SnapshotTime', 'ReceivedBytesTotal', 'SentBytesTotal', 'UpstreamMessagesTotal', 'PropertyReportsTotal', 'PropertyValuesTotal', 'EventReportsTotal', 'ReceivedPacketsTotal', 'SentPacketsTotal'].map(name => ({ name, available: !unavailable.includes(name) })),
 StartTime: 1000, SnapshotTime: snapshot, ReceivedBytesTotal: '3000', SentBytesTotal: '0', UpstreamMessagesTotal: total, PropertyReportsTotal: '6', PropertyValuesTotal: '12', EventReportsTotal: '3', ReceivedPacketsTotal: '30', SentPacketsTotal: '15',
} } } })

test('communication source runs after sessions within three real HTTP slots and waits after both reads complete', async t => {
 t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
 const sessionPending = [], messagePending = [], h = harness(['a','b','c','d'], node => new Promise(done => sessionPending.push({node,done})), false, node => new Promise(done => messagePending.push({node,done})))
 try {
  assert.equal(sessionPending.length,3); assert.equal(messagePending.length,0)
  sessionPending[0].done(raw(2)); await flush()
  assert.equal(messagePending.length,1); assert.equal(sessionPending.length,3,'communication retains its node HTTP slot')
  t.mock.timers.tick(60000); await flush(); assert.equal(messagePending.length,1)
  messagePending[0].done(messageRaw()); await flush(); assert.equal(sessionPending.length,4)
  assert.equal(h.snapshots.value.get('a').communication.history[0].timestamp,4000)
 } finally {h.effect.stop()}
})

test('independent source denial cannot erase the other source; malformed fulfilled results retain stale instead of absence', async () => {
 let sessionResponse = raw(2), messageResponse = messageRaw(), sessionError, messageError
 const h = harness(['a'], async()=>{if(sessionError)throw sessionError; return sessionResponse}, false, async()=>{if(messageError)throw messageError; return messageResponse})
 try {
  await flush(); assert.equal(h.snapshots.value.get('a').communication.supported,true)
  sessionError={status:403}; messageResponse=messageRaw(7000,'60'); h.refresh('a'); await flush()
  assert.equal(h.snapshots.value.get('a').state.status,'forbidden'); assert.equal(h.snapshots.value.get('a').communication.state.status,'ready')
  sessionError=undefined; sessionResponse=raw(3); messageResponse=[]; h.refresh('a'); await flush()
  assert.equal(h.snapshots.value.get('a').sessions,'3'); assert.equal(h.snapshots.value.get('a').communication.state.status,'stale')
  assert.equal(h.snapshots.value.get('a').communication.supported,true)
  messageError={status:403}; h.refresh('a'); await flush()
  assert.equal(h.snapshots.value.get('a').communication.state.status,'forbidden'); assert.equal(h.snapshots.value.get('a').sessions,'3')
  messageError=undefined; messageResponse={}; h.refresh('a'); await flush(); assert.equal(h.snapshots.value.get('a').communication.supported,false)
 } finally {h.effect.stop()}
})

test('legacy wall clock rollback reopens its visible time segment and partial getters remain independently available',async()=>{
 let response=messageRaw(4000),h=harness(['a'],async()=>raw(0),false,async()=>response)
 try{
  await flush();response=messageRaw(3000,'99');h.refresh('a');await flush()
  let snapshot=h.snapshots.value.get('a').communication;assert.equal(snapshot.state.status,'ready');assert.equal(snapshot.state.sampledAt,3000);assert.equal(snapshot.history.length,1)
  response=messageRaw(7000,'99',['ReceivedBytesTotal']);h.refresh('a');await flush();snapshot=h.snapshots.value.get('a').communication
  assert.equal(snapshot.partial,true);assert.equal(snapshot.history.at(-1).counters.upstreamMessages,'99');assert.equal(snapshot.history.at(-1).counters.receivedBytes,undefined)
 }finally{h.effect.stop()}
})

test('shared communication collection carries the single composite QPS source without deriving packet cumulative differences',async()=>{
 const response=messageRaw(7000,'60'),bean=response['org.jetlinks'].DeviceMessageMonitor.DeviceMessageMonitor
 bean['@attributes'].push({name:'QpsSnapshot',available:true});bean.QpsSnapshot={ReceivedQps:17,SentQps:5,CommunicationQps:22,QpsSampleTime:6900,QpsWindowMillis:1000,QpsReady:true,QpsWindowSequence:'69'}
 const h=harness(['a'],async()=>raw(3),false,async()=>response)
 try{
  await flush();assert.equal(h.calls.length,1);assert.equal(h.messageCalls.length,1)
  const point=h.snapshots.value.get('a').communication.history.at(-1);assert.equal(point.qps.timestamp,6900);assert.equal(point.qps.values.communicationQps,22);assert.equal(point.qps.windowMillis,1000)
 }finally{h.effect.stop()}
})

test('same-generation wall rollback below StartTime accepts newer sequence, resets counter baseline and continues without admitting old source windows',async()=>{
 const origin=1700000005000,start=1700000000000,rollback=origin-259200000
 function source(stamp,sequence,upstream,qpsValue){const response=messageRaw(stamp,String(upstream)),bean=response['org.jetlinks'].DeviceMessageMonitor.DeviceMessageMonitor;bean.StartTime=start;bean['@attributes'].push({name:'QpsSnapshot',available:true});bean.QpsSnapshot={ReceivedQps:qpsValue,SentQps:0,CommunicationQps:qpsValue,QpsSampleTime:stamp,QpsWindowMillis:1000,QpsReady:true,QpsWindowSequence:String(sequence)};return response}
 let response=source(origin,100,30,3),h=harness(['a'],async()=>raw(3),false,async()=>response)
 try{
  await flush();response=source(rollback,101,33,7);h.refresh('a');await flush()
  let value=h.snapshots.value.get('a').communication;assert.equal(value.state.status,'ready');assert.equal(value.state.sampledAt,rollback);assert.equal(value.history.length,1);assert.equal(value.history[0].qps.values.communicationQps,7)
  response=source(rollback+1,101,33,8);h.refresh('a');await flush()
  response=source(rollback+3000,131,36,9);h.refresh('a');await flush();value=h.snapshots.value.get('a').communication;assert.equal(value.state.status,'ready');assert.equal(value.history.at(-1).qps.values.communicationQps,9)
  response=source(rollback+3000,132,39,10);h.refresh('a');await flush();value=h.snapshots.value.get('a').communication;assert.equal(value.state.status,'ready');assert.equal(value.history.at(-1).qps.values.communicationQps,10)
  response=source(rollback+4000,131,999,99);h.refresh('a');await flush();value=h.snapshots.value.get('a').communication;assert.equal(value.state.status,'stale');assert.equal(value.history.findLast(point=>point.qps).qps.values.communicationQps,10)
 }finally{h.effect.stop()}
})
