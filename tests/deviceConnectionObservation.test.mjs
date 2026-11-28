import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
const require = createRequire(import.meta.url)
function load(path, imports = {}, globals = {}) {
  const file = new URL(path, import.meta.url), module = { exports: {} }
  const code = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2022' }).code
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => id in imports ? imports[id] : id.startsWith('.') ? load(new URL(resolve(dirname(file.pathname), id + '.ts'), 'file://').href) : require(id), module, module.exports, ...Object.values(globals))
  return module.exports
}
const observations = load('../../../jetlinks-web-core/src/components/RuntimeDiagnostics/device-sessions/observation.ts')
const settle = async () => { await Promise.resolve(); await vue.nextTick(); await Promise.resolve() }
const session = (read = '100', write = '200') => [{ deviceId: 'a', serverId: 'node', connectTime: 1000, pendingMessages: '0', connections: [{ id: 'socket', address: '127.0.0.1', metrics: { connectTime: 1000, readBytes: read, writeBytes: write, totalMessages: '10' } }] }]
function fixture(t, query = async () => ({ status: 200, result: session() }), status = 'offline', subject) {
  const calls = [], timers = new Map(), delays = new Map(), permission = vue.ref(true), visibility = vue.ref('visible')
  let now = 10000, timerId = 0, deactivate
  const { useDeviceConnectionObservation } = load('../components/device-detail/useDeviceConnectionObservation.ts', {
    vue: { ...vue, onActivated: () => {}, onDeactivated: fn => { deactivate = fn } },
    '@vueuse/core': { useDocumentVisibility: () => visibility, useMediaQuery: () => vue.ref(false) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) }, 'vue-router': { useRoute: () => ({ path: '/resources/devices/list' }) },
    '@jetlinks-web-core/store': { useAuthStore: () => ({ hasPermission: () => permission.value }), useMenuStore: () => ({ hasMenu: () => false }) },
    '@jetlinks-web-core/components/RuntimeDiagnostics': { ...observations, defaultDiagnosticSamplingInterval: 2 },
    '../../api/deviceConnection': { queryDeviceConnectionSessions_api: async id => { calls.push(id); return query(id) } },
    '../../views/device/list/hooks/useIotDeviceRouting': { getIotDeviceListMenuCode: () => 'devices' },
  }, { setTimeout: (fn, delay) => { timers.set(++timerId, fn); delays.set(timerId, delay); return timerId }, clearTimeout: id => { timers.delete(id); delays.delete(id) }, Date: { now: () => now } })
  const props = subject ?? vue.reactive({ deviceId: 'a', projectId: 'p', status }), scope = vue.effectScope()
  const state = scope.run(() => useDeviceConnectionObservation(props))
  t.after(() => scope.stop())
  return { state, props, permission, visibility, scope, calls, timers, delays, deactivate: () => deactivate(), tick: async () => { const [id, fn] = [...timers][0] || []; assert.ok(fn, 'one scheduled sample'); timers.delete(id); now += delays.get(id); delays.delete(id); fn(); await settle() } }
}

test('opening starts one sample and a second valid sample computes rates and preserves a real zero', async t => {
  let count = 0
  const f = fixture(t, async () => ({ status: 200, result: session(count++ ? '4196' : '100') }))
  assert.deepEqual(f.calls, [])
  f.state.open.value = true; await settle()
  assert.deepEqual(f.calls, ['a']); assert.equal(f.timers.size, 1)
  assert.equal(observations.deviceObservationCurrentPoint(f.state.history.value).receive, undefined)
  await f.tick()
  const point = observations.deviceObservationCurrentPoint(f.state.history.value)
  assert.equal(point.receive, 4096); assert.equal(point.send, 0); assert.equal(point.pending, 0)
})

test('closing, pausing, hidden document and deactivation stop sampling and break the rate baseline', async t => {
  const f = fixture(t)
  f.state.open.value = true; await settle(); f.state.paused.value = true
  assert.equal(f.timers.size, 0); assert.equal(f.state.history.value.at(-1).interrupted, true)
  f.state.paused.value = false; await settle(); assert.equal(f.timers.size, 1)
  f.visibility.value = 'hidden'; assert.equal(f.timers.size, 0)
  f.visibility.value = 'visible'; await settle(); assert.equal(f.timers.size, 1)
  f.state.open.value = false; assert.equal(f.timers.size, 0)
  f.state.open.value = true; await settle(); f.deactivate(); assert.equal(f.timers.size, 0)
})

test('late results cannot cross device/project changes, closed panels or disposal', async t => {
  for (const change of [f => { f.props.deviceId = 'b' }, f => { f.props.projectId = 'other' }, f => { f.state.open.value = false }, f => f.scope.stop()]) {
    let finish
    const f = fixture(t, () => new Promise(done => { finish = done }))
    f.state.open.value = true; change(f); finish({ status: 200, result: session() }); await settle()
    assert.deepEqual(f.state.sessions.value, []); assert.equal(f.timers.size, 0)
  }
})

test('manual refresh is single-flight and a revoked read permission clears retained sessions', async t => {
  let finish
  const f = fixture(t, () => new Promise(done => { finish = done }))
  f.state.open.value = true; f.state.refresh(); f.state.refresh(); assert.equal(f.calls.length, 1)
  finish({ status: 200, result: session() }); await settle()
  f.permission.value = false
  assert.deepEqual(f.state.sessions.value, []); assert.equal(f.state.state.value.status, 'forbidden'); assert.equal(f.timers.size, 0)
})

test('forbidden and unsupported responses stop automatic requests, empty results do not invent offline state', async t => {
  for (const status of [403, 404]) {
    const f = fixture(t, async () => ({ status }))
    f.state.open.value = true; await settle()
    assert.equal(f.state.state.value.status, status === 403 ? 'forbidden' : 'unsupported'); assert.equal(f.timers.size, 0)
  }
  const f = fixture(t, async () => ({ status: 200, result: [] }))
  f.state.open.value = true; await settle(); assert.equal(f.state.state.value.status, 'empty')
  assert.deepEqual(f.state.sessions.value, [])
  assert.equal([...f.delays.values()][0], 2000)
})

test('refresh errors keep the last snapshot, mark a gap and recover without bridging missing samples', async t => {
  let failure = false
  const f = fixture(t, async () => { if (failure) throw Error('failed'); return { status: 200, result: session() } })
  f.state.open.value = true; await settle(); failure = true; await f.tick()
  assert.equal(f.state.state.value.status, 'error'); assert.equal(f.state.sessions.value.length, 1)
  assert.equal(f.state.history.value.at(-1).interrupted, true)
  failure = false; await f.tick(); assert.equal(f.state.state.value.status, 'ready')
  assert.equal(observations.deviceObservationCurrentPoint(f.state.history.value).receive, undefined)
})

test('online summary samples immediately and opening or closing details keeps one sampler', async t => {
  const f = fixture(t, undefined, 'online')
  await settle()
  assert.deepEqual(f.calls, ['a']); assert.equal(f.timers.size, 1)
  assert.equal([...f.delays.values()][0], 1000, 'the first valid rate uses a short baseline interval')
  f.state.open.value = true; await settle()
  f.state.open.value = false; await settle()
  assert.deepEqual(f.calls, ['a']); assert.equal(f.timers.size, 1)
  await f.tick(); assert.equal(f.calls.length, 2)
  assert.equal([...f.delays.values()][0], 2000, 'subsequent samples respect the normal interval')
  f.props.status = 'offline'
  assert.equal(f.timers.size, 0)
})

test('online device and project changes start one new request and reject the old response', async t => {
  for (const change of [f => { f.props.deviceId = 'b' }, f => { f.props.projectId = 'next' }]) {
    const pending = []
    const f = fixture(t, () => new Promise(done => pending.push(done)), 'online')
    change(f)
    assert.equal(pending.length, 2)
    pending[0]({ status: 200, result: session('1') }); await settle()
    assert.deepEqual(f.state.sessions.value, [])
    pending[1]({ status: 200, result: session('200').map(value => ({ ...value, deviceId: f.props.deviceId })) }); await settle()
    assert.equal(f.state.sessions.value[0].deviceId, f.props.deviceId)
    assert.equal(f.timers.size, 1)
  }
})

test('same-device realtime replacements preserve the open panel and sampling baseline', async t => {
  const device = vue.ref({ id: 'a', projectId: 'p', status: 'online', reportAt: 1 })
  const f = fixture(t, undefined, 'online', {
    get deviceId() { return device.value.id },
    get projectId() { return device.value.projectId },
    get status() { return device.value.status },
  })
  await settle(); await f.tick()
  f.state.open.value = true
  const baseline = f.state.history.value
  device.value = { ...device.value, reportAt: 2 }; await settle()
  assert.equal(f.state.open.value, true)
  assert.equal(f.state.history.value, baseline)
  assert.equal(f.calls.length, 2)
  assert.equal(f.timers.size, 1)
})

test('same-device realtime replacements cannot restart a forbidden sampler', async t => {
  const device = vue.ref({ id: 'a', status: 'online', reportAt: 1 })
  const f = fixture(t, async () => ({ status: 403 }), 'online', {
    get deviceId() { return device.value.id },
    get status() { return device.value.status },
  })
  await settle()
  device.value = { ...device.value, reportAt: 2 }; await settle()
  assert.equal(f.state.state.value.status, 'forbidden')
  assert.equal(f.calls.length, 1)
  assert.equal(f.timers.size, 0)
})
