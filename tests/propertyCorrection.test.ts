import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCorrectionSteps,readCorrectionSteps,legacyCorrectionSteps,readCorrection,correctionTree,correctionSummary,isCorrectionExpression,currentValue,correctionReferences,setCorrectionMode,type CorrectionStep } from '../views/device/components/PropertyRules/correction'
import { buildRule,parseRule,validateDraft,type RuleDraft } from '../views/device/components/PropertyRules/codec'
import { readSampling } from '../views/device/components/PropertyRules/sampling'

const draft=():RuleDraft=>({valuesEnabled:false,valuesMode:'ignore',values:[],rangeEnabled:false,alarmEnabled:false,
  alarm:{} as RuleDraft['alarm'],samplingEnabled:false,...readSampling(),scaleEnabled:true,scale:'1',offset:'0',fileEnabled:false})

test('compact operations preserve decimal text, order and legacy multiply/add pairs',()=>{
  const steps:[CorrectionStep,CorrectionStep]=[{operator:'divide',value:'100'},{operator:'add',value:'9007199254740993.125'}]
  const tree=buildCorrectionSteps(steps)!
  assert.equal(correctionSummary({...draft(),correction:tree},'Current value'),'((Current value / 100) + 9007199254740993.125)')
  assert.deepEqual(readCorrectionSteps(tree),steps)
  assert.equal((tree.root as any).right.value,'9007199254740993.125')
  assert.equal(buildCorrectionSteps([{operator:'divide',value:'-0.00'},steps[1]]),undefined)
  assert.equal(buildCorrectionSteps([steps[0],{operator:'multiply',value:null}]),undefined)
  assert.equal(buildCorrectionSteps([steps[0],{operator:'divide',value:'0'}]),undefined)
  assert.deepEqual(legacyCorrectionSteps({...draft(),scale:'0.1',offset:'5'}),[{operator:'multiply',value:'0.1'},{operator:'add',value:'5'}])
  assert.deepEqual(readCorrectionSteps(correctionTree(draft())),[{operator:'multiply',value:'1'},{operator:'add',value:'0'}])
})

test('all operator pairs round trip without reassociation or arithmetic in the browser',()=>{
  for(const first of ['multiply','divide','add','subtract'] as const)for(const second of ['multiply','divide','add','subtract'] as const) {
    const steps:[CorrectionStep,CorrectionStep]=[{operator:first,value:'2'},{operator:second,value:'3'}]
    const original=buildCorrectionSteps(steps)!,current={...draft(),...readCorrection(original)}
    setCorrectionMode(current,'formula');assert.deepEqual(correctionTree(current),original)
    setCorrectionMode(current,'simple');assert.deepEqual(current.correctionSteps,steps)
    const saved=buildRule(parseRule(),current)
    assert.deepEqual(parseRule(JSON.parse(JSON.stringify(saved))).nodes.scale!.configuration.expression,original)
  }
})

test('legacy multiplier and offset stay unchanged until a new expression is edited',()=>{
  const raw={provider:'calibration',configuration:{scale:'0.1',offset:'-5'}} as any
  const parsed=parseRule(raw)
  const legacy={...draft(),scale:'0.1',offset:'-5'}
  assert.deepEqual(parseRule(buildRule(parsed,legacy)).nodes.scale,raw)
  const next=buildRule(parsed,{...legacy,correction:correctionTree(legacy),correctionMode:'formula'})
  assert.equal(parseRule(next).nodes.scale!.provider,'expression')
  assert.deepEqual(parseRule(next).nodes.scale!.configuration,{expression:correctionTree(legacy),editorMode:'formula'})
  const restored=parseRule(JSON.parse(JSON.stringify(next)))
  assert.equal(restored.editable,true)
  assert.deepEqual(readCorrection(restored.nodes.scale!.configuration.expression).correction,correctionTree(legacy))
  assert.equal(readCorrection(restored.nodes.scale!.configuration.expression,restored.nodes.scale!.configuration.editorMode).correctionMode,'formula')
})

test('complex formulas stay intact and invalid drafts cannot be saved',()=>{
  const expression={version:1 as const,root:{type:'conditional' as const,
    condition:{type:'binary' as const,operator:'gt',left:currentValue,right:{type:'literal' as const,valueType:'int' as const,value:'0'}},
    whenTrue:currentValue,whenFalse:{type:'literal' as const,valueType:'int' as const,value:'0'}}}
  assert.equal(readCorrectionSteps(expression),undefined)
  assert.equal(readCorrection(expression).correctionMode,'formula')
  const current={...draft(),...readCorrection(expression)}
  assert.equal(validateDraft(current,true),undefined)
  assert.equal(validateDraft({...current,correctionInvalid:true},true),'PropertyRules.validation.scale')
  assert.equal(validateDraft(current,false),'PropertyRules.validation.scale')
  assert.equal(isCorrectionExpression({version:2,root:currentValue}),false)
  assert.equal(isCorrectionExpression({version:1,root:{type:'reference',id:'another',path:[]}}),false)
})

test('message variables retain their identities and summaries after save and reload',()=>{
  for(const ref of correctionReferences) {
    const expression={version:1 as const,root:{type:'reference' as const,id:ref.id,path:[]}}
    assert.equal(isCorrectionExpression(expression),true)
    const config=buildRule(parseRule(),{...draft(),...readCorrection(expression)})
    assert.deepEqual(parseRule(JSON.parse(JSON.stringify(config))).nodes.scale?.configuration.expression,expression)
    assert.equal(correctionSummary({...draft(),correction:expression},'Value',id=>'Label '+id),ref.id === 'value' ? 'Value' : 'Label '+ref.id)
  }
  assert.equal(isCorrectionExpression({version:1,root:{type:'literal',valueType:'string',value:'good'}}),true)
})
