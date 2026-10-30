import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'

const filename = resolve(import.meta.dirname, '../views/link/RuntimeMonitor/index.vue')
const source = compileScript(parse(readFileSync(filename, 'utf8'), { filename }).descriptor, { id: 'runtime-performance', inlineTemplate: true }).content
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
const empty = vue.defineComponent({ setup: () => () => null })
const pass = vue.defineComponent({ setup: (_, context) => () => vue.h('div', context.slots.default?.()) })
function make(type) { return { type, style: {}, children: [], parent: null } }
const renderer = vue.createRenderer({
  createElement: make, createText: text => ({ ...make('text'), text }), createComment: () => make('comment'),
  setText: (node, text) => node.text = text, setElementText: (node, text) => node.text = text, patchProp() {},
  parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  insert(node, parent, anchor) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    node.parent = parent
    const index = parent.children.indexOf(anchor)
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
  },
  remove(node) { node.parent?.children.splice(node.parent.children.indexOf(node), 1); node.parent = null },
})

test('300-node host isolates clock, Buffer and session updates and keeps tree identity across resource frames', async () => {
  const updated = [], nodes = vue.shallowRef(Array.from({ length: 300 }, (_, index) => ({ id: `node-${index}` })))
  const view = {
    access: vue.ref({ enter: true, monitor: true, query: true }), active: vue.ref(true), search: vue.ref(''),
    membership: { state: vue.ref({ status: 'ready' }) }, selected: vue.ref('node-0'), tab: vue.ref('overview'),
    nodes, nodeIds: vue.computed(() => nodes.value.map(node => node.id)), filtered: nodes, current: vue.computed(() => nodes.value[0]),
    showNodeSelector: vue.ref(true), scopeKey: vue.ref('scope'), discoveryScope: vue.ref('scope'),
    runtime: { error: vue.ref(false), loading: vue.ref(false), updatedAt: vue.ref('00:00:00') },
    preferences: { value: vue.ref({ bufferIntervalSeconds: 2 }), clear() {}, update() {}, updateNode() {} },
  }
  const buffers = { snapshots: vue.shallowRef(vue.shallowReactive(new Map())) }, sessions = { snapshots: vue.shallowRef(vue.shallowReactive(new Map())) }
  let publishClock, treeRebuilds = 0
  const summary = vue.defineComponent({
    props: ['nodeId', 'label', 'live', 'stale', 'waiting', 'metrics', 'buffer', 'session', 'canOpenBuffer'],
    setup: props => { vue.onUpdated(() => updated.push(props.nodeId)); return () => vue.h('span', props.nodeId) },
  })
  const workspace = vue.defineComponent({
    props: ['nodeId', 'scopeKey'], emits: ['metrics'],
    setup: (props, { emit }) => { publishClock = () => emit('metrics', { nodeId: props.nodeId, scopeKey: props.scopeKey, metrics: [{ key: 'uptime', value: Date.now() }] }); return () => null },
  })
  const mocks = {
    vue: { ...vue, defineAsyncComponent: () => workspace },
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({ replace() {} }) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@ant-design/icons-vue': { MenuFoldOutlined: empty, MenuUnfoldOutlined: empty, UndoOutlined: empty },
    './useClusterWorkspace': { useClusterWorkspace: () => view },
    './useLogWorkspaceLayout': { useLogWorkspaceLayout: () => undefined },
    './useClusterSidebarLayout': { useClusterSidebarLayout: () => ({ expanded: vue.ref(true), gridStyle: vue.ref({}), canToggle: vue.ref(false), compact: vue.ref(false), listHeight: vue.ref(700) }) },
    './useClusterBuffers': { provideClusterBuffers: () => buffers }, './useClusterSessions': { useClusterSessionContext: () => sessions },
    '../diagnostics/preferences': { bufferIntervals: [1, 2, 5, 10, 30, 60], diagnosticIntervalSeconds: value => value ?? 2 },
    '../diagnostics/overview/useResourceHistory': { provideResourceHistoryCache() {} },
    './NodeSummary.vue': { __esModule: true, default: summary },
    '@jetlinks-web-core/components/RuntimeDiagnostics': { SamplingIntervalControl: empty },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => { assert.ok(id in mocks, id); return mocks[id] }, module, module.exports)
  const app = renderer.createApp(module.exports.default)
  app.config.warnHandler = () => {}
  app.component('a-input-search', empty); app.component('a-spin', pass)
  app.component('a-tree', vue.defineComponent({ props: ['treeData', 'selectedKeys'], setup: (props, context) => {
    vue.watch(() => props.treeData, () => treeRebuilds++)
    return () => vue.h('div', props.treeData.map(dataRef => vue.h('div', { key: dataRef.key }, context.slots.title?.({ dataRef }))))
  } }))
  app.mount(make('root'))
  try {
    await vue.nextTick(); updated.length = 0
    publishClock(); await vue.nextTick(); assert.deepEqual(updated, [], 'detail uptime never invalidates node rows')
    buffers.snapshots.value.set('node-1', { history: [] }); await vue.nextTick()
    assert.deepEqual(updated, ['node-1']); updated.length = 0
    sessions.snapshots.value.set('node-2', { history: [] }); await vue.nextTick()
    assert.deepEqual(updated, ['node-2']); updated.length = 0
    nodes.value = nodes.value.map(node => node.id === 'node-3' ? { ...node, live: { cpuJvm: 12 } } : node)
    await vue.nextTick(); assert.deepEqual(updated, ['node-3']); assert.equal(treeRebuilds, 0)
    nodes.value = nodes.value.map(node => node.id === 'node-3' ? { ...node, alias: 'Renamed' } : node)
    await vue.nextTick(); assert.equal(treeRebuilds, 1, 'actual directory metadata changes still reach Tree')
  } finally { app.unmount() }
})
