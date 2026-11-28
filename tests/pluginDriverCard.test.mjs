import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { build } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

const source = new URL('../views/link/plugin/PluginCard.vue', import.meta.url)
const { descriptor } = parse(await readFile(source, 'utf8'), { filename: source.pathname })
const script = compileScript(descriptor, { id: 'plugin-driver-card', inlineTemplate: true })
const temporary = new URL(`../.plugin-driver-card-test-${process.pid}.mjs`, import.meta.url)
const result = await build({ stdin: { contents: script.content, loader: 'ts', resolveDir: new URL('../views/link/plugin/', import.meta.url).pathname },
  bundle: true, write: false, platform: 'node', format: 'esm', external: ['vue'], plugins: [{ name: 'ui-boundaries', setup(api) {
    api.onResolve({ filter: /vue-i18n|@vueuse\/core|components\/CardBox$|utils\/i18n$|^\.\/util$|\.vue$/ }, args => ({ path: args.path, namespace: 'ui' }))
    api.onLoad({ filter: /.*/, namespace: 'ui' }, args => ({ contents:
      args.path === 'vue-i18n' ? 'export const useI18n=()=>({t:(key,p)=>key+JSON.stringify(p||{})})'
      : args.path === '@vueuse/core' ? 'export const useIntersectionObserver=()=>({stop(){}})'
      : args.path.endsWith('/i18n') ? 'export const getI18nText=(data,key)=>data[key]||""'
      : args.path === './util' ? 'export const getPluginTypeLabel=type=>type;export const getPluginTypeIcon=()=>"DatabaseOutlined"'
      : args.path.endsWith('CardBox') ? 'import {h} from "vue";export const CardSummary={props:["data"],setup:(_, {slots})=>()=>h("article",[slots.title?.(),slots.subtitle?.(),slots.meta?.(),slots.footer?.()])}'
      : 'export default {render:()=>null}' }))
  } }] })
await writeFile(temporary, result.outputFiles[0].text)
const { default: Card } = await import(temporary.href)
await rm(temporary)
const data = { id: 'driver', name: 'Configured label', description: 'Editable description', type: 'collector', version: '1.0' }
const render = props => {
  const app = createSSRApp(Card, { data, actions: [], permission: 'plugin', status: { state: 'available', ready: 1 },
    inspectionOpen: false, canViewLogs: false, ...props })
  for (const name of ['ADropdown', 'APopover', 'AConfigProvider']) app.component(name, { setup: (_, { slots }) => () => h('div', slots.default?.()) })
  app.component('AButton', { setup: (_, { slots }) => () => h('button', slots.default?.()) })
  app.component('AIcon', { render: () => h('i') })
  app.component('ASkeletonInput', { render: () => h('i', { 'data-loading': 'true' }) })
  return renderToString(app)
}

test('driver card keeps its configured label and displays the package-defined name and description once', async () => {
  const html = await render({ metadata: { driverName: 'Declared name', driverDescription: 'Declared purpose' } })
  assert.ok(html.includes('Configured label'))
  assert.ok(html.includes('Declared name'))
  assert.ok(html.includes('Declared purpose'))
  assert.equal(html.includes('Editable description'), false)
  assert.equal((html.match(/>Declared purpose</g) || []).length, 1)
})

test('missing package descriptions have no placeholder or editable fallback while loading stays local', async () => {
  for (const metadata of [undefined, { driverName: 'Declared name' }, { driverName: 'Declared name', driverDescription: '' }, { driverName: 'Declared name', driverDescription: '   ' }]) {
    const html = await render({ metadata })
    assert.equal(html.includes('class="plugin-card__description"'), false)
    assert.equal(html.includes('Editable description'), false)
    assert.equal(html.includes('Unavailable'), false)
  }
  assert.match(await render({ loading: true }), /data-loading="true"/)
})
