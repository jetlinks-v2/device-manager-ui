import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const pattern = 'org.jetlinks:type=PersistenceBuffer,*'
const raw = (pending = 0, dead = 0) => ({ 'org.jetlinks': { PersistenceBuffer: { queue: { '@objectName': 'org.jetlinks:type=PersistenceBuffer,name=queue', '@name': 'queue',
  '@attributes': ['Remainder', 'DeadSize'].map(name => ({ name, readable: true, available: true, type: 'long' })), Remainder: pending, DeadSize: dead } } } })
function harness(ids = ['a']) {
  const h = runtimeModules(), nodes = vue.ref(ids), enabled = vue.ref(true), identity = vue.ref('alice:p1'), interval = vue.ref(2), discovery = vue.ref('alice:p1'), permitted = vue.ref(true), scope = vue.effectScope()
  const module = h.load('views/link/RuntimeMonitor/useClusterBuffers.ts')
  const view = scope.run(() => module.useClusterBuffers(nodes, enabled, identity, interval, discovery, permitted))
  return { ...h, view, nodes, enabled, identity, interval, discovery, permitted, scope, summarize: module.summarizeBufferQueues,
    push: (node, value, time) => h.collection.push(node, pattern, value, time) }
}
test('Buffer declares exact lightweight attributes and never creates a local sampling timer', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 })
  const h = harness(['a', 'b'])
  try {
    assert.deepEqual(h.collection.entries[0].demand.attributes, ['Remainder', 'DeadSize', 'Monitor', 'WriterPending', 'Wip'])
    assert.deepEqual(h.collection.entries[0].demand.nodeIds, ['a', 'b'])
    h.push('a', raw()); t.mock.timers.tick(60000)
    assert.equal(h.view.snapshots.value.get('a').history.length, 1, 'only delivered backend samples advance history')
  } finally { h.scope.stop() }
})
test('one node sample preserves the shared Map and does not notify another node', () => {
  const h = harness(['a', 'b'])
  try {
    h.push('a', raw()); h.push('b', raw(2)); const map = h.view.snapshots.value, b = map.get('b'); let renders = 0
    const stop = vue.watchEffect(() => { map.get('b'); renders++ }, { flush: 'sync' })
    h.push('a', raw(7))
    assert.equal(h.view.snapshots.value, map); assert.equal(map.get('b'), b); assert.equal(renders, 1)
    assert.equal(vue.isReactive(map.get('a')), false); stop()
  } finally { h.scope.stop() }
})
test('two-second samples preserve the complete five-minute observation window', () => {
  const h = harness()
  try {
    for (let i = 0; i < 155; i++) h.push('a', raw(i), 1000 + i * 2000)
    const history = h.view.snapshots.value.get('a').history
    assert.equal(history.length, 151); assert.equal(history.at(-1).sampledAt - history[0].sampledAt, 300000)
  } finally { h.scope.stop() }
})
test('genuine zero clears backlog while missing queue values never become zero', () => {
  const h = harness()
  try {
    h.push('a', raw(4, 2)); assert.equal(h.view.snapshots.value.get('a').hasBacklog, true)
    h.push('a', raw()); assert.equal(h.view.snapshots.value.get('a').pending, 0); assert.equal(h.view.snapshots.value.get('a').hasBacklog, false)
    const missing = raw(); missing['org.jetlinks'].PersistenceBuffer.queue['@attributes'][0].available = false
    h.push('a', missing); assert.equal(h.view.snapshots.value.get('a').pending, undefined); assert.equal(h.view.snapshots.value.get('a').state.status, 'stale')
  } finally { h.scope.stop() }
})
test('transient errors retain evidence and append gaps; denial removes sensitive counters', () => {
  const h = harness()
  try {
    h.push('a', raw(3), 1000); h.collection.fail('a', pattern, new Error('offline'), 2000)
    const stale = h.view.snapshots.value.get('a')
    assert.equal(stale.pending, 3); assert.equal(stale.state.status, 'stale'); assert.deepEqual(stale.history.at(-1).buffers, [])
    assert.equal(stale.state.sampledAt, 1000)
    h.collection.fail('a', pattern, { status: 403 }, 3000)
    assert.equal(h.view.snapshots.value.get('a').state.status, 'forbidden'); assert.equal(h.view.snapshots.value.get('a').pending, undefined)
  } finally { h.scope.stop() }
})
test('directory and permission changes gate declarations and clear prior identity', () => {
  const h = harness()
  try {
    h.push('a', raw(5)); h.identity.value = 'bob:p2'
    assert.equal(h.view.snapshots.value.size, 0); assert.equal(h.collection.entries[0].demand.enabled, false)
    h.discovery.value = 'bob:p2'; assert.equal(h.collection.entries[0].demand.enabled, true)
    h.push('a', raw()); h.permitted.value = false
    assert.equal(h.view.snapshots.value.size, 0); assert.equal(h.collection.entries[0].demand.enabled, false)
  } finally { h.scope.stop() }
})
test('pause retains evidence, node removal withdraws demand, and new nodes begin loading', () => {
  const h = harness(['a', 'b'])
  try {
    h.push('a', raw(5)); h.enabled.value = false
    assert.equal(h.view.snapshots.value.get('a').pending, 5); assert.equal(h.collection.entries[0].demand.enabled, false)
    h.enabled.value = true; h.nodes.value = ['a', 'c']
    assert.equal(h.view.snapshots.value.has('b'), false); assert.equal(h.view.snapshots.value.get('c').state.status, 'loading')
    assert.deepEqual(h.collection.entries[0].demand.nodeIds, ['a', 'c'])
  } finally { h.scope.stop() }
})
test('reset withdraws only the selected node and advances its counter epoch across failure or success', () => {
  const h = harness(['a', 'b'])
  try {
    h.push('a', raw()); h.push('b', raw())
    const barrier = h.view.beginReset('a', 'org.jetlinks:type=PersistenceBuffer,name=queue')
    assert.ok(barrier); assert.deepEqual(h.collection.entries[0].demand.nodeIds, ['b'])
    h.push('a', raw(99)); assert.equal(h.view.snapshots.value.get('a').pending, 0)
    assert.equal(h.view.beginReset('a', 'org.jetlinks:type=PersistenceBuffer,name=queue'), undefined)
    barrier.finish(false); barrier.finish(true); h.push('a', raw(2))
    assert.equal(h.view.snapshots.value.get('a').history.at(-1).buffers[0].counterEpoch, 1)
    assert.equal(h.view.snapshots.value.get('b').history.at(-1).buffers[0].counterEpoch, 0)
  } finally { h.scope.stop() }
})
test('manual refresh delegates to the single manager and interval changes retain business history', () => {
  const h = harness()
  try {
    h.push('a', raw()); const first = h.view.snapshots.value.get('a').history
    h.interval.value = 60; h.view.refresh('a')
    assert.equal(h.collection.refreshes.length, 1); assert.equal(h.view.snapshots.value.get('a').history, first)
    h.scope.stop(); assert.equal(h.collection.entries[0].live, false)
  } finally { h.scope.stop() }
})
test('queue totals require every value while any positive queue signals backlog', () => {
  const h = harness()
  try {
    assert.deepEqual(h.summarize([]), { pending: undefined, dead: undefined, hasBacklog: false })
    assert.deepEqual(h.summarize([{ pending: 2, dead: 0 }, { pending: undefined, dead: 1 }]), { pending: undefined, dead: 1, hasBacklog: true })
  } finally { h.scope.stop() }
})
