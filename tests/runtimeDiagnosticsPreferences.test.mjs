import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const load = (path, imports = {}) => {
  const module = { exports: {} }
  const { code } = transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(id => imports[id], module, module.exports)
  return module.exports
}
const pure = load('../views/link/diagnostics/preferences.ts')
const { createDiagnosticPreferences } = load('../views/link/diagnostics/useDiagnosticPreferences.ts', { vue, './preferences': pure })

test('browser preferences only retain bounded display settings', () => {
  const saved = pure.sanitizeDiagnosticPreferences({ version: 1, nodeId: 'a', tool: 'logs', token: 'secret', following: true, nodes: {
    a: { bean: 'jetlinks:type=Buffer,name=a', mbeanDisplay: { expandedKeys: ['a'], section: 'attributes' }, bufferFilter: 'pending', logDisplay: { level: 'ERROR', wrap: true }, keyword: 'private', args: ['secret'], records: ['private'] },
  } })
  assert.deepEqual(saved, { version: 1, nodeId: 'a', tool: 'logs', nodes: { a: {
    bean: 'jetlinks:type=Buffer,name=a', mbeanDisplay: { expandedKeys: ['a'], section: 'attributes' }, bufferFilter: 'pending', logDisplay: { level: 'ERROR', wrap: true },
  } } })
  assert.deepEqual(pure.sanitizeDiagnosticPreferences({ version: 0, nodeId: 'old' }), pure.emptyDiagnosticPreferences())
})

test('accounts and projects isolate restore, logout clears memory and disabled storage degrades', () => {
  const cache = new Map(), identity = vue.ref({ accountId: 'alice', projectId: 'p1' })
  const storage = { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) }
  const scope = vue.effectScope()
  try {
    const preferences = scope.run(() => createDiagnosticPreferences(identity, () => storage))
    preferences.update({ nodeId: 'node-a', tool: 'mbean' })
    identity.value = { accountId: 'alice', projectId: 'p2' }
    assert.equal(preferences.value.value.nodeId, undefined)
    preferences.update({ nodeId: 'node-b' })
    identity.value = { accountId: 'bob', projectId: 'p1' }
    assert.equal(preferences.value.value.nodeId, undefined)
    identity.value = { accountId: 'alice', projectId: 'p1' }
    assert.equal(preferences.value.value.nodeId, 'node-a')
    preferences.clear()
    assert.equal(cache.has(preferences.key.value), false)
    identity.value = { accountId: '', projectId: '' }
    preferences.update({ nodeId: 'session-only' })
    assert.equal(preferences.key.value, undefined)
    assert.equal(cache.size, 1)
    const disabled = scope.run(() => createDiagnosticPreferences(identity, () => { throw new Error('disabled') }))
    assert.doesNotThrow(() => disabled.update({ tool: 'logs' }))
    assert.doesNotThrow(() => disabled.clear())
  } finally { scope.stop() }
})

test('malformed stored JSON and prototype-like identities cannot leak configuration', () => {
  const identity = vue.ref({ accountId: 'alice', projectId: 'p1' })
  const scope = vue.effectScope()
  try {
    const preferences = scope.run(() => createDiagnosticPreferences(identity, () => ({ getItem: () => '{', setItem() {}, removeItem() {} })))
    assert.deepEqual(preferences.value.value, pure.emptyDiagnosticPreferences())
    preferences.updateNode('__proto__', { bean: 'jetlinks:type=Buffer,name=b' })
    assert.equal(Object.getPrototypeOf(preferences.value.value.nodes), Object.prototype)
    assert.equal(preferences.value.value.nodes.__proto__.bean, 'jetlinks:type=Buffer,name=b')
  } finally { scope.stop() }
})


test('Buffer interval is an account/project scoped display preference with a strict whitelist', () => {
  assert.equal(pure.diagnosticIntervalSeconds(undefined), 3)
  for (const value of [3, 5, 10, 30, 60]) assert.equal(pure.sanitizeDiagnosticPreferences({ version: 1, nodes: {}, bufferIntervalSeconds: value }).bufferIntervalSeconds, value)
  for (const value of [0, 1, -5, 5000, '3', '10', null]) assert.equal(pure.sanitizeDiagnosticPreferences({ version: 1, nodes: {}, bufferIntervalSeconds: value }).bufferIntervalSeconds, undefined)
  const identity = vue.ref({ accountId: 'alice', projectId: 'p1' }), values = new Map(), scope = vue.effectScope()
  try {
    const view = scope.run(() => createDiagnosticPreferences(identity, () => ({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) })))
    view.update({ bufferIntervalSeconds: 30 }); identity.value = { accountId: 'alice', projectId: 'p2' }
    assert.equal(view.value.value.bufferIntervalSeconds, undefined)
    identity.value = { accountId: 'alice', projectId: 'p1' }; assert.equal(view.value.value.bufferIntervalSeconds, 30)
    view.clear(); assert.equal(view.value.value.bufferIntervalSeconds, undefined)
  } finally { scope.stop() }
})

test('Buffer queue and chart preferences are bounded per node while all-queues selection clears a saved queue', () => {
  const source = { version: 1, nodes: {
    a: { bufferFilter: 'pending', bufferObjectName: 'org.jetlinks:name=queue,type=PersistenceBuffer', bufferView: 'throughput', reset: true },
    b: { bufferObjectName: 123, bufferView: 'unknown' }, c: { bufferObjectName: 'x'.repeat(4097) },
  } }
  const saved = pure.sanitizeDiagnosticPreferences(source)
  assert.deepEqual(saved.nodes.a, { bufferFilter: 'pending', bufferObjectName: 'org.jetlinks:name=queue,type=PersistenceBuffer', bufferView: 'throughput' })
  assert.deepEqual(saved.nodes.b, {}); assert.deepEqual(saved.nodes.c, {})
  const scope = vue.effectScope()
  try {
    const view = scope.run(() => createDiagnosticPreferences(vue.ref({ accountId: 'alice', projectId: 'p1' }), () => undefined))
    view.updateNode('a', saved.nodes.a); view.updateNode('a', { bufferObjectName: undefined, bufferView: 'backlog' })
    assert.deepEqual(view.value.value.nodes.a, { bufferFilter: 'pending', bufferView: 'backlog' })
  } finally { scope.stop() }
})

test('Buffer legend and scale persist per node, keep empty selection and sanitize bounded identities', () => {
  const a = 'org.jetlinks:name=a,type=PersistenceBuffer', b = 'org.jetlinks:name=b,type=PersistenceBuffer'
  const saved = pure.sanitizeDiagnosticPreferences({ version: 1, nodes: {
    a: { bufferVisibleObjectNames: [a, a, b, '', 3, 'x'.repeat(4097)], bufferScale: 'compressed' },
    b: { bufferVisibleObjectNames: [], bufferScale: 'linear' }, c: { bufferVisibleObjectNames: 'all', bufferScale: 'auto' },
    many: { bufferVisibleObjectNames: Array.from({ length: 250 }, (_, index) => `queue-${index}`) },
  } })
  assert.deepEqual(saved.nodes.a, { bufferVisibleObjectNames: [a, b], bufferScale: 'compressed' })
  assert.deepEqual(saved.nodes.b, { bufferVisibleObjectNames: [], bufferScale: 'linear' }); assert.deepEqual(saved.nodes.c, {})
  assert.equal(saved.nodes.many.bufferVisibleObjectNames.length, 200)
  const cache = new Map(), scope = vue.effectScope()
  try {
    const identity = vue.ref({ accountId: 'alice', projectId: 'p1' })
    const view = scope.run(() => createDiagnosticPreferences(identity, () => ({ getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) })))
    view.updateNode('node-a', saved.nodes.a); view.updateNode('node-b', saved.nodes.b)
    identity.value = { accountId: 'bob', projectId: 'p1' }; assert.deepEqual(view.value.value.nodes, {})
    identity.value = { accountId: 'alice', projectId: 'p1' }
    assert.deepEqual(view.value.value.nodes['node-a'], saved.nodes.a); assert.deepEqual(view.value.value.nodes['node-b'], saved.nodes.b)
  } finally { scope.stop() }
})


test('Buffer grouping whitelists modes and preserves implicit all, explicit none and legacy selection', () => {
  const input = { version: 1, nodes: {
    implicit: { bufferGrouping: 'aggregate', bufferScale: 'compressed' },
    none: { bufferGrouping: 'queues', bufferVisibleObjectNames: [] },
    legacy: { bufferObjectName: 'org.jetlinks:type=PersistenceBuffer,name=a', bufferView: 'throughput' },
    invalid: { bufferGrouping: 'all' },
  } }
  const saved = pure.sanitizeDiagnosticPreferences(input)
  assert.deepEqual(saved.nodes.implicit, { bufferGrouping: 'aggregate', bufferScale: 'compressed' })
  assert.ok(!Object.hasOwn(saved.nodes.implicit, 'bufferVisibleObjectNames'))
  assert.deepEqual(saved.nodes.none, { bufferGrouping: 'queues', bufferVisibleObjectNames: [] })
  assert.deepEqual(saved.nodes.legacy, input.nodes.legacy)
  assert.deepEqual(saved.nodes.invalid, {})
  const values = new Map(), identity = vue.ref({ accountId: 'alice', projectId: 'p1' }), scope = vue.effectScope()
  try {
    const preferences = scope.run(() => createDiagnosticPreferences(identity, () => ({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) })))
    preferences.updateNode('a', saved.nodes.none)
    preferences.updateNode('a', { bufferGrouping: 'aggregate', bufferVisibleObjectNames: undefined, bufferObjectName: undefined })
    assert.deepEqual(preferences.value.value.nodes.a, { bufferGrouping: 'aggregate' })
    identity.value = { accountId: 'bob', projectId: 'p1' }
    identity.value = { accountId: 'alice', projectId: 'p1' }
    assert.deepEqual(preferences.value.value.nodes.a, { bufferGrouping: 'aggregate' }, 'switching grouping while implicitly following all queues must not persist an empty selection')
  } finally { scope.stop() }
})

test('device runtime mode, explicit empty legend selection and zoom are bounded node display preferences',()=>{
 const value=pure.sanitizeDiagnosticPreferences({version:1,nodes:{a:{deviceRuntimeMode:'traffic',deviceRuntimeSeries:[],deviceRuntimeZoom:{start:20,end:80},history:[{secret:true}]},b:{deviceRuntimeMode:'bad',deviceRuntimeSeries:['sessions','receivedBytes','communicationQps','bad','sessions'],deviceRuntimeZoom:{start:-1,end:101}}}})
 assert.deepEqual(value.nodes.a,{deviceRuntimeMode:'traffic',deviceRuntimeSeries:[],deviceRuntimeZoom:{start:20,end:80}})
 assert.deepEqual(value.nodes.b,{deviceRuntimeSeries:['sessions','receivedBytes','communicationQps']})
})
