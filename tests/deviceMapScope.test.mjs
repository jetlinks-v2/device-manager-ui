import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
function load(path, dependencies = {}) {
  const source = readFileSync(new URL('../visDashboard/DeviceManagement/' + path, import.meta.url), 'utf8').replaceAll('import.meta.env.DEV', 'false')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const exports = {}
  new Function('exports', 'require', code)(exports, id => dependencies[id] ?? require(id))
  return exports
}
const point = id => ({ deviceId: id, label: id, lnglat: [116, 39] })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const settle = async () => { await vue.nextTick(); await Promise.resolve(); await vue.nextTick() }
function service(query) {
  return load('services/deviceMap.ts', {
    '@jetlinks-web/constants': {}, '@jetlinks-web/utils': {}, '@jetlinks-web-core/utils': {}, 'event-source-polyfill': {},
    '../../../api/deviceInstanceMonitoring': { queryDeviceInstanceStates: query },
    '../../../dataCapabilities/deviceInstanceMonitoring.service': {},
  }).filterDeviceMapPoints
}
function mount(setup) {
  let value
  const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  const app = renderer.createApp({ setup() { value = setup(); return () => null } })
  app.mount({})
  return { value, unmount: () => app.unmount() }
}
function hook(filter, loadStates = async points => ({ points, failed: false })) {
  const streams = []
  const { useDeviceMap } = load('hooks/useDeviceMap.ts', {
    '../DeviceMapCard/config': { deviceMapCardConfig: { componentProps: { deviceMapCard: { isAutoRefresh: false } } } },
    '../shared': load('shared.ts'),
    '../services/deviceMap': { createDeviceMapStream(handlers) { const stream = { ...handlers, close() {} }; streams.push(stream); return stream }, filterDeviceMapPoints: filter, loadDeviceMapStates: loadStates },
    '../DeviceMapCard/markers': { createDeviceMapMarkerOptions: () => ({}) },
    '../DeviceMapCard/cluster': {}, './useDeviceMapSelection': { useDeviceMapSelection: () => ({ close() {} }) }, '../../../utils/map': {},
  })
  const info = vue.ref({ componentProps: { deviceMapCard: { deviceTerms: [] } } })
  return { streams, info, ...mount(() => useDeviceMap(info, vue.ref(false), vue.ref(true))) }
}

test('scope query batches IDs, combines terms with AND and snapshots them', async () => {
  const calls = [], first = deferred()
  const filter = service((body, config) => { calls.push({ body, config }); return calls.length === 1 ? first.promise : Promise.resolve({ result: [{ id: 'd100' }, { id: 'foreign' }] }) })
  const terms = [{ column: 'productId', value: 'p1' }]
  const signal = new AbortController().signal
  const pending = filter(Array.from({ length: 101 }, (_, i) => point('d' + i)), terms, signal)
  terms[0].value = 'changed'
  first.resolve({ result: [{ id: 'd1' }] })
  const result = await pending
  assert.deepEqual(calls.map(c => c.body.terms[0].value.length), [100, 1])
  assert.deepEqual(calls[1].body.terms[1], { type: 'and', terms: [{ column: 'productId', value: 'p1' }] })
  assert.equal(calls[0].body.paging, false)
  assert.equal(calls[0].config.signal, signal)
  assert.deepEqual(result.map(p => p.deviceId), ['d1', 'd100'])
})

test('empty scope terms still check visible IDs; incomplete, failed and cancelled requests reject', async () => {
  let body
  const filter = service(async query => { body = query; return { result: [{ id: 'a' }] } })
  assert.deepEqual((await filter([point('a'), point('b')], [], new AbortController().signal)).map(p => p.deviceId), ['a'])
  assert.equal(body.terms.length, 1)
  for (const response of [{ success: false }, { status: 403 }, { result: { total: 2, data: [{ id: 'a' }] } }, { result: [{}] }, {}]) {
    await assert.rejects(service(async () => response)([point('a')], [], new AbortController().signal))
  }
  const ctrl = new AbortController(), wait = deferred()
  const pending = service(() => wait.promise)([point('a')], [], ctrl.signal)
  ctrl.abort(); wait.resolve({ result: [{ id: 'a' }] })
  await assert.rejects(pending, /cancelled/)
})

test('hook withholds unfiltered points, rejects stale terms results and clears on failure', async () => {
  const requests = []
  const h = hook((points, terms, signal) => { const d = deferred(); requests.push({ ...d, points, terms, signal }); return d.promise })
  h.streams[0].onMessage([point('old')]); assert.deepEqual(h.value.points.value, [])
  h.streams[0].onComplete(); await settle()
  h.info.value.componentProps.deviceMapCard.deviceTerms = [{ column: 'scope', value: 'new' }]; await settle()
  assert.equal(requests[0].signal.aborted, true)
  h.streams[1].onMessage([point('new'), point('hidden')]); h.streams[1].onComplete(); await settle()
  requests[1].resolve([point('new')]); await settle()
  requests[0].resolve([point('old')]); await settle()
  assert.deepEqual(h.value.points.value.map(p => p.deviceId), ['new'])
  h.value.refresh(); h.streams[2].onMessage([point('unfiltered')]); h.streams[2].onComplete(); await settle()
  requests[2].reject(new Error('denied')); await settle()
  assert.deepEqual(h.value.points.value, [])
  assert.equal(h.value.error.value, true)
  assert.equal(h.value.loading.value, false)
  h.unmount()
})

test('undefined terms retains immediate publication and unmount aborts pending scope', async () => {
  const requests = []
  const h = hook((points, terms, signal) => { const d = deferred(); requests.push({ ...d, signal }); return d.promise })
  h.info.value.componentProps.deviceMapCard.deviceTerms = undefined; await settle()
  h.streams[1].onMessage([point('visible')]); assert.equal(h.value.points.value[0].deviceId, 'visible')
  h.info.value.componentProps.deviceMapCard.deviceTerms = []; await settle()
  h.streams[2].onMessage([point('pending')]); h.streams[2].onComplete(); await settle()
  h.unmount(); assert.equal(requests[0].signal.aborted, true)
  requests[0].resolve([point('late')]); await settle()
  assert.deepEqual(h.value.points.value, [])
})

test('a later batch failure rejects the whole scope, never returns an earlier batch', async () => {
  let calls = 0
  const filter = service(async () => {
    calls++
    if (calls === 2) throw new Error('second batch denied')
    return { result: [{ id: 'd0' }] }
  })
  await assert.rejects(filter(Array.from({ length: 101 }, (_, i) => point('d' + i)), [], new AbortController().signal), /second batch denied/)
  assert.equal(calls, 2)
})

test('showStatus queries only authorized points and ignores stale state results', async () => {
  const filters = [], states = []
  const h = hook((points, terms, signal) => { const d = deferred(); filters.push({ ...d, points, signal }); return d.promise },
    (points, signal) => { const d = deferred(); states.push({ ...d, points, signal }); return d.promise })
  h.info.value.componentProps.deviceMapCard.showStatus = true
  await settle()
  h.streams.at(-1).onMessage([point('allowed'), point('hidden')]); h.streams.at(-1).onComplete(); await settle()
  assert.equal(states.length, 0)
  filters[0].resolve([point('allowed')]); await settle()
  assert.deepEqual(states[0].points.map(p => p.deviceId), ['allowed'])
  h.value.refresh(); assert.equal(states[0].signal.aborted, true)
  h.streams.at(-1).onMessage([point('new')]); h.streams.at(-1).onComplete(); await settle()
  filters[1].resolve([point('new')]); await settle()
  states[1].resolve({ points: [point('new')], failed: true }); await settle()
  states[0].resolve({ points: [{ ...point('allowed'), state: 'online' }], failed: false }); await settle()
  assert.equal(h.value.points.value[0].deviceId, 'new')
  assert.equal(h.value.points.value[0].state, undefined)
  assert.equal(h.value.stateError.value, true)
  h.unmount()
})
