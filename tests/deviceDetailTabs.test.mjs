import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { computed, ref, shallowRef } from 'vue'
import { transform } from 'esbuild'

// 直接加载生产纯函数，node --test 即可运行，无需预生成 work 目录产物。
const source = await readFile(new URL('../views/device/list/hooks/deviceDetailTabs.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { normalizeDeviceDetailTab, selectDeviceDetailTabs } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

// 执行实际注册的映射页签配置，隔离其余模块初始化与 Vue 异步页面加载。
const registerSource = await readFile(new URL('../register.ts', import.meta.url), 'utf8')
const registerAst = ts.createSourceFile('register.ts', registerSource, ts.ScriptTarget.Latest, true)
const registration = registerAst.statements.find(ts.isExportAssignment).expression
const mappingConfig = registration.properties.find(property => property.name?.getText(registerAst) === 'deviceDetailTabs')
const { code: mappingCode } = await transform(`module.exports = ${mappingConfig.initializer.getText(registerAst)}`, { loader: 'ts', format: 'cjs' })
const mappingModule = { exports: {} }
vm.runInNewContext(mappingCode, {
  module: mappingModule,
  i18n: { global: { t: key => key } },
  defineAsyncComponent: loader => ({ loader }),
})
const mappingProviders = Object.values(mappingModule.exports)

const deviceOf = accessProvider => ({ id: 'camera-1', accessProvider })
const channels = {
  key: 'channels', label: () => 'Channels', icon: 'VideoCameraOutlined', component: {},
  matches: device => device.accessProvider === 'fixed-media',
}

test('channel deep link restores after device and module resolve without rewriting query', () => {
  const device = ref(null)
  const registered = shallowRef([])
  const query = ref('channels')
  const tabs = computed(() => selectDeviceDetailTabs(device.value, registered.value))
  const active = computed(() => normalizeDeviceDetailTab(query.value, tabs.value))
  assert.equal(active.value, 'overview')
  device.value = deviceOf('fixed-media')
  assert.equal(active.value, 'overview')
  registered.value = [channels]
  assert.equal(active.value, 'channels')
  registered.value = []
  assert.equal(active.value, 'overview')
  registered.value = [channels]
  assert.equal(active.value, 'channels')
  assert.equal(query.value, 'channels')
})

test('device capability governs tabs when switching from a camera to an ordinary device', () => {
  assert.deepEqual(selectDeviceDetailTabs(null, [channels]), [])
  assert.equal(selectDeviceDetailTabs(deviceOf('fixed-media'), [channels]).length, 1)
  const ordinaryTabs = selectDeviceDetailTabs(deviceOf('mqtt'), [channels])
  assert.deepEqual(ordinaryTabs, [])
  assert.equal(normalizeDeviceDetailTab('channels', ordinaryTabs), 'overview')
})

test('built-in tabs and legacy deep links retain their destinations', () => {
  for (const tab of ['overview', 'access', 'thing-model', 'commands', 'data', 'alarm', 'invalid', 'logs']) {
    assert.equal(normalizeDeviceDetailTab(tab, [channels]), tab)
  }
  assert.equal(normalizeDeviceDetailTab('advanced', [channels]), 'access')
  assert.equal(normalizeDeviceDetailTab('realtime', [channels]), 'data')
  assert.equal(normalizeDeviceDetailTab('records', [channels]), 'logs')
  assert.equal(normalizeDeviceDetailTab('simulator', [channels]), 'commands')
  assert.equal(normalizeDeviceDetailTab('Invalid', [channels]), 'invalid')
  assert.equal(normalizeDeviceDetailTab(['channels'], [channels]), 'overview')
  assert.equal(normalizeDeviceDetailTab('missing', [channels]), 'overview')
  assert.equal(normalizeDeviceDetailTab('__proto__', [channels]), 'overview')
})

test('registration order is stable and extensions cannot shadow built-in or duplicate tabs', () => {
  const late = { ...channels, order: 20 }
  const early = { ...channels, key: 'recording', order: 10 }
  const duplicate = { ...channels, order: 30 }
  const shadow = { ...channels, key: 'overview', order: 0 }
  const selected = selectDeviceDetailTabs(deviceOf('fixed-media'), [late, early, duplicate, shadow])
  assert.deepEqual(selected.map(tab => tab.key), ['recording', 'channels'])
  assert.equal(selected[1], late)
})

test('metrics coexist with capability-based mapping and collector gateway tabs', () => {
  const ordinary = { id: 'ordinary', protocol: 'mqtt' }
  const supported = { ...ordinary, features: [{ id: 'diffMetadataSameProduct' }] }
  const collector = { ...ordinary, protocol: 'collector-gateway' }
  const keys = device => selectDeviceDetailTabs(device, mappingProviders).map(tab => tab.key)
  assert.deepEqual(keys(null), [])
  assert.deepEqual(keys(ordinary), ['metrics'])
  assert.deepEqual(keys({ ...ordinary, features: [{ id: 'transparentCodec' }] }), ['metrics'])
  assert.deepEqual(keys(supported), ['MetadataMap', 'metrics'])
  assert.deepEqual(keys(collector), ['GateWay', 'metrics'])
  assert.deepEqual(keys({ ...collector, features: supported.features }), ['MetadataMap', 'GateWay', 'metrics'])
})

test('mapping deep links restore on load and fall back after switching to an unsupported device', () => {
  const device = ref(null)
  const tabs = computed(() => selectDeviceDetailTabs(device.value, mappingProviders))
  for (const key of ['MetadataMap', 'GateWay']) {
    assert.equal(normalizeDeviceDetailTab(key, tabs.value), 'overview')
    device.value = { id: 'supported', protocol: 'collector-gateway', features: [{ id: 'diffMetadataSameProduct' }] }
    assert.equal(normalizeDeviceDetailTab(key, tabs.value), key)
    device.value = { id: 'ordinary', protocol: 'mqtt', features: [] }
    assert.equal(normalizeDeviceDetailTab(key, tabs.value), 'overview')
  }
})
