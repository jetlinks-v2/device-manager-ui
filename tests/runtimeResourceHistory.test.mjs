import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import dayjs from 'dayjs'

const require = createRequire(import.meta.url), modules = new Map()
const range = (from = 0, to = 3600000) => [dayjs(from), dayjs(to)]
const emptyHistory = () => ({ cpuSystem: [], cpuJvm: [], memorySystem: [], memoryJvm: [],
  traffic: { nodes: [], times: [], timestamps: [], series: { trafficUp: {}, trafficDown: {} } },
  network: { nodes: [], series: { hostReceive: {}, hostSend: {}, packetLoss: {}, interfaceErrors: {}, tcpRetransmission: {}, tcpConnections: {} } } })
let historyLoader = async () => emptyHistory()
function load(filename) {
  if (modules.has(filename)) return modules.get(filename)
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return { ...vue, provide() {} }
    if (id.endsWith('services/history')) return { loadResourceOverviewHistory: (...args) => historyLoader(...args) }
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }, module, module.exports)
  modules.set(filename, module.exports); return module.exports
}
const { createResourceHistoryCache, provideResourceHistoryCache, selectNodeResourceHistory } = load(resolve(import.meta.dirname, '../views/link/diagnostics/overview/useResourceHistory.ts'))

test('same relative window shares one request and one completed snapshot without changing its sampled time or range', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000000 })
  const calls = [], cache = createResourceHistoryCache(async (...args) => { calls.push(args); return emptyHistory() })
  const a = cache.load(range(), new AbortController().signal, 3600)
  const b = cache.load(range(500, 3600500), new AbortController().signal, 3600)
  const [first, concurrent] = await Promise.all([a, b])
  assert.equal(calls.length, 1); assert.equal(first, concurrent)
  t.mock.timers.tick(10000)
  const cached = await cache.load(range(10000, 3610000), new AbortController().signal, 3600)
  assert.equal(cached, first); assert.equal(cached.sampledAt, 10000000)
  assert.deepEqual(cached.range.map(date => date.valueOf()), [0, 3600000])
  await cache.load(range(10000, 3610000), new AbortController().signal, 3600, true)
  assert.equal(calls.length, 2, 'explicit refresh bypasses completed cache')
  t.mock.timers.tick(60000)
  await cache.load(range(70000, 3670000), new AbortController().signal, 3600)
  assert.equal(calls.length, 3, 'minute-level history does not stay cached indefinitely')
  cache.clear()
})

test('fixed ranges stay distinct; clear and failed refresh cannot restore or reuse prior sensitive history', async () => {
  let fail = false, calls = 0
  const cache = createResourceHistoryCache(async () => { calls++; if (fail) throw { status: 403 }; return emptyHistory() })
  await cache.load(range(), new AbortController().signal)
  await cache.load(range(), new AbortController().signal)
  assert.equal(calls, 1)
  await cache.load(range(0, 7200000), new AbortController().signal)
  assert.equal(calls, 2)
  fail = true
  await assert.rejects(cache.load(range(0, 7200000), new AbortController().signal, undefined, true))
  await assert.rejects(cache.load(range(0, 7200000), new AbortController().signal))
  assert.equal(calls, 4)
  fail = false; cache.clear()
  await cache.load(range(), new AbortController().signal); assert.equal(calls, 5)
  cache.clear()
})

test('one canceled consumer does not abort another; the last consumer cancels transport and rejects late results', async () => {
  const requests = [], cache = createResourceHistoryCache((_, signal) => new Promise(done => requests.push({ signal, done })))
  const a = new AbortController(), b = new AbortController()
  const first = cache.load(range(), a.signal, 3600), second = cache.load(range(), b.signal, 3600)
  await Promise.resolve(); a.abort(); await assert.rejects(first, { name: 'AbortError' })
  assert.equal(requests[0].signal.aborted, false)
  requests[0].done(emptyHistory()); await second
  const c = new AbortController(), third = cache.load(range(), c.signal, 3600, true)
  await Promise.resolve(); c.abort(); await assert.rejects(third, { name: 'AbortError' })
  assert.equal(requests[1].signal.aborted, true)
  requests[1].done(emptyHistory()); await Promise.resolve()
  const fourth = cache.load(range(), new AbortController().signal, 3600)
  await Promise.resolve(); assert.equal(requests.length, 3)
  requests[2].done(emptyHistory()); await fourth; cache.clear()
})

test('page scope, permission, pause and disposal synchronously invalidate pending history without accepting late responses', async () => {
  const requests = [], scope = vue.ref('alice:project-a'), permitted = vue.ref(true), active = vue.ref(true), effect = vue.effectScope()
  historyLoader = (_, signal) => new Promise(done => requests.push({ signal, done }))
  const cache = effect.run(() => provideResourceHistoryCache(scope, permitted, active))
  try {
    for (const invalidate of [() => { scope.value = 'bob:project-b' }, () => { permitted.value = false }, () => { active.value = false }, () => effect.stop()]) {
      const promise = cache.load(range(), new AbortController().signal, 3600)
      await Promise.resolve(); const request = requests.at(-1)
      invalidate(); assert.equal(request.signal.aborted, true)
      request.done(emptyHistory()); await assert.rejects(promise, { name: 'AbortError' })
    }
    const next = cache.load(range(), new AbortController().signal, 3600)
    await Promise.resolve(); assert.equal(requests.length, 5, 'late responses never repopulate completed cache')
    requests.at(-1).done(emptyHistory()); await next
  } finally { cache.clear(); effect.stop(); historyLoader = async () => emptyHistory() }
})

test('node evidence retains only its own resource, traffic and network series', () => {
  const source = emptyHistory()
  for (const metric of ['cpuSystem', 'cpuJvm', 'memorySystem', 'memoryJvm']) source[metric] = [{ nodeId: 'a', points: [] }, { nodeId: 'b', points: [] }]
  source.traffic.nodes = ['a', 'b']; source.network.nodes = ['a', 'b']
  for (const series of [...Object.values(source.traffic.series), ...Object.values(source.network.series)]) { series.a = { _data: [1] }; series.b = { _data: [2] } }
  const selected = selectNodeResourceHistory(source, 'a')
  assert.deepEqual(selected.cpuJvm.map(item => item.nodeId), ['a'])
  assert.deepEqual(selected.traffic.nodes, ['a']); assert.deepEqual(selected.network.nodes, ['a'])
  for (const series of [...Object.values(selected.traffic.series), ...Object.values(selected.network.series)]) assert.deepEqual(Object.keys(series), ['a'])
  assert.equal(source.cpuJvm.length, 2, 'shared history remains unchanged for other nodes')
})
