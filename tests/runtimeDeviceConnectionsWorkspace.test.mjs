import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }

function loadTs(entry, overrides = {}) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    const { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return vue
      if (id in overrides) return overrides[id]
      if (id.startsWith('.')) return load(resolve(dirname(path), `${id}.ts`))
      return require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports)
    cache.set(path, module.exports)
    return module.exports
  }
  return load(entry)
}

test('session overview excludes confirmed unsupported nodes from distribution and coverage while retaining unknown and failed evidence', () => {
  const { sessionOverview } = loadTs(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/sessionOverview.ts'))
  const nodes = ['zero', 'absent', 'unsupported', 'unknown', 'failed', 'stale', 'partial'].map(id => ({ id }))
  const snapshot = (supported, status, sessions, keepOnline) => ({ supported, state: { status, sampledAt: 1000 }, sessions, keepOnline })
  const snapshots = new Map([
    ['zero', snapshot(true, 'ready', '0', '0')],
    ['absent', snapshot(false, 'empty', '999', '999')],
    ['unsupported', snapshot(undefined, 'unsupported')],
    ['failed', snapshot(undefined, 'error')],
    ['stale', snapshot(true, 'stale', '100', '100')],
    ['partial', snapshot(true, 'ready', '2')],
  ])
  const overview = sessionOverview([...nodes, nodes[0]], snapshots)
  assert.deepEqual(overview.rows.map(row => row.nodeId), ['zero', 'unknown', 'failed', 'stale', 'partial'])
  assert.equal(overview.total, 5); assert.equal(overview.collected, 1)
  assert.deepEqual(overview.sessions, { value: '2', nodes: 2 })
  assert.deepEqual(overview.keepOnline, { value: '0', nodes: 1 })
  assert.equal(overview.rows.find(row => row.nodeId === 'stale').sessions, '100')
  assert.equal(overview.rows.find(row => row.nodeId === 'unknown').status, 'unknown')
  assert.equal(overview.rows.find(row => row.nodeId === 'failed').status, 'error')
  snapshots.set('absent', snapshot(true, 'ready', '0', '0'))
  assert.equal(sessionOverview(nodes, snapshots).total, 6, 'a recovered capability returns without changing the cluster directory')
  const none = sessionOverview([nodes[2]], snapshots)
  assert.equal(none.total, 0); assert.equal(none.sessions.value, undefined, 'no supported evidence must not become a fabricated zero')
})

function suggestionHarness(loader) {
  const active = vue.ref(true), scope = vue.ref('alice')
  const module = loadTs(resolve(import.meta.dirname, '../views/link/diagnostics/useDeviceSuggestions.ts'), {
    '../../../api/link/deviceConnections': { queryConnectionDeviceCandidates: loader, connectionDevicePageSize: 12 },
  })
  const effect = vue.effectScope()
  return { ...effect.run(() => module.useDeviceSuggestions(active, scope)), effect, active, scope }
}

test('candidate lookup requests twelve stable lightweight records without a count endpoint', async () => {
  const calls = [], api = loadTs(resolve(import.meta.dirname, '../api/link/deviceConnections.ts'), {
    '@jetlinks-web/core': { request: { post: async (...args) => { calls.push(args); return { result: [] } } } },
  })
  const signal = new AbortController().signal
  await api.queryConnectionDeviceCandidates('sensor', signal, 2)
  assert.equal(calls.length, 1); assert.equal(calls[0][0], '/device/instance/_query/no-paging')
  assert.equal(calls[0][1].pageSize, 12); assert.equal(calls[0][1].pageIndex, 2); assert.equal(calls[0][1].paging, true)
  assert.deepEqual(calls[0][1].includes, ['id', 'name', 'productName'])
  assert.deepEqual(calls[0][1].sorts, [{ name: 'id', order: 'asc' }]); assert.equal(calls[0][2].signal, signal)
})

test('candidate pages append unique records, retry the failed page, and stop at the final short page', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = []; let failed = false
  const h = suggestionHarness(async (keyword, signal, page) => {
    calls.push(page)
    if (page === 1 && !failed) { failed = true; throw new Error('offline') }
    return { result: page === 2 ? [] : Array.from({ length: 12 }, (_, i) => ({ id: String(page * 11 + i), name: `device-${page * 11 + i}` })) }
  })
  try {
    h.search('device'); t.mock.timers.tick(200); await flush()
    assert.equal(h.options.value.length, 12); assert.equal(h.hasMore.value, true)
    h.loadMore(); h.loadMore(); await flush()
    assert.deepEqual(calls, [0, 1]); assert.equal(h.options.value.length, 12)
    h.loadMore(); await flush(); assert.equal(h.options.value.length, 23)
    assert.deepEqual(calls, [0, 1, 1]); assert.equal(h.options.value[11].value, '11')
    h.loadMore(); await flush(); assert.equal(h.hasMore.value, false)
    h.loadMore(); await flush(); assert.deepEqual(calls, [0, 1, 1, 2])
  } finally { h.effect.stop() }
})

test('changing a keyword cancels an in-flight next page and cannot append its late records', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let complete, moreSignal
  const h = suggestionHarness((keyword, signal, page) => {
    if (page) { moreSignal = signal; return new Promise(done => { complete = done }) }
    return Promise.resolve(Array.from({ length: 12 }, (_, i) => ({ id: `${keyword}-${i}` })))
  })
  try {
    h.search('old'); t.mock.timers.tick(200); await flush(); h.loadMore()
    h.search('new'); assert.equal(moreSignal.aborted, true)
    t.mock.timers.tick(200); await flush()
    complete([{ id: 'wrong-page' }]); await flush()
    assert.equal(h.options.value.length, 12); assert.ok(h.options.value.every(option => option.value.startsWith('new-')))
  } finally { h.effect.stop() }
})

test('device suggestions isolate races, deactivation, and scope revocation from session identity', async () => {
  const pending = [], h = suggestionHarness((keyword, signal) => new Promise(done => pending.push({ keyword, signal, done })))
  try {
    h.search('first'); await new Promise(done => setTimeout(done, 220))
    h.search('second'); await new Promise(done => setTimeout(done, 220))
    assert.equal(pending[0].signal.aborted, true)
    pending[0].done({ result: { data: [{ id: 'old', name: 'old' }] } })
    pending[1].done({ result: { data: [{ id: 'new', name: 'new' }] } }); await flush()
    assert.deepEqual(h.options.value, [{ value: 'new', label: 'new', description: undefined }])

    h.search('hidden'); await new Promise(done => setTimeout(done, 220)); h.active.value = false; await flush()
    assert.equal(pending[2].signal.aborted, true)
    pending[2].done({ result: { data: [{ id: 'late' }] } }); await flush()
    assert.deepEqual(h.options.value, [])

    h.active.value = true; await flush(); h.search('scope'); await new Promise(done => setTimeout(done, 220))
    h.scope.value = 'bob'; await flush()
    assert.equal(pending[3].signal.aborted, true)
    pending[3].done({ result: { data: [{ id: 'wrong-scope' }] } }); await flush()
    assert.deepEqual(h.options.value, [])
  } finally { h.effect.stop() }
})

function sessionsHarness(loader) {
  const node = vue.ref(''), active = vue.ref(true), supported = vue.ref(true), scope = vue.ref('alice'), access = vue.ref({ sessions: true })
  const allowUnknownSupport = vue.ref(false)
  const queryModule = loadTs(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts'))
  const module = loadTs(resolve(import.meta.dirname, '../views/link/diagnostics/useDeviceSessions.ts'), {
    '@jetlinks-web-core/hooks/useDiagnosticQuery': queryModule,
    '@jetlinks-web-core/components/RuntimeDiagnostics': {},
    '../../../api/link/diagnostics': { queryDeviceSessions: loader },
    './useDiagnosticsAccess': { useDiagnosticsAccess: () => access },
    './status': { diagnosticErrorState: () => ({ status: 'error' }) },
  })
  const effect = vue.effectScope()
  const session = effect.run(() => module.useDeviceSessions(node, active, supported, scope, true, allowUnknownSupport))
  return { ...session, effect, node, active, supported, scope, access, allowUnknownSupport }
}

test('device session evidence retains raw cross-node results, cancels inactive work, and clears on revoke or scope change', async () => {
  const pending = [], h = sessionsHarness((id, signal) => new Promise(done => pending.push({ id, signal, done })))
  try {
    const one = h.query('device-a'); pending[0].done([{ deviceId: 'device-a', serverId: 'a' }, { deviceId: 'device-a', serverId: 'b' }]); await one
    assert.equal(h.sessions.value.length, 2, 'the source retains every node result')
    h.node.value = 'a'; await flush(); assert.equal(h.sessions.value.length, 2)
    const two = h.query('device-b'); h.active.value = false; await flush(); assert.equal(pending[1].signal.aborted, true)
    pending[1].done([{ deviceId: 'device-b' }]); await two; assert.equal(h.resultDeviceId.value, 'device-a')
    h.active.value = true; h.scope.value = 'bob'; await flush(); assert.equal(h.sessions.value, undefined)
    h.query('device-c'); h.access.value = { sessions: false }; await flush(); assert.equal(pending[2].signal.aborted, true)
    assert.equal(h.sessions.value, undefined); assert.equal(h.queriedDeviceId.value, '')
  } finally { h.effect.stop() }
})


function workspaceHarness({ supported = undefined, active = true, deviceId = 'deep-link', monitor = true, loader } = {}) {
  const route = vue.reactive({ query: { deviceId, nodeId: 'legacy-node' } }), access = vue.ref({ sessions: true, monitor })
  const props = vue.reactive({ active, supported, nodes: [{ id: 'a' }, { id: 'b' }], scopeKey: 'alice' }), calls = []
  const observationModel = loadTs(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/device-sessions/observation.ts'))
  const normalizer = loadTs(resolve(import.meta.dirname, '../views/link/diagnostics/useDeviceSessions.ts'), {
    '@jetlinks-web-core/hooks/useDiagnosticQuery': {}, '../../../api/link/diagnostics': {}, './useDiagnosticsAccess': {}, './status': {},
  })
  const hooks = loadTs(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/device-observation/useDeviceObservation.ts'), {
    '@jetlinks-web-core/components/RuntimeDiagnostics': { ...observationModel, ...loadTs(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts')) },
    '../../../../api/link/diagnostics': { queryDeviceSessions: (id, signal) => { calls.push(id); return loader ? loader(id, signal) : Promise.resolve([{ deviceId: id, serverId: 'a' }, { deviceId: id, serverId: 'b' }]) } },
    '../../diagnostics/useDeviceSessions': normalizer,
    '../../diagnostics/status': { diagnosticErrorState: error => ({ status: error.status === 403 ? 'forbidden' : 'error' }) },
  })
  const source = readFileSync(new URL('../views/link/RuntimeMonitor/DeviceConnectionsWorkspace.vue', import.meta.url), 'utf8')
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  script = script.replace(/const props = defineProps<[^>]+>\(\)\n/, 'const props = __props\n')
  script += '\nmodule.exports = { observation, capability, overview, add, remove }'
  const module = { exports: {} }, effect = vue.effectScope()
  const imports = id => ({
    vue, 'vue-router': { useRoute: () => route, useRouter: () => ({ replace: ({ query }) => { route.query = query } }) },
    '@jetlinks-web-core/components/RuntimeDiagnostics': {},
    '../diagnostics/useDiagnosticsAccess': { useDiagnosticsAccess: () => access },
    '../diagnostics/useDeviceSuggestions': { useDeviceSuggestions: () => ({ options: vue.ref([]), searching: vue.ref(false), search() {} }) },
    './device-observation/useDeviceObservation': hooks,
    './useClusterSessions': { useClusterSessionContext: () => undefined },
    './sessionOverview': loadTs(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/sessionOverview.ts')),
  }[id] ?? require(id))
  effect.run(() => new Function('require', 'module', 'exports', '__props', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(imports, module, module.exports, props))
  return { ...module.exports, effect, route, access, props, calls }
}

test('deep links wait for confirmed capability, span all nodes and add instead of replacing observed devices', async () => {
  const h = workspaceHarness()
  try {
    await flush(); assert.deepEqual(h.calls, [])
    h.props.supported = true; await flush(); assert.deepEqual(h.calls, ['deep-link'])
    assert.deepEqual(h.observation.entries.value[0].sessions.map(row => row.serverId), ['a', 'b'])
    h.add('second', 'Second device'); await flush()
    assert.deepEqual(h.observation.entries.value.map(entry => entry.id), ['deep-link', 'second'])
    assert.equal(h.route.query.nodeId, undefined)
    assert.equal(h.route.query.deviceId, 'second')
    h.add('second'); await flush(); assert.equal(h.calls.filter(id => id === 'second').length, 1)
    h.remove('second'); await flush()
    assert.equal(h.route.query.deviceId, 'deep-link')
  } finally { h.effect.stop() }
})

test('outer view and directory changes retain evidence; unknown capability pauses while confirmed absence clears telemetry', async () => {
  const h = workspaceHarness({ supported: true })
  try {
    await flush()
    const sessions = h.observation.entries.value[0].sessions
    h.props.active = false; h.route.query = { view: 'tracing' }; h.props.nodes = []; await flush()
    assert.equal(h.observation.entries.value[0].sessions, sessions)
    h.props.active = true; await flush(); assert.deepEqual(h.observation.entries.value[0].sessions, sessions)
    const latest = h.observation.entries.value[0].sessions
    h.props.supported = undefined; await flush(); assert.equal(h.observation.entries.value[0].sessions, latest)
    h.props.supported = false; await flush(); assert.deepEqual(h.observation.entries.value[0].sessions, [])
    assert.equal(h.observation.entries.value[0].state.status, 'unsupported')
    assert.deepEqual(h.observation.entries.value[0].history, [])
    h.access.value = { sessions: false, monitor: true }; await flush(); assert.deepEqual(h.observation.entries.value, [])
  } finally { h.effect.stop() }
})

test('session-query is independent of monitor capability; unknown capability can be tried without monitor access', async () => {
  const h = workspaceHarness({ monitor: false })
  try {
    await flush(); assert.deepEqual(h.calls, ['deep-link'])
    h.add('independent-device'); await flush(); assert.equal(h.calls.at(-1), 'independent-device')
    assert.equal(h.props.supported, undefined)
    h.props.supported = false; await flush(); h.add('blocked')
    assert.ok(!h.calls.includes('blocked'))
  } finally { h.effect.stop() }
})
