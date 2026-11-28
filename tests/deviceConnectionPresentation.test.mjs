import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { createComponentLoader, createComponentRenderer, passthrough, flush, walk, textContent } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

const presentation = createComponentLoader()(fileURLToPath(new URL('../../../jetlinks-web-core/src/components/RuntimeDiagnostics/deviceSessionPresentation.ts', import.meta.url)))
function statusComponent(clock = vue.ref(new Date())) {
  return createComponentLoader({
    'vue-i18n': { useI18n: () => ({ t: (key, params = {}) => `${key} ${params.duration || params.time || ''}`, locale: vue.ref('en') }) },
    '@vueuse/core': { createReusableTemplate, useNow: () => clock },
    '@jetlinks-web-core/components/RuntimeDiagnostics': presentation,
    './DeviceConnectionPanel.vue': passthrough('observation-body'),
    '@jetlinks-web-core/components/StatusTag/index.vue': passthrough('status'),
    '@jetlinks-web-core/components/JlDrawerShell/index.vue': passthrough('retained-drawer'),
  })(fileURLToPath(new URL('../components/device-detail/DeviceConnectionStatus.vue', import.meta.url))).default
}

test('popover and retained drawer slots mount one observation body across responsive changes', async t => {
  const state = vue.reactive({ open: false, narrow: false, paused: false, interval: 2, sessions: [], history: [], state: { status: 'ready' }, access: { allowed: true }, requesting: false, collecting: false, refresh() {} })
  const Component = statusComponent()
  const view = createComponentRenderer(), app = view.renderer.createApp({ render: () => vue.h(Component, { observation: state, deviceId: 'a', status: 'online', label: 'Online' }) })
  app.component('a-popover', passthrough('retained-popover'))
  app.mount(view.root); t.after(() => app.unmount())
  const bodies = () => walk(view.root, node => node.type === 'observation-body')
  assert.equal(bodies().length, 0)
  state.open = true; await flush(); assert.equal(bodies().length, 1)
  state.narrow = true; await flush(); assert.equal(bodies().length, 1)
  state.narrow = false; await flush(); assert.equal(bodies().length, 1)
  state.open = false; await flush(); assert.equal(bodies().length, 0)
})

test('online/offline ages update locally, while disabled, missing and future times stay absent', async t => {
  const now = Date.now(), clock = vue.ref(new Date(now)), Component = statusComponent(clock)
  const observation = vue.reactive({ open: false, narrow: false, paused: false, interval: 2, sessions: [], history: [], state: { status: 'ready' }, access: { allowed: true }, requesting: false, collecting: false, refresh() {} })
  const props = vue.reactive({ observation, deviceId: 'a', status: 'online', label: 'Online', onlineAt: now - 10800000, offlineAt: undefined })
  const view = createComponentRenderer(), app = view.renderer.createApp({ render: () => vue.h(Component, props) })
  app.component('a-popover', passthrough('retained-popover'))
  app.mount(view.root); t.after(() => app.unmount())
  const age = () => walk(view.root, node => node.props.class === 'device-detail-connection__duration').map(textContent).join('')
  assert.equal(age(), '3h')
  props.status = 'offline'; props.label = 'Offline'; props.offlineAt = now - 120000
  await flush(); assert.equal(age(), '2m')
  clock.value = new Date(now + 60000); await flush(); assert.equal(age(), '3m')
  props.status = 'disabled'; await flush(); assert.equal(age(), '')
  props.status = 'offline'; props.offlineAt = undefined; await flush(); assert.equal(age(), '')
  props.offlineAt = now + 3600000; await flush(); assert.equal(age(), '')
  assert.equal(observation.open, false)
})

test('closing shared observation returns to its actual opener, falling back when that opener is hidden', async t => {
  const state=vue.reactive({open:false,narrow:false,paused:false,interval:2,sessions:[],history:[],state:{status:'ready'},access:{allowed:true},requesting:false,collecting:false,refresh(){}})
  const Component=statusComponent(),view=createComponentRenderer(),app=view.renderer.createApp({render:()=>vue.h(Component,{observation:state,deviceId:'a',status:'online',label:'Online'})})
  app.component('a-popover',passthrough('retained-popover'));app.mount(view.root);t.after(()=>app.unmount())
  let focused='',visible=true
  const opener={isConnected:true,getClientRects:()=>visible?[{}]:[],focus:()=>focused='context'}
  const trigger=walk(view.root,node=>node.type==='button'&&node.props.class==='device-detail-connection')[0]
  trigger.ownerDocument={activeElement:opener};trigger.focus=()=>focused='status'
  state.open=true;await flush()
  walk(view.root,node=>node.type==='observation-body')[0].props.onClose();await flush()
  assert.equal(focused,'context')
  visible=false;state.open=true;await flush()
  walk(view.root,node=>node.type==='observation-body')[0].props.onClose();await flush()
  assert.equal(focused,'status')
})
