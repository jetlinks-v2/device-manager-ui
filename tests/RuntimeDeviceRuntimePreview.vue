<template>
  <main class="device-runtime-preview"><h1>设备运行 · 真实组件验收</h1><p>合成数据，仅用于布局与交互验收；不访问后端、不读取认证信息。</p>
    <div class="preview-controls"><a-select v-model:value="scenario" :options="scenarios" @change="selectScenario" /><a-radio-group v-model:value="width"><a-radio-button v-for="size in [360,640,1040]" :key="size" :value="size">{{ size }}px</a-radio-button></a-radio-group><a-button @click="locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'English' : '中文' }}</a-button><a-button @click="sample">追加采样</a-button></div>
    <div class="preview-panel" :style="{ maxWidth: `${width}px` }"><DeviceRuntimeTrend :session="session" :communication="communication" :cache="cache" :recording="recording" :config="config" @peak="showPeak" @live="peakFocus = undefined" @configure="value => config = { ...config, ...value }" @details="value => event = value" /></div>
    <p>交互：{{ event || '尚无操作' }} · {{ JSON.stringify(config) }}</p>
    <div class="preview-node"><NodeSummary node-id="iot-service:8200" label="iot-service:8200" :session="nodeSession" /></div>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceRuntimeTrend from '../views/link/diagnostics/overview/DeviceRuntimeTrend.vue'
import NodeSummary from '../views/link/RuntimeMonitor/NodeSummary.vue'
import type { OverviewTrend } from '../views/link/diagnostics/overview/useOverviewTrends'
import type { DiagnosticNodePreference } from '../views/link/diagnostics/preferences'
import { peakNeighborhood, recordingMetrics, type DeviceRecording, type DeviceRecordingView, type DevicePeakSelection } from '../views/link/RuntimeMonitor/device-runtime/deviceMessageRecording'
import { appendDeviceMessageSample, deviceMessageSample, type DeviceMessageSample, type NodeDeviceMessageSnapshot } from '../views/link/RuntimeMonitor/device-runtime/deviceMessageHistory'
const { locale } = useI18n(), width = ref(1040), scenario = ref('both'), event = ref(''), config = ref<DiagnosticNodePreference>({}), offset = ref(0)
const scenarios = [{value:'history',label:'后端60秒历史与峰值'},{value:'historyOutside',label:'今日峰值超出一小时'},{value:'historyZero',label:'后端真实零历史'},{ value:'both',label:'会话 + 通信 + 缓存' },{ value:'session',label:'仅会话（旧服务降级）' },{ value:'communication',label:'仅通信（无会话）' },{ value:'stale',label:'通信失败保留' },{ value:'first',label:'等待首个完整窗口' },{ value:'zero',label:'空闲真实零速率' },{ value:'high',label:'高吞吐' },{ value:'legacy',label:'旧8属性（无QPS）' },{ value:'legacy10',label:'旧10属性（无QPS）' },{ value:'partial',label:'复合快照缺发送QPS' },{ value:'reset',label:'统计代次重建' },{ value:'duplicate',label:'重复旧窗口并过期' },{ value:'clock',label:'服务端校时回拨3天' },{ value:'alloff',label:'全部图例关闭' },{ value:'nodata',label:'所选指标缺数据' }]
const now = Date.now(), base = 9223372036854000000n
const session = computed<OverviewTrend | undefined>(() => scenario.value === 'communication' ? undefined : ({ key:'sessions',title:'RuntimeMonitor.overviewSessionRecords',caption:'',help:'RuntimeMonitor.overviewSessionHelp',history:Array.from({ length:16+offset.value },(_,i)=>({ timestamp:now-(15-i)*3000,value:String(80+Math.round(Math.sin(i/2)*4)) })),state:{status:'ready',sampledAt:now+offset.value*3000},retainedValue:'84',facts:[],details:'session' }))
const communication = computed<NodeDeviceMessageSnapshot | undefined>(() => {
  if (scenario.value === 'session') return undefined
  const length = scenario.value === 'first' ? 1+offset.value : 16+offset.value
  const multiplier = scenario.value === 'high' ? 100000 : scenario.value === 'zero' ? 0 : 1
  const samples = Array.from({length},(_,i) => {
    const reset = scenario.value === 'reset' && i >= 15, n = reset ? i-15 : i, clock = scenario.value === 'clock' && i >= 15, stamp = now-(15-i)*3000+700-(clock ? 259200000 : 0)
    const waiting = scenario.value === 'first' && i === 0 || reset && i === 15
    const sourceTime = scenario.value === 'duplicate' && i >= 14 ? Math.floor((now-2300)/100)*100 : Math.floor(stamp/100)*100
    const qps = { ReceivedQps:12*multiplier, SentQps:4*multiplier, CommunicationQps:16*multiplier, QpsSampleTime:waiting ? 0 : sourceTime, QpsWindowMillis:waiting ? 0 : 1000, QpsReady:!waiting,QpsWindowSequence:String(scenario.value === 'duplicate' && i>=14 ? 140 : i*30) }
    const { SentQps, ...partial } = qps
    const fields = { StartTime:reset ? now : now-3600000, SnapshotTime:stamp, ReceivedBytesTotal:String(base+BigInt(n*5000*multiplier)), SentBytesTotal:String(base+BigInt(n*1200*multiplier)), UpstreamMessagesTotal:String(base+BigInt(n*30*multiplier)), ...(scenario.value==='nodata'?{}:{PropertyReportsTotal:String(base+BigInt(n*18*multiplier))}), PropertyValuesTotal:String(base+BigInt(n*72*multiplier)), EventReportsTotal:String(base+BigInt(n*6*multiplier)), ...(scenario.value === 'legacy' ? {} : {ReceivedPacketsTotal:String(base+BigInt(n*360*multiplier)),SentPacketsTotal:String(base+BigInt(n*120*multiplier))}), ...(['legacy','legacy10'].includes(scenario.value) ? {} : {QpsSnapshot:scenario.value === 'partial' ? partial : qps}) }
    return deviceMessageSample({domain:'org.jetlinks',type:'DeviceMessageMonitor',name:'DeviceMessageMonitor',objectName:'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor',operations:[],attributes:Object.entries(fields).map(([name,value]) => ({name,value,available:true,readable:true,type:''}))})!
  })
  const history = samples.reduce((segment, sample) => appendDeviceMessageSample(segment, sample), [] as DeviceMessageSample[])
  return { supported:true,state:{status:scenario.value==='stale'?'stale':'ready',sampledAt:history.at(-1)!.timestamp},history:scenario.value==='stale'?[...history,{timestamp:history.at(-1)!.timestamp}]:history }
})
const cache = computed<OverviewTrend|undefined>(() => ['both','high','stale','zero','first'].includes(scenario.value) ? {key:'property-cache',title:'RuntimeMonitor.overviewPropertyCache',caption:'',help:'RuntimeMonitor.overviewCacheHelp',history:[],retainedValue:'3460',dirtyCount:'12',state:{status:'ready',sampledAt:now},facts:[{label:'RuntimeMonitor.overviewDirtyKeys',value:'12'},{label:'RuntimeMonitor.overviewDirtyQueue',value:'0'}],details:'org.jetlinks:type=ThingsDataManager,name=local'} : undefined)
const nodeSession = computed(() => ({supported:!!session.value,state:session.value?.state??{status:'empty' as const},sessions:session.value?.history.at(-1)?.value,history:session.value?.history,communication:communication.value}))
const peakFocus = ref<DevicePeakSelection>()
const recordedHour = computed(() => Array.from({length:3600}, (_, sequence) => {
  const value = scenario.value === 'historyZero' ? 0 : sequence === 1800 ? 1800 : Math.round(8 + 6 * Math.abs(Math.sin(sequence / 8)))
  return {sequence:sequence+(scenario.value==='historyOutside'?7200:0), timestamp: now - (3599 - sequence) * 1000, values: {Communication:value,ReceivedPackets:value,SentPackets:0,UpstreamMessages:Math.round(value*.8),PropertyReports:Math.round(value*.5),PropertyValues:value*4,EventReports:Math.round(value*.1),ReceivedBytes:value*1024,SentBytes:0}}
}))
const recorded = computed<DeviceRecording>(() => {
  const points = recordedHour.value, max = points.reduce((a,b)=>a.values.Communication>b.values.Communication?a:b)
  const peaks = recordingMetrics.map(metric=>({metric,value:max.values[metric],timestamp:max.timestamp,sequence:max.sequence}))
  const outside = scenario.value==='historyOutside'
  return {generation:'42',statisticsStartTime:now-(outside?10800000:3600000),sampledAt:now,firstSequence:0,endSequence:outside?10800:3600,zoneId:'Asia/Shanghai',todayStartTime:now-36000000,hourPeaks:peaks,todayPeaks:outside?peaks.map(peak=>({...peak,timestamp:now-7200000,sequence:3599})):peaks,points:points.slice(-60)}
})
const recording = computed<DeviceRecordingView|undefined>(() => {
  if (!scenario.value.startsWith('history')) return undefined
  const selected = peakFocus.value ? peakNeighborhood(recordedHour.value,peakFocus.value.peak) : []
  return {data:recorded.value,points:peakFocus.value&&selected.length?selected:recorded.value.points,state:'ready',busy:false,active:true,focus:peakFocus.value,outside:!!peakFocus.value&&!selected.length}
})
function showPeak(value:DevicePeakSelection) { peakFocus.value=value;event.value='已定位峰值 '+new Date(value.peak.timestamp).toLocaleTimeString() }
function sample() { offset.value++ }
function selectScenario() { peakFocus.value=undefined;offset.value=0;config.value=scenario.value==='alloff'?{deviceRuntimeSeries:[]}:scenario.value==='nodata'?{deviceRuntimeSeries:['propertyReports']}:{}}
</script>
<style scoped>
.device-runtime-preview { min-height:100vh;padding:24px;background:var(--bg-sunken); }.device-runtime-preview h1 { font-size:20px; }.device-runtime-preview p { color:var(--ink-2);font-size:12px;overflow-wrap:anywhere; }.preview-controls { display:flex;flex-wrap:wrap;gap:8px; }.preview-controls :deep(.ant-select) { width:220px; }.preview-panel { margin-top:16px;padding:16px;background:var(--bg-base);min-width:0; }.preview-node { width:280px;padding:12px;background:var(--bg-base); }
</style>
