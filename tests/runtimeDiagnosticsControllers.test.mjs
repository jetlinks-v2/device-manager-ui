import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import * as piniaRuntime from 'pinia'
import { declarations } from './helpers/mbeanDeclarations.mjs'
import { Subject } from 'rxjs'

const require = createRequire(import.meta.url)
const { createPinia, disposePinia, setActivePinia } = piniaRuntime
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
function harness(filename, options = {}) {
  const collection = declarations(vue)
  const access = vue.ref({ enter: true, query: false, monitor: true, sessions: true, threads: true, jfr: true, exportJfr: true, heapDump: true, heap: true, invoke: true, trace: true, logs: true, ...options.access })
  const scopeKey = vue.ref({ accountId: 'alice', projectId: 'p1' }), route = vue.reactive({ path: options.path ?? (filename.startsWith('Tracing') ? '/infrastructure/tracing' : '/infrastructure/runtime-monitor'), query: options.query ?? {} }), navigation = [], calls = [], streams = [], deactivations = [], activations = []
  const pageActive = vue.ref(true), node = vue.ref('node-a'), tool = vue.ref(options.tool ?? 'jvm'), cache = new Map(), preference = vue.ref({ nodes: {} })
  const api = {
    sampleThreads: async () => [], saveDiagnosticBlob: async () => calls.push('save'),
    queryMBeans: async () => ({}), invokeMBean: async (...args) => { calls.push(['invoke', ...args]); return { success: true, result: 'done' } },
    queryTrace: async id => { calls.push(['trace', id]); return [] }, queryMonitorNodes: async () => [{ id: 'node-a', alias: 'iot-service' }], logNodes: async () => [], queryOperationalMBeans: async () => [], queryDeviceSessions: async () => [],
    ...options.api,
  }
  const router = Object.fromEntries(['push', 'replace'].map(method => [method, async value => { navigation.push({ method, ...value }); if (!value.path) route.query = value.query }]))
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id.endsWith('collection/useMBeanCollection')) return collection
      if (id === 'vue') return { ...vue, onActivated: callback => activations.push(callback), onDeactivated: callback => deactivations.push(callback) }
      if (id === 'pinia') return piniaRuntime
      if (id === 'vue-router') return { useRoute: () => route, useRouter: () => router }
      if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/hooks/useDiagnosticQuery') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts'))
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return { ...load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts')), createFlameGraphHtml: () => '<html>safe export</html>', createJvmDiagnosticHtml: options.createJvmDiagnosticHtml ?? (data => `<html>interactive report ${data.nodeId}</html>`), createJvmDiagnosticReport: () => '<html>diagnostic report</html>' }
      if (id.endsWith('api/link/diagnostics')) return api
      if (id.endsWith('api/link/diagnosticStream')) return { streamDiagnostic: (node, kind, signal, events) => {
        const source = new Subject(); streams.push({ node, kind, signal, events, source }); return source
      } }
      if (id.endsWith('useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
      if (id.endsWith('useDiagnosticScope')) return { useDiagnosticScope: () => scopeKey }
      if (id.endsWith('useDiagnosticPreferences')) return { useDiagnosticPreferences: () => ({ value: preference, updateNode: (node, value) => preference.value.nodes[node] = value }) }
      if (id.endsWith('useClusterBuffers')) return { useClusterBufferContext: () => undefined }
      if (id.endsWith('api/link/dashboard')) return { requestNode: async () => ({ success: true, result: [] }) }
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports)
    cache.set(path, module.exports); return module.exports
  }
  const hook = load(resolve(import.meta.dirname, '../views/link', filename)), pinia = createPinia()
  let effect = vue.effectScope()
  const mount = () => effect.run(() => { setActivePinia(pinia); return filename.startsWith('Tracing') ? hook.useClusterTrace() : filename.includes('Operational') ? hook.useNodeOperationalSignals(node, pageActive, scopeKey) : filename.includes('DeviceSessions') ? hook.useDeviceSessions(node, pageActive, vue.ref(true)) : filename.includes('Jvm') ? hook.useJvmDiagnostics(node, tool, pageActive) : hook.useNodeDiagnostics(node, tool, pageActive) })
  const view = mount()
  return { collection, effect: { stop: () => { effect.stop(); disposePinia(pinia) } }, view, access, scopeKey, route, navigation, calls, streams, deactivations, activations, node, tool, pageActive, api,
    unmount: () => effect.stop(), remount: () => { effect.stop(); effect = vue.effectScope(); return mount() },
  }
}
const frame = samples => ({ flameGraph: [{ className: 'org.jetlinks.Service', method: 'run', samples }], objectAllocations: [] })

test('JVM sampling is explicit, cumulative snapshots replace, stop preserves evidence and revoke clears it', async () => {
  const h = harness('diagnostics/useJvmDiagnostics.ts')
  try {
    await flush(); assert.equal(h.streams.length, 0)
    h.view.start(); h.view.start(); assert.equal(h.streams.length, 1)
    h.streams[0].source.next(frame(3)); h.streams[0].source.next(frame(7))
    assert.equal(h.view.snapshot.value.flameGraph[0].samples, 7)
    h.view.stop(); assert.equal(h.view.sampling.value.status, 'stopped'); assert.equal(h.streams[0].signal.aborted, true)
    assert.equal(h.streams[0].source.observed, false); assert.equal(h.view.snapshot.value.flameGraph[0].samples, 7)
    h.view.start(); assert.equal(h.view.snapshot.value, undefined)
    h.streams[0].source.next(frame(99)); assert.equal(h.view.snapshot.value, undefined)
    h.streams[1].source.next(frame(9)); h.access.value = { ...h.access.value, jfr: false, exportJfr: false }; await flush()
    assert.equal(h.view.snapshot.value, undefined); assert.equal(h.streams[1].signal.aborted, true)
    h.view.start(); assert.equal(h.streams.length, 2)
    assert.equal(h.calls.some(call => String(call).includes('stop')), false)
  } finally { h.effect.stop() }
})

test('diagnostic exports freeze the current node evidence and never start another collection', async () => {
  const saved = []
  const h = harness('diagnostics/useJvmDiagnostics.ts', { api: { saveDiagnosticBlob: async (blob, name, signal) => saved.push({ data: JSON.parse(await blob.text()), name, signal }) } })
  try {
    assert.equal(h.view.canExportSnapshot.value, false)
    h.view.start(); h.streams[0].source.next(frame(8))
    const pending = h.view.exportSnapshot()
    h.streams[0].source.next(frame(99)); await pending
    assert.equal(saved[0].data.nodeId, 'node-a'); assert.equal(saved[0].data.snapshot.flameGraph[0].samples, 8)
    assert.equal(h.view.snapshot.value.flameGraph[0].samples, 99)
    assert.equal(h.streams.length, 1)
    h.pageActive.value = false; await flush(); await h.view.exportSnapshot()
    assert.equal(saved.length, 1)
  } finally { h.effect.stop() }
})

test('superseded or cancelled export failures cannot overwrite the current node feedback', async () => {
  const requests = []
  const h = harness('diagnostics/useJvmDiagnostics.ts', { api: { saveDiagnosticBlob: (blob, name, signal) => new Promise((resolve, reject) => requests.push({ resolve, reject, signal })) } })
  try {
    h.view.start(); h.streams[0].source.next(frame(8))
    const first = h.view.exportSnapshot(), second = h.view.exportSnapshot()
    assert.equal(requests[0].signal.aborted, true)
    requests[0].reject(new Error('old export')); await first
    assert.equal(h.view.exportState.value, undefined)
    h.node.value = 'node-b'; await flush()
    requests[1].reject(new Error('previous node')); await second
    assert.equal(h.view.exportState.value, undefined)
  } finally { h.effect.stop() }
})

test('default HTML report freezes all authorized evidence and does not collect more data', async () => {
  const reports = [], saved = []
  const h = harness('diagnostics/useJvmDiagnostics.ts', { createJvmDiagnosticHtml: (data, options) => { reports.push({ data, options }); return '<html>complete report</html>' }, api: { saveDiagnosticBlob: async (blob, name) => saved.push({ text: await blob.text(), name }) } })
  try {
    h.view.start(); h.streams[0].source.next(frame(8)); h.view.threads.data.value = [{ id: '7', name: 'worker', state: 'RUNNABLE', stack: 'work', sampledAt: 1 }]
    await h.view.exportReportHtml(); h.streams[0].source.next(frame(99))
    assert.equal(reports[0].data.snapshot.flameGraph[0].samples, 8)
    assert.equal(reports[0].data.threads[0].id, '7'); assert.equal(reports[0].data.nodeId, 'node-a')
    assert.ok(reports[0].options.interaction.live); assert.match(saved[0].name, /diagnostics-node-a-\d+\.html/)
    assert.match(reports[0].options.report.state, /report\.stateAtExport.*samplingStatus\.recording/)
    assert.equal(saved[0].text, '<html>complete report</html>'); assert.equal(h.streams.length, 1)
    h.access.value = { ...h.access.value, exportJfr: false }; await flush(); await h.view.exportReportHtml()
    assert.equal(saved.length, 1)
  } finally { h.effect.stop() }
})

test('HTML report excludes revoked evidence and ignores failures after leaving its node', async () => {
  const reports = [], requests = []
  const h = harness('diagnostics/useJvmDiagnostics.ts', { access: { jfr: false }, createJvmDiagnosticHtml: data => { reports.push(data); return 'html' }, api: { saveDiagnosticBlob: (blob, name, signal) => new Promise((resolve, reject) => requests.push({ reject, signal })) } })
  try {
    h.view.threads.data.value = [{ id: '1', name: 'worker', stack: 'work', state: 'RUNNABLE', sampledAt: 1 }]
    h.view.snapshot.value = { flameGraph: [{ className: 'revoked', samples: 5 }], objectAllocations: [] }
    const exporting = h.view.exportReportHtml()
    assert.equal(reports[0].snapshot, undefined); assert.equal(reports[0].threads.length, 1)
    h.node.value = 'node-b'; await flush(); assert.equal(requests[0].signal.aborted, true)
    requests[0].reject(new Error('old node export failed')); await exporting
    assert.equal(h.view.exportState.value, undefined)
  } finally { h.effect.stop() }
})

test('thread snapshots discard a response from the previous node and HTML export rechecks permission', async () => {
  let resolveThread
  const h = harness('diagnostics/useJvmDiagnostics.ts', { api: { sampleThreads: async () => new Promise(done => { resolveThread = done }) } })
  try {
    h.view.sample(); h.node.value = 'node-b'; await flush()
    resolveThread([{ threadId: 1, threadName: 'old', threadState: 'RUNNABLE' }]); await flush()
    assert.equal(h.view.threads.data.value, undefined)
    h.view.start(); h.streams[0].source.next(frame(5)); h.view.stop(); await h.view.exportHtml()
    assert.equal(h.calls.filter(call => call === 'save').length, 1)
    h.access.value = { ...h.access.value, exportJfr: false }; await flush(); await h.view.exportHtml()
    assert.equal(h.calls.filter(call => call === 'save').length, 1)
  } finally { h.effect.stop() }
})

test('JFR request waiting, empty first frames and repeated cumulative heartbeats do not fabricate samples', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000000 })
  const h = harness('diagnostics/useJvmDiagnostics.ts')
  try {
    h.view.start()
    assert.equal(h.view.sampling.value.status, 'starting'); assert.equal(h.view.streamPhase.value, 'connecting')
    assert.equal(h.view.sampling.value.updateCount, 0)
    h.streams[0].events.onRequest()
    assert.equal(h.view.sampling.value.status, 'starting'); assert.equal(h.view.streamPhase.value, 'waiting')
    assert.equal(h.view.snapshot.value, undefined, 'preparing a request does not confirm the server started recording')
    t.mock.timers.tick(3000); assert.equal(h.view.elapsedSeconds.value, 3)
    h.view.stop(); assert.equal(h.view.sampling.value.status, 'stopped'); assert.equal(h.streams[0].signal.aborted, true)
    t.mock.timers.tick(5000); assert.equal(h.view.elapsedSeconds.value, 3)
    h.view.start(); h.streams[1].source.next({ flameGraph: [], objectAllocations: [] })
    assert.equal(h.view.sampling.value.status, 'recording'); assert.equal(h.view.streamPhase.value, 'receiving')
    assert.equal(h.view.sampling.value.updateCount, 1)
    assert.deepEqual(h.view.snapshot.value.flameGraph, [])
    const firstAt = h.view.sampling.value.sampledAt
    t.mock.timers.tick(1000); h.streams[1].source.next({ flameGraph: [], objectAllocations: [] })
    assert.deepEqual(h.view.snapshot.value.flameGraph, []); assert.equal(h.view.sampling.value.sampledAt, firstAt + 1000)
    assert.equal(h.view.sampling.value.updateCount, 2, 'empty valid snapshots count as real updates, not execution samples')
    h.streams[1].source.next(frame(4)); t.mock.timers.tick(1000); h.streams[1].source.next(frame(4))
    assert.equal(h.view.snapshot.value.flameGraph[0].samples, 4, 'identical cumulative frames do not add samples')
    assert.equal(h.view.sampling.value.updateCount, 4)
    h.streams[1].source.error(new Error('Connection closed'))
    assert.equal(h.view.sampling.value.status, 'error'); assert.equal(h.view.snapshot.value.flameGraph[0].samples, 4)
    const seconds = h.view.elapsedSeconds.value; t.mock.timers.tick(3000); assert.equal(h.view.elapsedSeconds.value, seconds)
  } finally { h.effect.stop() }
})

test('JFR first-frame and later quiet deadlines provide feedback without requests, clears, or automatic retry', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 2000000 })
  const h = harness('diagnostics/useJvmDiagnostics.ts')
  try {
    h.view.start(); h.streams[0].events.onRequest()
    t.mock.timers.tick(14000); assert.equal(h.view.sampling.value.delay, undefined)
    t.mock.timers.tick(1000)
    assert.equal(h.view.sampling.value.delay, 'first-frame'); assert.equal(h.view.sampling.value.quietSeconds, 15)
    assert.equal(h.view.sampling.value.updateCount, 0); assert.equal(h.streams.length, 1)
    h.streams[0].source.next(frame(2))
    assert.equal(h.view.sampling.value.delay, undefined); assert.equal(h.view.sampling.value.updateCount, 1)
    t.mock.timers.tick(4000); assert.equal(h.view.sampling.value.delay, undefined)
    t.mock.timers.tick(1000)
    assert.equal(h.view.sampling.value.delay, 'updates'); assert.equal(h.view.sampling.value.quietSeconds, 5)
    assert.equal(h.view.snapshot.value.flameGraph[0].samples, 2); assert.equal(h.streams.length, 1)
    h.streams[0].source.next(frame(2))
    assert.equal(h.view.sampling.value.delay, undefined); assert.equal(h.view.sampling.value.quietSeconds, 0)
    assert.equal(h.view.sampling.value.updateCount, 2); assert.equal(h.view.snapshot.value.flameGraph[0].samples, 2)
    t.mock.timers.tick(6000); h.view.stop()
    const stopped = { ...h.view.sampling.value }, elapsed = h.view.elapsedSeconds.value
    assert.equal(stopped.status, 'stopped'); assert.equal(stopped.delay, undefined)
    t.mock.timers.tick(20000)
    assert.deepEqual(h.view.sampling.value, stopped); assert.equal(h.view.elapsedSeconds.value, elapsed)
  } finally { h.effect.stop() }
})

test('JFR reconnect starts a fresh epoch; stale emissions, revocation and lifecycle cannot advance update feedback', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 3000000 })
  const h = harness('diagnostics/useJvmDiagnostics.ts')
  try {
    h.view.start(); h.streams[0].source.next(frame(7)); t.mock.timers.tick(5000)
    assert.equal(h.view.sampling.value.delay, 'updates')
    h.view.stop(); h.view.start()
    assert.equal(h.view.sampling.value.updateCount, 0); assert.equal(h.view.sampling.value.quietSeconds, 0)
    assert.equal(h.view.snapshot.value, undefined)
    h.streams[0].source.next(frame(99)); assert.equal(h.view.sampling.value.updateCount, 0)
    h.streams[1].source.next({ flameGraph: [], objectAllocations: [] }); assert.equal(h.view.sampling.value.updateCount, 1)
    h.pageActive.value = false; await flush()
    const inactive = { ...h.view.sampling.value }
    t.mock.timers.tick(10000); assert.deepEqual(h.view.sampling.value, inactive)
    h.pageActive.value = true; await flush(); h.view.start(); h.streams[2].source.next(frame(4))
    h.access.value = { ...h.access.value, jfr: false }; await flush()
    assert.equal(h.view.snapshot.value, undefined); assert.equal(h.view.sampling.value.updateCount, undefined)
    h.streams[2].source.next(frame(50)); t.mock.timers.tick(10000)
    assert.equal(h.view.sampling.value.status, 'idle'); assert.equal(h.view.elapsedSeconds.value, 0)
  } finally { h.effect.stop() }
})

test('MBean catalog reads no getters, selected details are scoped, and only declared signatures invoke', async () => {
  const objectName = 'org.jetlinks:type=Example,name=buffer', requests = []
  const operation = { name: 'resetMonitor', signature: [], parameters: [] }
  const h = harness('diagnostics/useNodeDiagnostics.ts', { tool: 'mbean', api: { queryMBeans: async (node, signal, pattern, attributes) => {
    requests.push({ node, signal, pattern, attributes })
    return { 'org.jetlinks': { Example: { buffer: { '@objectName': objectName, '@name': 'buffer', '@attributes': [{ name: 'Remainder', readable: true, type: 'long', available: true }], '@operations': [operation], ...(attributes ? {} : { Remainder: 3 }) } } } }
  } } })
  try {
    await flush(); await flush()
    assert.deepEqual(requests[0].attributes, []); assert.equal(requests[1].pattern, objectName)
    assert.equal(h.view.beans.value[0].attributes[0].value, 3)
    await h.view.invoke({ bean: h.view.beans.value[0], operation: { ...operation, signature: ['long'] }, args: [3] })
    await h.view.invoke({ bean: h.view.beans.value[0], operation, args: [3] })
    assert.equal(h.calls.length, 0)
    await h.view.invoke({ bean: h.view.beans.value[0], operation, args: [] }); assert.equal(h.calls.length, 1)
    assert.equal(h.view.invocation.data.value, 'done', 'an unrelated bean with resetMonitor remains a normal invocation without a Buffer collector')
    h.access.value = { ...h.access.value, invoke: false }; await flush()
    await h.view.invoke({ bean: h.view.beans.value[0], operation, args: [] }); assert.equal(h.calls.length, 1)
    h.api.queryMBeans = async () => ({ 'org.jetlinks': { Example: { buffer: { Remainder: 2 } } } })
    await h.view.loadBeans(); assert.equal(h.view.beanState.value.status, 'unsupported')
  } finally { h.effect.stop() }
})

test('MBean specialized invocation receipts belong only to the settled request', async () => {
  const first = 'org.jetlinks:type=Example,name=first', second = 'org.jetlinks:type=Example,name=second'
  const operation = { name: 'reset', signature: [], parameters: [] }
  const catalog = { 'org.jetlinks': { Example: {
    first: { '@objectName': first, '@name': 'first', '@operations': [operation] },
    second: { '@objectName': second, '@name': 'second', '@operations': [operation] },
  } } }
  const create = api => harness('diagnostics/useNodeDiagnostics.ts', { tool: 'mbean', api: { queryMBeans: async () => catalog, ...api } })
  const invocation = (h, index = 0) => ({ bean: h.view.beans.value[index], operation, args: [] })
  const success = create({ invokeMBean: async () => ({ success: true }) })
  try {
    await flush(); await flush()
    const receipt = await success.view.executeInvocation(invocation(success))
    assert.deepEqual(receipt, { state: { status: 'ready', sampledAt: receipt.state.sampledAt }, result: null })
    success.view.invocation.clear()
    assert.equal(receipt.state.status, 'ready', 'receipt state does not alias later query state')
  } finally { success.effect.stop() }

  const failed = create({ invokeMBean: async () => ({ success: false, message: 'offline' }) })
  try {
    await flush(); await flush()
    const receipt = await failed.view.executeInvocation(invocation(failed))
    assert.equal(receipt.state.status, 'error'); assert.equal(receipt.state.message, 'offline')
    assert.equal(receipt.result, undefined)
  } finally { failed.effect.stop() }

  let resolveCancelled
  const cancelled = create({ invokeMBean: async () => new Promise(done => { resolveCancelled = done }) })
  try {
    await flush(); await flush()
    const pending = cancelled.view.executeInvocation(invocation(cancelled))
    cancelled.view.invocation.cancel(); resolveCancelled({ success: true, result: 'late' })
    assert.equal(await pending, undefined)
  } finally { cancelled.effect.stop() }

  let resolveChanged
  const changed = create({ invokeMBean: async () => new Promise(done => { resolveChanged = done }) })
  try {
    await flush(); await flush()
    const pending = changed.view.executeInvocation(invocation(changed))
    changed.view.selectBean(second); resolveChanged({ success: true, result: 'late' })
    assert.equal(await pending, undefined)
  } finally { changed.effect.stop() }
})

test('operational declarations clear evidence on identity changes and stop on permission withdrawal', () => {
  const h = harness('diagnostics/useNodeOperationalSignals.ts')
  const source = count => ({ 'org.jetlinks': { EventBus: { events: { '@objectName': 'org.jetlinks:type=EventBus,name=events', StructuredBufferedEventCount: count } } } })
  try {
    const push = (node, count) => h.collection.push(node, 'org.jetlinks:type=EventBus,*', source(count))
    push('node-a', 1); assert.equal(h.view.signals.value[0].facts[0].value, '1')
    h.node.value = 'node-b'; assert.equal(h.view.signals.value.length, 0)
    push('node-a', 2); assert.equal(h.view.signals.value.length, 0)
    h.scopeKey.value = 'scope-b'; assert.equal(h.view.signals.value.length, 0)
    push('node-b', 3); assert.equal(h.view.signals.value[0].facts[0].value, '3')
    h.access.value = { ...h.access.value, monitor: false }
    assert.equal(h.view.signals.value.length, 0); assert.ok(h.collection.entries.every(entry => !entry.demand.enabled))
  } finally { h.effect.stop() }
})

test('device-session queries encode the submitted identity, retain evidence, and keep remote sessions visible', async () => {
  const pending = []
  const h = harness('diagnostics/useDeviceSessions.ts', { api: { queryDeviceSessions: (id, signal) => new Promise(done => pending.push({ id, signal, done })) } })
  try {
    h.view.deviceId.value = 'child/a'
    const first = h.view.query('child/a'); await flush()
    assert.equal(pending[0].id, 'child/a')
    pending[0].done([{ deviceId: 'child/a', serverId: 'node-b' }, { deviceId: 'child/a', serverId: 'node-a', transport: 'MQTT' }])
    await first; await flush()
    assert.equal(h.view.resultDeviceId.value, 'child/a')
    assert.deepEqual(h.view.sessions.value.map(item => item.serverId), ['node-b', 'node-a'])
    h.view.deviceId.value = 'other'; const second = h.view.query('other'); await flush()
    assert.equal(h.view.state.value.status, 'loading')
    assert.equal(h.view.resultDeviceId.value, 'child/a', 'new loading request must not relabel retained results')
    h.node.value = 'node-b'; await flush()
    pending[1].done([{ deviceId: 'other', serverId: 'node-a' }]); await second; await flush()
    assert.equal(h.view.resultDeviceId.value, 'child/a')
    assert.deepEqual(h.view.sessions.value.map(item => item.serverId), ['node-b', 'node-a'])
    h.access.value = { ...h.access.value, sessions: false }; await flush()
    assert.equal(h.view.sessions.value, undefined)
    assert.equal(h.view.state.value.status, 'forbidden')
  } finally { h.effect.stop() }
})

test('cluster trace searches are independent, stale requests are ignored and source scopes do not become guessed nodes', async () => {
  const pending = new Map()
  const oldId = '11111111111111111111111111111111', newId = '22222222222222222222222222222222'
  const h = harness('Tracing/useClusterTrace.ts', { query: { traceId: oldId }, api: { queryTrace: id => new Promise(done => { pending.set(id, done) }) } })
  const span = (id, app) => ({ traceId: id, spanId: id, app, name: 'request', startWithNanos: '100', endWithNanos: '200' })
  try {
    await flush(); h.view.input.value = newId; h.view.search(); await flush()
    assert.equal(h.navigation.at(-1).method, 'push'); assert.equal(h.route.query.traceId, newId)
    pending.get(newId)([span('current', 'iot-service'), span('unknown', 'third.party.scope')]); await flush()
    pending.get(oldId)([span('old', 'node-a')]); await flush()
    assert.equal(h.view.spans.value.length, 2); assert.equal(h.view.spans.value[0].nodeId, 'node-a')
    assert.equal(h.view.spans.value[1].app, 'third.party.scope'); assert.equal(h.view.spans.value[1].nodeId, undefined)
    h.view.logs(h.view.spans.value[1]); assert.equal(h.navigation.at(-1).path, undefined)
    h.view.logs(h.view.spans.value[0]); assert.equal(h.navigation.at(-1).query.nodeId, 'node-a')
    assert.equal(h.navigation.at(-1).query.logFrom, '0'); assert.equal(h.navigation.at(-1).query.logTo, '0')
    assert.ok(!('from' in h.navigation.at(-1).query)); assert.ok(!('to' in h.navigation.at(-1).query))
    h.access.value = { ...h.access.value, trace: false }; await flush(); assert.equal(h.view.query.data.value, undefined)
    assert.equal(h.view.state.value.status, 'forbidden')
  } finally { h.effect.stop() }
})


test('trace tabs preserve URL selection, deduplicate IDs and reject invalid input before transport', async () => {
  const first = '11111111111111111111111111111111', second = '22222222222222222222222222222222', calls = []
  const h = harness('Tracing/useClusterTrace.ts', { query: { traceId: first, spanId: 'leaf', nodeId: 'node-a' }, api: { queryTrace: async id => { calls.push(id); return [] } } })
  try {
    await flush()
    assert.equal(h.view.workspace.active.value.selectedId, 'leaf')
    const firstKey = h.view.workspace.activeKey.value
    h.view.input.value = `traceparent: 00-${second}-1234567890abcdef-01`; h.view.search(); await flush()
    assert.equal(h.route.query.traceId, second); assert.equal(h.route.query.span, undefined); assert.equal(h.route.query.spanId, undefined)
    h.view.select({ id: 'span-b', key: 'node-b:span-b' }); await flush()
    assert.equal(h.route.query.span, 'node-b:span-b')
    h.view.activate(firstKey); await flush()
    assert.equal(h.route.query.traceId, first); assert.equal(h.route.query.span, 'leaf'); assert.equal(h.route.query.nodeId, 'node-a')
    h.view.input.value = second.toUpperCase(); h.view.search(); await flush()
    assert.equal(h.view.workspace.tabs.value.length, 2); assert.equal(h.route.query.span, 'node-b:span-b'); assert.deepEqual(calls, [first, second])
    h.view.input.value = `traceparent: 00-${second}-1234567890abcdef-01, 00-${second}-fedcba9876543210-00`; h.view.search(); await flush()
    assert.equal(h.view.workspace.tabs.value.length, 2); assert.equal(h.route.query.traceId, second); assert.equal(h.route.query.span, 'node-b:span-b'); assert.deepEqual(calls, [first, second])
    h.view.newQuery(); await flush(); const queryKey = h.view.workspace.activeKey.value
    h.view.newQuery(); await flush(); assert.equal(h.view.workspace.activeKey.value, queryKey)
    h.view.input.value = `00-${first}-1234567890abcdef-01, 00-${second}-fedcba9876543210-00`; h.view.search(); await flush()
    assert.equal(h.view.workspace.inputError.value, true); assert.equal(h.view.workspace.activeKey.value, queryKey); assert.deepEqual(calls, [first, second])
    h.view.input.value = 'log contains ' + first; h.view.search(); await flush()
    assert.equal(h.view.workspace.inputError.value, true); assert.deepEqual(calls, [first, second])
    h.view.close(queryKey); await flush(); assert.equal(h.route.query.traceId, second, 'draft has no record to close')
    h.view.activate(firstKey); h.view.close(firstKey); await flush(); assert.equal(h.route.query.traceId, second)
    h.view.close(h.view.workspace.activeKey.value); await flush(); assert.equal(h.route.query.traceId, undefined)
    assert.equal(h.view.workspace.tabs.value.length, 0)
  } finally { h.effect.stop() }
})

test('fromRoute preserves each result draft and validation across span sync, recent switches and primary-view round trips', async () => {
  const first = '1'.repeat(32), draft = '2'.repeat(32), third = '3'.repeat(32)
  for (const invalid of [false, true]) {
    const calls = [], h = harness('Tracing/useClusterTrace.ts', {
      path: '/infrastructure/runtime-monitor', query: { view: 'tracing', traceId: first },
      api: { queryTrace: async id => { calls.push(id); return [] } },
    })
    try {
      await flush(); const firstKey = h.view.workspace.activeKey.value
      h.view.input.value = third; h.view.search(); await flush()
      const thirdKey = h.view.workspace.activeKey.value
      h.view.activate(firstKey); await flush()
      const input = invalid ? 'unfinished-invalid-input' : draft
      h.view.input.value = input
      if (invalid) h.view.search()
      h.view.select({ id: 'leaf', key: 'node-a:leaf' }); await flush()
      assert.equal(h.view.input.value, input); assert.equal(h.view.workspace.inputError.value, invalid)
      assert.equal(h.route.query.span, 'node-a:leaf')
      h.view.activate(thirdKey); await flush(); h.view.activate(firstKey); await flush()
      assert.equal(h.view.input.value, input); assert.equal(h.view.workspace.inputError.value, invalid)
      h.route.query = { view: 'cluster', nodeId: 'node-b', tool: 'overview' }; await flush()
      h.route.query = { view: 'tracing', traceId: first, span: 'node-a:leaf' }; await flush()
      assert.equal(h.view.input.value, input); assert.equal(h.view.workspace.inputError.value, invalid)
      assert.deepEqual(calls, [first, third], 'draft input never becomes a transport request through URL restoration')
      assert.equal(h.view.workspace.tabs.value.length, 2)
    } finally { h.effect.stop() }
  }
})

test('fromRoute keeps a standalone draft outside recent records across primary-view round trips', async () => {
  for (const invalid of [false, true]) {
    const calls = [], h = harness('Tracing/useClusterTrace.ts', {
      path: '/infrastructure/runtime-monitor', query: { view: 'tracing' },
      api: { queryTrace: async id => { calls.push(id); return [] } },
    })
    try {
      const input = invalid ? 'unfinished-invalid-input' : '2'.repeat(32)
      h.view.input.value = input
      if (invalid) h.view.search()
      for (const view of ['cluster', 'connections']) {
        h.route.query = { view, nodeId: 'node-b' }; await flush()
        h.route.query = { view: 'tracing' }; await flush()
        assert.equal(h.view.input.value, input)
        assert.equal(h.view.workspace.inputError.value, invalid)
        assert.equal(h.view.workspace.tabs.value.length, 0); assert.deepEqual(calls, [])
      }
    } finally { h.effect.stop() }
  }
})

test('full recent capacity keeps evidence and URL drafts without transport until a record is removed', async () => {
  const ids = Array.from({ length: 9 }, (_, index) => String(index + 1).repeat(32)), calls = []
  const h = harness('Tracing/useClusterTrace.ts', { api: { queryTrace: async id => { calls.push(id); return [] } } })
  try {
    for (const id of ids.slice(0, 8)) { h.view.input.value = id; h.view.search(); await flush() }
    h.view.input.value = ids[8]; h.view.search(); await flush()
    assert.equal(h.view.workspace.capacityReached.value, true)
    assert.equal(h.route.query.traceId, ids[7]); assert.equal(h.view.workspace.tabs.value.length, 8)
    h.route.query = { traceId: ids[8] }; await flush()
    assert.equal(h.view.workspace.active.value, undefined); assert.equal(h.view.input.value, ids[8])
    assert.equal(h.view.workspace.capacityReached.value, true); assert.equal(calls.length, 8)
    h.view.close(h.view.workspace.tabs.value[0].key); await flush()
    assert.equal(h.view.input.value, ids[8]); assert.equal(h.view.workspace.capacityReached.value, false)
    h.view.search(); await flush()
    assert.equal(h.route.query.traceId, ids[8]); assert.deepEqual(calls, ids)
  } finally { h.effect.stop() }
})

test('invalid URL IDs make no trace request and scope changes isolate late results', async () => {
  const calls = [], pending = []
  const id = '33333333333333333333333333333333'
  const h = harness('Tracing/useClusterTrace.ts', { query: { traceId: 'prefix/invalid' }, api: { queryTrace: (value, signal) => { calls.push({ value, signal }); return new Promise(done => pending.push(done)) } } })
  try {
    await flush(); assert.equal(calls.length, 0); assert.equal(h.view.workspace.inputError.value, true)
    h.view.input.value = id; h.view.search(); await flush(); assert.equal(calls.length, 1)
    h.scopeKey.value = { accountId: 'bob', projectId: 'p2' }; await flush()
    assert.equal(calls[0].signal.aborted, true); assert.equal(calls.length, 2)
    pending[0]([{ traceId: id, spanId: 'late', name: 'old scope', startWithNanos: '1', endWithNanos: '2' }]); await flush()
    assert.equal(h.view.query.data.value, undefined)
    pending[1]([]); await flush(); assert.deepEqual(h.view.query.data.value, [])
    h.access.value = { ...h.access.value, trace: false }; await flush()
    assert.equal(h.view.workspace.tabs.value.length, 0); assert.equal(h.view.state.value.status, 'forbidden')
  } finally { h.effect.stop() }
})

test('trace sessions survive page disposal, resume only unfinished queries and clear off-page scope changes', async () => {
  const first = '11111111111111111111111111111111', second = '22222222222222222222222222222222', requests = []
  const h = harness('Tracing/useClusterTrace.ts', { query: { traceId: first }, api: { queryTrace: (id, signal) => new Promise(resolve => requests.push({ id, signal, resolve })) } })
  try {
    requests[0].resolve([{ traceId: first, spanId: 'root', name: 'first', startWithNanos: '1790000000000000000', endWithNanos: '1790000000001000000' }]); await flush()
    const firstTab = h.view.workspace.active.value, firstData = firstTab.data
    h.view.select({ id: 'root', key: 'node-a:root' }); await flush()
    h.view.input.value = second; h.view.search(); await flush()
    h.route.path = '/infrastructure/runtime-monitor'; h.route.query = { nodeId: 'node-a', tool: 'logs' }; await flush()
    h.unmount()
    assert.equal(requests[1].signal.aborted, true)
    assert.equal(h.view.workspace.tabs.value.length, 2)
    requests[1].resolve([{ name: 'late' }]); await flush()
    assert.equal(h.view.workspace.active.value.data, undefined)
    h.route.path = '/infrastructure/tracing'; h.route.query = { traceId: second }
    const returned = h.remount(); await flush()
    assert.equal(returned.workspace.tabs.value.length, 2)
    assert.equal(returned.workspace.tabs.value[0].data, firstData)
    assert.equal(returned.workspace.tabs.value[0].selectedId, 'node-a:root')
    assert.equal(requests.length, 3); assert.equal(requests[2].id, second)
    requests[2].resolve([]); await flush()
    returned.activate(firstTab.key); await flush()
    assert.equal(requests.length, 3, 'completed evidence is reused on remount')
    h.unmount(); h.scopeKey.value = { accountId: 'alice', projectId: 'p2' }
    assert.equal(returned.workspace.tabs.value.length, 0, 'detached session clears synchronously on project change')
    assert.equal(requests.length, 3, 'scope change outside the page does not issue queries')
  } finally { h.effect.stop() }
})

test('off-page logout or permission revocation clears retained trace evidence and rejects late results', async () => {
  for (const change of ['logout', 'permission']) {
    let finish
    const h = harness('Tracing/useClusterTrace.ts', { query: { traceId: '33333333333333333333333333333333' }, api: { queryTrace: () => new Promise(resolve => { finish = resolve }) } })
    try {
      await flush(); h.unmount()
      assert.equal(h.view.workspace.tabs.value.length, 1)
      if (change === 'logout') h.scopeKey.value = { accountId: '', projectId: 'p1' }
      else h.access.value = { ...h.access.value, trace: false }
      assert.equal(h.view.workspace.tabs.value.length, 0)
      finish([{ name: 'late former identity' }]); await flush()
      assert.equal(h.view.workspace.tabs.value.length, 0)
    } finally { h.effect.stop() }
  }
})

test('a cached trace page neither changes another page URL nor starts hidden queries', async () => {
  const id = '44444444444444444444444444444444', calls = []
  const h = harness('Tracing/useClusterTrace.ts', { query: { traceId: id }, api: { queryTrace: async value => { calls.push(value); return [] } } })
  try {
    await flush(); const key = h.view.workspace.activeKey.value
    h.route.path = '/infrastructure/runtime-monitor'; h.route.query = { nodeId: 'node-b', tool: 'logs' }; await flush()
    const navigationCount = h.navigation.length
    h.view.select({ id: 'hidden' }); h.view.newQuery(); h.view.activate(key); h.view.close(key); h.view.refresh()
    h.view.input.value = '55555555555555555555555555555555'; h.view.search(); await flush()
    assert.equal(h.navigation.length, navigationCount); assert.deepEqual(calls, [id]); assert.equal(h.view.workspace.tabs.value.length, 1)
    assert.deepEqual(h.route.query, { nodeId: 'node-b', tool: 'logs' })
    h.route.path = '/project/p1/infrastructure/tracing'; h.route.query = { traceId: id }; await flush()
    assert.equal(h.view.workspace.activeKey.value, key); assert.deepEqual(calls, [id])
  } finally { h.effect.stop() }
})


test('JVM tool and node round trips preserve snapshots while sampling and export remain explicit', async () => {
  let threadReads = 0
  const h = harness('diagnostics/useJvmDiagnostics.ts', { api: { sampleThreads: async () => { threadReads++; return [{ threadId: 1, threadName: 'worker', threadState: 'RUNNABLE' }] } } })
  try {
    await h.view.sample(); h.view.start(); h.streams[0].source.next(frame(8))
    const threads = h.view.threads.data.value, snapshot = h.view.snapshot.value
    h.tool.value = 'logs'; await flush()
    assert.equal(h.streams[0].signal.aborted, true); assert.equal(h.view.snapshot.value, snapshot)
    assert.equal(h.view.threads.data.value, threads); assert.equal(h.view.sampling.value.status, 'stopped')
    h.tool.value = 'jvm'; await flush(); assert.equal(h.streams.length, 1); assert.equal(threadReads, 1)
    h.pageActive.value = false; await flush(); h.view.start(); await h.view.sample(); await h.view.exportHtml()
    assert.equal(h.streams.length, 1); assert.equal(threadReads, 1); assert.equal(h.calls.length, 0)
    h.pageActive.value = true; h.deactivations.forEach(callback => callback()); await flush()
    h.activations.forEach(callback => callback()); await flush()
    assert.equal(h.view.snapshot.value, snapshot); assert.equal(h.view.threads.data.value, threads)
    assert.equal(h.streams.length, 1); assert.equal(threadReads, 1)
    h.api.sampleThreads = async () => { throw new Error('offline') }; await h.view.sample()
    assert.equal(h.view.threadState.value.status, 'stale'); assert.equal(h.view.threads.data.value, threads)
    h.api.sampleThreads = async () => { throw { status: 403 } }; await h.view.sample()
    assert.equal(h.view.threadState.value.status, 'forbidden'); assert.equal(h.view.threads.data.value, undefined)
  } finally { h.effect.stop() }
})

test('MBean cache keeps local selection and results; inactive routes do not consume another node selection', async () => {
  const first = 'org.jetlinks:type=Example,name=first', second = 'org.jetlinks:type=Example,name=second'
  const operation = { name: 'reset', signature: [], parameters: [] }, reads = []
  const h = harness('diagnostics/useNodeDiagnostics.ts', { tool: 'mbean', query: { nodeId: 'node-a', bean: first }, api: { queryMBeans: async (node, signal, pattern, attributes) => {
    reads.push({ node, signal, pattern, attributes })
    const bean = (name, objectName) => ({ '@objectName': objectName, '@name': name, '@attributes': [{ name: 'Remainder', readable: true, available: true, type: 'long' }], '@operations': [operation], ...(attributes ? {} : { Remainder: 2 }) })
    return { 'org.jetlinks': { Example: { first: bean('first', first), second: bean('second', second) } } }
  } } })
  try {
    await flush(); await flush(); await h.view.invoke({ bean: h.view.beans.value[0], operation, args: [] })
    const detail = h.view.detail.data.value, invocation = h.view.invocation.data.value
    h.pageActive.value = false; await flush()
    h.route.query = { nodeId: 'node-b', bean: second }; await flush()
    assert.equal(h.view.selectedBean.value, first); assert.equal(h.view.detail.data.value, detail)
    h.view.selectBean(second); await h.view.invoke({ bean: h.view.beans.value[0], operation, args: [] })
    assert.equal(h.view.selectedBean.value, first); assert.equal(h.calls.length, 1)
    h.route.path = '/infrastructure/tracing'; h.route.query = { traceId: '11111111111111111111111111111111' }; h.pageActive.value = true; await flush()
    const count = reads.length; await h.view.loadBeans(); assert.equal(reads.length, count)
    h.route.path = '/infrastructure/runtime-monitor'; h.route.query = { nodeId: 'node-a' }; await flush(); await flush()
    assert.equal(h.view.selectedBean.value, first); assert.equal(h.view.invocation.data.value, invocation); assert.equal(h.calls.length, 1)
    h.api.queryMBeans = async () => { throw new Error('offline') }; await h.view.loadBeans()
    assert.equal(h.view.beanState.value.status, 'stale'); assert.ok(h.view.beans.value.length)
    h.api.queryMBeans = async () => { throw { status: 403 } }; await h.view.loadBeans()
    assert.equal(h.view.beanState.value.status, 'forbidden'); assert.equal(h.view.detail.data.value, undefined); assert.equal(h.view.invocation.data.value, undefined)
  } finally { h.effect.stop() }
})

test('unified tracing pauses off-view and ignores cluster log context while retaining completed comparison tabs', async () => {
  const id = 'a'.repeat(32), second = 'b'.repeat(32), pending = []
  const h = harness('Tracing/useClusterTrace.ts', {
    path: '/infrastructure/runtime-monitor', query: { view: 'tracing', traceId: id },
    api: { queryTrace: (traceId, signal) => new Promise(done => pending.push({ traceId, signal, done })) },
  })
  try {
    await flush(); assert.equal(pending.length, 1)
    pending[0].done([{ id: 'one', traceId: id, name: 'entry', startWithNanos: '1', endWithNanos: '2' }]); await flush()
    assert.equal(h.view.workspace.active.value.data[0].name, 'entry')
    h.view.input.value = second; h.view.search(); await flush(); assert.equal(pending.length, 2)
    h.route.query = { view: 'cluster', nodeId: 'node-a', tool: 'logs', traceId: id }; await flush()
    const navigationCount = h.navigation.length
    assert.equal(h.view.active.value, false); assert.equal(pending[1].signal.aborted, true)
    pending[1].done([{ name: 'late hidden' }]); await flush()
    assert.equal(h.view.workspace.active.value.data, undefined)
    h.view.search(); h.view.activate(h.view.workspace.tabs.value[0].key); await flush()
    assert.equal(h.navigation.length, navigationCount); assert.equal(h.view.workspace.tabs.value.length, 2)
    assert.equal(h.view.workspace.tabs.value[0].data[0].name, 'entry')
    h.route.query = { view: 'tracing', traceId: id }; await flush()
    assert.equal(h.view.active.value, true); assert.equal(h.view.traceId.value, id); assert.equal(pending.length, 2)
    assert.equal(h.view.workspace.active.value.data[0].name, 'entry')
    h.route.query = { view: 'cluster', nodeId: 'node-a', tool: 'logs' }; await flush()
    h.scopeKey.value = { accountId: 'bob', projectId: 'p2' }; await flush()
    assert.equal(h.view.workspace.tabs.value.length, 0); assert.equal(h.view.directory.data.value, undefined)
  } finally { h.effect.stop() }
})
