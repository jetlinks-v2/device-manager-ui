import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
const raw = (pending = 0, dead = 0) => ({ 'org.jetlinks': { PersistenceBuffer: { queue: { '@objectName': 'org.jetlinks:type=PersistenceBuffer,name=queue', '@name': 'queue',
  '@attributes': ['Remainder', 'DeadSize'].map(name => ({ name, readable: true, available: true, type: 'long' })), Remainder: pending, DeadSize: dead } } } })
function harness(ids = ['node-a'], loader = async () => raw(), retainOnPause = false) {
  const cache = new Map(), calls = [], nodes = vue.ref(ids), enabled = vue.ref(true), identity = vue.ref('alice:p1'), interval = vue.ref(5), discoveryScope = vue.ref('alice:p1')
  const api = { queryBufferMBeans: async (node, signal) => { calls.push({ node, signal }); return loader(node, signal) } }
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return vue
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts'))
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
      if (id.endsWith('api/link/diagnostics')) return api
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports); cache.set(path, module.exports); return module.exports
  }
  const module = load(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/useClusterBuffers.ts')), scope = vue.effectScope(), permitted = retainOnPause ? vue.ref(true) : enabled
  const view = scope.run(() => module.useClusterBuffers(nodes, enabled, identity, interval, discoveryScope, permitted))
  return { scope, view, nodes, enabled, permitted, identity, interval, discoveryScope, calls, api, summarize: module.summarizeBufferQueues }
}

test('two-second Buffer sampling preserves its five-minute history', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const h = harness()
  try {
    h.interval.value = 2; await flush()
    for (let index = 0; index < 155; index++) { t.mock.timers.tick(2000); await flush() }
    const history = h.view.snapshots.value.get('node-a').history
    assert.equal(history.length, 151)
    assert.equal(history.at(-1).sampledAt - history[0].sampledAt, 300000)
  } finally { h.scope.stop() }
})

test('discovery samples every node without resource data, limits concurrency to three and never overlaps one node', async () => {
  const pending = new Map(), h = harness(['a', 'b', 'c', 'no-live', 'e'], node => new Promise(done => pending.set(node, done)))
  try {
    assert.deepEqual(h.calls.map(call => call.node), ['a', 'b', 'c'])
    h.view.refresh('a'); assert.equal(h.calls.length, 3)
    pending.get('b')(raw(2)); await flush(); assert.equal(h.calls.at(-1).node, 'no-live')
    pending.get('a')(raw()); await flush(); assert.equal(h.calls.at(-1).node, 'e')
    assert.equal(h.view.snapshots.value.get('b').pending, 2)
    for (const node of ['c', 'no-live', 'e']) pending.get(node)(raw())
    await flush(); assert.equal(h.view.snapshots.value.size, 5)
    assert.ok([...h.view.snapshots.value.values()].every(snapshot => snapshot.state.sampledAt !== undefined))
  } finally { h.scope.stop() }
})

test('slow collections use earliest-due FIFO so every discovered node receives its first and later samples', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness(['a', 'b', 'c', 'd', 'e', 'f', 'g'], () => new Promise(done => setTimeout(() => done(raw()), 10000)))
  try {
    assert.deepEqual(h.calls.map(call => call.node), ['a', 'b', 'c'])
    for (let round = 0; round < 2; round++) { t.mock.timers.tick(10000); await flush() }
    assert.deepEqual(h.calls.slice(0, 7).map(call => call.node), ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    assert.equal(h.calls[6].node, 'g', 'the oldest never-sampled node precedes the next periodic sample')
    for (let round = 0; round < 4; round++) { t.mock.timers.tick(10000); await flush() }
    for (const node of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      assert.ok(h.calls.filter(call => call.node === node).length >= 2, `${node} receives periodic samples without starvation`)
      assert.equal(h.view.snapshots.value.get(node).state.status, 'ready')
    }
  } finally { h.scope.stop() }
})

test('frequency changes reschedule from completion, avoid duplicate requests and do not depend on node or tool selection', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness(['a', 'b'])
  try {
    await flush(); assert.equal(h.calls.length, 2)
    t.mock.timers.tick(5000); await flush(); assert.equal(h.calls.length, 4)
    h.interval.value = 10; await flush(); t.mock.timers.tick(9999); await flush(); assert.equal(h.calls.length, 4)
    t.mock.timers.tick(1); await flush(); assert.equal(h.calls.length, 6)
    let complete
    h.api.queryBufferMBeans = async () => new Promise(done => complete = done)
    h.nodes.value = ['a']; t.mock.timers.tick(10000); await flush()
    h.interval.value = 30; h.view.refresh('a'); await flush()
    t.mock.timers.tick(60000); await flush(); assert.equal(h.view.snapshots.value.size, 1)
    complete(raw(3)); await flush()
    const at = h.view.snapshots.value.get('a').state.sampledAt
    t.mock.timers.tick(29999); await flush(); assert.equal(h.view.snapshots.value.get('a').state.sampledAt, at)
    h.interval.value = 60; await flush(); t.mock.timers.tick(30000); await flush(); assert.equal(h.view.snapshots.value.get('a').state.sampledAt, at)
  } finally { h.scope.stop() }
})

test('new nodes sample immediately; removal, identity, page and permission changes cancel and reject late evidence', async () => {
  const pending = [], h = harness(['a'], (node, signal) => new Promise(done => pending.push({ node, signal, done })))
  try {
    h.nodes.value = ['a', 'b']; assert.equal(h.calls.length, 2)
    h.nodes.value = ['b']; assert.equal(pending[0].signal.aborted, true); assert.equal(h.view.snapshots.value.has('a'), false)
    pending[0].done(raw(99)); await flush(); assert.equal(h.view.snapshots.value.has('a'), false)
    h.identity.value = 'bob:p2'; assert.equal(pending[1].signal.aborted, true)
    assert.equal(h.calls.length, 2, 'old topology must not start requests using the new identity')
    pending[1].done(raw(88)); await flush(); assert.equal(h.view.snapshots.value.size, 0)
    h.nodes.value = ['new-project-node']; await flush(); assert.equal(h.calls.length, 2)
    h.discoveryScope.value = 'bob:p2'; assert.equal(h.calls.at(-1).node, 'new-project-node')
    h.enabled.value = false; assert.equal(pending[2].signal.aborted, true); assert.equal(h.view.snapshots.value.size, 0)
    pending[2].done(raw(77)); await flush(); assert.equal(h.view.snapshots.value.size, 0)
    h.enabled.value = true; pending[3].done(raw(4)); await flush(); assert.equal(h.view.snapshots.value.get('new-project-node').pending, 4)
  } finally { h.scope.stop() }
  assert.equal(h.view.snapshots.value.size, 0)
})

test('real zeros clear backlog; failed and incomplete samples stay unknown, retain evidence and leave history gaps', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness(['a'], async () => raw(12, 2))
  try {
    await flush(); const first = h.view.snapshots.value.get('a'); assert.equal(first.hasBacklog, true)
    h.api.queryBufferMBeans = async () => { throw new Error('node unavailable') }
    t.mock.timers.tick(5000); await flush(); const stale = h.view.snapshots.value.get('a')
    assert.equal(stale.pending, 12); assert.equal(stale.dead, 2); assert.equal(stale.hasBacklog, true)
    assert.equal(stale.state.status, 'stale'); assert.equal(stale.state.sampledAt, first.state.sampledAt)
    assert.deepEqual(stale.history.at(-1).buffers, [])
    h.api.queryBufferMBeans = async () => raw(0, 0); t.mock.timers.tick(5000); await flush()
    const zero = h.view.snapshots.value.get('a'); assert.equal(zero.pending, 0); assert.equal(zero.dead, 0); assert.equal(zero.hasBacklog, false)
    h.api.queryBufferMBeans = async () => raw(null, ''); t.mock.timers.tick(5000); await flush()
    const missing = h.view.snapshots.value.get('a'); assert.equal(missing.pending, undefined); assert.equal(missing.dead, undefined)
    assert.equal(missing.state.status, 'stale'); assert.deepEqual(missing.history.at(-1).buffers, [{ objectName: 'org.jetlinks:type=PersistenceBuffer,name=queue', counterEpoch: 0 }])
    h.api.queryBufferMBeans = async () => { throw { status: 403 } }; t.mock.timers.tick(5000); await flush()
    const denied = h.view.snapshots.value.get('a'); assert.equal(denied.state.status, 'forbidden'); assert.deepEqual(denied.beans, []); assert.deepEqual(denied.history, [])
    const calls = h.calls.length; t.mock.timers.tick(60000); await flush(); assert.equal(h.calls.length, calls)
    h.enabled.value = false; h.enabled.value = true; await flush(); assert.equal(h.view.snapshots.value.get('a').state.status, 'forbidden')
  } finally { h.scope.stop() }
})

test('five-minute history is bounded and a node with no first successful sample never receives fabricated zeros', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  const h = harness()
  try {
    await flush(); for (let index = 0; index < 70; index++) { t.mock.timers.tick(5000); await flush() }
    const history = h.view.snapshots.value.get('node-a').history
    assert.equal(history.length, 61); assert.equal(history.at(-1).sampledAt - history[0].sampledAt, 300000)
    h.api.queryBufferMBeans = async () => { throw new Error('offline') }; h.nodes.value = ['new']; await flush()
    const failed = h.view.snapshots.value.get('new'); assert.equal(failed.state.status, 'error')
    assert.equal(failed.pending, undefined); assert.equal(failed.hasBacklog, false); assert.equal(failed.state.sampledAt, undefined)
  } finally { h.scope.stop() }
})

test('node summary only adds backlog height for real positive values, including nodes without resources', async () => {
  const filename = resolve(import.meta.dirname, '../views/link/RuntimeMonitor/NodeSummary.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename }), compiled = compileScript(descriptor, { id: 'buffer-node-summary', inlineTemplate: true })
  const { code } = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === 'ant-design-vue') return { theme: { useToken: () => ({ token: vue.ref({}) }) } }
    if (id === './nodeSummary') return { hasNodeMonitoringData: () => false }
    if (id === './nodeBufferOverview') return { bufferQuantity: value => value.toLocaleString() }
    if (id === './device-runtime/deviceMessageHistory') return { latestDeviceMessageRates: () => undefined }
    if (id === './device-runtime/deviceQps') return { deviceQpsView: () => ({supported:false,ready:false,stale:false,history:[]}) }
    if (id.endsWith('/utils/monitorData')) return { formatMemorySize: value => `${value} B` }
    if (id.endsWith('/utils/networkData')) return { formatNetworkSize: value => `${value} B` }
    if (id.endsWith('.vue')) return { __esModule: true, default: vue.defineComponent({ setup: () => () => null }) }
    return require(id)
  }, module, module.exports)
  async function render(buffer) {
    const app = vue.createSSRApp(module.exports.default, { nodeId: 'no-live', label: 'Node', buffer })
    app.component('a-popover', { setup: (_, { slots }) => () => vue.h('div', [slots.default?.(), slots.content?.()]) })
    app.component('a-badge', { setup: () => () => null }); app.component('a-tag', { setup: (_, { slots }) => () => vue.h('span', slots.default?.()) })
    return renderToString(app)
  }
  const h = harness(['a'], async () => raw(7, 1))
  try {
    await flush(); const positive = h.view.snapshots.value.get('a')
    assert.match(await render(positive), /class="node-summary-buffer node-summary-buffer--failed"/)
    assert.match(await render({ ...positive, state: { ...positive.state, status: 'stale' } }), /runtimeDiagnostics.nodeStale/)
    assert.doesNotMatch(await render({ ...positive, queues: [], hasBacklog: false, pending: 0, dead: 0 }), /class="node-summary-buffer/)
    assert.doesNotMatch(await render(undefined), /class="node-summary-buffer/)
  } finally { h.scope.stop() }
})


test('pausing preserves buffer history but invalidates old samples even after resume; revocation clears evidence', async () => {
  const pending = [], h = harness(['a'], (node, signal) => new Promise(done => pending.push({ signal, done })), true)
  try {
    pending[0].done(raw(1)); await flush()
    h.view.refresh('a'); assert.equal(pending.length, 2)
    h.enabled.value = false; await flush()
    assert.equal(pending[1].signal.aborted, true); assert.equal(h.view.snapshots.value.get('a').pending, 1)
    h.enabled.value = true; await flush(); assert.equal(pending.length, 3)
    pending[1].done(raw(99)); await flush(); assert.equal(h.view.snapshots.value.get('a').pending, 1)
    pending[2].done(raw(2)); await flush()
    assert.equal(h.view.snapshots.value.get('a').pending, 2); assert.equal(h.view.snapshots.value.get('a').history.length, 2)
    h.permitted.value = false; await flush(); assert.equal(h.view.snapshots.value.size, 0)
  } finally { h.scope.stop() }
})
