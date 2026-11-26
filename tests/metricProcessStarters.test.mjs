import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'

const { processStarters } = await loadMetricTestModule('../views/metric/Template/processStarters.ts')
const byId = id => processStarters.find(item => item.id === id)

test('业务示例保持普通对象绑定、单位和有界输入，不绑定特定设备语义', () => {
  for (const { template, simulation } of processStarters) {
    assert.equal(template.thingType, undefined)
    assert.ok(template.inputDefinitions.every(input => !input.semantics?.semanticId))
    for (const input of template.inputDefinitions) {
      assert.equal(simulation.configuration.inputMappings[input.id].id, input.id)
      if (input.source) {
        assert.ok(input.source.maxPoints <= 128)
        assert.ok(input.minSamples >= 2 && input.maxAge)
      }
    }
    for (const rule of template.definitions) if (rule.window?.mode === 'time') {
      assert.equal(rule.window.timeMode, 'event')
      assert.ok(rule.window.maxEntries <= 128)
    }
    assert.ok(template.outputs.every(output => output.persist && output.publish && output.valueType))
    assert.ok(simulation.samples.every(sample => sample.unit === template.inputDefinitions.find(input => input.id === sample.metricId).unit))
    assert.ok(template.options.authoring.references.every(reference => reference.url.startsWith('https://')))
  }
  const energy = byId('power-energy').template
  assert.equal(energy.inputDefinitions[0].unit, 'kW')
  assert.equal(energy.outputs[0].unit, 'kWh')
  assert.equal(energy.definitions[0].calculator.parameters.timeUnit, 'PT1H')
  assert.equal(byId('time-weighted-temperature').template.definitions[0].window.maxGap, 'PT30S')
})

test('高频示例按秒计算，尾延迟不伪造超时值，升温确认先经过预热', () => {
  const vibration = byId('vibration-amplitude')
  for (const rule of vibration.template.definitions) {
    assert.deepEqual(rule.window, { mode: 'none', emitPolicy: 'onSchedule', emitInterval: 'PT1S' })
  }
  assert.equal(vibration.template.inputDefinitions[0].minSamples, 8)
  const latency = byId('response-latency').template
  assert.equal(latency.definitions[0].calculator.parameters.percentile, 95)
  assert.ok(!latency.inputDefinitions.some(input => input.defaultValue === 0))
  const rise = byId('rapid-temperature-rise').template
  assert.equal(rise.definitions[0].timeAggregation, 'timeSlope')
  assert.equal(rise.definitions[0].window.timeUnit, 'PT1M')
  assert.deepEqual(rise.definitions.at(-1).temporalCondition.enterTree.root.operands[0].left, { type: 'reference', id: 'sampleCount', path: [] })
})
