import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { createComponentLoader, createComponentRenderer, textContent, walk } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

test('shared action groups preserve confirmation, permissions and the legacy inline presentation', async t => {
  let closed = 0
  const Group = defineComponent({ setup: (_, { slots }) => () => h('action-group', [slots.trigger?.({ open: false }), slots.default?.()]) })
  const Item = defineComponent({ setup: (_, { slots }) => () => h('action-item', slots.default?.({ close: () => closed++ })) })
  const load = createComponentLoader({
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web-core/components/TableActions': { __esModule:true, default: Group, TableActionsItem: Item },
  })
  const Actions = load('../../modules/device-manager-ui/views/device/list/components/device-detail/DeviceDetailActions.vue').default
  const props = reactive({ name:'Device', compact:true, disabled:true, busyAction:'', permissions:{update:true,action:true,delete:true} })
  const events = []
  const view = createComponentRenderer()
  const app = view.renderer.createApp({ render: () => h(Actions, { ...props, onToggle: () => events.push('toggle'), onEdit: () => events.push('edit') }) })
  app.component('a-button', { props:['disabled','type'], setup: (p,{slots}) => () => h('button',{disabled:p.disabled,'data-type':p.type},slots.default?.()) })
  app.component('a-popconfirm', { setup: (_,{slots}) => () => h('confirmation',slots.default?.()) })
  app.component('AIcon', { render: () => h('i') })
  app.mount(view.root); t.after(() => app.unmount())
  assert.equal(walk(view.root,n=>n.type==='action-group').length,1)
  assert.equal(walk(view.root,n=>n.type==='action-item').length,3)
  assert.deepEqual(events,[])
  walk(view.root,n=>n.type==='confirmation')[0].props.onConfirm()
  assert.deepEqual(events,['toggle']); assert.equal(closed,1)
  props.busyAction='toggle'; await nextTick()
  assert.ok(walk(view.root,n=>n.type==='button').every(n=>n.props.disabled))
  props.compact=false; props.busyAction=''; await nextTick()
  assert.equal(walk(view.root,n=>n.type==='action-group').length,0)
  assert.ok(walk(view.root,n=>n.type==='button').every(n=>n.props['data-type']==='default'))
  props.permissions={update:false,action:false,delete:false}; await nextTick()
  assert.equal(walk(view.root,n=>n.type==='button').length,0)
})

test('metadata editing moves out of management while provider settings keep their own icon and permissions', async t => {
  const Group = defineComponent({ setup: (_, { slots }) => () => h('action-group', [slots.trigger?.({ open: false }), slots.default?.()]) })
  const Item = defineComponent({ props:{separated:Boolean}, setup: (p, { slots }) => () => h('action-item', { separated:p.separated }, slots.default?.({ close() {} })) })
  const load = createComponentLoader({
    'vue-i18n': { useI18n: () => ({ t:key => key }) },
    '@jetlinks-web-core/components/TableActions': { __esModule:true, default:Group, TableActionsItem:Item },
  })
  const Actions = load('../../modules/device-manager-ui/views/device/list/components/device-detail/DeviceDetailActions.vue').default
  const props = reactive({ name:'Device', compact:true, disabled:false, busyAction:'', editMode:'hidden', permissions:{update:true,action:true,delete:true} })
  let edited=0
  const view=createComponentRenderer()
  const app=view.renderer.createApp({render:()=>h(Actions,{...props,onEdit:()=>edited++},{more:()=>h('button','Open web interface')})})
  app.component('a-button',{props:['disabled'],setup:(p,{slots})=>()=>h('button',{disabled:p.disabled},[slots.icon?.(),slots.default?.()])})
  app.component('a-popconfirm',{setup:(_,{slots})=>()=>h('confirmation',slots.default?.())})
  app.component('AIcon',{props:['type'],setup:p=>()=>h('i',{'data-icon':p.type})})
  app.mount(view.root);t.after(()=>app.unmount())
  let items=walk(view.root,n=>n.type==='action-item')
  assert.deepEqual(items.map(n=>textContent(n).trim()),['Open web interface','IotDeviceDetail.detail.disable','IotDeviceDetail.detail.delete'])
  assert.deepEqual(items.map(n=>n.props.separated),[false,true,true])
  assert.equal(walk(items[2],n=>n.type==='button')[0].props.disabled,true)
  props.editMode='settings';await nextTick()
  items=walk(view.root,n=>n.type==='action-item')
  assert.equal(textContent(items[1]).trim(),'IotDeviceDetail.header.accessSettings')
  assert.ok(walk(items[1],n=>n.props['data-icon']==='SettingOutlined').length)
  walk(items[1],n=>n.type==='button')[0].props.onClick();assert.equal(edited,1)
  props.disabled=true;await nextTick()
  assert.ok(walk(view.root,n=>n.props['data-icon']==='CheckCircleOutlined').length)
  props.permissions.update=false;props.permissions.action=false;await nextTick()
  items=walk(view.root,n=>n.type==='action-item')
  assert.deepEqual(items.map(n=>textContent(n).trim()),['Open web interface','IotDeviceDetail.detail.delete'])
  assert.equal(edited,1)
})
