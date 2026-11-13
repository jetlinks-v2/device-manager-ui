import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
function load(file, dependencies, component = false) {
  const filename = new URL(file, import.meta.url).pathname
  let source = readFileSync(filename, 'utf8')
  if (component) source = compileScript(parse(source, { filename }).descriptor, { id: 'property-focus', inlineTemplate: true }).content
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(
    id => dependencies[id] ?? require(id), module, module.exports)
  return module.exports
}
const requestModule = load('../../../jetlinks-web-core/src/data-capability/request.ts', { vue })
const apiModule = load('../../../jetlinks-web-core/src/object-capability/api.ts', { '../data-capability/request': requestModule })
const component = load('../components/ObjectPropertyFocus.vue', {
  vue,
  'vue-i18n': { useI18n: () => ({ t: key => key }) },
  '@jetlinks-web-core/object-capability/api': apiModule,
  '@jetlinks-web-core/data-capability/request': requestModule,
}, true).default
const flush = async () => { await new Promise(setImmediate); await vue.nextTick() }
const models = fields => [{ providerId: 'device', metadata: { properties: [{ id: 'name' }] } },
  { providerId: 'device-data', metadata: { properties: fields } }]
const identity = id => [{ property: 'productId', value: id, providerId: 'device' }]
const success = result => ({ status: 200, result })
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

// 使用真实 SFC 和通用 API，替换的仅是父级请求客户端与基础控件。
function mount(t, respond) {
  const calls = [], changes = []
  const props = vue.reactive({ subject: { typeId: 'device', id: 'D/1' }, parameters: { keep: true }, disabled: false })
  let select, alert, change
  const client = Object.fromEntries(['get', 'post'].map(method => [method, (url, body, options) => {
    const call = { method, url, body, options }; calls.push(call)
    return Promise.resolve(respond(call))
  }]))
  const node = () => ({ children: [], parent: null })
  const renderer = vue.createRenderer({
    createElement: node, createText: node, createComment: node,
    insert(child, parent, anchor) {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
      child.parent = parent
      const at = anchor ? parent.children.indexOf(anchor) : -1
      at < 0 ? parent.children.push(child) : parent.children.splice(at, 0, child)
    },
    remove(child) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null },
    setText() {}, setElementText() {}, patchProp() {}, parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  })
  const app = renderer.createApp({ setup: () => () => vue.h(component, { ...props, onChange: value => changes.push(value) }) })
  app.provide(requestModule.dataCapabilityRequestKey, client)
  app.component('ASelect', { props: ['value', 'options', 'loading', 'disabled'], emits: ['change'], setup(p, { emit }) {
    select = p; change = value => emit('change', value)
    return () => vue.h('select')
  } })
  app.component('AAlert', { props: ['message'], setup(p) { alert = p; vue.onUnmounted(() => { alert = undefined }); return () => vue.h('alert') } })
  app.mount(node()); t.after(() => app.unmount())
  return { calls, changes, props, get select() { return select }, get alert() { return alert }, change: value => change(value), unmount: () => app.unmount() }
}

test('uses the authorized instance model and original product identity, preserving scope and the eight-field limit', async t => {
  const h = mount(t, call => success(call.method === 'get'
    ? models([{ id: 'temperature', name: '温度' }, { id: 'derivedPower' }]) : identity('P1')))
  assert.equal(h.select.disabled, true)
  await flush()
  assert.deepEqual(h.calls.map(call => [call.method, call.url]), [
    ['get', '/relation/objects/device/D%2F1/providers'], ['post', '/relation/objects/device/D%2F1/properties/_query'],
  ])
  assert.deepEqual(h.calls[1].body, { keys: ['productId'] })
  assert.deepEqual(h.calls[1].options.params, { providerId: 'device' })
  assert.deepEqual(h.select.options, [{ value: 'temperature', label: '温度' }, { value: 'derivedPower', label: 'derivedPower' }])
  assert.equal(h.select.disabled, false)
  const keys = Array.from({ length: 9 }, (_, i) => `field${i}`)
  h.change(keys)
  assert.deepEqual(h.changes, [{ keep: true, properties: keys.slice(0, 8), productIds: ['P1'] }])
  h.props.disabled = true; await flush(); h.change(['temperature'])
  assert.equal(h.changes.length, 1)
})

test('switching objects cancels both old reads and ignores their late responses', async t => {
  const old = deferred()
  const h = mount(t, call => call.url.includes('D%2F1') ? old.promise
    : success(call.method === 'get' ? models([{ id: 'newField' }]) : identity('P2')))
  h.props.subject = { typeId: 'device', id: 'D2' }; await flush()
  assert.ok(h.calls.slice(0, 2).every(call => call.options.signal.aborted))
  old.resolve(success([])); await flush()
  assert.deepEqual(h.select.options, [{ value: 'newField', label: 'newField' }])
  assert.equal(h.alert, undefined)
  h.change(['newField'])
  assert.deepEqual(h.changes[0].productIds, ['P2'])
  h.props.subject = undefined; await flush()
  assert.equal(h.select.disabled, true)
  assert.deepEqual(h.select.options, [])
})

test('a rejected model or unreadable product identity cannot submit an unscoped query', async t => {
  for (const mode of ['denied', 'missing-model', 'missing-product']) {
    await t.test(mode, async t => {
      const h = mount(t, call => call.method === 'get'
        ? mode === 'denied' ? { status: 403, message: 'source-denied' } : success(mode === 'missing-model' ? [] : models([]))
        : success(mode === 'missing-product' ? [] : identity('P1')))
      await flush()
      assert.equal(h.select.disabled, true)
      assert.ok(h.alert.message)
      h.change(['temperature']); assert.deepEqual(h.changes, [])
    })
  }
})

test('an empty readable model is valid and unmount aborts pending requests', async t => {
  const h = mount(t, call => success(call.method === 'get' ? models([]) : identity('P1')))
  await flush()
  assert.equal(h.alert, undefined)
  assert.deepEqual(h.select.options, [])
  const pending = deferred(), other = mount(t, () => pending.promise)
  other.unmount()
  assert.ok(other.calls.every(call => call.options.signal.aborted))
  pending.resolve(success([])); await flush()
  assert.deepEqual(other.changes, [])
})
