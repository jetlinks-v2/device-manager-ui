import assert from 'node:assert/strict'
import test from 'node:test'
import {loadMetricTestModule} from './metricTestModule.mjs'

const {signalQualityStarters}=await loadMetricTestModule('../views/metric/Template/signalQualityStarters.ts')
test('校准、滤波与工况补偿模板均提供实际输入、模拟数据及可编辑配置',()=>{
  assert.equal(signalQualityStarters.length,5)
  for(const {template,simulation} of signalQualityStarters) {
    assert.equal(template.thingType,undefined)
    assert.ok(template.inputDefinitions.every(input=>input.maxAge && !input.source?.lookback))
    assert.ok(template.inputDefinitions.every(input=>simulation.samples.some(sample=>sample.metricId===input.id)))
    for(const rule of template.definitions) {
      assert.ok(rule.calculator || rule.expressionTree || rule.temporalCondition)
      assert.equal(rule.formula,undefined)
      if(rule.calculator)assert.ok(['filter','calibration'].includes(rule.calculator.provider))
    }
  }
  const compensated=signalQualityStarters.find(item=>item.id==='load-compensated-temperature').template
  assert.deepEqual(compensated.inputDefinitions.map(input=>input.id),['temperature','ambient','load'])
  assert.equal(compensated.inputDefinitions.find(input=>input.id==='load').valueType.max,1)
  assert.equal(compensated.definitions[0].calculator.parameters.operation,'linearBaseline')
  assert.equal(compensated.definitions.find(rule=>rule.id==='residual').maxInputSkew,'PT1S')
  assert.equal(compensated.definitions.at(-1).temporalCondition.dwell,'PT1M')
  assert.equal(compensated.definitions.find(rule=>rule.id==='residual').window.emitInterval,'PT1M')
})
