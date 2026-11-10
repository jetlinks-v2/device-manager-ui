import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { build, transformSync } from 'esbuild'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const root = resolve(import.meta.dirname, '..')
const core = resolve(root, '../../jetlinks-web-core/src').replaceAll('\\', '/')
const require = createRequire(import.meta.url)
const vueGlobals = Object.fromEntries(Object.entries(vue).filter(([key]) => key !== 'default' && /^[A-Za-z_$][\w$]*$/.test(key)))

// 保留列表编排、字段定义、路由编解码及筛选 SFC，只替换网络、宿主路由与非本次测试的子面板。
async function loadList(environment) {
  const result = await build({
    stdin: { resolveDir: root, contents: `export { useUnifiedDeviceList } from './views/device/list/unified/useUnifiedDeviceList'; export * from 'list-fixture'; export {getDeviceListFilterFields} from './deviceListFilter'; export { encodeConditionFilterQuery } from '${core}/components/ConditionFilter/utils.ts'` },
    bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'import.meta.env.VITE_APP_ENVIRONMENT': JSON.stringify(environment) },
    plugins: [{ name: 'list-boundaries', setup(plugin) {
      plugin.onResolve({ filter: /^vue$/ }, () => ({ path: import.meta.resolve('vue'), external: true }))
      plugin.onResolve({ filter: /^@jetlinks-web-core\/components\/ConditionFilter$/ }, () => ({ path: resolve(core, 'components/ConditionFilter/utils.ts') }))
      plugin.onResolve({ filter: /^@jetlinks-web-core\/utils\/deployment$/ }, () => ({ path: resolve(core, 'utils/deployment.ts') }))
      plugin.onResolve({ filter: /^(vue-router|vue-i18n|list-fixture|@jetlinks-web|.*\/(api|hooks)\/|.*deviceScope$|.*useSupportedDeviceListProviders$)/ }, ({ path }) => ({ path: path.endsWith('TagSearch.vue') ? 'tag' : 'fixture', namespace: 'list-test' }))
      plugin.onResolve({ filter: /TagSearch\.vue$/ }, () => ({ path: 'tag', namespace: 'list-test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'list-test' }, ({ path }) => ({ loader: 'js', contents: path === 'tag' ? 'export default {}' : `
        import { computed, reactive, ref } from 'vue';
        export const route = reactive({path:'/iot/device',query:{},params:{}});
        export const sidebar = ref({areas:[],groups:[]});
        export const productCalls = [];
        export const catalog = ref([]);
        let releaseCatalog;
        const catalogReady = new Promise(resolve => {releaseCatalog=resolve});
        export const finishCatalog = () => releaseCatalog();
        export const locale = ref('zh');
        const t = key => locale.value + ':' + key;
        export default {global:{t}};
        export const useI18n = () => ({t});
        export const useRoute = () => route;
        export const useRouter = () => ({replace: async ({query}) => {route.query=query}});
        export const useMenuStore = () => ({hasMenu:()=>true});
        export const moduleRegistry = {getAllModuleIds:()=>[]};
        export const isNoCommunity = true;
        export const randomString = () => Math.random().toString(36).slice(2);
        export const resolveIotProjectId = () => 'project';
        export const isIotDeviceListEntry = () => true;
        export const getIotDeviceListMenuCode = () => 'iot-device';
        export const buildIotDeviceDetailPath = () => '/device';
        export const useSupportedDeviceListProviders = source => source;
        export const useDeviceScope = () => ({sidebarProps:sidebar,terms:ref([]),scopeType:ref('area'),scopeId:ref(''),ensureReady:async()=>{}});
        export const queryDeviceLibraryProductFilterOptions_api = async () => {await catalogReady;return catalog.value};
        export const countDevice_api = async () => 0;
        export const queryDevicePage_api = async () => ({data:[{id:'d1',name:'设备',productId:'p1',productName:'风扇产品'}],total:1});
        export const queryRuntimeDevices_api = async () => ({data:[]});
        export const queryNoPagingPost = async data => {productCalls.push(data);return {result:[{id:'p1',name:'风扇产品'}]}};
        export const queryDeviceProductById_api = async id => ({id,name:'风扇产品'});
        export const queryGatewayList = async () => ({result:[]});
        export const queryTree = async () => ({result:[]});
        export const queryOrgThree = async () => ({result:[]});
      ` }))
    } }],
  })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}

function loadFilter() {
  const cache = new Map()
  const dependencies = {
    'vue-i18n': {useI18n:()=>({t:key=>key})},
    '@jetlinks-web/utils': {randomString:()=>Math.random().toString(36).slice(2)},
    '@jetlinks-web/core': {request:{get:()=>{throw new Error('Unexpected dictionary request')}}},
    '@jetlinks-web-core/locales': {default:{global:{t:key=>key,te:()=>false}}},
  }
  function load(filename, component = false) {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = {exports:{}}
    cache.set(filename,module)
    let source = readFileSync(filename,'utf8')
    if (component) source = compileScript(parse(source,{filename}).descriptor,{id:'filter-labels'}).content
    const {code} = transformSync(source,{loader:'ts',format:'cjs'})
    const imports = id => {
      if (Object.hasOwn(dependencies,id)) return dependencies[id]
      if (id.endsWith('.vue')) return {}
      if (id.startsWith('.')) return load(resolve(dirname(filename),id+'.ts'))
      return require(id)
    }
    new Function('require','module','exports',...Object.keys(vueGlobals),code)(imports,module,module.exports,...Object.values(vueGlobals))
    return module.exports
  }
  const component = load(resolve(core,'components/ConditionFilter/ConditionFilter.vue'),true).default
  component.render = () => null
  return component
}

const renderer = vue.createRenderer({
  createElement:tag=>({tag,children:[]}), createText:text=>({text}), createComment:text=>({text}),
  insert:(child,parent)=>{child.parent=parent;parent.children.push(child)},
  remove:child=>{if(child.parent)child.parent.children.splice(child.parent.children.indexOf(child),1)},
  setText:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:child=>child.parent,nextSibling:()=>null,
})
const settle = async () => {for(let i=0;i<12;i++) await vue.nextTick()}

async function mountList(environment) {
  globalThis.window = {setTimeout,clearTimeout,btoa,atob}
  globalThis.document = {activeElement:null}
  const api = await loadList(environment)
  api.route.query.q = api.encodeConditionFilterQuery([{column:'productId',termType:'eq',value:'p1'}],api.getDeviceListFilterFields())
  const Filter = loadFilter()
  let list
  const app = renderer.createApp({setup:()=>{
    list=api.useUnifiedDeviceList()
    return ()=>vue.h(Filter,{fields:list.filterFields.value,modelValue:list.searchTerms.value})
  }})
  app.mount({children:[]})
  const state = app._instance.subTree.component.setupState
  await settle()
  return {api,list,state,stop:()=>app.unmount(),label:()=>state.getValueLabel(state.termsModel[0])}
}

test('private product name stays resolved through sidebar, catalog and device page refreshes', async () => {
  const h = await mountList('')
  try {
    assert.equal(h.label(),'风扇产品')
    const fields=h.list.filterFields.value
    const calls=h.api.productCalls.length
    const labels=[]
    const stop=vue.watchEffect(()=>labels.push(h.label()),{flush:'sync'})
    h.api.sidebar.value={areas:[{id:'a1',name:'空间'}],groups:[]}
    await settle()
    h.api.sidebar.value={areas:[],groups:[{id:'g1',name:'分组'}]}
    h.api.finishCatalog()
    await settle()
    h.list.refresh()
    await settle()
    stop()
    assert.ok(labels.length>0)
    assert.ok(labels.every(label=>label==='风扇产品'),JSON.stringify(labels))
    assert.equal(h.api.productCalls.length,calls,'unrelated refreshes must not repeat the selected-product lookup')
    assert.equal(h.list.filterFields.value,fields)
    assert.equal(h.state.termsModel[0].value,'p1')
    assert.equal(h.list.filterTerms.value[0].terms[0].value,'p1')
  } finally {h.stop()}
})

test('private filter titles still react to locale changes', async () => {
  const h=await mountList('')
  try {
    h.api.locale.value='en'
    await settle()
    assert.ok(h.list.filterFields.value[0].title.startsWith('en:'))
    assert.equal(h.label(),'风扇产品')
  } finally {h.stop()}
})

test('SaaS product choices still update when the installed product catalog loads', async () => {
  const h=await mountList('saas')
  try {
    h.api.catalog.value=[{templateId:'t2',productId:'p2',productName:'新产品',accessProvider:'mqtt',accessName:'MQTT'}]
    h.api.finishCatalog()
    await settle()
    const options=h.list.filterFields.value.find(field=>field.dataIndex==='productId').search.options
    assert.ok(options.some(option=>option.value==='p2'&&option.label==='新产品'))
    assert.equal(h.label(),'风扇产品')
  } finally {h.stop()}
})
