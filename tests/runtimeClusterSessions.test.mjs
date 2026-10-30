import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const sessionsPattern = 'org.jetlinks:type=DeviceSessionManager,*', messagePattern = 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor'
const raw = (sessions = 0, available = true, domain = 'org.jetlinks') => ({ [domain]: { DeviceSessionManager: { one: {
  '@objectName': `${domain}:type=DeviceSessionManager,name=one`, '@name': 'one', '@attributes': [{ name: 'Sessions', available }, { name: 'KeepOnlineSize', available: true }], Sessions: sessions, KeepOnlineSize: '0',
} } } })
const message = (time = 4000, generation = 1000, sequence = '1') => {
  const values = { StartTime: generation, SnapshotTime: time, ReceivedBytesTotal: '3000', SentBytesTotal: '0', UpstreamMessagesTotal: '30', PropertyReportsTotal: '6', PropertyValuesTotal: '12', EventReportsTotal: '3', ReceivedPacketsTotal: '30', SentPacketsTotal: '15', QpsSnapshot: { QpsWindowSequence: sequence, QpsSampleTime: time, QpsWindowMillis: 1000, QpsReady: true, ReceivedQps: 8, SentQps: 2, CommunicationQps: 10 } }
  return { 'org.jetlinks': { DeviceMessageMonitor: { DeviceMessageMonitor: { '@objectName': messagePattern, '@name': 'DeviceMessageMonitor', '@attributes': Object.keys(values).map(name => ({ name, available: true })), ...values } } } }
}
function harness() {
  const h = runtimeModules(), nodes = vue.ref(['a', 'b']), enabled = vue.ref(true), identity = vue.ref('alice'), discovery = vue.ref('alice'), permitted = vue.ref(true), interval = vue.ref(2), scope = vue.effectScope()
  const module = h.load('views/link/RuntimeMonitor/useClusterSessions.ts')
  const view = scope.run(() => module.useClusterSessions(nodes, enabled, identity, discovery, permitted, interval))
  return { ...h, scope, view, nodes, enabled, identity, discovery, permitted, interval,
    push: (node, value, time) => h.collection.push(node, sessionsPattern, value, time) }
}
test('session and communication declare exact read-only projections, with no local timer', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const h = harness()
  try {
    assert.deepEqual(h.collection.entries[0].demand.attributes, ['Sessions', 'KeepOnlineSize'])
    assert.ok(h.collection.entries[1].demand.attributes.includes('QpsSnapshot'))
    h.push('a', raw()); t.mock.timers.tick(60000)
    assert.equal(h.view.snapshots.value.get('a').history.length, 1)
  } finally { h.scope.stop() }
})
test('node-local delivery keeps shallow Map identity and other node subscribers stable', () => {
  const h = harness()
  try {
    h.push('a', raw()); h.push('b', raw()); const map = h.view.snapshots.value, b = map.get('b'); let reads = 0
    const stop = vue.watchEffect(() => { map.get('b'); reads++ }, { flush: 'sync' })
    h.push('a', raw(5)); assert.equal(map.get('b'), b); assert.equal(reads, 1); assert.equal(h.view.snapshots.value, map); assert.equal(vue.isReactive(map.get('a')), false); stop()
  } finally { h.scope.stop() }
})
for (const [label, source, expected] of [
  ['real zero', raw(0), ['ready', true, '0']],
  ['exact long', raw('9223372036854775807'), ['ready', true, '9223372036854775807']],
  ['missing getter', raw(9, false), ['ready', true, undefined]],
  ['wrong domain', raw(4, true, 'other'), ['empty', false, undefined]],
  ['absent object', {}, ['empty', false, undefined]],
]) test(`session ${label} preserves capability and value semantics`, () => {
  const h = harness()
  try {
    h.push('a', source, 1000); const value = h.view.snapshots.value.get('a')
    assert.deepEqual([value.state.status, value.supported, value.sessions], expected)
  } finally { h.scope.stop() }
})
test('transient failure retains timestamp and appends a gap; denial clears only the failed source', () => {
  const h = harness()
  try {
    h.push('a', raw(4), 1000); h.collection.push('a', messagePattern, message(), 1000)
    const communication = h.view.snapshots.value.get('a').communication
    h.collection.fail('a', sessionsPattern, new Error('offline'), 2000)
    let value = h.view.snapshots.value.get('a'); assert.equal(value.state.status, 'stale'); assert.equal(value.state.sampledAt, 1000); assert.equal(value.sessions, '4'); assert.equal(value.history.at(-1).value, undefined)
    h.collection.fail('a', sessionsPattern, { status: 403 }); value = h.view.snapshots.value.get('a')
    assert.equal(value.state.status, 'forbidden'); assert.equal(value.sessions, undefined); assert.equal(value.supported, undefined); assert.equal(value.communication, communication)
    h.push('a', raw()); assert.equal(h.view.snapshots.value.get('a').sessions, '0')
  } finally { h.scope.stop() }
})
test('one-second backend samples retain ten minutes and bounded history', () => {
  const h = harness()
  try {
    for (let i = 0; i < 605; i++) h.push('a', raw(i), 1000 + i * 1000)
    const history = h.view.snapshots.value.get('a').history
    assert.equal(history.length, 601); assert.equal(history.at(-1).timestamp - history[0].timestamp, 600000)
  } finally { h.scope.stop() }
})
test('pause keeps confirmed evidence while scope, directory and permission changes isolate it', () => {
  const h = harness()
  try {
    h.push('a', raw(5)); h.enabled.value = false; assert.equal(h.view.snapshots.value.get('a').sessions, '5')
    assert.equal(h.collection.entries[0].demand.enabled, false)
    h.enabled.value = true; h.nodes.value = ['a', 'c']; assert.equal(h.view.snapshots.value.has('b'), false)
    h.identity.value = 'bob'; assert.equal(h.view.snapshots.value.size, 0); assert.equal(h.collection.entries[0].demand.enabled, false)
    h.discovery.value = 'bob'; h.push('a', raw(2)); h.permitted.value = false; assert.equal(h.view.snapshots.value.size, 0)
  } finally { h.scope.stop() }
})
test('communication failure cannot erase session capability, and missing communication is unsupported', () => {
  const h = harness()
  try {
    h.push('a', raw(7)); h.collection.fail('a', messagePattern, { status: 403 })
    assert.equal(h.view.snapshots.value.get('a').sessions, '7'); assert.equal(h.view.snapshots.value.get('a').communication.state.status, 'forbidden')
    h.collection.push('a', messagePattern, {}); assert.equal(h.view.snapshots.value.get('a').communication.supported, false)
  } finally { h.scope.stop() }
})
test('communication accepts actual source time and rejects older source windows without inventing counters', () => {
  const h = harness()
  try {
    h.collection.push('a', messagePattern, message(4000, 1000, '2'))
    const first = h.view.snapshots.value.get('a').communication
    assert.equal(first.supported, true); assert.equal(first.state.sampledAt, 4000)
    h.collection.push('a', messagePattern, message(5000, 1000, '1'))
    assert.equal(h.view.snapshots.value.get('a').communication.state.status, 'stale')
    h.collection.push('a', messagePattern, message(6000, 5000, '1'))
    assert.equal(h.view.snapshots.value.get('a').communication.state.sampledAt, 6000)
  } finally { h.scope.stop() }
})
test('refresh delegates once, interval changes retain completed evidence and disposal withdraws both declarations', () => {
  const h = harness()
  try {
    h.push('a', raw(2)); const history = h.view.snapshots.value.get('a').history
    h.interval.value = 60; h.view.refresh('a'); assert.equal(h.collection.refreshes.length, 1); assert.equal(h.view.snapshots.value.get('a').history, history)
    h.scope.stop(); assert.ok(h.collection.entries.every(entry => !entry.live))
  } finally { h.scope.stop() }
})
