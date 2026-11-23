import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { computed, effectScope, nextTick, onScopeDispose, ref, watch } from 'vue'

async function loadProductionModule(file, bindings) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const body = parsed.statements.filter(statement => !ts.isImportDeclaration(statement)).map(statement => statement.getFullText(parsed)).join('\n')
  const { outputText } = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, URLSearchParams, ...bindings })
  return module.exports
}

const routing = await loadProductionModule('views/device/list/hooks/useIotDeviceRouting.ts', { getProjectIdFromLocation: () => '' })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function loadParentLink(bindings, providers = []) {
  const { useDeviceListProvider } = await loadProductionModule('views/device/list/hooks/useDeviceListProvider.ts', {
    computed, ref, onScopeDispose,
    moduleRegistry: { getAllModuleIds: () => ['extensions'], getResource: () => Object.fromEntries(providers.map(item => [item.id, item])), onChange: () => () => {} },
  })
  return loadProductionModule('views/device/list/hooks/useIotDeviceParentLink.ts', {
    computed, ref, watch, useDeviceListProvider,
    useMenuStore: () => ({ jumpPage() {} }), mapApiDevice: value => value,
    ...routing, ...bindings,
  })
}

test('parent name resolves without delaying child detail and a late response cannot replace the new parent', async () => {
  const requests = new Map()
  const destinations = []
  const { useIotDeviceParentLink } = await loadParentLink({
    computed, ref, watch,
    useRoute: () => ({ path: '/resources/devices/list/Detail/child', query: {}, params: {} }),
    useRouter: () => ({ push: value => destinations.push(value) }),
    detail: id => { const request = deferred(); requests.set(id, request); return request.promise },
    ...routing,
  })
  const device = ref({ id: 'child', deviceTypeValue: 'childrenDevice', parentId: 'gateway-a' })
  const scope = effectScope()
  const link = scope.run(() => useIotDeviceParentLink(device))
  assert.equal(link.parentDeviceName.value, 'gateway-a')
  device.value = { ...device.value, parentId: 'gateway-b' }
  await nextTick()
  requests.get('gateway-b').resolve({ result: { id: 'gateway-b', name: 'Gateway B' } })
  await nextTick()
  requests.get('gateway-a').resolve({ result: { id: 'gateway-a', name: 'Gateway A' } })
  await nextTick()
  assert.equal(link.parentDeviceName.value, 'Gateway B')
  await link.openParentDevice()
  assert.equal(destinations[0], '/resources/devices/list/Detail/gateway-b?tab=overview')
  device.value = { id: 'unbound', deviceTypeValue: 'childrenDevice' }
  await nextTick()
  assert.equal(link.parentDeviceId.value, undefined)
  assert.equal(link.parentDeviceName.value, '')
  await link.openParentDevice()
  assert.equal(destinations.length, 1)
  scope.stop()
})

test('known parent names display immediately while parent capabilities load; ordinary devices have no parent link', async () => {
  let requestCount = 0
  const { useIotDeviceParentLink } = await loadParentLink({
    computed, ref, watch,
    useRoute: () => ({ path: '/iot-center/device/list/Detail/child', query: {}, params: {} }),
    useRouter: () => ({ push() {} }),
    detail: () => { requestCount += 1 },
    ...routing,
  })
  const device = ref({ id: 'child', deviceTypeValue: 'childrenDevice', parentId: 'gateway', parentName: 'Known gateway' })
  const scope = effectScope()
  const link = scope.run(() => useIotDeviceParentLink(device))
  assert.equal(link.parentDeviceName.value, 'Known gateway')
  assert.equal(requestCount, 1, 'parent access type is required even when its name is known')
  device.value = { id: 'ordinary', deviceTypeValue: 'device', parentId: 'ignored' }
  await nextTick()
  assert.equal(link.parentDeviceId.value, undefined)
  scope.stop()
})

test('parent links use the edge gateway provider route, including when clicked before the detail arrives', async () => {
  const gatewaySource = await readFile(new URL('../../edge-master-ui/api/gatewayDevice.ts', import.meta.url), 'utf8')
  const gatewayAst = ts.createSourceFile('gateway.ts', gatewaySource, ts.ScriptTarget.Latest, true)
  const accessProviders = gatewayAst.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .find(node => node.name.getText(gatewayAst) === 'GATEWAY_ACCESS_PROVIDERS')
  const { outputText } = ts.transpileModule(`const ${accessProviders.getText(gatewayAst)}; globalThis.providers=GATEWAY_ACCESS_PROVIDERS`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
  const context = {}
  vm.runInNewContext(outputText, context)
  const { gatewayDeviceListProvider } = await loadProductionModule('../edge-master-ui/deviceListProvider.ts', {
    defineAsyncComponent: () => ({}), i18n: { global: { t: key => key } }, isPrivateDeployment: () => true,
    GATEWAY_ACCESS_PROVIDERS: context.providers, buildGatewayBaseTerms: () => [],
  })
  for (const accessProvider of context.providers) {
    const response = deferred(), jumps = [], paths = []
    const { useIotDeviceParentLink } = await loadParentLink({
      useRoute: () => ({ path: '/resources/devices/list/Detail/child', query: { type: 'device', tab: 'thing-model' }, params: {} }),
      useRouter: () => ({ push: value => paths.push(value) }),
      useMenuStore: () => ({ jumpPage: (...args) => jumps.push(args) }),
      detail: () => response.promise,
    }, [gatewayDeviceListProvider])
    const device = ref({ id: 'child', deviceTypeValue: 'childrenDevice', parentId: 'edge', parentName: 'Edge gateway' })
    const scope = effectScope()
    const link = scope.run(() => useIotDeviceParentLink(device))
    const pending = link.openParentDevice()
    assert.equal(jumps.length, 0)
    response.resolve({ result: { id: 'edge', name: 'Edge gateway', accessProvider } })
    await pending
    assert.equal(jumps[0][0], gatewayDeviceListProvider.detailRoute)
    assert.equal(jumps[0][1].params.gatewayId, 'edge')
    assert.equal(jumps[0][1].query.type, 'gateway')
    assert.equal(paths.length, 0, 'edge gateways cannot fall through to ordinary detail')
    scope.stop()
  }
})

test('a pending parent click is cancelled when the child is rebound or its detail is disposed', async () => {
  for (const dispose of [false, true]) {
    const response = deferred(), paths = []
    const { useIotDeviceParentLink } = await loadParentLink({
      useRoute: () => ({ path: '/resources/devices/list/Detail/child', query: {}, params: {} }),
      useRouter: () => ({ push: value => paths.push(value) }), detail: () => response.promise,
    })
    const device = ref({ id: 'child', deviceTypeValue: 'childrenDevice', parentId: 'old' })
    const scope = effectScope(), link = scope.run(() => useIotDeviceParentLink(device))
    const pending = link.openParentDevice()
    if (dispose) scope.stop()
    else { device.value = { ...device.value, parentId: 'new' }; await nextTick() }
    response.resolve({ result: { id: 'old', name: 'Old parent' } })
    await pending
    assert.equal(paths.length, 0)
    scope.stop()
  }
})

test('an unreadable parent retries on click without incorrectly opening ordinary detail', async () => {
  const hiddenErrors = [], paths = []
  const { useIotDeviceParentLink } = await loadParentLink({
    useRoute: () => ({ path: '/resources/devices/list/Detail/child', query: {}, params: {} }),
    useRouter: () => ({ push: value => paths.push(value) }),
    detail: async (_id, hiddenError) => { hiddenErrors.push(hiddenError); throw Error('unavailable') },
  })
  const device = ref({ id: 'child', deviceTypeValue: 'childrenDevice', parentId: 'parent' })
  const scope = effectScope(), link = scope.run(() => useIotDeviceParentLink(device))
  await link.openParentDevice()
  assert.deepEqual(hiddenErrors, [true, undefined])
  assert.equal(paths.length, 0)
  scope.stop()
})

test('export keeps conditions, uses the selected format, and allows exporting without a product', async () => {
  const urls = []
  const { paramsEncodeQuery } = await loadProductionModule('../../jetlinks-web-core/src/utils/encodeQuery.ts', {
    isArray: Array.isArray, isObject: value => value !== null && typeof value === 'object', console: { log() {} },
  })
  const { useDeviceExport } = await loadProductionModule('views/device/Instance/Export/useDeviceExport.ts', {
    paramsEncodeQuery, getToken: () => 'test-token', TOKEN_KEY_URL: 'token', getBaseApi: () => '/api',
    URLSearchParams, window: { location: { origin: 'http://localhost' }, open: url => urls.push(new URL(url)) },
  })
  const data = { terms: [{ column: 'name', termType: 'like', value: '%sensor%' }] }
  const original = JSON.stringify(data)
  const { exportDevices } = useDeviceExport()
  exportDevices('product/a', 'csv', data)
  exportDevices('', 'xlsx', data)
  assert.equal(urls[0].pathname, '/api/device-instance/product%2Fa/export.csv')
  assert.equal(urls[1].pathname, '/api/device-instance/export.xlsx')
  assert.equal(urls[0].searchParams.get('terms[0].value'), '%sensor%')
  assert.equal(urls[1].searchParams.get('terms[0].termType'), 'like')
  assert.equal(JSON.stringify(data), original)
})

async function loadMappingSearch(bindings) {
  const source = await readFile(new URL('../views/device/Instance/Detail/Child/index.vue', import.meta.url), 'utf8')
  const setup = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  const parsed = ts.createSourceFile('mapping.js', setup, ts.ScriptTarget.Latest, true)
  const names = ['noMappingQueryVersion', 'getNoMapping', 'onRightSearch']
  const statements = parsed.statements.filter(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => names.includes(declaration.name.getText(parsed))))
  return vm.runInNewContext(`${statements.map(statement => statement.getText(parsed)).join('\n')}; ({getNoMapping,onRightSearch})`, bindings)
}

test('edge device OR conditions remain inside the unmapped non-video scope', async () => {
  const userTerms = [{ terms: [
    { column: 'name', termType: 'like', value: '%sensor%' },
    { column: '_product.name', termType: 'like', type: 'or', value: '%mqtt%' },
  ] }]
  const requests = []
  const rightSearchTerms = ref(userTerms)
  const { getNoMapping } = await loadMappingSearch({
    rightSearchTerms, detail: ref({ id: 'edge' }), edgeList: ref([]), _edgeInitList: ref([]),
    _queryByEdge: async (id, query) => { requests.push({ id, query }); return { success: true, result: [] } },
  })
  await getNoMapping()
  assert.equal(requests[0].id, 'edge')
  const terms = requests[0].query.terms
  assert.equal(terms[0].column, 'key')
  assert.equal(terms[0].termType, 'isnull')
  assert.equal(terms[1].column, '_product.accessProvider')
  assert.equal(terms[1].termType, 'nin')
  assert.equal(terms[2].type, 'and')
  assert.equal(JSON.stringify(terms[2].terms), JSON.stringify(userTerms))
  rightSearchTerms.value = []
  await getNoMapping()
  assert.equal(requests[1].query.terms.length, 2)
})

test('edge search waits for pending mapping edits and ignores stale query responses', async () => {
  const requests = []
  const edgeList = ref([])
  let confirmPendingEdits
  const { getNoMapping, onRightSearch } = await loadMappingSearch({
    rightSearchTerms: ref([]), detail: ref({ id: 'edge' }), edgeList, _edgeInitList: ref([]),
    TabsChange: callback => { confirmPendingEdits = callback },
    _queryByEdge: () => { const request = deferred(); requests.push(request); return request.promise },
  })
  onRightSearch({ terms: [{ terms: [{ column: 'name', value: 'old' }] }] })
  assert.equal(requests.length, 0)
  confirmPendingEdits()
  assert.equal(requests.length, 1)
  const latest = getNoMapping()
  requests[1].resolve({ success: true, result: [{ id: 'latest' }] })
  await latest
  requests[0].resolve({ success: true, result: [{ id: 'old' }] })
  await nextTick()
  assert.equal(edgeList.value[0].id, 'latest')
})

test('gateway child links preserve the authorized entry instead of requiring a different menu code', async () => {
  for (const base of ['/resources/devices/list', '/resources/devices/list/device', '/iot-center/device/list']) {
    const paths = []
    let context
    const { useEmbeddedChildDeviceContext } = await loadProductionModule('views/device/Instance/Detail/Child/useChildDeviceContext.ts', {
      computed, ref, watch, onScopeDispose,
      provide: (_key, value) => { context = value },
      useRoute: () => ({ path: `${base}/gateway`, query: { tab: 'subDevices' }, params: {} }),
      useRouter: () => ({ push: value => paths.push(value) }),
      useMenuStore: () => { throw Error('The existing entry must not require another menu') },
      queryDeviceDetail: async () => ({ status: 200, result: { id: 'gateway' } }), ...routing,
    })
    const scope = effectScope()
    scope.run(() => useEmbeddedChildDeviceContext(ref('gateway'), ref()))
    context.openDevice('child/1')
    assert.equal(paths[0], `${base}/Detail/child%2F1?tab=overview`)
    scope.stop()
  }
})
