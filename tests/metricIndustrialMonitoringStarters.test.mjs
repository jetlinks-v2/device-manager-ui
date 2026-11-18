import assert from 'node:assert/strict'
import test from 'node:test'
import {loadMetricTestModule} from './metricTestModule.mjs'

const {industrialMonitoringStarters}=await loadMetricTestModule('../views/metric/Template/industrialMonitoringStarters.ts')
test('工业模板具有明确物理来源、可编辑参数和完整模拟数据',()=>{
  for(const {template,simulation} of industrialMonitoringStarters) {
    assert.equal(template.thingType,undefined)
    assert.ok(template.inputDefinitions.every(input=>input.unit && input.maxAge && !input.source?.lookback))
    assert.ok(template.inputDefinitions.every(input=>simulation.samples.some(sample=>sample.metricId===input.id)))
    assert.ok(template.parameterDefinitions.every(parameter=>parameter.valueType.min>0 && parameter.expands.editable))
    for(const rule of template.definitions) {
      assert.equal(rule.calculator,undefined)
      assert.equal(rule.expression,undefined)
      assert.ok(rule.expressionTree || rule.temporalCondition || rule.aggregation)
    }
  }
  const energy=industrialMonitoringStarters.find(item=>item.id==='specific-energy-deviation').template
  assert.equal(energy.definitions[0].maxInputSkew,'PT1S')
  assert.equal(energy.definitions[0].applicabilityTree.root.operator,'and')
  assert.ok(energy.options.notes.includes('不是班次累计'))
  const response=industrialMonitoringStarters.find(item=>item.id==='actuator-response-degradation').template
  assert.ok(response.options.notes.includes('来源应已按同一次动作配对'))
  assert.ok(response.definitions.filter(rule=>rule.window).every(rule=>rule.window.mode==='latestN' && rule.window.size==='3'))
  assert.equal(response.definitions.at(-1).applicabilityTree.root.operands[0].right.value,'3')
})
