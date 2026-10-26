import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), host = resolve(import.meta.dirname, '..'), core = resolve(host, '../../jetlinks-web-core/src/components/RuntimeDiagnostics'), cache = new Map()
const messages = { ...JSON.parse(readFileSync(resolve(host, 'locales/lang/zh.json'))), ...JSON.parse(readFileSync(resolve(core, '../../locales/lang/zh.json'))) }
const t = (key, args = {}) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => args[name] ?? `{${name}}`)
const empty = vue.defineComponent({ setup: () => () => null })
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  let source = readFileSync(filename, 'utf8')
  if (filename.endsWith('.vue')) source = compileScript(parse(source, { filename }).descriptor, { id: filename, inlineTemplate: true }).content
  const module = { exports: {} }, { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t }) }
    if (id === 'ant-design-vue') return { theme: { useToken: () => ({ token: vue.ref({}) }) } }
    if (id === '@ant-design/icons-vue') return { ArrowRightOutlined: empty, InfoCircleOutlined: empty, LinkOutlined: empty, UploadOutlined: empty, DownloadOutlined: empty, DatabaseOutlined: empty, ApiOutlined: empty }
    if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return { ...load(resolve(core, 'buffer/history.ts')), ...load(resolve(core, 'buffer/counters.ts')) }
    if (id.startsWith('.')) return /NodeResource(Meter|Summary)\.vue$/.test(id) ? { __esModule: true, default: empty } : load(resolve(dirname(filename), /\.(ts|vue)$/.test(id) ? id : `${id}.ts`))
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const { nodeBufferOverview, bufferRate } = load(resolve(host, 'views/link/RuntimeMonitor/nodeBufferOverview.ts'))
const NodeBufferDetails = load(resolve(host, 'views/link/RuntimeMonitor/NodeBufferDetails.vue')).default
const NodeSummary = load(resolve(host, 'views/link/RuntimeMonitor/NodeSummary.vue')).default
const queue = (name = 'q', pending = 0, dead = 0, written = '0', attempted = '0', extra = {}) => ({ name, objectName: `org.jetlinks:type=PersistenceBuffer,name=${name}`, pending, dead, written, attempted, ...extra })
const sample = (sampledAt, ...buffers) => ({ sampledAt, buffers })
const snapshot = (history, queues = history.at(-1)?.buffers ?? [], status = 'ready', sampledAt = history.at(-1)?.sampledAt) => ({ beans: [], queues, history, state: { status, sampledAt },
  pending: queues.length && queues.every(q => q.pending !== undefined) ? queues.reduce((n, q) => n + q.pending, 0) : undefined,
  dead: queues.length && queues.every(q => q.dead !== undefined) ? queues.reduce((n, q) => n + q.dead, 0) : undefined,
  hasBacklog: queues.some(q => (q.pending ?? 0) > 0 || (q.dead ?? 0) > 0) })

function register(app) {
  app.component('a-button', { setup: (_, { slots }) => () => vue.h('button', slots.default?.()) })
  app.component('a-tooltip', { setup: (_, { slots }) => () => vue.h('span', slots.default?.()) })
  app.component('a-tag', { setup: (_, { slots }) => () => vue.h('span', slots.default?.()) })
  app.component('a-badge', empty)
  app.component('a-popover', { props: ['open'], emits: ['openChange'], setup: (props, { slots, emit }) => () => vue.h('div', { class: 'popover-contract', onMouseleave: () => emit('openChange', false) }, [slots.default?.(), props.open ? slots.content?.() : null]) })
  return app
}
const dispatch = (handlers, event) => { for (const handler of Array.isArray(handlers) ? handlers : [handlers]) handler?.(event) }
const render = props => renderToString(register(vue.createSSRApp(NodeBufferDetails, props)))
const renderSummary = props => renderToString(register(vue.createSSRApp(NodeSummary, props)))

test('uses exact adjacent counters and actual interval even with zero backlog', () => {
  const history = [sample(1000, queue('q', 0, 0, '9007199254740993', '80')), sample(3500, queue('q', 0, 0, '9007199254741003', '85'))]
  const model = nodeBufferOverview(snapshot(history))
  assert.equal(model.writtenRate, 4); assert.equal(model.attemptedRate, 2); assert.equal(model.pendingDelta, 0)
  assert.deepEqual(model.window, { from: 1000, to: 3500, seconds: 2.5 })
  assert.equal(bufferRate(0.00001), '<0.01')
})

test('first sample does not invent rates; exact pending change can decrease', () => {
  assert.equal(nodeBufferOverview(snapshot([sample(1000, queue('q', 20))])).firstSample, true)
  assert.equal(nodeBufferOverview(snapshot([sample(1000, queue('q', 20))])).writtenRate, undefined)
  const model = nodeBufferOverview(snapshot([sample(1000, queue('q', 20)), sample(6000, queue('q', 12, 0, '10', '8'))]))
  assert.equal(model.pendingDelta, -8); assert.equal(model.writtenRate, 2)
})

test('missing samples, reset epochs, counter rollback and membership changes break comparisons and recover only on the next valid pair', () => {
  const before = sample(1000, queue('q', 10, 0, '100', '90', { counterEpoch: 0 }))
  const current = sample(11000, queue('q', 15, 0, '120', '95', { counterEpoch: 0 }))
  for (const history of [
    [before, sample(6000), current],
    [before, sample(11000, queue('q', 15, 0, '120', '95', { counterEpoch: 1 }))],
    [before, sample(11000, queue('q', 15, 0, '10', '9', { counterEpoch: 0 }))],
    [before, sample(11000, queue('new', 15, 0, '120', '95', { counterEpoch: 0 }))],
    [before, sample(11000, queue('q', undefined, 0, undefined, undefined, { counterEpoch: 0 }))].map((s, i) => i ? { ...s, buffers: s.buffers.map(q => ({ ...q, pending: undefined, written: undefined, attempted: undefined })) } : s),
  ]) {
    const model = nodeBufferOverview(snapshot(history)); assert.equal(model.writtenRate, undefined); assert.equal(model.pendingDelta, undefined)
  }
  const history = [before, sample(6000), current, sample(16000, queue('q', 18, 0, '130', '100', { counterEpoch: 0 }))]
  assert.equal(nodeBufferOverview(snapshot(history)).pendingDelta, 3)
  const changed = [before, sample(6000, queue('new', 2)), sample(11000, queue('new', 4, 0, '10', '8'))]
  assert.equal(nodeBufferOverview(snapshot(changed)).pendingDelta, 2)
})

test('stale evidence retains its original measurement window without bridging the failed sample', () => {
  const history = [sample(1000, queue('q', 2)), sample(6000, queue('q', 7, 0, '10', '5')), sample(11000)]
  const stale = nodeBufferOverview(snapshot(history, history[1].buffers, 'stale', 6000))
  assert.equal(stale.writtenRate, 2); assert.equal(stale.pendingDelta, 5); assert.equal(stale.window.to, 6000)
  const next = nodeBufferOverview(snapshot([...history, sample(16000, queue('q', 8, 0, '20', '10'))]))
  assert.equal(next.writtenRate, undefined); assert.equal(next.pendingDelta, undefined)
})

test('only two anomalous queues are shown, preserving largest backlog and failed representative; zero backlog has no queue rows', () => {
  const queues = [queue('a', 100), queue('b', 90), queue('c', 80), queue('failed', 0, 2)]
  const model = nodeBufferOverview(snapshot([sample(1000, ...queues)]))
  assert.equal(model.queues.length, 2); assert.equal(model.queues[0].name, 'a'); assert.ok(model.queues.some(q => q.name === 'failed'))
  const inactive = ['a', 'b', 'c'].map(name => queue(name))
  const first = sample(1000, ...inactive, queue('writer'))
  const last = sample(6000, ...inactive, queue('writer', 0, 0, '100', '80'))
  const active = nodeBufferOverview(snapshot([first, last])); assert.deepEqual(active.queues, []); assert.equal(active.writtenRate, 20)
  assert.deepEqual(nodeBufferOverview(snapshot([sample(1000, ...inactive)])).queues, [])
})

test('unknown totals stay omitted and request/batch stages never inflate item totals', async () => {
  const known = queue('known', 10, 1, '1', '0', { writerPending: 7, wip: 2 })
  const missing = { ...queue('unknown'), pending: undefined, dead: undefined, written: undefined, attempted: undefined }
  const s = snapshot([sample(1000, known, missing)])
  const model = nodeBufferOverview(s); assert.equal(model.pending, undefined); assert.equal(model.dead, undefined)
  const html = await render({ snapshot: s, canOpen: true })
  assert.equal(model.queues[0].pending, 10); assert.doesNotMatch(html, /个请求|个批次|—/)
  assert.doesNotMatch(html, /累计统计/); assert.match(html, /速率采样中/)
})

test('details show attempts, actual window and stale time; zero-stage and unauthorized actions are omitted', async () => {
  const history = [sample(1000, queue()), sample(3500, queue('q', 0, 0, '10', '5'))]
  const html = await render({ snapshot: snapshot(history), canOpen: false })
  assert.match(html, /处理尝试速率/); assert.match(html, /2.5 秒/); assert.doesNotMatch(html, /成功处理|成功速率/)
  assert.doesNotMatch(html, /<button/); assert.doesNotMatch(html, /个请求|个批次/)
  const stale = await render({ snapshot: snapshot([...history, sample(8500)], history[1].buffers, 'stale', 3500), canOpen: true })
  assert.match(stale, /数据已过期|采样已过期|数据过期|过期/); assert.match(stale, /2.5 秒/)
})

function mount(props) {
  const originalDocument = globalThis.document
  globalThis.document = { activeElement: null }
  const event = (extra = {}) => ({ stopPropagation() {}, preventDefault() {}, ...extra })
  const make = tag => vue.markRaw({ tag, children: [], props: {}, parent: null, text: '', contains(node) { return this === node || this.children.some(child => child.contains(node)) },
    querySelector(selector) { const tags = selector.split(',').map(s => s.trim()); for (const child of this.children) { if (tags.includes(child.tag)) return child; const found = child.querySelector(selector); if (found) return found } return null },
    focus() { const old = globalThis.document.activeElement; globalThis.document.activeElement = this; old?.props.onBlur?.(event({ relatedTarget: this })); for (let p = old; p; p = p.parent) p.props.onFocusout?.(event({ relatedTarget: this })); this.props.onFocus?.(event()) } })
  const renderer = vue.createRenderer({ createElement: make, createText: text => ({ ...make('#text'), text }), createComment: () => make('#comment'),
    patchProp: (node, key, _, value) => node.props[key] = value,
    insert(node, parent, anchor) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; index < 0 ? parent.children.push(node) : parent.children.splice(index, 0, node) },
    remove(node) { node.parent?.children.splice(node.parent.children.indexOf(node), 1); node.parent = null },
    setText: (node, text) => node.text = text, setElementText: (node, text) => node.text = text, parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null })
  const root = make('root'), app = register(renderer.createApp(NodeSummary, props)); app.mount(root)
  const find = className => { const visit = node => String(node.props.class ?? '').split(' ').includes(className) ? node : node.children.map(visit).find(Boolean); return visit(root) }
  return { root, find, event, cleanup() { app.unmount(); globalThis.document = originalDocument } }
}

test('popover keyboard enters queue action, hover close preserves focus, action identifies exact node and Escape restores focus', async () => {
  const targets = [], allTargets = [], s = snapshot([sample(1000, queue('a', 2))])
  const mounted = mount({ nodeId: 'node-b', label: 'B', buffer: s, canOpenBuffer: true, onOpenQueue: target => targets.push(target), onOpenBuffers: nodeId => allTargets.push(nodeId) })
  try {
    const trigger = mounted.find('node-summary'); trigger.focus(); await vue.nextTick()
    dispatch(trigger.props.onKeydown, mounted.event({ key: 'Enter' })); await vue.nextTick(); await vue.nextTick()
    const content = mounted.find('node-popover'), button = content.querySelector('button')
    assert.equal(globalThis.document.activeElement, button)
    mounted.find('popover-contract').props.onMouseleave(); await vue.nextTick(); await vue.nextTick()
    assert.ok(mounted.find('node-popover'), 'hover exit must not close a focused action')
    button.props.onClick(mounted.event()); await vue.nextTick()
    assert.deepEqual(allTargets, ['node-b']); assert.deepEqual(targets, [])
    dispatch(trigger.props.onKeydown, mounted.event({ key: 'Enter' })); await vue.nextTick(); await vue.nextTick()
    mounted.find('node-buffer-queue').querySelector('button').props.onClick(mounted.event()); await vue.nextTick()
    assert.deepEqual(targets, [{ nodeId: 'node-b', objectName: s.queues[0].objectName }])
    assert.equal(globalThis.document.activeElement, trigger); assert.equal(trigger.props['aria-expanded'], false)
    dispatch(trigger.props.onKeydown, mounted.event({ key: 'Enter' })); await vue.nextTick(); await vue.nextTick()
    mounted.find('node-popover').props.onFocusout(mounted.event({ relatedTarget: {} })); await vue.nextTick()
    assert.equal(trigger.props['aria-expanded'], false, 'Tab to an outside target closes the popover')
    dispatch(trigger.props.onKeydown, mounted.event({ key: ' ' })); await vue.nextTick(); await vue.nextTick()
    mounted.find('node-popover').props.onKeydown(mounted.event({ key: 'Escape' })); await vue.nextTick()
    assert.equal(globalThis.document.activeElement, trigger); assert.equal(trigger.props['aria-expanded'], false)
  } finally { mounted.cleanup() }
})

test('displaying or focusing another node only reads its supplied snapshot and never performs requests', async () => {
  const one = snapshot([sample(1000, queue('one', 10))]), two = snapshot([sample(2000, queue('two', 20))])
  const first = await render({ snapshot: one }), second = await render({ snapshot: two })
  assert.match(first, />one</); assert.doesNotMatch(first, />two</); assert.match(second, />two</); assert.doesNotMatch(second, />one</)
  // Imports are restricted to pure helpers/components above; an accidental API import fails the loader.
  assert.deepEqual(one.history, [sample(1000, queue('one', 10))])
})

test('sidebar session preview shows verified zero and stale counts without inventing missing evidence', async () => {
  const ready = await renderSummary({ nodeId: 'node-a', label: 'A', session: { supported: true, state: { status: 'ready' }, sessions: '0', keepOnline: '3260' } })
  assert.match(ready, /会话 0/); assert.match(ready, /本地会话记录索引数量/)
  const stale = await renderSummary({ nodeId: 'node-a', label: 'A', session: { supported: true, state: { status: 'stale' }, sessions: '12480', keepOnline: '3260' } })
  assert.match(stale, /会话 12,480/); assert.match(stale, /node-summary-session--stale/)
  for (const session of [undefined, { supported: undefined, state: { status: 'loading' }, sessions: '4' }, { supported: false, state: { status: 'empty' }, sessions: '4' }, { supported: true, state: { status: 'ready' }, sessions: 'not-a-count' }, { supported: true, state: { status: 'ready' }, keepOnline: '4' }]) {
    const html = await renderSummary({ nodeId: 'node-a', label: 'A', session })
    assert.doesNotMatch(html, /node-summary-session/)
  }
  const source = readFileSync(resolve(host, 'views/link/RuntimeMonitor/NodeSummary.vue'), 'utf8')
  assert.match(source, /v-if="popoverSessionVisible"/)
  assert.match(source, /v-if="sessionCount"[^>]*>\{\{ t\('RuntimeMonitor\.sessionLocal'\)/)
  assert.match(source, /:trigger="\['hover', 'focus'\]"/)
  const overview = readFileSync(resolve(host, 'views/link/diagnostics/NodeOverview.vue'), 'utf8')
  assert.match(overview, /@refresh="refreshOverview"/)
  assert.match(overview, /function refreshOverview\(\) \{ view\.refresh\(\) \}/)
  assert.doesNotMatch(overview, /sessionContext\?\.refresh/)
})

test('resource popover keeps two compact rows, omits the full resource view and requests official overflow adjustment', async () => {
  const live = { cpuJvm: 2.3, cpuSystem: 17.1, memoryJvmUsed: 1024, memoryJvmTotal: 2048, memorySystemUsed: 2048, memorySystemTotal: 4096,
    diskUsed: 4096, diskTotal: 8192, networkReceiveBytesPerSecond: 1024, networkSendBytesPerSecond: 2048, health: { level: 'normal', evidence: [] } }
  const mounted = mount({ nodeId: 'node-a', label: 'A', live, buffer: snapshot([sample(1000, queue('one', 10))]), canOpenBuffer: true })
  try {
    const trigger = mounted.find('node-summary'); trigger.focus(); await vue.nextTick()
    const resource = mounted.find('node-popover-resources'), details = mounted.find('node-popover-resource-details')
    assert.ok(resource); assert.equal(resource.children.filter(child => child.props.class === 'node-popover-resource').length, 2)
    assert.equal(details, undefined)
    const source = readFileSync(resolve(host, 'views/link/RuntimeMonitor/NodeSummary.vue'), 'utf8')
    assert.match(source, /max-height:calc\(100vh - 96px\); overflow:auto/)
    assert.match(source, /:auto-adjust-overflow="true"/)
  } finally { mounted.cleanup() }
})


test('zero-backlog buffer has only summary rates plus the true all-queue entry and rounds measured seconds once', async () => {
  const history = [sample(1000, queue('a'), queue('writer')), sample(6008, queue('a'), queue('writer', 0, 0, '100', '80'))]
  const html = await render({ snapshot: snapshot(history), canOpen: true })
  assert.match(html, /全部队列.*2/); assert.match(html, /写入速率/); assert.match(html, /处理尝试速率/)
  assert.match(html, /5.0 秒/); assert.doesNotMatch(html, /5.008|node-buffer-queue|累计统计|node-buffer-counters/)
  const abnormal = await render({ snapshot: snapshot([sample(1000, queue('a', 100), queue('b', 90), queue('c', 80), queue('failed', 0, 1))]), canOpen: true })
  assert.equal((abnormal.match(/class="node-buffer-queue"/g) ?? []).length, 2)
  assert.match(abnormal, /failed/); assert.doesNotMatch(abnormal, /条\/秒/)
})

test('production host all-queue navigation clears a prior queue and routes once; exact actions validate current node evidence', () => {
  const filename = resolve(host, 'views/link/RuntimeMonitor/index.vue'), module = { exports: {} }
  const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor
  const script = compileScript(descriptor, { id: 'buffer-host-actions' })
  const navigation = [], updates = [], route = { query: { nodeId: 'node-a', tool: 'mbean', bean: 'old-bean' } }
  const preferences = { value: vue.ref({ nodes: { 'node-a': { bufferObjectName: 'old-queue' } } }), updateNode: (node, patch) => updates.push({ node, patch }), update: patch => updates.push(patch) }
  const view = { preferences, active: vue.ref(true), access: vue.ref({ enter: true, monitor: true, query: true }), scopeKey: vue.ref('scope'), discoveryScope: vue.ref('scope'),
    selected: vue.ref('node-a'), nodes: vue.ref([{ id: 'node-a' }]), runtime: { error: vue.ref(false), loading: vue.ref(false), updatedAt: vue.ref(1000) } }
  const queues = new Map([['node-a', snapshot([sample(1000, queue('q'))])]])
  new Function('require', 'module', 'exports', transformSync(script.content, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-router') return { useRoute: () => route, useRouter: () => ({ replace: value => navigation.push(value) }) }
    if (id === 'vue-i18n') return { useI18n: () => ({ t }) }
    if (id === './useClusterWorkspace') return { useClusterWorkspace: () => view }
    if (id === './useClusterSidebarLayout') return { useClusterSidebarLayout: () => ({}) }
    if (id === './useClusterBuffers') return { provideClusterBuffers: () => ({ snapshots: vue.ref(queues) }) }
    if (id === './useClusterSessions') return { useClusterSessionContext: () => ({ snapshots: vue.ref(new Map()) }) }
    if (id.endsWith('.vue')) return { default: empty }
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }, module, module.exports)
  const scope = vue.effectScope()
  try {
    const bindings = scope.run(() => module.exports.default.setup({}, { expose() {} }))
    bindings.openBufferQueue({ nodeId: 'node-a' })
    assert.equal(navigation.length, 1); assert.equal(navigation[0].query.tool, 'overview'); assert.equal(navigation[0].query.bean, undefined)
    assert.ok(Object.hasOwn(updates[0].patch, 'bufferObjectName')); assert.equal(updates[0].patch.bufferObjectName, undefined)
    assert.ok(Object.hasOwn(updates[0].patch, 'bufferVisibleObjectNames')); assert.equal(updates[0].patch.bufferVisibleObjectNames, undefined)
    bindings.openBufferQueue({ nodeId: 'node-a', objectName: queues.get('node-a').queues[0].objectName })
    assert.equal(navigation.length, 2); assert.equal(updates[2].patch.bufferObjectName, queues.get('node-a').queues[0].objectName)
    assert.deepEqual(updates[2].patch.bufferVisibleObjectNames, [queues.get('node-a').queues[0].objectName])
    bindings.openBufferQueue({ nodeId: 'node-a', objectName: 'removed' }); bindings.openBufferQueue({ nodeId: 'other' })
    view.access.value.monitor = false; bindings.openBufferQueue({ nodeId: 'node-a' })
    assert.equal(navigation.length, 2)
  } finally { scope.stop() }
})
test('sidebar independent communication keeps true zero rate visible without squeezing the node identity',async()=>{
 const communication={supported:true,state:{status:'ready',sampledAt:7000},history:[{timestamp:4000,startTime:'1000',counters:{upstreamMessages:'7'}},{timestamp:7000,startTime:'1000',counters:{upstreamMessages:'7'}}]}
 const html=await renderSummary({nodeId:'iot-service:8200',label:'iot-service:8200',session:{supported:false,state:{status:'empty'},communication}})
 assert.match(html,/上行 0\/s/);assert.match(html,/>iot-service:8200<\/strong>/)
 assert.doesNotMatch(html,/会话 0/)
})

test('sidebar QPS preserves packet semantics and marks retained rates or session gaps after a pause',async()=>{
 const history=[{timestamp:4000,startTime:'1000',counters:{upstreamMessages:'3',receivedPackets:'6',sentPackets:'3'}},{timestamp:7000,startTime:'1000',counters:{upstreamMessages:'6',receivedPackets:'12',sentPackets:'6'},qps:{ready:true,timestamp:6900,windowMillis:1000,sequence:'69',values:{receivedQps:4,sentQps:3,communicationQps:7}}}]
 const session={supported:true,state:{status:'ready'},sessions:'3',history:[{timestamp:7000,value:'3'}],communication:{supported:true,state:{status:'ready',sampledAt:7000},history}}
 let html=await renderSummary({nodeId:'iot',label:'iot',session});assert.match(html,/通信 7 次\/s/);assert.doesNotMatch(html,/class="node-summary-session node-summary-session--stale"/)
 html=await renderSummary({nodeId:'iot',label:'iot',session:{...session,communication:{...session.communication,history:[...history,{timestamp:7000}]}}});assert.match(html,/class="node-summary-session node-summary-session--stale"/);assert.match(html,/上次采集/)
 html=await renderSummary({nodeId:'iot',label:'iot',session:{...session,history:[...session.history,{timestamp:8000}]}});assert.match(html,/class="node-summary-session node-summary-session--stale"/)
})
