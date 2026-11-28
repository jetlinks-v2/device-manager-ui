import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createComponentLoader, createComponentRenderer, passthrough, walk, textContent, flush } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

const load = createComponentLoader()
const runtime = {
  ...load(fileURLToPath(new URL('../../../jetlinks-web-core/src/components/RuntimeDiagnostics/deviceSessionPresentation.ts', import.meta.url))),
  ...load(fileURLToPath(new URL('../../../jetlinks-web-core/src/components/RuntimeDiagnostics/device-sessions/observation.ts', import.meta.url))),
}
const messages = Object.fromEntries(['zh','en','ja'].map(lang => [lang, JSON.parse(readFileSync(new URL(`../locales/lang/${lang}.json`, import.meta.url)))]))
function harness(t, lang = 'zh') {
  const clock = vue.ref(new Date()), locale = vue.ref(lang)
  const translate = (key, params = {}) => (messages[locale.value][key] || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name]))
  const componentLoad = createComponentLoader({
    'vue-i18n':{ useI18n:() => ({ t:translate, locale }) }, '@vueuse/core':{ useNow:() => clock },
    '@jetlinks-web-core/components/RuntimeDiagnostics':runtime,
    '@jetlinks-web-core/components/SkeletonText':passthrough('skeleton'),
  })
  const { useDeviceConnectionContext } = componentLoad(fileURLToPath(new URL('../components/device-detail/useDeviceConnectionContext.ts', import.meta.url)))
  const source = vue.reactive({ open:false, access:{ allowed:true }, sessions:[], history:[], state:{ status:'loading' }, paused:false })
  const status = vue.ref('online'), scope = vue.effectScope()
  const context = scope.run(() => useDeviceConnectionContext(source, () => status.value))
  t.after(() => scope.stop())
  return { source, status, clock, context, componentLoad, locale }
}
const connection = time => ({ id:'socket', metrics:{ lastCommTime:time } })

test('shared snapshot keeps real zero, unknown connections and communication distinct from session heartbeat', async t => {
  const { source, context, clock } = harness(t)
  assert.equal(context.loading.value,true)
  assert.equal(context.connections.value,undefined)
  const now = clock.value.getTime()
  source.sessions = [{ transport:'MQTT', lastCommTime:now, connections:[connection(now - 120000), connection(now - 180000)] }]
  source.state = { status:'ready', sampledAt:now }
  await flush()
  assert.equal(context.transport.value,'MQTT')
  assert.equal(context.connections.value,2)
  assert.equal(context.sessions.value,undefined)
  assert.match(context.activityText.value,/2分钟前/)
  source.sessions.push({ transport:'MQTT', lastCommTime:now })
  assert.equal(context.connections.value,undefined,'missing connection details cannot become zero or a partial total')
  assert.equal(context.sessions.value,2)
  source.sessions = []
  assert.equal(context.connections.value,0)
  assert.equal(context.activityText.value,'')
})

test('offline shows only known last communication, disabled or revoked access hides the summary', async t => {
  const { source, status, context, clock } = harness(t)
  source.sessions = [{ transport:'TCP', connections:[connection(clock.value.getTime() - 1000)] }]
  source.state = { status:'ready', sampledAt:clock.value.getTime() }
  await flush()
  assert.equal(context.activityText.value,'刚刚通信')
  status.value = 'offline'
  assert.equal(context.transport.value,'')
  assert.equal(context.connections.value,undefined)
  assert.equal(context.visible.value,true)
  status.value = 'disabled'
  assert.equal(context.visible.value,false)
  status.value = 'online'; source.access.allowed = false
  assert.equal(context.visible.value,false)
  assert.equal(context.activityText.value,'')
})

test('failed or paused samples retain their timestamp and never imply fresh communication', async t => {
  const { source, context, clock } = harness(t)
  source.sessions = [{ transport:'MQTT', connections:[connection(clock.value.getTime() - 300000)] }]
  source.state = { status:'error', sampledAt:clock.value.getTime() - 60000 }
  await flush()
  assert.equal(context.loading.value,false)
  assert.equal(context.unavailable.value,true)
  assert.match(context.activityText.value,/5分钟前/)
  assert.match(context.title.value,/刷新失败/)
  clock.value = new Date(clock.value.getTime() + 60000)
  assert.match(context.activityText.value,/6分钟前/)
  source.state.status='forbidden'
  assert.equal(context.visible.value,false)
})

test('relative labels are localized and future communication retains its absolute timestamp', async t => {
  for (const lang of ['zh','en','ja']) {
    const { source, context, clock } = harness(t,lang)
    source.sessions = [{ connections:[connection(clock.value.getTime() - 300000)] }]
    source.state = { status:'ready', sampledAt:clock.value.getTime() }
    await flush()
    assert.ok(context.activityText.value.includes('5'))
    assert.doesNotMatch(context.label.value,/undefined|IotDeviceDetail\./)
    source.sessions[0].connections[0].metrics.lastCommTime = clock.value.getTime() + 3600000
    await flush()
    assert.ok(context.activityText.value.includes(String(new Date().getFullYear())))
  }
})

test('summary is a keyboard button opening the existing observation, with loading skeletons', async t => {
  const { source, componentLoad } = harness(t)
  const Component = componentLoad(fileURLToPath(new URL('../components/device-detail/DeviceConnectionContext.vue', import.meta.url))).default
  let opened = 0, closed = 0
  const view = createComponentRenderer(), app = view.renderer.createApp({ render:() => vue.h(Component,{ observation:source,status:'online',onOpen:() => { opened++;source.open=true },onClose:() => { closed++;source.open=false } }) })
  app.component('AIcon',passthrough('icon')); app.mount(view.root); t.after(() => app.unmount())
  assert.equal(walk(view.root,node => node.type === 'skeleton').length,3)
  const button = walk(view.root,node => node.type === 'button')[0]
  assert.equal(button.props.type,'button')
  assert.ok(button.props['aria-label'])
  button.props.onClick(); assert.equal(opened,1)
  await flush(); assert.equal(button.props['aria-expanded'],true)
  button.props.onKeydown({key:'Escape',stopPropagation(){},preventDefault(){}});await flush()
  assert.equal(closed,1);assert.equal(button.props['aria-expanded'],false)
  source.state = { status:'ready',sampledAt:Date.now() }; await flush()
  assert.equal(walk(view.root,node => node.type === 'skeleton').length,0)
  assert.match(textContent(view.root),/0.*连接/)
})
