import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript, compileStyleAsync } from 'vue/compiler-sfc'
import dayjs from 'dayjs'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
const group = path.join(root, 'visDashboard/SystemMonitor')
const compiled = await build({
  stdin: { contents: `
    export {default as Panel} from ${JSON.stringify(path.join(group, 'components/TrendPanel.vue'))};
    export {useTrendTimeControls} from ${JSON.stringify(path.join(group, 'hooks/useTrendTimeControls.ts'))};
    export {useNodeFocusSelector,fitNodePreview} from ${JSON.stringify(path.join(group, 'hooks/useNodeFocusSelector.ts'))};
    export {useResourceTrend} from ${JSON.stringify(path.join(group, 'hooks/useResourceTrend.ts'))};
    export {useNetworkTrend} from ${JSON.stringify(path.join(group, 'hooks/useNetworkTrend.ts'))};
    export {provideSystemMonitorRuntime} from ${JSON.stringify(path.join(group, 'hooks/useSystemMonitorRuntime.ts'))};
  `, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', external: ['vue'],
  plugins: [{ name: 'trend-control-boundaries', setup(plugin) {
    plugin.onResolve({ filter: /^vue-i18n$/ }, () => ({ path: 'locale', namespace: 'fixture' }))
    plugin.onResolve({ filter: /^@jetlinks-web\/core$/ }, () => ({ path: 'io', namespace: 'fixture' }))
    plugin.onResolve({ filter: /\/services\/history$/ }, () => ({ path: 'history', namespace: 'fixture' }))
    plugin.onResolve({ filter: /^@jetlinks-web-core\/components\/CloudEmpty/ }, () => ({ path: 'empty', namespace: 'fixture' }))
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: ({
      locale: 'export const useI18n=()=>({t:key=>key})',
      io: 'export const wsClient={getWebSocket(){throw Error("Unexpected websocket")}};',
      history: 'export const loadResourceHistory=(metric,range)=>context.load(metric,range);export const loadNetworkHistory=(metric,range)=>context.load(metric,range);',
      empty: 'export default {}',
    })[args.path] }))
    plugin.onLoad({ filter: /\.vue$/ }, async args => {
      const { descriptor, errors } = parse(readFileSync(args.path, 'utf8'), { filename: args.path })
      assert.deepEqual(errors, [])
      for (const style of descriptor.styles) {
        const source = style.src ? readFileSync(path.resolve(path.dirname(args.path), style.src), 'utf8') : style.content
        const result = await compileStyleAsync({ source, filename: args.path, id: args.path, scoped: !!style.scoped, preprocessLang: style.lang })
        assert.deepEqual(result.errors, [], args.path)
      }
      return { loader: 'ts', contents: compileScript(descriptor, { id: args.path, inlineTemplate: true }).content }
    })
  } }],
})
function node() { return { children: [], parent: null } }
const renderer = vue.createRenderer({
  createElement: node, createText: node, createComment: node, setText() {}, setElementText() {}, patchProp() {},
  parentNode: n => n.parent, nextSibling: () => null,
  insert(n, parent) { n.parent = parent; parent.children.push(n) },
  remove(n) { if (n.parent) n.parent.children = n.parent.children.filter(child => child !== n) },
})
const flush = async () => { await Promise.resolve(); await vue.nextTick(); await Promise.resolve(); await vue.nextTick() }
const values = range => range.map(d => d.valueOf())
function setup(t, options = {}) {
  const calls = [], observers = []
  const stored = options.stored ?? {}
  const storage = { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = value } }
  const context = { load: async (metric, range) => {
    calls.push({ metric, range: values(range) })
    if (metric.startsWith('cpu') || metric.startsWith('memory')) return ['a', 'b', 'c'].map(nodeId => ({
      nodeId, latest: { timestamp: range[1].valueOf(), percent: 20, used: 20, total: 100 },
      points: [{ timestamp: range[0].valueOf(), percent: 10 }, { timestamp: range[1].valueOf(), percent: 20 }],
    }))
    if (options.networkLoad) return options.networkLoad(metric, range)
    return { nodes: ['a', 'b', 'c'], times: ['now'], series: metric === 'traffic'
      ? { trafficUp: { a: { _data: [4] } }, trafficDown: {} }
      : { tcpConnections: { a: { _data: [[range[1].valueOf(), 4]] } } } }
  } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'context', compiled.outputFiles[0].text)(require, module, module.exports, context)
  const api = module.exports, views = {}, time = {}, selectors = {}
  let runtime
  const Child = { setup() {
    const disabled = vue.ref(false)
    views.cpu = api.useResourceTrend('cpu', disabled)
    views.memory = api.useResourceTrend('memory', disabled)
    views.network = api.useNetworkTrend(disabled)
    for (const key of ['cpu', 'memory', 'network']) {
      time[key] = api.useTrendTimeControls(() => views[key])
      selectors[key] = api.useNodeFocusSelector(() => views[key].selectedNodes, () => views[key].nodeOptions,
        next => views[key].selectNodes(next), vue.ref())
    }
    return () => vue.h('div')
  } }
  const app = renderer.createApp({ setup() {
    runtime = api.provideSystemMonitorRuntime({ subscribe(observer) { observers.push(observer); return { unsubscribe() {} } }, storage })
    return () => vue.h(Child)
  } })
  app.mount(node()); t.after(() => app.unmount())
  const sample = (ids = options.nodes ?? ['a', 'b', 'c']) => observers[0].next(ids.map(clusterNodeId =>
    ({ clusterNodeId, value: { cpu: { systemUsage: 10, jvmUsage: 5 } } })))
  if (options.autoSample !== false) sample()
  return { api, views, time, selectors, calls, runtime, stored, sample }
}

test('node preview fills one row by measured widths and only reserves +N when necessary', t => {
  const { api } = setup(t)
  assert.equal(api.fitNodePreview([60, 80, 70, 100, 90], 500, 25), 5)
  assert.equal(api.fitNodePreview([60, 80, 70, 100, 90], 300, 25), 3)
  assert.equal(api.fitNodePreview([200, 40, 70], 260, 25), 1)
  assert.equal(api.fitNodePreview([80, 80], 164, 25), 2)
  assert.equal(api.fitNodePreview([80, 80], 163, 25), 1)
  assert.equal(api.fitNodePreview([190], 40, 25), 0)
  assert.equal(api.fitNodePreview([], 400, 25), 0)
})

test('time shortcuts affect one card, preserve selections and expose the full range without a slider', async t => {
  const { views, time, calls } = setup(t)
  await flush()
  views.cpu.selectNodes(['a']); views.memory.selectNodes(['b']); views.network.selectNodes(['c'])
  const originalMemory = values(views.memory.timeRange), originalNetwork = values(views.network.timeRange)
  const previousCalls = calls.length
  time.cpu.setOpen(true); time.cpu.selectShortcut('day'); await flush()
  assert.equal(time.cpu.open.value, false)
  assert.equal(views.cpu.shortcut, 'day')
  assert.equal(views.cpu.timeRange[1].diff(views.cpu.timeRange[0], 'hour'), 24)
  assert.deepEqual(values(views.memory.timeRange), originalMemory)
  assert.deepEqual(values(views.network.timeRange), originalNetwork)
  assert.deepEqual(calls.slice(previousCalls).map(call => call.metric), ['cpuJvm'])
  for (const key of ['cpu', 'memory', 'network']) {
    assert.deepEqual(views[key].chartOptions.dataZoom, [{ type: 'inside', start: 0, end: 100 }])
  }
  assert.deepEqual(views.cpu.selectedNodes, ['a'])
  assert.deepEqual(views.memory.selectedNodes, ['b'])
  assert.deepEqual(views.network.selectedNodes, ['c'])
})

test('custom time drafts validate, cancel without requests and persist through metric change and refresh', async t => {
  const { views, time, calls } = setup(t)
  await flush()
  const control = time.memory, before = values(views.memory.timeRange), count = calls.length
  control.setOpen(true); control.setDraft([dayjs('2026-10-27 12:00'), dayjs('2026-10-27 10:00')]); control.apply()
  assert.equal(control.error.value, 'components.MonitorTrend.invalidRange')
  assert.equal(control.open.value, true); assert.equal(calls.length, count)
  control.setDraft(null); control.apply()
  assert.equal(control.error.value, 'components.MonitorTrend.selectCompleteRange')
  const range = [dayjs('2026-10-20 09:00'), dayjs('2026-10-25 18:30')]
  control.setDraft(range); control.setOpen(false); await flush()
  assert.deepEqual(values(views.memory.timeRange), before)
  assert.equal(calls.length, count)
  control.setOpen(true); control.setDraft(range); control.apply(); await flush()
  assert.equal(views.memory.shortcut, undefined)
  assert.deepEqual(values(views.memory.timeRange), values(range))
  views.memory.selectNodes(['b']); views.memory.selectMetric('memorySystem'); await flush()
  views.memory.refresh(); await flush()
  assert.deepEqual(calls.at(-1), { metric: 'memorySystem', range: values(range) })
  assert.deepEqual(views.memory.selectedNodes, ['b'])
  assert.equal(views.cpu.shortcut, 'hour')
})

test('continuous node changes retain search and open state while each card keeps its own choices and time', async t => {
  const { selectors, views, calls } = setup(t)
  await flush()
  views.cpu.selectNodes(['a']); views.memory.selectNodes(['b']); views.network.selectNodes(['c'])
  const range = values(views.cpu.timeRange), count = calls.length, current = selectors.cpu
  current.open.value = true; current.keyword.value = 'b'
  assert.deepEqual(current.filtered.value.map(option => option.value), ['b'])
  current.toggle('b', true); await flush()
  assert.equal(current.open.value, true); assert.equal(current.keyword.value, 'b')
  assert.deepEqual(views.cpu.selectedNodes, ['a', 'b'])
  current.toggle('a', false); await flush()
  assert.deepEqual(views.cpu.selectedNodes, ['b'])
  current.selectAll(); await flush()
  assert.deepEqual(views.cpu.selectedNodes, ['a', 'b', 'c'])
  for (const id of ['a', 'b', 'c']) current.toggle(id, false)
  await flush()
  assert.deepEqual(views.cpu.selectedNodes, [])
  assert.equal(views.cpu.empty, true)
  views.cpu.resetNodes(); await flush()
  assert.equal(views.cpu.selectedNodes.length, 3)
  assert.deepEqual(views.memory.selectedNodes, ['b']); assert.deepEqual(views.network.selectedNodes, ['c'])
  assert.deepEqual(values(views.cpu.timeRange), range)
  assert.equal(calls.length, count, 'selection filters existing series without querying history')
  current.keyword.value = 'absent'; assert.equal(current.filtered.value.length, 0)
})

test('disabled preview cannot open time controls or commit a query', async t => {
  const { api } = setup(t), events = [], scope = vue.effectScope()
  const view = vue.reactive({ disabled: false, timeRange: [dayjs(), dayjs()], shortcut: 'hour',
    selectRange: () => events.push('range'), selectShortcut: () => events.push('shortcut') })
  const control = scope.run(() => api.useTrendTimeControls(() => view))
  control.setOpen(true); assert.equal(control.open.value, true)
  view.disabled = true; await flush()
  assert.equal(control.open.value, false)
  control.setOpen(true); control.selectShortcut('day'); control.apply()
  assert.equal(control.open.value, false); assert.deepEqual(events, [])
  scope.stop()
})

const focusKey = 'jetlinks.runtime.monitor.focused-nodes.v2'
const traffic = entries => ({
  nodes: Object.keys(entries), times: ['now'],
  series: { trafficUp: Object.fromEntries(Object.entries(entries).map(([id, points]) => [id, { _data: points }])), trafficDown: {} },
})

test('network defaults include the only traffic node omitted by resource pressure defaults, in either arrival order', async t => {
  for (const historyFirst of [false, true]) {
    let resolve
    const pending = new Promise(done => { resolve = done })
    const run = setup(t, { nodes: ['a', 'b', 'c', 'd', 'e', 'z-device-ingress'], autoSample: !historyFirst, networkLoad: () => pending })
    if (historyFirst) {
      resolve(traffic({ 'z-device-ingress': [42] })); await flush()
      run.sample()
    } else {
      assert.deepEqual(run.views.network.selectedNodes, [], 'do not select unrelated pressure defaults before history')
      resolve(traffic({ 'z-device-ingress': [42] }))
    }
    await flush()
    assert.equal(run.runtime.defaultNodes.value.includes('z-device-ingress'), false)
    assert.deepEqual(run.views.network.selectedNodes, ['z-device-ingress'])
    assert.equal(run.views.network.empty, false)
    assert.deepEqual(run.views.network.chartOptions.series[0].data, [42])
    const selection = run.views.network.selectedNodes, count = run.calls.length
    run.sample(); await flush()
    assert.equal(run.views.network.selectedNodes, selection)
    assert.equal(run.calls.length, count, 'ordinary sampling must not refetch history')
  }
})

test('network defaults use current metric values, include zero, and reject all-null series', async t => {
  const nodes = ['a', 'b', 'c', 'd', 'e', 'f', 'gap']
  const run = setup(t, { nodes, networkLoad: async metric => metric === 'traffic'
    ? traffic({ a: [0, null], b: [5], c: [4], d: [3], e: [2], f: [1], gap: [null, undefined, NaN] })
    : { nodes, series: { tcpConnections: { a: { _data: [[1, 0], [2, null]] }, gap: { _data: [[1, null]] } } } } })
  await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['b', 'c', 'd', 'e', 'f'])
  run.views.network.selectMetric('tcpConnections'); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['a'])
  assert.equal(run.views.network.empty, false)
  run.views.network.selectNodes(['gap']); await flush()
  assert.equal(run.views.network.empty, true, 'all-null time points are an empty chart')
})

test('legacy cached selection is repaired only when it misses all current data', async t => {
  const caches = [
    { [focusKey]: JSON.stringify({ cpu: ['b'], memory: ['c'], network: ['a', 'b'] }) },
    { 'jetlinks.runtime.monitor.focused-nodes.v1': JSON.stringify(['a', 'b']) },
  ]
  for (const stored of caches) {
    const run = setup(t, { stored, networkLoad: async () => traffic({ c: [7] }) })
    await flush()
    assert.deepEqual(run.views.network.selectedNodes, ['c'])
    assert.equal(JSON.parse(stored[focusKey]).networkMode, 'auto')
  }
  const stored = { [focusKey]: JSON.stringify({ network: ['b', 'c'] }) }
  const valid = setup(t, { stored, networkLoad: async () => traffic({ c: [7] }) })
  await flush()
  assert.deepEqual(valid.views.network.selectedNodes, ['b', 'c'], 'preserve old preferences that still display data')
  assert.equal(valid.runtime.networkFocusMode.value, 'legacy')
})

test('manual network preferences including empty survive sampling, metric/time changes, refresh and reload', async t => {
  for (const selected of [['b'], []]) {
    const run = setup(t)
    await flush()
    run.views.network.selectNodes(selected)
    run.views.network.selectMetric('tcpConnections'); await flush()
    run.views.network.selectShortcut('week'); await flush()
    run.views.network.refresh(); await flush()
    run.sample(); await flush()
    assert.deepEqual(run.views.network.selectedNodes, selected)
    assert.equal(run.runtime.networkFocusMode.value, 'manual')
    const reloaded = setup(t, { stored: run.stored })
    await flush()
    assert.deepEqual(reloaded.views.network.selectedNodes, selected)
    assert.equal(reloaded.runtime.networkFocusMode.value, 'manual')
    assert.deepEqual(reloaded.views.cpu.selectedNodes, ['a', 'b', 'c'])
  }
})

test('reset restores data-aware automatic mode and follows successful history changes', async t => {
  let data = traffic({ c: [8] })
  const run = setup(t, { networkLoad: async () => data })
  await flush()
  run.views.network.selectNodes(['a']); await flush()
  assert.equal(run.views.network.empty, true)
  run.views.network.resetNodes(); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['c'])
  assert.equal(run.runtime.networkFocusMode.value, 'auto')
  data = traffic({ b: [0] })
  run.views.network.refresh(); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['b'])
  assert.equal(run.views.network.empty, false)
  const reloaded = setup(t, { stored: run.stored, networkLoad: async () => traffic({ a: [4] }) })
  await flush()
  assert.deepEqual(reloaded.views.network.selectedNodes, ['a'], 'saved automatic choices are recomputed on entry')
})

test('pending, failed and stale requests do not overwrite network selection', async t => {
  const pending = []
  const run = setup(t, { networkLoad: (metric, range) => new Promise((resolve, reject) => pending.push({ metric, range, resolve, reject })) })
  pending[0].resolve(traffic({ a: [1] })); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['a'])
  run.views.network.selectMetric('tcpConnections'); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['a'], 'wait for the selected metric')
  run.views.network.selectShortcut('week'); await flush()
  pending[1].resolve({ nodes: ['c'], series: { tcpConnections: { c: { _data: [[1, 99]] } } } }); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['a'], 'ignore superseded successful response')
  pending[2].reject(Error('offline')); await flush()
  assert.equal(run.views.network.error, true)
  assert.deepEqual(run.views.network.selectedNodes, ['a'])
  run.views.network.refresh(); await flush()
  run.views.network.selectNodes(['b'])
  pending[3].resolve({ nodes: ['c'], series: { tcpConnections: { c: { _data: [[1, 99]] } } } }); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['b'], 'manual choice made during loading wins')
})

test('empty legacy history retains preferences until a successful response can repair them', async t => {
  let data = traffic({})
  const run = setup(t, { stored: { [focusKey]: JSON.stringify({ network: ['b'] }) }, networkLoad: async () => data })
  await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['b'])
  assert.equal(run.runtime.networkFocusMode.value, 'legacy')
  data = traffic({ a: [2] })
  run.views.network.refresh(); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['a'])
  assert.equal(run.runtime.networkFocusMode.value, 'auto')
})

test('departed network selections never fall back to resource pressure nodes', async t => {
  let data = traffic({ c: [3] })
  const run = setup(t, { networkLoad: async () => data })
  await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['c'])
  data = traffic({ b: [0] })
  const count = run.calls.length
  run.sample(['a', 'b']); await flush()
  assert.deepEqual(run.views.network.selectedNodes, ['b'])
  assert.equal(run.calls.length - count, 3, 'topology change refreshes each card once')
  run.views.network.selectNodes(['b'])
  data = traffic({ c: [4] })
  run.sample(['a', 'c']); await flush()
  assert.deepEqual(run.views.network.selectedNodes, [])
  assert.equal(run.runtime.networkFocusMode.value, 'manual')
})

test('history-first network defaults preserve other cards cached preferences before realtime discovery', async t => {
  const run = setup(t, { autoSample: false, stored: { [focusKey]: JSON.stringify({ cpu: ['b'], memory: ['c'], network: [] }) } })
  await flush()
  const saved = JSON.parse(run.stored[focusKey])
  assert.deepEqual(saved.cpu, ['b'])
  assert.deepEqual(saved.memory, ['c'])
  assert.deepEqual(saved.network, ['a'])
  run.sample(); await flush()
  assert.deepEqual(run.views.cpu.selectedNodes, ['b'])
  assert.deepEqual(run.views.memory.selectedNodes, ['c'])
})
