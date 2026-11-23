import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { buildSync } from 'esbuild'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const service = ts.transpileModule(readFileSync(new URL('../views/device/Product/services/productListRequest.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const controllerCode = buildSync({
  entryPoints: [require.resolve('@jetlinks-web/components/es/ProTable/hooks/useProTableRequest.js')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
}).outputFiles[0].text
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const settle = async () => { for (let i = 0; i < 6; i++) { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)) } }
const pageResponse = (data, pageIndex = 0) => ({ success: true, result: { data, pageIndex, pageSize: 12, total: 20 } })

function setup(api) {
  const calls = []
  const module = { exports: {} }
  const wrapped = Object.fromEntries(['queryDetailList', 'queryNoPagingPost'].map(method => [method, async (...args) => {
    calls.push({ method, args })
    return api[method](...args)
  }]))
  new Function('require', 'exports', service)(id => id === '../../../../api/product' ? wrapped : require(id), module.exports)
  return { request: module.exports.queryProductList, calls }
}

test('loads only current-page brands in one batch and preserves count, paging, order and the original response', async () => {
  const original = pageResponse([{ id: 'b', deviceCount: 7, state: 1 }, { id: 'a', deviceCount: 2 }, { id: 'b', deviceCount: 7 }], 3)
  const params = { pageIndex: 3, pageSize: 12, terms: [{ column: 'name', termType: 'like', value: '%传感器%' }] }
  const abort = new AbortController()
  const h = setup({
    queryDetailList: async () => original,
    queryNoPagingPost: async () => ({ success: true, result: [
      { id: 'a', manufacturer: '厂商 A', model: 'A-1', deviceCount: 999, state: 0 },
      { id: 'b', manufacturer: '厂商 B', model: 'B-1', i18nManufacturer: 'Brand B', i18nModel: 'Model B' },
      { id: 'outside-page', manufacturer: '不可合并' },
    ] }),
  })
  const result = await h.request(params, { signal: abort.signal })
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[0].args[0], params)
  assert.equal(h.calls[0].args[1].signal, abort.signal)
  assert.equal(h.calls[1].args[1].signal, abort.signal)
  assert.deepEqual(h.calls[1].args[0], {
    paging: false, includes: ['id', 'manufacturer', 'model', 'i18nMessages'],
    terms: [{ column: 'id', termType: 'in', value: ['b', 'a'] }],
  })
  assert.deepEqual(result.result.data.map(row => [row.id, row.deviceCount]), [['b', 7], ['a', 2], ['b', 7]])
  assert.equal(result.result.data[0].i18nManufacturer, 'Brand B')
  assert.equal(result.result.data[1].model, 'A-1')
  assert.equal(result.result.data[0].state, 1)
  assert.deepEqual([result.result.total, result.result.pageIndex, result.result.pageSize], [20, 3, 12])
  assert.equal(original.result.data[0].manufacturer, undefined)
})

test('empty or failed detail pages never trigger an unbounded product query', async () => {
  for (const original of [pageResponse([]), { success: false }, pageResponse([{ id: '' }])]) {
    const h = setup({ queryDetailList: async () => original, queryNoPagingPost: async () => { throw Error('must not run') } })
    assert.equal(await h.request({}), original)
    assert.equal(h.calls.length, 1)
  }
})

test('failed supplemental queries keep the successful list available', async () => {
  for (const supplemental of [async () => { throw Error('network unavailable') }, async () => ({ success: false }), async () => ({ success: true, result: null })]) {
    const original = pageResponse([{ id: 'a', deviceCount: 3 }])
    const h = setup({ queryDetailList: async () => original, queryNoPagingPost: supplemental })
    assert.equal(await h.request({}), original)
    assert.equal(h.calls.length, 2)
  }
})

test('partial brand results preserve unmatched rows and explicit blank values', async () => {
  const original = pageResponse([{ id: 'a', manufacturer: '旧厂商', model: 'A' }, { id: 'b', manufacturer: '原厂商' }])
  const h = setup({ queryDetailList: async () => original, queryNoPagingPost: async () => ({ success: true, result: [{ id: 'a', manufacturer: null, model: '' }] }) })
  const result = await h.request({})
  assert.equal(result.result.data[0].manufacturer, null)
  assert.equal(result.result.data[0].model, '')
  assert.equal(result.result.data[1], original.result.data[1])
})

test('primary query exceptions still reach ProTable error handling', async () => {
  const h = setup({ queryDetailList: async () => { throw Error('primary query failed') }, queryNoPagingPost: async () => ({}) })
  await assert.rejects(h.request({}), /primary query failed/)
  assert.equal(h.calls.length, 1)
})

function table(t, request) {
  let dispose
  const module = { exports: {} }
  new Function('require', 'module', 'exports', controllerCode)(id => id === 'vue'
    ? { ...vue, onBeforeUnmount: callback => { dispose = callback } } : require(id), module, module.exports)
  const page = vue.reactive({ pageIndex: 0, pageSize: 12, total: 0, loading: false })
  const rows = vue.ref([]), loading = vue.ref(false), errors = []
  const controller = module.exports.useProTableRequest({ request, defaultParams: {}, type: 'PAGE' }, page, loading, rows, () => {}, error => errors.push(error))
  t.after(() => dispose())
  return { page, rows, loading, errors, load: pageIndex => controller.handleSearch({ pageIndex, pageSize: 12 }) }
}

test('a superseded detail response does not issue a second query or replace the current page', async t => {
  const old = deferred()
  const h = setup({
    queryDetailList: async params => params.pageIndex === 0 ? old.promise : pageResponse([{ id: 'new' }], 1),
    queryNoPagingPost: async () => ({ success: true, result: [{ id: 'new', manufacturer: '新厂商' }] }),
  })
  const ui = table(t, h.request), previous = ui.load(0)
  await settle()
  await ui.load(1)
  old.resolve(pageResponse([{ id: 'old' }]))
  await previous
  assert.equal(h.calls.filter(call => call.method === 'queryNoPagingPost').length, 1)
  assert.equal(ui.rows.value[0].id, 'new')
  assert.equal(ui.page.pageIndex, 1)
  assert.equal(ui.loading.value, false)
  assert.deepEqual(ui.errors, [])
})

test('a superseded brand response cannot replace rows or clear loading for a newer page', async t => {
  const old = deferred()
  const h = setup({
    queryDetailList: async params => pageResponse([{ id: params.pageIndex === 0 ? 'old' : 'new' }], params.pageIndex),
    queryNoPagingPost: async params => params.terms[0].value[0] === 'old' ? old.promise : ({ success: true, result: [{ id: 'new', model: 'new-model' }] }),
  })
  const ui = table(t, h.request), previous = ui.load(0)
  await settle()
  await ui.load(1)
  old.resolve({ success: true, result: [{ id: 'old', model: 'old-model' }] })
  await previous
  assert.equal(ui.rows.value[0].id, 'new')
  assert.equal(ui.rows.value[0].model, 'new-model')
  assert.equal(ui.page.pageIndex, 1)
  assert.equal(ui.loading.value, false)
  assert.deepEqual(ui.errors, [])
})
