import type { MetricTemplateStarter } from '@rule-engine-manager-ui/metric'
import { scenario } from './starterScenario'

const number = { type:'double', scale:8 }
const reference = (id:string) => ({ type:'reference', id, path:[] })
const binary = (operator:string,left:object,right:object) => ({ type:'binary', operator, left, right })
const tree = (root:object) => ({ version:1, root })
const current = (id:string,name:[string,string],unit?:string) => ({ id,name,valueType:number,maxAge:'PT30S',...(unit ? {unit} : {}) })
const samples = (metricId:string,values:number[],step=5) => values.map((value,index) => ({metricId,value,offsetSeconds:index*step}))
const filter = (operation:string,input:string,parameters:Record<string,unknown>,boolean=false,unit?:string) => ({
  type:'composite', inputs:[{id:'signal',metricId:input}],
  calculator:{provider:'filter',providerVersion:'1',inputTypes:{signal:number},outputType:boolean ? {type:'boolean'} : number,...(unit ? {outputUnit:unit} : {}),
    parameters:{operation,maxGap:'PT30S',...parameters}},
})
const referenceDoc = { name:'NIST: Measurement process characterization',url:'https://www.itl.nist.gov/div898/handbook/mpc/mpc.htm' }

/** Executable references use current object inputs, visual algorithms and editable formulas. */
export const signalQualityStarters:MetricTemplateStarter[] = [
  scenario({
    id:'level-volume-calibration',name:['液位换算容积','Level-to-volume calibration'],description:['按容器标定点将液位换算为容积。','Convert level to volume using measured calibration points.'],
    notes:['绑定液位后，在查表校准中填写液位与容积两列；输入点递增，超出标定范围不外推。示例为cm与L，请按实际标定修改。','Bind level and edit measured/converted pairs in the calibration table. Inputs must increase; no extrapolation. Example units are cm and L.'],
    icon:'DotChartOutlined',group:'energy',inputs:[current('level',['液位','Level'],'cm')],
    rules:[{id:'volume',name:['容积','Volume'],type:'composite',inputs:[{id:'signal',metricId:'level'}],
      calculator:{provider:'calibration',providerVersion:'1',inputTypes:{signal:number},outputType:number,outputUnit:'L',
        parameters:{operation:'linear',points:[{input:0,output:0},{input:50,output:400},{input:100,output:1000}]}}}],
    outputs:[{metricId:'volume',name:['容积','Volume'],unit:'L',valueType:'double'}],
    samples:samples('level',[0,25,50,75,100]),reference:referenceDoc,
  }),
  scenario({
    id:'level-spike-filter',name:['液位毛刺过滤','Level spike filter'],description:['保留原始液位，同时查看去除单点毛刺后的读数。','Keep raw level alongside a reading with isolated spikes removed.'],
    notes:['绑定当前液位。默认最近3点中值；可切换5点。断流30秒重新预热，预热不补零；过滤会带来响应延迟，不能替代安全保护。','Bind current level. Default median size 3, optionally 5. Restart after a 30-second gap, without zero fill. Filtering adds delay and is not a safety interlock.'],
    icon:'FilterOutlined',group:'condition',inputs:[current('level',['原始液位','Raw level'],'cm')],
    rules:[{id:'filtered',name:['过滤液位','Filtered level'],...filter('median','level',{windowSize:3},false,'cm')},
      {id:'raw',name:['原始液位','Raw level'],type:'composite',dependsOn:['level'],expressionTree:tree(reference('level'))}],
    outputs:[{metricId:'filtered',name:['过滤液位','Filtered level'],unit:'cm',valueType:'double'},{metricId:'raw',name:['原始液位','Raw level'],unit:'cm',valueType:'double'}],
    samples:samples('level',[10,11,80,12,11]),reference:referenceDoc,
  }),
  scenario({
    id:'pressure-stable-segment',name:['压力稳态确认','Pressure stability confirmation'],description:['压力波动在允许范围内持续一段时间后，确认进入稳态。','Confirm a stable pressure segment after bounded variation persists.'],
    notes:['绑定当前压力，设置允许波动、持续时长与最少样本数。示例为1kPa、10秒、3点。超限或断流30秒后重新确认；稳态不代表压力处于安全范围。','Bind current pressure and set allowed range, duration and minimum samples. Defaults: 1 kPa, 10 seconds, 3 observations. Restart on excess variation or 30-second gaps. Stability does not imply a safe pressure.'],
    icon:'CheckCircleOutlined',group:'condition',inputs:[current('pressure',['压力','Pressure'],'kPa')],
    rules:[{id:'stable',name:['压力已稳定','Pressure stable'],...filter('stability','pressure',{duration:'PT10S',samples:3,tolerance:1},true)}],
    outputs:[{metricId:'stable',name:['压力已稳定','Pressure stable'],valueType:'boolean'}],
    samples:samples('pressure',[100,100.4,100.2,103,103.2,103.1]),reference:referenceDoc,
  }),
  scenario({
    id:'temperature-hysteresis',name:['温度越限防抖','Temperature limit confirmation'],description:['分别设置成立和解除温度，再确认持续超限。','Use separate activation and recovery temperatures, then confirm persistence.'],
    notes:['绑定温度；示例温度连续不低于80°C达10秒后成立，连续不高于75°C达5秒后解除。阈值与时长均可交互修改；确认过程中不再满足对应阈值时重新计时。缺数30秒停止确认，不能替代安全联锁。','Bind temperature. Activate after at least 80°C continuously for 10 seconds; clear after at most 75°C continuously for 5 seconds. Edit thresholds and durations visually. Restart confirmation if its threshold is no longer met. Stop confirmation after 30 seconds without data; not a safety interlock.'],
    icon:'SwapOutlined',group:'condition',inputs:[current('temperature',['温度','Temperature'],'°C')],
    rules:[{id:'confirmed',name:['持续温度越限','Confirmed high temperature'],dependsOn:['temperature'],temporalCondition:{
        dwell:'PT10S',recovery:'PT5S',maxNoData:'PT30S',
        enterTree:tree(binary('ge',reference('temperature'),{type:'literal',valueType:'double',value:'80'})),
        exitTree:tree(binary('le',reference('temperature'),{type:'literal',valueType:'double',value:'75'})),
      }}],
    outputs:[{metricId:'confirmed',name:['持续温度越限','Confirmed high temperature'],valueType:'boolean'}],
    samples:samples('temperature',[70,81,82,83,78,74,73]),reference:referenceDoc,
  }),
  scenario({
    id:'load-compensated-temperature',name:['负载补偿温升','Load-compensated temperature rise'],description:['结合环境温度和实际负载，比较温升与已标定基线的偏差。','Compare temperature with a calibrated baseline using ambient temperature and actual load.'],
    notes:['绑定温度、环境温度和0到1的负载率。在“正常负载温升”中填写已确认正常的负载率／温升样本，至少3组；准备时拟合，实时不训练，超出负载样本范围不外推。示例0→0、0.5→15、1→30仅供试算。每1分钟计算一次偏差，输入时间最多相差1秒；偏差持续超5°C达1分钟提示复核，低于2°C持续1分钟解除。不是故障概率。','Bind temperature, ambient temperature and load ratio from 0 to 1. Edit at least three confirmed normal load/rise pairs in Normal load temperature rise. Fit during preparation, never per sample; no extrapolation. Example pairs 0→0, 0.5→15 and 1→30 are illustrative. Evaluate the residual every minute with inputs within one second. Confirm residuals above 5°C for one minute; clear below 2°C for one minute. This is not a failure probability.'],
    icon:'LineChartOutlined',group:'condition',
    inputs:[current('temperature',['温度','Temperature'],'°C'),current('ambient',['环境温度','Ambient temperature'],'°C'),
      {...current('load',['负载率（0～1）','Load ratio (0–1)']),valueType:{...number,min:0,max:1}}],
    rules:[{id:'normalRise',name:['正常负载温升','Normal load temperature rise'],type:'composite',inputs:[{id:'signal',metricId:'load'}],
      calculator:{provider:'calibration',providerVersion:'1',inputTypes:{signal:number},outputType:number,outputUnit:'°C',
        parameters:{operation:'linearBaseline',points:[{input:0,output:0},{input:.5,output:15},{input:1,output:30}]}}},
      {id:'expected',name:['当前负载的基线温度','Baseline at current load'],type:'composite',dependsOn:['ambient','normalRise'],maxInputSkew:'PT1S',
        expressionTree:tree(binary('add',reference('ambient'),reference('normalRise')))},
      {id:'residual',name:['偏离基线温度','Temperature residual'],type:'composite',dependsOn:['temperature','expected'],
        maxInputSkew:'PT1S',window:{mode:'none',emitPolicy:'onSchedule',emitInterval:'PT1M'},
        expressionTree:tree(binary('subtract',reference('temperature'),reference('expected')))},
      {id:'sustainedDeviation',name:['持续偏离正常温升','Sustained temperature deviation'],dependsOn:['residual'],temporalCondition:{
        dwell:'PT1M',recovery:'PT1M',maxNoData:'PT2M',
        enterTree:tree(binary('gt',reference('residual'),{type:'literal',valueType:'double',value:'5'})),
        exitTree:tree(binary('lt',reference('residual'),{type:'literal',valueType:'double',value:'2'}))}}],
    outputs:[{metricId:'residual',name:['偏离基线温度','Temperature residual'],unit:'°C',valueType:'double'},
      {metricId:'expected',name:['基线温度','Baseline temperature'],unit:'°C',valueType:'double'},
      {metricId:'sustainedDeviation',name:['持续偏离正常温升','Sustained temperature deviation'],valueType:'boolean'}],
    samples:[...samples('ambient',Array(61).fill(20)),...samples('load',Array(61).fill(.5)),
      ...samples('temperature',Array.from({length:61},(_,i)=>i===60 ? 40 : i>=6 && i<=30 ? 44 : 35))]
      .sort((a,b)=>a.offsetSeconds-b.offsetSeconds),reference:referenceDoc,
  }),
]
