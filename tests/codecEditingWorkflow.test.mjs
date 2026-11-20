import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'
import * as vue from 'vue'

const root = new URL('../', import.meta.url)
const tick = () => new Promise(setImmediate)
async function load(file, modules) {
  const { code } = await transform(await readFile(new URL(file, root), 'utf8'), { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, window: { addEventListener() {}, removeEventListener() {} }, require(id) {
    if (id === 'vue') return { ...vue, onMounted: () => {} }
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === '@vueuse/core') return { useFullscreen: () => ({ toggle() {} }) }
    if (id === 'lodash-es') return { isBoolean: value => typeof value === 'boolean' }
    const entry = Object.entries(modules).find(([name]) => id.includes(name))
    if (entry) return entry[1]
    throw Error(`Unexpected import ${id}`)
  } })
  return module.exports
}
function dialogs() {
  const opened = []
  return { opened, Modal: { confirm(config) { const instance = { config, update() {}, destroy() { config.afterClose?.() } }; opened.push(instance); return instance } }, message: { success() {}, error() {} } }
}
async function guardModule(ui) {
  return load('views/device/components/useCodecLeaveGuard.ts', { 'ant-design-vue': ui, 'vue-router': { onBeforeRouteLeave() {}, onBeforeRouteUpdate() {} } })
}
async function deviceHarness(overrides = {}, independent = false) {
  const ui = dialogs(), requests = []
  const guard = await guardModule(ui)
  const api = {
    queryProtocolDetail: async () => ({ status: 200, result: { routes: [] } }),
    queryTransparentCodecTips: async () => ({ status: 200, result: '' }),
    saveDeviceTransparentCodec: async (...args) => { requests.push(['save', ...args]); return { status: 200 } },
    deleteDeviceTransparentCodec: async (...args) => { requests.push(['delete', ...args]); return { status: 200 } },
    getDeviceTransparentCodec: async () => ({ status: 200, result: { configuration: { script: 'product-script' } } }),
    testTransparentDecode: async payload => { requests.push(['debug', payload]); return { status: 200, result: { success: true, outputs: [{ temperature: 25 }] } } },
    ...overrides,
  }
  const { useIotDeviceScriptTransparentCodec } = await load('views/device/list/hooks/useIotDeviceScriptTransparentCodec.ts', {
    'ant-design-vue': ui, useCodecLeaveGuard: guard,
    'iotDeviceDetailReal.service': { iotDeviceDetailRealApi: api },
  })
  const props = vue.reactive({ device: { id: 'device', transport: 'MQTT', protocol: 'protocol' }, productId: 'product',
    codec: { deviceId: independent ? 'device' : undefined, configuration: { script: independent ? 'device-script' : 'product-script' } } })
  const scope = vue.effectScope(), state = scope.run(() => useIotDeviceScriptTransparentCodec(props, () => {}))
  return { state, scope, ui, requests, props }
}

async function productHarness() {
  const ui = dialogs(), guard = await guardModule(ui)
  let stored = { provider: 'jsr223', configuration: { script: 'codec.onUpstream(function(ctx){ctx.sendMessage({temperature:25});});', lang: 'javascript' } }
  const api = { productCode: async () => ({ status: 200, result: structuredClone(stored) }),
    saveProductCode: async (_id, value) => { stored = JSON.parse(JSON.stringify(value)); return { status: 200 } },
    testCode: async () => ({ status: 200, result: { success: true, outputs: [{ temperature: 25 }] } }),
  }
  const productCodec = await load('views/device/Product/Detail/DataAnalysis/useProductCodec.ts', { 'api/instance': api })
  const { useProductDataAnalysis } = await load('views/device/Product/Detail/DataAnalysis/useProductDataAnalysis.ts', {
    useCodecLeaveGuard: guard, useProductCodec: productCodec, 'api/instance': api,
    'store/product': { useProductStore: () => ({ current: { id: 'product', transportProtocol: 'MQTT' } }) },
    '@jetlinks-web-core/store': { useAuthStore: () => ({ hasPermission: () => true }) }, 'utils/comm': { onlyMessage() {} },
  })
  const scope = vue.effectScope(), state = scope.run(() => useProductDataAnalysis())
  await state.getProductCode()
  return { state, scope, ui }
}

test('reloading an empty inherited codec discards JS edits, clears results and keeps simulation input', async () => {
  const { state: s, props, scope, ui } = await deviceHarness()
  props.codec = null; await vue.nextTick()
  s.beginEdit(); s.editorValue.value = 'unsaved'
  s.topic.value = '/report'; s.simulation.value = 'raw'
  s.debug(); await tick()
  assert.ok(s.resultTime.value)
  s.reloadCodec()
  assert.equal(s.readOnly.value, true)
  assert.equal(s.isDirty.value, false)
  assert.equal(s.resultTime.value, '')
  assert.equal(s.resultSuccess.value, undefined)
  assert.equal(s.simulation.value, 'raw')
  assert.equal(s.topic.value, '/report')
  assert.equal(ui.opened.length, 0)
  scope.stop()
})

test('a debug response arriving after reload cannot restore the old result', async () => {
  let finish
  const { state: s, scope } = await deviceHarness({ testTransparentDecode: () => new Promise(resolve => { finish = resolve }) })
  s.topic.value = '/report'; s.simulation.value = 'raw'
  s.debug()
  s.reloadCodec()
  finish({ status: 200, result: { success: true, outputs: [{ old: true }] } }); await tick()
  assert.equal(s.resultTime.value, '')
  assert.equal(s.resultDisplay.value, '')
  assert.equal(s.loading.value, false)
  scope.stop()
})

test('product reload drops unsaved changes without prompting and clears debug results', async () => {
  const { state: s, scope, ui } = await productHarness()
  const original = s.editorValue.value
  assert.equal(s.isDirty.value, false)
  s.editorValue.value += '\n// user edit'
  s.topic.value = '/report'; s.simulation.value = 'raw'
  s.debug(); await tick()
  assert.ok(s.resultTime.value)
  await s.reload()
  assert.equal(ui.opened.length, 0)
  assert.equal(s.editorValue.value, original)
  assert.equal(s.isDirty.value, false)
  assert.equal(s.resultTime.value, '')
  assert.equal(s.simulation.value, 'raw')
  s.editorValue.value += '\n// actual change'
  assert.equal(await s.save(), true)
  assert.equal(s.isDirty.value, false)
  scope.stop()
})

test('product provider switching tracks dirty state and discards back to the saved provider', async () => {
  const { state: s, scope, ui } = await productHarness()
  const original = s.editorValue.value
  await s.changeProvider('modbus')
  assert.equal(s.editorLanguage.value, 'json')
  assert.equal(s.isDirty.value, true)
  const pending = s.changeProvider('jsr223')
  assert.equal(ui.opened.length, 1)
  ui.opened[0].config.onCancel()
  await pending
  assert.equal(s.codec.value.provider, 'jsr223')
  assert.equal(s.editorValue.value, original)
  assert.equal(s.isDirty.value, false)
  scope.stop()
})

test('inherited JS is read-only but can debug without creating an override; clicking Edit alone is clean', async () => {
  const { state: s, requests, scope } = await deviceHarness()
  assert.equal(s.readOnly.value, true)
  assert.equal(await s.saveCodec(), false)
  s.simulation.value = '{"temperature":25}'
  s.topic.value = '/report'
  assert.equal(s.debugDisabled.value, false)
  s.debug(); await tick()
  assert.equal(requests[0][0], 'debug')
  assert.equal(s.resultDisplay.value.includes('25'), true)
  s.beginEdit()
  assert.equal(s.isDirty.value, false)
  assert.equal(await s.confirmLeave(), true)
  assert.equal(requests.some(([action]) => action === 'save'), false)
  scope.stop()
})

test('saving creates an independent device configuration and tracks the submitted snapshot', async () => {
  let finish
  const { state: s, scope } = await deviceHarness({ saveDeviceTransparentCodec: () => new Promise(resolve => { finish = resolve }) })
  s.beginEdit(); s.editorValue.value = 'first edit'
  const pending = s.saveCodec()
  assert.equal(s.savingConfig.value, true)
  s.editorValue.value = 'newer edit'
  finish({ status: 200 }); assert.equal(await pending, true)
  assert.equal(s.hasIndependentCodec.value, true)
  assert.equal(s.editorValue.value, 'newer edit')
  assert.equal(s.isDirty.value, true)
  scope.stop()
})

test('failed device save preserves the draft and clears loading', async () => {
  const { state: s, scope } = await deviceHarness({ saveDeviceTransparentCodec: async () => { throw Error('offline') } })
  s.beginEdit(); s.editorValue.value = 'draft'
  assert.equal(await s.saveCodec(), false)
  assert.equal(s.isDirty.value, true)
  assert.equal(s.hasIndependentCodec.value, false)
  assert.equal(s.savingConfig.value, false)
  scope.stop()
})

test('debug request failure produces a recoverable result and retains the simulation input', async () => {
  const { state: s, scope } = await deviceHarness({ testTransparentDecode: async () => { throw Error('offline') } })
  s.simulation.value = 'raw-message'
  s.topic.value = '/report'
  s.debug(); await tick()
  assert.equal(s.loading.value, false)
  assert.equal(s.resultSuccess.value, false)
  assert.equal(s.resultDisplay.value, 'deviceDetailOptimization.debugRequestFailed')
  assert.equal(s.simulation.value, 'raw-message')
  assert.ok(s.resultTime.value)
  assert.equal(s.debugDisabled.value, false)
  scope.stop()
})

test('restore requires confirmation, discards an unsaved override locally and deletes only a saved override', async () => {
  for (const independent of [false, true]) {
    const { state: s, ui, requests, scope } = await deviceHarness({}, independent)
    s.beginEdit(); s.editorValue.value = 'draft'
    s.resetDeviceCodec()
    assert.equal(requests.length, 0)
    assert.equal(s.editorValue.value, 'draft')
    const dialog = ui.opened[0]
    let closed = false
    dialog.config.onOk(() => { closed = true })
    await tick()
    assert.equal(closed, true)
    assert.equal(requests.filter(([action]) => action === 'delete').length, independent ? 1 : 0)
    assert.equal(s.editorValue.value, 'product-script')
    assert.equal(s.readOnly.value, true)
    assert.equal(s.isDirty.value, false)
    scope.stop()
  }
})

test('a saved independent configuration opens editable and can be saved without a debug request', async () => {
  const { state: s, requests, scope } = await deviceHarness({}, true)
  assert.equal(s.readOnly.value, false)
  assert.equal(s.isDirty.value, false)
  s.editorValue.value = 'updated'
  assert.equal(await s.saveCodec(), true)
  assert.equal(s.isDirty.value, false)
  assert.equal(requests[0][0], 'save')
  assert.equal(requests[0][3].configuration.script, 'updated')
  scope.stop()
})

test('leave confirmation distinguishes closing, discarding and saving, and stays open after a failed save', async () => {
  const ui = dialogs(), { useCodecLeaveGuard } = await guardModule(ui)
  let dirty = true, saveResult = false, discarded = 0
  const scope = vue.effectScope()
  const guard = scope.run(() => useCodecLeaveGuard({ dirty: () => dirty, busy: () => false,
    save: async () => { if (saveResult) dirty = false; return saveResult }, discard: () => { discarded++; dirty = false } }))
  const closePending = guard.confirmLeave()
  assert.equal(guard.confirmLeave(), closePending, 'concurrent navigation shares one decision')
  ui.opened[0].config.onCancel(() => {}, {})
  assert.equal(await closePending, false)
  assert.equal(discarded, 0)
  const savePending = guard.confirmLeave(), dialog = ui.opened[1]
  let closed = false
  dialog.config.onOk(() => { closed = true }); await tick()
  assert.equal(closed, false)
  saveResult = true
  dialog.config.onOk(() => { closed = true }); await tick()
  assert.equal(await savePending, true)
  assert.equal(closed, true)
  dirty = true
  const discardPending = guard.confirmLeave()
  ui.opened[2].config.onCancel()
  assert.equal(await discardPending, true)
  assert.equal(discarded, 1)
  scope.stop()
})

test('product JS and JSON save without prior debugging and preserve provider/configuration', async () => {
  for (const configuration of [{ script: 'product-script', lang: 'javascript', custom: 1 }, { mapping: { properties: [] } }]) {
    const ui = dialogs(), guard = await guardModule(ui), requests = []
    const api = { productCode: async () => ({ status: 200, result: { provider: configuration.script ? 'jsr223' : 'modbus', configuration } }),
      saveProductCode: async (...args) => { requests.push(args); return { status: 200 } } }
    const productCodec = await load('views/device/Product/Detail/DataAnalysis/useProductCodec.ts', { 'api/instance': api })
    const { useProductDataAnalysis } = await load('views/device/Product/Detail/DataAnalysis/useProductDataAnalysis.ts', {
      useCodecLeaveGuard: guard, useProductCodec: productCodec, 'api/instance': api,
      'store/product': { useProductStore: () => ({ current: { id: 'product' } }) },
      '@jetlinks-web-core/store': { useAuthStore: () => ({ hasPermission: () => true }) }, 'utils/comm': { onlyMessage() {} },
    })
    const scope = vue.effectScope(), s = scope.run(() => useProductDataAnalysis())
    await s.getProductCode()
    assert.equal(s.isDirty.value, false)
    assert.equal(s.saveDisabled.value, false)
    assert.equal(await s.save(), true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0][1].provider, configuration.script ? 'jsr223' : 'modbus')
    assert.deepEqual(JSON.parse(JSON.stringify(requests[0][1].configuration)), configuration)
    if (!configuration.script) {
      s.editorValue.value = 'invalid JSON'
      assert.equal(await s.save(), false)
      assert.equal(requests.length, 1)
      assert.equal(s.isDirty.value, true)
    }
    scope.stop()
  }
})

test('Modbus edits use the same leave confirmation while retaining the mapping provider', async () => {
  const ui = dialogs(), guard = await guardModule(ui), requests = []
  const { useMappingConfiguration } = await load('views/device/Instance/Detail/Parsing/modbus/mapping/useMappingConfiguration.ts', {
    'ant-design-vue': { ...ui, message: { ...ui.message, warning() {} } }, useCodecLeaveGuard: guard,
    'store/instance': { useInstanceStore: () => ({ current: {} }) },
    'api/instance': { deviceCode: async () => ({ status: 200, result: null }),
      saveDeviceCode: async (...args) => { requests.push(args); return { status: 200 } } },
  })
  const scope = vue.effectScope()
  const s = scope.run(() => useMappingConfiguration(key => key, { thingId: 'device', productId: 'product' }, {
    doParseRegisterStr: () => ({ slaveId: 1, type: 'HoldingRegisters', address: 0, count: 1 }),
    ZONE_INFO: vue.ref({ HoldingRegisters: { addressing: 'word' } }),
  }, { layoutWordCountForSave: () => 1, layoutLogicalToBackend: () => 'AB', normalizeLayoutToLogical: () => 'AB', layoutWordCountFromRegisterReg: () => 1 },
  { normalizeCodecId: value => value || 'int16' }, { toFiniteNumberOr: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback, autoFillLayout() {} }))
  const { confirmLeave } = scope.run(() => guard.useCodecLeaveGuard({ dirty: () => s.isDirty.value,
    busy: () => s.loading.value || s.saving.value, save: s.saveConfig, discard: s.discardChanges }))
  await s.loadConfig()
  assert.equal(await confirmLeave(), true)
  s.mappings.value.push({ property: 'temperature', registerStr: '3_0' })
  const pending = confirmLeave()
  assert.equal(ui.opened.length, 1)
  ui.opened[0].config.onOk(() => {})
  assert.equal(await pending, true)
  assert.equal(requests[0][2].provider, 'modbus')
  assert.equal(requests[0][2].configuration.mapping.properties[0].property, 'temperature')
  assert.equal(await confirmLeave(), true)
  s.mappings.value[0].property = 'humidity'
  const discard = confirmLeave()
  ui.opened[1].config.onCancel()
  assert.equal(await discard, true)
  assert.equal(s.mappings.value[0].property, 'temperature')
  assert.equal(requests.length, 1)
  scope.stop()
})
