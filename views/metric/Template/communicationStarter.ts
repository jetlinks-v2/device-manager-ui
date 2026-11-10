import type { MetricConfig, MetricTemplate, MetricTemplateOutput, MetricTemplateStarter } from '@jetlinks-web-core/components'
import { communicationMessages } from './communicationMessages'
import { structureMetricTemplate } from '@jetlinks-web-core/components'

/** 当前连接/会话与历史评分独立，历史未知区间不改判当前通信状态。 */
export function createCommunicationStarter(t:(key:string)=>string):MetricTemplateStarter {
  const numeric = { type:'double', scale:4 }
  const schedule = { mode:'none', timeMode:'processing', emitPolicy:'onSchedule', emitInterval:'PT1M' }
  const formula = (id:string, dependencies:string[], expression:string, extra = {}) => ({ id, name:t(id), type:'composite',
    dependsOn:dependencies, inputs:dependencies.map(metricId => ({ id:metricId, metricId, presence:'optional' })), expression, ...extra })
  const labels = ['Normal','Offline','Unstable','Interrupted','Waiting','Unknown'].map((name,value) => ({ value, name:t(`communication${name}`),
    nameI18n:{ zh:communicationMessages.zh[`communication${name}` as keyof typeof communicationMessages.zh] as string,
      en:communicationMessages.en[`communication${name}` as keyof typeof communicationMessages.en] as string },
    icon:['color:#52c41a','color:#ff4d4f','color:#faad14','color:#fa8c16','color:#1677ff','color:#8c8c8c'][value] }))
  const output = (metricId:string, semantic:'state'|'score'|'duration'|'numeric'|'ratio', unit?:string):MetricTemplateOutput => ({ metricId, label:t(metricId),
    unit, valueType:semantic === 'state' ? 'int' : 'double', metricKind:semantic, persist:true, publish:true,
    options:{ explain:['communicationState','linkQualityScore'].includes(metricId), readAggregation:{ semantic, operations:semantic === 'state' ? ['collection','distribution'] : semantic === 'ratio' ? ['collection'] : ['collection','average','min','max'],
      defaultOperation:semantic === 'state' ? 'distribution' : semantic === 'ratio' ? 'collection' : semantic === 'duration' ? 'max' : 'average', defaultView:'list' } } })
  const param = (id:string, value:unknown, min?:number, max?:number, unit?:string) => ({ id, name:t(id), valueType:typeof value === 'boolean' ? { type:'boolean' } : { ...numeric, min, max, unit }, expands:{ defaultValue:value,editable:true } })
  const stats = "connectionStatistics";
  const template:MetricTemplate = { id:'communication', version:'1', name:t('communication.name'), thingType:'device', enabled:true,
    inputDefinitions:[{ id:'connectionState', name:t('communicationConnection'), valueType:{ type:'enum',valueType:{ type:'int' },elements:[{ value:0,text:t('communicationOffline') },{ value:1,text:t('state_online') }] }, source:{ lookback:'PT2H', maxPoints:512 } },
      { id:'lastCommunicationTime', name:t('communicationReport'), valueType:{ type:'date' }, presence:'optional' }],
    parameterDefinitions:[param('activityAssessmentEnabled',false), param('communicationIdleSeconds',180,1,604800,'s'),
      param('minCoveragePercent',95,0,100,'%'), {...param('disconnectLimit',3,1,1000),valueType:{type:'int',min:1,max:1000}}, {...param('scoreBaseline',6,1,1000),valueType:{type:'int',min:1,max:1000}}], parameters:{},
    definitions:[
      formula('currentConnection',['connectionState'],'connectionState', { window:{ ...schedule }, stateTracking:{ maxNoData:'PT2M' }, options:{ stateLabels:[{ value:0,name:t('communicationOffline'),nameI18n:{ zh:'离线',en:'Offline' },icon:'color:#ff4d4f' },{ value:1,name:t('state_online'),nameI18n:{ zh:'在线',en:'Online' },icon:'color:#52c41a' }] } }),
      { id:stats, name:t('communicationStatistics'), type:'composite', inputs:[{ id:'state',metricId:'connectionState' }], window:schedule,
        calculator:{ provider:'state',providerVersion:'1',inputTypes:{ state:{ type:'array',elementType:{ type:'int' } } },
          outputType:{ type:'object',properties:['activeDuration','inactiveDuration','unknownDuration','activeCount','inactiveCount','coverage'].map(id => ({ id,name:t(`communicationField_${id}`),valueType:{...numeric,...(id.endsWith('Duration') ? {unit:'s'} : {})} })) },
          parameters:{ duration:'PT1H',maxHold:'PT2M',activeValue:1,inactiveValue:0 } } },
      formula('observedOnlineRatio',[stats],`${stats} == null || ${stats}['activeDuration'] + ${stats}['inactiveDuration'] <= 0 ? null : 100.0 * ${stats}['activeDuration'] / (${stats}['activeDuration'] + ${stats}['inactiveDuration'])`),
      formula('windowOfflineSeconds',[stats],`${stats} == null ? null : ${stats}['inactiveDuration']`),
      formula('windowDisconnectCount',[stats],`${stats} == null ? null : ${stats}['inactiveCount']`),
      formula('windowUnknownSeconds',[stats],`${stats} == null ? null : ${stats}['unknownDuration']`),
      formula('communicationAgeSeconds',['lastCommunicationTime'],"lastCommunicationTime == null || lastCommunicationTime <= 0 || lastCommunicationTime > sample.getProcessTime() ? null : (sample.getProcessTime() - lastCommunicationTime) / 1000.0", { window:schedule }),
      formula('linkQualityScore',['currentConnection',stats,'observedOnlineRatio'],`currentConnection == 0 ? 0 : currentConnection != 1 || ${stats} == null || ${stats}['coverage'] * 100 < params.minCoveragePercent || observedOnlineRatio == null ? null : observedOnlineRatio * 0.8 + 20.0 * (${stats}['inactiveCount'] >= params.scoreBaseline ? 0 : 1.0 - ${stats}['inactiveCount'] / params.scoreBaseline)`),
      // 静默评估关闭时短路会话读取；历史统计只影响独立评分，不污染当前状态的质量。
      formula('communicationState',['currentConnection','communicationAgeSeconds'],`currentConnection == null ? 5 : currentConnection == 0 ? 1 : currentConnection != 1 ? 5 : !params.activityAssessmentEnabled ? 0 : communicationAgeSeconds == null ? 4 : communicationAgeSeconds > params.communicationIdleSeconds ? 3 : 0`,
        { options:{ stateLabels:labels } }),
    ],
    outputs:[output('communicationState','state'),output('linkQualityScore','score'),output('observedOnlineRatio','ratio','%'),output('windowOfflineSeconds','duration','s'),
      output('windowDisconnectCount','numeric'),output('currentConnection','state'),output('windowUnknownSeconds','duration','s'),output('communicationAgeSeconds','duration','s')],
    options:{ category:'maintenance',icon:'WifiOutlined',description:t('communication.description'),notes:t('communication.notes'),
      presentation:{ settings:{ primaryOutput:'communicationState',summaryOutputs:['linkQualityScore','windowDisconnectCount'] } } },
  }
  const messages:Record<string,Record<string,string>> = {}
  for (const [language, translations] of Object.entries(communicationMessages)) {
    const put = (field:string,key:string) => { const value = key.startsWith('communication.') ? translations.communication[key.slice(14) as 'name'|'description'|'notes'] : translations[key as keyof typeof translations]; if (typeof value === 'string') (messages[field] ||= {})[language] = value }
    for (const field of ['name','description','notes']) put(field,`communication.${field}`)
    template.outputs.forEach(item => put(`output.${item.metricId}.label`,item.metricId))
    template.parameterDefinitions.forEach(item => put(`parameter.${item.id}.name`,item.id))
    put('input.connectionState.name','communicationConnection'); put('input.lastCommunicationTime.name','communicationReport')
    template.definitions.forEach(item => put(`rule.${item.id}.name`,item.id === stats ? 'communicationStatistics' : String(item.id)))
  }
  template.options!.i18nMessages = messages
  const start = Date.UTC(2026,10,1)
  const configuration:MetricConfig = { ownerType:'simulation',ownerId:'example',targetType:'simulation',targetId:'example',slot:'example',templateId:template.id,templateVersion:'1',state:'disabled',revision:0,
    inputMappings:{ connectionState:{ kind:'property',thingType:'device',thingId:'example-gateway',id:'$online' },lastCommunicationTime:{ kind:'property',thingType:'device',thingId:'example-gateway',id:'$lastCommunicationTime' } },parameters:{} }
  const samples = [[0,1],[40,0],[42,1],[48,0],[49,1],[55,0],[56,1]].map(([minute,value]) => ({ thingType:'device',thingId:'example-gateway',metricId:'$online',value,
    eventTime:start + minute! * 60000,ingestTime:start + minute! * 60000,processTime:start + minute! * 60000,quality:{ valid:true,attributes:{ stateSince:start + minute! * 60000 } } }))
  const sessionSample = { thingType:'device',thingId:'example-gateway',metricId:'$lastCommunicationTime',value:start,eventTime:start,ingestTime:start,processTime:start,quality:{ valid:true } }
  const structured=structureMetricTemplate(template)
  if(structured.unsupported.length)throw new Error(structured.unsupported.join(', '))
  return { id:template.id,name:template.name,description:String(template.options?.description),groupId:'maintenance',icon:'WifiOutlined',template:structured.template,
    simulation:{ configuration,samples:[samples[0]!,sessionSample,...samples.slice(1)],endAt:start + 60 * 60000 } }
}
