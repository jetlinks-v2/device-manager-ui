import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
function loadTs(entry, overrides = {}) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    new Function('require', 'module', 'exports', transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : id in overrides ? overrides[id] : id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id), module, module.exports)
    cache.set(path, module.exports); return module.exports
  }
  return load(entry)
}
function harness(loader = async id => [{ deviceId: id, serverId: 'node', pendingMessages: 0 }], initial = {}) {
  const active = vue.ref(initial.active ?? true), permission = vue.ref(true), capability = vue.ref(initial.capability ?? true), scope = vue.ref('alice'), supported = vue.ref(true), calls = []
  const model = loadTs(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/device-sessions/observation.ts'))
  const normalizer = loadTs(resolve(import.meta.dirname, '../views/link/diagnostics/useDeviceSessions.ts'), {
    '@jetlinks-web-core/hooks/useDiagnosticQuery': {}, '../../../api/link/diagnostics': {}, './useDiagnosticsAccess': {}, './status': {},
  })
  const module = loadTs(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/device-observation/useDeviceObservation.ts'), {
    '@jetlinks-web-core/components/RuntimeDiagnostics': { ...model, ...loadTs(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts')) },
    '../../../../api/link/diagnostics': { queryDeviceSessions: (id, signal) => { calls.push({ id, signal }); return loader(id, signal) } },
    '../../diagnostics/useDeviceSessions': normalizer,
    '../../diagnostics/status': { diagnosticErrorState: error => ({ status: error.status === 403 ? 'forbidden' : 'error' }) },
  })
  const effect = vue.effectScope(), view = effect.run(() => module.useDeviceObservation(active, permission, capability, scope, supported))
  return { view, effect, active, permission, capability, scope, supported, calls }
}

test('restored selections load immediately on entry after capability is ready, then wait for completion plus interval', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  if (!('localStorage' in globalThis)) { Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true }); t.after(() => { delete globalThis.localStorage }) }
  t.mock.property(globalThis, 'localStorage', { getItem: () => JSON.stringify({ devices: [{ id: 'saved' }], interval: 30 }), setItem() {} })
  const h = harness(undefined, { active: false, capability: false })
  try {
    assert.equal(h.view.entries.value.length, 1); assert.equal(h.calls.length, 0)
    h.active.value = true; assert.equal(h.calls.length, 0, 'wait for authorized capability')
    h.capability.value = true; assert.equal(h.calls.length, 1, 'no initial interval delay'); await flush()
    t.mock.timers.tick(29999); await flush(); assert.equal(h.calls.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(h.calls.length, 2)
    h.active.value = false; h.active.value = true; assert.equal(h.calls.length, 3, 're-entry refreshes immediately'); await flush()
    h.view.paused.value = true; h.active.value = false; h.active.value = true
    assert.equal(h.calls.length, 4, 'paused re-entry still gets one fresh snapshot'); await flush()
    t.mock.timers.tick(60000); await flush(); assert.equal(h.calls.length, 4); assert.equal(h.view.paused.value, true)
  } finally { h.effect.stop() }
})

test('five devices share three slots; duplicates and refresh do not overlap; colors survive removals', async () => {
  const pending = [], h = harness((id, signal) => new Promise(done => pending.push({ id, signal, done })))
  try {
    for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(h.view.add(id), true)
    assert.equal(h.view.add('sixth'), false); assert.equal(h.view.add('a'), true)
    assert.deepEqual(h.calls.map(call => call.id), ['a', 'b', 'c'])
    h.view.refresh('a'); assert.equal(h.calls.length, 3)
    pending[1].done([]); await flush(); assert.equal(h.calls.at(-1).id, 'd')
    pending[0].done([]); await flush(); assert.equal(h.calls.at(-1).id, 'e')
    const color = h.view.entries.value.find(entry => entry.id === 'c').color
    h.view.remove('a'); assert.equal(h.view.entries.value.find(entry => entry.id === 'c').color, color)
    assert.equal(new Set(h.view.entries.value.map(entry => entry.color)).size, 4)
  } finally { h.effect.stop() }
})
test('old single-metric preferences keep devices and interval while multi-metric preferences are bounded and may hide all curves', t => {
  if (!('localStorage' in globalThis)) { Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true }); t.after(() => { delete globalThis.localStorage }) }
  const values = { alice: { devices: [{ id: 'a' }], interval: 10, metric: 'pending' }, bob: { metrics: ['send', 'send', 'unknown', 'pending'] }, carol: { metrics: [] } }
  t.mock.property(globalThis, 'localStorage', { getItem: key => JSON.stringify(values[key.split(':').at(-1)]), setItem() {} })
  const h = harness(undefined, { active: false })
  try {
    assert.equal(h.view.entries.value[0].id, 'a'); assert.equal(h.view.interval.value, 10)
    assert.deepEqual(h.view.metrics.value, ['receive', 'send', 'messages', 'pending'])
    h.scope.value = 'bob'; assert.deepEqual(h.view.metrics.value, ['send', 'pending'])
    h.scope.value = 'carol'; assert.deepEqual(h.view.metrics.value, [])
    assert.equal(h.calls.length, 0)
  } finally { h.effect.stop() }
})
test('paused explicit refresh visits all five devices with at most three concurrent requests and remains paused', async () => {
  let current = 0, maximum = 0
  const pending = [], h = harness(id => new Promise(done => { current++; maximum = Math.max(maximum, current); pending.push({ id, done: value => { current--; done(value) } }) }))
  try {
    for (const id of ['a', 'b', 'c', 'd', 'e']) h.view.add(id)
    for (let i = 0; i < 5; i++) { pending[i].done([]); await flush() }
    h.view.paused.value = true; await flush(); h.view.refresh()
    assert.equal(h.calls.length, 8)
    for (let i = 5; i < 10; i++) { pending[i].done([]); await flush() }
    assert.equal(h.calls.length, 10); assert.equal(maximum, 3); assert.equal(h.view.paused.value, true)
    assert.ok(['a', 'b', 'c', 'd', 'e'].every(id => h.calls.filter(call => call.id === id).length === 2))
  } finally { h.effect.stop() }
})
test('sampling waits after completion, interval changes apply to the next due sample and slow requests never overlap', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  const pending = [], h = harness(id => new Promise(done => pending.push({ id, done })))
  try {
    h.view.add('slow'); t.mock.timers.tick(60000); await flush(); assert.equal(h.calls.length, 1)
    pending[0].done([]); await flush(); h.view.interval.value = 30; await flush()
    t.mock.timers.tick(29999); await flush(); assert.equal(h.calls.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(h.calls.length, 2)
    pending[1].done([]); await flush(); h.view.paused.value = true
    t.mock.timers.tick(120000); await flush(); assert.equal(h.calls.length, 2)
  } finally { h.effect.stop() }
})
test('sampling intervals accept the shared options, migrate legacy three seconds and restore per identity', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  if (!('localStorage' in globalThis)) { Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true }); t.after(() => { delete globalThis.localStorage }) }
  const saved = new Map([['runtime-device-observation:v1:alice', JSON.stringify({ interval: 3 })]])
  t.mock.property(globalThis, 'localStorage', { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) })
  const h = harness()
  try {
    assert.equal(h.view.interval.value, 2)
    h.view.add('a'); await flush()
    t.mock.timers.tick(1999); await flush(); assert.equal(h.calls.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(h.calls.length, 2)
    const firstHistory = h.view.entries.value[0].history
    for (const value of [1, 2, 5, 10, 30, 60]) { h.view.interval.value = value; await flush(); assert.equal(h.view.interval.value, value) }
    assert.equal(h.view.entries.value[0].history, firstHistory)
    h.view.interval.value = 1; await flush(); t.mock.timers.tick(999); await flush(); assert.equal(h.calls.length, 2)
    t.mock.timers.tick(1); await flush(); assert.equal(h.calls.length, 3)
    h.scope.value = 'bob'; await flush(); assert.equal(h.view.interval.value, 2)
    h.scope.value = 'alice'; await flush(); assert.equal(h.view.interval.value, 1)
    h.view.interval.value = 7; await flush(); assert.equal(h.view.interval.value, 2)
  } finally { h.effect.stop() }
})
test('adding a device while paused takes exactly one initial snapshot and preserves pause', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  const h = harness()
  try {
    h.view.paused.value = true; h.view.add('new-device'); await flush()
    assert.deepEqual(h.calls.map(call => call.id), ['new-device'])
    assert.equal(h.view.entries.value[0].state.status, 'ready'); assert.equal(h.view.entries.value[0].collecting, false); assert.equal(h.view.paused.value, true)
    t.mock.timers.tick(60000); await flush(); assert.equal(h.calls.length, 1)
  } finally { h.effect.stop() }
})
test('deactivation retains data and cancels work; removal, scope and revocation reject late evidence', async () => {
  const pending = [], h = harness((id, signal) => new Promise(done => pending.push({ id, signal, done })))
  try {
    h.view.add('a'); pending[0].done([{ deviceId: 'a', serverId: 'node' }]); await flush()
    const sessions = h.view.entries.value[0].sessions
    h.view.refresh('a'); h.active.value = false; await flush()
    assert.equal(pending[1].signal.aborted, true); assert.equal(h.view.entries.value[0].sessions, sessions)
    pending[1].done([{ deviceId: 'a', serverId: 'late' }]); await flush(); assert.equal(h.view.entries.value[0].sessions, sessions)
    h.active.value = true; await flush(); h.view.remove('a')
    assert.equal(pending[2].signal.aborted, true); pending[2].done([{ deviceId: 'a' }]); await flush(); assert.deepEqual(h.view.entries.value, [])
    h.view.add('b'); h.scope.value = 'bob'; await flush(); assert.equal(pending[3].signal.aborted, true)
    pending[3].done([{ deviceId: 'b' }]); await flush(); assert.deepEqual(h.view.entries.value, [])
    h.view.add('c'); h.permission.value = false; await flush(); assert.equal(pending[4].signal.aborted, true)
    pending[4].done([{ deviceId: 'c' }]); await flush(); assert.deepEqual(h.view.entries.value, [])
  } finally { h.effect.stop() }
})
test('unknown capability retains prior evidence but confirmed absence and endpoint denial remove telemetry', async () => {
  let denied = false
  const h = harness(async id => { if (denied) throw { status: 403 }; return [{ deviceId: id, serverId: 'node' }] })
  try {
    h.view.add('a'); await flush(); const sessions = h.view.entries.value[0].sessions
    h.capability.value = false; h.supported.value = undefined; await flush()
    assert.equal(h.view.entries.value[0].sessions, sessions)
    h.supported.value = false; await flush(); assert.deepEqual(h.view.entries.value[0].sessions, []); assert.deepEqual(h.view.entries.value[0].history, [])
    h.supported.value = true; h.capability.value = true; await flush()
    denied = true; h.view.refresh('a'); await flush()
    assert.equal(h.view.entries.value[0].state.status, 'forbidden'); assert.deepEqual(h.view.entries.value[0].sessions, [])
  } finally { h.effect.stop() }
})
test('only bounded selections and settings persist; telemetry is memory-only and storage corruption is harmless', async t => {
  const saved = new Map()
  if (!('localStorage' in globalThis)) { Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true }); t.after(() => { delete globalThis.localStorage }) }
  t.mock.property(globalThis, 'localStorage', { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) })
  const h = harness()
  try {
    h.view.add('private-device', 'Device'); await flush(); h.view.metrics.value = ['pending']; await flush()
    const value = JSON.parse(saved.get('runtime-device-observation:v1:alice'))
    assert.deepEqual(value, { devices: [{ id: 'private-device', label: 'Device' }], interval: 2, metrics: ['pending'] })
    assert.ok(!JSON.stringify(value).includes('serverId')); assert.ok(!JSON.stringify(value).includes('history'))
    saved.set('runtime-device-observation:v1:bob', '{bad-json'); h.scope.value = 'bob'; await flush(); assert.deepEqual(h.view.entries.value, [])
  } finally { h.effect.stop() }
})
