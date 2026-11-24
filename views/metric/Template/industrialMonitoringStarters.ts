import type { MetricTemplateStarter } from '@rule-engine-manager-ui/metric'
import { scenario } from './starterScenario'

const number = { type:'double', scale:8 }
const ref = (id:string,path:string[]=[]) => ({type:'reference',id,path})
const literal = (value:number) => ({type:'literal',valueType:'double',value:String(value)})
const binary = (operator:string,left:object,right:object) => ({type:'binary',operator,left,right})
const tree = (root:object) => ({version:1,root})
const parameter = (id:string,name:[string,string],value:number,unit?:string) => ({id,name,valueType:{...number,min:.000001,...(unit ? {unit} : {})},expands:{defaultValue:value,editable:true}})
const param = (id:string) => ref('params',[id])
const samples = (metricId:string,values:number[]) => values.map((value,index)=>({metricId,value,offsetSeconds:index*5}))
const current = (id:string,name:[string,string],unit:string) => ({id,name,valueType:{...number,min:0},unit,maxAge:'PT30S'})

/** Industrial decisions are ordinary editable declarations, not equipment-specific calculators. */
export const industrialMonitoringStarters:MetricTemplateStarter[] = [
  scenario({
    id:'specific-energy-deviation',name:['单位产出能耗偏差','Specific energy deviation'],group:'energy',icon:'ThunderboltOutlined',
    description:['在稳定生产时，对照基准观察当前每吨产出的耗电和持续偏差。','Compare current electricity per tonne against a calibrated baseline during steady production.'],
    notes:['绑定同一生产边界的有功功率(kW)和实际产出速度(t/h)，每1分钟评估一次，输入时间最多相差1秒。功率÷产出速度得到当前kWh/t，适合稳定生产；不是班次累计电量÷产量。低于最低产出速度时不判断，不将停机或缺数补成零。基准6kWh/t、最低0.1t/h仅为示例，须按产品和工况标定。偏高20%持续1分钟成立，回到偏高10%以内持续1分钟解除。',
      'Bind active power (kW) and actual production rate (t/h) for the same production boundary. Evaluate every minute with inputs within one second. Power/rate gives current kWh/t during steady production, not a shift total. Do not judge below minimum throughput or fill downtime/missing data with zero. Calibrate the example baseline 6 kWh/t and minimum rate 0.1 t/h by product and operating condition. Confirm 20% excess for one minute; clear below 10% excess for one minute.'],
    inputs:[current('power',['有功功率','Active power'],'kW'),current('productionRate',['实际产出速度','Actual production rate'],'t/h')],
    parameters:[parameter('baseline',['正常单位产出能耗','Normal specific energy'],6,'kWh/t'),parameter('minimumRate',['最低产出速度','Minimum production rate'],.1,'t/h')],
    rules:[{id:'specificEnergy',name:['当前单位产出能耗','Current specific energy'],type:'composite',dependsOn:['power','productionRate'],maxInputSkew:'PT1S',
      window:{mode:'none',emitPolicy:'onSchedule',emitInterval:'PT1M'},
      applicabilityTree:tree({type:'logical',operator:'and',operands:[binary('ge',ref('productionRate'),param('minimumRate')),binary('ge',ref('power'),literal(0))]}),
      expressionTree:tree(binary('divide',ref('power'),ref('productionRate')))},
      {id:'deviation',name:['高于基准比例','Excess above baseline'],type:'composite',dependsOn:['specificEnergy'],
        expressionTree:tree(binary('multiply',binary('subtract',binary('divide',ref('specificEnergy'),param('baseline')),literal(1)),literal(100)))},
      {id:'persistentExcess',name:['单位产出能耗持续偏高','Sustained excess specific energy'],dependsOn:['deviation'],temporalCondition:{
        dwell:'PT1M',recovery:'PT1M',maxNoData:'PT2M',enterTree:tree(binary('gt',ref('deviation'),literal(20))),exitTree:tree(binary('lt',ref('deviation'),literal(10)))}}],
    outputs:[{metricId:'specificEnergy',name:['当前单位产出能耗','Current specific energy'],valueType:'double',unit:'kWh/t'},
      {metricId:'deviation',name:['高于基准比例','Excess above baseline'],valueType:'double',unit:'%'},
      {metricId:'persistentExcess',name:['单位产出能耗持续偏高','Sustained excess specific energy'],valueType:'boolean'}],
    samples:[...samples('power',Array.from({length:61},(_,i)=>i>=6 && i<=30 ? 18 : 12)),...samples('productionRate',Array(61).fill(2))].sort((a,b)=>a.offsetSeconds-b.offsetSeconds),
    reference:{name:'NIST: Engineering statistics and process monitoring',url:'https://www.itl.nist.gov/div898/handbook/pmc/pmc.htm'},
  }),
  scenario({
    id:'actuator-response-degradation',name:['执行器响应变慢','Actuator response degradation'],group:'condition',icon:'FieldTimeOutlined',
    description:['对照正常耗时，观察同类动作的平均响应和连续变慢。','Compare completed actions of the same kind against normal response duration.'],
    notes:['绑定PLC或设备已测得并上报的动作确认耗时，单位秒；例如从开阀开始到开到位。来源应已按同一次动作配对，不能绑定回复时间戳、网络延迟或混合开阀／关阀耗时。基准2秒仅供试算，应按动作与工况标定。最近3次全部比基准慢20%以上才提示；不足3次不判断。保留最近3次，不因等待时间变长而虚构新动作；未完成／超时动作需由来源另行声明。',
      'Bind action-confirmation duration measured and reported by the PLC/device, in seconds, e.g. valve-open start to open feedback. The source must pair the same action. Do not bind response timestamps, network latency or mixed opening/closing durations. Calibrate the example two-second baseline by action and operating condition. Indicate slowdown only when all last three completed actions exceed baseline by 20%; fewer than three gives no judgment. Keep three observations; waiting does not create new actions. Incomplete/time-out actions need separate source facts.'],
    inputs:[{...current('response',['已完成动作耗时','Completed action duration'],'s'),maxAge:'PT2M'}],
    parameters:[parameter('baseline',['正常动作耗时','Normal action duration'],2,'s'),parameter('excessRatio',['变慢比例','Slowdown ratio'],20,'%')],
    rules:[{id:'rawAverage',name:['动作耗时采样均值','Sample mean action duration'],type:'feature',sourceMetric:'response',aggregation:'avg',window:{mode:'latestN',size:'3',timeMode:'event',emitPolicy:'onEvent'}},
      {id:'minimum',name:['最近3次最短耗时','Minimum of last three actions'],type:'feature',sourceMetric:'response',aggregation:'min',window:{mode:'latestN',size:'3',timeMode:'event',emitPolicy:'onEvent'}},
      {id:'count',name:['已观测动作数','Observed action count'],type:'feature',sourceMetric:'response',aggregation:'count',window:{mode:'latestN',size:'3',timeMode:'event',emitPolicy:'onEvent'}},
      {id:'average',name:['最近3次平均耗时','Mean of last three actions'],type:'composite',dependsOn:['rawAverage','minimum'],
        applicabilityTree:tree(binary('ge',ref('minimum'),literal(0))),expressionTree:tree(ref('rawAverage'))},
      {id:'slow',name:['连续3次动作变慢','Three successive slow actions'],type:'composite',dependsOn:['minimum','count'],
        applicabilityTree:tree({type:'logical',operator:'and',operands:[binary('ge',ref('count'),literal(3)),binary('ge',ref('minimum'),literal(0))]}),
        expressionTree:tree(binary('gt',ref('minimum'),binary('multiply',param('baseline'),binary('add',literal(1),binary('divide',param('excessRatio'),literal(100))))))}],
    outputs:[{metricId:'average',name:['最近3次平均耗时','Mean of last three actions'],valueType:'double',unit:'s'},
      {metricId:'slow',name:['连续3次动作变慢','Three successive slow actions'],valueType:'boolean'}],
    samples:samples('response',[2,3,3.2,3.4,2]),
    reference:{name:'NIST: Engineering statistics and process monitoring',url:'https://www.itl.nist.gov/div898/handbook/pmc/pmc.htm'},
  }),
]
