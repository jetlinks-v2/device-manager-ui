import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }

function harness(query = {}, permissions = {}) {
  const route = vue.reactive({ path: '/infrastructure/runtime-monitor', query })
  const access = vue.ref({ enter: true, query: false, monitor: true, logs: true, threads: false, ...permissions })
  const user = vue.reactive({ userInfo: { id: 'alice' } })
  const projectId = vue.ref('p1'), monitorNodes = vue.ref([{ id: 'a' }]), calls = [], cache = new Map(), modules = new Map()
  let monitorLoader = async () => monitorNodes.value
  const runtime = { nodes: vue.ref([]), topologyVersion: vue.ref(0), error: vue.ref(false), updatedAt: vue.ref(''), refresh: () => calls.push('refresh') }
  const storage = { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) }
  let preferenceContext
  const imports = id => {
    if (id === 'vue') return { ...vue, provide() {}, onActivated() {} }
    if (id === 'vue-router') return { useRoute: () => route, useRouter: () => ({ replace: async target => { route.query = target.query } }) }
    if (id === '@jetlinks-web-core/store/user') return { useUserStore: () => user }
    if (id === '@jetlinks-web-core/hooks/useProjectRouter') return { useProjectRouter: () => ({ projectId }) }
    if (id === '@jetlinks-web-core/utils/project-runtime') return { getProjectCodeFromLocation: () => '' }
    if (id.endsWith('/useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
    if (id.endsWith('/useDiagnosticPreferences') && preferenceContext) return preferenceContext
    if (id.endsWith('/useSystemMonitorRuntime')) return { provideSystemMonitorRuntime: () => runtime }
    if (id.endsWith('/api/link/dashboard')) return { requestNode: async () => { calls.push('dashboard'); return { success: true, result: monitorNodes.value } } }
    if (id.endsWith('/api/link/diagnostics')) return {
      queryMonitorNodes: async () => { calls.push('monitor'); return monitorLoader() },
      diagnosticResult: async pending => (await pending).result,
    }
    return undefined
  }
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename)
    const module = { exports: {} }
    const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => imports(id) ?? (id === '@jetlinks-web-core/components/RuntimeDiagnostics' ? load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts')) : id === '@jetlinks-web-core/hooks/useDiagnosticQuery'
      ? load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts'))
      : id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)), module, module.exports)
    modules.set(filename, module.exports)
    return module.exports
  }
  const preferenceModule = load(resolve(import.meta.dirname, '../views/link/diagnostics/useDiagnosticPreferences.ts'))
  preferenceContext = { ...preferenceModule, provideDiagnosticPreferences: scope => preferenceModule.createDiagnosticPreferences(scope, () => storage) }
  const hook = load(resolve(import.meta.dirname, '../views/link/RuntimeMonitor/useClusterWorkspace.ts'))
  const scope = vue.effectScope(), view = scope.run(() => hook.useClusterWorkspace())
  return { scope, view, route, access, user, projectId, monitorNodes, runtime, calls, cache, setMonitorLoader: loader => { monitorLoader = loader } }
}

test('all accessible nodes determine selector visibility; an invalid URL falls back safely', async () => {
  const h = harness({ nodeId: 'gone', tool: 'logs' })
  try {
    await flush()
    assert.equal(h.view.selected.value, 'a'); assert.equal(h.view.showNodeSelector.value, false)
    h.monitorNodes.value = [{ id: 'a' }, { id: 'b' }]
    await h.view.loadNodes(); await flush()
    h.view.search.value = 'a'
    assert.equal(h.view.filtered.value.length, 1); assert.equal(h.view.showNodeSelector.value, true)
    assert.equal(h.calls.includes('dashboard'), false)
    h.view.select('b'); await flush()
    assert.equal(h.view.selected.value, 'b')
    h.monitorNodes.value = [{ id: 'a' }]
    await h.view.loadNodes(); await flush()
    assert.equal(h.view.selected.value, 'a')
    h.access.value = { enter: false, query: false, monitor: false }
    await flush()
    assert.equal(h.view.selected.value, ''); assert.equal(h.view.membership.data.value, undefined)
  } finally { h.scope.stop() }
})

test('URL wins over saved state while project changes isolate it and do not restore capture', async () => {
  const h = harness({ nodeId: 'a', tool: 'logs' })
  try {
    await flush()
    h.view.preferences.update({ nodeId: 'b', tool: 'mbean' })
    assert.equal(h.view.selected.value, 'a'); assert.equal(h.view.tab.value, 'logs')
    h.projectId.value = 'p2'; await flush()
    assert.equal(h.view.preferences.value.value.nodes.a, undefined)
    assert.equal(h.view.preferences.value.value.tool, undefined)
    h.user.userInfo.id = ''; await flush()
    assert.equal(h.view.selected.value, '')
    assert.equal(h.view.preferences.key.value, undefined)
    assert.equal(h.calls.some(call => /capture|jfr|dump/.test(call)), false)
  } finally { h.scope.stop() }
})

test('identity changes synchronously isolate topology until discovery completes in the new scope', async () => {
  const h = harness({}, { query: true })
  try {
    await flush()
    assert.equal(h.view.discoveryScope.value, h.view.scopeKey.value)
    h.runtime.nodes.value = [{ nodeId: 'a', cpuJvm: 5 }]
    let complete
    h.setMonitorLoader(() => new Promise(done => complete = done))
    const oldScope = h.view.discoveryScope.value
    h.projectId.value = 'p2'
    assert.equal(h.view.discoveryScope.value, '', 'discovery ownership clears before pre-flush consumers can observe a new identity')
    assert.equal(h.view.membership.data.value, undefined)
    assert.deepEqual(h.runtime.nodes.value, [])
    assert.deepEqual(h.view.nodes.value, [])
    await flush(); assert.equal(h.view.discoveryScope.value, '')
    complete([{ id: 'new-project-node' }]); await flush()
    assert.notEqual(h.view.scopeKey.value, oldScope)
    assert.equal(h.view.discoveryScope.value, h.view.scopeKey.value)
    assert.deepEqual(h.view.nodes.value.map(node => node.id), ['new-project-node'])
  } finally { h.scope.stop() }
})

test('a logs-only URL is context, never an inferred metrics or discovery grant', async () => {
  const h = harness({ nodeId: 'unverified', tool: 'logs' }, { monitor: false })
  try {
    await flush()
    assert.equal(h.view.selected.value, 'unverified')
    assert.equal(h.view.nodes.value.length, 0)
    assert.equal(h.calls.filter(call => ['monitor', 'dashboard'].includes(call)).length, 0)
    h.view.select('other'); await flush()
    assert.equal(h.view.selected.value, 'unverified')
  } finally { h.scope.stop() }
})

test('nodes with real monitoring values precede metadata-only nodes and keep a stable label order', async () => {
  const h = harness({}, { query: true })
  try {
    await flush()
    h.monitorNodes.value = [{ id: 'gateway', alias: 'A' }, { id: 'z', alias: 'Z' }, { id: 'b', alias: 'B' }, { id: 'missing', alias: 'C' }]
    h.runtime.nodes.value = [{ nodeId: 'gateway', pressure: 0, systemPressure: 0, jvmPressure: 0 }, { nodeId: 'z', cpuJvm: 0 }, { nodeId: 'b', memorySystemUsed: 12 }]
    await h.view.loadNodes(); await flush()
    assert.deepEqual(h.view.nodes.value.map(node => node.id), ['b', 'z', 'gateway', 'missing'])
    h.runtime.nodes.value = [{ nodeId: 'gateway', pressure: 100, cpuJvm: NaN }, { nodeId: 'z', cpuJvm: 95 }, { nodeId: 'b', memorySystemUsed: 12, pressure: 100 }]
    await flush()
    assert.deepEqual(h.view.nodes.value.map(node => node.id), ['b', 'z', 'gateway', 'missing'], 'derived pressures and non-finite fields are not resource evidence')
    h.view.select('gateway'); await flush(); assert.equal(h.view.selected.value, 'gateway', 'missing metrics do not disable diagnostics selection')
  } finally { h.scope.stop() }
})


test('a cached monitoring page never rewrites another route or discovers nodes after navigation', async () => {
  const h = harness({ nodeId: 'a', tool: 'logs' })
  try {
    await flush()
    const next = { traceId: '11111111111111111111111111111111', span: 'leaf', nodeId: 'trace-node' }
    h.route.path = '/infrastructure/tracing'; h.route.query = next; await flush()
    const count = h.calls.length
    h.monitorNodes.value = [{ id: 'different' }]; h.runtime.topologyVersion.value++; await flush()
    h.view.select('different'); h.view.selectTab('mbean'); await h.view.loadNodes(); await flush()
    assert.deepEqual(h.route.query, next); assert.equal(h.view.active.value, false)
    assert.equal(h.calls.length, count, 'inactive monitoring must not run discovery or refresh another page')
    h.route.path = '/infrastructure/runtime-monitor'; h.route.query = { nodeId: 'a', tool: 'logs' }; await flush()
    assert.equal(h.view.active.value, true); assert.equal(h.view.selected.value, 'different')
  } finally { h.scope.stop() }
})

test('overview session details forwards to the guarded global connections workspace', () => {
  const diagnostics = readFileSync(resolve(import.meta.dirname, '../views/link/diagnostics/NodeDiagnostics.vue'), 'utf8')
  assert.match(diagnostics, /@session="openSessions"/)
  assert.match(diagnostics, /function openSessions\(\) \{ if \(props\.active && access\.value\.sessions && sessionSnapshot\.value\?\.supported === true\)/)
  assert.match(diagnostics, /navigateWorkspace\?\.\('connections', \{ nodeId: props\.nodeId \}\)/)
  assert.match(diagnostics, /useRuntimeWorkspaceNavigation\(\)/)
  assert.doesNotMatch(diagnostics, /key="sessions"/)
})


test('hidden cluster views keep their node and tool snapshot without consuming trace or connection filters', async () => {
  const h = harness({ nodeId: 'a', tool: 'mbean' })
  try {
    await flush()
    h.route.query = { view: 'tracing', nodeId: 'trace-b', traceId: 'a'.repeat(32) }; await flush()
    assert.equal(h.view.active.value, false); assert.equal(h.view.selected.value, 'a'); assert.equal(h.view.tab.value, 'mbean')
    assert.equal(h.view.membership.data.value[0].id, 'a')
    h.route.query = { view: 'connections', nodeId: 'connection-c', deviceId: 'device' }; await flush()
    h.view.select('connection-c'); h.view.selectTab('logs'); await flush()
    assert.deepEqual(h.route.query, { view: 'connections', nodeId: 'connection-c', deviceId: 'device' })
    assert.equal(h.view.selected.value, 'a'); assert.equal(h.view.tab.value, 'mbean')
    h.route.query = { view: 'cluster', nodeId: 'a', tool: 'mbean' }; await flush()
    assert.equal(h.view.active.value, true); assert.equal(h.view.tab.value, 'mbean')
  } finally { h.scope.stop() }
})
