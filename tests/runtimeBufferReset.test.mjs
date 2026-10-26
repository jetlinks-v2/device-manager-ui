import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
const objectName = name => `org.jetlinks:name=${name},type=PersistenceBuffer`
const resetOperation = { name: 'resetMonitor', signature: [], parameters: [], returnType: 'void' }
const deferred = () => { let done; return { promise: new Promise(resolve => done = resolve), done: value => done(value) } }
const raw = (written = '9007199254740993', attempted = '9007199254740992', operations = [resetOperation]) => ({ 'org.jetlinks': { PersistenceBuffer: Object.fromEntries(['alpha', 'beta'].map(name => [name, {
  '@objectName': objectName(name), '@name': name, '@operations': operations,
  '@attributes': ['Remainder', 'DeadSize', 'Monitor', 'WriterPending', 'Wip'].map(name => ({ name, readable: true, available: true, type: name === 'Monitor' ? 'java.lang.String' : 'long' })),
  Remainder: 7, DeadSize: 2, WriterPending: 3, Wip: 4, Monitor: `queue(in ${written},out ${attempted},dropped 0);`,
}])) } })
function harness(options = {}) {
  const cache = new Map(), reads = [], invocations = [], identity = vue.ref('alice:p1'), discoveryScope = vue.ref('alice:p1')
  const nodes = vue.ref(['node-a']), enabled = vue.ref(true), operationEnabled = vue.ref(true), allowed = vue.ref(true), nodeId = vue.ref('node-a')
  const tab = vue.ref('mbean'), access = vue.ref({ monitor: true, invoke: true })
  const route = vue.reactive({ path: '/infrastructure/runtime-monitor', query: {} })
  let reader = options.reader ?? (async () => raw()), catalogReader = options.catalogReader ?? (async () => raw()), invoker = async () => ({ success: true }), collector
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => {
      if (id === 'vue') return { ...vue, onActivated: () => {}, onDeactivated: () => {} }
      if (id === 'vue-router') return { useRoute: () => route, useRouter: () => ({ replace: async value => route.query = value.query }) }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
      if (id === '@jetlinks-web-core/hooks/useDiagnosticQuery') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts'))
      if (id.endsWith('api/link/diagnostics')) return {
        queryBufferMBeans: (node, signal) => { reads.push({ node, signal }); return reader(node, signal) },
        queryMBeans: (node, signal, pattern, attributes) => catalogReader(node, signal, pattern, attributes),
        invokeMBean: (node, invocation, signal) => { invocations.push({ node, invocation, signal }); return invoker(node, invocation, signal) },
      }
      if (id.endsWith('useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
      if (id.endsWith('useDiagnosticPreferences')) return { useDiagnosticPreferences: () => undefined }
      if (id.endsWith('useClusterBuffers')) return { ...load(resolve(dirname(path), `${id}.ts`)), useClusterBufferContext: () => options.withoutCollector ? undefined : collector }
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }, module, module.exports)
    cache.set(path, module.exports); return module.exports
  }
  const collectorModule = load(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/useClusterBuffers.ts'))
  const actionModule = load(resolve(import.meta.dirname, '../views/link/diagnostics/useBufferReset.ts')), scope = vue.effectScope()
  collector = scope.run(() => collectorModule.useClusterBuffers(nodes, enabled, identity, vue.ref(5), discoveryScope))
  const beans = vue.computed(() => collector.snapshots.value.get(nodeId.value)?.beans ?? [])
  const action = scope.run(() => actionModule.useBufferReset(nodeId, operationEnabled, identity, beans, allowed, collector))
  const generic = options.generic ? scope.run(() => load(resolve(import.meta.dirname, '../views/link/diagnostics/useNodeDiagnostics.ts')).useNodeDiagnostics(nodeId, tab)) : undefined
  const invokeGeneric = (overrides = {}) => {
    const bean = generic.beans.value.find(bean => bean.objectName === generic.selectedBean.value)
    return generic.invoke({ bean, operation: bean.operations[0], args: [], ...overrides })
  }
  return { scope, collector, action, generic, invokeGeneric, reads, invocations, identity, discoveryScope, nodes, nodeId, enabled, operationEnabled, allowed, access, tab,
    setReader: value => reader = value, setInvoker: value => invoker = value }
}

test('single-queue reset requires read-plus-invoke permission, active context and exact empty-signature metadata', async () => {
  const h = harness()
  try {
    await flush()
    h.allowed.value = false; await h.action.reset(objectName('alpha'))
    h.allowed.value = true; h.operationEnabled.value = false; await h.action.reset(objectName('alpha'))
    h.operationEnabled.value = true; await h.action.reset(''); await h.action.reset(objectName('unknown'))
    h.setReader(async () => raw('1', '2', [{ ...resetOperation, signature: ['java.lang.String'], parameters: [{ name: 'arg', type: 'java.lang.String' }] }]))
    h.collector.refresh('node-a'); await flush(); await h.action.reset(objectName('alpha'))
    assert.equal(h.invocations.length, 0)
    h.setReader(async () => raw()); h.collector.refresh('node-a'); await flush()
    await h.action.reset(objectName('alpha')); await flush()
    assert.equal(h.invocations.length, 1)
    assert.equal(h.invocations[0].node, 'node-a'); assert.equal(h.invocations[0].invocation.bean.objectName, objectName('alpha'))
    assert.deepEqual(h.invocations[0].invocation.operation.signature, []); assert.deepEqual(h.invocations[0].invocation.args, [])
    assert.equal(h.action.state.value.status, 'ready')
  } finally { h.scope.stop() }
})

test('reset aborts the crossing sample, refreshes once on success and cuts only selected queue counter epoch', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness(), oldRead = deferred(), operation = deferred()
  try {
    await flush()
    const before = h.collector.snapshots.value.get('node-a')
    assert.equal(before.queues[0].written, '9007199254740993')
    assert.equal(before.queues[0].attempted, '9007199254740992')
    assert.equal(before.queues[0].writerPending, 3); assert.equal(before.queues[0].wip, 4)
    h.setReader(() => oldRead.promise); t.mock.timers.tick(5000); await flush()
    const crossed = h.reads.at(-1), count = h.reads.length
    h.setInvoker(() => operation.promise)
    const pending = h.action.reset(objectName('alpha'))
    assert.equal(crossed.signal.aborted, true)
    t.mock.timers.tick(20000); await flush(); assert.equal(h.reads.length, count, 'periodic sampling pauses for the in-flight reset')
    h.setReader(async () => raw('0', '0'))
    operation.done({ success: true }); await pending; await flush()
    assert.equal(h.reads.length, count + 1, 'successful reset creates exactly one fresh sample')
    const current = h.collector.snapshots.value.get('node-a'), last = current.history.at(-1)
    assert.equal(last.buffers.find(item => item.objectName === objectName('alpha')).counterEpoch, 1)
    assert.equal(last.buffers.find(item => item.objectName === objectName('beta')).counterEpoch, 0)
    assert.equal(current.history[0], before.history[0]); assert.equal(current.pending, 14); assert.equal(current.dead, 4)
    oldRead.done(raw('9223372036854775807', '1')); await flush()
    assert.equal(h.collector.snapshots.value.get('node-a'), current, 'cancelled pre-reset result cannot become the new baseline')
  } finally { h.scope.stop() }
})

test('the generic MBean entry uses canonical metadata and the same barrier while preserving its single invocation result', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness({ generic: true }), oldRead = deferred(), operation = deferred()
  try {
    await flush(); await flush()
    h.setReader(() => oldRead.promise); t.mock.timers.tick(5000); await flush()
    const crossed = h.reads.at(-1), count = h.reads.length
    h.setInvoker(() => operation.promise)
    const selected = h.generic.beans.value.find(bean => bean.objectName === h.generic.selectedBean.value)
    const pending = h.invokeGeneric({ bean: { ...selected, domain: 'untrusted', type: 'Example' }, operation: { ...resetOperation, parameters: [{ name: 'spoof', type: 'long' }] } })
    assert.equal(crossed.signal.aborted, true)
    assert.equal(h.invocations.length, 1)
    assert.equal(h.invocations[0].invocation.bean.domain, 'org.jetlinks')
    assert.equal(h.invocations[0].invocation.bean.type, 'PersistenceBuffer')
    assert.deepEqual(h.invocations[0].invocation.operation.parameters, [])
    t.mock.timers.tick(10000); await flush(); assert.equal(h.reads.length, count)
    h.setReader(async () => raw('0', '0'))
    operation.done({ success: true, result: { reset: true } }); await pending; await flush()
    assert.equal(h.reads.length, count + 1)
    assert.deepEqual(h.generic.invocation.data.value, { reset: true })
    assert.equal(h.collector.snapshots.value.get('node-a').history.at(-1).buffers[0].counterEpoch, 1)
    const current = h.collector.snapshots.value.get('node-a')
    oldRead.done(raw('9223372036854775807', '1')); await flush()
    assert.equal(h.collector.snapshots.value.get('node-a'), current)
    await h.action.reset(objectName('alpha')); await flush()
    assert.equal(h.invocations.length, 2, 'each UI action invokes transport once')
    assert.equal(h.collector.snapshots.value.get('node-a').history.at(-1).buffers[0].counterEpoch, 2, 'overview and generic entry advance one shared epoch')
  } finally { h.scope.stop() }
})

test('a generic reset before the first Buffer sample still isolates that sample and creates the first epoch', async () => {
  const oldRead = deferred(), h = harness({ generic: true, reader: () => oldRead.promise })
  try {
    await flush(); await flush()
    assert.equal(h.collector.snapshots.value.get('node-a').queues.length, 0)
    h.setReader(async () => raw('0', '0'))
    await h.invokeGeneric(); await flush()
    assert.equal(h.reads[0].signal.aborted, true)
    assert.equal(h.invocations.length, 1); assert.equal(h.reads.length, 2)
    const current = h.collector.snapshots.value.get('node-a')
    assert.equal(current.history.length, 1); assert.equal(current.history[0].buffers[0].counterEpoch, 1)
    oldRead.done(raw()); await flush(); assert.equal(h.collector.snapshots.value.get('node-a'), current)
  } finally { h.scope.stop() }
})

test('a recognized generic reset refuses missing sessions, removed targets and concurrent resets without sending twice', async () => {
  for (const unavailable of ['missing-session', 'removed-target', 'concurrent-reset']) {
    const h = harness({ generic: true, withoutCollector: unavailable === 'missing-session' }), operation = deferred()
    try {
      await flush(); await flush()
      let pending
      if (unavailable === 'removed-target') { h.nodes.value = []; await flush() }
      if (unavailable === 'concurrent-reset') { h.setInvoker(() => operation.promise); pending = h.action.reset(objectName('alpha')) }
      const count = h.invocations.length
      await h.invokeGeneric()
      assert.equal(h.invocations.length, count)
      assert.equal(h.generic.invocation.state.value.status, 'error')
      assert.equal(h.generic.invocation.state.value.message, 'RuntimeMonitor.bufferResetUnavailable')
      assert.ok(h.generic.beans.value.length, 'a transient collection barrier error does not discard MBean metadata')
      if (pending) { operation.done({ success: true }); await pending; await flush() }
    } finally { h.scope.stop() }
  }
})

test('same-name MBean methods in another domain or with an argument remain generic operations', async () => {
  for (const variant of ['other-domain', 'overload']) {
    const catalog = raw('1', '2', variant === 'overload' ? [{ ...resetOperation, signature: ['long'], parameters: [{ name: 'value', type: 'long' }] }] : [resetOperation])
    if (variant === 'other-domain') { catalog['other.domain'] = catalog['org.jetlinks']; delete catalog['org.jetlinks'] }
    const h = harness({ generic: true, withoutCollector: true, catalogReader: async () => catalog })
    try {
      await flush(); await flush()
      await h.invokeGeneric({ args: variant === 'overload' ? [3] : [] })
      assert.equal(h.invocations.length, 1); assert.equal(h.generic.invocation.state.value.status, 'ready')
      assert.equal(h.collector.snapshots.value.get('node-a').history.at(-1).buffers[0].counterEpoch, 0)
    } finally { h.scope.stop() }
  }
})

test('failed reset keeps evidence and does not retry; node or identity changes cancel without late refresh or status leakage', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness()
  try {
    await flush(); const before = h.collector.snapshots.value.get('node-a'), count = h.reads.length
    h.setInvoker(async () => ({ success: false, message: 'reset refused' }))
    await h.action.reset(objectName('alpha')); await flush()
    assert.equal(h.action.state.value.status, 'error'); assert.equal(h.action.state.value.message, 'reset refused')
    assert.equal(h.reads.length, count); assert.equal(h.invocations.length, 1)
    const retained = h.collector.snapshots.value.get('node-a')
    assert.equal(retained.beans, before.beans); assert.equal(retained.history, before.history)
    assert.equal(retained.pending, before.pending); assert.equal(retained.dead, before.dead)
    assert.deepEqual(retained.diagnosticHistory.at(-1).queues, [], 'a possibly executed reset interrupts diagnostic continuity while retaining visible backlog evidence')
    const operation = deferred(); h.setInvoker(() => operation.promise)
    const pending = h.action.reset(objectName('alpha'))
    h.nodeId.value = 'node-b'; assert.equal(h.invocations.at(-1).signal.aborted, true); assert.equal(h.action.state.value.status, 'ready')
    operation.done({ success: true }); await pending; await flush()
    assert.equal(h.reads.length, count, 'cancelled reset success cannot trigger an immediate read on a different node')
    h.nodeId.value = 'node-a'; const next = deferred(); h.setInvoker(() => next.promise)
    const second = h.action.reset(objectName('alpha'))
    h.identity.value = 'bob:p2'; assert.equal(h.invocations.at(-1).signal.aborted, true)
    next.done({ success: true }); await second; await flush()
    assert.equal(h.collector.snapshots.value.size, 0); assert.equal(h.action.state.value.status, 'ready'); assert.equal(h.reads.length, count)
    h.discoveryScope.value = 'bob:p2'; await flush(); assert.equal(h.reads.length, count + 1)
  } finally { h.scope.stop() }
})

test('both entries retain an epoch gap after failure or cancellation even if reset counters exceed the old total', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  for (const entry of ['overview', 'mbean']) for (const outcome of ['failed-response', 'cancelled-response']) {
    const h = harness({ generic: entry === 'mbean' }), operation = deferred()
    try {
      await flush(); await flush(); const previous = h.collector.snapshots.value.get('node-a').history[0]
      h.setInvoker(() => operation.promise)
      const pending = entry === 'mbean' ? h.invokeGeneric() : h.action.reset(objectName('alpha'))
      if (outcome === 'failed-response') { operation.done({ success: false, message: 'response lost after execution' }); await pending }
      else { h.nodeId.value = 'node-b'; await flush(); assert.equal(h.invocations[0].signal.aborted, true) }
      h.setReader(async () => raw('9223372036854775806', '9223372036854775805'))
      t.mock.timers.tick(5000); await flush()
      const history = h.collector.snapshots.value.get('node-a').history
      assert.equal(history[0], previous); assert.equal(previous.buffers[0].counterEpoch, 0)
      assert.equal(history.at(-1).buffers.find(item => item.objectName === objectName('alpha')).counterEpoch, 1)
      assert.equal(history.at(-1).buffers.find(item => item.objectName === objectName('beta')).counterEpoch, 0)
      assert.equal(history.at(-1).buffers[0].written, '9223372036854775806', 'a counter larger than the old total still cannot bridge the reset epoch')
      if (outcome === 'cancelled-response') { operation.done({ success: true }); await pending; await flush() }
      assert.equal(h.reads.length, 2); assert.equal(h.invocations.length, 1)
    } finally { h.scope.stop() }
  }
})
