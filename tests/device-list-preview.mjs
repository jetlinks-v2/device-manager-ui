import { createApp, h, reactive, ref, watch, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd from 'ant-design-vue'
import * as icons from '@ant-design/icons-vue'
import Results from '../views/device/list/unified/UnifiedDeviceResults.vue'
import zh from '../locales/lang/zh.json'
import en from '../locales/lang/en.json'
import ja from '../locales/lang/ja.json'
import coreZh from '../../../jetlinks-web-core/src/locales/lang/zh.json'
import coreEn from '../../../jetlinks-web-core/src/locales/lang/en.json'
import coreJa from '../../../jetlinks-web-core/src/locales/lang/ja.json'
import 'ant-design-vue/dist/reset.css'
import '../../../jetlinks-web-core/src/style/components.less'
const i18n=createI18n({legacy:false,flatJson:true,locale:'zh',messages:{zh:{...coreZh,...zh},en:{...coreEn,...en},ja:{...coreJa,...ja}}})
// Uses real result templates and theme styles; data and actions stay local to this preview.
const App={setup(){
  const width=ref(520),long=ref(false),result=ref('Checking')
  const model=reactive({rows:[],total:3,selectedIds:[],loading:false,loadingMore:false,error:'',appendError:'',hasMore:false,hasSearch:false,details:{},runtime:{a:{state:'ready',connectedAt:Date.now()-10800000,lastActivityAt:Date.now()-120000},b:{state:'loading'},c:{state:'error'}},revision:0,readingIndex:0,readingOffset:0,activeType:'all',showCategory:true,categoryLabels:{device:'Device'},showArea:true,showChannel:false,monitorMetrics:{},stateAction:{allowed:false,disabled:false},scopeEditor:{allowed:false,disabled:false,loading:false,error:'',areas:[],groups:[],save:async()=>{}}})
  watch([i18n.global.locale,long],()=>{
    const labels={zh:['生产网关','生产线传感器','仓库子设备','智能环境传感器','制造厂区 / 一号车间','生产设备'],en:['Production gateway','Production line sensor','Warehouse child device','Industrial environmental sensor','Manufacturing campus / Workshop one','Production devices'],ja:['製造ゲートウェイ','生産ラインセンサー','倉庫サブデバイス','産業用環境センサー','製造拠点 / 第一工場','生産設備']}[i18n.global.locale.value]
    model.rows=['a','b','c'].map((id,index)=>({id,identifier:`207649226248108441${index}`,name:long.value?labels[index].repeat(12):labels[index],category:'device',productName:long.value?labels[3].repeat(12):labels[3],productManufacturer:'JetLinks',productModel:'S-100',accessName:'MQTT',transport:'MQTT',parentName:index===2?labels[0]:undefined,connectionStatus:['online','disabled','offline'][index],offlineAt:Date.now()-86400000,area:labels[4],groupName:labels[5]}))
  },{immediate:true})
  async function check(){
    await nextTick();requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const panel=document.querySelector('.preview-panel'),cards=[...panel.querySelectorAll('.device-results__card')]
      const bad=cards.filter(card=>card.scrollHeight>card.clientHeight+1||card.scrollWidth>card.clientWidth+1)
      const clippedStatus=[...panel.querySelectorAll('.device-results__state-summary')].filter(el=>el.scrollWidth>el.clientWidth+1)
      result.value=bad.length||clippedStatus.length||document.documentElement.scrollWidth>innerWidth?`FAIL: ${bad.length} cards, ${clippedStatus.length} status rows`:`PASS: ${i18n.global.locale.value}, ${Math.round(panel.clientWidth)}px, ${cards.length?'cards':'table'}`
    }))
  }
  watch([width,long,i18n.global.locale],check,{immediate:true})
  return()=>h('main',[
    h('div',{class:'controls'},[
      h('label',['Language ',h('select',{'aria-label':'Language',value:i18n.global.locale.value,onChange:e=>i18n.global.locale.value=e.target.value},['zh','en','ja'].map(value=>h('option',{value},value)))]),
      h('label',['Result width ',h('select',{'aria-label':'Result width',value:width.value,onChange:e=>width.value=Number(e.target.value)},[280,360,520,900,1360].map(value=>h('option',{value},value)))]),
      h('label',[h('input',{type:'checkbox','aria-label':'Long names',checked:long.value,onChange:e=>long.value=e.target.checked}),' Long names']),h('button',{onClick:check},'Check layout')]),
    h('output',{role:'status'},result.value),
    h('section',{class:'preview-panel',style:{width:`${width.value}px`}},[h(Results,{model,onSelectionChange:ids=>model.selectedIds=ids,onRetryDetails:ids=>ids.forEach(id=>model.runtime[id]={state:'ready'})},{header:()=>i18n.global.t('UnifiedDeviceList.title')})])])
}}
createApp(App).use(Antd).use(i18n).component('AIcon',{props:['type'],setup:p=>()=>h(icons[p.type]||icons.QuestionOutlined)}).component('RegistryComponent',()=>null).mount('#app')
