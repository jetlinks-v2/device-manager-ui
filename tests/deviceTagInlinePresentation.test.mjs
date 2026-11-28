import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createComponentLoader, createComponentRenderer, passthrough, flush, walk, textContent } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'
const Form = vue.defineComponent({ props: ['draft'], emits: ['close','save','update:value'], setup: (props, { emit }) => () => vue.h('tag-form', [vue.h('button', { 'aria-label': 'fill-tag', onClick: () => emit('update:value', 'Lab') }), vue.h('button', { 'aria-label': 'save-tag', onClick: () => emit('save') }), vue.h('button', { 'aria-label': 'cancel-tag', onClick: () => emit('close') })]) })
const Surface = vue.defineComponent({ props:{ open:Boolean }, setup:(props,{slots})=>()=>vue.h('surface',[slots.display?.({contentId:'tag-surface'}),props.open || !slots.display ? vue.h('surface-content',{key:'content'},slots.default?.()) : null]) })
const load = createComponentLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) }, '@jetlinks-web-core/components/DetailMetaItem': passthrough('meta'), '@jetlinks-web-core/components/InlineEditSurface': { __esModule:true, default:Surface }, './TagEditorForm.vue': Form })
const Component = load(fileURLToPath(new URL('../views/device/list/components/device-detail/tags/DeviceDetailTags.vue', import.meta.url))).default
function mount(t, extra = {}, trigger = false) {
  const saved = [], state = vue.reactive({ $t: key => key, thingModelTags: [{ key: 'location', name: 'Location', value: '' }, { key: 'count', name: 'Count', value: 0 }, { key: 'enabled', name: 'Enabled', value: false }], savingTags: false, tagsListRef: null, tagsExpanded: true, tagsOverflow: false,
    canDeviceAction: () => true, canRemoveTag: tag => tag.key === 'count', formatTagTooltipValueOnly: tag => String(tag.value ?? 'unset'), toggleTagsExpanded() {}, saveTags: async tags => { saved.push(tags); state.thingModelTags[0].value = tags[0].value; return true }, removeTag: async () => true, ...extra })
  const props=vue.reactive({state,trigger})
  const view = createComponentRenderer(), app = view.renderer.createApp({ render: () => vue.h(Component, props) })
  for (const name of ['a-popover','a-button']) app.component(name, passthrough(name))
  app.component('AIcon', vue.defineComponent({ props:['type'], setup: props => () => vue.h('icon', { type: props.type }) }))
  app.mount(view.root); t.after(() => app.unmount())
  const button = label => walk(view.root, node => node.props['aria-label'] === label)[0]
  return { state, saved, root: view.root, button, props }
}
const emptyTags = root => walk(root, node => String(node.props.class || '').split(' ').includes('device-tag--empty'))

test('unset tags are directly editable while zero and false keep the filled presentation', async t => {
  const f = mount(t)
  assert.equal(emptyTags(f.root).length, 1)
  assert.ok(textContent(f.root).includes('0')); assert.ok(textContent(f.root).includes('false'))
  const empty = walk(f.root, node => node.props['aria-label'] === 'Location: ')[0]
  empty.props.onClick(); await flush()
  assert.ok(f.button('fill-tag'))
  f.button('fill-tag').props.onClick(); f.button('save-tag').props.onClick(); await flush()
  assert.equal(f.saved[0][0].value, 'Lab'); assert.equal(emptyTags(f.root).length, 0)
})

test('failed inline save keeps the editor and draft, cancellation does not submit', async t => {
  const f = mount(t, { saveTags: async () => false })
  walk(f.root, node => node.props['aria-label'] === 'Location: ')[0].props.onClick(); await flush()
  f.button('fill-tag').props.onClick(); f.button('save-tag').props.onClick(); await flush()
  assert.ok(f.button('save-tag')); assert.equal(f.state.thingModelTags[0].value, '')
  f.button('cancel-tag').props.onClick(); await flush(); assert.equal(f.button('save-tag'), undefined)
})

test('read-only tags retain their values without dashed action affordances or clear buttons', t => {
  const f = mount(t, { canDeviceAction: () => false })
  assert.equal(emptyTags(f.root).length, 0)
  assert.equal(walk(f.root, node => node.type === 'a-button').length, 0)
  assert.ok(textContent(f.root).includes('Count')); assert.ok(textContent(f.root).includes('0'))
})

test('collection expansion and presentation changes keep the active draft without implicit submission', async t => {
  const f=mount(t,{},true)
  walk(f.root,n=>String(n.props.class||'').includes('device-tags__trigger'))[0].props.onClick(); await flush()
  walk(f.root,n=>n.props['aria-label']==='Location: ')[0].props.onClick(); await flush()
  f.button('fill-tag').props.onClick(); await flush()
  f.props.trigger=false; await flush()
  assert.ok(f.button('save-tag'))
  assert.equal(f.saved.length,0)
  f.button('save-tag').props.onClick(); await flush()
  assert.equal(f.saved[0][0].value,'Lab')
})
