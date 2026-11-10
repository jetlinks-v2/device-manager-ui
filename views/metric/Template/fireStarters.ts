import type { MetricConfig, MetricTemplate, MetricTemplateOutput, MetricTemplateStarter } from '@jetlinks-web-core/components'
import { fireMessages } from './fireMessages'
import { structureMetricTemplate } from '@jetlinks-web-core/components'

type Translate = (key: string) => string
/** 消防场景只消费显式事件事实；公式不会修改原始火警、推断人工结论或去重原报文。 */
export function createFireStarters(t: Translate): MetricTemplateStarter[] {
  const start = Date.UTC(2026, 10, 1)
  const schedule = { mode:'none', timeMode:'processing', emitPolicy:'onSchedule', emitInterval:'PT1M' }
  const fields = (definitions: Record<string, string | Record<string, unknown>>) => ({ type:'object', properties:Object.entries(definitions)
    .map(([id, type]) => ({ id, name:t(id), valueType:typeof type === 'string' ? { type } : type })) })
  const input = (id: string, name: string, properties: Record<string, string | Record<string, unknown>>, optional = false) => ({ id, name:t(name), valueType:fields(properties), ...(optional ? { presence:'optional' as const } : {}) })
  const formula = (id: string, dependencies: string[], expression: string, extra = {}) => ({ id, name:t(id), type:'composite', dependsOn:dependencies,
    inputs:dependencies.map(metricId => ({ id:metricId, metricId, presence:'optional' })), expression, window:schedule, ...extra })
  const labels = (names: string[], values = names.map((_, index) => index)) => names.map((key, index) => ({ value:values[index], name:t(key),
    nameI18n:{ zh:fireMessages.zh[key as keyof typeof fireMessages.zh], en:fireMessages.en[key as keyof typeof fireMessages.en] },
    icon:key === 'fireActive' || key === 'fireConfirmed' ? 'color:#ff4d4f' : key === 'fireUnknown' || key === 'fireBucketInvalid' ? 'color:#8c8c8c' : key === 'firePending' || key === 'fireHintPresent' ? 'color:#faad14' : 'color:#1677ff' }))
  const hintLabels = labels(['fireUnknown','fireHintAbsent','fireHintPresent'], [-1, 0, 1])
  const output = (metricId: string, kind:'state'|'numeric'|'ratio'|'duration', unit?: string): MetricTemplateOutput => ({ metricId, label:t(metricId), metricKind:kind,
    valueType:kind === 'state' ? 'int' : 'double', unit, persist:true, publish:true,
    options:{ explain:['fireCurrentState','fireReviewDecision','fireFalseAlarmPercent','fireReviewCoverage'].includes(metricId), readAggregation:{ semantic:kind, operations:kind === 'state' ? ['collection','distribution'] : ['collection'], defaultOperation:kind === 'state' ? 'distribution' : 'collection', defaultView:'list' } } })
  const eventKnown = "fireEvent != null && fireEvent['eventId'] != null && fireEvent['eventId'] != ''"
  const evidenceKnown = `${eventKnown} && evidence != null && evidence['eventId'] == fireEvent['eventId'] && evidence['observedAt'] != null && evidence['observedAt'] > 0 && evidence['observedAt'] <= sample.getProcessTime() && (fireEvent['startedAt'] == null || evidence['observedAt'] >= fireEvent['startedAt'])`
  const evidence: MetricTemplate = { id:'fireEvidence', version:'1', name:t('fireEvidence.name'), thingType:'device', enabled:true,
    inputDefinitions:[input('fireEvent','fireEvent',{ eventId:'string', active:'boolean', startedAt:'date' }),
      input('evidence','fireEvidenceInput',{ eventId:'string', observedAt:'date', pollution:'boolean', humidityPercent:'double', independentResponses:'int' }, true),
      input('fireReview','fireReview',{ eventId:'string', decision:{ type:'enum',valueType:{ type:'int' },elements:labels(['firePending','fireConfirmed','fireFalse','fireTest','fireUndetermined']).map(({value,name}) => ({value,text:name})) }, reviewedAt:'date' }, true)],
    parameterDefinitions:[{ id:'fireHumidityLimit', name:t('fireHumidityLimit'), valueType:{ type:'double', min:0, max:100, unit:'%' }, expands:{ editable:true, defaultValue:90 } },
      { id:'fireIndependentLimit', name:t('fireIndependentLimit'), valueType:{ type:'int', min:2, max:10000 }, expands:{ editable:true, defaultValue:2 } }], parameters:{},
    definitions:[
      formula('fireCurrentState',['fireEvent'],`!(${eventKnown}) || fireEvent['active'] == null ? -1 : fireEvent['active'] ? 1 : 0`, { options:{ stateLabels:labels(['fireUnknown','fireInactive','fireActive'],[-1,0,1]) } }),
      formula('fireHoldSeconds',['fireEvent','fireCurrentState'],"fireCurrentState < 0 ? null : fireCurrentState == 0 ? 0 : fireEvent['startedAt'] == null || fireEvent['startedAt'] <= 0 || fireEvent['startedAt'] > sample.getProcessTime() ? null : (sample.getProcessTime() - fireEvent['startedAt']) / 1000.0"),
      formula('fireReviewDecision',['fireEvent','fireReview'],`${eventKnown} && fireReview != null && fireReview['eventId'] == fireEvent['eventId'] && fireReview['reviewedAt'] != null && fireReview['reviewedAt'] > 0 && fireReview['reviewedAt'] <= sample.getProcessTime() && (fireEvent['startedAt'] == null || fireReview['reviewedAt'] >= fireEvent['startedAt']) && fireReview['decision'] != null && fireReview['decision'] >= 0 && fireReview['decision'] <= 4 && fireReview['decision'] % 1 == 0 ? fireReview['decision'] : -1`,
        { options:{ stateLabels:labels(['fireUnknown','firePending','fireConfirmed','fireFalse','fireTest','fireUndetermined'],[-1,0,1,2,3,4]) } }),
      formula('firePollutionHint',['fireEvent','evidence'],`${evidenceKnown} && evidence['pollution'] != null ? evidence['pollution'] ? 1 : 0 : -1`, { options:{ stateLabels:hintLabels } }),
      formula('fireHumidityHint',['fireEvent','evidence'],`${evidenceKnown} && evidence['humidityPercent'] != null && evidence['humidityPercent'] >= 0 && evidence['humidityPercent'] <= 100 ? evidence['humidityPercent'] >= params.fireHumidityLimit ? 1 : 0 : -1`, { options:{ stateLabels:hintLabels } }),
      formula('fireCorroboratingCount',['fireEvent','evidence'],`${evidenceKnown} && evidence['independentResponses'] != null && evidence['independentResponses'] >= 0 && evidence['independentResponses'] % 1 == 0 ? evidence['independentResponses'] : null`),
      formula('fireMultiSourceHint',['fireCorroboratingCount'],"fireCorroboratingCount == null ? -1 : fireCorroboratingCount >= params.fireIndependentLimit ? 1 : 0", { options:{ stateLabels:hintLabels } }),
    ], outputs:[output('fireCurrentState','state'),output('fireHoldSeconds','duration','s'),output('fireReviewDecision','state'),output('firePollutionHint','state'),output('fireHumidityHint','state'),output('fireCorroboratingCount','numeric'),output('fireMultiSourceHint','state')],
    options:{ category:'fire', icon:'AlertOutlined', description:t('fireEvidence.description'), notes:t('fireEvidence.notes'), presentation:{ settings:{ primaryOutput:'fireCurrentState',summaryOutputs:['fireHoldSeconds','fireReviewDecision'] } } } }

  const counts = ['total','confirmedFire','falseAlarm','plannedTest','undetermined','pending']
  const validBucket = "fireReviewBucket != null && fireReviewBucket['from'] != null && fireReviewBucket['to'] != null && fireReviewBucket['from'] > 0 && fireReviewBucket['to'] > fireReviewBucket['from'] && fireReviewBucket['to'] <= sample.getProcessTime() && "
    + counts.map(id => `fireReviewBucket['${id}'] != null && fireReviewBucket['${id}'] >= 0 && fireReviewBucket['${id}'] % 1 == 0`).join(' && ')
    + " && fireReviewBucket['total'] == fireReviewBucket['confirmedFire'] + fireReviewBucket['falseAlarm'] + fireReviewBucket['plannedTest'] + fireReviewBucket['undetermined'] + fireReviewBucket['pending']"
  const countOutputs = { fireTotalCount:'total', fireTrueCount:'confirmedFire', fireFalseCount:'falseAlarm', fireTestCount:'plannedTest', fireUndeterminedCount:'undetermined', firePendingCount:'pending' }
  const governance: MetricTemplate = { id:'fireGovernance', version:'1', name:t('fireGovernance.name'), thingType:'device', enabled:true,
    inputDefinitions:[input('fireReviewBucket','fireReviewBucket',{ from:'date',to:'date',...Object.fromEntries(counts.map(id => [id,'long'])),reviewDurationSum:'double',reviewDurationCount:'long' })], parameterDefinitions:[],parameters:{},
    definitions:[formula('fireBucketValid',['fireReviewBucket'],`${validBucket} ? 1 : 0`, { options:{ stateLabels:labels(['fireBucketInvalid','fireBucketComplete']) } }),
      ...Object.entries(countOutputs).map(([id, field]) => formula(id,['fireReviewBucket','fireBucketValid'],`fireBucketValid == 1 ? fireReviewBucket['${field}'] : null`)),
      formula('fireClassifiedCount',['fireTrueCount','fireFalseCount'],"fireTrueCount == null || fireFalseCount == null ? null : fireTrueCount + fireFalseCount"),
      formula('fireFalseAlarmPercent',['fireFalseCount','fireClassifiedCount'],"fireClassifiedCount == null || fireClassifiedCount <= 0 ? null : fireFalseCount * 100.0 / fireClassifiedCount"),
      formula('fireReviewCoverage',['fireTotalCount','fireTestCount','firePendingCount'],"fireTotalCount == null || fireTotalCount <= fireTestCount ? null : (fireTotalCount - fireTestCount - firePendingCount) * 100.0 / (fireTotalCount - fireTestCount)"),
      formula('fireAverageReviewSeconds',['fireReviewBucket','fireBucketValid','fireTotalCount','firePendingCount'],"fireBucketValid != 1 || fireReviewBucket['reviewDurationSum'] == null || fireReviewBucket['reviewDurationCount'] == null || fireReviewBucket['reviewDurationSum'] < 0 || fireReviewBucket['reviewDurationCount'] <= 0 || fireReviewBucket['reviewDurationCount'] % 1 != 0 || fireReviewBucket['reviewDurationCount'] > fireTotalCount - firePendingCount ? null : fireReviewBucket['reviewDurationSum'] / (fireReviewBucket['reviewDurationCount'] * 1.0)")],
    outputs:[output('fireFalseAlarmPercent','ratio','%'),output('fireReviewCoverage','ratio','%'),...Object.keys(countOutputs).map(id => output(id,'numeric')),output('fireClassifiedCount','numeric'),output('fireAverageReviewSeconds','duration','s'),output('fireBucketValid','state')],
    options:{ category:'fire',icon:'SafetyCertificateOutlined',description:t('fireGovernance.description'),notes:t('fireGovernance.notes'),presentation:{ settings:{ primaryOutput:'fireFalseAlarmPercent',summaryOutputs:['firePendingCount','fireReviewCoverage'] } } } }

  const make = (template: MetricTemplate, frames: Array<{ minute:number; values:Record<string,unknown> }>, endMinute:number): MetricTemplateStarter => {
    // 与其他起点一致保存双语字段，发布后切换语言不依赖页面重新生成模板。
    const messages: Record<string, Record<string, string>> = {}
    for (const [language, translations] of Object.entries(fireMessages)) {
      const put = (field:string, key:string) => { const value = key.split('.').reduce<unknown>((object, part) => (object as Record<string, unknown>)?.[part], translations); if (typeof value === 'string') (messages[field] ||= {})[language] = value }
      for (const field of ['name','description','notes']) put(field, `${template.id}.${field}`)
      template.inputDefinitions.forEach(item => put(`input.${item.id}.name`, item.id === 'evidence' ? 'fireEvidenceInput' : item.id))
      template.definitions.forEach(item => { if (typeof item.id === 'string') put(`rule.${item.id}.name`, item.id) })
      template.outputs.forEach(item => put(`output.${item.metricId}.label`, item.metricId))
      template.parameterDefinitions.forEach(item => put(`parameter.${item.id}.name`, item.id))
    }
    template.options!.i18nMessages = messages
    const configuration: MetricConfig = { ownerType:'simulation',ownerId:'example',targetType:'simulation',targetId:'example',slot:'example',templateId:template.id,templateVersion:'1',state:'disabled',revision:0,parameters:{},
      inputMappings:Object.fromEntries(template.inputDefinitions.map(item => [item.id,{ kind:'property' as const,thingType:'device',thingId:'example-fire-detector',id:item.id }])) }
    const samples = frames.flatMap(frame => Object.entries(frame.values).map(([metricId,value]) => ({ thingType:'device',thingId:'example-fire-detector',metricId,value,
      eventTime:start + frame.minute * 60000,ingestTime:start + frame.minute * 60000,processTime:start + frame.minute * 60000,quality:{ valid:true } })))
    const structured=structureMetricTemplate(template)
    if(structured.unsupported.length)throw new Error(structured.unsupported.join(', '))
    return { id:template.id,name:template.name,description:String(template.options!.description),groupId:'fire',icon:String(template.options!.icon),template:structured.template,simulation:{ configuration,samples,endAt:start + endMinute * 60000 } }
  }
  return [make(evidence,[{ minute:0,values:{ fireEvent:{ eventId:'event-1',active:true,startedAt:start },evidence:{ eventId:'event-1',observedAt:start,pollution:true,humidityPercent:95,independentResponses:1 },fireReview:{ eventId:'event-1',decision:0,reviewedAt:start } } },
    { minute:5,values:{ fireReview:{ eventId:'event-1',decision:2,reviewedAt:start + 300000 } } }], 8),
  make(governance,[{ minute:60,values:{ fireReviewBucket:{ from:start,to:start + 3600000,total:3,confirmedFire:1,falseAlarm:1,plannedTest:0,undetermined:0,pending:1,reviewDurationSum:600,reviewDurationCount:2 } } }],60)]
}
