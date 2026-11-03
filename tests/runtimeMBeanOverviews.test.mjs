import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..'), core = resolve(root, '../../jetlinks-web-core')
const name = 'org.jetlinks:type=AiSearch,name=IndexMaintenance'
const raw = success => ({ 'org.jetlinks': { AiSearch: { IndexMaintenance: {
  '@objectName': name, '@name': 'IndexMaintenance', '@attributes': [{ name: 'Runtime', type: 'java.util.Map', readable: true, available: true }], Runtime: { success },
} } } })
function harness() {
  const node = vue.ref('a'), active = vue.ref(true), access = vue.ref(true), scopeKey = vue.ref('user:project'), scope = vue.effectScope(), sources = [], cache = new Map()
  let refreshes = 0
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename)
    const module = { exports: {} }, { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return vue
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return { mbeanOverviewRenderers: () => [{ id: 'ai', overview: { name, attributes: ['Runtime'] } }] }
      if (id === './collection/useMBeanCollection') return { useMBeanCollection(demand, receive) {
        const source = { demand: demand(), receive, disposed: false }; sources.push(source)
        vue.watch(demand, value => { source.demand = value }, { flush: 'sync', deep: true })
        vue.onScopeDispose(() => { source.disposed = true })
        return { refresh: () => { refreshes++ } }
      } }
      if (id === './status') return { diagnosticErrorState: error => ({ status: error.status === 403 ? 'forbidden' : 'error', message: error.message }) }
      if (id.startsWith('@jetlinks-web-core/')) return load(resolve(core, `src/${id.slice('@jetlinks-web-core/'.length)}.ts`))
      return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports); cache.set(filename, module.exports)
    return module.exports
  }
  const view = scope.run(() => load(resolve(root, 'views/link/diagnostics/useNodeMBeanOverviews.ts')).useNodeMBeanOverviews(node, active, scopeKey, access))
  const emit = (value = raw(12), nodeId = node.value) => sources[0].receive({ status: 'fulfilled', value, nodeId, collectedAt: 1000 })
  const fail = (status = 500) => sources[0].receive({ status: 'rejected', reason: { status }, nodeId: node.value, collectedAt: 2000 })
  return { node, active, access, scopeKey, view, sources, emit, fail, refreshes: () => refreshes, stop: () => scope.stop() }
}

test('node overview declares only lightweight Runtime to the shared collector and hides absent capability', () => {
  const h = harness()
  try {
    assert.deepEqual(h.sources[0].demand, { nodeIds: ['a'], enabled: true, name, attributes: ['Runtime'] })
    h.emit(); assert.equal(h.view.entries.value[0].bean.attributes[0].value.success, 12)
    h.view.refresh(); assert.equal(h.refreshes(), 1)
    h.emit({}); assert.deepEqual(h.view.entries.value, [])
  } finally { h.stop() }
  assert.equal(h.sources[0].disposed, true)
})

test('node switch, deactivation and permission loss stop or reject old evidence', () => {
  const h = harness()
  try {
    h.emit(); h.node.value = 'b'; assert.deepEqual(h.view.entries.value, [])
    h.emit(raw(99), 'a'); assert.deepEqual(h.view.entries.value, [])
    h.emit(raw(2)); assert.equal(h.view.entries.value[0].bean.attributes[0].value.success, 2)
    h.active.value = false; assert.equal(h.sources[0].demand.enabled, false)
    h.emit(raw(9)); assert.equal(h.view.entries.value[0].bean.attributes[0].value.success, 2)
    h.access.value = false; assert.deepEqual(h.view.entries.value, [])
    h.view.refresh(); assert.equal(h.refreshes(), 0)
    h.active.value = true; assert.equal(h.sources[0].demand.enabled, false)
    h.access.value = true; assert.equal(h.sources[0].demand.enabled, true)
    h.emit(raw(3)); h.scopeKey.value = 'other-user'; assert.deepEqual(h.view.entries.value, [])
  } finally { h.stop() }
})

test('sampling errors retain stale evidence and collection time, forbidden removes payload', () => {
  const h = harness()
  try {
    h.emit(); h.fail()
    assert.equal(h.view.entries.value[0].state.status, 'stale')
    assert.equal(h.view.entries.value[0].state.sampledAt, 1000)
    h.fail(403); assert.equal(h.view.entries.value[0].bean, undefined)
    assert.equal(h.view.entries.value[0].state.status, 'forbidden')
  } finally { h.stop() }
})
