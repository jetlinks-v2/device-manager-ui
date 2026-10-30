import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)

function harness() {
  const mounted = [], reads = [], writes = [], streams = []
  const storage = { getItem: key => { reads.push(key); return null }, setItem: (...entry) => writes.push(entry) }
  const source = readFileSync(new URL('../visDashboard/SystemMonitor/hooks/useSystemMonitorRuntime.ts', import.meta.url), 'utf8')
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  const imports = id => {
    if (id === 'vue') return { ...vue, onMounted: callback => mounted.push(callback), onActivated: () => {}, onDeactivated: () => {}, provide: () => {} }
    if (id === '../services/realtime') return { subscribeRealtimeResources: observer => {
      const stream = { observer, stopped: false }; streams.push(stream)
      return { unsubscribe: () => stream.stopped = true }
    } }
    if (id === '../utils/realtimeResourceData') return {
      createRealtimeNodeNormalizer: () => items => items,
      defaultFocusedRealtimeNodes: nodes => nodes.map(node => node.nodeId),
    }
    if (id === '../utils/focusedNodes') return {
      FOCUSED_NODES_STORAGE_KEY: 'dashboard-focus',
      readFocusedNodes: value => { value?.getItem('dashboard-focus'); return {} },
      readNetworkFocusMode: () => 'auto',
      reconcileFocusedNodes: nodes => nodes.map(node => node.nodeId),
    }
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(imports, module, module.exports)
  const scope = vue.effectScope()
  return { ...module.exports, scope, storage, reads, writes, streams, mount: () => mounted.forEach(callback => callback()) }
}

test('an independent monitoring stream leaves dashboard focus storage untouched', () => {
  for (const persistFocus of [false, undefined]) {
    const h = harness()
    try {
      const view = h.scope.run(() => h.provideSystemMonitorRuntime({ storage: h.storage, persistFocus }))
      h.mount()
      h.streams[0].observer.next([{ nodeId: 'node-a' }])
      view.selectNodes('cpu', ['node-a'])
      assert.equal(view.nodes.value[0].nodeId, 'node-a')
      assert.equal(h.reads.length, persistFocus === false ? 0 : 1)
      assert.equal(h.writes.length, persistFocus === false ? 0 : 2)
    } finally { h.scope.stop() }
    assert.equal(h.streams[0].stopped, true)
  }
})

test('revoking and restoring monitoring releases old streams and refresh opens exactly one current owner', async () => {
  const h = harness(), enabled = vue.ref(false)
  try {
    const view = h.scope.run(() => h.provideSystemMonitorRuntime({ enabled, persistFocus: false }))
    h.mount()
    assert.equal(h.streams.length, 0)
    enabled.value = true; await vue.nextTick()
    const stream = h.streams[0]
    stream.observer.next([{ nodeId: 'node-a' }])
    assert.equal(view.nodes.value.length, 1)
    enabled.value = false; await vue.nextTick()
    assert.equal(stream.stopped, true)
    stream.observer.next([{ nodeId: 'late-node' }])
    assert.deepEqual(view.nodes.value, [])
    assert.equal(view.updatedAt.value, '')
    enabled.value = true; await vue.nextTick()
    assert.equal(h.streams.length, 2)
    stream.observer.next([{ nodeId: 'old-account' }])
    assert.deepEqual(view.nodes.value, [])
    h.streams[1].observer.next([{ nodeId: 'restored-node' }])
    assert.equal(view.nodes.value[0].nodeId, 'restored-node')
    view.refresh()
    assert.equal(h.streams[1].stopped, true)
    assert.equal(h.streams.length, 3)
    h.streams[1].observer.next([{ nodeId: 'stale-scope' }])
    assert.equal(view.nodes.value[0].nodeId, 'restored-node')
    h.streams[2].observer.next([{ nodeId: 'current-scope' }])
    assert.equal(view.nodes.value[0].nodeId, 'current-scope')
  } finally { h.scope.stop() }
  assert.ok(h.streams.every(stream => stream.stopped))
})
