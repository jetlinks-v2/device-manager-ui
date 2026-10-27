import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
const fulfilled = value => ({ status: 'fulfilled', value })
const rejected = reason => ({ status: 'rejected', reason })
const raw = (attributes = { InMemorySize: 0 }, type = 'ThingsDataManager', domain = 'org.jetlinks', unavailable = []) => ({ [domain]: { [type]: { local: {
  '@objectName': `${domain}:type=${type},name=local`, '@attributes': Object.keys(attributes).map(name => ({ name, available: !unavailable.includes(name), readable: true, type: 'long' })), ...attributes,
} } } })
const sources = (cache = raw()) => [fulfilled({}), fulfilled(cache), fulfilled({})]
const session = (value = '0') => ({ supported: true, state: { status: 'ready', sampledAt: Date.now() }, sessions: value, keepOnline: '0', history: [{ timestamp: Date.now(), value }] })

function harness(loader = async () => sources(), initiallySupported = true) {
  const modules = new Map(), node = vue.ref('a'), enabled = vue.ref(true), identity = vue.ref('alice:p1'), interval = vue.ref(2), access = vue.ref({ monitor: true, sessions: true })
  const snapshots = vue.shallowRef(new Map([['a', { ...session(), supported: initiallySupported === 'unknown' ? undefined : initiallySupported }]])), calls = []
  function load(path) {
    if (modules.has(path)) return modules.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return vue
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts'))
      if (id.endsWith('useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
      if (id.endsWith('useClusterSessions')) return { useClusterSessionContext: () => ({ snapshots }) }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return {}
      if (id.endsWith('api/link/diagnostics')) return { queryOperationalMBeans: (node, signal, includeCache) => { calls.push({ node, signal, includeCache }); return loader(node, signal, includeCache) } }
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports); modules.set(path, module.exports); return module.exports
  }
  const path = resolve(import.meta.dirname, '../views/link/diagnostics'), operational = load(`${path}/useNodeOperationalSignals.ts`), overview = load(`${path}/overview/useOverviewTrends.ts`), pure = load(`${path}/overview/gaugeHistory.ts`), effect = vue.effectScope()
  const supported = vue.computed(() => snapshots.value.get(node.value)?.supported)
  const view = effect.run(() => operational.useNodeOperationalSignals(node, enabled, identity, supported, interval))
  const trends = effect.run(() => overview.useOverviewTrends(node, view.cache))
  function capability(value, target = node.value) { const next = new Map(snapshots.value); if (value === 'removed') next.delete(target); else next.set(target, { ...session(), supported: value }); snapshots.value = next }
  return { view, trends, pure, effect, node, enabled, identity, interval, access, snapshots, calls, capability }
}

test('both trends require confirmed session capability; cache also requires exact own capability, and genuine zero displays', async () => {
  const h = harness(async (_node, _signal, cache) => cache ? sources() : sources({}), 'unknown')
  try {
    await flush(); assert.equal(h.calls[0].includeCache, false); assert.deepEqual(h.trends.value, [])
    h.capability(true); await flush()
    assert.equal(h.calls.at(-1).includeCache, true)
    assert.deepEqual(h.trends.value.map(value => value.key), ['sessions', 'property-cache'])
    assert.equal(h.trends.value[0].history[0].value, '0'); assert.equal(h.trends.value[1].history[0].value, '0')
    h.access.value = { monitor: true, sessions: false }; await flush()
    assert.equal(h.trends.value[0].details, undefined, 'connection action obeys the session menu button')
    assert.equal(h.trends.value.length, 2, 'read-only monitor still displays real capability and zero counts')
    h.capability(false); await flush()
    assert.deepEqual(h.trends.value, []); assert.equal(h.view.cache.value, undefined); assert.equal(h.calls.at(-1).includeCache, false)
    h.capability(true); await flush(); assert.equal(h.trends.value.length, 2)
    h.capability('removed'); await flush(); assert.deepEqual(h.trends.value, []); assert.equal(h.view.cache.value, undefined)
    h.access.value = { monitor: false, sessions: true }; await flush()
    assert.equal(h.view.signals.value.length, 0); assert.equal(h.view.cache.value, undefined)
  } finally { h.effect.stop() }
})

test('absent and wrong-domain cache MBeans hide the strip; partial or unsafe values remain missing while exact decimal longs stay precise', async () => {
  let response = raw({ InMemorySize: '9223372036854775807', DirtyCount: '0', QueueDepth: '0' })
  const h = harness(async () => sources(response))
  try {
    await flush(); assert.equal(h.view.cache.value.inMemorySize, '9223372036854775807')
    assert.equal(h.trends.value[1].history[0].value, '9223372036854775807')
    assert.equal(h.trends.value[1].dirtyCount, '0'); assert.equal(h.trends.value[1].facts.find(fact => fact.label === 'RuntimeMonitor.overviewDirtyQueue').value, '0')
    response = raw({ InMemorySize: Number.MAX_SAFE_INTEGER + 1, DirtyCount: '7' }); await h.view.refresh()
    assert.equal(h.view.cache.value.inMemorySize, undefined); assert.equal(h.view.cache.value.dirtyCount, '7')
    assert.equal(h.view.cache.value.history.at(-1).value, undefined); assert.equal(h.trends.value.length, 2)
    assert.equal(h.trends.value[1].dirtyCount, '7'); assert.equal(h.trends.value[1].facts.some(fact => fact.label === 'RuntimeMonitor.overviewDirtyQueue'), false)
    response = raw({ InMemorySize: 1, DirtyCount: 3 }, 'ThingsDataManager', 'org.jetlinks', ['InMemorySize']); await h.view.refresh()
    assert.equal(h.view.cache.value.inMemorySize, undefined, 'unavailable metadata wins over a numeric field')
    response = raw({ InMemorySize: 99 }, 'ThingsDataManager', 'other.domain'); await h.view.refresh()
    assert.equal(h.view.cache.value.supported, false); assert.equal(h.trends.value.length, 1)
    response = {}; await h.view.refresh(); assert.equal(h.trends.value.length, 1)
    response = raw({ InMemorySize: 0 }); await h.view.refresh(); assert.equal(h.trends.value[1].history.length, 1); assert.equal(h.trends.value[1].history[0].value, '0')
  } finally { h.effect.stop() }
})

test('cache failure appends gaps without advancing its last valid time; denial removes evidence and recovery starts real sampling', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  let source = fulfilled(raw({ InMemorySize: '9', DirtyCount: '3' }))
  const h = harness(async () => [fulfilled({}), source, fulfilled({})])
  try {
    await flush(); assert.equal(h.view.cache.value.state.sampledAt, 1000)
    source = rejected(new Error('offline')); t.mock.timers.tick(30000); await flush()
    assert.equal(h.view.cache.value.state.status, 'stale'); assert.equal(h.view.cache.value.state.sampledAt, 1000)
    assert.equal(h.view.cache.value.inMemorySize, '9'); assert.equal(h.view.cache.value.history.at(-1).value, undefined)
    assert.equal(h.trends.value[1].dirtyCount, '3'); assert.equal(h.trends.value[1].state.sampledAt, 1000)
    assert.equal(h.pure.gaugeObservation(h.trends.value[1].history).retained.value, '9')
    source = rejected({ status: 403 }); await h.view.refresh(); assert.equal(h.trends.value.length, 1); assert.equal(h.view.cache.value.history.length, 0)
    source = fulfilled(raw({ InMemorySize: 0 })); await h.view.refresh(); assert.equal(h.trends.value.length, 2)
    assert.equal(h.view.cache.value.history.length, 1); assert.equal(h.pure.gaugeObservation(h.view.cache.value.history).collecting, true)
  } finally { h.effect.stop() }
})

test('3 second cache polling waits after completion, never overlaps, pauses on Tab changes and rejects canceled late responses after resume', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const pending = [], h = harness((node, signal, cache) => new Promise(done => pending.push({ node, signal, cache, done })))
  try {
    assert.equal(pending.length, 1)
    t.mock.timers.tick(90000); await flush(); assert.equal(pending.length, 1)
    pending[0].done(sources(raw({ InMemorySize: 1 }))); await flush()
    t.mock.timers.tick(1999); await flush(); assert.equal(pending.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(pending.length, 2)
    h.enabled.value = false; await flush(); assert.equal(pending[1].signal.aborted, true)
    assert.equal(h.view.cache.value.inMemorySize, '1'); assert.equal(h.view.cache.value.history.at(-1).value, undefined)
    t.mock.timers.tick(60000); await flush(); assert.equal(pending.length, 2)
    h.enabled.value = true; await flush(); assert.equal(pending.length, 3)
    pending[1].done(sources(raw({ InMemorySize: 99 }))); await flush(); assert.equal(h.view.cache.value.inMemorySize, '1')
    pending[2].done(sources(raw({ InMemorySize: 2 }))); await flush(); assert.equal(h.view.cache.value.inMemorySize, '2')
    assert.ok(h.view.cache.value.history.some(point => point.value === '1')); assert.ok(h.view.cache.value.history.some(point => point.value === undefined))
  } finally { h.effect.stop() }
})

test('overview interval updates preserve cache evidence and apply after completion without canceling or overlapping reads', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const pending = [], h = harness((_node, signal) => new Promise(done => pending.push({ done, signal })))
  try {
    pending[0].done(sources(raw({ InMemorySize: 1 }))); await flush()
    h.interval.value = 10
    t.mock.timers.tick(9999); await flush(); assert.equal(pending.length, 1)
    t.mock.timers.tick(1); await flush(); assert.equal(pending.length, 2)
    h.interval.value = 2
    t.mock.timers.tick(60000); await flush(); assert.equal(pending.length, 2)
    assert.equal(pending[1].signal.aborted, false)
    pending[1].done(sources(raw({ InMemorySize: 2 }))); await flush()
    assert.equal(h.view.cache.value.history.length, 2)
    assert.equal(h.view.cache.value.history[0].value, '1')
    t.mock.timers.tick(1999); await flush(); assert.equal(pending.length, 2)
    t.mock.timers.tick(1); await flush(); assert.equal(pending.length, 3)
  } finally { h.effect.stop() }
})

test('node switches retain each node history; capability removal, scope and permission cleanup isolate all in-flight responses', async () => {
  const pending = [], h = harness((node, signal, cache) => new Promise(done => pending.push({ node, signal, cache, done })))
  try {
    pending[0].done(sources(raw({ InMemorySize: 1 }))); await flush()
    h.capability(true, 'b'); h.node.value = 'b'; await flush(); pending.at(-1).done(sources(raw({ InMemorySize: 2 }))); await flush()
    assert.equal(h.view.cache.value.inMemorySize, '2')
    h.node.value = 'a'; await flush(); assert.equal(h.view.cache.value.inMemorySize, '1')
    const staleNode = pending.at(-1)
    h.identity.value = 'bob:p2'; await flush(); assert.equal(staleNode.signal.aborted, true); assert.equal(h.view.cache.value, undefined)
    staleNode.done(sources(raw({ InMemorySize: 99 }))); await flush(); assert.equal(h.view.cache.value, undefined)
    const next = pending.at(-1); h.access.value = { monitor: false, sessions: true }; await flush()
    assert.equal(next.signal.aborted, true); next.done(sources(raw({ InMemorySize: 98 }))); await flush(); assert.equal(h.view.cache.value, undefined)
    h.access.value = { monitor: true, sessions: true }; await flush(); pending.at(-1).done(sources(raw({ InMemorySize: 0 }))); await flush()
    assert.equal(h.view.cache.value.history.length, 1)
    h.enabled.value = false; h.capability('removed'); await flush(); assert.equal(h.view.cache.value, undefined)
  } finally { h.effect.stop() }
})

test('default attention excludes raw topology and lifetime counters and only includes current gauge or recent failure evidence', async () => {
  const h = harness(async () => [fulfilled(raw({ TotalTopics: 7, TotalSubscribers: 8, StructuredBufferedEventCount: 0 }, 'EventBus')), fulfilled(raw()), fulfilled(raw({ FailureCount: 99, LastFailureTime: 1000, LastSuccessTime: 2000 }, 'SystemMonitorCollector'))])
  try {
    await flush(); assert.deepEqual(h.view.signals.value, [])
  } finally { h.effect.stop() }
})

test('history is limited to ten minutes and bounded under manual refresh; missing samples break deltas and large decimal changes remain exact', () => {
  const h = harness()
  try {
    const { appendGaugeSample, gaugeObservation, gaugePlot } = h.pure
    let history = []
    for (let i = 0; i <= 1000; i++) history = appendGaugeSample(history, i * 1000, String(i))
    assert.equal(history.length, 601); assert.ok(history.every(point => point.timestamp >= 400000))
    history = appendGaugeSample(history, 2000000, '1'); assert.equal(history.length, 1); assert.equal(gaugeObservation(history).collecting, true)
    history = appendGaugeSample(history, 2030000, '0'); assert.equal(gaugeObservation(history).change, '-1')
    history = appendGaugeSample(history, 2060000); history = appendGaugeSample(history, 2090000, '10')
    assert.equal(gaugeObservation(history).change, undefined); assert.equal(gaugePlot(history)[2][1], null)
    const exact = [{ timestamp: 0, value: '9223372036854775806' }, { timestamp: 30000, value: '9223372036854775807' }]
    assert.equal(gaugeObservation(exact).change, '1'); assert.deepEqual(gaugePlot(exact), [[0, 0], [30000, 1]])
  } finally { h.effect.stop() }
})


test('capability withdrawal cancels cache reads and ignores a late result after capability recovers', async () => {
  const pending = [], h = harness((node, signal, cache) => new Promise(done => pending.push({ node, signal, cache, done })))
  try {
    assert.equal(pending[0].cache, true)
    h.capability(undefined); await flush()
    assert.equal(pending[0].signal.aborted, true); assert.equal(pending.at(-1).cache, false)
    h.capability(true); await flush()
    assert.equal(pending[1].signal.aborted, true); assert.equal(pending.at(-1).cache, true)
    pending[0].done(sources(raw({ InMemorySize: 99 }))); pending[1].done(sources(raw({ InMemorySize: 88 }))); await flush()
    assert.equal(h.view.cache.value, undefined)
    pending[2].done(sources(raw({ InMemorySize: 0 }))); await flush()
    assert.equal(h.view.cache.value.inMemorySize, '0'); assert.equal(h.view.cache.value.history.length, 1)
  } finally { h.effect.stop() }
})
