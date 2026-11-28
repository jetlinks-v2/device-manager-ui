import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as vue from 'vue'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createComponentRenderer } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

function mount(t, save, extra = {}) {
  const source = readFileSync(new URL('../components/IotDeviceScopeCell.vue', import.meta.url), 'utf8')
  const script = compileScript(parse(source).descriptor, { id: 'scope-cell' }).content
  const module = { exports: {} }
  const code = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('require', 'module', 'exports', code)(id => id === 'vue' ? vue : id.includes('DetailMetaItem') ? { detailMetaIcons: {} } : { useI18n: () => ({ t: key => key }) }, module, module.exports)
  const Component = module.exports.default
  Component.render = () => null
  const props = vue.reactive({ kind: 'group', value: ['a', 'b'], text: 'A、B', options: [], allowed: true, disabled: false, loading: false, loadError: '', save, ...extra })
  const view = createComponentRenderer(), app = view.renderer.createApp({ setup: () => () => vue.h(Component, props) })
  app.mount(view.root); t.after(() => app.unmount())
  return { state: app._instance.subTree.component.setupState, props }
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
