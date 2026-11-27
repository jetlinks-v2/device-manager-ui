import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vue = require('vue'), ts = require('typescript'), rx = require('rxjs')
function load(name, dependencies) {
  const source = readFileSync(new URL(`../views/link/plugin/${name}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(dependencies, module, module.exports)
  return module.exports
}
const state = load('runtimeState', () => { throw new Error('Unexpected runtimeState dependency') })
const pause = () => new Promise(resolve => setTimeout(resolve, 125))
const row = (serverId, extra = {}) => ({ driverId: 'driver', serverId, serviceId: 'iot-service',
  status: 'ready', state: 'running', available: true, sampledAt: Date.now(), instanceKey: 'instance', ...extra })

function setup(open = true, instances = true) {
  const calls = [], demand = vue.ref(open ? [{ id: 'driver' }] : []), visibility = vue.ref('visible')
  const scope = vue.ref({ projectId: 'one' })
  const hooks = load('usePluginRuntime', name => {
    if (name === 'vue') return vue
    if (name === 'rxjs') return rx
    if (name === '@vueuse/core') return { useDocumentVisibility: () => visibility, useTimestamp: () => vue.ref(Date.now()) }
    if (name.endsWith('/request-context')) return { getRequestHeaders: () => ({}) }
    if (name === './runtimeState') return state
    if (name.endsWith('/useDiagnosticScope')) return { useDiagnosticScope: () => scope }
    if (name === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (name.endsWith('/pluginRuntime')) return { observePluginRuntime(ids, instances, metadata) {
      const subject = new rx.Subject(), call = { ids, instances, metadata, subject, cancelled: false }
      calls.push(call)
      return new rx.Observable(observer => { const subscription = subject.subscribe(observer)
        return () => { call.cancelled = true; subscription.unsubscribe() } })
    } }
    throw new Error(`Unexpected dependency ${name}`)
  })
  const noop = () => {}
  const renderer = vue.createRenderer({ createComment: () => ({}), createText: () => ({}), createElement: () => ({}),
    insert: noop, remove: noop, setText: noop, setElementText: noop, patchProp: noop, parentNode: () => null, nextSibling: () => null })
  let runtime
  const app = renderer.createApp({ setup() { runtime = hooks.usePluginRuntime(() => demand.value, instances); return () => null } })
  app.mount({})
  return { runtime, calls, demand, visibility, scope, close: () => app.unmount() }
}

test('unsupported node markers clear obsolete instances without warning or disturbing other nodes', async () => {
  const { runtime, calls, close } = setup()
  try {
    await pause()
    calls[0].subject.next([row('one'), row('two')])
    calls[0].subject.next(row('one', { kind: 'node', status: 'unknown', error: 'Timeout' }))
    assert.match(runtime.error.value, /Timeout/)
    calls[0].subject.next(row('one', { kind: 'node', status: 'unsupported' }))
    assert.equal(runtime.error.value, '')
    assert.deepEqual(runtime.rows.value.map(row => row.serverId), ['two'])
    calls[0].subject.next(row('two', { kind: 'node', status: 'ready' }))
    assert.equal(runtime.rows.value.length, 1)
    calls[0].subject.next(row('two', { kind: 'node', status: 'ready' }))
    assert.equal(runtime.rows.value.length, 0)
  } finally { close() }
})

test('unknown markers retain a genuine warning and invalidate native running state', async () => {
  const { runtime, calls, close } = setup()
  try {
    await pause()
    calls[0].subject.next(row('one'))
    calls[0].subject.next(row('one', { kind: 'node', status: 'unknown', error: 'Unavailable' }))
    assert.match(runtime.error.value, /Unavailable/)
    assert.equal(state.pluginRuntimeState(runtime.rows.value[0]), 'unknown')
    assert.equal(runtime.rows.value[0].available, false)
  } finally { close() }
})

test('inspection starts on demand and cancels on close, hidden page, identity change and unmount', async () => {
  const { runtime, calls, demand, visibility, scope, close } = setup(false)
  try {
    await pause()
    assert.equal(calls.length, 0)
    demand.value = [{ id: 'driver' }]
    await vue.nextTick(); await pause()
    assert.deepEqual([calls[0].ids, calls[0].instances, calls[0].metadata], [['driver'], true, false])
    calls[0].subject.next(row('one'))
    demand.value = []
    await vue.nextTick()
    assert.equal(calls[0].cancelled, true)
    calls[0].subject.next(row('late'))
    assert.equal(runtime.rows.value.length, 0)
    demand.value = [{ id: 'driver' }]
    await vue.nextTick(); await pause()
    calls[1].subject.next(row('one'))
    scope.value = { projectId: 'two' }
    await vue.nextTick()
    assert.equal(calls[1].cancelled, true)
    assert.equal(runtime.rows.value.length, 0)
    await pause()
    visibility.value = 'hidden'
    await vue.nextTick()
    assert.equal(calls[2].cancelled, true)
    visibility.value = 'visible'
    await vue.nextTick(); await pause()
  } finally { close() }
  assert.equal(calls.at(-1).cancelled, true)
})

test('initial loading is per driver; refresh retains samples and failure ends loading', async () => {
  const { runtime, calls, demand, close } = setup(true, false)
  try {
    demand.value = [{ id: 'driver' }, { id: 'second' }]
    await vue.nextTick(); await pause()
    assert.deepEqual([...runtime.loading.value], ['driver', 'second'])
    calls[0].subject.next(row('one'))
    assert.deepEqual([...runtime.loading.value], ['second'])
    runtime.refresh()
    assert.deepEqual([...runtime.loading.value], ['second'])
    assert.equal(runtime.status.value.driver.state, 'available')
    await pause()
    calls[1].subject.error(new Error('Disconnected'))
    assert.equal(runtime.loading.value.size, 0)
    assert.equal(runtime.status.value.driver.state, 'unknown')
    assert.equal(runtime.error.value, 'Disconnected')
  } finally { close() }
})
