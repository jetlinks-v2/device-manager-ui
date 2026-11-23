import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { computed, effectScope, reactive, ref, unref, watch } from 'vue'
import { groupBy, throttle, toArray } from 'lodash-es'
import { Subject } from 'rxjs'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const filename = '../views/device/Instance/Detail/Running/Property/index.vue'
const raw = readFileSync(new URL(filename, import.meta.url), 'utf8')
const { descriptor, errors } = parse(raw, { filename })
assert.deepEqual(errors, [])
// Compile the complete production SFC as well as executing its request/lifecycle declarations below.
const compiled = compileScript(descriptor, { id: 'device-property-subscription' })
transformSync(compiled.content, { loader: 'ts' })
const source = ts.createSourceFile(filename, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
const names = new Set(['disposed', 'dashboardRequest', 'messageCache', 'valueChange', 'throttleFn', 'getDashboard'])
const selected = source.statements.filter(node =>
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => names.has(item.name.getText(source))))
  || (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
    && (node.expression.expression.getText(source) === 'onUnmounted'
      || (node.expression.expression.getText(source) === 'watch' && node.getText(source).includes('dashboardRequest')))),
)
const { code } = transformSync(selected.map(node => node.getText(source)).join('\n'), { loader: 'ts' })
const script = new vm.Script(`(() => { ${code}; return { getDashboard } })()`)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const ok = value => ({ status: 200, result: [{ data: { value: { property: 'temperature', value }, timestamp: 1 } }] })

function fixture(t) {
  const requests = [], subscriptions = [], scope = effectScope()
  let unmount
  const context = {
    instanceStore: reactive({ current: { id: 'device-a', productId: 'product-a' } }),
    dataSource: ref([{ id: 'temperature' }]), propertyValue: ref({}), loading: ref(false), subRef: ref(),
    unref, groupBy, throttle, toArray, watch,
    onUnmounted: callback => { unmount = callback },
    dashboard(params) { const pending = deferred(); requests.push({ params, ...pending }); return pending.promise },
    subscribeDeviceProperties(...args) {
      const entry = { args, closed: false }; subscriptions.push(entry)
      return { unsubscribe() { entry.closed = true } }
    },
  }
  const api = scope.run(() => script.runInNewContext(context))
  const dispose = () => { unmount(); scope.stop() }
  t.after(dispose)
  return { context, api, requests, subscriptions, dispose }
}

test('a snapshot arriving after switching to device access cannot recreate a subscription', async t => {
  const f = fixture(t), pending = f.api.getDashboard()
  f.dispose()
  f.requests[0].resolve(ok(9))
  await pending
  assert.equal(f.subscriptions.length, 0)
  assert.equal(Object.keys(f.context.propertyValue.value).length, 0)
})

test('changing shared device identity invalidates in-flight queries and releases existing subscriptions', async t => {
  const f = fixture(t)
  const first = f.api.getDashboard(); f.requests[0].resolve(ok(1)); await first
  assert.equal(f.subscriptions.length, 1)
  f.context.instanceStore.current = { id: 'device-b', productId: 'product-b' }
  assert.equal(f.subscriptions[0].closed, true)
  assert.equal(Object.keys(f.context.propertyValue.value).length, 0)
  const pending = f.api.getDashboard()
  f.context.instanceStore.current.id = 'device-c'
  assert.equal(f.context.loading.value, false)
  f.requests[1].resolve(ok(2)); await pending
  assert.equal(f.subscriptions.length, 1)
})

test('rapid pagination subscribes only to the latest property list and preserves live values', async t => {
  const f = fixture(t), older = f.api.getDashboard()
  f.context.dataSource.value = [{ id: 'humidity' }]
  const newer = f.api.getDashboard()
  f.requests[1].resolve({ status: 200, result: [] }); await newer
  f.requests[0].resolve(ok(99)); await older
  assert.equal(f.subscriptions.length, 1)
  assert.deepEqual(Array.from(f.subscriptions[0].args[2]), ['humidity'])
  f.subscriptions[0].args[3]({ property: 'humidity', value: 0, timestamp: 123 })
  assert.equal(f.context.propertyValue.value.humidity.value, 0)
  assert.equal(f.context.propertyValue.value.humidity.timestamp, 123)
  assert.equal(f.context.propertyValue.value.temperature, undefined)
})

test('failed snapshots never create a second forbidden websocket request', async t => {
  const f = fixture(t), forbidden = f.api.getDashboard()
  f.requests[0].resolve({ status: 403 }); await forbidden
  assert.equal(f.context.loading.value, false)
  const failed = f.api.getDashboard()
  f.requests[1].reject(new Error('request failed'))
  await assert.rejects(failed, /request failed/)
  assert.equal(f.context.loading.value, false)
  assert.equal(f.subscriptions.length, 0)
})

test('incomplete device definitions and empty property pages make no requests', async t => {
  const f = fixture(t)
  for (const [id, productId, properties] of [['', 'p', ['a']], ['d', '', ['a']], ['d', 'p', []]]) {
    f.context.instanceStore.current = { id, productId }
    f.context.dataSource.value = properties.map(id => ({ id }))
    await f.api.getDashboard()
  }
  assert.equal(f.requests.length, 0)
  assert.equal(f.subscriptions.length, 0)
})

test('shared property subscription uses the product topic and the device permission parameter', () => {
  const calls = [], stream = new Subject()
  const modules = runtimeModules({
    '@jetlinks-web/core': { request: {}, wsClient: { getWebSocket(...args) { calls.push(args); return stream } } },
    '@jetlinks-web/utils': { randomString: () => 'test' },
    '@device-manager-ui/api/deviceListDefaultTerms': { withIotDeviceListDefaultTerms: value => value },
  })
  const { subscribeDeviceProperties } = modules.load('views/device/list/services/iotDeviceDetailReal.service.ts')
  assert.equal(subscribeDeviceProperties('device', '', ['a'], () => {}), undefined)
  assert.equal(subscribeDeviceProperties('', 'product', ['a'], () => {}), undefined)
  assert.equal(subscribeDeviceProperties('device', 'product', [], () => {}), undefined)
  assert.equal(calls.length, 0)
  const values = []
  const sub = subscribeDeviceProperties('device', 'product', ['a'], value => values.push(value))
  assert.equal(calls[0][1], '/dashboard/device/product/properties/realTime')
  assert.equal(calls[0][2].deviceId, 'device')
  stream.next({ payload: { value: { property: 'a', value: 0 }, timestamp: 123 } })
  assert.equal(values[0].value, 0)
  assert.equal(values[0].timestamp, 123)
  sub.unsubscribe()
  assert.equal(stream.observed, false)
})

test('only overview and property tabs consume realtime properties', () => {
  const path = '../views/device/list/hooks/useIotDeviceDetailView.ts'
  const hookSource = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const hook = hookSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'useIotDeviceDetailView')
  const declaration = hook.body.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(item => item.name.getText(hookSource) === 'activeRealtimePropertyKeys'))
  const context = { computed, activeTab: ref('overview'), dataInnerTab: ref('property'),
    overviewRealtimePropertyKeys: ref(['focused']), propertyPageRealtimeKeys: ref(['visible']), realtimePropertyKeys: ref(['all']) }
  const result = vm.runInNewContext(`${transformSync(declaration.getText(hookSource), { loader: 'ts' }).code}; activeRealtimePropertyKeys`, context)
  assert.deepEqual(Array.from(result.value), ['focused'])
  context.activeTab.value = 'data'
  assert.deepEqual(Array.from(result.value), ['visible'])
  context.dataInnerTab.value = 'event'
  assert.deepEqual(Array.from(result.value), [])
  for (const tab of ['access', 'logs', 'alarm', 'thing-model', 'commands', 'property-rules']) {
    context.activeTab.value = tab
    assert.deepEqual(Array.from(result.value), [], tab)
  }
})
