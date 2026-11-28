import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as vue from 'vue'

function load(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (!(id in imports)) throw Error(`Unexpected import: ${id}`)
    return imports[id]
  }, module, module.exports)
  return module.exports
}

function setup(t, overrides = {}) {
  const calls = [], refreshed = [], groups = new Set(['old', 'external'])
  const groupApi = {
    queryDeviceGroupDetailList_api: async () => [],
    queryDeviceBoundGroups_api: async () => ({ device: [{ id: 'old', name: 'Old' }] }),
    bindDeviceGroupDevices_api: async id => { groups.add(id) },
    unbindDeviceGroupDevices_api: async id => { groups.delete(id) },
    ...overrides.groups,
  }
  const areaApi = {
    existsDeviceSpaceAreaSupport_api: async () => true,
    queryProjectSpaceAreaSettings_api: async () => ({ areas: [] }),
    queryDeviceSpaceAreaBindings_api: async () => [{ areaId: 'a' }],
    bindDevicesSpaceArea_api: async () => {},
    ...overrides.areas,
  }
  const bindings = load('../views/device/list/hooks/iotDeviceAreaGroupBindings.ts', {
    '@device-manager-ui/api/deviceGroup': groupApi, '@device-manager-ui/api/spaceArea': areaApi,
  })
  const api = load('../api/deviceHeader.ts', { '@jetlinks-web/core': { request: { put: async (...args) => calls.push(args) } } })
  const { useDeviceHeaderEditing } = load('../components/device-detail/useDeviceHeaderEditing.ts', {
    vue,
    'vue-i18n': { useI18n: () => ({ t: key => key, locale: vue.ref('en-US') }) },
    '@jetlinks-web-core/components/I18n': load('../../../jetlinks-web-core/src/components/I18n/text.ts'),
    '../../api/deviceHeader': api,
    '../../api/device': { getDeviceDetail_api: overrides.getDevice || (async () => ({ id: 'device', name: 'Old', i18nMessages: { name: { zh: '旧名称', en: 'Old', 'en-US': 'US name' }, description: { ja: '説明' } }, configuration: { retained: true } })) },
    '../../api/deviceGroup': groupApi, '../../api/spaceArea': areaApi,
    '../../views/device/list/hooks/iotDeviceAreaGroupBindings': bindings,
    '../../views/device/list/hooks/iotAreaTreeOptions': { buildAreaTreeData: value => value, mergeDeviceBoundAreas: (areas, bindings) => [...areas, ...bindings] },
    '../../views/device/list/hooks/iotDeviceGroupTreeOptions': { buildDeviceGroupTreeData: value => value },
  })
  const props = vue.reactive({ deviceId: 'device', projectId: 'project', allowed: true, refresh: async id => refreshed.push(id) })
  const scope = vue.effectScope(), state = scope.run(() => useDeviceHeaderEditing(props))
  t.after(() => scope.stop())
  return { state, props, scope, calls, refreshed, groups }
}

test('name patch preserves other translations and never resubmits unrelated device fields', async t => {
  const { state, calls, refreshed } = setup(t)
  await state.saveName('  New name  ')
  assert.deepEqual(calls, [['/device-instance/device', { name: 'New name', i18nMessages: { name: { zh: '旧名称', en: 'Old', 'en-US': 'New name' }, description: { ja: '説明' } } }]])
  assert.deepEqual(refreshed, ['device'])
})

test('name translations replace their own field while description saves patch describe and preserve other fields',async t=>{
  const {state,calls}=setup(t)
  await state.saveName('New name',{zh:'新名称',de:'Name'})
  assert.deepEqual(calls[0][1],{name:'New name',i18nMessages:{name:{zh:'新名称',de:'Name'},description:{ja:'説明'}}})
  await state.saveDescription('说明',{zh:'说明',en:'Description'})
  assert.deepEqual(calls[1][1],{describe:'说明',i18nMessages:{name:{zh:'旧名称',en:'Old','en-US':'US name'},description:{zh:'说明',en:'Description'}}})
  await state.saveDescription('',{})
  assert.equal(calls[2][1].describe,'')
  await assert.rejects(state.saveDescription('x'.repeat(201)))
})

test('icon update and removal only patch photoUrl and encode the device identifier', async t => {
  const { state, props, calls } = setup(t)
  props.deviceId = 'device/with space'
  await state.saveIcon('/file/new.png'); await state.saveIcon('')
  assert.deepEqual(calls, [['/device-instance/device%2Fwith%20space', { photoUrl: '/file/new.png' }], ['/device-instance/device%2Fwith%20space', { photoUrl: '' }]])
})

test('empty and oversized names and denied permissions cannot write', async t => {
  const { state, props, calls } = setup(t)
  await assert.rejects(state.saveName('  '))
  await assert.rejects(state.saveName('a'.repeat(65)))
  props.allowed = false
  await assert.rejects(state.saveIcon('/file/new.png'))
  assert.deepEqual(calls, [])
})

test('device, project, permission changes and disposal prevent a late name read from writing', async t => {
  for (const change of [({ props }) => { props.deviceId = 'next' }, ({ props }) => { props.projectId = 'next' }, ({ props }) => { props.allowed = false }, ({ scope }) => scope.stop()]) {
    let resolve
    const fixture = setup(t, { getDevice: () => new Promise(done => { resolve = done }) })
    const pending = fixture.state.saveName('new')
    change(fixture)
    resolve({ id: 'device', name: 'old' })
    await assert.rejects(pending)
    assert.deepEqual(fixture.calls, [])
    assert.deepEqual(fixture.refreshed, [])
  }
})

test('binding read failure is not treated as an empty writable baseline', async t => {
  const { state, calls } = setup(t, { groups: { queryDeviceBoundGroups_api: async () => { throw Error('no bindings') } } })
  await state.prepareScope('group')
  assert.equal(state.loadError.value, 'no bindings')
  await assert.rejects(state.saveScope('group', []))
  assert.deepEqual(calls, [])
})

test('group edits apply a delta from the opened baseline and preserve external additions', async t => {
  const { state, groups } = setup(t)
  await state.prepareScope('group')
  assert.deepEqual(state.options.value, [{ title: 'Old', value: 'old', key: 'old' }])
  await state.saveScope('group', ['new'])
  assert.deepEqual([...groups].sort(), ['external', 'new'])
})

test('space binding retains an ID-only association and rejects an empty selection', async t => {
  const writes = []
  const { state } = setup(t, { areas: { bindDevicesSpaceArea_api: async (...args) => writes.push(args) } })
  await state.prepareScope('area')
  assert.deepEqual(state.detail.value.areaBindings, [{ areaId: 'a', area: 'a' }])
  await assert.rejects(state.saveScope('area', []))
  await state.saveScope('area', ['b'])
  assert.deepEqual(writes, [['b', ['device']]])
})

test('a failed save keeps field feedback and allows retry', async t => {
  let fail = true
  const { state, refreshed } = setup(t, { getDevice: async () => { if (fail) throw Error('read failed'); return { id: 'device', name: 'old' } } })
  await assert.rejects(state.saveName('new'))
  assert.equal(state.failure.value, 'read failed')
  assert.equal(state.busy.value, false)
  fail = false; await state.saveName('new')
  assert.equal(state.failure.value, '')
  assert.deepEqual(refreshed, ['device'])
})
