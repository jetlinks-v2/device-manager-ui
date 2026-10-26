import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
function loadTs(entry, overrides = {}) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => id === 'vue' ? vue : id in overrides ? overrides[id] : id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    new Function('require', 'module', 'exports', code)(imports, module, module.exports); cache.set(path, module.exports); return module.exports
  }
  return load(entry)
}
const base = resolve(import.meta.dirname, '../views/link/diagnostics/diagnosis')
const rules = loadTs(`${base}/bottleneckRules.ts`), evidence = loadTs(`${base}/bufferEvidence.ts`)
const origin = 1000000
const resources = (field, value, end = 60) => Array.from({ length: end / 10 + 1 }, (_, index) => ({ observedAt: origin + index * 10000, [field]: value }))
const queue = (values = {}) => ({ objectName: 'org.jetlinks:type=PersistenceBuffer,name=q', name: 'q', epoch: 0, pending: '10', written: '100', attempted: '90', dead: '0', dropped: '0', slowOperations: '0', operations: '20', ...values })
const buffers = (values = {}) => Array.from({ length: 7 }, (_, index) => ({ observedAt: origin + index * 10000, queues: [queue({ pending: String(10 + index), written: String(100 + index), ...values })] }))

test('CPU requires sustained evidence; a spike, missing data, stale samples or long gaps cannot diagnose', () => {
  const series = resources('cpuJvm', 90)
  assert.equal(rules.resourceBottlenecks(series.slice(0, 6), origin + 50000).length, 0)
  assert.equal(rules.resourceBottlenecks(series, origin + 60000)[0].key, 'applicationCpu')
  assert.equal(rules.resourceBottlenecks([{ observedAt: origin, cpuJvm: 99 }], origin).length, 0)
  const missing = series.map((point, index) => index === 3 ? { observedAt: point.observedAt } : point)
  assert.equal(rules.resourceBottlenecks(missing, origin + 60000).length, 0)
  assert.equal(rules.resourceBottlenecks(series, origin + 81000).length, 0)
  assert.equal(rules.resourceBottlenecks([series[0], series[1], series.at(-1)], origin + 60000).length, 0)
})

test('resource findings recover only below recovery threshold for thirty continuous seconds and deduplicate host CPU', () => {
  const series = resources('cpuJvm', 90).map(sample => ({ ...sample, cpuSystem: 95, heapUsage: 94 }))
  assert.deepEqual(rules.resourceBottlenecks(series, origin + 60000).map(value => value.key), ['applicationCpu', 'heap'])
  series.push({ observedAt: origin + 70000, cpuJvm: 65, heapUsage: 80 })
  series.push({ observedAt: origin + 80000, cpuJvm: 75, heapUsage: 88 })
  assert.equal(rules.resourceBottlenecks(series, origin + 80000).length, 2)
  for (const second of [90, 100, 110, 120]) series.push({ observedAt: origin + second * 1000, cpuJvm: 60, heapUsage: 80 })
  assert.equal(rules.resourceBottlenecks(series, origin + 120000).length, 0)
  const load = resources('loadPressure', 120)
  assert.equal(rules.resourceBottlenecks(load, origin + 60000)[0].key, 'hostLoad')
})

test('a latched finding in the recovery gray zone survives bounded history eviction until actual recovery', () => {
  let series = resources('cpuJvm', 90), issues = rules.resourceBottlenecks(series, origin + 60000)
  for (let second = 70; second <= 360; second += 10) {
    series = [...series.filter(sample => sample.observedAt > origin + second * 1000 - 180000), { observedAt: origin + second * 1000, cpuJvm: 75 }]
    issues = rules.resourceBottlenecks(series, origin + second * 1000, new Set(issues.map(value => value.key)))
    assert.equal(issues.length, 1)
  }
  for (let second = 370; second <= 400; second += 10) {
    series = [...series.filter(sample => sample.observedAt > origin + second * 1000 - 180000), { observedAt: origin + second * 1000, cpuJvm: 60 }]
    issues = rules.resourceBottlenecks(series, origin + second * 1000, new Set(issues.map(value => value.key)))
  }
  assert.equal(issues.length, 0)
})

test('sustained buffer backlog needs ongoing inflow and no drainage; missing fields, pauses and reset break evidence', () => {
  assert.equal(rules.bufferBottlenecks(buffers(), origin + 60000)[0].message, 'RuntimeMonitor.bottleneck.queueBacklog')
  assert.equal(rules.bufferBottlenecks(buffers({ written: '100' }), origin + 60000).length, 0)
  const draining = buffers(); draining[3].queues[0].pending = '1'
  assert.equal(rules.bufferBottlenecks(draining, origin + 60000).length, 0)
  const missing = buffers(); delete missing[3].queues[0].written
  assert.equal(rules.bufferBottlenecks(missing, origin + 60000).length, 0)
  const reset = buffers(); reset[3].queues[0].written = '0'
  assert.equal(rules.bufferBottlenecks(reset, origin + 60000).length, 0)
  const epoch = buffers(); epoch.at(-1).queues[0].epoch = 1
  assert.equal(rules.bufferBottlenecks(epoch, origin + 60000).length, 0)
  const pause = buffers(); pause[3].queues = []
  assert.equal(rules.bufferBottlenecks(pause, origin + 60000).length, 0)
  assert.equal(rules.bufferBottlenecks(buffers(), origin + 90000).length, 0)
})

test('database wording requires exact writer identity and recent slow batches; attempts and old errors are not successes or faults', () => {
  const history = buffers({ name: 'timescale-db-things-writer', slowOperations: '100', lastError: 'old error' })
  assert.equal(rules.bufferBottlenecks(history, origin + 60000)[0].message, 'RuntimeMonitor.bottleneck.queueBacklog')
  history.at(-1).queues[0].slowOperations = '101'
  assert.equal(rules.bufferBottlenecks(history, origin + 60000)[0].message, 'RuntimeMonitor.bottleneck.timescaleWrite')
  history.forEach(sample => sample.queues[0].name = 'something-timescale-db-things-writer')
  assert.equal(rules.bufferBottlenecks(history, origin + 60000)[0].message, 'RuntimeMonitor.bottleneck.queueBacklog')
  assert.equal(rules.bufferBottlenecks(buffers({ pending: '0', lastError: 'old error', dead: '90' }), origin + 60000).length, 0)
})

test('sixty-second sampling plus request latency can form a three-sample backlog window and report new failures', () => {
  const history = [0, 61000, 122000].map((elapsed, index) => ({ observedAt: origin + elapsed, queues: [queue({ pending: String(10 + index), written: String(100 + index) })] }))
  assert.equal(rules.bufferBottlenecks(history, origin + 122000, 100000)[0].message, 'RuntimeMonitor.bottleneck.queueBacklog')
  history.at(-1).queues[0].dead = '2'
  assert.equal(rules.bufferBottlenecks(history, origin + 122000, 100000)[0].values.count, '2')
})

test('failed queue increase and capacity drops are separate observations, not cumulative error alarms', () => {
  const history = buffers({ pending: '0' })
  history.at(-1).queues[0].dead = '3'
  let result = rules.bufferBottlenecks(history, origin + 60000)[0]
  assert.equal(result.message, 'RuntimeMonitor.bottleneck.queueFailures'); assert.equal(result.values.count, '3')
  history.at(-1).queues[0].dead = '0'; history.at(-1).queues[0].dropped = '9007199254740993'
  result = rules.bufferBottlenecks(history, origin + 60000)[0]
  assert.equal(result.message, 'RuntimeMonitor.bottleneck.queueDropped')
  assert.equal(result.values.count, BigInt('9007199254740993').toLocaleString())
  delete history[3].queues[0].dropped
  assert.equal(rules.bufferBottlenecks(history, origin + 60000).length, 0)
})

test('Monitor projection retains exact counters and nil is no error', () => {
  const parsed = evidence.monitorEvidence('\nqueue(in 9007199254740993,out 120,dropped 2);\nconsume(opt 20,cost 100 ms);\ndist[0-50ms(1),50-200ms(2),0.2-1s(3),1-5s(4),>5s(5)]\n')
  assert.equal(parsed.written, '9007199254740993'); assert.equal(parsed.attempted, '120'); assert.equal(parsed.slowOperations, '9')
  assert.deepEqual(evidence.monitorEvidence('x'.repeat(20000)), {})
  const bean = { domain: 'org.jetlinks', type: 'PersistenceBuffer', objectName: 'org.jetlinks:type=PersistenceBuffer,name=q', name: 'q', attributes: [{ name: 'LastError', available: true, value: 'nil' }] }
  assert.equal(evidence.bufferEvidence([bean], origin, new Map()).queues[0].lastError, undefined)
})

test('cache size alone is not pressure; dirty and queued growth with stalled commits is actionable', () => {
  const cache = [0, 30, 60].map((second, index) => ({ observedAt: origin + second * 1000, objectName: 'cache', dirty: String(10 + index), queue: String(2 + index), committedAt: '100' }))
  assert.equal(rules.cacheBottlenecks(cache, origin + 60000)[0].target.bean, 'cache')
  cache.at(-1).committedAt = '101'
  assert.equal(rules.cacheBottlenecks(cache, origin + 60000).length, 0)
  cache.at(-1).committedAt = '100'; delete cache[1].dirty
  assert.equal(rules.cacheBottlenecks(cache, origin + 60000).length, 0)
})

function hookHarness(interval = 3) {
  const access = vue.ref({ enter: true, query: true, monitor: true }), snapshots = vue.shallowRef(new Map()), scopeKey = vue.ref('alice:p1'), nodeId = vue.ref('node'), live = vue.shallowRef(), active = vue.ref(true), stale = vue.ref(false), cache = vue.shallowRef(), heap = vue.shallowRef()
  const module = loadTs(`${base}/useNodeBottlenecks.ts`, {
    '../../RuntimeMonitor/useClusterBuffers': { useClusterBufferContext: () => ({ snapshots }) },
    '../useDiagnosticsAccess': { useDiagnosticsAccess: () => access },
    '../useDiagnosticPreferences': { useDiagnosticPreferences: () => ({ value: vue.ref({ bufferIntervalSeconds: interval }) }) },
  })
  const scope = vue.effectScope(), view = scope.run(() => module.useNodeBottlenecks(nodeId, live, active, stale, scopeKey, cache, heap))
  return { view, scope, access, snapshots, scopeKey, nodeId, live, active, stale, cache, heap }
}
test('the freshness clock and reactivation cannot manufacture communication or CPU samples; revoke and scope clear evidence', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin })
  const h = hookHarness()
  try {
    h.live.value = { nodeId: 'node', cpuJvm: 95, cpuSampleAt: Date.now() }
    t.mock.timers.tick(70000)
    assert.equal(h.view.issues.value.length, 0, 'one live report cannot become sixty seconds of pressure')
    for (let index = 0; index <= 6; index++) { h.live.value = { nodeId: 'node', cpuJvm: 95, cpuSampleAt: Date.now() }; if (index < 6) t.mock.timers.tick(10000) }
    assert.equal(h.view.issues.value[0].retained, false)
    h.active.value = false; t.mock.timers.tick(60000); h.active.value = true
    assert.equal(h.view.issues.value[0].retained, true, 'returning to a tab retains old evidence without refreshing it')
    h.live.value = { nodeId: 'node', cpuJvm: 95, cpuSampleAt: Date.now() }
    assert.equal(h.view.issues.value.length, 0, 'a paused interval must rebuild its continuous window')
    for (let index = 0; index < 6; index++) { t.mock.timers.tick(10000); h.live.value = { nodeId: 'node', cpuJvm: 95, cpuSampleAt: Date.now() } }
    assert.equal(h.view.issues.value.length, 1)
    h.access.value = { enter: true, query: false, monitor: true }
    assert.equal(h.view.issues.value.length, 0)
    h.scopeKey.value = 'bob:p2'
    assert.equal(h.view.issues.value.length, 0)
  } finally { h.scope.stop() }
})

test('duplicate, backwards or absent CPU source stamps and repeated memory payloads cannot form continuous pressure', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin })
  const h = hookHarness()
  try {
    for (let index = 0; index <= 8; index++) {
      h.live.value = { nodeId: 'node', cpuJvm: 99, memoryJvm: 99, cpuSampleAt: index % 2 ? origin - 1 : origin }
      t.mock.timers.tick(10000)
    }
    assert.equal(h.view.issues.value.length, 0)
    for (let index = 0; index <= 8; index++) {
      h.live.value = { nodeId: 'node', cpuJvm: 99, memoryJvm: 99 }
      t.mock.timers.tick(10000)
    }
    assert.equal(h.view.issues.value.length, 0)
  } finally { h.scope.stop() }
})

test('a rejected future CPU timestamp cannot poison the accepted baseline; small clock skew is consistent', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin })
  const h = hookHarness()
  try {
    h.live.value = { nodeId: 'node', cpuJvm: 99, cpuSampleAt: Date.now() + 3600000 }
    for (let index = 0; index <= 6; index++) {
      h.live.value = { nodeId: 'node', cpuJvm: 95, cpuSampleAt: Date.now() + 3000 }
      if (index < 6) t.mock.timers.tick(10000)
    }
    assert.equal(h.view.issues.value[0].key, 'applicationCpu')
    assert.equal(h.view.issues.value[0].retained, false)
  } finally { h.scope.stop() }
})

test('real JMX heap observations support thirty-second sampling independently and clear on monitor revoke', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin })
  const h = hookHarness(30)
  try {
    for (let index = 0; index < 3; index++) {
      h.heap.value = { state: { status: 'ready', sampledAt: Date.now() }, usage: 95 }
      if (index < 2) t.mock.timers.tick(31000)
    }
    assert.equal(h.view.issues.value[0].key, 'heap')
    h.access.value = { enter: true, query: true, monitor: false }
    assert.equal(h.view.issues.value.length, 0)
    h.access.value = { enter: true, query: true, monitor: true }
    h.heap.value = { state: { status: 'ready', sampledAt: Date.now() + 1 } }
    assert.equal(h.view.issues.value.length, 0)
  } finally { h.scope.stop() }
})

test('three-second and sixty-second overview evidence both retain enough real history for sustained heap and cache pressure', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin })
  for (const interval of [3, 60]) {
    const h = hookHarness(interval)
    try {
      const count = interval === 3 ? 21 : 3
      for (let index = 0; index < count; index++) {
        h.heap.value = { state: { status: 'ready', sampledAt: Date.now() }, usage: 95 }
        h.cache.value = { supported: true, objectName: 'cache', state: { status: 'ready', sampledAt: Date.now() }, dirtyCount: String(index + 1), queueDepth: String(index + 1), lastCommitTime: '100', history: [{ timestamp: Date.now(), value: '100' }] }
        if (index < count - 1) t.mock.timers.tick(interval * 1000)
      }
      const issues = h.view.issues.value
      assert.ok(issues.some(value => value.key === 'heap' && value.retained === false), `heap remains actionable at ${interval}s`)
      assert.ok(issues.some(value => value.target.kind === 'cache' && value.retained === false), `cache remains actionable at ${interval}s`)
    } finally { h.scope.stop() }
  }
})

test('heap projection requires a real positive maximum, never committed capacity', () => {
  const projection = loadTs(resolve(base, '../useNodeOperationalSignals.ts'), {
    '../../../api/link/diagnostics': {}, './normalize': { normalizeMBeans: value => value }, './useDiagnosticsAccess': {}, './status': { diagnosticErrorState: () => ({ status: 'error' }) },
  }).heapEvidenceSnapshot
  const input = value => ({ status: 'fulfilled', value: [{ domain: 'java.lang', type: 'Memory', attributes: [{ name: 'HeapMemoryUsage', available: true, value }] }] })
  assert.equal(projection(input({ used: 95, max: 100 }), origin).usage, 95)
  assert.equal(projection(input({ used: 95, max: -1, committed: 100 }), origin).usage, undefined)
  assert.equal(projection(input({ used: 95, committed: 100 }), origin).usage, undefined)
})

test('a short source cache pause breaks the observation window without manufacturing a refreshed sample', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin })
  const h = hookHarness(30)
  const snapshot = (dirty, history = [{ timestamp: Date.now(), value: '100' }]) => ({ supported: true, objectName: 'cache', state: { status: 'ready', sampledAt: Date.now() }, dirtyCount: String(dirty), queueDepth: String(dirty), lastCommitTime: '100', history })
  try {
    h.cache.value = snapshot(1); t.mock.timers.tick(30000); h.cache.value = snapshot(2)
    t.mock.timers.tick(5000)
    h.cache.value = { ...h.cache.value, history: [...h.cache.value.history, { timestamp: Date.now() }] }
    t.mock.timers.tick(25000); h.cache.value = snapshot(3)
    assert.equal(h.view.issues.value.length, 0)
    t.mock.timers.tick(30000); h.cache.value = snapshot(4)
    assert.equal(h.view.issues.value.length, 0)
    t.mock.timers.tick(30000); h.cache.value = snapshot(5)
    assert.equal(h.view.issues.value[0].target.kind, 'cache')
  } finally { h.scope.stop() }
})

test('a missing field in a separate queue does not block an independent complete queue', t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: origin + 60000 })
  const h = hookHarness()
  try {
    const history = buffers().map(sample => ({ ...sample, queues: [...sample.queues, queue({ objectName: 'incomplete', pending: undefined })] }))
    h.snapshots.value = new Map([['node', { state: { status: 'stale', sampledAt: Date.now() }, diagnosticHistory: history }]])
    assert.equal(h.view.issues.value.length, 1)
    assert.equal(h.view.issues.value[0].retained, false)
  } finally { h.scope.stop() }
})

test('header combines fresh diagnoses with health severity and keeps old diagnoses separate', () => {
  const issue = { key: 'heap', retained: false }, retained = { key: 'cpu', retained: true }
  assert.equal(rules.nodeAttentionStatus(undefined, true, [issue]).level, 'warning')
  const health = { level: 'critical', evidence: [{ signal: 'diskCapacity', level: 'critical', values: [99] }] }
  const combined = rules.nodeAttentionStatus(health, true, [issue, retained])
  assert.equal(combined.count, 2); assert.equal(combined.level, 'error'); assert.equal(combined.retained.length, 1)
  const old = rules.nodeAttentionStatus(health, false, [retained])
  assert.equal(old.count, 0); assert.equal(old.level, 'default'); assert.equal(old.retained.length, 1)
  assert.equal(rules.nodeAttentionStatus(undefined, true, []).count, 0)
})
