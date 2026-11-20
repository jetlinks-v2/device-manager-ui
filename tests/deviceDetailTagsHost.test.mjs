import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = new URL('../views/device/list/', import.meta.url)
const tagsPath = 'components/device-detail/tags/'
function load(file, dependencies) {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(new URL(file, root), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(
    name => { assert.ok(name in dependencies, `Missing dependency ${name}`); return dependencies[name] }, module, module.exports,
  )
  return module.exports
}
const tagEditor = load(tagsPath + 'tagEditor.ts', { dayjs: require('dayjs') })
const adapter = load('services/adapters/iotDeviceApiAdapter.ts', {
  '@jetlinks-web/core': { request: {} }, '@jetlinks-web-core/locales': { global: { t: key => key } },
  '@device-manager-ui/api/deviceGroup': {}, '@device-manager-ui/api/deviceListDefaultTerms': {},
  '@device-manager-ui/api/spaceArea': {}, '../shared/serviceResult': {}, './iotDeviceMockAdapter': { createIotDeviceMockAdapter: () => ({}) },
})
const definitions = [
  { id: 'place', name: '安装位置', dataType: { type: 'string' } },
  { id: 'count', name: '数量', dataType: { type: 'int' } },
  { id: 'enabled', name: '开关', dataType: { type: 'boolean', trueValue: true, trueText: '开', falseValue: false, falseText: '关' } },
]
const detail = (id = 'A', tags = [{ id: 'record-place', key: 'place', value: '机房' }]) => ({
  id, productMetadata: JSON.stringify({ tags: definitions }), tags,
})
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }
function fixture(t) {
  const calls = [], events = [], messages = []
  const props = vue.reactive({ deviceId: 'A', deviceDetail: detail(), canUpdate: true })
  const api = {
    saveTags: async (...args) => { calls.push(['save', ...args]); return { status: 200 } },
    deleteTag: async (...args) => { calls.push(['delete', ...args]); return { status: 200 } },
    getDeviceDetail: async id => { calls.push(['refresh', id]); return { status: 200, result: detail(id) } },
  }
  const { useDeviceDetailTags } = load(tagsPath + 'useDeviceDetailTags.ts', {
    vue, 'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web/utils': { onlyMessage: message => messages.push(message) },
    '../../../services/adapters/iotDeviceApiAdapter': adapter,
    '../../../services/iotDeviceDetailReal.service': { iotDeviceDetailRealApi: api }, './tagEditor': tagEditor,
  })
  const scope = vue.effectScope()
  const state = scope.run(() => useDeviceDetailTags(props, (id, value) => {
    events.push([id, value]); props.deviceDetail = value
  }))
  t.after(() => scope.stop())
  return { state, props, calls, events, messages, api, scope }
}

test('uses the existing raw detail without extra reads, preserving definitions and 0/false values', t => {
  const f = fixture(t)
  f.props.deviceDetail = detail('A', [{ id: 'r-count', key: 'count', value: 0 }, { id: 'r-enabled', key: 'enabled', value: false }])
  assert.equal(f.state.thingModelTags.length, 3)
  assert.deepEqual(f.calls, [])
  const count = f.state.thingModelTags[1], enabled = f.state.thingModelTags[2]
  assert.equal(count.id, 'r-count')
  assert.equal(count.dataType.type, 'int')
  assert.equal(f.state.formatTagTooltipValueOnly(count), '0')
  assert.equal(f.state.formatTagTooltipValueOnly(enabled), '关')
  assert.equal(tagEditor.hasTagValue(enabled.value), true)
})

test('saving refreshes only the device detail and notifies its host with the saved values', async t => {
  const f = fixture(t)
  f.api.getDeviceDetail = async id => {
    f.calls.push(['refresh', id]); return { status: 200, result: detail(id, [{ id: 'record-place', key: 'place', value: '大厅' }]) }
  }
  assert.equal(await f.state.saveTags([{ key: 'place', value: '大厅' }]), true)
  assert.deepEqual(f.calls, [['save', 'A', [{ key: 'place', value: '大厅' }]], ['refresh', 'A']])
  assert.equal(f.events[0][0], 'A')
  assert.equal(f.state.thingModelTags[0].value, '大厅')
  assert.equal(f.state.savingTags, false)
  assert.equal(f.messages.length, 1)
})

test('clearing deletes the instance record, keeping the definition available for adding again', async t => {
  const f = fixture(t)
  f.api.getDeviceDetail = async id => ({ status: 200, result: detail(id, []) })
  assert.equal(await f.state.removeTag({ id: 'place' }), true)
  assert.deepEqual(f.calls, [['delete', 'A', 'record-place']])
  assert.equal(f.state.thingModelTags[0].id, 'place')
  assert.equal(f.state.thingModelTags[0].value, undefined)
  assert.equal(f.state.canRemoveTag(f.state.thingModelTags[0]), false)
  assert.equal(await f.state.removeTag({ id: 'enabled' }), false)
})

test('read-only state prevents writes and mismatched raw detail cannot edit another device', async t => {
  const f = fixture(t)
  f.props.canUpdate = false
  assert.equal(await f.state.saveTags([{ key: 'place', value: 'new' }]), false)
  assert.equal(await f.state.removeTag({ id: 'place' }), false)
  assert.equal(f.state.thingModelTags.length, 3)
  f.props.canUpdate = true
  f.props.deviceId = 'B'
  assert.equal(f.state.thingModelTags.length, 0)
  assert.equal(await f.state.saveTags([{ key: 'place', value: 'new' }]), false)
  assert.deepEqual(f.calls, [])
})

test('failed save, delete and refresh release busy state without emitting success', async t => {
  for (const action of ['saveTags', 'deleteTag', 'getDeviceDetail']) {
    const f = fixture(t)
    f.api[action] = async () => ({ status: 500 })
    await assert.rejects(action === 'deleteTag'
      ? f.state.removeTag({ id: 'place' }) : f.state.saveTags([{ key: 'place', value: 'new' }]))
    assert.equal(f.state.savingTags, false)
    assert.equal(f.events.length, 0)
    assert.equal(f.messages.length, 0)
    assert.equal(f.state.thingModelTags[0].value, '机房')
  }
})

test('an in-flight write cannot start twice or refresh a different device after switching', async t => {
  const f = fixture(t), pending = deferred()
  f.api.saveTags = () => pending.promise
  const saving = f.state.saveTags([{ key: 'place', value: 'new' }])
  assert.equal(await f.state.saveTags([{ key: 'place', value: 'duplicate' }]), false)
  f.props.deviceId = 'B'; f.props.deviceDetail = detail('B')
  pending.resolve({ status: 200 })
  assert.equal(await saving, false)
  assert.deepEqual(f.calls, [])
  assert.equal(f.events.length, 0)
})

test('late refresh after disposal or A → B → A cannot replace the displayed detail', async t => {
  for (const dispose of [true, false]) {
    const f = fixture(t), pending = deferred()
    f.api.getDeviceDetail = () => pending.promise
    const saving = f.state.saveTags([{ key: 'place', value: 'new' }])
    await vue.nextTick()
    if (dispose) f.scope.stop()
    else { f.props.deviceId = 'B'; f.props.deviceId = 'A' }
    pending.resolve({ status: 200, result: detail() })
    assert.equal(await saving, false)
    assert.equal(f.events.length, 0)
    assert.equal(f.messages.length, 0)
  }
})
