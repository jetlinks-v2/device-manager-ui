import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMetricTestModule } from './metricTestModule.mjs'

const { iotMetricStarters: starters } = await loadMetricTestModule('../views/metric/Template/starters.ts')
const { localizedTemplate, metricTemplateTextEntries } = await loadMetricTestModule('../../../jetlinks-web-core/src/components/Metric/template/text.ts')
const { captureTemplateExample } = await loadMetricTestModule('../../../jetlinks-web-core/src/components/Metric/template/templateAuthoring.ts')
const { structureMetricTemplate } = await loadMetricTestModule('../../../jetlinks-web-core/src/components/Metric/template/structureExpressions.ts')

test('default references cover IoT capabilities without domain-specific decisions or invented scores',()=>{
  assert.deepEqual(starters.map(item=>item.id),['communication-observation','connection-duration','state-duration','sample-mean','counter-usage','persistent-limit','measurement-difference','scope-connectivity'])
  assert.deepEqual([...new Set(starters.map(item=>item.groupId))].sort(),['condition','connectivity','energy','scope','state','statistics'])
  assert.ok(!JSON.stringify(starters).includes('linkQualityScore'))
  assert.ok(!JSON.stringify(starters).includes('fireReview'))
  for (const {template,simulation} of starters) {
    assert.ok(template.definitions.length && template.outputs.length)
    const structured=structureMetricTemplate(template)
    assert.equal(structured.converted,0,'default references must already use the structured contract')
    assert.deepEqual(structured.unsupported,[])
    assert.ok(captureTemplateExample(template,simulation),'facts must remain editable and portable')
    assert.deepEqual(Object.keys(simulation.configuration.inputMappings).sort(),template.inputDefinitions.map(item=>item.id).sort())
  }
  assert.ok(starters.every(item=>item.providerId==='device-iot'))
})

test('every reference preserves bilingual declarations and enum encodings without translating raw values',()=>{
  for (const {template} of starters) {
    const english=localizedTemplate(template,'en')
    assert.notEqual(english.name,template.name)
    const entries=metricTemplateTextEntries(template)
    for(const key of Object.keys(entries)) {
      assert.ok(template.options.i18nMessages[key]?.zh,key)
      assert.ok(template.options.i18nMessages[key]?.en,key)
    }
    for(const input of template.inputDefinitions) {
      const translated=english.inputDefinitions.find(item=>item.id===input.id)
      assert.equal(translated.valueType?.type,input.valueType?.type)
      if(input.valueType?.elements)assert.deepEqual(translated.valueType.elements.map(item=>item.value),input.valueType.elements.map(item=>item.value))
    }
  }
  const communication=starters[0].template
  assert.equal(communication.inputDefinitions.find(item=>item.id==='lastCommunicationTime').valueType.type,'date')
  assert.equal(communication.parameterDefinitions.find(item=>item.id==='activityAssessmentEnabled').expands.defaultValue,false)
  const states=communication.definitions.find(item=>item.id==='communicationState').resultType
  assert.equal(states.type,'enum')
  assert.ok(states.elements.every(item=>typeof item.value==='number' && item.icon.startsWith('color:')))
  assert.deepEqual(starters.find(item=>item.id==='state-duration').template.inputDefinitions[0].valueType.elements.map(item=>item.value),[0,1])
})

test('references explain observation boundaries, parameter examples and a verifiable mean definition',()=>{
  const mean=starters.find(item=>item.id==='sample-mean').template
  assert.match(mean.options.authoring.references[0].url,/^https:\/\/www\.itl\.nist\.gov\//)
  assert.match(mean.options.i18nMessages.notes.en,/not a time-weighted mean/)
  const difference=starters.find(item=>item.id==='measurement-difference').template
  assert.equal(difference.definitions[0].maxInputSkew,'PT5S')
  assert.equal(difference.inputDefinitions[0].unit,difference.inputDefinitions[1].unit)
  const usage=starters.find(item=>item.id==='counter-usage').template
  assert.equal(usage.definitions[0].calculator.parameters.negativeDelta,'reject')
  assert.match(localizedTemplate(starters.find(item=>item.id==='persistent-limit').template,'en').options.notes,/not general safety/)
})

test('connection references explicitly version event-maintained history without upgrading saved bindings',()=>{
  for (const id of ['communication-observation','connection-duration']) {
    const {template,simulation}=starters.find(item=>item.id===id)
    assert.equal(template.version,id === 'communication-observation' ? '5' : '4')
    assert.equal(simulation.configuration.templateVersion,template.version)
    assert.equal(template.inputDefinitions.find(item=>item.id==='connectionState').historyReconciliation,'PT5M')
  }
  assert.ok(!starters.find(item=>item.id==='sample-mean').template.inputDefinitions[0].historyReconciliation)
})

test('专用通信参考声明原来源语义，通用状态和数值参考不锁定设备领域',()=>{
  const input=(id,key)=>starters.find(item=>item.id===id).template.inputDefinitions.find(item=>item.id===key)
  for(const id of ['communication-observation','connection-duration']) assert.equal(input(id,'connectionState').semantics.semanticId,'urn:jetlinks:device:platform:online')
  assert.equal(input('communication-observation','lastCommunicationTime').semantics.semanticId,'urn:jetlinks:device:platform:lastCommunicationTime')
  for(const id of ['state-duration','sample-mean','counter-usage','persistent-limit','measurement-difference']) {
    assert.ok(starters.find(item=>item.id===id).template.inputDefinitions.every(item=>!item.semantics?.semanticId))
  }
})

test('communication state declares server intervals instead of drawing calculation ticks as durations',()=>{
  const {template}=starters.find(item=>item.id==='communication-observation')
  const connection=template.definitions.find(item=>item.id==='currentConnection')
  const communication=template.definitions.find(item=>item.id==='communicationState')
  assert.equal(communication.stateTracking.maxNoData,connection.stateTracking.maxNoData)
  assert.equal(communication.stateTracking.maxNoData,'PT2M')
  assert.equal(template.outputs.find(item=>item.metricId==='communicationState').persist,true)
})

test('connection examples use platform state facts and scope summaries do not require a device target',()=>{
  const connection=starters.find(item=>item.id==='connection-duration')
  assert.equal(connection.simulation.configuration.inputMappings.connectionState.id,'$online')
  assert.ok(connection.simulation.samples.every(item=>item.metricId==='$online' && item.quality.attributes.stateSince===item.eventTime))
  const scope=starters.find(item=>item.id==='scope-connectivity')
  assert.equal(scope.template.thingType,undefined)
  assert.equal(scope.template.version,'2')
  assert.ok(!connection.template.options.notes.includes('显示至少持续'))
  const communication=starters.find(item=>item.id==='communication-observation').template
  assert.ok(communication.outputs.every(output=>!!output.valueType),'declared read aggregation must include its scalar type')
})
