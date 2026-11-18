import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { computed, nextTick, ref } from 'vue'

async function loadModule(file, bindings, names) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const statements = parsed.statements.filter(statement => !ts.isImportDeclaration(statement) && (!names
    || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => names.includes(d.name.getText(parsed))))))
  const { outputText } = ts.transpileModule(statements.map(s => s.getFullText(parsed)).join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  vm.runInNewContext(`${outputText};${names ? `module.exports = {${names.join(',')}}` : ''}`, { module, exports: module.exports, ...bindings })
  return module.exports
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function pickerFixture(enabledOnly = true) {
  const requests = []
  let mounted, unmount
  const { collectProductCategoryScopeIds } = await loadModule('utils/deviceCreationSources.ts', {})
  const { useIotDeviceProductPicker } = await loadModule('views/device/list/hooks/useIotDeviceProductPicker.ts', {
    computed, ref, onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
    useI18n: () => ({ t: key => key }), collectProductCategoryScopeIds,
    queryDeviceProductCategoryTree_api: async () => ({
      categories: [{ id: 'parent', name: '父分类', _children: [{ id: 'child', name: '子分类' }] }], total: 12, unclassified: 2,
    }),
    queryDeviceProductPage_api: query => { const request = deferred(); requests.push({ query, ...request }); return request.promise },
  })
  const state = useIotDeviceProductPicker({ enabledOnly })
  mounted()
  await new Promise(setImmediate)
  return { state, requests, unmount }
}

test('category descendants, paging and OR searches keep the import scope and original editor terms', async () => {
  const f = await pickerFixture()
  assert.equal(f.state.totalProductCount.value, 12)
  assert.equal(f.state.unclassifiedProductCount.value, 2)
  f.requests[0].resolve({ data: [], total: 0, pageIndex: 0 })
  await nextTick()
  const raw = [{ column: 'name', termType: 'like', value: 'MQTT' }, { column: 'deviceType', type: 'or', value: 'gateway' }]
  const search = f.state.loadProducts({ terms: raw, pageIndex: 3 })
  assert.equal(f.requests[1].query.enabledOnly, true)
  assert.equal(f.requests[1].query.pageIndex, 3)
  assert.equal(f.requests[1].query.terms[0].type, 'and')
  assert.equal(JSON.stringify(f.requests[1].query.terms[0].terms), JSON.stringify(raw))
  f.requests[1].resolve({ data: [], total: 0, pageIndex: 3 })
  await search
  f.state.selectCategory('parent')
  assert.equal(f.requests[2].query.pageIndex, 0)
  assert.equal(JSON.stringify(f.requests[2].query.classifiedIds), JSON.stringify(['parent', 'child']))
  assert.equal(f.state.filterTerms.value[0].value, 'MQTT')
  f.state.selectUnclassified()
  assert.equal(f.requests[3].query.unclassified, true)
  assert.equal(f.requests[3].query.classifiedIds, undefined)
  f.unmount()
})

test('export includes disabled products and stale or unmounted responses cannot replace current cards', async () => {
  const f = await pickerFixture(false)
  assert.equal(f.requests[0].query.enabledOnly, false)
  const latest = f.state.loadProducts({ pageIndex: 1 })
  f.requests[1].resolve({ data: [{ id: 'latest' }], total: 12, pageIndex: 1 })
  await latest
  f.requests[0].resolve({ data: [{ id: 'old' }], total: 1, pageIndex: 0 })
  await nextTick()
  assert.equal(f.state.products.value[0].id, 'latest')
  const closed = f.state.loadProducts()
  f.unmount()
  f.requests[2].resolve({ data: [{ id: 'closed' }], total: 1, pageIndex: 0 })
  await closed
  assert.equal(f.state.products.value[0].id, 'latest')
})

test('product API keeps enabled-only as its default and can explicitly query all product states', async () => {
  const requests = []
  const { queryDeviceProductPage_api } = await loadModule('api/device.ts', {
    request: { post: async (url, query) => { requests.push({ url, query }); return { result: { data: [], total: 0 } } } },
    getProjectRuntimeContext: () => ({}), withProjectRuntimeRequest: () => ({}), toProductTemplate: item => item,
  }, ['normalizeLikeTermValue', 'queryDeviceProductPage_api'])
  await queryDeviceProductPage_api()
  assert.equal(requests[0].query.terms[0].column, 'state')
  assert.equal(requests[0].query.terms[0].value, 1)
  const terms = [{ terms: [{ column: 'name', termType: 'like', value: 'MQTT' }] }]
  await queryDeviceProductPage_api({ enabledOnly: false, terms })
  assert.equal(requests[1].query.terms.some(t => t.column === 'state'), false)
  assert.equal(requests[1].query.terms[0].terms[0].value, '%MQTT%')
  assert.equal(terms[0].terms[0].value, 'MQTT')
})
