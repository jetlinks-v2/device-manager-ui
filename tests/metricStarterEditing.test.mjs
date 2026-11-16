import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadMetricTestModule } from './metricTestModule.mjs'

const { iotMetricStarters } = await loadMetricTestModule('../views/metric/Template/starters.ts')
const coreRoot = process.env.METRIC_TEST_CORE_ROOT || fileURLToPath(new URL('../../../jetlinks-web-core/',import.meta.url))
const { createMetricLoader } = await import(pathToFileURL(resolve(coreRoot,'tests/helpers/metricRuntime.mjs')))
const load = createMetricLoader({ '@jetlinks-web/core':{request:{}} })
const { findCalculator, interactiveCalculator, bindAlgorithmInput } = load('components/Metric/template/algorithm.ts')
const descriptors = JSON.parse(readFileSync(resolve(coreRoot,'tests/fixtures/metricCalculatorDocumentation.json'),'utf8'))

test('所有内置算法配置均能通过统一描述交互编辑，无需自定义声明',()=>{
  for (const starter of iotMetricStarters) for (const rule of starter.template.definitions) {
    if (!rule.calculator) continue
    const descriptor = findCalculator(rule.calculator,descriptors)
    assert.ok(descriptor,`${starter.id}/${rule.id}: missing algorithm description`)
    assert.ok(interactiveCalculator(rule.calculator,descriptor),`${starter.id}/${rule.id}: requires custom declaration`)
    for (const binding of rule.inputs || []) {
      if (!binding.metricId) continue
      const source = starter.template.inputDefinitions.find(input=>input.id === binding.metricId)
      if (!source) continue
      const before = structuredClone(rule)
      const patch = bindAlgorithmInput(rule,binding.id,binding.metricId,source.valueType,descriptor)
      assert.ok(interactiveCalculator(patch.calculator,descriptor))
      assert.deepEqual(rule,before,'editing helpers must not mutate builtin declarations')
      assert.equal(patch.inputs.find(input=>input.id === binding.id).metricId,binding.metricId)
    }
  }
})
