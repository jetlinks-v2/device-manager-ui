import assert from 'node:assert/strict'
import test from 'node:test'
import { Observable } from 'rxjs'
import { loadManager } from './helpers/mbeanDeclarations.mjs'
import { runtimeModules } from './helpers/runtimeModules.mjs'
import * as vue from 'vue'

const flush = () => new Promise(done => queueMicrotask(done))
const demand = (nodeIds, attributes, name = 'test:type=Queue,*') => ({ nodeIds, attributes, name, enabled: true })
function harness() {
  const flows = []
  const manager = loadManager()(plan => new Observable(observer => {
    const flow = { plan, observer, closed: false }; flows.push(flow)
    return () => flow.closed = true
  }))
  manager.configure({ scope: 'alice:p1', interval: 2, enabled: true })
  return { manager, flows }
}
function sample(flow, nodeId, values = { Count: 0 }, sequence = 1, options = {}) {
  const query = flow.plan.queries.find(query => query.nodeIds.includes(nodeId) && query.name === 'test:type=Queue,*')
  flow.observer.next({ type: 'sample', nodeId, queryId: query.id, sequence, collectedAt: sequence * 1000, status: 'ready',
    beans: [{ objectName: 'test:name=one,type=Queue', domain: 'test', beanType: 'Queue', name: 'one', values, unavailableAttributes: [], ...options }] })
}
test('one flow merges repeated consumers and per-node projections without expanding detail history to the cluster', async () => {
  const { manager, flows } = harness(), received = []
  const a = manager.register(value => received.push(value)), b = manager.register(() => {}), c = manager.register(() => {})
  a.update(demand(['a', 'b'], ['Count'])); b.update(demand(['a'], ['RecentHistory'])); c.update(demand(['a', 'b'], ['Count']))
  await flush(); assert.equal(flows.length, 1)
  assert.deepEqual(flows[0].plan.queries.find(query => query.nodeIds.includes('b')).attributes, ['Count'])
  assert.deepEqual(flows[0].plan.queries.find(query => query.nodeIds.includes('a')).attributes, ['Count', 'RecentHistory'])
  assert.equal(flows[0].plan.interval, '2s')
  sample(flows[0], 'a', { Count: 0, RecentHistory: [1] })
  const raw = received[0].value.test.Queue['test:name=one,type=Queue']
  assert.equal(raw.Count, 0); assert.equal(raw.RecentHistory, undefined)
  c.dispose(); await flush(); assert.equal(flows.length, 1, 'removing a duplicate consumer preserves the stream')
  manager.dispose(); assert.equal(flows[0].closed, true)
})
test('plan changes cancel synchronously, reject old data and preserve metadata only within an identity', async () => {
  const { manager, flows } = harness(), rows = [], consumer = manager.register(value => rows.push(value))
  consumer.update(demand(['a'], ['Count', 'Missing'])); await flush()
  sample(flows[0], 'a', { Count: '9223372036854775807' }, 1, { operations: [{ name: 'reset', signature: [] }] })
  sample(flows[0], 'a', { Count: 2 }, 2)
  let bean = rows.at(-1).value.test.Queue['test:name=one,type=Queue']
  assert.equal(bean['@operations'].length, 1); assert.equal(bean['@attributes'].find(item => item.name === 'Missing').available, false)
  sample(flows[0], 'a', { Count: 99 }, 1); assert.equal(rows.length, 2, 'out-of-order stream sequence is rejected')
  consumer.update(demand(['b'], ['Count'])); assert.equal(flows[0].closed, true)
  sample(flows[0], 'a', { Count: 99 }, 3); assert.equal(rows.length, 2)
  await flush(); sample(flows[1], 'b'); assert.equal(rows.at(-1).nodeId, 'b')
  manager.configure({ scope: 'bob:p2', interval: 5, enabled: true }); assert.equal(flows[1].closed, true)
  await flush()
  sample(flows[2], 'b'); bean = rows.at(-1).value.test.Queue['test:name=one,type=Queue']
  assert.deepEqual(bean['@operations'], []); assert.equal(flows[2].plan.interval, '5s')
  manager.dispose()
})
test('transport retries retain finite state; denial never reconnects and disposal releases timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { manager, flows } = harness(), rows = [], consumer = manager.register(value => rows.push(value))
  consumer.update(demand(['a'], ['Count'])); await flush()
  flows[0].observer.error(new Error('offline')); assert.equal(rows[0].status, 'rejected')
  t.mock.timers.tick(1000); assert.equal(flows.length, 2)
  flows[1].observer.error(Object.assign(new Error('denied'), { status: 403 }))
  t.mock.timers.tick(60000); assert.equal(flows.length, 2)
  manager.dispose(); t.mock.timers.tick(60000); assert.equal(flows.length, 2)
})
test('page inactivity cancels immediately and all declarations removed leaves no network flow', async () => {
  const { manager, flows } = harness(), consumer = manager.register(() => {})
  consumer.update(demand(['a'], ['Count'])); await flush()
  manager.configure({ scope: 'alice:p1', interval: 2, enabled: false }); assert.equal(flows[0].closed, true)
  manager.configure({ scope: 'alice:p1', interval: 2, enabled: true }); await flush(); assert.equal(flows.length, 2)
  consumer.dispose(); assert.equal(flows[1].closed, true); await flush(); assert.equal(flows.length, 2)
  manager.dispose()
})

test('frame coalescing preserves first metadata, rejects malformed snapshots and cancels pending frames on errors', async t => {
  let callback, cancelled = 0
  globalThis.requestAnimationFrame = fn => { callback = fn; return 1 }
  globalThis.cancelAnimationFrame = () => { callback = undefined; cancelled++ }
  t.after(() => { delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame })
  const { manager, flows } = harness(), rows = [], consumer = manager.register(value => rows.push(value))
  consumer.update(demand(['a'], ['Count'])); await flush()
  sample(flows[0], 'a', { Count: 1 }, 1, { operations: [{ name: 'reset', signature: [] }] })
  sample(flows[0], 'a', { Count: 2 }, 2)
  assert.equal(rows.length, 0); callback()
  const bean = rows[0].value.test.Queue['test:name=one,type=Queue']
  assert.equal(bean.Count, 2); assert.equal(bean['@operations'].length, 1)
  sample(flows[0], 'a', { Count: 3 }, 3); flows[0].observer.error({ status: 403 })
  assert.equal(rows.at(-1).status, 'rejected'); assert.equal(callback, undefined); assert.equal(cancelled, 1)
  manager.refresh()
  await flush()
  flows[1].observer.next({ type: 'sample', queryId: 'q0', nodeId: 'a', sequence: 1, collectedAt: 1000, status: 'ready', beans: null })
  assert.equal(rows.at(-1).status, 'rejected'); assert.equal(flows[1].closed, true)
  manager.dispose()
})

test('the page provider pauses hidden documents, reports a history gap and removes its visibility listener on disposal', async t => {
  const events = new EventTarget(), flows = []
  globalThis.document = { hidden: false, addEventListener: (...args) => events.addEventListener(...args), removeEventListener: (...args) => events.removeEventListener(...args) }
  t.after(() => { delete globalThis.document })
  const modules = runtimeModules({
    vue: { ...vue, provide() {} },
    './useMBeanCollection': { mbeanCollectionContext: Symbol() },
    '../../../../api/link/mbeanCollection': { streamMBeanCollection: plan => new Observable(observer => {
      const flow = { plan, observer, closed: false }; flows.push(flow); return () => flow.closed = true
    }) },
  })
  const scope = vue.effectScope(), provider = modules.load('views/link/diagnostics/collection/provideMBeanCollection.ts')
  const manager = scope.run(() => provider.provideMBeanCollection(vue.ref('alice'), vue.ref(true), vue.ref(2)))
  const rows = [], consumer = manager.register(value => rows.push(value))
  consumer.update(demand(['a'], ['Count'])); await flush()
  assert.equal(flows.length, 1)
  document.hidden = true; events.dispatchEvent(new Event('visibilitychange'))
  assert.equal(flows[0].closed, true); assert.equal(rows.at(-1).status, 'rejected')
  document.hidden = false; events.dispatchEvent(new Event('visibilitychange'))
  await flush()
  assert.equal(flows.length, 2)
  scope.stop(); assert.equal(flows[1].closed, true)
  events.dispatchEvent(new Event('visibilitychange')); assert.equal(flows.length, 2)
})

test('multiple business refreshes in one action cancel immediately and establish only one replacement request', async () => {
  const { manager, flows } = harness(), consumer = manager.register(() => {})
  consumer.update(demand(['a'], ['Count'])); await flush()
  manager.refresh(); manager.refresh(); manager.refresh()
  assert.equal(flows[0].closed, true); assert.equal(flows.length, 1)
  await flush(); assert.equal(flows.length, 2)
  manager.dispose()
})
