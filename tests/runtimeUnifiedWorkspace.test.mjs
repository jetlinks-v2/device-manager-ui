import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
function harness(options = {}) {
  const route = vue.reactive({ path: options.path ?? '/infrastructure/runtime-monitor', query: options.query ?? {} })
  const access = vue.ref({ enter: true, monitor: true, trace: true, sessions: true, ...options.access })
  const identity = vue.ref({ accountId: 'alice', projectId: 'p1' }), navigation = [], deactivations = [], activations = [], cache = new Map()
  const router = { replace: async target => { navigation.push(target); route.path = target.path ?? route.path; route.query = target.query } }
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => {
      if (id === 'vue') return { ...vue, provide() {}, onDeactivated: fn => deactivations.push(fn), onActivated: fn => activations.push(fn) }
      if (id === 'vue-router') return { useRoute: () => route, useRouter: () => router }
      if (id.endsWith('useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
      if (id.endsWith('useDiagnosticScope')) return { useDiagnosticScope: () => identity }
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }, module, module.exports)
    cache.set(path, module.exports); return module.exports
  }
  const module = load(resolve(import.meta.dirname, '../views/link/useRuntimeWorkspace.ts')), scope = vue.effectScope()
  const view = scope.run(module.useRuntimeWorkspace), panel = { scrollTop: 0, scrollLeft: 0 }
  view.root.value = { closest: () => panel }
  return { ...view, module, scope, route, access, identity, navigation, panel, deactivations, activations }
}

function mountWorkspace(h, sessionSnapshots = new Map([['iot', { supported: true }]])) {
  const mounted = { cluster: 0, tracing: 0, connections: 0 }
  const preferences = { value: vue.ref({ bufferIntervalSeconds: 3 }) }
  let sessionInterval
  const child = name => vue.defineComponent({
    props: ['active'],
    setup: props => { mounted[name]++; return () => vue.h('div', { 'data-view': name, 'data-active': props.active }) },
  })
  const cluster = child('cluster'), tracing = child('tracing'), connections = child('connections')
  const tabs = vue.defineComponent({
    props: ['activeKey', 'options'], emits: ['change'],
    setup: (props, { emit }) => () => vue.h('nav', props.options.map(option => vue.h('button', {
      'aria-selected': option.key === props.activeKey, onClick: () => emit('change', option.key),
    }, option.label))),
  })
  const filename = resolve(import.meta.dirname, '../views/link/RuntimeWorkspace.vue')
  const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor
  const script = compileScript(descriptor, { id: 'unified-workspace', inlineTemplate: true }).content
  const { code } = transformSync(script, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  const imports = {
    vue: { ...vue, defineAsyncComponent: () => connections },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web-core/components/SlantedTabs': { __esModule: true, default: tabs },
    './RuntimeMonitor/index.vue': { __esModule: true, default: cluster },
    './Tracing/index.vue': { __esModule: true, default: tracing },
    './RuntimeMonitor/useClusterWorkspace': { provideClusterWorkspace: () => ({ nodes: vue.ref([{ id: 'iot', alias: 'IoT' }]), scopeKey: vue.ref('scope'), discoveryScope: vue.ref('scope'), preferences }) },
    './RuntimeMonitor/useClusterSessions': { provideClusterSessions: (...args) => { sessionInterval = args[5]; return { snapshots: vue.ref(sessionSnapshots) } } },
    './diagnostics/preferences': { diagnosticIntervalSeconds: value => value ?? 3 },
    './diagnostics/collection/provideMBeanCollection': { provideMBeanCollection: () => ({}) },
    './useRuntimeWorkspace': { useRuntimeWorkspace: () => h, clusterSessionSupport: h.module.clusterSessionSupport },
  }
  new Function('require', 'module', 'exports', code)(id => imports[id] ?? require(id), module, module.exports)
  const node = (type, text = '') => ({ type, text, props: {}, style: {}, children: [], parent: null, closest: () => h.panel })
  const renderer = vue.createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text },
    patchProp: (target, key, _old, value) => { target.props[key] = value },
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, target); target.parent = parent
    },
    remove(target) { target.parent?.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1],
  })
  const container = node('root'), app = renderer.createApp(module.exports.default)
  app.component('PageChrome', { props: { flush: Boolean }, setup: (props, { slots }) => () => vue.h('header', { 'data-flush': props.flush }, slots.default?.()) })
  app.mount(container)
  return { app, root: container.children[0], mounted, preferences, sessionInterval }
}

test('one flush platform header keeps all three view instances while switching the active content', async () => {
  const h = harness(), rendered = mountWorkspace(h)
  try {
    const header = rendered.root.children.find(node => node.type === 'header')
    const views = rendered.root.children.filter(node => node.type === 'section')
    assert.equal(header.props['data-flush'], true)
    assert.equal(rendered.sessionInterval.value, 3)
    rendered.preferences.value.value = { bufferIntervalSeconds: 60 }
    assert.equal(rendered.sessionInterval.value, 60, 'session sampler follows the same persisted overview interval as Buffer')
    assert.equal(header.children[0].children.length, 3)
    assert.equal(views.length, 3)
    assert.ok(views.every(node => node.props.class === 'runtime-workspace__view'), 'all views share the same unadorned content surface')
    const instances = views.map(node => node.children[0])
    assert.equal(views[0].style.display, undefined); assert.equal(views[1].style.display, 'none')
    header.children[0].children[1].props.onClick(); await flush()
    assert.equal(h.view.value, 'tracing'); assert.equal(views[0].style.display, 'none'); assert.equal(views[1].style.display, undefined)
    assert.equal(instances[1].props['data-active'], true)
    header.children[0].children[2].props.onClick(); await flush()
    assert.equal(h.view.value, 'connections'); assert.equal(instances[2].props['data-active'], true)
    header.children[0].children[0].props.onClick(); await flush()
    assert.deepEqual(rendered.mounted, { cluster: 1, tracing: 1, connections: 1 })
    assert.deepEqual(views.map(node => node.children[0]), instances, 'outer navigation does not remount child workspaces')
  } finally { rendered.app.unmount(); h.scope.stop() }
})

test('both monitor routes inherit the platform panel background and spacing instead of transparent overrides', () => {
  const filename = resolve(import.meta.dirname, '../index.ts')
  const source = readFileSync(filename, 'utf8').replace("import.meta.glob('./views/**/index.vue')", '{}')
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
    if (id === '@jetlinks-web-core/utils/module-registry') return { moduleRegistry: {} }
    if (id === './unifiedDeviceMenu') return { getUnifiedDeviceMenuFilters() {} }
    return {}
  }, module, module.exports)
  const overrides = module.exports.default.getContentPanelOverrides()
  assert.equal(overrides['link/DashBoard'], false)
  assert.equal(Object.hasOwn(overrides, 'link/RuntimeMonitor'), false)
  assert.equal(Object.hasOwn(overrides, 'link/Tracing'), false)
})

test('sessions-only authorization exposes an unknown-capability query entry without inventing support or ignoring confirmed absence', () => {
  const h = harness({ access: { monitor: false } }), unknown = new Map(), rendered = mountWorkspace(h, unknown)
  try {
    const header = rendered.root.children.find(node => node.type === 'header')
    assert.equal(header.children[0].children.length, 3)
    assert.equal(h.module.clusterSessionSupport(['iot'], unknown), undefined)
  } finally { rendered.app.unmount(); h.scope.stop() }
  const absent = harness({ access: { monitor: false } }), hidden = mountWorkspace(absent, new Map([['iot', { supported: false }]]))
  try {
    const header = hidden.root.children.find(node => node.type === 'header')
    assert.equal(header.children[0].children.length, 2)
  } finally { hidden.app.unmount(); absent.scope.stop() }
})

test('top-level switches retain independent cluster, trace and connection query and page scroll', async () => {
  const h = harness({ query: { nodeId: 'cluster-a', tool: 'mbean', bean: 'bean:a' } })
  try {
    h.panel.scrollTop = 110; h.selectView('tracing'); await flush()
    assert.deepEqual(h.route.query, { view: 'tracing' })
    assert.equal(h.panel.scrollTop, 0)
    h.route.query = { view: 'tracing', traceId: 'a'.repeat(32), span: 'leaf', nodeId: 'trace-b' }; await flush()
    h.panel.scrollTop = 220; h.selectView('connections'); await flush()
    assert.deepEqual(h.route.query, { view: 'connections' })
    h.route.query = { view: 'connections', nodeId: 'connection-c', deviceId: 'device' }; await flush()
    h.panel.scrollTop = 330; h.selectView('cluster'); await flush()
    assert.deepEqual(h.route.query, { nodeId: 'cluster-a', tool: 'mbean', bean: 'bean:a', view: 'cluster' })
    assert.equal(h.panel.scrollTop, 110)
    h.selectView('tracing'); await flush()
    assert.deepEqual(h.route.query, { view: 'tracing', traceId: 'a'.repeat(32), span: 'leaf', nodeId: 'trace-b' })
    assert.equal(h.panel.scrollTop, 220)
    h.selectView('connections'); await flush()
    assert.deepEqual(h.route.query, { view: 'connections', deviceId: 'device' })
    assert.equal(h.panel.scrollTop, 330)
  } finally { h.scope.stop() }
})

test('old trace and sessions links retain only their relevant context, while trace-only keeps its registered route', async () => {
  const both = harness({ path: '/infrastructure/tracing', query: { traceId: 'a'.repeat(32), spanId: 'leaf', nodeId: 'a', tool: 'logs' } })
  const traceOnly = harness({ path: '/infrastructure/tracing', query: { traceId: 'b'.repeat(32), span: 'root' }, access: { enter: false, monitor: false, sessions: false } })
  const sessions = harness({ query: { tool: 'sessions', nodeId: 'a', deviceId: 'device', traceId: 'old' } })
  try {
    await flush()
    assert.equal(both.route.path, '/infrastructure/runtime-monitor')
    assert.deepEqual(both.route.query, { traceId: 'a'.repeat(32), spanId: 'leaf', nodeId: 'a', view: 'tracing' })
    assert.equal(traceOnly.view.value, 'tracing'); assert.equal(traceOnly.navigation.length, 0)
    traceOnly.selectView('cluster'); traceOnly.selectView('connections'); await flush()
    assert.equal(traceOnly.route.path, '/infrastructure/tracing'); assert.equal(traceOnly.navigation.length, 0)
    assert.deepEqual(sessions.route.query, { deviceId: 'device', view: 'connections' })
  } finally { both.scope.stop(); traceOnly.scope.stop(); sessions.scope.stop() }
})

test('overview connection navigation preserves the submitted device query without constraining its node results', async () => {
  const h = harness({ query: { view: 'connections', nodeId: 'old-node', deviceId: 'device-205' } })
  try {
    h.selectView('cluster'); await flush()
    h.route.query = { view: 'cluster', nodeId: 'iot-service:8200', tool: 'overview', bean: 'cluster-only' }; await flush()
    h.navigateView('connections', { nodeId: 'iot-service:8200' }); await flush()
    assert.deepEqual(h.route.query, { view: 'connections', deviceId: 'device-205' })
    h.selectView('cluster'); await flush()
    assert.deepEqual(h.route.query, { view: 'cluster', nodeId: 'iot-service:8200', tool: 'overview', bean: 'cluster-only' })
    h.access.value = { ...h.access.value, sessions: false }; await flush()
    const count = h.navigation.length
    h.navigateView('connections', { nodeId: 'iot-service:8200' }); await flush()
    assert.equal(h.navigation.length, count, 'the shared navigation rechecks the destination grant')
  } finally { h.scope.stop() }
})

test('inactive cached shells do not project URLs, and identity or revoked access discards per-view snapshots', async () => {
  const h = harness({ query: { nodeId: 'a', tool: 'mbean', bean: 'secret' } })
  try {
    h.selectView('tracing'); await flush()
    h.deactivations.forEach(fn => fn())
    h.route.path = '/infrastructure/tracing'; h.route.query = { traceId: 'b'.repeat(32) }; await flush()
    const count = h.navigation.length
    h.selectView('cluster'); await flush(); assert.equal(h.navigation.length, count)
    h.identity.value = { accountId: 'bob', projectId: 'p2' }; await flush()
    h.activations.forEach(fn => fn()); await flush()
    h.selectView('cluster'); await flush()
    assert.deepEqual(h.route.query, { view: 'cluster' })
    h.route.query = { view: 'cluster', tool: 'logs', nodeId: 'b' }; await flush()
    h.selectView('tracing'); await flush()
    h.access.value = { ...h.access.value, enter: false }; await flush()
    h.access.value = { ...h.access.value, enter: true }; await flush()
    h.selectView('cluster'); await flush(); assert.deepEqual(h.route.query, { view: 'cluster' })
  } finally { h.scope.stop() }
})

test('connection support uses the entire confirmed directory, preserves unknown and accepts zero-valued support', () => {
  const h = harness()
  try {
    const support = h.module.clusterSessionSupport
    assert.equal(support([], new Map()), undefined)
    assert.equal(support(['a', 'b'], new Map([['a', { supported: false }]])), undefined)
    assert.equal(support(['a', 'b'], new Map([['a', { supported: false }], ['b', { supported: true, sessions: '0' }]])), true)
    assert.equal(support(['a', 'b'], new Map([['a', { supported: false }], ['b', { supported: false }]])), false)
    assert.equal(support(['a'], new Map([['a', { supported: false }], ['removed', { supported: true }]])), false)
  } finally { h.scope.stop() }
})

test('menu projection preserves independent trace authorization and localizes the only visible trace-only entry', () => {
  let language = 'en'
  const source = readFileSync(resolve(import.meta.dirname, '../unifiedDeviceMenu.ts'), 'utf8'), { code } = transformSync(source, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => id === '@jetlinks-web-core/locales' ? { __esModule: true, default: { global: { t: () => language === 'en' ? 'Runtime monitoring' : '运行监控' } } } : require(id), module, module.exports)
  const filter = module.exports.getUnifiedDeviceMenuFilters()[0].filter
  const trace = { code: 'link/Tracing', url: '/infrastructure/tracing', name: 'Tracing', i18nName: 'Tracing', buttons: [{ id: 'query' }] }
  const runtime = { code: 'link/RuntimeMonitor', url: '/infrastructure/runtime-monitor', name: 'Runtime' }
  const both = filter([{ code: 'link', children: [runtime, trace] }])[0].children
  assert.equal(both[1].options.show, false); assert.equal(both[1].code, trace.code); assert.deepEqual(both[1].buttons, trace.buttons)
  const only = filter([trace]); assert.equal(only.length, 1); assert.equal(only[0].code, 'link/Tracing'); assert.equal(only[0].options.show, true)
  assert.equal(only[0].i18nName, 'Runtime monitoring')
  language = 'zh'; assert.equal(filter([trace])[0].i18nName, '运行监控')
  assert.equal(trace.name, 'Tracing', 'input authorization snapshot is not mutated')
})
