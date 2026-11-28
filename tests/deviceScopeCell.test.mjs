import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { createComponentLoader } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

const { useDeviceScopeCellEditing } = createComponentLoader({
  'vue-i18n': { useI18n: () => ({ t: key => key }) },
})('../../modules/device-manager-ui/components/useDeviceScopeCellEditing.ts')

function mount(t, save, extra = {}) {
  const props = vue.reactive({ kind: 'group', value: ['a', 'b'], text: 'A、B', options: [], allowed: true, disabled: false, loading: false, loadError: '', save, ...extra })
  const scope = vue.effectScope()
  const state = scope.run(() => vue.proxyRefs(useDeviceScopeCellEditing(props, () => {})))
  t.after(() => scope.stop())
  return { state, props }
}

test('multi-group draft survives failed save and retries without changing its source value', async t => {
  const calls = []; let fail = true
  const { state, props } = mount(t, async ids => { calls.push(ids); if (fail) throw Error('failed') })
  state.changeOpen(true); await vue.nextTick()
  assert.deepEqual(state.draft, ['a', 'b'])
  state.changeDraft(['b', 'c']); await state.submit()
  assert.equal(state.open, true)
  assert.equal(state.failure, 'failed')
  assert.deepEqual(props.value, ['a', 'b'])
  fail = false; await state.submit()
  assert.equal(state.open, false)
  assert.deepEqual(calls, [['b', 'c'], ['b', 'c']])
})

test('space selection saves in place while groups wait for explicit confirmation', async t => {
  const calls = []
  const { state } = mount(t, async ids => calls.push(ids), { kind:'area', value:['old'] })
  state.changeOpen(true); await vue.nextTick()
  await state.selectDraft('new')
  assert.deepEqual(calls,[['new']]); assert.equal(state.open,false)
  const groups = mount(t, async ids => calls.push(ids)).state
  groups.changeOpen(true); await vue.nextTick()
  await groups.selectDraft(['b','c'])
  assert.deepEqual(calls,[['new']]); assert.equal(groups.open,true)
  groups.changeDropdownOpen(false); await vue.nextTick()
  groups.changeOpen(true); await vue.nextTick()
  assert.deepEqual(groups.draft,['a','b'])
})

test('closing the native dropdown during a write cannot discard a failed selection', async t => {
  let reject
  const { state, props } = mount(t, () => new Promise((_, failed) => { reject=failed }), { kind:'area', value:['old'] })
  state.changeOpen(true); await vue.nextTick()
  const pending = state.selectDraft('new')
  state.changeDropdownOpen(false); state.changeOpen(false)
  assert.equal(state.open,true)
  reject(Error('temporary failure')); await pending
  assert.equal(state.dropdownOpen,true); assert.deepEqual(state.draft,['new'])
  assert.equal(state.failure,'temporary failure')
  props.allowed=false; await vue.nextTick()
  assert.equal(state.open,false)
})

test('revoked permission and empty space cannot submit, unchanged values require no request', async t => {
  const calls = []
  const { state, props } = mount(t, async ids => calls.push(ids), { kind: 'area', value: ['x'] })
  state.changeOpen(true); await vue.nextTick(); await state.submit()
  assert.deepEqual(calls, [])
  state.changeOpen(true); await vue.nextTick(); state.changeDraft([]); await state.submit()
  assert.equal(state.open, true)
  assert.match(state.failure, /selectRequired/)
  state.changeDraft('y'); props.allowed = false; await vue.nextTick(); await state.submit()
  assert.deepEqual(calls, [])
})

test('binding values loaded after opening become the initial draft', async t => {
  const { state, props } = mount(t, async () => {}, { value: [], loading: true })
  state.changeOpen(true); await vue.nextTick()
  props.value = ['bound']; props.loading = false; await vue.nextTick()
  assert.deepEqual(state.draft, ['bound'])
  state.changeDraft(['chosen']); props.value = ['refreshed']; await vue.nextTick()
  assert.deepEqual(state.draft, ['chosen'])
})

test('scope saves share pending and success feedback, reject duplicates and retain failed drafts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = []
  let fail = false
  const { state } = mount(t, async ids => { calls.push(ids); if (fail) throw Error('retry') })
  state.changeOpen(true); await vue.nextTick(); state.changeDraft(['chosen'])
  assert.equal(state.feedback, 'unsaved')
  const saved = state.submit()
  assert.equal(calls.length, 1, 'the request starts immediately')
  assert.equal(state.feedback, 'saving')
  await state.submit(); assert.equal(calls.length, 1)
  t.mock.timers.tick(500); await saved; await vue.nextTick()
  assert.equal(state.feedback, 'saved'); assert.equal(state.open, false)
  t.mock.timers.tick(2000); assert.equal(state.feedback, '')
  state.changeOpen(true); await vue.nextTick(); state.changeDraft(['retry'])
  fail = true
  const rejected = state.submit()
  t.mock.timers.tick(500); await rejected; await vue.nextTick()
  assert.equal(state.feedback, 'unsaved'); assert.deepEqual(state.draft, ['retry'])
  assert.equal(state.open, true); assert.equal(state.failure, 'retry')
  state.changeOpen(false); await vue.nextTick()
  assert.equal(state.feedback, '')
})

test('unmounting a scope editor ignores late save results', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let finish
  const props = vue.reactive({ kind:'area', value:['old'], allowed:true, disabled:false, loading:false, loadError:'', save:() => new Promise(resolve => { finish=resolve }) })
  const scope = vue.effectScope()
  const state = scope.run(() => vue.proxyRefs(useDeviceScopeCellEditing(props, () => {})))
  state.changeOpen(true); await vue.nextTick()
  const pending = state.selectDraft('new')
  scope.stop(); finish(); await pending
  assert.notEqual(state.feedback, 'saved')
})
