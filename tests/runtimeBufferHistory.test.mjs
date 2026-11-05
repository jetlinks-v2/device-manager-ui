import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

function harness() {
  const requests = [], observation = runtimeModules().load('../../jetlinks-web-core/src/components/RuntimeDiagnostics/buffer/observation.ts')
  const history = runtimeModules().load('../../jetlinks-web-core/src/components/RuntimeDiagnostics/buffer/history.ts')
  const shared = runtimeModules({
    '@jetlinks-web-core/components/RuntimeDiagnostics': { ...observation, ...history },
    '../../../api/link/diagnostics': { queryMBeans: (nodeId, signal, objectName, attributes) => new Promise(resolve => requests.push({ nodeId, signal, objectName, attributes, resolve })) },
  })
  const name = 'org.jetlinks:type=PersistenceBuffer,name=queue'
  const snapshot = { StartTime: 1, StatisticsStartTime: 1, SampleTime: 2000, ReadTime: 2100, Generation: 1, WindowMillis: 1000,
    RowsEnabled: true, ZoneId: 'Asia/Shanghai', TodayStartTime: 1, Written: '1', Attempted: '0', Values: {}, TodayPeaks: {} }
  const props = vue.reactive({ nodeId: 'node', scopeKey: 'alice:p1', active: true, permitted: true,
    beans: [{ objectName: name, domain: 'org.jetlinks', type: 'PersistenceBuffer', name: 'queue', attributes: [{ name: 'ObservationSnapshot', available: true, value: snapshot }] }] })
  const scope = vue.effectScope()
  const view = scope.run(() => shared.load('views/link/diagnostics/useBufferHistory.ts').useBufferHistory(props))
  const raw = hour => ({ 'org.jetlinks': { PersistenceBuffer: { [name]: { '@objectName': name, '@name': 'queue',
    '@attributes': [{ name: hour ? 'HourHistory' : 'RecentHistory', available: true, readable: true }],
    [hour ? 'HourHistory' : 'RecentHistory']: { Snapshot: snapshot, Points: {} } } } } })
  const bean = (name, values = {}, overrides = {}) => ({ objectName: `org.jetlinks:type=PersistenceBuffer,name=${name}`, domain: 'org.jetlinks', type: 'PersistenceBuffer', name,
    attributes: [{ name: 'ObservationSnapshot', available: true, value: { ...snapshot, ...overrides,
      Values: Object.fromEntries(Object.entries(values).map(([Metric, Value]) => [Metric, { Metric, Value, Time: snapshot.SampleTime }])) } }] })
  return { props, scope, view, requests, raw, bean }
}
const flush = () => new Promise(done => setImmediate(done))

test('history requests one exact queue only on open, switch and refresh, with cancellation', async () => {
  const h = harness()
  try {
    assert.equal(h.requests.length, 0)
    h.view.open.value = true
    assert.equal(h.requests.length, 1)
    assert.deepEqual(h.requests[0].attributes, ['RecentHistory'])
    assert.equal(h.requests[0].objectName, 'org.jetlinks:type=PersistenceBuffer,name=queue')
    h.view.range.value = 'hour'
    assert.equal(h.requests[0].signal.aborted, true)
    assert.deepEqual(h.requests[1].attributes, ['HourHistory'])
    h.requests[1].resolve(h.raw(true)); await flush()
    assert.equal(h.view.query.data.value.hour, true)
    h.requests[0].resolve(h.raw(false)); await flush()
    assert.equal(h.view.query.data.value.hour, true, 'late response cannot replace current range')
    h.props.beans[0].attributes[0].value = { ...h.props.beans[0].attributes[0].value, ReadTime: 2200 }
    assert.equal(h.requests.length, 2, 'ordinary summary updates do not fetch full histories')
    h.view.open.value = false
    assert.equal(h.view.query.data.value, undefined)
  } finally { h.scope.stop() }
})

test('identity, node, permission loss and disposal clear history and abort in-flight requests', () => {
  for (const change of [h => h.props.scopeKey = 'bob:p2', h => h.props.nodeId = 'other', h => h.props.permitted = false, h => h.props.active = false, h => h.scope.stop()]) {
    const h = harness()
    try {
      h.view.open.value = true
      const request = h.requests[0]
      change(h)
      assert.equal(request.signal.aborted, true)
      assert.equal(h.view.query.data.value, undefined)
      assert.equal(h.view.query.state.value.status, 'ready')
    } finally { h.scope.stop() }
  }
})

test('opening prioritizes retained failures, pending work, activity and today peaks without querying the directory', () => {
  const h = harness()
  try {
    const peak = value => ({ TodayPeaks: { WrittenRate: { Metric: 'WrittenRate', Value: value, Time: 1000 } } })
    h.props.beans = [h.bean('quiet', { WrittenRate: 0, Pending: 0 }), h.bean('earlier', { WrittenRate: 0, Pending: 0 }, peak(200)),
      h.bean('active', { WrittenRate: 10, Pending: 0 }), h.bean('pending', { WrittenRate: 0, Pending: 20 }),
      h.bean('failed', { WrittenRate: 0, Pending: 0, Dead: 2 })]
    assert.equal(h.requests.length, 0)
    h.view.show()
    assert.deepEqual(h.view.orderedQueues.value.map(queue => queue.name), ['failed', 'pending', 'active', 'earlier', 'quiet'])
    assert.equal(h.view.selected.value.name, 'failed')
    assert.equal(h.requests.length, 1)
    h.view.filter.value = 'pending'
    assert.deepEqual(h.view.visibleQueues.value.map(queue => queue.name), ['pending'])
    assert.equal(h.view.selected.value.name, 'failed', 'filtering must not silently change the history target')
    h.view.filter.value = 'failed'
    assert.deepEqual(h.view.visibleQueues.value.map(queue => queue.name), ['failed'])
    assert.equal(h.requests.length, 1)
  } finally { h.scope.stop() }
})

test('sample updates keep queue positions and selection, append new queues, and never fetch history', () => {
  const h = harness()
  try {
    h.props.beans = [h.bean('one', { WrittenRate: 1, Pending: 1 }), h.bean('two', { WrittenRate: 2, Pending: 0 })]
    h.view.show()
    h.view.objectName.value = h.props.beans[1].objectName
    const positions = h.view.orderedQueues.value.map(queue => queue.objectName)
    const requests = h.requests.length
    h.props.beans = [h.bean('two', { WrittenRate: 1000, Pending: 100 }), h.bean('one', { WrittenRate: 0, Pending: 0 }), h.bean('new', { Dead: 10 })]
    assert.deepEqual(h.view.orderedQueues.value.map(queue => queue.objectName), [...positions, h.props.beans[2].objectName])
    assert.equal(h.view.selected.value.name, 'two')
    assert.equal(h.view.selected.value.rate, 1000)
    assert.equal(h.requests.length, requests)
    h.view.open.value = false
    h.view.show()
    assert.equal(h.view.selected.value.name, 'two', 'reopening preserves a deliberate selection')
    assert.equal(h.view.orderedQueues.value[0].name, 'new', 'entry ordering can be recomputed when reopened')
  } finally { h.scope.stop() }
})

test('unknown and stale values stay unknown, and cumulative or old errors do not imply current failures', () => {
  const h = harness()
  try {
    h.props.beans = [h.bean('unknown', {}), h.bean('old-error', { WrittenRate: 4, ErrorRate: 10 }, { ReadTime: 10000, Errors: '99' }),
      h.bean('recovered', { WrittenRate: 0, Dead: 0, ErrorRate: 0 }, { Errors: '99', RowsEnabled: false })]
    h.view.show()
    const unknown = h.view.queues.value.find(queue => queue.name === 'unknown')
    assert.equal(unknown.rate, undefined)
    assert.equal(unknown.pending, undefined)
    assert.equal(unknown.peak, undefined)
    assert.equal(h.view.queues.value.find(queue => queue.name === 'old-error').rate, undefined)
    h.view.filter.value = 'failed'
    assert.equal(h.view.visibleQueues.value.length, 0)
    h.view.filter.value = 'pending'
    assert.equal(h.view.visibleQueues.value.length, 0)
    assert.equal(h.requests.length, 1)
  } finally { h.scope.stop() }
})

test('queue removal cancels its history, selects an available queue, and empty lists clear pending requests', () => {
  const h = harness()
  try {
    h.props.beans = [h.bean('one', { Pending: 1 }), h.bean('two', { Pending: 0 })]
    h.view.show()
    const first = h.requests[0]
    h.props.beans = [h.props.beans[1]]
    assert.equal(first.signal.aborted, true)
    assert.equal(h.view.selected.value.name, 'two')
    assert.equal(h.requests.length, 2)
    h.props.beans = []
    assert.equal(h.requests[1].signal.aborted, true)
    assert.equal(h.view.query.data.value, undefined)
    assert.equal(h.view.query.state.value.status, 'ready')
    assert.equal(h.view.selected.value, undefined)
  } finally { h.scope.stop() }
})

test('current interval errors are visible even without retained items, while recovered error text is ignored', () => {
  const h = harness()
  try {
    const recovered = h.bean('recovered', { Pending: 0, Dead: 0, ErrorRate: 0 })
    recovered.attributes.push({ name: 'LastError', available: true, value: 'an earlier failure' })
    h.props.beans = [recovered, h.bean('retrying', { Pending: 0, Dead: 0, ErrorRate: 1 })]
    h.view.show()
    assert.equal(h.view.selected.value.name, 'retrying')
    h.view.filter.value = 'failed'
    assert.deepEqual(h.view.visibleQueues.value.map(queue => queue.name), ['retrying'])
    assert.equal(h.requests.length, 1)
  } finally { h.scope.stop() }
})

test('legacy queues remain selectable with exact counters and adjacent rates, without reading unsupported history', () => {
  const h = harness()
  try {
    const legacy = { ...h.props.beans[0], name: 'legacy', objectName: 'org.jetlinks:type=PersistenceBuffer,name=legacy', attributes: [
      { name: 'Remainder', available: true, value: 3 }, { name: 'DeadSize', available: true, value: 1 },
      { name: 'Monitor', available: true, value: 'queue(in 9007199254740993,out 9007199254740990,dropped 0)' },
    ] }
    h.props.beans = [legacy, h.bean('modern', { WrittenRate: 2, Pending: 0 })]
    h.props.history = [
      { sampledAt: 1000, buffers: [{ objectName: legacy.objectName, written: '9007199254740991', attempted: '9007199254740986' }] },
      { sampledAt: 2000, buffers: [{ objectName: legacy.objectName, written: '9007199254740993', attempted: '9007199254740990' }] },
    ]
    h.view.show()
    assert.equal(h.view.selected.value.name, 'legacy')
    assert.equal(h.view.selected.value.pending, 3)
    assert.equal(h.view.selected.value.dead, 1)
    assert.equal(h.view.selected.value.written, '9007199254740993')
    assert.equal(h.view.selected.value.attempted, '9007199254740990')
    assert.equal(h.view.selected.value.rate, 2)
    assert.equal(h.view.selected.value.attemptedRate, 4)
    assert.equal(h.view.selected.value.peak, undefined)
    assert.equal(h.requests.length, 0)
    h.view.objectName.value = h.props.beans[1].objectName
    assert.equal(h.requests.length, 1)
    h.view.objectName.value = legacy.objectName
    assert.equal(h.requests[0].signal.aborted, true)
    assert.equal(h.view.query.data.value, undefined)
    h.view.range.value = 'hour'; h.view.load()
    assert.equal(h.requests.length, 1)
  } finally { h.scope.stop() }
})
