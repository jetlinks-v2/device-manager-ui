import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../views/device/list/unified/useUnifiedDeviceRows.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 4; i++) { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() } }
const device = id => ({ id: String(id), name: String(id), productId: 'p', connectionStatus: 'online' })
const page = (start, length = 50, total = 120) => ({ data: Array.from({ length }, (_, i) => device(start + i)), total })

function setup(t, query, enrich = async () => []) {
  const calls = [], runtimeCalls = [], exports = {}, scope = vue.effectScope(), rows = vue.ref([])
  const provider = { id: 'device', enrich: async data => { runtimeCalls.push(data); return enrich(data) } }
  const context = { value: { type: 'device', provider, terms: [], baseTerms: [] } }
  new Function('require', 'exports', code)(id => ({
    '../../../../api/device': { queryDevicePage_api: async (...args) => { calls.push(args); return query(...args) } },
  })[id] || require(id), exports)
  const list = scope.run(() => exports.useUnifiedDeviceRows({ rows, prepare: async () => {}, context: () => context.value,
    classify: () => context.value.type === 'all' ? 'device' : context.value.type, onRows() {}, errorMessage: () => 'failed',
  }))
  t.after(() => scope.stop())
  return { ...list, rows, calls, runtimeCalls, context, scope }
}

test('first batch appears before optional provider enrichment', async t => {
  const detail = deferred(), list = setup(t, async () => page(0), () => detail.promise)
  await list.reload()
  assert.equal(list.rows.value.length, 50)
  assert.equal(list.loading.value, false)
  assert.equal(list.total.value, 120)
  assert.equal(list.details.value['0'], 'loading')
  assert.deepEqual(list.calls[0][0].sorts, [{ name: 'createTime', order: 'desc' }, { name: 'id', order: 'asc' }])
  assert.equal(list.calls[0][0].pageSize, 50)
  detail.resolve([{ ...device(0), channelNumber: 123 }]); await flush()
  assert.equal(list.rows.value[0].channelNumber, 123)
  assert.equal(list.details.value['0'], 'ready')
})

test('append is single-flight, deduplicates stable ids, and terminates at the transport end', async t => {
  const next = deferred(), list = setup(t, params => params.pageIndex === 0 ? page(0) : params.pageIndex === 1 ? next.promise : page(99, 21))
  await list.reload(); await flush()
  const pending = list.loadMore(); await list.loadMore()
  assert.equal(list.calls.length, 2)
  next.resolve(page(49)); await pending
  assert.equal(list.rows.value.length, 99)
  assert.equal(new Set(list.rows.value.map(row => row.id)).size, 99)
  assert.equal(list.hasMore.value, true)
  await list.loadMore()
  assert.equal(list.rows.value.length, 120)
  assert.equal(list.hasMore.value, false)
  await list.loadMore()
  assert.deepEqual(list.calls.map(([params]) => params.pageIndex), [0, 1, 2])
})

test('append failure preserves rows and retry repeats the failed batch', async t => {
  let failed = false
  const list = setup(t, async params => {
    if (params.pageIndex === 1 && !failed) { failed = true; throw Error('temporary') }
    return page(params.pageIndex * 50)
  })
  await list.reload(); await list.loadMore()
  assert.equal(list.rows.value.length, 50)
  assert.equal(list.error.value, '')
  assert.equal(list.appendError.value, 'temporary')
  await list.loadMore()
  assert.equal(list.rows.value.length, 100)
  assert.equal(list.appendError.value, '')
  assert.deepEqual(list.calls.map(([params]) => params.pageIndex), [0, 1, 1])
})

test('old list responses cannot overwrite a new query', async t => {
  const oldPage = deferred(), oldDetail = deferred()
  let requests = 0
  const list = setup(t, () => ++requests === 1 ? oldPage.promise : page(200, 1, 1), () => oldDetail.promise)
  const first = list.reload(); await flush()
  list.context.value = { type: 'gateway', terms: [{ column: 'name', value: 'new' }], baseTerms: [{ column: 'kind', value: 'gateway' }] }
  await list.reload(); oldPage.resolve(page(0)); await first
  assert.deepEqual(list.rows.value.map(row => row.id), ['200'])
  assert.equal(list.rows.value[0].category, 'gateway')
  assert.deepEqual(list.calls[1][1], [{ column: 'kind', value: 'gateway' }])
  assert.equal(list.runtimeCalls.length, 0)
  oldDetail.resolve({ data: [{ id: '200', lastReportTime: 999 }] }); await flush()
  assert.equal(list.rows.value[0].lastReportTime, undefined)
})

test('field failure remains local and can retry only requested loaded rows', async t => {
  let broken = true
  const list = setup(t, async () => page(0), async data => {
    if (broken) throw Error('provider unavailable')
    return data.map(row => ({ ...row, channelNumber: 456 }))
  })
  await list.reload(); await flush()
  assert.equal(list.rows.value.length, 50)
  assert.equal(list.error.value, '')
  assert.equal(list.details.value['0'], 'error')
  broken = false; list.retryDetails(['0', '1']); await flush()
  assert.equal(list.runtimeCalls.at(-1).length, 2)
  assert.equal(list.details.value['0'], 'ready')
  assert.equal(list.details.value['2'], 'error')
  assert.equal(list.rows.value[0].channelNumber, 456)
})

test('old provider enrichment cannot overwrite the same id in a newer filter', async t => {
  const old = deferred(); let count = 0
  const list = setup(t, async () => page(0, 1, 1), () => ++count === 1 ? old.promise : Promise.resolve([{ ...device(0), channelNumber: 222 }]))
  await list.reload(); await flush()
  list.context.value = { ...list.context.value, terms: [{ column: 'name', value: 'new' }] }
  await list.reload(); await flush()
  assert.equal(list.rows.value[0].channelNumber, 222)
  old.resolve([{ ...device(0), channelNumber: 999 }]); await flush()
  assert.equal(list.rows.value[0].channelNumber, 222)
})

test('all-device results need no provider or runtime enrichment request', async t => {
  const list = setup(t, async () => page(0))
  list.context.value = { type: 'all', terms: [], baseTerms: [] }
  await list.reload(); await flush()
  assert.equal(list.runtimeCalls.length, 0)
  assert.deepEqual(list.details.value, {})
})

test('refresh retains the visible collection while bounded batches rebuild its loaded extent', async t => {
  let refresh = false
  const waiting = deferred(), list = setup(t, params => refresh && params.pageIndex === 0 ? waiting.promise : page(params.pageIndex * 50))
  await list.reload(); await list.loadMore(); await flush()
  const revision = list.revision.value
  refresh = true
  const reload = list.reload(true); await flush()
  assert.equal(list.rows.value.length, 100)
  assert.equal(list.loading.value, true)
  waiting.resolve(page(0)); await reload
  assert.equal(list.rows.value.length, 100)
  assert.equal(list.revision.value, revision)
  assert.deepEqual(list.calls.slice(-2).map(([params]) => [params.pageIndex, params.pageSize]), [[0, 50], [1, 50]])
})

test('a disposed list discards the pending batch', async t => {
  const pending = deferred(), list = setup(t, () => pending.promise)
  const work = list.reload(); await flush(); list.scope.stop()
  pending.resolve(page(0)); await work
  assert.equal(list.rows.value.length, 0)
})
