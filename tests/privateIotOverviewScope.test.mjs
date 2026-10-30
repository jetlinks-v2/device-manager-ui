import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import test from 'node:test'
const require=createRequire(import.meta.url), {build}=require('esbuild'), root=fileURLToPath(new URL('../',import.meta.url))
const {outputFiles}=await build({stdin:{contents:`export {getIotDeviceScopeTerms} from './deviceListProvider.ts'; export {buildOverviewDeviceTerms} from '../authentication-manager-ui/api/overview.ts'`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'stub',setup(b){
 b.onResolve({filter:/^@jetlinks-web\/core$/},()=>({path:'core',namespace:'stub'})); b.onResolve({filter:/^@jetlinks-web-core\/locales$/},()=>({path:'locale',namespace:'stub'})); b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default {}; export const request={}',loader:'js'}))
}}]})
const mod={exports:{}};Function('module','exports','require',outputFiles[0].text)(mod,mod.exports,require)
test('private list scope equals overview counting scope and does not share mutable terms',()=>{
 const terms=mod.exports.getIotDeviceScopeTerms();assert.deepEqual(terms,mod.exports.buildOverviewDeviceTerms('iot'))
 assert.match(terms[0].value,/agent-device-gateway/);assert.match(terms[0].value,/media-plugin/);assert.match(terms[0].value,/onvif/)
 terms[0].value='mutated';assert.notEqual(mod.exports.getIotDeviceScopeTerms()[0].value,'mutated')
})

test('unified hook scopes explicit device in both editions and preserves all and gateway', async () => {
 const vue=require('vue'), {transformSync}=require('esbuild'), fs=require('fs')
 const filename=path.join(root,'views/device/list/unified/useUnifiedDeviceList.ts')
 const code=transformSync(fs.readFileSync(filename,'utf8'),{loader:'ts',format:'cjs'}).code
 const run=(isPrivate,type)=>{
  const route=vue.reactive({path:'/resources/devices/list',query:type?{type}:{}}), seen=[]
  const scope=vue.effectScope(), mod={exports:{}}
  const mocks={
   'vue':vue,'vue-router':{useRoute:()=>route,useRouter:()=>({replace:()=>{}})},'vue-i18n':{useI18n:()=>({t:k=>k})},
   '@jetlinks-web-core/store':{useMenuStore:()=>({hasMenu:()=>true})},'@jetlinks-web-core/utils/deployment':{isPrivateDeployment:()=>isPrivate},
   '@jetlinks-web-core/utils/module-registry':{moduleRegistry:{getAllModuleIds:()=>['edge'],getResource:()=>({gateway:{id:'gateway',menuCode:'gateway',order:20,label:()=> 'gateway',terms:()=>[{column:'gateway'}]}})}},
   '../../../../api/device':{countDevice_api:async (_q,terms)=>{seen.push(terms);return 0},queryDevicePage_api:async (_q,terms)=>{seen.push(terms);return {data:[],total:0}}},
   '../../../../api/device-library':{queryDeviceLibraryProductFilterOptions_api:async()=>[]},'../../../../api/deviceGroup':{queryRuntimeDevices_api:async()=>({data:[]})},
   '../hooks/useIotDeviceRouting':{isIotDeviceListEntry:()=>false,getIotDeviceListMenuCode:()=> 'iot-user-device-list',resolveIotProjectId:()=>'',buildIotDeviceDetailPath:()=>''},
   '../../../../deviceListProvider':{getIotDeviceScopeTerms:modScope},
   '../../../../deviceScope':{useDeviceScope:(base)=>({terms:vue.computed(()=>[]),scopeType:vue.ref('space'),scopeId:vue.ref(''),sidebarProps:vue.ref({areas:[],groups:[]}),ensureReady:async()=>{}})},
   '@jetlinks-web-core/components/ConditionFilter':{decodeConditionFilterQuery:()=>[],encodeConditionFilterQuery:()=>''},
   '../../../../deviceListFilter':{getDeviceListFilterFields:()=>[],getDeviceListSearchTerms:()=>[]},
  }
  Function('require','module','exports',code)(id=>mocks[id]??require(id),mod,mod.exports)
  const view=scope.run(()=>mod.exports.useUnifiedDeviceList()); return {view,seen,scope}
 }
 function modScope(){return mod.exports.getIotDeviceScopeTerms()}
 const oldWarn=console.warn;console.warn=()=>{}
 try {
  for(const [privateMode,type,expected] of [[true,'device','device'],[true,undefined,'all'],[false,'device','device'],[false,undefined,'all'],[false,'all','all'],[false,'gateway','gateway']]){
   const h=run(privateMode,type);await vue.nextTick();await new Promise(r=>setImmediate(r))
   assert.equal(h.view.activeType.value,expected)
   assert.equal(h.view.tabs.value.some(tab=>tab.key==='device'),expected==='device')
   const terms=expected==='device'?modScope():expected==='gateway'?[{column:'gateway'}]:[]
   assert.deepEqual(h.view.baseTerms.value,terms)
   assert.ok(h.seen.some(value=>JSON.stringify(value??[])===JSON.stringify(terms)))
   h.scope.stop()
  }
 } finally {console.warn=oldWarn}
})
