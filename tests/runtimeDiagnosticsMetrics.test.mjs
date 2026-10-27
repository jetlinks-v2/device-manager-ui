import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import dayjs from 'dayjs'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
const raw = values => ({ 'org.jetlinks': { PersistenceBuffer: { queue: { '@objectName': 'org.jetlinks:type=PersistenceBuffer,name=queue',
  '@attributes': Object.keys(values).map(name => ({ name, readable: true, available: true, type: 'long' })), ...values } } } })
const runtime = (startTime = 100000, uptime = 60000) => ({ 'java.lang': { Runtime: { runtime: { '@objectName': 'java.lang:type=Runtime', '@attributes': ['StartTime', 'Uptime'].map(name => ({ name, readable: true, available: true, type: 'long' })), StartTime: startTime, Uptime: uptime } } } })
function harness(options = {}) {
  const sessions = { snapshots: vue.shallowRef(new Map()), refresh: node => calls.push({ kind: 'session-refresh', node }) }
  const cluster = { snapshots: vue.shallowRef(new Map()), refresh: node => calls.push({ kind: 'buffer-refresh', node }) }
  const cache = new Map(), calls = [], activations = [], deactivations = [], preferenceWrites = []
  const preferences = { value: vue.ref({ nodes: {}, historyRange: options.historyRange }), update: patch => { preferenceWrites.push(patch); preferences.value.value = { ...preferences.value.value, ...patch } } }
  let monotonic = 0
  const connection = vue.ref(false), header = vue.ref(true)
  const node = vue.ref('node-a'), enabled = vue.ref(options.enabled ?? true), identity = vue.ref('alice:p1'), access = vue.ref({ query: true, monitor: true })
  const api = { queryMBeans: async (node, signal) => { calls.push({ kind: 'lifetime', node, signal }); return runtime() }, queryOverviewMBeans: async (node, signal, includeLifetime) => { calls.push({ kind: 'mbean', node, signal, includeLifetime }); return { sources: [runtime()], partial: false } }, ...options.api }
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return { ...vue, onActivated: callback => activations.push(callback), onDeactivated: callback => deactivations.push(callback) }
      if (id === 'vue-i18n') return { useI18n: () => ({ t: (key, values) => values ? JSON.stringify(values) : key }) }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: (key, values) => values ? JSON.stringify(values) : key } } }
      if (id === '@jetlinks-web-core/hooks/useDiagnosticQuery') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts'))
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts'))
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
      if (id.endsWith('api/link/diagnostics')) return api
      if (id.endsWith('services/history')) return { loadResourceOverviewHistory: async range => { calls.push({ kind: 'history', range }); return options.history ? options.history(range) : {} } }
      if (id.endsWith('useClusterSessions')) return { useClusterSessionContext: () => sessions }
      if (id.endsWith('useClusterBuffers')) return { useClusterBufferContext: () => cluster }
      if (id.endsWith('useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
      if (id.endsWith('useDiagnosticPreferences')) return { useDiagnosticPreferences: () => preferences }
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', 'performance', code)(imports, module, module.exports, { now: () => monotonic })
    cache.set(path, module.exports); return module.exports
  }
  const module = load(resolve(import.meta.dirname, '../views/link/diagnostics/useNodeMetrics.ts')), scope = vue.effectScope()
  const view = scope.run(() => module.useNodeMetrics(node, enabled, identity, connection, header))
  return { view, scope, node, enabled, identity, access, api, calls, cluster, sessions, connection, header, advance: value => monotonic += value, activations, deactivations, preferenceWrites }
}

test('the default history window advances to now once per refresh and reactivation without persisting fixed timestamps', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1800000000000 })
  const h = harness(), historyCalls = () => h.calls.filter(call => call.kind === 'history')
  const assertCurrent = () => assert.deepEqual(historyCalls().at(-1).range.map(date => date.valueOf()), [Date.now() - 3600000, Date.now()])
  try {
    await flush(); assertCurrent(); assert.equal(historyCalls().length, 1)
    t.mock.timers.tick(120000); await flush(); assert.equal(historyCalls().length, 1, 'no history polling is introduced')
    h.view.refresh(); await flush(); assertCurrent(); assert.equal(historyCalls().length, 2, 'updating the default range does not issue a duplicate query')
    h.enabled.value = false; await flush(); t.mock.timers.tick(600000); h.view.refresh(); await flush()
    assert.equal(historyCalls().length, 2, 'hidden tools do not refresh')
    h.enabled.value = true; await flush(); assertCurrent(); assert.equal(historyCalls().length, 3)
    h.deactivations.forEach(callback => callback()); await flush(); t.mock.timers.tick(600000)
    h.activations.forEach(callback => callback()); await flush(); assertCurrent(); assert.equal(historyCalls().length, 4)
    assert.deepEqual(h.preferenceWrites, [], 'automatic ranges must not restore as a manual selection on the next visit')
  } finally { h.scope.stop() }
})

test('manual and restored history ranges remain fixed when refreshing or returning to overview', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1800000000000 })
  const saved = { from: Date.now() - 7200000, to: Date.now() - 3600000 }, h = harness()
  const assertFixed = view => assert.deepEqual(view.calls.filter(call => call.kind === 'history').at(-1).range.map(date => date.valueOf()), [saved.from, saved.to])
  try {
    await flush(); h.view.range.value = [dayjs(saved.from), dayjs(saved.to)]; await flush(); assertFixed(h)
    assert.deepEqual(h.preferenceWrites, [{ historyRange: saved }])
    t.mock.timers.tick(120000); h.view.refresh(); await flush(); assertFixed(h)
    assert.equal(h.calls.filter(call => call.kind === 'history').length, 3)
    h.enabled.value = false; await flush(); h.enabled.value = true; await flush(); assertFixed(h)
    assert.equal(h.preferenceWrites.length, 1, 'refresh does not rewrite the manual preference')
  } finally { h.scope.stop() }
  const restored = harness({ historyRange: saved })
  try {
    await flush(); assertFixed(restored)
    t.mock.timers.tick(120000); restored.view.refresh(); await flush(); assertFixed(restored)
    assert.deepEqual(restored.preferenceWrites, [])
  } finally { restored.scope.stop() }
})

test('quick history ranges retain their duration on refresh and restore without freezing their previous end time', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1800000000000 })
  const saved = { from: Date.now() - 7200000, to: Date.now() - 6300000, relativeSeconds: 900 }, h = harness()
  const assertCurrent = view => assert.deepEqual(view.calls.filter(call => call.kind === 'history').at(-1).range.map(date => date.valueOf()), [Date.now() - 900000, Date.now()])
  try {
    await flush(); h.view.selectRange(saved); await flush(); assertCurrent(h)
    assert.deepEqual(h.preferenceWrites, [{ historyRange: saved }])
    t.mock.timers.tick(120000); h.view.refresh(); await flush(); assertCurrent(h)
    assert.equal(h.calls.filter(call => call.kind === 'history').length, 3)
    assert.equal(h.preferenceWrites.length, 1)
  } finally { h.scope.stop() }
  const restored = harness({ historyRange: saved })
  try {
    await flush(); assertCurrent(restored)
    t.mock.timers.tick(120000); restored.view.refresh(); await flush(); assertCurrent(restored)
    assert.equal(restored.view.relativeSeconds.value, 900)
    assert.deepEqual(restored.preferenceWrites, [])
  } finally { restored.scope.stop() }
})

test('JVM overview loads once per activation, history refresh stays independent and Buffer reuses the cluster session', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000000 })
  const h = harness()
  try {
    await flush(); assert.equal(h.calls.filter(call => call.kind === 'mbean').length, 1)
    t.mock.timers.tick(30000); await flush(); assert.equal(h.calls.filter(call => call.kind === 'mbean').length, 1, 'no private five-second MBean/Buffer timer remains')
    h.view.range.value = [dayjs(0), dayjs(10000)]; await flush(); h.view.loadHistory(); await flush()
    assert.equal(h.calls.filter(call => call.kind === 'history').length, 3)
    assert.equal(h.calls.filter(call => call.kind === 'mbean').length, 1)
    const history = [{ sampledAt: Date.now(), buffers: [{ objectName: 'org.jetlinks:type=PersistenceBuffer,name=queue', pending: 4, dead: 0 }] }], beans = [{ objectName: 'buffer' }]
    h.cluster.snapshots.value = new Map([['node-a', { history, beans, state: { status: 'ready' } }]])
    assert.equal(h.view.bufferHistory.value, history); assert.equal(h.view.bufferBeans.value, beans)
    h.enabled.value = false; await flush(); assert.equal(h.view.bufferHistory.value, history)
    h.view.refreshBuffers(); assert.deepEqual(h.calls.at(-1), { kind: 'buffer-refresh', node: 'node-a' })
    h.enabled.value = true; await flush(); assert.equal(h.calls.filter(call => call.kind === 'mbean').length, 2)
    assert.equal(h.calls.filter(call => call.kind === 'mbean').at(-1).includeLifetime, false)
  } finally { h.scope.stop() }
})

test('JVM transient failures preserve stale evidence while server refusals remove only its sensitive cache', async () => {
  const h = harness()
  try {
    await flush(); const cached = h.view.jvm.data.value
    h.api.queryOverviewMBeans = async () => { throw new Error('offline') }; await h.view.loadMBeans()
    assert.equal(h.view.jvm.data.value, cached); assert.equal(h.view.mbeanState.value.status, 'stale')
    for (const status of [401, 403, 404, 501]) {
      h.api.queryOverviewMBeans = async () => { throw { status } }; await h.view.loadMBeans()
      assert.equal(h.view.jvm.data.value, undefined); assert.equal(h.view.mbeanState.value.status, status <= 403 ? 'forbidden' : 'unsupported')
    }
  } finally { h.scope.stop() }
})

test('tool deactivation cancels late JVM reads but retains completed evidence; node, identity and permission changes clear it', async () => {
  const h = harness()
  try {
    await flush(); const cached = h.view.jvm.data.value
    let complete, signal
    h.api.queryOverviewMBeans = async (node, nextSignal) => { signal = nextSignal; return new Promise(done => complete = done) }
    const pending = h.view.loadMBeans(); h.enabled.value = false; await flush()
    assert.equal(signal.aborted, true); assert.equal(h.view.jvm.data.value, cached)
    complete({ sources: [runtime(1, 999999)], partial: false }); await pending; assert.equal(h.view.jvm.data.value, cached)
    h.api.queryOverviewMBeans = async () => ({ sources: [runtime()], partial: false })
    h.enabled.value = true; await flush(); h.deactivations.forEach(callback => callback()); await flush()
    assert.ok(h.view.jvm.data.value); h.activations.forEach(callback => callback()); await flush()
    h.node.value = 'node-b'; await flush(); assert.ok(h.view.jvm.data.value)
    h.identity.value = 'bob:p2'; await flush(); assert.ok(h.view.jvm.data.value)
    h.access.value = { query: true, monitor: false }; await flush()
    assert.equal(h.view.jvm.data.value, undefined); assert.equal(h.view.bufferState.value.status, 'forbidden')
    h.scope.stop(); assert.equal(h.view.jvm.data.value, undefined)
  } finally { h.scope.stop() }
})

const uptime = h => JSON.parse(h.view.metrics.value.find(metric => metric.key === 'uptime').value)
test('a silent monitor restart across a sampling gap reloads the JVM baseline once without polling uptime', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000000 })
  const h = harness(), sample = startTime => new Map([['node-a', { communication: { history: [{ startTime }] } }]])
  const flags = []
  try {
    await flush()
    h.sessions.snapshots.value = sample('10'); await flush()
    h.api.queryOverviewMBeans = async (node, signal, includeLifetime) => { flags.push(includeLifetime); return { sources: [runtime(900000, 2000)] } }
    h.sessions.snapshots.value = sample('10'); await flush(); assert.deepEqual(flags, [])
    h.sessions.snapshots.value = new Map(); await flush()
    h.sessions.snapshots.value = sample('20'); await flush()
    assert.deepEqual(flags, [true]); assert.equal(uptime(h).seconds, 2)
    assert.equal(h.view.metrics.value.find(metric => metric.key === 'startTime').value, new Date(900000).toLocaleString())
    h.advance(3000); t.mock.timers.tick(3000); await flush(); assert.equal(uptime(h).seconds, 5)
    h.sessions.snapshots.value = sample('20'); await flush(); assert.deepEqual(flags, [true])
    h.enabled.value = false; await flush()
    assert.equal(h.calls.filter(call => call.kind === 'lifetime').length, 0)
  } finally { h.scope.stop() }
})

test('a JVM identity change discovered by an ordinary overview read refreshes uptime only once', async () => {
  const h = harness(), flags = []
  try {
    await flush()
    h.api.queryOverviewMBeans = async (node, signal, includeLifetime) => {
      flags.push(includeLifetime)
      const result = runtime(900000, 2000)
      if (!includeLifetime) {
        delete result['java.lang'].Runtime.runtime.Uptime
        result['java.lang'].Runtime.runtime['@attributes'] = result['java.lang'].Runtime.runtime['@attributes'].filter(attribute => attribute.name !== 'Uptime')
      }
      return { sources: [result] }
    }
    await h.view.loadMBeans(); await flush()
    assert.deepEqual(flags, [false, true]); assert.equal(uptime(h).seconds, 2)
    await h.view.loadMBeans(); await flush(); assert.deepEqual(flags, [false, true, false])
  } finally { h.scope.stop() }
})

test('lifetime uses a local monotonic clock across tools, freezes on disconnect and reloads the real restart baseline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000000 })
  const h = harness()
  try {
    await flush(); assert.equal(uptime(h).minutes, 1)
    h.advance(6000); t.mock.timers.tick(6000); await flush()
    assert.equal(uptime(h).seconds, 6); assert.equal(h.calls.filter(call => call.kind === 'mbean').length, 1)
    h.enabled.value = false; await flush()
    h.advance(2000); t.mock.timers.tick(2000); await flush()
    assert.equal(uptime(h).seconds, 8)
    assert.equal(h.calls.filter(call => call.kind === 'lifetime').length, 0, 'tool switching uses the existing header baseline')
    h.connection.value = true; await flush(); const frozen = h.view.metrics.value.find(metric => metric.key === 'uptime').value
    h.advance(10000); t.mock.timers.tick(10000); await flush()
    assert.equal(h.view.metrics.value.find(metric => metric.key === 'uptime').value, frozen)
    h.api.queryMBeans = async () => runtime(900000, 2000)
    h.connection.value = false; await flush(); assert.equal(uptime(h).seconds, 2)
    assert.equal(h.view.metrics.value.find(metric => metric.key === 'startTime').value, new Date(900000).toLocaleString())
    h.advance(1000); t.mock.timers.tick(1000); await flush(); assert.equal(uptime(h).seconds, 3)
  } finally { h.scope.stop() }
})

test('a direct tool entry reads only lightweight lifetime; cancelled or missing initial runtime evidence may retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000000 })
  const direct = harness({ enabled: false })
  try {
    await flush(); assert.equal(direct.calls.filter(call => call.kind === 'lifetime').length, 1)
    assert.equal(direct.calls.filter(call => ['mbean', 'history'].includes(call.kind)).length, 0)
    direct.advance(3000); t.mock.timers.tick(3000); await flush(); assert.equal(uptime(direct).seconds, 3)
    assert.equal(direct.calls.length, 1)
  } finally { direct.scope.stop() }
  let complete, signal
  const cancelled = harness({ api: { queryOverviewMBeans: async (node, nextSignal) => { signal = nextSignal; return new Promise(done => complete = done) } } })
  try {
    await flush(); cancelled.enabled.value = false; await flush(); assert.equal(signal.aborted, true)
    assert.equal(cancelled.calls.filter(call => call.kind === 'lifetime').length, 1)
    complete({ sources: [runtime(1, 999999)], partial: false }); await flush()
    assert.equal(uptime(cancelled).minutes, 1)
  } finally { cancelled.scope.stop() }
  const flags = [], missing = harness({ api: { queryOverviewMBeans: async (node, signal, includeLifetime) => { flags.push(includeLifetime); return { sources: flags.length > 1 ? [runtime()] : [], partial: false } } } })
  try {
    await flush(); assert.equal(missing.view.metrics.value.find(metric => metric.key === 'uptime').value, undefined)
    await missing.view.loadMBeans(); assert.deepEqual(flags, [true, true]); assert.equal(uptime(missing).minutes, 1)
    await missing.view.loadMBeans(); assert.deepEqual(flags, [true, true, false])
  } finally { missing.scope.stop() }
})

test('history background refresh preserves evidence and its presentation on transient failure, but clears it on denial', async () => {
  let fail = false, forbidden = false
  const h = harness({ history: async () => { if (forbidden) throw { status: 403 }; if (fail) throw new Error('offline'); return {} } })
  try {
    await flush(); const before = h.view.history.data.value
    fail = true; h.view.loadHistory(); assert.equal(h.view.historyState.value.status, 'ready'); await flush()
    assert.equal(h.view.history.data.value, before); assert.equal(h.view.historyState.value.status, 'stale')
    forbidden = true; h.view.loadHistory(); await flush()
    assert.equal(h.view.history.data.value, undefined); assert.equal(h.view.historyState.value.status, 'forbidden')
  } finally { h.scope.stop() }
})


test('overview refresh delegates exactly one session request to the shared collector and respects tool activity and monitor access', async () => {
  const h = harness()
  try {
    await flush()
    assert.equal(h.calls.filter(call => call.kind === 'session-refresh').length, 0, 'mounting does not start a second session collector')
    h.view.refresh(); await flush()
    assert.deepEqual(h.calls.filter(call => call.kind === 'session-refresh'), [{ kind: 'session-refresh', node: 'node-a' }])
    h.enabled.value = false; await flush(); h.view.refresh(); await flush()
    assert.equal(h.calls.filter(call => call.kind === 'session-refresh').length, 1)
    h.enabled.value = true; await flush(); h.access.value = { query: true, monitor: false }; await flush(); h.view.refresh(); await flush()
    assert.equal(h.calls.filter(call => call.kind === 'session-refresh').length, 1)
  } finally { h.scope.stop() }
})
