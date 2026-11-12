import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createSSRApp, h, ref, createRenderer, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'

const require = createRequire(import.meta.url)
const base = '../visDashboard/DeviceManagement/DeviceMapCard/'
function compile(name, dependencies = {}) {
  const file = new URL(base + name, import.meta.url)
  const parsed = parse(readFileSync(file, 'utf8'), { filename: file.pathname })
  assert.deepEqual(parsed.errors, [])
  const code = transformSync(compileScript(parsed.descriptor, { id: name, inlineTemplate: true }).content, { loader: 'ts', format: 'cjs' }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => dependencies[id] ?? require(id), module, module.exports)
  return module.exports.default
}
const action = compile('MapConfigAction.vue')
const deviceMessages = JSON.parse(readFileSync(new URL('../locales/lang/zh.json', import.meta.url), 'utf8'))
const coreMessages = JSON.parse(readFileSync(new URL('../../../jetlinks-web-core/src/locales/lang/zh.json', import.meta.url), 'utf8'))
const messages = { ...coreMessages, ...deviceMessages }
const simple = text => ({ setup: (_, { slots }) => () => h('div', [text, slots.default?.()]) })
function card(amap, { allowed = true, edit = false, error, distribution = false, calls = [] } = {}) {
  const deps = {
    './MapConfigAction.vue': { __esModule: true, default: action },
    '@jetlinks-web-core/components/CloudEmpty/index.vue': { __esModule: true, default: { props: ['description'], setup: (p, { slots }) => () => h('div', [p.description, slots.default?.()]) } },
    '@vuemap/vue-amap': { ElAmapMarkerCluster: simple('cluster') },
    '@jetlinks-web-core/store/system': { useSystemStore: () => ({ systemInfo: { amap } }) },
    '../components/SectionHeader.vue': { __esModule: true, default: simple('header') },
    './DeviceMapSelectionCard.vue': { __esModule: true, default: simple('selection') },
    './DeviceDistributionMap.vue': { __esModule: true, default: simple('distribution-map') },
    './distribution': { distributionColors: {}, distributionState: () => 'online' },
    '../hooks/useDeviceMap': { useDeviceMap: () => ({ config: ref({ embedded: true }), distribution: ref(distribution), points: ref([]), loading: ref(false), error: ref(null), extraOptions: {}, selection: {}, refresh() {}, onMapInit() {}, onClusterClick() {}, onPointSelect() {}, canConfigureMap: ref(allowed && !edit), openMapConfig: () => calls.push('system/Basis') }) },
  }
  const component = compile('DeviceMapCard.vue', deps)
  const map = { setup: (_, { slots }) => () => h('div', ['amap-rendered', error ? slots['error-guide']?.({ error }) : null]) }
  return { component, map, edit }
}
function install(app, map) {
  app.use(createI18n({ legacy: false, locale: 'zh', messages: { zh: messages }, flatJson: true, missingWarn: false }))
  app.component('AButton', { setup: (_, { slots, attrs }) => () => h('button', attrs, slots.default?.()) })
  app.component('ASpin', simple(''))
  app.component('AAlert', simple(''))
  app.component('AMapComponent', map)
}
async function render(amap, options = {}) {
  const { component, map, edit } = card(amap, options)
  const app = createSSRApp(component, { isEdit: edit })
  install(app, map)
  return renderToString(app)
}
test('missing keys offer configuration only to authorized non-edit users', async () => {
  for (const amap of [{}, { apiKey: ' ', secretKey: 'secret' }, { apiKey: 'key' }]) assert.match(await render(amap), /前往基础配置/)
  assert.match(await render({}, { allowed: false }), /联系管理员/)
  assert.match(await render({}, { edit: true }), /联系管理员/)
})
test('map slot distinguishes recycled credentials from other failures and normal maps', async () => {
  const config = { apiKey: 'key', secretKey: 'secret' }
  for (const error of [{ kind: 'map', code: '10013' }, { kind: 'sdk', info: 'USER_KEY_RECYCLED' }]) {
    assert.match(await render(config, { error }), /前往基础配置/)
    assert.match(await render(config, { error, allowed: false }), /联系管理员/)
  }
  const other = await render(config, { error: { kind: 'map', code: '1013' } })
  assert.match(other, /请前往高德地图官网查看错误码说明/)
  assert.doesNotMatch(other, /前往基础配置|联系管理员/)
  assert.doesNotMatch(await render(config), /前往基础配置|联系管理员/)
  assert.match(await render({}, { distribution: true }), /distribution-map/)
})
test('clicking the real local action emits configure to the card handler', async () => {
  const calls = [], { component, map } = card({}, { calls })
  const make = type => ({ type, children: [], props: {} })
  const renderer = createRenderer({ createElement: make, createText: text => ({ text }), createComment: text => ({ text }), setText: (n, t) => { n.text = t }, setElementText: (n, t) => { n.text = t }, patchProp: (n, k, _old, v) => { n.props[k] = v }, insert: (n, p) => { p.children.push(n) }, remove() {}, parentNode() {}, nextSibling() {} })
  const root = make('root'), app = renderer.createApp(component)
  install(app, map); app.mount(root); await nextTick()
  const find = n => n.type === 'button' ? n : (n.children || []).map(find).find(Boolean)
  const button = find(root)
  assert.ok(button); button.props.onClick(); assert.deepEqual(calls, ['system/Basis']); app.unmount()
})
