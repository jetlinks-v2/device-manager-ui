import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '..')
function loader(stubs = {}) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => {
      if (id in stubs) return stubs[id]
      if (id.startsWith('@jetlinks-web-core/components/RuntimeDiagnostics/')) return load(resolve(root, '../../jetlinks-web-core/src/components/RuntimeDiagnostics', `${id.split('/').at(-1)}.ts`))
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }, module, module.exports)
    cache.set(path, module.exports); return module.exports
  }
  return load
}
const load = loader(), edge = load(resolve(root, 'views/link/Tracing/edgeTrace.ts'))
const { useTraceWorkspace } = load(resolve(root, 'views/link/Tracing/useTraceWorkspace.ts'))
const { normalizeTrace } = load(resolve(root, 'views/link/diagnostics/normalize.ts'))
const { traceRows } = load(resolve(root, '../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
const id = 'abcdef0123456789abcdef0123456789'
const span = (spanId, name = 'operation', parentSpanId) => ({ traceId: id, spanId, name, parentSpanId, app: 'iot-service:8200', startWithNanos: '1792652760000000000', endWithNanos: '1792652760010000000' })
const proxy = (index = 0) => span(`proxy-${index}`, `/agent-proxy/device/edge-${index}`)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
function harness(spans = [proxy()]) {
  const scope = vue.effectScope(), allowed = vue.ref(true), reads = [], remote = []
  const workspace = scope.run(() => useTraceWorkspace({
    load: async (id, signal) => { reads.push({ id, signal }); return spans }, allowed: () => allowed.value,
    errorState: error => ({ status: error.status === 403 ? 'forbidden' : error.status === 404 ? 'unsupported' : 'error' }),
    edge: { load: (target, id, signal) => new Promise((resolve, reject) => remote.push({ target, id, signal, resolve, reject })) },
  }))
  return { scope, workspace, allowed, reads, remote }
}

test('spanName recognizes only exact platform edge proxy and command templates', () => {
  for (const name of ['/agent-proxy/device/edge-1', '/agent-command/device:edge-1/runtime/ProxyWebApi/_execute', '/agent-command/device:edge-1/runtime/metadata', '/agent-command/device:edge-1/runtime/ProxyWebApi/metadata']) {
    assert.deepEqual(edge.edgeTraceTarget(name), { key: '["device","edge-1"]', thingType: 'device', thingId: 'edge-1' }, name)
  }
  for (const name of ['/device/edge-1/send', '/agent-proxy/device/edge-1/extra', '/agent-command/device:edge-1/runtime/execute', '/agent-command/edge-1/runtime/cmd/_execute', '/agent-proxy/device/..', '/agent-proxy/device/%2e%2e', '/agent-proxy/device/a%2fb', '/agent-proxy/device/a?b', '/agent-proxy/device/a\\b', '/agent-proxy/device/a\nb']) assert.equal(edge.edgeTraceTarget(name), undefined, name)
  assert.equal(edge.edgeTraceTargets([proxy(), proxy(), span('command', '/agent-command/device:edge-0/runtime/cmd/_execute')]).length, 1)
})

test('edge transport uses the existing scoped proxy, exact trace identity and cancels through the platform request', async () => {
  const calls = [], signal = new AbortController().signal, target = edge.edgeTraceTarget('/agent-proxy/device/edge:1')
  let response = [span('remote')]
  const api = loader({ './diagnosticStream': {}, '@jetlinks-web/core': { request: { get: async (...args) => { calls.push(args); return response } } } })(resolve(root, 'api/link/diagnostics.ts'))
  assert.deepEqual(await api.queryEdgeTrace(target, id, signal), response)
  assert.equal(calls[0][0], `/edge/device/edge%3A1/_/system/trace/${id}`)
  assert.equal(calls[0][2].signal, signal); assert.equal(calls[0][2].timeout, 10000)
  response = { success: true, result: [{ ...span('remote'), edgeSource: { key: 'fake' } }] }
  assert.equal((await api.queryEdgeTrace(target, id, signal))[0].edgeSource, undefined)
  response = [{ ...span('wrong'), traceId: 'f'.repeat(32) }]
  await assert.rejects(api.queryEdgeTrace(target, id, signal), /response invalid/)
  response = { success: false, status: 403, message: 'denied' }
  await assert.rejects(api.queryEdgeTrace(target, id, signal), error => error.status === 403)
})

test('cloud and edge spans join by real parent IDs while remote services cannot become cloud navigation targets', () => {
  const cloud = span('cloud'), remote = span('remote', 'remote operation', 'cloud'), target = edge.edgeTraceTarget(proxy().name)
  const data = edge.combinedTraceSpans({ data: [cloud], edges: [{ target, status: 'ready', data: [cloud, remote] }] })
  assert.equal(data.length, 2)
  const normalized = normalizeTrace(data, [{ id: 'iot-service:8200' }]), rows = traceRows(normalized)
  assert.equal(normalized[0].nodeId, 'iot-service:8200'); assert.equal(normalized[1].nodeId, undefined)
  assert.equal(normalized[1].source.label, 'device:edge-0')
  assert.equal(rows.find(row => row.id === 'remote').parentKey, rows.find(row => row.id === 'cloud').key)
  const conflicts = edge.combinedTraceSpans({ data: [cloud], edges: [{ target, status: 'ready', data: [{ ...cloud, name: 'conflict' }] }] })
  assert.equal(conflicts.length, 2); assert.ok(traceRows(normalizeTrace(conflicts)).every(row => row.duplicate))
})

test('cloud appears before bounded edge queries and one failed edge does not discard other results', async t => {
  const h = harness(Array.from({ length: 5 }, (_, i) => proxy(i))); t.after(() => h.scope.stop())
  const tab = h.workspace.open(id); await flush()
  assert.equal(tab.state.status, 'ready'); assert.equal(tab.data.length, 5); assert.equal(h.remote.length, 3)
  h.remote[0].resolve([span('remote-0', 'operation', 'proxy-0')]); h.remote[1].reject({ status: 403 }); h.remote[2].resolve([]); await flush()
  assert.equal(h.remote.length, 5)
  h.remote[3].resolve([]); h.remote[4].resolve([]); await flush()
  assert.deepEqual(tab.edges.map(item => item.status), ['ready', 'forbidden', 'empty', 'empty', 'empty'])
  h.workspace.retryEdge(tab.key, tab.edges[1].target.key); await flush()
  assert.equal(h.reads.length, 1); assert.equal(h.remote.length, 6)
  h.remote[5].resolve([span('recovered')]); await flush(); assert.equal(tab.edges[1].status, 'ready')
})

test('discovery is bounded and edge results do not recursively scan more edges', async t => {
  const h = harness(Array.from({ length: 12 }, (_, i) => proxy(i))); t.after(() => h.scope.stop())
  const tab = h.workspace.open(id); await flush(); assert.equal(tab.edges.length, 8); assert.equal(tab.omittedEdges, 4)
  for (let batch = 0; batch < 3; batch++) { h.remote.filter(item => !item.done).forEach(item => { item.done = true; item.resolve([proxy(99)]) }); await flush() }
  assert.equal(h.remote.length, 8)
})

test('suspend aborts edge reads, preserves completed evidence and resumes only unfinished sources', async t => {
  const h = harness([proxy(0), proxy(1), proxy(2), proxy(3)]); t.after(() => h.scope.stop())
  const tab = h.workspace.open(id); await flush(); h.remote[0].resolve([span('complete')]); await flush()
  h.workspace.suspend(); assert.ok(h.remote.slice(1).every(item => item.signal.aborted))
  h.remote.slice(1).forEach(item => item.resolve([span('late')])); await flush()
  assert.equal(edge.combinedTraceSpans(tab).length, 5)
  h.workspace.resume(); await flush(); assert.equal(h.remote.length, 7); assert.equal(h.reads.length, 1)
  h.remote.slice(4).forEach(item => item.resolve([])); await flush()
  assert.ok(tab.edges.every(item => item.status === 'ready' || item.status === 'empty'))
})

test('trace permission revocation clears all evidence and rejects late edge responses', async t => {
  const h = harness([proxy(0), proxy(1)]); t.after(() => h.scope.stop())
  const tab = h.workspace.open(id); await flush(); h.remote[0].resolve([span('remote')]); await flush()
  h.allowed.value = false; h.workspace.reset()
  h.remote[1].resolve([span('late')]); await flush()
  assert.equal(h.workspace.tabs.value.length, 0); assert.ok(h.remote[1].signal.aborted)
  h.workspace.retryEdge(tab.key, tab.edges[0].target.key); await flush(); assert.equal(h.remote.length, 2)
  h.allowed.value = true; h.workspace.open(id); await flush(); assert.equal(h.remote.length, 4)
})

test('refresh generations and closed tabs cannot receive old edge responses', async t => {
  const h = harness(); t.after(() => h.scope.stop())
  const tab = h.workspace.open(id); await flush(); await h.workspace.refresh(); await flush()
  assert.ok(h.remote[0].signal.aborted); h.remote[0].resolve([span('stale')]); await flush()
  assert.equal(tab.edges[0].status, 'loading'); assert.equal(h.remote.length, 2)
  h.workspace.close(tab.key); assert.ok(h.remote[1].signal.aborted)
  h.remote[1].resolve([span('closed')]); await flush(); assert.equal(h.workspace.tabs.value.length, 0)
})

test('all tracing requests share the existing trace query permission', async t => {
  const h = harness(); t.after(() => h.scope.stop()); h.allowed.value = false
  assert.equal(h.workspace.open(id), undefined); await flush()
  assert.equal(h.reads.length, 0); assert.equal(h.remote.length, 0)
})
