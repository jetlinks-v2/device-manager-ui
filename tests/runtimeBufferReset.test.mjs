import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { declarations } from './helpers/mbeanDeclarations.mjs'

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
  const collection = declarations(vue)
  const cache = new Map(), reads = [], invocations = [], identity = vue.ref('alice:p1'), discoveryScope = vue.ref('alice:p1')
  const nodes = vue.ref(['node-a']), enabled = vue.ref(true), operationEnabled = vue.ref(true), allowed = vue.ref(true), nodeId = vue.ref('node-a')
  const tab = vue.ref('mbean'), access = vue.ref({ monitor: true, invoke: true })
  const route = vue.reactive({ path: '/infrastructure/runtime-monitor', query: {} })
  let reader = options.reader ?? (async () => raw()), catalogReader = options.catalogReader ?? (async () => raw()), invoker = async () => ({ success: true }), collector
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => {
      if (id.endsWith('collection/useMBeanCollection')) return collection
      if (id === 'vue') return { ...vue, onActivated: () => {}, onDeactivated: () => {} }
      if (id === 'vue-router') return { useRoute: () => route, useRouter: () => ({ replace: async value => route.query = value.query }) }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts'))
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
    collection, push: (value = raw(), node = 'node-a') => collection.push(node, 'org.jetlinks:type=PersistenceBuffer,*', value), setReader: value => reader = value, setInvoker: value => invoker = value }
}

test('single queue reset requires permission, active context and exact empty signature metadata', async () => {
  const h = harness()
  try {
    h.push(); h.allowed.value = false; await h.action.reset(objectName('alpha'))
    h.allowed.value = true; h.operationEnabled.value = false; await h.action.reset(objectName('alpha'))
    h.operationEnabled.value = true; await h.action.reset(''); await h.action.reset(objectName('unknown'))
    h.push(raw('1', '2', [{ ...resetOperation, signature: ['java.lang.String'], parameters: [{ name: 'arg', type: 'java.lang.String' }] }]))
    await h.action.reset(objectName('alpha')); assert.equal(h.invocations.length, 0)
    h.push(); await h.action.reset(objectName('alpha'))
    assert.equal(h.invocations.length, 1)
    assert.equal(h.invocations[0].node, 'node-a'); assert.equal(h.invocations[0].invocation.bean.objectName, objectName('alpha'))
    assert.deepEqual(h.invocations[0].invocation.operation.signature, [])
    assert.deepEqual(h.invocations[0].invocation.args, [])
  } finally { h.scope.stop() }
})
test('reset withdraws node demand during invocation and cuts only the selected queue epoch', async () => {
  const h = harness(), operation = deferred()
  try {
    h.push(); const before = h.collector.snapshots.value.get('node-a')
    assert.equal(before.queues[0].written, '9007199254740993')
    assert.equal(before.queues[0].attempted, '9007199254740992')
    assert.equal(before.queues[0].writerPending, 3); assert.equal(before.queues[0].wip, 4)
    h.setInvoker(() => operation.promise); const pending = h.action.reset(objectName('alpha'))
    assert.deepEqual(h.collection.entries[0].demand.nodeIds, [])
    h.push(raw('9223372036854775807', '1'))
    assert.equal(h.collector.snapshots.value.get('node-a').history.length, 1)
    operation.done({ success: true }); await pending
    assert.deepEqual(h.collection.entries[0].demand.nodeIds, ['node-a'])
    h.push(raw('0', '0'))
    const current = h.collector.snapshots.value.get('node-a'), last = current.history.at(-1)
    assert.equal(last.buffers[0].counterEpoch, 1); assert.equal(last.buffers[1].counterEpoch, 0)
    assert.equal(current.history[0], before.history[0]); assert.equal(current.pending, 14); assert.equal(current.dead, 4)
    assert.equal(h.collection.refreshes.length, 0, 'resumed declaration provides the fresh read without a second explicit refresh')
  } finally { h.scope.stop() }
})
test('generic MBean entry uses canonical metadata, shared barrier and a single invocation result', async () => {
  const h = harness({ generic: true }), operation = deferred()
  try {
    h.push(); await flush(); h.setInvoker(() => operation.promise)
    const selected = h.generic.beans.value.find(bean => bean.objectName === h.generic.selectedBean.value)
    const pending = h.invokeGeneric({ bean: { ...selected, domain: 'untrusted', type: 'Example' }, operation: { ...resetOperation, parameters: [{ name: 'spoof', type: 'long' }] } })
    assert.deepEqual(h.collection.entries[0].demand.nodeIds, [])
    assert.equal(h.invocations[0].invocation.bean.domain, 'org.jetlinks')
    assert.equal(h.invocations[0].invocation.bean.type, 'PersistenceBuffer')
    assert.deepEqual(h.invocations[0].invocation.operation.parameters, [])
    operation.done({ success: true, result: { reset: true } }); await pending; h.push(raw('0', '0'))
    assert.deepEqual(h.generic.invocation.data.value, { reset: true })
    assert.equal(h.collector.snapshots.value.get('node-a').history.at(-1).buffers[0].counterEpoch, 1)
    await h.action.reset(objectName('alpha')); h.push(raw('0', '0'))
    assert.equal(h.invocations.length, 2)
    assert.equal(h.collector.snapshots.value.get('node-a').history.at(-1).buffers[0].counterEpoch, 2)
  } finally { h.scope.stop() }
})
test('generic reset before first sample still establishes its first epoch and ignores crossing samples', async () => {
  const h = harness({ generic: true }), operation = deferred()
  try {
    await flush(); h.setInvoker(() => operation.promise); const pending = h.invokeGeneric()
    h.push(); assert.equal(h.collector.snapshots.value.get('node-a').queues.length, 0)
    operation.done({ success: true }); await pending; h.push(raw('0', '0'))
    assert.equal(h.invocations.length, 1)
    assert.equal(h.collector.snapshots.value.get('node-a').history[0].buffers[0].counterEpoch, 1)
  } finally { h.scope.stop() }
})
test('generic reset refuses missing collector, removed target and concurrent invocation without sending twice', async () => {
  for (const unavailable of ['missing-session', 'removed-target', 'concurrent-reset']) {
    const h = harness({ generic: true, withoutCollector: unavailable === 'missing-session' }), operation = deferred()
    try {
      h.push(); await flush(); let pending
      if (unavailable === 'removed-target') { h.nodes.value = []; await flush() }
      if (unavailable === 'concurrent-reset') { h.setInvoker(() => operation.promise); pending = h.action.reset(objectName('alpha')) }
      const count = h.invocations.length; await h.invokeGeneric()
      assert.equal(h.invocations.length, count); assert.equal(h.generic.invocation.state.value.status, 'error')
      assert.equal(h.generic.invocation.state.value.message, 'RuntimeMonitor.bufferResetUnavailable')
      assert.ok(h.generic.beans.value.length)
      if (pending) { operation.done({ success: true }); await pending }
    } finally { h.scope.stop() }
  }
})
test('same-name methods in other domains or with arguments remain generic operations', async () => {
  for (const variant of ['other-domain', 'overload']) {
    const catalog = raw('1', '2', variant === 'overload' ? [{ ...resetOperation, signature: ['long'], parameters: [{ name: 'value', type: 'long' }] }] : [resetOperation])
    if (variant === 'other-domain') { catalog['other.domain'] = catalog['org.jetlinks']; delete catalog['org.jetlinks']; for (const bean of Object.values(catalog['other.domain'].PersistenceBuffer)) bean['@objectName'] = bean['@objectName'].replace('org.jetlinks:', 'other.domain:') }
    const h = harness({ generic: true, catalogReader: async () => catalog })
    try {
      h.push(); await flush()
      await h.invokeGeneric(variant === 'overload' ? { args: [1] } : {})
      assert.equal(h.invocations.length, 1)
      assert.deepEqual(h.collection.entries[0].demand.nodeIds, ['node-a'])
      assert.equal(h.collector.snapshots.value.get('node-a').history[0].buffers[0].counterEpoch, 0)
    } finally { h.scope.stop() }
  }
})
test('failed reset keeps evidence without retry; node and identity changes cancel late completion', async () => {
  const h = harness()
  try {
    h.push(); const before = h.collector.snapshots.value.get('node-a')
    h.setInvoker(async () => ({ success: false, message: 'reset refused' })); await h.action.reset(objectName('alpha'))
    assert.equal(h.action.state.value.status, 'error'); assert.equal(h.action.state.value.message, 'reset refused')
    assert.equal(h.invocations.length, 1)
    const retained = h.collector.snapshots.value.get('node-a')
    assert.equal(retained.beans, before.beans); assert.equal(retained.history, before.history)
    assert.deepEqual(retained.diagnosticHistory.at(-1).queues, [])
    const operation = deferred(); h.setInvoker(() => operation.promise); const pending = h.action.reset(objectName('alpha'))
    h.nodeId.value = 'node-b'; assert.equal(h.invocations.at(-1).signal.aborted, true)
    operation.done({ success: true }); await pending
    assert.equal(h.action.state.value.status, 'ready')
    h.nodeId.value = 'node-a'; const next = deferred(); h.setInvoker(() => next.promise)
    const second = h.action.reset(objectName('alpha')); h.identity.value = 'bob'
    assert.equal(h.invocations.at(-1).signal.aborted, true); next.done({ success: true }); await second
    assert.equal(h.collector.snapshots.value.size, 0)
    h.push(); assert.equal(h.collector.snapshots.value.size, 0)
  } finally { h.scope.stop() }
})
test('both reset entries keep epoch gaps after failure or cancellation even when counters exceed old total', async () => {
  for (const entry of ['overview', 'mbean']) for (const outcome of ['failed', 'cancelled']) {
    const h = harness({ generic: entry === 'mbean' }), operation = deferred()
    try {
      h.push(); await flush(); const previous = h.collector.snapshots.value.get('node-a').history[0]
      h.setInvoker(() => operation.promise)
      const pending = entry === 'mbean' ? h.invokeGeneric() : h.action.reset(objectName('alpha'))
      if (outcome === 'failed') { operation.done({ success: false }); await pending }
      else { h.nodeId.value = 'node-b'; await flush(); assert.equal(h.invocations[0].signal.aborted, true) }
      h.push(raw('9223372036854775806', '9223372036854775805'))
      const history = h.collector.snapshots.value.get('node-a').history
      assert.equal(history[0], previous); assert.equal(previous.buffers[0].counterEpoch, 0)
      assert.equal(history.at(-1).buffers[0].counterEpoch, 1); assert.equal(history.at(-1).buffers[1].counterEpoch, 0)
      assert.equal(history.at(-1).buffers[0].written, '9223372036854775806')
      if (outcome === 'cancelled') { operation.done({ success: true }); await pending }
      assert.equal(h.invocations.length, 1)
    } finally { h.scope.stop() }
  }
})
