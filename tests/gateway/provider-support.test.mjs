import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = new URL('../../', import.meta.url)
function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(id => id in mocks ? mocks[id] : require(id), exports)
  return exports
}
const ok = result => ({ status: 200, success: true, result })
const MEDIA = ['media-plugin', 'agent-media-device-gateway', 'fixed-media', 'onvif', 'gb28181-2016']
const COLLECTOR = ['collector-gateway', 'modbus-tcp', 'opc-ua']
const ORDINARY = ['mqtt-server-gateway', 'agent-device-gateway', 'plugin_gateway', 'composite-device-gateway']
const ALL = [...ORDINARY, ...MEDIA, ...COLLECTOR]
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const settle = async () => { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() } }

function fixture(options = {}) {
  const calls = []
  const providers = Object.freeze((options.ids || ALL).map(id => Object.freeze({ id, name: id, channel: 'network' })))
  const catalogs = {
    '/media/server/providers': options.media ?? { status: 404, success: false },
    '/data-collect/channel/providers': options.collector ?? { status: 404, success: false },
  }
  const request = { get: async (path, params, config) => {
    calls.push({ path, params, config })
    if (path === '/gateway/device/providers') return options.raw ? options.raw() : ok(providers)
    if (path in catalogs) return typeof catalogs[path] === 'function' ? catalogs[path]() : catalogs[path]
    if (path === '/gateway/device/existing') return ok({ id: 'existing', provider: options.existingProvider, configuration: { enabled: false } })
    throw new Error('Unexpected request: ' + path)
  } }
  const api = load('api/link/accessConfig.ts', { '@jetlinks-web/core': { request } })
  const available = load('api/link/gatewayProviders.ts', {
    '@jetlinks-web/core': { request },
    '@jetlinks-web-core/utils/deployment': { isPrivateDeployment: () => options.private !== false },
    './accessConfig': api,
  })
  return { calls, providers, catalogs, api, available }
}

function editor(t, options = {}) {
  const f = fixture(options)
  const route = vue.reactive({ params: { id: options.existingProvider ? 'existing' : ':id' }, query: options.query || {} })
  const hook = load('views/link/AccessConfig/Detail/useGatewayDetail.ts', {
    '@device-manager-ui/api/link/accessConfig': f.api,
    '@device-manager-ui/api/link/gatewayProviders': f.available,
    '@device-manager-ui/api/product': { queryProductList: async () => ok({ total: 0 }) },
    '@jetlinks-web-core/utils': { accessConfigTypeFilter: list => list.map(item => ({ ...item, label: item.name, value: item.id })) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    vue: { ...vue, provide() {} },
    'vue-router': { useRoute: () => route },
    '../components/Provider/index.vue': { default: {} },
    '../components/gatewayEditorContext': { gatewayEditorKey: Symbol(), gatewayFooterHostKey: Symbol() },
  })
  const scope = vue.effectScope()
  const state = scope.run(() => hook.useGatewayDetail())
  t.after(() => scope.stop())
  return { ...f, state, route, scope }
}

test('runtime providers alone do not expose video or collector access, and raw metadata remains intact', async () => {
  const f = fixture()
  assert.deepEqual((await f.available.getAvailableGatewayProviders()).result.map(item => item.id), ORDINARY)
  assert.deepEqual((await f.api.getProviders()).result.map(item => item.id), ALL)
  assert(f.calls.filter(call => call.path !== '/gateway/device/providers').every(call =>
    call.params === undefined && call.config.hiddenError === true && call.config.timeout === 10000))
})

test('management modules are independent and empty catalogs still prove installation', async () => {
  for (const [media, collector, expected] of [
    [ok([]), { success: false }, [...ORDINARY, ...MEDIA]],
    [{ success: false }, ok([]), [...ORDINARY, ...COLLECTOR]],
    [ok([{ id: 'video' }]), ok([{ id: 'collector' }]), ALL],
  ]) {
    const f = fixture({ media, collector })
    assert.deepEqual((await f.available.getAvailableGatewayProviders()).result.map(item => item.id), expected)
  }
})

test('denied, missing, invalid and failed module metadata all keep optional methods closed', async () => {
  for (const response of [{ success: false, status: 403 }, { success: false, status: 404 }, ok(true), ok(null), {}, null]) {
    const probe = async () => response
    const f = fixture({ media: probe, collector: probe })
    assert.deepEqual((await f.available.getAvailableGatewayProviders()).result.map(item => item.id), ORDINARY)
  }
  const unavailable = async () => { throw new Error('network unavailable') }
  assert.deepEqual((await fixture({ media: unavailable, collector: unavailable }).available.getAvailableGatewayProviders()).result.map(item => item.id), ORDINARY)
})

test('SaaS and ordinary-only provider catalogs do not send module probes', async () => {
  for (const options of [{ private: false }, { ids: ORDINARY }]) {
    const f = fixture(options)
    assert.deepEqual((await f.available.getAvailableGatewayProviders()).result.map(item => item.id), options.ids || ALL)
    assert.deepEqual(f.calls.map(call => call.path), ['/gateway/device/providers'])
  }
})

test('failed provider lists remain retryable errors rather than a successful empty list', async () => {
  for (const response of [{ success: false, status: 403 }, ok(null)]) {
    const f = fixture({ raw: async () => response })
    await assert.rejects(f.available.getAvailableGatewayProviders())
    assert.equal(f.calls.length, 1)
  }
})

test('module checks are refreshed when opening again instead of sharing a prior context result', async () => {
  const f = fixture({ media: ok([]), collector: ok([]) })
  assert.equal((await f.available.getAvailableGatewayProviders()).result.length, ALL.length)
  f.catalogs['/media/server/providers'] = { success: false, status: 404 }
  assert.deepEqual((await f.available.getAvailableGatewayProviders()).result.map(item => item.id), [...ORDINARY, ...COLLECTOR])
})

test('pending discovery cannot mount an editor; unsupported quick links and supplied provider data return to selection', async t => {
  for (const id of ['media-plugin', 'agent-media-device-gateway', 'collector-gateway']) {
    for (const query of [{ save: 'true', type: id }, { provider: JSON.stringify({ id, type: 'network' }), data: '{}' }]) {
      const gate = deferred()
      const f = editor(t, { query, media: () => gate.promise, collector: () => gate.promise })
      assert.equal(f.state.loading.value, true)
      assert.equal(f.state.provider.value.id, undefined)
      gate.resolve({ status: 404, success: false })
      await settle()
      assert.equal(f.state.type.value, true)
      assert.equal(f.state.provider.value.id, undefined)
      assert.equal(f.state.providerLoadFailed.value, false)
      assert.deepEqual(f.state.dataSource.value.flatMap(group => group.list.map(item => item.id)).sort(), [...ORDINARY].sort())
      f.state.goProviders({ id, type: 'network' })
      assert.equal(f.state.provider.value.id, undefined)
    }
  }
})

test('supported shortcuts and ordinary Agent still open, using backend metadata rather than URL type', async t => {
  for (const id of ['media-plugin', 'agent-media-device-gateway', 'collector-gateway', 'agent-device-gateway']) {
    const f = editor(t, { media: ok([]), collector: ok([]), query: { provider: JSON.stringify({ id, name: 'forged', type: 'unknown' }), data: '{"configuration":{"enabled":false}}' } })
    await settle()
    assert.equal(f.state.type.value, false)
    assert.equal(f.state.provider.value.id, id)
    assert.equal(f.state.provider.value.name, id)
    assert.notEqual(f.state.showType.value, 'unknown')
    assert.deepEqual(f.state.data.value, { configuration: { enabled: false } })
  }
})

test('existing unavailable gateways do not mount editors; available collector gateways retain the historical editor', async t => {
  const absent = editor(t, { existingProvider: 'media-plugin' })
  await settle()
  assert.equal(absent.state.providerUnavailable.value, true)
  assert.equal(absent.state.provider.value.id, undefined)
  const present = editor(t, { existingProvider: 'collector-gateway', collector: ok([]) })
  await settle()
  assert.equal(present.state.providerUnavailable.value, false)
  assert.equal(present.state.showType.value, 'network')
  assert.equal(present.state.provider.value.id, 'collector-gateway')
  assert.deepEqual(present.state.data.value.configuration, { enabled: false })
})

test('route changes and disposal discard late provider discovery', async t => {
  const late = deferred()
  const f = editor(t, { media: () => late.promise, query: { save: 'true', type: 'media-plugin' } })
  f.catalogs['/media/server/providers'] = { success: false, status: 404 }
  f.route.query.type = 'agent-device-gateway'
  await settle()
  assert.equal(f.state.provider.value.id, 'agent-device-gateway')
  late.resolve(ok([]))
  await settle()
  assert.equal(f.state.provider.value.id, 'agent-device-gateway')
  const disposed = deferred()
  const other = editor(t, { media: () => disposed.promise, query: { save: 'true', type: 'media-plugin' } })
  other.scope.stop()
  disposed.resolve(ok([]))
  await settle()
  assert.equal(other.state.provider.value.id, undefined)
})

test('provider load errors can be retried and new unavailable copy is localized', async t => {
  let failed = true
  const f = editor(t, { ids: ORDINARY, raw: async () => { if (failed) throw new Error('offline'); return ok(ORDINARY.map(id => ({ id, name: id }))) } })
  await settle()
  assert.equal(f.state.providerLoadFailed.value, true)
  failed = false
  await f.state.getProvidersData()
  assert.equal(f.state.providerLoadFailed.value, false)
  for (const locale of ['zh', 'en', 'ja']) {
    assert.equal(typeof JSON.parse(readFileSync(new URL(`locales/lang/${locale}.json`, root), 'utf8'))['GatewayEditor.methodUnavailable'], 'string')
  }
})

test('malformed direct-entry parameters fail without mounting an editor', async t => {
  for (const query of [{ provider: '{' }, { provider: '{"id":"agent-device-gateway"}', data: '{' }]) {
    const f = editor(t, { query })
    await settle()
    assert.equal(f.state.providerLoadFailed.value, true)
    assert.equal(f.state.provider.value.id, undefined)
    assert.equal(f.state.loading.value, false)
  }
})
