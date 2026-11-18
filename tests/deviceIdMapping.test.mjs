import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'

const root = new URL('../', import.meta.url)
const read = file => readFileSync(new URL(file, root), 'utf8')
const mappingFile = 'views/device/Instance/Detail/components/DeviceIdMapping.vue'
const modalFile = 'views/device/Instance/Detail/Info/components/InklingModal/index.vue'
const headerFile = 'views/device/list/components/device-detail/IotDeviceDetailHeader.vue'
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const ok = result => ({ success: true, result })
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }
const target = id => ({ id, accessId: 'access-' + id, accessProvider: 'plugin_gateway' })

function load(file, dependencies) {
  const module = { exports: {} }
  const code = transformSync(read(file), { loader: 'ts', format: 'cjs', target: 'es2022' }).code
  new Function('require', 'exports', 'module', code)(name => {
    assert.ok(name in dependencies, `Missing dependency ${name}`)
    return dependencies[name]
  }, module.exports, module)
  return module.exports
}

function fixture(t, options = {}) {
  const calls = [], saved = []
  const props = vue.reactive({ device: target('new'), canUpdate: true, ...options.props })
  const store = vue.reactive({ current: target('legacy'), async refresh(id) { calls.push(['refresh', id]) } })
  const { useDeviceIdMapping } = load('views/device/Instance/Detail/components/useDeviceIdMapping.ts', {
    vue, '../../../../../store/instance': { useInstanceStore: () => store },
    '../../../../../api/link/accessConfig': { detail: options.access ?? (async id => { calls.push(['access', id]); return ok({ channelId: 'plugin' }) }) },
    '../../../../../api/link/plugin': { getPluginData: options.mapping ?? (async (...args) => { calls.push(['mapping', ...args]); return ok({ externalId: 'external' }) }) },
  })
  const scope = vue.effectScope()
  const state = scope.run(() => useDeviceIdMapping(props, id => saved.push(id)))
  t.after(() => scope.stop())
  return { state, props, store, calls, saved, scope }
}

function modal(t, options = {}) {
  const calls = [], submitted = [], messages = []
  const props = vue.reactive({ internalId: 'device-A', accessId: 'gateway-A', id: 'external-A', ...options.props })
  const { useDeviceIdMappingModal } = load('views/device/Instance/Detail/Info/components/InklingModal/useDeviceIdMappingModal.ts', {
    vue, 'vue-router': { useRoute: () => ({ params: options.params ?? { id: 'unrelated-route-id' } }) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web/utils': { onlyMessage: (...args) => messages.push(args) },
    '../../../../../../../api/link/plugin': { savePluginData: async (...args) => { calls.push(args); return options.save ? options.save(...args) : ok({}) } },
  })
  const scope = vue.effectScope()
  const state = scope.run(() => useDeviceIdMappingModal(props, id => submitted.push(id)))
  t.after(() => scope.stop())
  return { state, props, calls, submitted, messages, scope }
}

test('new plugin detail queries the displayed device, opens its mapping and refreshes through its host', async t => {
  const { state, calls, saved } = fixture(t)
  await flush()
  assert.equal(state.inklingDeviceId.value, 'external')
  assert.deepEqual(calls, [['access', 'access-new'], ['mapping', 'device', 'access-new', 'new']])
  await state.openInklingModal()
  assert.equal(state.inkingVisible.value, true)
  await state.saveInkling()
  assert.equal(state.inkingVisible.value, false)
  assert.deepEqual(saved, ['new'])
  assert.equal(calls.some(call => call[0] === 'refresh'), false)
})

test('old plugin detail still uses and refreshes the instance context', async t => {
  const { state, calls, saved } = fixture(t, { props: { device: undefined } })
  await flush()
  await state.saveInkling()
  assert.ok(calls.some(call => call[0] === 'refresh' && call[1] === 'legacy'))
  assert.deepEqual(saved, ['legacy'])
})

test('non-plugin devices do not query mappings and readonly viewers cannot open editing', async t => {
  const plain = fixture(t, { props: { device: { ...target('plain'), accessProvider: 'mqtt-server-gateway' } } })
  await plain.state.openInklingModal()
  assert.equal(plain.state.isPluginGateway.value, false)
  assert.deepEqual(plain.calls, [])
  const readonly = fixture(t, { props: { canUpdate: false } })
  await flush()
  await readonly.state.openInklingModal()
  assert.equal(readonly.state.inkingVisible.value, false)
})

test('late responses cannot replace another device mapping or reopen the previous dialog', async t => {
  const pending = deferred()
  const { state, props } = fixture(t, { mapping: async (_, __, id) => id === 'new' ? pending.promise : ok({ externalId: 'external-B' }) })
  props.device = target('B')
  await flush()
  assert.equal(state.inklingDeviceId.value, 'external-B')
  await state.openInklingModal()
  assert.equal(state.inkingVisible.value, true)
  pending.resolve(ok({ externalId: 'stale-A' }))
  await flush()
  assert.equal(state.inklingDeviceId.value, 'external-B')
  props.device = target('C')
  await flush()
  assert.equal(state.inkingVisible.value, false)
})

test('failed mapping load releases loading and retries before opening', async t => {
  let fail = true
  const { state } = fixture(t, { access: async () => { if (fail) throw new Error('Offline'); return ok({ channelId: 'plugin' }) } })
  await flush()
  assert.equal(state.loading.value, false)
  assert.equal(state.loadFailed.value, true)
  await state.openInklingModal()
  assert.equal(state.inkingVisible.value, false)
  fail = false
  await state.openInklingModal()
  assert.equal(state.inkingVisible.value, true)
  assert.equal(state.loadFailed.value, false)
})

test('mapping saves the explicit device and selected external ID once despite an unrelated route', async t => {
  const pending = deferred()
  const { state, calls, submitted } = modal(t, { save: () => pending.promise })
  state.checkKey.value = 'external-selected'
  const saving = state.handleOk()
  await state.handleOk()
  assert.deepEqual(calls, [['device', 'gateway-A', 'device-A', 'external-selected']])
  pending.resolve(ok({}))
  await saving
  assert.deepEqual(submitted, ['external-selected'])
  assert.equal(state.loading.value, false)
})

test('mapping modal preserves old id and new deviceId route fallbacks', async t => {
  for (const params of [{ id: 'old-device' }, { deviceId: 'new-device' }]) {
    const { state, calls } = modal(t, { props: { internalId: undefined }, params })
    await state.handleOk()
    assert.equal(calls[0][2], params.id ?? params.deviceId)
  }
})

test('failed writes and empty selections do not submit, and a stale completion does not refresh another device', async t => {
  const failure = modal(t, { save: async () => { throw new Error('Offline') } })
  await failure.state.handleOk()
  assert.equal(failure.state.loading.value, false)
  assert.deepEqual(failure.submitted, [])
  failure.state.checkKey.value = ''
  await failure.state.handleOk()
  assert.equal(failure.calls.length, 1)
  assert.equal(failure.messages.length, 1)
  const pending = deferred()
  const stale = modal(t, { save: () => pending.promise })
  const saving = stale.state.handleOk()
  stale.props.internalId = 'device-B'
  pending.resolve(ok({}))
  await saving
  assert.deepEqual(stale.submitted, [])
})

const require = createRequire(import.meta.url)
const pass = { setup: (_, { slots }) => () => vue.h('span', slots.default?.()) }
async function render(file, state, components = {}) {
  const template = parse(read(file)).descriptor.template.content
  const compiled = compileTemplate({ source: template, filename: file, id: file })
  assert.deepEqual(compiled.errors, [])
  const code = transformSync(compiled.code, { format: 'cjs' }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(require, module, module.exports)
  const resolved = Object.fromEntries([...compiled.code.matchAll(/resolveComponent\("([^"]+)"\)/g)].map(([, name]) => [name,
    components[name] ?? (name === 'a-button' ? { setup: (_, { slots }) => () => vue.h('button', slots.default?.()) } : pass),
  ]))
  const app = vue.createSSRApp({ components: resolved, setup: () => state, render: module.exports.render })
  app.config.globalProperties.$t = key => key
  app.config.warnHandler = () => {}
  return renderToString(app)
}

test('mapping entry hides for ordinary devices and readonly users retain status without an edit button', async () => {
  for (const [isPluginGateway, canUpdate, expected] of [[false, true, false], [true, false, false], [true, true, true]]) {
    const html = await render(mappingFile, { isPluginGateway, canUpdate, loading: false, inkingVisible: false, mappingLabel: 'Mapped' })
    assert.equal(html.includes('<button'), expected)
    assert.equal(html.includes('Mapped'), isPluginGateway)
  }
})

test('current device header places the shared mapping entry after ID and passes current permissions and refresh callback', async () => {
  const html = await render(headerFile, { device: { ...target('new'), name: 'New' }, deviceNameText: 'New', deviceTypeText: 'Device',
    deviceSnText: 'new', deviceStatus: undefined, thingModelTags: [], canDeviceAction: () => true,
    canOpenProductDetail: false, parentDeviceId: '', isDeviceDisabled: false, actionBusyId: '',
  }, {
    DetailHeader: { setup: (_, { slots }) => () => vue.h('header', slots.meta?.()) },
    DeviceIdMapping: { props: ['device', 'canUpdate'], setup: props => () => vue.h('button', { 'data-mapping-device': props.device.id, 'data-can-update': String(props.canUpdate) }, 'Map ID') },
  })
  assert.match(html, /data-mapping-device="new"/)
  assert.ok(html.indexOf('CopyOutlined') < html.indexOf('data-mapping-device'))
  assert.match(read(headerFile), /@saved="onDetailContentChanged"/)
})

test('changed mapping components compile using their real imported prop types', () => {
  for (const file of [mappingFile, modalFile, headerFile]) {
    const filename = new URL(file, root).pathname.replace(/^\/([A-Za-z]:\/)/, '$1')
    const descriptor = parse(read(file), { filename }).descriptor
    assert.ok(compileScript(descriptor, { id: file }).content)
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: file }).errors, [])
  }
})


test('device adapter carries the real access ID and does not reuse a stale fallback gateway', () => {
  const { mapApiDevice } = load('views/device/list/services/adapters/iotDeviceApiAdapter.ts', {
    '@jetlinks-web/core': { request: {} },
    '@jetlinks-web-core/locales': { global: { t: key => key } },
    '@device-manager-ui/api/deviceGroup': {},
    '@device-manager-ui/api/deviceListDefaultTerms': {},
    '@device-manager-ui/api/spaceArea': {},
    '../shared/serviceResult': {},
    './iotDeviceMockAdapter': { createIotDeviceMockAdapter: () => ({}) },
  })
  const current = mapApiDevice({ ...target('new') }, 'project')
  assert.equal(current.accessId, 'access-new')
  assert.equal(current.accessProvider, 'plugin_gateway')
  assert.equal(mapApiDevice({ id: 'new', accessProvider: 'plugin_gateway' }, 'project', current).accessId, undefined)
})
