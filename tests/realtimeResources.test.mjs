import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript, compileStyleAsync } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
const group = path.join(root, 'visDashboard/SystemMonitor')
const locales = Object.fromEntries(['zh', 'en'].map(locale => [locale, JSON.parse(readFileSync(path.join(root, 'locales/lang', locale + '.json'), 'utf8'))]))
const built = await build({
  stdin: { contents: `
    export { default as View } from ${JSON.stringify(path.join(group, 'RealtimeResources/RealtimeResources.vue'))};
    export { provideSystemMonitorRuntime } from ${JSON.stringify(path.join(group, 'hooks/useSystemMonitorRuntime.ts'))};
    export { normalizeRealtimeNodes, sortRealtimeNodes } from ${JSON.stringify(path.join(group, 'utils/realtimeResourceData.ts'))};
  `, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', external: ['vue'],
  plugins: [{ name: 'realtime-resource-io-boundaries', setup(plugin) {
    plugin.onResolve({ filter: /^vue-i18n$/ }, () => ({ path: 'locale', namespace: 'fixture' }))
    plugin.onResolve({ filter: /^@jetlinks-web\/core$/ }, () => ({ path: 'io', namespace: 'fixture' }))
    plugin.onResolve({ filter: /^@jetlinks-web-core\/components\/CloudEmpty/ }, () => ({ path: 'empty', namespace: 'fixture' }))
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'locale'
      ? 'export const useI18n=()=>({t:context.t})'
      : args.path === 'empty' ? 'import {h} from "vue"; export default {props:["description"],setup:(props,{slots})=>()=>h("section",{},[props.description,slots.default?.()])}'
        : 'export const wsClient={getWebSocket(){throw new Error("Unexpected standalone subscription")}}; export const request={post(){throw new Error("Unexpected HTTP")}};' }))
    plugin.onLoad({ filter: /\.vue$/ }, async args => {
      const { descriptor, errors } = parse(readFileSync(args.path, 'utf8'), { filename: args.path })
      assert.deepEqual(errors, [])
      for (const style of descriptor.styles) {
        const source = style.src ? readFileSync(path.resolve(path.dirname(args.path), style.src), 'utf8') : style.content
        const result = await compileStyleAsync({ source, filename: args.path, id: args.path, scoped: !!style.scoped, preprocessLang: style.lang })
        assert.deepEqual(result.errors, [], args.path)
      }
      const compiled = compileScript(descriptor, { id: args.path, inlineTemplate: true })
      // The production app auto-imports computed for the pre-existing health badge.
      return { loader: 'ts', contents: (args.path.endsWith('/NodeHealthStatus.vue') ? 'import {computed} from "vue";\n' : '') + compiled.content }
    })
  } }],
})

function node(type = 'root', text = '') { return { type, text, props: {}, children: [], parent: null } }
const renderer = vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (el, text) => { el.text = text }, setElementText: (el, text) => { el.text = text; el.children = [] },
  patchProp: (el, key, _old, value) => { el.props[key] = value },
  parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(el); else parent.children.splice(index, 0, el)
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null },
})
const descendants = el => [el, ...el.children.flatMap(descendants)]
const textOf = el => el.type === '#comment' ? '' : el.text + el.children.map(textOf).join('')
const hasClass = (el, name) => String(el.props.class ?? '').split(' ').includes(name)
function fixture(t, locale = 'zh') {
  const calls = { subscribe: 0, released: 0 }, observers = []
  const translate = (key, params = []) => (locales[locale][key] ?? key).replace(/\{(\d+)\}/g, (_, n) => String(params[n]))
  const context = { t: translate }, module = { exports: {} }
  new Function('require', 'module', 'exports', 'context', built.outputFiles[0].text)(require, module, module.exports, context)
  const api = module.exports
  let runtime
  const app = renderer.createApp({ setup() {
    runtime = api.provideSystemMonitorRuntime({ subscribe(observer) { calls.subscribe++; observers.push(observer); return { unsubscribe() { calls.released++ } } }, storage: { getItem: () => null, setItem() {} } })
    return () => vue.h(api.View)
  } })
  const wrapper = tag => ({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
  app.component('a-card', { setup: (_props, { attrs, slots }) => () => vue.h('div', attrs, [vue.h('div', { class: 'ant-card-body' }, slots.default?.())]) })
  app.component('a-button', wrapper('button'))
  app.component('a-tooltip', { props: ['title'], setup: (_props, { slots }) => () => slots.default?.() })
  app.component('a-progress', { props: ['percent', 'showInfo', 'strokeColor', 'strokeWidth'], setup: props => () => vue.h('span', { 'data-progress': props.percent }) })
  app.component('a-tag', wrapper('span')); app.component('a-spin', () => vue.h('span', { 'data-loading': true }))
  app.component('AIcon', () => vue.h('i'))
  app.component('j-ellipsis', wrapper('span'))
  app.config.globalProperties.$t = translate
  const host = node(); app.mount(host)
  t.after(() => app.unmount())
  const all = predicate => descendants(host).filter(predicate)
  const first = predicate => { const result = all(predicate)[0]; assert.ok(result, 'Expected rendered element'); return result }
  const row = id => first(el => el.props['data-node-id'] === id)
  return { api, runtime, calls, host, all, first, row, translate,
    async sample(items) { observers.at(-1).next(items); await vue.nextTick() },
    async fail() { observers.at(-1).error(); await vue.nextTick() },
    async click(label) { first(el => el.type === 'button' && (el.props['aria-label'] === label || textOf(el).trim() === label)).props.onClick(); await vue.nextTick() },
  }
}
const sample = (id, cpu, memory, connections) => ({
  clusterNodeId: id,
  value: {
    cpu: { systemUsage: 2, jvmUsage: cpu, logicalProcessorCount: 4, loadAverage1m: 0.4, loadAverage5m: 0.3, loadAverage15m: 0.2 },
    memory: { systemUsage: 80, systemTotal: 16384, jvmHeapUsage: memory, jvmHeapTotal: 1024, jvmNonHeapTotal: 300, jvmNonHeapFree: 70 },
    disk: { usage: 78, total: 102400 },
    network: { tcpMetricsAvailable: connections !== undefined, tcpConnectionsEstablished: connections },
  },
})

test('production view renders the seven explicit columns, real capacities and zero values in both languages', async t => {
  for (const locale of ['zh', 'en']) await t.test(locale, async t => {
    const f = fixture(t, locale)
    await f.sample([sample('rule-engine-service:7300', 0, 20, 0)])
    const headings = f.all(el => el.type === 'th').map(el => textOf(el).trim())
    assert.deepEqual(headings.slice(0, 7), ['serviceNode', 'cpuJvm', 'heapColumn', 'cpuSystem', 'systemMemoryColumn', 'systemDiskColumn', 'tcpColumn'].map(key => f.translate('components.RealtimeResource.' + key)))
    const row = f.row('rule-engine-service:7300')
    assert.match(textOf(row), /rule-engine-service:7300/)
    const identity = f.first(el => el.type === 'button' && el.props['aria-label'] === 'rule-engine-service:7300')
    assert.match(textOf(identity).replace(/\s+/g, ''), /^rule-engine-service:7300$/)
    assert.equal(f.first(el => hasClass(el, 'realtime-resource__port')).parent, identity)
    assert.match(textOf(row), /204.8 MB \/ 1 GB/)
    assert.match(textOf(f.first(el => el.props['data-metric'] === 'cpuJvm')), /0.0%/)
    assert.equal(textOf(f.first(el => el.props['data-metric'] === 'tcpConnectionsEstablished')), f.translate('components.RealtimeResource.tcpColumn') + '0')
    assert.doesNotMatch(textOf(f.host), /--|查看趋势|已聚焦/)
    assert.equal(f.calls.subscribe, 1)
  })
})

test('column sorting uses its actual number and leaves unavailable values last in either direction', async t => {
  const f = fixture(t)
  const payload = [sample('a:1', 1, 90, 164), sample('b:2', 30, 10, 9), sample('c:3', undefined, undefined, undefined)]
  await f.sample(payload)
  const input = f.api.normalizeRealtimeNodes(payload), order = key => f.api.sortRealtimeNodes(input, key, 'desc').map(row => row.nodeId)
  assert.deepEqual(order('cpuJvm'), ['b:2', 'a:1', 'c:3'])
  assert.deepEqual(order('memoryJvm'), ['a:1', 'b:2', 'c:3'])
  assert.deepEqual(order('tcpConnectionsEstablished'), ['a:1', 'b:2', 'c:3'])
  assert.deepEqual(f.api.sortRealtimeNodes(input, 'tcpConnectionsEstablished', 'asc').map(row => row.nodeId), ['b:2', 'a:1', 'c:3'])
  await f.click('TCP 连接')
  assert.deepEqual(f.all(el => el.props['data-node-id']).map(el => el.props['data-node-id']), ['a:1', 'b:2', 'c:3'])
  await f.click('TCP 连接')
  assert.deepEqual(f.all(el => el.props['data-node-id']).map(el => el.props['data-node-id']), ['b:2', 'a:1', 'c:3'])
  assert.equal(f.calls.subscribe, 1)
})

test('expanded detail follows node identity through sampling and sorting, closes on departure, and never changes trend selections', async t => {
  const f = fixture(t), payload = [sample('a:1', 10, 20, 164), sample('b:2', 30, 40, 9)]
  await f.sample(payload)
  f.runtime.selectNodes('cpu', ['b:2']); f.runtime.selectNodes('memory', ['a:1'])
  const before = JSON.stringify(f.runtime.selectedNodes)
  await f.click('查看 a:1 补充指标')
  const detail = () => f.first(el => hasClass(el, 'realtime-resource__detail-row'))
  const detailId = detail().props.id
  assert.match(textOf(detail()), /运行补充.*4 核.*0.40 \/ 0.30 \/ 0.20.*10.0%.*230 MB.*磁盘读写.*暂无数据.*网络速率与质量/)
  assert.doesNotMatch(textOf(detail()), /JVM CPU|堆内存|TCP 连接/)
  await f.click('JVM CPU')
  await f.sample([sample('b:2', 0, 5, 7), sample('a:1', 90, 21, 165)])
  assert.equal(detail().props.id, detailId)
  assert.equal(JSON.stringify(f.runtime.selectedNodes), before)
  await f.sample([sample('b:2', 0, 5, 7)])
  assert.equal(f.all(el => hasClass(el, 'realtime-resource__detail-row')).length, 0)
  await f.sample(payload)
  assert.equal(f.all(el => hasClass(el, 'realtime-resource__detail-row')).length, 0)
})

test('opaque identities are retained, invalid metrics stay unavailable and first-frame rates are never fabricated', async t => {
  const f = fixture(t)
  await f.sample([{ clusterNodeId: '2001:db8::1', value: {} }, sample('[::1]:7300', 0, 0, 0)])
  assert.match(textOf(f.row('2001:db8::1')), /2001:db8::1/)
  assert.match(textOf(f.row('2001:db8::1')), /暂无数据/)
  assert.equal(f.all(el => hasClass(el, 'realtime-resource__port')).length, 1)
  await f.click('查看 [::1]:7300 补充指标')
  assert.match(textOf(f.first(el => hasClass(el, 'realtime-resource__detail-row'))), /读取速率暂无数据写入速率暂无数据/)
  assert.doesNotMatch(textOf(f.host), /NaN|undefined|--/)
})

test('loading, empty, failed and retry states continue using the live owner', async t => {
  const f = fixture(t)
  await vue.nextTick()
  assert.equal(f.all(el => el.props['data-loading']).length, 1)
  await f.sample([])
  assert.match(textOf(f.host), /当前范围暂无监控数据/)
  await f.fail()
  assert.match(textOf(f.host), /监控数据加载失败/)
  await f.click('重试')
  assert.equal(f.calls.subscribe, 2); assert.equal(f.calls.released, 1)
  await f.sample([sample('restored:1', 1, 1, 1)])
  assert.equal(f.all(el => el.props['data-node-id']).length, 1)
})


test('third sort click restores the maintained default order after new samples and node changes', async t => {
  const f = fixture(t)
  const order = () => f.all(el => el.props['data-node-id']).map(el => el.props['data-node-id'])
  const header = label => f.first(el => el.type === 'th' && textOf(el).trim() === label)
  await f.sample([sample('b:2', 10, 10, 9), sample('a:1', 1, 90, 164)])
  assert.deepEqual(order(), ['a:1', 'b:2'])
  f.runtime.selectNodes('cpu', ['a:1'])
  f.runtime.selectNodes('memory', ['b:2'])
  await f.click('查看 a:1 补充指标')
  await f.click('TCP 连接')
  assert.equal(header('TCP 连接').props['aria-sort'], 'descending')
  await f.click('TCP 连接')
  assert.equal(header('TCP 连接').props['aria-sort'], 'ascending')
  assert.deepEqual(order(), ['b:2', 'a:1'])
  await f.sample([sample('b:2', 99, 99, 8), sample('a:1', 0, 0, 168), sample('c:3', 100, 100, 50)])
  const selections = JSON.stringify(f.runtime.selectedNodes)
  await f.click('TCP 连接')
  assert.deepEqual(order(), ['a:1', 'b:2', 'c:3'], 'reset must use maintained order rather than newly ranked pressure')
  assert.equal(header('TCP 连接').props['aria-sort'], 'none')
  assert.equal(f.all(el => el.type === 'button' && hasClass(el, 'is-sorted')).length, 0)
  assert.equal(f.all(el => hasClass(el, 'realtime-resource__detail-row')).length, 1)
  assert.equal(JSON.stringify(f.runtime.selectedNodes), selections)
  await f.click('TCP 连接')
  assert.equal(header('TCP 连接').props['aria-sort'], 'descending')
  await f.click('JVM CPU')
  assert.equal(header('JVM CPU').props['aria-sort'], 'descending')
  assert.equal(header('TCP 连接').props['aria-sort'], 'none')
  await f.sample([sample('b:2', 99, 99, 8), sample('a:1', 0, 0, 168)])
  await f.click('JVM CPU'); await f.click('JVM CPU')
  assert.deepEqual(order(), ['a:1', 'b:2'])
  assert.equal(f.calls.subscribe, 1)
})

test('node name sort also cycles back to its original order', async t => {
  const f = fixture(t)
  const order = () => f.all(el => el.props['data-node-id']).map(el => el.props['data-node-id'])
  await f.sample([sample('b:2', 99, 99, 0), sample('a:1', 1, 1, 0)])
  assert.deepEqual(order(), ['b:2', 'a:1'])
  await f.click('服务节点')
  assert.deepEqual(order(), ['a:1', 'b:2'])
  await f.click('服务节点')
  assert.deepEqual(order(), ['b:2', 'a:1'])
  await f.click('服务节点')
  assert.equal(f.first(el => el.type === 'th' && textOf(el).trim() === '服务节点').props['aria-sort'], 'none')
  assert.equal(f.all(el => el.type === 'button' && hasClass(el, 'is-sorted')).length, 0)
})
