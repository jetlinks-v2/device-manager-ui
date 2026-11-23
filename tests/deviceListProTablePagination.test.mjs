import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { buildSync } from 'esbuild'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const { outputFiles } = buildSync({
  entryPoints: [require.resolve('@jetlinks-web/components/es/ProTable/hooks/useProTableRequest.js')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
})
const listCode = ts.transpileModule(readFileSync(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const settle = async () => { for (let i = 0; i < 8; i++) { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)) } }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function setup(t, query) {
  const disposals = [], calls = [], failures = []
  const runtime = { ...vue, onBeforeUnmount: fn => disposals.push(fn) }
  const route = vue.reactive({ path: '/resources/devices/list', query: {} })
  const scopeId = vue.ref('')
  const mocks = {
    vue: runtime,
    'vue-router': { useRoute: () => route, useRouter: () => ({ replace: ({ query }) => { route.query = query } }) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web-core/store': { useMenuStore: () => ({ hasMenu: () => true }) },
    '@jetlinks-web-core/utils/deployment': { isPrivateDeployment: () => true },
    '@jetlinks-web-core/utils/module-registry': { moduleRegistry: { getAllModuleIds: () => [] } },
    '../../../../api/device': {
      countDevice_api: async () => 0,
      queryDevicePage_api: async params => { calls.push(structuredClone(params)); return query(params) },
    },
    '../../../../api/device-library': { queryDeviceLibraryProductFilterOptions_api: async () => [] },
    '../../../../api/deviceGroup': { queryRuntimeDevices_api: async () => ({ data: [] }) },
    '../hooks/useIotDeviceRouting': {
      isIotDeviceListEntry: () => false, resolveIotProjectId: () => '',
      getIotDeviceListMenuCode: () => 'iot-user-device-list', buildIotDeviceDetailPath: () => '/',
    },
    '../../../../deviceScope': { useDeviceScope: () => ({
      terms: vue.computed(() => scopeId.value ? [{ column: 'area', value: scopeId.value }] : []),
      scopeType: vue.ref('area'), scopeId, sidebarProps: vue.ref({ areas: [], groups: [] }), ensureReady: async () => {},
    }) },
    '@jetlinks-web-core/components/ConditionFilter': { decodeConditionFilterQuery: () => [], encodeConditionFilterQuery: () => '' },
    '../../../../deviceListFilter': { getDeviceListFilterFields: () => [], getDeviceListSearchTerms: () => [] },
    '../hooks/useSupportedDeviceListProviders': { useSupportedDeviceListProviders: source => source },
  }
  function evaluate(code) {
    const module = { exports: {} }
    new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : require(id), module, module.exports)
    return module.exports
  }
  const { useUnifiedDeviceList } = evaluate(listCode)
  const { useProTableRequest } = evaluate(outputFiles[0].text)
  const scope = vue.effectScope()
  let list, controller
  const page = vue.reactive({ pageIndex: 0, pageSize: 12, total: 0, loading: false })
  const data = vue.ref([]), loading = vue.ref(false)
  scope.run(() => {
    list = useUnifiedDeviceList()
    const props = vue.reactive({ request: list.tableRequest, params: list.tableParams, defaultParams: {}, type: 'PAGE' })
    controller = useProTableRequest(props, page, loading, data, () => {}, reason => failures.push(reason))
    // ProTable 的 params 监听驱动首查和筛选；实际请求、页数回退及迟到响应由共享组件处理。
    vue.watch(list.tableParams, params => controller.handleSearch({ ...params, pageSize: page.pageSize, pageIndex: 0 }), { deep: true, immediate: true })
  })
  t.after(() => { disposals.forEach(fn => fn()); scope.stop() })
  return { list, page, data, loading, route, scopeId, calls, failures,
    request: params => controller.handleSearch({ ...list.tableParams.value, ...params }),
  }
}

const record = id => ({ id, name: id })

test('ProTable owns initial pagination, subsequent pages and page size without duplicate list queries', async t => {
  const h = setup(t, async params => ({ data: [record(`page-${params.pageIndex}`)], total: 100 }))
  await settle()
  assert.equal(h.calls.length, 1)
  assert.deepEqual([h.calls[0].pageIndex, h.calls[0].pageSize], [0, 12])
  await h.request({ pageIndex: 1, pageSize: 12 })
  assert.deepEqual([h.page.pageIndex, h.page.pageSize], [1, 12])
  assert.equal(h.data.value[0].id, 'page-1')
  await h.request({ pageIndex: 0, pageSize: 24 })
  assert.deepEqual([h.page.pageIndex, h.page.pageSize], [0, 24])
  assert.equal(h.calls.length, 3)
})

test('scope, status and refresh reset to page one while retaining the chosen page size', async t => {
  const h = setup(t, async () => ({ data: [record('device')], total: 100 }))
  await settle()
  await h.request({ pageIndex: 2, pageSize: 24 })
  h.scopeId.value = 'area-a'
  await settle()
  assert.deepEqual([h.page.pageIndex, h.page.pageSize], [0, 24])
  assert.ok(h.calls.at(-1).terms.some(term => term.value === 'area-a'))
  await h.request({ pageIndex: 1, pageSize: 24 })
  h.list.changeStatus('offline')
  await settle()
  assert.deepEqual([h.page.pageIndex, h.page.pageSize], [0, 24])
  assert.ok(h.calls.at(-1).terms.some(term => term.column === 'state' && term.value === 'offline'))
  await h.request({ pageIndex: 1, pageSize: 24 })
  h.list.refresh()
  await settle()
  assert.deepEqual([h.page.pageIndex, h.page.pageSize], [0, 24])
})

test('slow previous pages cannot replace current rows, totals or loading', async t => {
  const old = deferred()
  const h = setup(t, params => params.pageIndex === 1 ? old.promise : Promise.resolve({ data: [record('current')], total: 100 }))
  await settle()
  const previous = h.request({ pageIndex: 1, pageSize: 12 })
  await settle()
  await h.request({ pageIndex: 2, pageSize: 12 })
  old.resolve({ data: [record('old')], total: 200 })
  await previous
  assert.equal(h.page.pageIndex, 2)
  assert.equal(h.page.total, 100)
  assert.equal(h.data.value[0].id, 'current')
  assert.equal(h.list.rows.value[0].id, 'current')
  assert.equal(h.loading.value, false)
  assert.equal(h.list.loading.value, false)
})

test('ProTable returns to the last valid page when the dataset shrinks', async t => {
  const h = setup(t, async params => ({ data: params.pageIndex > 1 ? [] : [record('remaining')], total: 13 }))
  await settle()
  await h.request({ pageIndex: 5, pageSize: 12 })
  assert.deepEqual(h.calls.slice(-2).map(call => call.pageIndex), [5, 1])
  assert.equal(h.page.pageIndex, 1)
  assert.equal(h.page.total, 13)
  assert.equal(h.data.value[0].id, 'remaining')
})

test('failed queries clear old rows and recover through the existing refresh action', async t => {
  let fail = false
  const h = setup(t, async () => { if (fail) throw Error('network unavailable'); return { data: [record('recovered')], total: 1 } })
  await settle()
  fail = true
  await h.request({ pageIndex: 0, pageSize: 12 })
  assert.equal(h.list.error.value, 'network unavailable')
  assert.deepEqual(h.data.value, [])
  assert.equal(h.page.total, 0)
  fail = false
  h.list.refresh()
  await settle()
  assert.equal(h.list.error.value, '')
  assert.equal(h.data.value[0].id, 'recovered')
  assert.deepEqual(h.failures, [])
})
