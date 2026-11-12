import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderer,h,nextTick,reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import { usePropertyFormulaEdit } from '../views/device/components/PropertyRules/usePropertyFormulaEdit'
import { buildRuleExampleAsync } from '../views/device/components/PropertyRules/diagram'
import { useRuleExample } from '../views/device/components/PropertyRules/useRuleExample'
import { currentValue } from '../views/device/components/PropertyRules/correction'
import { readSampling } from '../views/device/components/PropertyRules/sampling'
import type { RuleDraft } from '../views/device/components/PropertyRules/codec'
import { setExpressionEvaluator } from './propertyExpression.test-shim'
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
test('one diagram pipeline feeds the cleaned value to the backend and uses its result before alarm and sampling',async()=>{
  const current={...draft(),valuesEnabled:true,valuesMode:'replace' as const,values:[-1],replacementValue:7,
    alarmEnabled:true,alarm:{trigger:'gt',value:10,limit:{}} as RuleDraft['alarm'],samplingEnabled:true,samplingMode:'change' as const,deadband:1}
  const inputs=[{value:-1,arrivalMillis:0},{value:-1,arrivalMillis:1000}]
  const received:unknown[]=[]
  const points=await buildRuleExampleAsync(current,{valueType:{type:'double'}},inputs,{value:null,time:0,outcome:'missing'},async input=>{
    received.push(input.value);return {value:12,label:'12.000',explanation:{kind:'operator',operation:'add',state:'available',value:'12',path:[],children:[]}}
  })
  assert.deepEqual(received,[7,7]);assert.equal(points[0].alarm,true);assert.equal(points[1].sampled,true)
  assert.equal(points[0].label,'12.000');assert.equal(points[0].stages[1].explanation?.value,'12')
  assert.deepEqual(points[0].stages.map(stage=>stage.key),['values','scale','alarm','sampling'])
  await assert.rejects(buildRuleExampleAsync(draft(),{valueType:{type:'double'}},inputs,{value:null,time:0,outcome:'missing'},async()=>{throw Error('offline')}),/offline/)
})
test('diagram cancels stale results, requires explicit context, debounces requests and stops after disposal',async()=>{
  let requests:any[]=[],resolve:(value:any)=>void=()=>{}
  setExpressionEvaluator(request=>{requests.push(request);return new Promise(done=>resolve=done)})
  const props=reactive({draft:draft(),property:{valueType:{type:'double'}}})
  const mounted=mount(()=>useRuleExample(props)),preview=mounted.result
  try {
    await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,1)
    assert.equal(requests[0].numeric,true);assert.deepEqual(requests[0].resultType,{type:'double'})
    preview.inputs.value[0].value=42
    resolve({value:'999',explanation:{}});await nextTick();assert.deepEqual(preview.points.value,[])
    props.draft.correction={version:1,root:{type:'reference',id:'messageTime',path:[]}}
    await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,1);assert.equal(preview.needsSamples.value,true)
    preview.samples.messageTime='1000';await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,2)
    assert.equal(requests[1].variables.messageTime,'1000')
  } finally {mounted.close()}
  resolve({value:'42',explanation:{}});await new Promise(done=>setTimeout(done,370));assert.equal(requests.length,2)
})
test('diagram reserves the same rows and columns through pending, successful and failed backend evaluation',async()=>{
  setExpressionEvaluator(async()=>({value:'10',explanation:{}}))
  const mounted=mount(()=>useRuleExample({draft:draft(),property:{valueType:{type:'double'}}})),preview=mounted.result
  try {
    const keys=preview.rows.value.map(row=>row.key),count=preview.inputs.value.length
    assert.equal(preview.loading.value,true)
    assert.equal(preview.columns.value.length,count)
    assert.ok(preview.columns.value.every(point=>point === undefined))
    await preview.run()
    assert.equal(preview.columns.value.length,count)
    assert.ok(preview.columns.value.every(Boolean))
    setExpressionEvaluator(async()=>{throw Error('offline')})
    await preview.run()
    assert.equal(preview.failure.value,'offline')
    assert.deepEqual(preview.rows.value.map(row=>row.key),keys)
    assert.equal(preview.columns.value.length,count)
    assert.ok(preview.columns.value.every(point=>point === undefined),'failed evaluation never retains an old result')
  } finally {mounted.close()}
})
