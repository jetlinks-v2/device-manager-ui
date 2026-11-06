import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const require = createRequire(import.meta.url)
const modules = runtimeModules(), dashboard = modules.load('views/link/diagnostics/overview/nodeOverviewDashboard.ts')
const { diagnosticContentState } = modules.load('views/link/diagnostics/status.ts')
const flush = async () => { await vue.nextTick(); await vue.nextTick() }

function harness(t) {
  const size = vue.reactive({ width: 0, height: 0 }), resourceSize = vue.reactive({ width: 720, height: 650 })
  const props = vue.reactive({ nodeId: 'node-a', scopeKey: 'project', active: true })
  const canvases = [], panels = [], sessions = vue.ref(new Map())
  const Canvas = vue.defineComponent({ props: ['modelValue', 'storageKey'], setup(props, { slots }) {
    const instance = { props, unmounted: false }; canvases.push(instance)
    vue.onUnmounted(() => { instance.unmounted = true })
    return () => vue.h('canvas', props.modelValue.components.filter(widget => widget.visible !== false).map(widget => slots.widget?.({ widget })))
  } })
  const Panel = vue.defineComponent({ props: ['chartCapacity', 'historyState'], setup(props) { panels.push(props); return () => vue.h('panel') } })
  const view = { access: vue.ref({ monitor: true, query: true }), metrics: vue.ref([]), charts: vue.ref([]),
    operational: { signals: vue.ref([]), cache: vue.ref(), state: vue.ref({ status: 'ready' }) },
    bufferBeans: vue.ref([]), bufferHistory: vue.ref([]), bufferState: vue.ref({ status: 'ready' }),
    bufferResetAccess: vue.ref({ allowed: false }), bufferReset: { state: vue.ref({ status: 'ready' }), reset() {} },
    range: vue.ref([new Date(0), new Date(1000)]), relativeSeconds: vue.ref(3600), historyState: vue.ref({ status: 'ready' }) }
  let sizes = 0
  const mocks = {
    vue,
    'ant-design-vue': { Skeleton: vue.defineComponent({ render: () => vue.h('skeleton') }) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@vueuse/core': { useElementSize: () => vue.toRefs(sizes++ === 0 ? size : resourceSize) },
    '@jetlinks-web-core/components/DashBoardCanvas': { DashBoardCanvas: Canvas },
    '@jetlinks-web-core/components/RuntimeDiagnostics': { RuntimeMetricsPanel: Panel, RuntimeMBeanExtensions: vue.defineComponent({ render: () => null }) },
    './overview/nodeOverviewDashboard': dashboard,
    './useNodeMetrics': { useNodeMetricsContext: () => view },
    './useNodeMBeanOverviews': { useNodeMBeanOverviews: () => ({ entries: vue.ref([]), refresh() {} }) },
    './useDiagnosticPreferences': { useDiagnosticPreferences: () => ({ key: vue.ref('account'), value: vue.ref({ nodes: {} }) }) },
    './overview/useOverviewTrends': { useOverviewTrends: () => vue.ref([]) },
    '../RuntimeMonitor/useClusterSessions': { useClusterSessionContext: () => ({ snapshots: sessions }) },
    '../RuntimeMonitor/useClusterBuffers': { useClusterBufferContext: () => undefined },
    '../RuntimeMonitor/device-runtime/useDeviceMessageRecording': { useDeviceMessageRecording: () => ({ view: vue.ref(), refresh() {}, live() {} }) },
  }
  const filename = new URL('../views/link/diagnostics/NodeOverview.vue', import.meta.url)
  const source = compileScript(parse(readFileSync(filename, 'utf8'), { filename: filename.pathname }).descriptor, { id: 'overview-lifecycle', inlineTemplate: true }).content
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id.endsWith('.css')) return {}
    if (id.endsWith('.vue')) return { default: vue.defineComponent({ render: () => null }), __esModule: true }
    return require(id)
  }, module, module.exports)
  const node = () => ({ children: [], parent: null })
  const renderer = vue.createRenderer({
    createElement: node, createText: node, createComment: node,
    insert(child, parent, anchor) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; at < 0 ? parent.children.push(child) : parent.children.splice(at, 0, child) },
    remove(child) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null },
    setText() {}, setElementText() {}, patchProp() {}, parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  })
  const app = renderer.createApp({ setup: () => () => vue.h(module.exports.default, props) })
  app.mount(node()); t.after(() => app.unmount())
  return { size, resourceSize, props, canvases, panels, view, sessions }
}

test('first measurement selects the actual layout before mounting the canvas', async t => {
  const h = harness(t); await flush()
  assert.equal(h.canvases.length, 0)
  h.size.width = 375; await flush()
  assert.equal(h.canvases.length, 1)
  assert.ok(h.canvases[0].props.storageKey.endsWith(':narrow'))
  h.size.width = 420; await flush()
  assert.equal(h.canvases.length, 1, 'same breakpoint must retain the canvas')
})

test('initial data uses skeletons; failed loads release them and cached refreshes retain content', async t => {
  const h = harness(t)
  h.view.historyState.value = { status: 'loading' }; h.size.width = 900; await flush()
  assert.equal(h.canvases.length, 1, 'measure the real grid while placeholders are visible')
  assert.equal(h.panels.length, 0)
  h.view.historyState.value = { status: 'error', message: 'unavailable' }; await flush()
  assert.equal(h.panels.length, 1)
  assert.equal(h.panels[0].historyState.status, 'error', 'preserve the existing error and retry state')
  h.view.historyState.value = diagnosticContentState({ status: 'loading' }, true); await flush()
  assert.equal(h.panels.length, 1, 'a refresh with cached evidence must retain the panel')
  h.props.active = false; h.size.width = 0; await flush()
  h.props.active = true; h.size.width = 900; await flush()
  assert.equal(h.canvases.length, 1)
  assert.equal(h.panels.length, 1)
})

test('first buffer and session samples settle on errors or missing capabilities; denied queries do not block', async t => {
  const h = harness(t)
  h.size.width = 900; h.view.bufferState.value = { status: 'loading' }; await flush()
  assert.equal(h.panels.length, 0)
  h.view.bufferState.value = { status: 'unsupported' }; h.sessions.value.set('node-a', { state: { status: 'loading' } }); await flush()
  assert.equal(h.panels.length, 0)
  h.sessions.value.set('node-a', { state: { status: 'empty' } }); await flush()
  assert.equal(h.panels.length, 1)
  h.view.bufferState.value = { status: 'loading' }; h.view.access.value = { query: true, monitor: false }; await flush()
  assert.equal(h.panels.length, 1)
})

test('hidden cached nodes retain the canvas and resource capacity until a real resize', async t => {
  const h = harness(t)
  h.size.width = 1300; await flush()
  const first = h.canvases.at(-1), count = h.canvases.length
  assert.equal(h.panels.at(-1).chartCapacity, 6)
  for (let i = 0; i < 3; i++) {
    h.props.active = false; h.size.width = 0; h.resourceSize.width = 0; h.resourceSize.height = 0; await flush()
    assert.equal(first.unmounted, false)
    assert.equal(h.panels.at(-1).chartCapacity, 6, 'hidden dimensions must not remove existing charts')
    h.props.active = true; h.size.width = 1300; h.resourceSize.width = 720; h.resourceSize.height = 650; await flush()
  }
  assert.equal(h.canvases.length, count)
  h.size.width = 375; h.resourceSize.width = 340; h.resourceSize.height = 506; await flush()
  assert.equal(h.canvases.length, count + 1)
  assert.ok(h.canvases.at(-1).props.storageKey.endsWith(':narrow'))
  assert.equal(h.panels.at(-1).chartCapacity, 2)
})
