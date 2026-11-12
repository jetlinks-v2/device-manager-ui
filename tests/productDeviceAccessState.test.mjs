import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = new URL('../views/device/Product/Detail/DeviceAccess/', import.meta.url)
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(id => id in mocks ? mocks[id] : require(id), exports)
  return exports
}
const ok = result => ({ success: true, status: 200, result })
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() } }
const schema = (...keys) => [{ properties: keys.map(property => ({ property, name: property, type: { type: 'string' } })) }]
const model = id => ({ properties: [{ id: 'shared', name: id }, { id, name: id }], events: [], functions: [], tags: [] })
const gateway = (id, extra = {}) => ({ id, name: id, protocol: 'protocol-' + id, transport: 'MQTT', provider: 'mqtt-server-gateway', transportDetail: { metadata: JSON.stringify(model(id)) }, ...extra })
const selection = id => ({ access: gateway(id), metadata: schema(id, 'shared') })
const stateUtils = load('accessState.ts')
const i18n = { useI18n: () => ({ t: key => key }) }

function fixture(t, options = {}) {
  const calls = []
  const store = vue.reactive({
    current: { id: 'product-1', name: 'Product', state: 0, count: 0, accessId: 'B', messageProtocol: 'protocol-B', metadata: JSON.stringify(model('B')), configuration: { B: 'old-B', shared: 'keep', global: { enabled: false } }, storePolicy: 'none', ...options.product },
    detail: { id: 'product-1' }, tabActiveKey: 'Device',
    async getDetail(id) { calls.push(['detail', id]) },
  })
  const productApi = {
    getProviders: async () => ok([]), getStoragList: async () => ok([{ id: 'none', name: 'None' }]),
    queryList: async () => ok({ data: [gateway('B')] }), getConfigMetadata: async () => ok(schema('B', 'shared')),
    productGuide: async () => ok({ content: 'skip' }), productGuideSave() {},
    updateDevice: async data => { calls.push(['patch', data]); return ok(data) },
    modify: async (id, data) => { calls.push(['put', id, data]); return ok(data) }, ...options.productApi,
  }
  const pluginApi = { getPluginData: async () => ok({}), getProductByPluginId: async () => ok([]), savePluginData: async (...args) => { calls.push(['plugin', ...args]); return ok({}) }, ...options.pluginApi }
  const service = load('accessService.ts', { '../../../../../api/product': productApi, '../../../../../api/link/plugin': pluginApi })
  const hook = load('hooks/useProductDeviceAccess.ts', {
    '../../../../../../store/product': { useProductStore: () => store },
    '../../../../../../api/product': productApi, '../../../../../../api/link/plugin': pluginApi,
    '../../../../../../api/link/accessConfig': { detail: async () => ok({ channelId: 'driver' }), getCompositeProviderDetail: async data => ok(data), ...options.gatewayApi },
    '@jetlinks-web-core/store': { useAuthStore: () => ({ hasPermission: () => true }) },
    '@jetlinks-web-core/hooks': { useTabSaveSuccessBack: () => ({ onBack: async () => false }) },
    '@jetlinks-web/utils': { EventEmitter: { emit() {} }, onlyMessage() {} },
    'vue-i18n': i18n, 'driver.js': { default: class { defineSteps() {} start() {} } }, 'driver.js/dist/driver.min.css': {},
    '../util': { steps: [], steps1: [] }, '../accessState': stateUtils, '../accessService': service,
  })
  const scope = vue.effectScope()
  const state = scope.run(() => hook.useProductDeviceAccess())
  t.after(() => scope.stop())
  return { state, store, scope, service, calls, productApi, pluginApi }
}

function selector(t, options = {}) {
  const emitted = [], requests = []
  const props = vue.reactive({ productId: 'product-1', accessId: 'B', providersList: [] })
  const hook = load('hooks/useProductAccessSelector.ts', {
    '../../../../../../api/product': { queryList: async () => ok({ data: [gateway('B')] }), getAccessConfig: async (...args) => { requests.push(args); return options.config ? options.config(...args) : ok(schema(args[1])) } },
    '../../../../../../api/link/plugin': { getProductByPluginId: options.products || (async () => ok([])) },
    '../../../../../../api/link/accessConfig': { getProviders: async () => ok([]) },
    '@jetlinks-web-core/hooks': { useTabSaveSuccess: () => ({ onOpen() {} }) },
    '@jetlinks-web/utils': { onlyMessage() {} }, 'vue-i18n': i18n,
  })
  const scope = vue.effectScope()
  const state = scope.run(() => hook.useProductAccessSelector(props, (...args) => emitted.push(args)))
  t.after(() => scope.stop())
  return { state, scope, props, emitted, requests }
}

function metadataModal(t, f, snapshot) {
  const events = [], props = vue.reactive({ data: snapshot })
  const hook = load('hooks/useProductAccessMetadata.ts', {
    '../../../../../../store/product': { useProductStore: () => f.store },
    '../../../../../../assets': { device: {} }, '../accessService': f.service,
    '@jetlinks-web-core/hooks': { useTabSaveSuccessBack: () => ({ onBack: async () => false }) },
    '@jetlinks-web/utils': { onlyMessage() {} }, 'vue-i18n': i18n,
  })
  const scope = vue.effectScope()
  const state = scope.run(() => hook.useProductAccessMetadata(props, (...args) => events.push(args)))
  state.formRef.value = { validate: async () => true }
  t.after(() => scope.stop())
  return { state, props, events, scope }
}

test('late initialization of B cannot overwrite selected A or its saved metadata', async t => {
  const oldGateway = deferred(), oldConfig = deferred()
  let queries = 0
  const f = fixture(t, { productApi: { queryList: () => { queries++; return oldGateway.promise }, getConfigMetadata: () => oldConfig.promise } })
  const change = f.state.checkAccess(selection('A'))
  assert.equal(f.state.accessLoading.value, true)
  await f.state.submitDevice()
  assert.equal(f.calls.length, 0)
  oldGateway.resolve(ok({ data: [gateway('B')] })); oldConfig.resolve(ok(schema('B', 'shared')))
  await change; await settle()
  assert.equal(queries, 1)
  assert.equal(f.state.access.value.id, 'A'); assert.equal(f.state.accessId.value, 'A')
  assert.deepEqual(f.state.productData.metadata, model('A'))
  assert.deepEqual(f.state.metadata.value, schema('A', 'shared'))
  assert.equal(f.state.formData.data.B, undefined); assert.equal(f.state.formData.data.shared, 'keep')
  f.state.formData.data.A = 'new-A'
  assert.equal(f.store.current.configuration.A, undefined)
  await f.state.submitDevice()
  const modal = metadataModal(t, f, f.state.metadataModalCacheData.value)
  modal.state.handleData.type = 'cover'; await modal.state.submitData()
  assert.equal(f.calls[0][1].accessId, 'A'); assert.equal(f.calls[0][1].messageProtocol, 'protocol-A')
  assert.deepEqual(JSON.parse(f.calls[0][1].metadata), model('A'))
  assert.equal(f.calls[0][1].configuration.B, undefined); assert.equal(f.calls[0][1].configuration.A, 'new-A')
  assert.deepEqual(f.calls[1][2].configuration, f.calls[0][1].configuration)
})

test('configuration reconciliation preserves common, false and zero values, applies defaults without mutating inputs', () => {
  const previous = schema('B', 'shared'), next = schema('A', 'shared', 'zero', 'disabled')
  next[0].properties[0].type.expands = { defaultValue: { nested: ['default-A'] } }
  const input = { B: 'secret-B', shared: false, zero: 0, disabled: false, global: { value: 1 } }
  const result = stateUtils.reconcileAccessConfiguration(input, previous, next)
  assert.equal(result.B, undefined); assert.equal(result.shared, false); assert.equal(result.zero, 0); assert.equal(result.disabled, false)
  result.global.value = 2; result.A.nested.push('edited')
  assert.equal(input.global.value, 1); assert.equal(input.B, 'secret-B')
  assert.deepEqual(next[0].properties[0].type.expands.defaultValue, { nested: ['default-A'] })
})

test('selecting the same gateway preserves its configuration and cancel preserves the draft', async t => {
  const f = fixture(t); await settle()
  await f.state.checkAccess({ access: gateway('B'), metadata: schema('B', 'shared') })
  f.state.showDevice(); f.state.visible.value = false
  assert.equal(f.state.formData.data.B, 'old-B'); assert.equal(f.state.access.value.id, 'B')
})

test('product changes and disposal reject the previous product initialization', async t => {
  const pending = deferred(); const f = fixture(t, { productApi: { queryList: () => pending.promise } })
  f.store.current = { ...f.store.current, id: 'product-2', accessId: undefined, configuration: {} }
  await settle(); pending.resolve(ok({ data: [gateway('B')] })); await settle()
  assert.equal(f.state.access.value.id, undefined); assert.deepEqual(f.state.formData.data, {})
  f.scope.stop(); await f.state.checkAccess(selection('A'))
  assert.equal(f.state.access.value.id, undefined)
})

test('A-B-A selections discard an earlier composite response even with an identical gateway ID', async t => {
  const slow = deferred(); let composites = 0
  const f = fixture(t, { gatewayApi: { getCompositeProviderDetail: async () => ++composites === 1 ? slow.promise : ok([{ id: 'new-child' }]) } }); await settle()
  const composite = { ...selection('A'), access: gateway('A', { provider: 'composite-device-gateway', configuration: { gateways: [] } }) }
  const first = f.state.checkAccess(composite)
  await f.state.checkAccess(selection('B')); await f.state.checkAccess(composite)
  slow.resolve(ok([{ id: 'old-child' }])); await first
  assert.equal(f.state.access.value.configuration.gateways[0].id, 'new-child')
})

test('initial config failure blocks save and retry recovers', async t => {
  let failed = true
  const f = fixture(t, { productApi: { getConfigMetadata: async () => failed ? { success: false } : ok(schema('B')) } })
  await settle(); assert.equal(f.state.accessError.value, true); await f.state.submitDevice(); assert.equal(f.calls.length, 0)
  failed = false; await f.state.getData(); assert.equal(f.state.accessError.value, false); assert.equal(f.state.accessLoading.value, false)
})

test('reselecting during confirmation discards B and only submits A metadata', async t => {
  const slow = deferred(); const f = selector(t, { config: async (_p, id) => id === 'B' ? slow.promise : ok(schema(id)) })
  f.state.handleClick(gateway('B')); const first = f.state.submitData()
  f.state.handleClick(gateway('A')); await f.state.submitData()
  slow.resolve(ok(schema('B'))); await first
  assert.equal(f.emitted.length, 1); assert.equal(f.emitted[0][1].access.id, 'A'); assert.deepEqual(f.emitted[0][1].metadata, schema('A'))
})

test('confirm deduplicates requests and cancellation or disposal suppresses pending results', async t => {
  for (const action of ['cancel', 'dispose']) {
    const slow = deferred(), f = selector(t, { config: () => slow.promise })
    f.state.handleClick(gateway('A')); const first = f.state.submitData(); await f.state.submitData()
    assert.equal(f.requests.length, 1)
    if (action === 'cancel') f.state.cancel(); else f.scope.stop()
    slow.resolve(ok(schema('A'))); await first
    assert.equal(f.emitted.filter(([event]) => event === 'submit').length, 0)
  }
})

test('failed plugin configuration never emits a partial selection and allows retry', async t => {
  let failure = true
  const f = selector(t, { config: async () => failure ? { success: false } : ok(schema('A')), products: async () => ok([{ id: 'type-A', name: 'Type A' }]) })
  f.state.handleClick(gateway('A', { channel: 'plugin', channelId: 'driver-A' }))
  await f.state.submitData(); assert.equal(f.emitted.length, 0); assert.equal(f.state.loading.value, false)
  failure = false; await f.state.submitData(); assert.equal(f.emitted[0][1].productTypes[0].id, 'type-A')
})

test('configuration request exceptions release confirmation loading', async t => {
  const f = selector(t, { config: async () => { throw new Error('offline') } })
  f.state.handleClick(gateway('A')); await assert.rejects(f.state.submitData(), /offline/); assert.equal(f.state.loading.value, false)
})

test('save uses one immutable selection and new storage policy for both requests', async t => {
  const patch = deferred(), f = fixture(t, { productApi: { updateDevice: async data => { f.calls.push(['patch', data]); return patch.promise } } }); await settle()
  const snapshot = { id: 'product-1', product: f.store.current, access: gateway('A'), metadata: model('A'), values: { A: { value: 'A' }, storePolicy: 'new-policy' } }
  const save = f.service.saveProductAccess(snapshot, JSON.stringify(model('A')))
  snapshot.access.id = 'B'; snapshot.values.A.value = 'B'; patch.resolve(ok({})); await save
  assert.equal(f.calls[0][1].accessId, 'A'); assert.equal(f.calls[0][1].storePolicy, 'new-policy')
  assert.equal(f.calls[1][2].configuration.A.value, 'A'); assert.equal(f.calls[1][2].storePolicy, 'new-policy')
})

test('failed first save stops configuration and plugin writes', async t => {
  const f = fixture(t, { productApi: { updateDevice: async data => { f.calls.push(['patch', data]); return { success: false } } } }); await settle()
  await f.service.saveProductAccess({ id: 'product-1', product: f.store.current, access: gateway('A', { provider: 'plugin_gateway' }), metadata: model('A'), productTypeId: 'type-A', values: { storePolicy: 'none' } }, '{}')
  assert.deepEqual(f.calls.map(([action]) => action), ['patch'])
})

test('plugin save binds the snapshotted product type and gateway', async t => {
  const f = fixture(t); await settle()
  await f.service.saveProductAccess({ id: 'product-1', product: f.store.current, access: gateway('A', { provider: 'plugin_gateway' }), metadata: model('A'), productTypeId: 'type-A', values: { storePolicy: 'none' } }, '{}')
  assert.deepEqual(f.calls[1], ['plugin', 'product', 'A', 'product-1', 'type-A'])
})

for (const mode of ['cover', 'intersection', 'union', 'ignore']) {
  test(`metadata mode ${mode} uses the saved A snapshot`, async t => {
    const f = fixture(t); await settle(); await f.state.checkAccess(selection('A')); await f.state.submitDevice()
    const modal = metadataModal(t, f, f.state.metadataModalCacheData.value)
    modal.state.handleData.type = mode; await modal.state.submitData()
    const saved = JSON.parse(f.calls[0][1].metadata)
    const expected = mode === 'cover' ? ['shared', 'A'] : mode === 'intersection' ? ['shared'] : mode === 'union' ? ['shared', 'A', 'B'] : ['shared', 'B']
    assert.deepEqual(saved.properties.map(item => item.id), expected)
    assert.equal(saved.properties[0].name, mode === 'ignore' ? 'B' : 'A')
    assert.equal(f.calls[0][1].accessId, 'A')
  })
}

test('cover save prevents double submit, cancel, and refresh into a different product', async t => {
  const patch = deferred(); const f = fixture(t, { productApi: { updateDevice: async data => { f.calls.push(['patch', data]); return patch.promise } } })
  await settle(); await f.state.checkAccess(selection('A')); await f.state.submitDevice()
  const modal = metadataModal(t, f, f.state.metadataModalCacheData.value); modal.state.handleData.type = 'cover'
  const first = modal.state.submitData(); await settle(); await modal.state.submitData(); modal.state.cancel()
  assert.equal(f.calls.length, 1); assert.equal(modal.events.length, 0)
  f.store.current.id = 'product-2'; patch.resolve(ok({})); await first
  assert.equal(f.calls.filter(([action]) => action === 'detail').length, 0); assert.equal(modal.state.loading.value, false)
})

test('cover validation and network errors release loading for retry', async t => {
  const f = fixture(t); await settle(); await f.state.checkAccess(selection('A')); await f.state.submitDevice()
  const modal = metadataModal(t, f, f.state.metadataModalCacheData.value)
  modal.state.formRef.value.validate = async () => { throw new Error('required') }
  await assert.rejects(modal.state.submitData(), /required/); assert.equal(modal.state.loading.value, false); assert.equal(f.calls.length, 0)
  modal.state.formRef.value.validate = async () => true; modal.state.handleData.type = 'cover'
  f.productApi.updateDevice = async () => { throw new Error('offline') }
  await assert.rejects(modal.state.submitData(), /offline/); assert.equal(modal.state.loading.value, false)
})


test('new product direct save uses A configuration and storage policy without opening cover', async t => {
  const f = fixture(t, { product: { metadata: '', accessId: undefined, configuration: {} } }); await settle()
  await f.state.checkAccess(selection('A')); f.state.formData.data.A = 'new'; f.state.form.storePolicy = 'selected'
  await f.state.submitDevice()
  assert.equal(f.state.metadataVisible.value, false)
  assert.equal(f.calls[0][1].accessId, 'A'); assert.equal(f.calls[0][1].configuration.A, 'new')
  assert.equal(f.calls[0][1].storePolicy, 'selected'); assert.deepEqual(JSON.parse(f.calls[0][1].metadata), model('A'))
  assert.equal(f.calls[1][2].storePolicy, 'selected'); assert.equal(f.state.submitLoading.value, false)
})

test('direct save failure stops refresh and resets loading', async t => {
  const f = fixture(t, { product: { metadata: '' }, productApi: { modify: async () => { throw new Error('write failed') } } }); await settle()
  await f.state.checkAccess(selection('A')); await assert.rejects(f.state.submitDevice(), /write failed/)
  assert.equal(f.state.submitLoading.value, false); assert.equal(f.calls.some(([action]) => action === 'detail'), false)
})

test('switching to a gateway without a protocol clears the old protocol fields', async t => {
  const f = fixture(t); await settle()
  await f.service.saveProductAccess({ id: 'product-1', product: f.store.current, access: { id: 'no-protocol' }, metadata: {}, values: { storePolicy: 'none' } }, '{}')
  assert.equal(f.calls[0][1].messageProtocol, ''); assert.equal(f.calls[0][1].transportProtocol, ''); assert.equal(f.calls[0][1].protocolName, '')
})

test('a late plugin product list cannot overwrite a new network gateway selection', async t => {
  const slow = deferred()
  const f = fixture(t, { product: { accessProvider: 'plugin_gateway' }, pluginApi: { getProductByPluginId: () => slow.promise } }); await settle()
  await f.state.checkAccess(selection('A')); slow.resolve(ok([{ id: 'old-plugin-type', name: 'Old', metadata: model('B') }])); await settle()
  assert.equal(f.state.access.value.id, 'A'); assert.deepEqual(f.state.productTypes.value, []); assert.deepEqual(f.state.productData.metadata, model('A'))
})

test('composite gateway configuration is cleaned when switching back to an ordinary gateway', async t => {
  const f = fixture(t); await settle()
  await f.state.checkAccess({ access: gateway('composite', { provider: 'composite-device-gateway', configuration: { gateways: [{ id: 'child', transportDetail: { allConfig: schema('child-only') } }] } }), metadata: [] })
  f.state.formData.data['child-only'] = 'child-secret'
  await f.state.checkAccess(selection('A'))
  assert.equal(f.state.formData.data['child-only'], undefined); assert.deepEqual(f.state.formData.data.global, { enabled: false })
})
