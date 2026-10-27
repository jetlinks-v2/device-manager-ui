import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../views/link')
const flush = async () => { await vue.nextTick(); await vue.nextTick() }
function load(relative, imports = {}, inline = false) {
  const filename = resolve(root, relative), source = readFileSync(filename, 'utf8')
  const content = relative.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'host-presentation', inlineTemplate: inline }).content : source
  const { code } = transformSync(content, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => imports[id] ?? (id === '@jetlinks-web-core/components/RuntimeDiagnostics' ? {} : id === 'vue' ? vue : id.startsWith('@ant-design/icons-vue') || id.endsWith('.vue') ? {} : require(id)), module, module.exports)
  return module.exports.default ?? module.exports
}

function layoutHarness(t) {
  const original = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver }
  const hooks = { activated: [], deactivated: [] }, listeners = new Map(), frames = new Map(), observers = []
  const viewport = new EventTarget(), parentElement = { scrollTop: 0 }, rect = { top: 64, width: 900, height: 1600 }
  Object.assign(viewport, { offsetTop: 0, height: 853 })
  let sequence = 0
  globalThis.window = { innerHeight: 853, visualViewport: viewport,
    getComputedStyle: element => ({ paddingBottom: '0px', borderBottomWidth: '0px', marginBottom: '0px', ...element.style }),
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence },
    cancelAnimationFrame: id => frames.delete(id),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  }
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe(target) { this.targets.push(target) }
    disconnect() { this.disconnected = true }
  }
  t.after(() => { globalThis.window = original.window; globalThis.ResizeObserver = original.ResizeObserver })
  const scope = vue.effectScope(), enabled = vue.ref(true), element = { isConnected: true, parentElement, getBoundingClientRect: () => rect }
  const hook = load('RuntimeMonitor/useLogWorkspaceLayout.ts', { vue: { ...vue, onActivated: callback => hooks.activated.push(callback), onDeactivated: callback => hooks.deactivated.push(callback) } })
  const style = scope.run(() => hook.useLogWorkspaceLayout(vue.shallowRef(element), enabled))
  return { scope, style, enabled, element, rect, listeners, frames, observers, viewport,
    frame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) },
    lifecycle: name => hooks[name].forEach(callback => callback()),
  }
}

test('log layout bounds an oversized natural page by its measured top and resizes without a fixed chrome offset', async t => {
  const h = layoutHarness(t)
  try {
    assert.equal(h.style.value['--runtime-log-available-height'], '789px', 'natural 1600px content does not become the viewport height')
    h.rect.top = 116; h.rect.height = 2400; h.viewport.height = 640
    h.listeners.get('resize')(); h.observers[0].callback()
    assert.equal(h.frames.size, 1, 'layout events share one animation frame')
    h.frame(); assert.equal(h.style.value['--runtime-log-available-height'], '524px')
    h.viewport.offsetTop = 32; h.viewport.height = 400; h.viewport.dispatchEvent(new Event('resize')); h.frame()
    assert.equal(h.style.value['--runtime-log-available-height'], '316px')
    h.rect.top = 900; h.listeners.get('scroll')(); h.frame()
    assert.equal(h.style.value['--runtime-log-available-height'], '0px', 'an offscreen work area cannot receive negative geometry')
  } finally { h.scope.stop() }
})

test('outer scrolling cannot grow log height and ancestor bottom spacing stays inside the viewport', t => {
  const h = layoutHarness(t)
  try {
    const parent = h.element.parentElement
    parent.style = { paddingBottom: '16px', borderBottomWidth: '2px' }
    parent.parentElement = { scrollTop: 0, style: { paddingBottom: '12px', marginBottom: '6px' } }
    h.listeners.get('resize')(); h.frame()
    assert.equal(h.style.value['--runtime-log-available-height'], '753px')
    // 浏览器外层滚动会等量减少 rect.top；滚动后的内容坐标不应变成新的高度预算。
    parent.scrollTop = 80; parent.parentElement.scrollTop = 16; h.rect.top = -32
    h.listeners.get('scroll')(); h.frame()
    assert.equal(h.style.value['--runtime-log-available-height'], '753px')
    h.element.scrollTop = 500; h.listeners.get('scroll')(); h.frame()
    assert.equal(h.style.value['--runtime-log-available-height'], '753px', 'reading log rows does not resize the page')
    h.viewport.height = 640; h.listeners.get('resize')(); h.frame()
    assert.equal(h.style.value['--runtime-log-available-height'], '540px', 'actual viewport resizing still updates the budget')
  } finally { h.scope.stop() }
})

test('inactive routes and cached pages remove layout constraints, observers and pending frames', async t => {
  const h = layoutHarness(t)
  try {
    h.listeners.get('resize')(); assert.equal(h.frames.size, 1)
    h.enabled.value = false; await flush()
    assert.equal(h.style.value, undefined); assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0); assert.equal(h.observers[0].disconnected, true)
    h.viewport.dispatchEvent(new Event('resize')); assert.equal(h.frames.size, 0)
    h.rect.top = 80; h.enabled.value = true; await flush()
    assert.equal(h.style.value['--runtime-log-available-height'], '773px')
    h.lifecycle('deactivated'); await flush()
    assert.equal(h.style.value, undefined); assert.equal(h.listeners.size, 0)
    h.lifecycle('activated'); await flush()
    assert.equal(h.style.value['--runtime-log-available-height'], '773px')
    h.listeners.get('resize')(); h.scope.stop()
    assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0)
    assert.ok(h.observers.every(observer => observer.disconnected))
  } finally { h.scope.stop() }
})

test('monitor settings retain the interval permission and preference contract and close on scope changes', async () => {
  const calls = [], scope = vue.effectScope()
  const access = vue.ref({ enter: true, monitor: true, logs: true }), selected = vue.ref('node-a'), active = vue.ref(true)
  const preferences = { value: vue.ref({ bufferIntervalSeconds: 5 }), update: value => calls.push(value), clear: () => calls.push('clear') }
  const view = { access, selected, active, preferences, showNodeSelector: vue.ref(false), scopeKey: vue.ref('scope-a'), tab: vue.ref('overview'), nodes: vue.ref([{ id: 'node-a' }]), runtime: { error: vue.ref(false), loading: vue.ref(false), updatedAt: vue.ref('') }, filtered: vue.ref([]) }
  const page = load('RuntimeMonitor/index.vue', {
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({}) },
    './useClusterWorkspace': { useClusterWorkspace: () => view },
    './useLogWorkspaceLayout': { useLogWorkspaceLayout: () => vue.ref(undefined) },
    './useClusterSidebarLayout': { useClusterSidebarLayout: () => ({}) },
    './useClusterBuffers': { provideClusterBuffers: () => ({ snapshots: vue.ref(new Map()) }) },
    './useClusterSessions': { useClusterSessionContext: () => ({ snapshots: vue.ref(new Map()) }) },
    '../RuntimeMonitor/useClusterSessions': { useClusterSessionContext: () => undefined },
    '../diagnostics/preferences': { bufferIntervals: [1, 2, 5, 10, 30, 60], diagnosticIntervalSeconds: value => value ?? 2 },
  })
  const state = scope.run(() => page.setup({}, { expose() {} }))
  try {
    state.settingsOpen.value = false; state.openSettings(); await flush()
    assert.equal(state.settingsOpen.value, true, 'Buffer chart settings reuse the existing monitor preference popover')
    state.settingsOpen.value = true; state.setBufferInterval(30)
    assert.deepEqual(calls, [{ bufferIntervalSeconds: 30 }])
    state.setBufferInterval('30'); state.setBufferInterval(3)
    assert.equal(calls.length, 1)
    access.value = { ...access.value, monitor: false }
    assert.equal(state.settingsOpen.value, false)
    state.setBufferInterval(60); assert.equal(calls.length, 1)
    state.settingsOpen.value = true; state.clearPreferences()
    assert.equal(calls.at(-1), 'clear'); assert.equal(state.settingsOpen.value, false)
    state.settingsOpen.value = true; selected.value = 'node-b'
    assert.equal(state.settingsOpen.value, false)
    state.settingsOpen.value = true; active.value = false
    assert.equal(state.settingsOpen.value, false)
  } finally { scope.stop() }
})

test('runtime monitor uses a document-flow grid and forwards buffer settings without replacing the cached workspace', () => {
  const monitor = readFileSync(resolve(root, 'RuntimeMonitor/index.vue'), 'utf8')
  const workspace = readFileSync(resolve(root, 'RuntimeMonitor/RuntimeNodeWorkspace.vue'), 'utf8')
  const diagnostics = readFileSync(resolve(root, 'diagnostics/NodeDiagnostics.vue'), 'utf8')
  const overview = readFileSync(resolve(root, 'diagnostics/NodeOverview.vue'), 'utf8')
  assert.match(monitor, /class="runtime-monitor-grid"/)
  assert.match(monitor, /id="runtime-monitor-node-sidebar" v-show="sidebar\.expanded\.value"/)
  assert.match(monitor, /:aria-expanded="sidebar\.expanded\.value" aria-controls="runtime-monitor-node-sidebar"/)
  assert.match(monitor, /<template v-if="sidebar\.canToggle\.value" #node-leading>/)
  assert.doesNotMatch(monitor, /<EqualHeightColumns/)
  assert.match(monitor, /<KeepAlive :key="workspaceKey" :max="8">/)
  assert.match(monitor, /@settings="openSettings"/)
  assert.match(workspace, /@settings="emit\('settings'\)"/)
  assert.match(diagnostics, /<slot name="node-leading" \/>/)
  assert.match(diagnostics, /@settings="emit\('settings'\)"/)
  assert.match(overview, /@settings="emit\('settings'\)"/)
  assert.match(monitor, /cluster-detail--jvm/)
  assert.match(monitor, /\.cluster-detail--jvm \{ display:flex; flex-direction:column; min-height:0; overflow:hidden; \}/)
  assert.match(monitor, /\.cluster-detail--jvm > :deep\(\.node-diagnostics\) \{ flex:1 1 0; min-height:0; \}/)
  assert.match(diagnostics, /class="node-jvm-canvas"/)
  assert.match(diagnostics, /\.node-diagnostics--jvm \{ display:flex; flex:1 1 0; flex-direction:column; min-height:0; overflow:hidden; \}/)
  assert.match(diagnostics, /\.node-jvm-canvas \{ display:flex; flex:1 1 0; min-height:0; overflow:auto; \}/)
  assert.match(diagnostics, /\.node-jvm-canvas > :deep\(\.jvm-panel\) \{ display:flex; flex:1 1 0; flex-direction:column; min-height:0; \}/)
})

test('resource summary uses neutral capacity colors and keeps thread and GC evidence with JVM', () => {
  const meter = readFileSync(resolve(root, 'diagnostics/NodeResourceMeter.vue'), 'utf8')
  const summary = readFileSync(resolve(root, 'diagnostics/NodeResourceSummary.vue'), 'utf8')
  assert.doesNotMatch(meter, /percent >= 70|percent >= 90|meter-warning|meter-error/)
  assert.match(meter, /const color = computed\(\(\) => token\.value\.colorPrimary\)/)
  assert.match(meter, /\.meter-capacity-track > span \{[^}]*line-height:18px/)
  assert.match(summary, /class="node-resource-jvm-metrics"/)
  assert.match(summary, /\['threads', 'gc'\]/)
  assert.doesNotMatch(summary, /node-resource-counts/)
})

test('diagnostic controls share compact navigation, actionable capture confirmation and menu cleanup contracts', () => {
  const core = resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics')
  const styles = readFileSync(resolve(core, 'style.css'), 'utf8')
  const viewer = readFileSync(resolve(core, 'LogViewer.vue'), 'utf8')
  const metrics = readFileSync(resolve(core, 'RuntimeMetricsPanel.vue'), 'utf8')
  const range = readFileSync(resolve(core, 'history/HistoryRangeControl.vue'), 'utf8')
  const capture = readFileSync(resolve(root, 'diagnostics/DiagnosticCapture.vue'), 'utf8')
  const diagnostics = readFileSync(resolve(root, 'diagnostics/NodeDiagnostics.vue'), 'utf8')
  assert.match(styles, /\.diagnostics-compact-toolbar \{ display:flex; align-items:center; flex-wrap:wrap; gap:var\(--space-2,8px\); min-width:0; \}/)
  assert.match(styles, /\.diagnostics-mode-tabs\.ant-tabs-small > \.ant-tabs-nav::before \{ border-bottom:0; \}/)
  assert.match(styles, /\.diagnostics-mode-tabs\.ant-tabs-small > \.ant-tabs-nav \.ant-tabs-tab \{ min-height:32px; margin:0; padding:0 var\(--space-2,8px\);[^}]*line-height:32px; \}/)
  assert.match(styles, /\.diagnostics-mode-tabs\.ant-tabs-small > \.ant-tabs-nav \.ant-tabs-tab \+ \.ant-tabs-tab \{ margin:0; \}/)
  assert.match(metrics, /class="diagnostics-compact-toolbar history-toolbar"/)
  assert.match(range, /class="history-range-trigger" type="text" size="small"/)
  assert.match(viewer, /@keydown\.esc\.stop="closeMenus\(true\)"/)
  assert.match(viewer, /class="log-disabled-action" tabindex="0" :aria-label="exportReason"/)
  assert.match(viewer, /watch\(\(\) => props\.fileId, \(\) => \{ activeMatch\.value = ''; detailId\.value = ''; closeMenus\(\); reading\.reset\(\) \}\)/)
  assert.match(capture, /:ok-text="t\(kind === 'jfr' \? 'runtimeDiagnostics\.startRecording' : 'runtimeDiagnostics\.exportHeapSnapshot'\)"/)
  assert.match(diagnostics, /:active="active && tab === 'jvm'"/)
})

test('the host composes one top file-picker entry and keeps real trace/time context without starting collection', async () => {
  const traceId = '11111111111111111111111111111111', calls = [], file = { providerId: 'java', id: 'current', name: 'current.log', operations: ['read'] }
  const logs = { parents: vue.ref([{ id: 'logs' }]), parent: () => calls.push('parent'), notice: vue.ref(''), entries: vue.ref([]), catalog: { data: vue.ref([file]), state: vue.ref({ status: 'ready' }) }, filePath: vue.ref('logs/current.log'), providers: { data: vue.ref([{ id: 'java' }]), state: vue.ref({ status: 'ready' }) }, consoleAvailable: vue.ref(true), windowQuery: { state: vue.ref({ status: 'ready' }) }, fileId: vue.ref('current'), file: vue.ref(file), state: vue.ref({ status: 'ready' }), filter: vue.ref(''), config: vue.ref({}), following: vue.ref(false), windowData: vue.ref({}), clipped: vue.ref(false), loadingDirection: vue.ref(''), exportQuery: { state: vue.ref({ status: 'ready' }) }, search: value => calls.push(value) }
  const viewer = vue.defineComponent({ props: ['files'], setup: (props, { slots }) => () => vue.h('div', { class: 'file-toolbar' }, [slots.source?.(), slots['file-selector']?.()]) })
  const panel = load('diagnostics/NodeLogPanel.vue', {
    '@ant-design/icons-vue': Object.fromEntries(['CloseOutlined', 'DownOutlined', 'FolderOpenOutlined'].map(name => [name, { render: () => vue.h('span') }])),
    'vue-i18n': { useI18n: () => ({ t: (key, values) => values?.time ?? key }) },
    'vue-router': { useRoute: () => ({ query: { logFrom: '1000', logTo: '2000', spanId: 'span-a' } }), useRouter: () => ({}) },
    '@jetlinks-web-core/components/RuntimeDiagnostics': { LogViewer: viewer },
    './useNodeLogs': { useNodeLogs: () => logs, logFileKey: value => value.id },
    './useDiagnosticsAccess': { useDiagnosticsAccess: () => vue.ref({ logs: true, trace: true, exportLogs: false }) },
    './useRuntimeConsole': { useRuntimeConsole: () => ({ status: vue.ref('idle'), entries: vue.ref([]), clipped: vue.ref(false), following: vue.ref(false) }) },
    './useLogExplorerLayout': { useLogExplorerLayout: () => ({ open: vue.ref(false) }) },
    '@vueuse/core': { useElementVisibility: () => vue.ref(false) },
  }, true)
  const app = vue.createSSRApp(panel, { nodeId: 'node-a', active: true, traceId })
  app.component('ATooltip', { inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  app.component('AButton', { setup: (_, { slots, attrs }) => () => vue.h('button', attrs, slots.default?.()) })
  for (const name of ['APopover', 'ARadioGroup', 'ARadioButton']) app.component(name, { inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  app.component('AAlert', { render: () => vue.h('div') })
  const html = (await renderToString(app)).replace(/<!--.*?-->/g, '')
  assert.match(html, /class="file-toolbar/)
  assert.equal((html.match(/class="log-current-file"/g) ?? []).length, 1)
  assert.match(html, /aria-label="runtimeDiagnostics.fileDirectory: current.log" aria-expanded="false"/)
  assert.doesNotMatch(html, /node-log-directory|log-current-directory|<select/)
  assert.match(html, new RegExp(traceId)); assert.match(html, /Span span-a/)
  assert.deepEqual(calls, [traceId], 'rendering context never selects a file, navigates a directory or starts following')
})

test('node heading keeps the action independent of lifetime fields and exposes sampling time through keyboard metadata', async () => {
  const tool = { useI18n: () => ({ t: (key, values) => values?.time ? `Updated at ${values.time}` : key }) }
  const panel = load('diagnostics/NodeDiagnostics.vue', {
    'vue-i18n': tool,
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({}) },
    '@jetlinks-web-core/components/RuntimeDiagnostics': {},
    './useNodeDiagnostics': { useNodeDiagnostics: () => ({}) },
    './useJvmDiagnostics': { useJvmDiagnostics: () => ({}) },
    './useDeviceSessions': { useDeviceSessions: () => ({}) },
    './useDiagnosticsAccess': { useDiagnosticsAccess: () => vue.ref({ monitor: false, logs: false }) },
    './diagnosis/useNodeBottlenecks': { useNodeBottlenecks: () => ({ issues: vue.ref([]) }) },
    './diagnosis/bottleneckRules': { nodeAttentionStatus: () => ({ count: 0, evidence: [], current: [], retained: [], level: 'default' }) },
    '../RuntimeMonitor/nodeSummary': { hasNodeMonitoringData: () => true },
    '../RuntimeMonitor/useClusterSessions': { useClusterSessionContext: () => undefined },
    '../useRuntimeWorkspace': { useRuntimeWorkspaceNavigation: () => undefined },
  }, true)
  const app = vue.createSSRApp({ render: () => vue.h(panel, {
    nodeId: 'node-a', tab: 'logs', sampledAt: '15:30:24', metrics: [
      { key: 'startTime', label: 'Started', value: '2026-10-24 10:00:00' },
      { key: 'uptime', label: 'Uptime', value: '5h 30m' },
    ],
  }, { actions: () => vue.h('button', { class: 'gear' }, 'Settings') }) })
  app.component('ATooltip', { inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() })
  app.component('ABadge', { props: ['text'], setup: props => () => vue.h('span', { class: 'status' }, props.text) })
  app.component('ATabs', { render: () => vue.h('div') })
  app.component('ATabPane', { render: () => null })
  app.component('AAlert', { render: () => null })
  const html = (await renderToString(app)).replace(/<!--.*?-->/g, '')
  assert.match(html, /<strong tabindex="0" aria-label="node-a · Updated at 15:30:24">node-a<\/strong>/)
  assert.match(html, /Started<\/span> 2026-10-24 10:00:00/)
  assert.match(html, /Uptime<\/span> 5h 30m/)
  assert.match(html, /runtimeDiagnostics.normal/)
  assert.match(html, /<\/div><span class="node-header-actions"><button class="gear">Settings<\/button><\/span><\/header>/)
  assert.doesNotMatch(html, /node-timestamp/)
})
