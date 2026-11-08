import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadMetricTestModule } from './metricTestModule.mjs'

const structureExpressions = fileURLToPath(new URL('../../../jetlinks-web-core/src/components/Metric/template/structureExpressions.ts', import.meta.url))
const { createMetricStarters, starterMessages } = await loadMetricTestModule('../views/metric/Template/starters.ts', {
  '@jetlinks-web-core/components': `export { structureMetricTemplate } from ${JSON.stringify(structureExpressions)}`,
})
const translate = key => key.split('.').reduce((value, part) => value[part], starterMessages.zh)
const { structureMetricTemplate } = await loadMetricTestModule('../../../jetlinks-web-core/src/components/Metric/template/structureExpressions.ts')
const formulaTree = (template, rule, expression) => structureMetricTemplate({ ...template,
  definitions: [{ ...rule, expressionTree: undefined, expression }],
}).template.definitions[0].expressionTree

test('fire templates preserve event identity and restrict unaligned bucket aggregation', () => {
  const starters = createMetricStarters(translate)
  for (const id of ['fireEvidence', 'fireGovernance']) {
    const starter = starters.find(item => item.id === id)
    assert.equal(starter.groupId, 'fire')
    assert.ok(starter.template.options.i18nMessages.name.zh)
    assert.ok(starter.template.options.i18nMessages.name.en)
    assert.ok(Object.values(starter.simulation.configuration.inputMappings).every(mapping => !['alarmCount','alarmActive','longestAlarmDuration'].includes(mapping.id)))
  }
  const governance = starters.find(item => item.id === 'fireGovernance').template
  assert.ok(governance.outputs.every(output => !output.options.readAggregation.operations.some(operation => ['sum','ratio','average'].includes(operation))))
  const evidence = starters.find(item => item.id === 'fireEvidence').template
  assert.match(JSON.stringify(evidence.definitions.find(rule => rule.id === 'fireReviewDecision').expressionTree), /eventId/)
  for (const template of [evidence, governance]) {
    assert.ok(template.definitions.filter(rule => rule.type === 'composite').every(rule => rule.expressionTree && !rule.expression))
  }
  assert.ok(!evidence.definitions.some(rule => rule.temporalCondition))
})

test('communication quality is one device template with platform session sources', () => {
  const starter = createMetricStarters(translate).find(item=>item.id === 'communication')
  assert.equal(starter.template.outputs.length,8)
  assert.deepEqual(starter.template.definitions.find(item=>item.id === 'currentConnection').window,
    {mode:'none',timeMode:'processing',emitPolicy:'onSchedule',emitInterval:'PT1M'})
  assert.deepEqual(Object.values(starter.simulation.configuration.inputMappings).map(item=>item.id),['$online','$lastCommunicationTime'])
  assert.ok(starter.template.outputs.every(item=>item.options.readAggregation))
  assert.equal(starter.template.outputs.find(item=>item.metricId === 'observedOnlineRatio').options.readAggregation.operations.includes('sum'),false)
  assert.deepEqual(starter.template.outputs.filter(item=>item.options.explain).map(item=>item.metricId),['communicationState','linkQualityScore'])
  const fields=starter.template.definitions.find(item=>item.id==='connectionStatistics').calculator.outputType.properties
  assert.ok(fields.every(item=>item.name && item.name !== item.id))
})

// 独立前端 checkout 不依赖聚合工作区的相对路径；联合验收显式传入正式引擎的场景目录。
test('communication and fire starters match the real-engine scenarios', { skip: !process.env.METRIC_SCENARIO_FIXTURES }, async () => {
  const { join } = await import('node:path')
  const starters = createMetricStarters(translate)
  for (const [id, fixture] of [['communication', 'communication-quality'], ['fireEvidence', 'fire-evidence'], ['fireGovernance', 'fire-governance']]) {
    assert.deepEqual(JSON.parse(JSON.stringify(starters.find(item => item.id === id))),
      JSON.parse(await readFile(join(process.env.METRIC_SCENARIO_FIXTURES, `${fixture}.json`), 'utf8')))
  }
})

test('在线时长独立于生产运行，模拟事实只有状态变化且保留真实起点', () => {
  for (const language of ['zh', 'en']) {
    const t = key => key.split('.').reduce((value, part) => value[part], starterMessages[language])
    const { template, simulation } = createMetricStarters(t).find(item => item.id === 'online')
    assert.equal(template.outputs[0].metricId, 'connection')
    assert.deepEqual(template.definitions[0].options.stateLabels.map(item => item.value), [0, 1])
    for (const id of ['onlineSeconds', 'offlineSeconds', 'onlineWindowSeconds', 'offlineWindowSeconds']) {
      assert.equal(template.outputs.find(item => item.metricId === id).unit, 's')
    }
    assert.equal(simulation.samples.length, 3)
    assert.deepEqual(simulation.samples.map(item => item.value), [1, 0, 1])
    assert.ok(simulation.samples.every(item => item.quality.attributes.stateSince === item.eventTime))
    assert.equal(simulation.endAt - simulation.samples[0].eventTime, 4 * 3600_000)
    assert.equal(simulation.endAt - simulation.samples.at(-1).eventTime, 3600_000)
  }
})

test('在线场景与正式后端试算请求逐字段一致', { skip:!process.env.METRIC_CONNECTION_FIXTURE }, async () => {
  const fixture = JSON.parse(await readFile(process.env.METRIC_CONNECTION_FIXTURE, 'utf8'))
  const starter = createMetricStarters(translate).find(item => item.id === 'online')
  assert.deepEqual(JSON.parse(JSON.stringify({ template:starter.template, ...starter.simulation })), fixture)
})

test('业务场景起点使用完整模板、独立来源和带质量单位的真实试算样本', () => {
  const starters = createMetricStarters(translate)
  assert.deepEqual(starters.map(item => item.id), ['window', 'meter', 'cooling', 'health', 'runtime', 'fire', 'intensity', 'comprehensive', 'water', 'bearing', 'filter', 'cold', 'ventilation', 'fireWater',
    'equipmentStates', 'equipmentDay', 'equipmentWeek', 'fleetSummary', 'attendance', 'orderCompletion', 'productionMix', 'fleetConnections', 'online', 'communication', 'fireEvidence', 'fireGovernance'])
  for (const starter of starters) {
    assert.ok(starter.name && starter.description && starter.groupId)
    assert.equal(starter.template.options.description, starter.description)
    assert.ok(starter.template.options.notes)
    const { template, simulation } = starter
    assert.equal(simulation.configuration.templateId, template.id)
    assert.ok(template.outputs.every(output => template.definitions.some(rule => rule.id === output.metricId)))
    for (const input of template.inputDefinitions) {
      const mapping = simulation.configuration.inputMappings[input.id]
      const samples = simulation.samples.filter(sample => sample.thingId === mapping.thingId && sample.metricId === mapping.id)
      assert.ok(samples.length)
      assert.ok(samples.every(sample => sample.unit === input.unit && sample.quality.valid === true && sample.eventTime === sample.processTime))
    }
  }
})

test('中英文场景文案完整，规则引用和单位沿用同一配置，不泄漏演示身份', () => {
  const categoryIds = []
  for (const language of ['zh', 'en']) {
    const translate = key => key.split('.').reduce((value, part) => value?.[part], starterMessages[language])
    categoryIds.push(createMetricStarters(translate).map(starter=>starter.groupId))
    for (const { template } of createMetricStarters(translate)) {
      const ids = new Set([...template.inputDefinitions, ...template.definitions].map(item => item.id))
      for (const definition of template.definitions) {
        for (const id of [...definition.dependsOn || [], ...(definition.inputs || []).map(item => item.metricId)]) assert.ok(ids.has(id), id)
      }
      assert.ok(template.inputDefinitions.every(input => input.name && !input.source?.thingId))
      assert.ok(template.parameterDefinitions.every(parameter => parameter.name))
      assert.ok(template.outputs.every(output => output.label))
      assert.ok(template.definitions.every(rule => rule.name))
      assert.ok(template.name && template.options.notes)
    }
  }
  assert.deepEqual(categoryIds[0],categoryIds[1])
  assert.equal(new Set(categoryIds[0]).size,5)
})

test('区间组合校验实际起止，不仅校验最后时间；存水使用有符号增量', () => {
  const starters = createMetricStarters(translate)
  for (const id of ['intensity', 'comprehensive', 'water']) {
    const template = starters.find(item => item.id === id).template
    const combined = template.definitions.find(rule => JSON.stringify(rule.applicabilityTree)?.includes('inputTimeStart'))
    assert.ok(combined)
    for (const input of combined.dependsOn) {
      assert.ok(JSON.stringify(combined.applicabilityTree).includes(JSON.stringify([input, 'inputTimeStart'])))
      if (input !== combined.dependsOn[0]) assert.ok(JSON.stringify(combined.applicabilityTree).includes(JSON.stringify([input, 'inputTimeEnd'])))
    }
  }
  const storage = starters.find(item => item.id === 'water').template.definitions.find(rule => rule.id === 'storageDelta')
  assert.equal(storage.calculator.parameters.negativeDelta, 'signed')
})

test('运行统计复用确认转换；食品持续条件和消防供水即时事实分开', () => {
  const starters = createMetricStarters(translate)
  const runtime = starters.find(item => item.id === 'runtime').template
  assert.deepEqual(runtime.definitions[0].window, { mode: 'none', timeMode: 'processing', emitPolicy: 'onSchedule', emitInterval: 'PT1M' })
  assert.ok(runtime.outputs.find(output => output.metricId === 'activeSeconds').label.includes('近1小时'))
  assert.equal(runtime.outputs.find(output => output.metricId === 'activeSeconds').unit, 's')
  assert.equal(runtime.outputs.find(output => output.metricId === 'unknownSeconds').unit, 's')
  assert.deepEqual(runtime.definitions.find(rule => rule.id === 'activeSeconds').expressionTree.root,
    { type: 'reference', id: 'statistics', path: ['activeDuration'] })
  assert.deepEqual(runtime.definitions.find(rule => rule.id === 'unknownSeconds').expressionTree.root,
    { type: 'reference', id: 'statistics', path: ['unknownDuration'] })
  assert.ok(runtime.definitions.find(rule => rule.id === 'statistics').calculator.outputType.properties.every(field => field.name))
  assert.equal(runtime.outputs[0].metricId, 'running')
  assert.equal(runtime.definitions.find(rule => rule.id === 'running').stateTracking.maxNoData, 'PT20M')
  assert.equal(runtime.definitions.find(rule => rule.id === 'running').options.stateLabels.length, 5)
  for (const name of ['stopped', 'running', 'standby', 'fault', 'maintenance']) assert.ok(runtime.outputs.some(output => output.metricId === `${name}Seconds`))
  assert.ok(runtime.outputs.some(output => output.metricId === 'startCount'))
  assert.ok(runtime.outputs.some(output => output.metricId === 'stopCount'))
  const cold = starters.find(item => item.id === 'cold').template
  assert.equal(cold.definitions[0].temporalCondition.dwell, 'PT5M')
  assert.equal(cold.definitions[0].temporalCondition.maxNoData, 'PT2M')
  const fireWater = starters.find(item => item.id === 'fireWater').template
  assert.ok(fireWater.definitions.every(rule => !rule.temporalCondition && rule.dependsOn.length === 1))
  assert.ok(!fireWater.outputs.some(output => /ready|falseAlarm/i.test(output.metricId)))
})

test('重新创建场景不共享可变草稿；窗口、状态与告警保留真实时间语义', () => {
  const first = createMetricStarters(translate)
  first[0].template.inputDefinitions[0].name = 'Changed'
  first[0].simulation.samples[0].value = 999
  const next = createMetricStarters(translate)
  assert.equal(next[0].template.inputDefinitions[0].name, '温度')
  assert.equal(next[0].simulation.samples[0].value, 22)
  assert.equal(next[0].template.definitions[0].window.size, 'PT15M')
  assert.equal(next[4].template.definitions.find(rule => rule.id === 'statistics').calculator.parameters.maxHold, 'PT20M')
  assert.equal(next[5].template.definitions[0].window.timeMode, 'processing')
  assert.equal(next[5].simulation.endAt - next[5].simulation.samples[0].eventTime, 9 * 60_000)
})

test('制造业口径保留七种工况、独立通电来源、自然周期和范围汇总边界', () => {
  const starters = createMetricStarters(translate)
  const states = starters.find(item => item.id === 'equipmentStates').template
  assert.deepEqual(states.definitions[0].options.stateLabels.map(item => item.name), ['关机', '运行', '待机', '维修', '大修', '故障', '保养'])
  for (const id of ['equipmentDay', 'equipmentWeek']) {
    const { template, simulation } = starters.find(item => item.id === id)
    assert.deepEqual(template.inputDefinitions.map(input => input.id), ['workingFlag', 'energizedFlag'])
    assert.ok(template.inputDefinitions.every(input => input.valueType.type === 'boolean' && input.source.maxPoints === 2048))
    assert.equal(template.parameterDefinitions[0].expands.defaultValue, 28800)
    assert.equal(template.definitions.find(rule => rule.id === 'workingStatistics').calculator.inputTypes.from.type, 'double')
    assert.ok(template.outputs.filter(output => output.metricId.includes('Seconds')).every(output => output.unit === 's'))
    assert.equal(template.outputs.find(output => output.metricId === 'periodFrom').unit, 'ms')
    assert.equal(new Date(simulation.endAt).toISOString(), '2026-11-02T00:00:00.000Z')
  }
  const fleet = starters.find(item => item.id === 'fleetSummary').template
  assert.ok(fleet.options.notes.includes('成员指标统计'))
  assert.ok(fleet.definitions.every(rule => rule.window.emitPolicy === 'onSchedule' && rule.window.emitInterval === 'PT5M'))
  assert.equal(fleet.parameterDefinitions[0].expands.defaultValue, 86400)
  const utilization = fleet.definitions.find(rule => rule.id === 'fleetUtilizationPercent')
  assert.deepEqual(utilization.expressionTree, formulaTree(fleet, utilization,
    'powerTotalSeconds * 100.0 / (equipmentCount * 1.0 * params.periodSeconds)'))
})

// 独立前端仓库无需后端checkout；联合验收通过环境变量指定正式引擎使用的模板快照。
test('联合验收使用的后端模板与前端场景逐字段一致', { skip: !process.env.METRIC_DASHBOARD_TEMPLATE_FIXTURE }, async () => {
  const fixture = JSON.parse(await readFile(process.env.METRIC_DASHBOARD_TEMPLATE_FIXTURE, 'utf8'))
  const templates = Object.fromEntries(createMetricStarters(translate).filter(item => Object.hasOwn(fixture, item.id)).map(item => [item.id, item.template]))
  assert.equal(Object.keys(templates).length, 7)
  assert.deepEqual(JSON.parse(JSON.stringify(templates)), fixture)
})
