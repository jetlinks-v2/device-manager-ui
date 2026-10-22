import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const vue = require('vue'), { build } = require('esbuild')
const root = fileURLToPath(new URL('../', import.meta.url))
const group = path.join(root, 'visDashboard/DeviceDetail')
const core = path.resolve(root, '../../jetlinks-web-core/src')
const kinds = ['ActiveDuration', 'Upstream', 'Downstream', 'Traffic', 'MessageTrend', 'Properties', 'RecentAlarms']
const tick = async () => { await vue.nextTick(); await new Promise(setImmediate) }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
let code
async function bundle() {
  if (code) return code
  const imports = kinds.map(kind => `import * as ${kind} from ${JSON.stringify(path.join(group, kind, 'index.ts'))}`).join('\n')
  const result = await build({ stdin: { contents: `
    export * from ${JSON.stringify(path.join(group, 'shared.ts'))}
    export * from ${JSON.stringify(path.join(group, 'hooks/resourcePool.ts'))}
    export * from ${JSON.stringify(path.join(group, 'hooks/context.ts'))}
    export * from ${JSON.stringify(path.join(group, 'hooks/useDeviceDetailWidget.ts'))}
    export * from ${JSON.stringify(path.join(group, 'hooks/deviceDetailLayout.ts'))}
    export * from ${JSON.stringify(path.join(group, 'services/summary.ts'))}
    export * from ${JSON.stringify(path.join(group, 'services/alarms.ts'))}
    export * from ${JSON.stringify(path.join(group, 'services/properties.ts'))}
    export { loadDashboardCatalog } from ${JSON.stringify(path.join(core, 'components/DashBoardCanvas/discovery/catalog.ts'))}
    export { normalizeGridItem } from ${JSON.stringify(path.join(core, 'components/DashBoardCanvas/utils/layout.ts'))}
    ${imports}
    export const entries = { ${kinds.join(',')} }
  `, resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
    tsconfigRaw: { compilerOptions: {} }, plugins: [{ name: 'device-detail-boundaries', setup(api) {
      api.onResolve({ filter: /^vue-router$/ }, () => ({ path: 'route', namespace: 'boundary' }))
      api.onResolve({ filter: /iotDeviceDetailReal\.service$/ }, () => ({ path: 'api', namespace: 'boundary' }))
      api.onResolve({ filter: /views\/device\/alarm\/api$/ }, () => ({ path: 'levels', namespace: 'boundary' }))
      api.onResolve({ filter: /^@jetlinks-web-core\/(store\/user|utils\/project-runtime|utils\/request-context)$/ }, args => ({ path: args.path, namespace: 'boundary' }))
      api.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: args.path === 'route' ? 'export const useRoute=()=>context.route' : args.path === 'api'
        ? `export const iotDeviceDetailRealApi=context.api;export const formatApiTime=value=>value===undefined?'--':String(value);export const subscribeDeviceProperties=(...args)=>context.subscribe(...args)`
        : args.path === 'levels' ? 'export const queryDefaultAlarmLevels=()=>context.levels()'
          : args.path.endsWith('/user') ? 'export const useUserStore=()=>context.user'
            : args.path.endsWith('/project-runtime') ? 'export const getProjectCodeFromLocation=()=>context.project.value'
              : 'export const getBaseApi=()=>context.baseApi.value', loader: 'js' }))
      api.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: 'locale', namespace: 'boundary-locale' }))
      api.onLoad({ filter: /.*/, namespace: 'boundary-locale' }, () => ({ contents: `export default {global:{t:key=>key,locale:{value:'zh'}}}`, loader: 'js' }))
      api.onResolve({ filter: /\.vue$/ }, args => ({ path: args.path, namespace: 'sfc' }))
      api.onLoad({ filter: /.*/, namespace: 'sfc' }, () => ({ contents: 'export default {}', loader: 'js' }))
    } }] })
  code = result.outputFiles[0].text
  return code
}
const zero = () => ({ activeDuration: { total: 0, buckets: [] }, upstream: { total: 0, buckets: [] }, downstream: { total: 0, buckets: [] }, traffic: { total: 0, upstreamBytes: 0, downstreamBytes: 0, buckets: [] } })
async function fixture() {
  const calls = [], subscriptions = []
  const context = {
    calls, subscriptions, deviceId: vue.ref('A'), properties: vue.ref([]),
    user: vue.reactive({ userInfo: { id: 'user-a' } }), route: vue.reactive({ fullPath: '/', params: {}, query: {} }), project: vue.ref('project-a'), baseApi: vue.ref('/api'),
    api: {
      queryOverviewSummary: async data => { calls.push(['summary', data]); return { success: true, result: zero() } },
      queryAlarmByDevice: async data => { calls.push(['alarms', data]); return { result: { data: [] } } },
      getDeviceDetail: async id => { calls.push(['detail', id]); return { result: { productId: 'P', metadata: { properties: [] } } } },
      queryDashboard: async data => { calls.push(['properties', data]); return { result: [] } },
    },
    levels: async () => { calls.push(['levels']); return [{ value: 1, label: 'High' }] },
    subscribe: (...args) => { const entry = { args, disposed: false }; subscriptions.push(entry); return { unsubscribe() { entry.disposed = true } } },
  }
  const module = { exports: {} }
  Function('module', 'exports', 'require', 'context', await bundle())(module, module.exports, require, context)
  return Object.assign(context, { lib: module.exports })
}
const renderer = vue.createRenderer({
  createElement: tag => ({ tag, children: [] }), createText: text => ({ text }), createComment: text => ({ text }),
  setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text }, patchProp() {},
  parentNode: node => node.parent,
  nextSibling: node => node?.parent?.children?.[node.parent.children.indexOf(node) + 1] ?? null,
  remove(node) { const siblings = node?.parent?.children; if (siblings) { const index = siblings.indexOf(node); if (index >= 0) siblings.splice(index, 1) } },
  insert(node, parent, anchor) { parent.children ??= []; const previous = node.parent?.children; if (previous) { const i = previous.indexOf(node); if (i >= 0) previous.splice(i, 1) } node.parent = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; if (at >= 0) parent.children.splice(at, 0, node); else parent.children.push(node) },
})
function mount(context, consumers, { host = true } = {}) {
  const states = {}, edits = {}, infos = {}
  const children = consumers.map((kind, index) => ({ setup() {
    edits[index] = vue.ref(false)
    infos[index] = vue.ref({ componentProps: { [context.lib.typeOf(kind)]: { deviceId: 'standalone', refreshSeconds: 0 } } })
    states[index] = context.lib.useDeviceDetailWidget(kind, infos[index], edits[index])
    return () => null
  } }))
  const app = renderer.createApp({ setup() {
    if (host) context.lib.provideDeviceDetailContext(context.deviceId, context.properties)
    return () => children.map(child => vue.h(child))
  } })
  app.mount({ children: [] })
  return { states, edits, infos, stop: () => app.unmount() }
}

test('seven independent entries satisfy the real core discovery export contract', async () => {
  const { lib } = await fixture()
  const entries = Object.fromEntries(kinds.map(kind => [`device-manager-ui/visDashboard/DeviceDetail/${kind}`, async () => lib.entries[kind]]))
  const result = await lib.loadDashboardCatalog(new Map([['device-manager-ui', { 'visDashboard/DeviceDetail': { name: 'Device detail', directory: 'visDashboard', sort: 1, entries } }]]), { modules: ['device-manager-ui'], groups: ['device-manager-ui/visDashboard/DeviceDetail'] })
  assert.deepEqual(result.errors, [])
  assert.deepEqual(Object.keys(result.catalog.components).sort(), kinds.map(lib.typeOf).sort())
  for (const definition of Object.values(result.catalog.components)) {
    assert.equal(definition.configs.length, 1)
    assert.ok(definition.defaultConfig.componentProps[definition.defaultConfig.type])
  }
})

test('all viewport defaults have seven visible cells without overlap or empty horizontal space', async () => {
  const { lib } = await fixture()
  for (const width of [360, 640, 899, 900, 1600]) {
    const layout = lib.buildDeviceDetailLayout(width).map(({ kind, grid }) => ({ kind, ...lib.normalizeGridItem(grid, 24) }))
    assert.equal(layout.length, 7)
    for (const a of layout) for (const b of layout) if (a !== b) assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y))
    for (let y = 0; y < Math.max(...layout.map(i => i.y + i.h)); y++) assert.equal(layout.filter(i => i.y <= y && i.y + i.h > y).reduce((n, i) => n + i.w, 0), 24)
  }
})

test('five metrics consumers share one summary; host property data needs no second device query', async () => {
  const context = await fixture(), view = mount(context, kinds)
  await tick()
  assert.equal(context.calls.filter(([kind]) => kind === 'summary').length, 1)
  assert.equal(context.calls.filter(([kind]) => kind === 'alarms').length, 1)
  assert.equal(context.calls.filter(([kind]) => kind === 'levels').length, 1)
  assert.equal(context.calls.some(([kind]) => ['detail', 'properties'].includes(kind)), false)
  for (const state of Object.values(view.states)) assert.equal(state.error.value, false)
  context.properties.value = [{ id: 't', focused: true, value: '0' }, { id: 'hidden', focused: false }]
  assert.equal(view.states[5].properties.value.length, 1)
  view.stop()
})

test('switching devices discards late summary/alarms and keeps the new identity', async () => {
  const context = await fixture(), pending = []
  context.api.queryOverviewSummary = data => { const item = deferred(); pending.push({ ...item, id: data.filter.terms[0].value }); return item.promise }
  const view = mount(context, ['ActiveDuration', 'MessageTrend'])
  await tick(); context.deviceId.value = 'B'; await tick()
  assert.deepEqual(pending.map(i => i.id), ['A', 'B'])
  pending[1].resolve({ result: { ...zero(), upstream: { total: 8, buckets: [] } } }); await tick()
  pending[0].resolve({ result: { ...zero(), upstream: { total: 999, buckets: [] } } }); await tick()
  assert.equal(view.states[0].summary.value.upstream.total, 8)
  assert.equal(view.states[1].summary.value.upstream.total, 8)
  assert.equal(view.states[0].deviceId.value, 'B')
  view.stop()
})

test('account/project changes clear old data, and zero data differs from failure and retry', async () => {
  const context = await fixture(), view = mount(context, ['Upstream'])
  await tick(); assert.equal(view.states[0].summary.value.upstream.total, 0)
  context.api.queryOverviewSummary = async () => { throw Error('HTTP 403') }
  context.project.value = 'project-b'; await tick()
  assert.equal(view.states[0].error.value, true)
  assert.equal(view.states[0].summary.value, undefined)
  context.api.queryOverviewSummary = async () => ({ result: zero() })
  await view.states[0].retry(); await tick()
  assert.equal(view.states[0].error.value, false)
  assert.equal(view.states[0].summary.value.upstream.total, 0)
  context.user.userInfo.id = 'user-b'; await tick()
  assert.equal(view.states[0].loading.value, false)
  view.stop()
})

test('preview and missing device make no requests and preview does not open property subscriptions', async () => {
  const context = await fixture(); context.deviceId.value = ''
  const view = mount(context, kinds)
  await tick(); assert.equal(context.calls.length, 0)
  for (const edit of Object.values(view.edits)) edit.value = true
  await tick(); assert.equal(context.calls.length, 0)
  assert.equal(view.states[0].summary.value.upstream.total > 0, true)
  assert.equal(view.states[5].properties.value.length, 1)
  assert.equal(context.subscriptions.length, 0)
  view.stop()
})

test('standalone properties load only focused definitions, preserve zero and subscribe once for repeated updates', async () => {
  const context = await fixture()
  context.api.getDeviceDetail = async () => ({ result: { productId: 'P', productMetadata: { properties: [
    { id: 'temperature', name: 'Temperature', valueType: { type: 'double', unit: { symbol: '℃' } }, expands: { isKeyMetric: true } }, { id: 'hidden' },
  ] } } })
  context.api.queryDashboard = async () => ({ result: [{ data: { value: { property: 'temperature', value: 0 }, timestamp: 1 } }] })
  const view = mount(context, ['Properties'], { host: false })
  await tick(); assert.equal(view.states[0].properties.value.length, 1)
  assert.equal(view.states[0].properties.value[0].value, '0')
  assert.equal(view.states[0].properties.value[0].unit, '℃')
  assert.equal(context.subscriptions.length, 1)
  context.subscriptions[0].args[3]({ property: 'temperature', value: 12, timestamp: 2 }); await tick()
  context.subscriptions[0].args[3]({ property: 'temperature', value: 13, timestamp: 3 }); await tick()
  assert.equal(view.states[0].properties.value[0].value, '13')
  assert.equal(context.subscriptions.length, 1)
  view.stop(); assert.equal(context.subscriptions[0].disposed, true)
})

test('alarm query preserves source device and maps enum levels without duplicate initial requests', async () => {
  const context = await fixture()
  context.api.queryAlarmByDevice = async data => { context.calls.push(['alarms', data]); return { result: { data: [{ id: 'one', alarmName: 'Temperature', alarmTime: 1000, handleTime: 61000, level: { value: 1, text: 'Level one' }, state: { value: 'normal' } }] } } }
  const rows = await context.lib.loadAlarms('device-A', 4)
  assert.equal(rows[0].level, 'High'); assert.equal(rows[0].duration, '1.0 min')
  const query = context.calls.find(([kind]) => kind === 'alarms')[1]
  assert.deepEqual(query.terms[0].terms, [{ column: 'sourceId', value: 'device-A', termType: 'eq' }, { column: 'targetType', value: 'device', termType: 'eq' }])
})

test('summary request keeps natural day, device filter, zero and existing duration data', async () => {
  const { lib } = await fixture()
  const query = lib.buildSummaryParams('device-A', require('dayjs')('2026-10-22T12:00:00'))
  assert.equal(query.limit, 24); assert.equal(query.groupByTime.interval, '1h')
  assert.equal(query.filter.terms[0].value, 'device-A')
  assert.equal(Number(query.groupByTime.to.split('.')[0]) - Number(query.groupByTime.from.split('.')[0]), 86400000 - 1)
  assert.equal(lib.normalizeSummary({ result: { ...zero(), activeDuration: { total: 9425400000 } } }).activeDuration.total, 9425400000)
  assert.throws(() => lib.normalizeSummary({ success: false, result: zero() }))
  assert.throws(() => lib.normalizeSummary({ result: {} }))
})

test('last consumer releases polling and ignores pending results after teardown', async () => {
  const { lib } = await fixture(), pool = lib.createResourcePool(), pending = deferred()
  const results = []; const stop = pool.subscribe('A', 0, () => pending.promise, value => results.push(value))
  await tick(); stop(); pending.resolve(12); await tick()
  assert.equal(results.some(item => item.data === 12), false)
  pool.dispose()
})
