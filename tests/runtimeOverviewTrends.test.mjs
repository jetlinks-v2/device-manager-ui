import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const names = ['org.jetlinks:type=EventBus,*', 'org.jetlinks:type=ThingsDataManager,*', 'org.jetlinks:type=SystemMonitorCollector,*', 'java.lang:type=Memory']
const raw = (attributes = { InMemorySize: 0 }, type = 'ThingsDataManager', domain = 'org.jetlinks', unavailable = []) => ({ [domain]: { [type]: { local: {
  '@objectName': `${domain}:type=${type},name=local`, '@attributes': Object.keys(attributes).map(name => ({ name, available: !unavailable.includes(name), readable: true, type: 'long' })), ...attributes,
} } } })
const session = (value = '0') => ({ supported: true, state: { status: 'ready', sampledAt: Date.now() }, sessions: value, keepOnline: '0', history: [{ timestamp: Date.now(), value }] })
function harness(support = true) {
  const snapshots = vue.shallowRef(new Map([['a', { ...session(), supported: support }]]))
  const modules = runtimeModules({ '../../RuntimeMonitor/useClusterSessions': { useClusterSessionContext: () => ({ snapshots }) } })
  const node = vue.ref('a'), enabled = vue.ref(true), identity = vue.ref('alice'), interval = vue.ref(2), effect = vue.effectScope()
  const operational = modules.load('views/link/diagnostics/useNodeOperationalSignals.ts')
  const overview = modules.load('views/link/diagnostics/overview/useOverviewTrends.ts')
  const view = effect.run(() => operational.useNodeOperationalSignals(node, enabled, identity, vue.computed(() => snapshots.value.get(node.value)?.supported), interval))
  const trends = effect.run(() => overview.useOverviewTrends(node, view.cache))
  function capability(value, target = node.value) { const next = new Map(snapshots.value); if (value === 'removed') next.delete(target); else next.set(target, { ...session(), supported: value }); snapshots.value = next }
  return { ...modules, node, enabled, identity, interval, effect, view, trends, snapshots, capability,
    push: (value = raw(), index = 1, target = node.value, at = Date.now()) => modules.collection.push(target, names[index], value, at),
    fail: (reason, index = 1) => modules.collection.fail(node.value, names[index], reason),
    pure: modules.load('views/link/diagnostics/overview/gaugeHistory.ts') }
}
test('cache declares only after confirmed session capability; exact capability and genuine zero drive trends', () => {
  const h = harness(undefined)
  try {
    h.capability(undefined)
    assert.equal(h.collection.entries[1].demand.enabled, false); assert.deepEqual(h.trends.value, [])
    h.capability(true); assert.equal(h.collection.entries[1].demand.enabled, true)
    h.push(); assert.deepEqual(h.trends.value.map(value => value.key), ['sessions', 'property-cache'])
    assert.equal(h.trends.value[0].history[0].value, '0'); assert.equal(h.trends.value[1].history[0].value, '0')
    h.access.value = { monitor: true, sessions: false }; assert.equal(h.trends.value[0].details, undefined)
    h.capability(false); assert.deepEqual(h.trends.value, []); assert.equal(h.view.cache.value, undefined)
    h.capability(true); h.push(); assert.equal(h.trends.value.length, 2)
    h.capability('removed'); assert.equal(h.view.cache.value, undefined)
    h.access.value = { monitor: false }; assert.equal(h.view.signals.value.length, 0)
  } finally { h.effect.stop() }
})
test('absent and wrong-domain capability hide cache; missing and unsafe values remain unknown, decimal longs stay exact', () => {
  const h = harness()
  try {
    h.push(raw({ InMemorySize: '9223372036854775807', DirtyCount: '0', QueueDepth: '0' }))
    assert.equal(h.view.cache.value.inMemorySize, '9223372036854775807')
    assert.equal(h.trends.value[1].history[0].value, '9223372036854775807')
    h.push(raw({ InMemorySize: Number.MAX_SAFE_INTEGER + 1, DirtyCount: '7' }))
    assert.equal(h.view.cache.value.inMemorySize, undefined); assert.equal(h.view.cache.value.dirtyCount, '7')
    assert.equal(h.view.cache.value.history.at(-1).value, undefined)
    h.push(raw({ InMemorySize: 1 }, 'ThingsDataManager', 'org.jetlinks', ['InMemorySize']))
    assert.equal(h.view.cache.value.inMemorySize, undefined)
    h.push(raw({ InMemorySize: 99 }, 'ThingsDataManager', 'other.domain'))
    assert.equal(h.view.cache.value.supported, false); assert.equal(h.trends.value.length, 1)
    h.push({}); assert.equal(h.trends.value.length, 1)
    h.push(); assert.equal(h.trends.value[1].history.length, 1)
  } finally { h.effect.stop() }
})
test('failure adds gaps, preserves sampledAt and evidence; denial clears it and recovery starts fresh', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 })
  const h = harness()
  try {
    h.push(raw({ InMemorySize: '9', DirtyCount: '3' })); t.mock.timers.tick(30000); h.fail(new Error('offline'))
    assert.equal(h.view.cache.value.state.status, 'stale'); assert.equal(h.view.cache.value.state.sampledAt, 1000)
    assert.equal(h.view.cache.value.inMemorySize, '9'); assert.equal(h.view.cache.value.history.at(-1).value, undefined)
    assert.equal(h.pure.gaugeObservation(h.trends.value[1].history).retained.value, '9')
    h.fail({ status: 403 }); assert.equal(h.trends.value.length, 1); assert.equal(h.view.cache.value.history.length, 0)
    h.push(); assert.equal(h.view.cache.value.history.length, 1)
  } finally { h.effect.stop() }
})
test('pause withdraws declarations and interrupts trends; resumed samples retain prior evidence', () => {
  const h = harness()
  try {
    h.push(raw({ InMemorySize: 1 })); h.enabled.value = false
    assert.ok(h.collection.entries.every(entry => !entry.demand.enabled))
    assert.equal(h.view.cache.value.history.at(-1).value, undefined)
    h.push(raw({ InMemorySize: 99 })); assert.equal(h.view.cache.value.inMemorySize, '1')
    h.enabled.value = true; h.push(raw({ InMemorySize: 2 }))
    assert.equal(h.view.cache.value.inMemorySize, '2')
    assert.ok(h.view.cache.value.history.some(point => point.value === '1'))
  } finally { h.effect.stop() }
})
test('page interval does not create a private timer; refresh delegates and retains cache', () => {
  const h = harness()
  try {
    h.push(); const before = h.view.cache.value
    h.interval.value = 10; assert.equal(h.view.cache.value, before)
    h.view.refresh(); assert.equal(h.collection.refreshes.length, 1)
    h.enabled.value = false; h.view.refresh(); assert.equal(h.collection.refreshes.length, 1)
  } finally { h.effect.stop() }
})
test('node history is isolated; identity, capability and permission changes release sensitive evidence', () => {
  const h = harness()
  try {
    h.push(raw({ InMemorySize: 1 }))
    h.capability(true, 'b'); h.node.value = 'b'; h.push(raw({ InMemorySize: 2 }))
    assert.equal(h.view.cache.value.inMemorySize, '2')
    h.node.value = 'a'; assert.equal(h.view.cache.value.inMemorySize, '1')
    h.identity.value = 'bob'; assert.equal(h.view.cache.value, undefined)
    h.push(raw({ InMemorySize: 99 }), 1, 'b'); assert.equal(h.view.cache.value, undefined)
    h.push(); h.access.value = { monitor: false }; assert.equal(h.view.cache.value, undefined)
    h.push(raw({ InMemorySize: 98 })); assert.equal(h.view.cache.value, undefined)
    h.access.value = { monitor: true }; h.push(); assert.equal(h.view.cache.value.history.length, 1)
  } finally { h.effect.stop() }
})
test('attention excludes topology and lifetime totals and independently retains actionable failures', () => {
  const h = harness()
  try {
    h.push(raw({ TotalTopics: 7, TotalSubscribers: 8, StructuredBufferedEventCount: 0 }, 'EventBus'), 0)
    h.push(raw({ FailureCount: 99, LastFailureTime: 1000, LastSuccessTime: 2000 }, 'SystemMonitorCollector'), 2)
    assert.deepEqual(h.view.signals.value, [])
    h.push(raw({ StructuredBufferedEventCount: 2 }, 'EventBus'), 0); assert.equal(h.view.signals.value.length, 1)
    h.fail(new Error('offline'), 0); assert.equal(h.view.signals.value[0].stale, true)
    h.fail({ status: 403 }, 0); assert.deepEqual(h.view.signals.value, [])
  } finally { h.effect.stop() }
})
test('ten-minute gauge history is bounded; gaps break deltas and decimal changes remain exact', () => {
  const h = harness()
  try {
    let history = []
    for (let i = 0; i <= 1000; i++) history = h.pure.appendGaugeSample(history, i * 1000, String(i))
    assert.equal(history.length, 601)
    history = h.pure.appendGaugeSample(history, 2000000, '1'); assert.equal(history.length, 1)
    history = h.pure.appendGaugeSample(history, 2030000, '0'); assert.equal(h.pure.gaugeObservation(history).change, '-1')
    history = h.pure.appendGaugeSample(history, 2060000); history = h.pure.appendGaugeSample(history, 2090000, '10')
    assert.equal(h.pure.gaugeObservation(history).change, undefined); assert.equal(h.pure.gaugePlot(history)[2][1], null)
    assert.equal(h.pure.gaugeObservation([{ timestamp: 0, value: '9223372036854775806' }, { timestamp: 30000, value: '9223372036854775807' }]).change, '1')
  } finally { h.effect.stop() }
})
test('capability withdrawal disables only cache and disposal removes all consumers', () => {
  const h = harness()
  h.push(); h.capability(undefined)
  assert.equal(h.collection.entries[1].demand.enabled, false); assert.equal(h.collection.entries[0].demand.enabled, true)
  h.push(raw({ InMemorySize: 99 })); assert.equal(h.view.cache.value, undefined)
  h.capability(true); h.push(); assert.equal(h.view.cache.value.history.length, 1)
  h.effect.stop(); assert.ok(h.collection.entries.every(entry => !entry.live))
})
