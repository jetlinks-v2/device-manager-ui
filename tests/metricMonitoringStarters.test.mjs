import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'
const { monitoringStarters } = await loadMetricTestModule('../views/metric/Template/monitoringStarters.ts')

test('监测模板只使用通用算法、固定基准与业务门控，不推断专业诊断', () => {
  const drift = monitoringStarters.find(item => item.id === 'fixed-reference-drift')
  assert.equal(drift.template.definitions[0].calculator.parameters.operation, 'cusum')
  assert.equal(drift.template.definitions[0].calculator.parameters.contextInput, 'context')
  const relation = monitoringStarters.find(item => item.id === 'paired-signal-observation')
  assert.deepEqual(relation.template.outputs.map(output => output.metricId), ['correlation', 'pairs'])
  const flat = monitoringStarters.find(item => item.id === 'sensor-flat-observation')
  assert.ok(flat.template.inputDefinitions.some(input => input.id === 'expectedChange' && input.valueType.type === 'boolean'))
  assert.ok(flat.template.definitions.some(rule => rule.aggregation === 'count'))
  const guard = flat.template.definitions.at(-1).temporalCondition.enterTree.root.operands[1]
  assert.equal(guard.left.id, 'sampleCount')
  assert.equal(guard.right.value, '8')
  assert.equal(flat.template.definitions[0].window.maxEntries, 64)
})
