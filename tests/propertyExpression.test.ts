import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderer,h,nextTick,reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import { usePropertyFormulaEdit } from '../views/device/components/PropertyRules/usePropertyFormulaEdit'
import { ruleTrialRequest, presentRuleTrial } from '../views/device/components/PropertyRules/trial'
import { trialPropertyRules, type PropertyTrialPoint } from '../api/propertyPreprocessorTrial'
import { useRuleExample } from '../views/device/components/PropertyRules/useRuleExample'
import { currentValue } from '../views/device/components/PropertyRules/correction'
import { readSampling } from '../views/device/components/PropertyRules/sampling'
import type { RuleDraft } from '../views/device/components/PropertyRules/codec'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
const tree={version:1 as const,root:currentValue}
const draft=():RuleDraft=>({valuesEnabled:false,valuesMode:'ignore',values:[],rangeEnabled:false,alarmEnabled:false,
  alarm:{} as RuleDraft['alarm'],samplingEnabled:false,...readSampling(),scaleEnabled:true,scale:'1',fileEnabled:false})
// Only the render host and localization boundary are replaced; the Vue lifecycle and hooks run unchanged.
function mount<T>(setup:()=>T) {
  let result:T
  const renderer=createRenderer({createElement:()=>({}),createText:()=>({}),createComment:()=>({}),insert(){},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:()=>null,nextSibling:()=>null} as any)
  const app=renderer.createApp({setup(){result=setup();return()=>h('div')}})
  app.use(createI18n({legacy:false,locale:'en',messages:{en:{}}}));app.mount({});return {get result(){return result!},close:()=>app.unmount()}
}
test('formula edit commits only on Done and Cancel never mutates the configured rule',()=>{
  let saved=tree,invalid=false,editing=false,dirty=false
  const mounted=mount(()=>usePropertyFormulaEdit(()=>saved,{change:value=>saved=value,invalid:value=>invalid=value,editing:value=>editing=value,dirty:value=>dirty=value}))
  const session=mounted.result,next={version:1 as const,root:{type:'literal' as const,valueType:'int' as const,value:'2'}}
  session.start();assert.equal(dirty,false);session.update(next);assert.equal(dirty,true);assert.equal(saved,tree);assert.equal(editing,true);assert.equal(invalid,true)
  session.cancel();assert.equal(saved,tree);assert.equal(editing,false);assert.equal(invalid,false);assert.equal(dirty,false)
  session.start();session.update(next);session.check(true);session.done(()=>false);assert.equal(saved,tree)
  session.check(false);session.done(()=>true);assert.equal(saved,next)
  session.start();mounted.close();assert.equal(invalid,false);assert.equal(editing,false)
})

const scope={productId:'product'}
const property={id:'temperature',valueType:{type:'double'}}
const previous={value:null,time:0,outcome:'missing' as const}
const point=(value='10'):PropertyTrialPoint=>({value,present:true,outputKnown:true,steps:[{path:'/0',provider:'expression',status:'processed',value}],intents:[]})
test('one request sends the whole chain and untouched samples; every displayed result comes from the backend',async()=>{
  const current={...draft(),valuesEnabled:true,valuesMode:'replace' as const,values:[-1],replacementValue:7,
    alarmEnabled:true,alarm:{trigger:'gt',value:10,limit:{}} as RuleDraft['alarm'],samplingEnabled:true,samplingMode:'change' as const,deadband:1}
  const inputs=[{value:-1,arrivalMillis:0},{value:-1,arrivalMillis:1000}]
  const requests:any[]=[]
  const backend=[{...point('12'),steps:[{path:'/0',provider:'simple',status:'processed',value:'7'},
    {path:'/1',provider:'scale',status:'processed',value:'12'}],intents:[{path:'/2/0',action:'alarm',conditional:true}]},
    {...point('12'),present:false,steps:[{path:'/3',provider:'change-sampling',status:'filtered'}]}] as PropertyTrialPoint[]
  setAlarmRequestHandler(async(url,request)=>{requests.push({url,request});return {result:backend}})
  const response=await trialPropertyRules(scope,property.id,ruleTrialRequest(current,property,inputs,previous,{}))
  const points=presentRuleTrial(current,property,inputs,response)
  assert.equal(requests.length,1);assert.match(requests[0].url,/product\/product\/property\/temperature\/_trial$/)
  assert.deepEqual(requests[0].request.samples.map((sample:any)=>sample.value),['-1','-1'],'cleaning also belongs to the server')
  assert.equal(requests[0].request.configuration.processors.length,4)
  assert.equal(points[0].alarm,true);assert.equal(points[1].sampled,true)
  assert.deepEqual(points[0].stages.map(stage=>stage.key),['values','scale','alarm','sampling'])
  setAlarmRequestHandler(async()=>{throw Error('offline')})
  await assert.rejects(trialPropertyRules(scope,property.id,requests[0].request),/offline/)
})
test('diagram invalidates stale batches, requires missing source context and stops after disposal',async()=>{
  const requests:any[]=[];let resolve:(value:any)=>void=()=>{}
  setAlarmRequestHandler((url,request)=>{requests.push({url,request});return new Promise(done=>resolve=done)})
  const props=reactive({draft:draft(),property,scope})
  const mounted=mount(()=>useRuleExample(props)),preview=mounted.result
  try {
    await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,1)
    assert.equal(requests[0].request.samples.length,5)
    preview.inputs.value[0].value=42
    resolve({result:Array(5).fill(point('999'))});await nextTick();assert.deepEqual(preview.points.value,[])
    props.draft.correction={version:1,root:{type:'reference',id:'sourceTime',path:[]}}
    await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,1);assert.equal(preview.needsSamples.value,true)
    preview.samples.sourceTime='1000';await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,2)
    assert.equal(requests[1].request.samples[0].sourceTime,'1000')
  } finally {mounted.close()}
  resolve({result:Array(5).fill(point('42'))});await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,2)
})
test('all rule chains reserve rows and columns during pending, successful and failed trial batches',async()=>{
  for(const scaleEnabled of [true,false]){
    setAlarmRequestHandler(async()=>({result:Array(5).fill(point('10'))}))
    const mounted=mount(()=>useRuleExample({draft:{...draft(),scaleEnabled},property,scope})),preview=mounted.result
    try {
      const keys=preview.rows.value.map(row=>row.key),count=preview.inputs.value.length
      assert.equal(preview.loading.value,true)
      assert.equal(preview.columns.value.length,count);assert.ok(preview.columns.value.every(point=>point===undefined))
      await preview.run();assert.ok(preview.columns.value.every(Boolean))
      setAlarmRequestHandler(async()=>{throw Error('offline')})
      await preview.run()
      assert.equal(preview.failure.value,'offline')
      assert.deepEqual(preview.rows.value.map(row=>row.key),keys);assert.equal(preview.columns.value.length,count)
      assert.ok(preview.columns.value.every(point=>point===undefined),'failed batches never retain an old output')
    } finally {mounted.close()}
  }
})
