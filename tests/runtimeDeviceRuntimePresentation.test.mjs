import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
const require=createRequire(import.meta.url), root=resolve(import.meta.dirname,'..'), cache=new Map(), received=[], buttons=[]
const messages=JSON.parse(readFileSync(resolve(root,'locales/lang/zh.json'))), t=(key,args={})=>(messages[key]??key).replace(/\{(\w+)\}/g,(_,name)=>args[name]??`{${name}}`)
const empty=vue.defineComponent({setup:()=>()=>null})
const sampleTime=timestamp=>new Date(timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,fractionalSecondDigits:3})
const chart=vue.defineComponent({props:['option','events'],setup:props=>{received.push(props);return()=>vue.h('div',{class:'real-chart-contract'})}})
function load(filename){
 if(cache.has(filename))return cache.get(filename)
 let source=readFileSync(filename,'utf8');if(filename.endsWith('.vue'))source=compileScript(parse(source,{filename}).descriptor,{id:filename,inlineTemplate:true}).content
 const module={exports:{}},{code}=transformSync(source,{loader:'ts',format:'cjs'})
 new Function('require','module','exports',code)(id=>{
  if(id==='vue')return vue
  if(id==='vue-i18n')return {useI18n:()=>({t,locale:vue.ref('zh')})}
  if(id==='ant-design-vue')return {Button:vue.defineComponent({setup:(_,ctx)=>()=>{buttons.push(ctx.attrs);return vue.h('button',ctx.attrs,ctx.slots.default?.())}}),theme:{useToken:()=>({token:vue.ref({})})}}
  if(id==='@ant-design/icons-vue')return {InfoCircleOutlined:vue.defineComponent({setup:(_,ctx)=>()=>vue.h('span',ctx.attrs)}),ArrowRightOutlined:empty,LinkOutlined:empty,UploadOutlined:empty,DownloadOutlined:empty,DatabaseOutlined:empty,ApiOutlined:empty,LineChartOutlined:empty,DownOutlined:empty,LoadingOutlined:empty,RollbackOutlined:empty,AimOutlined:empty,WarningOutlined:empty}
  if(id==='echarts/charts')return {LineChart:{}}
  if(id==='echarts/components')return {GridComponent:{},TooltipComponent:{},LegendComponent:{},DataZoomComponent:{}}
  if(id.endsWith('/Echarts/Echarts.vue'))return {__esModule:true,default:chart}
  return id.startsWith('.')?load(resolve(dirname(filename),/\.(ts|vue)$/.test(id)?id:`${id}.ts`)):require(id)
 },module,module.exports);cache.set(filename,module.exports);return module.exports
}
const Component=load(resolve(root,'views/link/diagnostics/overview/DeviceRuntimeTrend.vue')).default
const session={key:'sessions',history:[{timestamp:4000,value:'12'},{timestamp:7000,value:'14'}],state:{status:'ready',sampledAt:7000},retainedValue:'14',facts:[],details:'session'}
const communication={supported:true,state:{status:'ready',sampledAt:7700},history:[{timestamp:4700,startTime:'1000',counters:{upstreamMessages:'9007199254740993',receivedBytes:'1000',sentBytes:'0',propertyReports:'0',propertyValues:'0',eventReports:'0',receivedPackets:'9007199254740993',sentPackets:'0'},qps:{ready:true,timestamp:4500,windowMillis:1000,sequence:'45',values:{receivedQps:8,sentQps:2,communicationQps:10}}},{timestamp:7700,startTime:'1000',counters:{upstreamMessages:'9007199254741002',receivedBytes:'4072',sentBytes:'0',propertyReports:'6',propertyValues:'12',eventReports:'3',receivedPackets:'9007199254741005',sentPackets:'3'},qps:{ready:true,timestamp:7500,windowMillis:1000,sequence:'75',values:{receivedQps:17,sentQps:5,communicationQps:22}}}]}
async function render(props){received.length=0;buttons.length=0;const app=vue.createSSRApp(Component,props);for(const name of ['a-button','a-tooltip','a-segmented','a-popover'])app.component(name,{setup:(_,ctx)=>()=>vue.h('span',{'data-control':name},ctx.slots.default?.())});const html=await renderToString(app);return{html,chart:received.at(-1),buttons:[...buttons]}}
test('recorded chart uses the node timezone and its own freshness, independently of live QPS',async()=>{
 const timestamp=Date.UTC(2026,9,26,1,0,1),values={Communication:12,ReceivedPackets:10,SentPackets:2,UpstreamMessages:4,PropertyReports:3,PropertyValues:8,EventReports:1,ReceivedBytes:1024,SentBytes:64}
 const data={generation:'42',statisticsStartTime:timestamp-60000,sampledAt:timestamp,firstSequence:0,endSequence:60,zoneId:'Asia/Tokyo',todayStartTime:timestamp-3600000,hourPeaks:[],todayPeaks:[],points:[{timestamp:timestamp-1000,sequence:58,values},{timestamp,sequence:59,values}]}
 const source={...communication,state:{status:'stale',sampledAt:7700}}
 let view=await render({communication:source,recording:{data,points:data.points,state:'ready',busy:false,active:true,outside:false}})
 assert.equal(view.chart.option.xAxis.axisLabel.formatter(timestamp),'10:00:01')
 let text=view.chart.option.tooltip.formatter([{axisValue:timestamp}]).replace(/<[^>]+>/g,' ')
 assert.match(text,/10:00:01\.000/);assert.match(text,/通信 QPS\s+12 次\/s/);assert.doesNotMatch(text,/上次采集/)
 view=await render({communication,recording:{data,points:data.points,state:'stale',busy:false,active:true,outside:false}})
 text=view.chart.option.tooltip.formatter([{axisValue:timestamp}]).replace(/<[^>]+>/g,' ')
 assert.match(text,/上行消息\s+上次采集\s+4 条\/s/)
})
test('real component projects independent capabilities with actual session and rate axes, and formats cumulative differences',async()=>{
 let view=await render({session,communication})
 assert.match(view.html,/会话记录/);assert.match(view.html,/上行速率/);assert.match(view.html,/>3<\/b>/)
 assert.equal(view.chart.option.yAxis[0].min,0);assert.equal(view.chart.option.yAxis[0].max,undefined)
 const data=view.chart.option.series.find(item=>item.id==='sessions').data;assert.equal(data[1].value[1],14)
 const message=view.chart.option.series.find(item=>item.id==='upstreamMessages').data;assert.equal(message[1].value[1],3)
 view=await render({session});assert.equal(view.chart.option.yAxis[1].show,false);assert.doesNotMatch(view.html,/data-control="a-segmented"/)
 view=await render({communication});assert.equal(view.chart.option.yAxis[0].show,false);assert.equal(view.chart.option.yAxis[1].show,true)
 view=await render({});assert.equal(view.chart,undefined)
})
test('first snapshot displays waiting, zero is a real rate, and tooltip preserves each source actual time and exact count',async()=>{
 let view=await render({communication:{...communication,history:communication.history.slice(0,1)}});assert.match(view.html,/等待下一次采集/)
 view=await render({communication:{...communication,history:[communication.history[0],{...communication.history[0],timestamp:7700},{...communication.history[0],timestamp:10700}]}});assert.match(view.html,/>0<\/b>/);assert.doesNotMatch(view.html,/等待下一次采集/)
 const exact='9223372036854775807';view=await render({session:{...session,history:[{timestamp:7000,value:exact}]},communication})
 const options=view.chart.option, m=options.series.find(item=>item.id==='upstreamMessages').data[1]
 const tooltip=options.tooltip.formatter([{axisValue:7700,seriesId:'upstreamMessages',data:m}])
 assert.ok(tooltip.includes(BigInt(exact).toLocaleString()));assert.ok(tooltip.includes(sampleTime(7000)));assert.ok(tooltip.includes(sampleTime(7700)))
})
test('empty legend selection hides all unit axes and zoom emits bounded preferences',async()=>{
 const patches=[],view=await render({session,communication,config:{deviceRuntimeMode:'traffic',deviceRuntimeSeries:[]},onConfigure:value=>patches.push(value)})
 const option=view.chart.option;assert.ok(option.yAxis.every(axis=>!axis.show));assert.equal(option.series.length,8)
 assert.equal(option.series.find(item=>item.id==='receivedBytes').data[1].value[1],1024)
 assert.ok(Object.values(option.legend.selected).every(selected=>selected===false))
 view.chart.events.legendselectchanged({selected:{会话记录:false,接收流量:false,发送流量:false}});assert.deepEqual(patches.at(-1),{deviceRuntimeSeries:[]})
 view.chart.events.datazoom({batch:[{start:20,end:80}]});assert.deepEqual(patches.at(-1),{deviceRuntimeZoom:{start:20,end:80}})
 assert.equal(option.dataZoom[0].zoomOnMouseWheel,'ctrl');assert.equal(option.animation,false)
})
test('partial communication getter availability cannot fabricate missing series or an upstream reading',async()=>{
 const source={...communication,partial:true,history:communication.history.map(point=>({...point,counters:{sentBytes:point.counters.sentBytes}}))}
 const view=await render({communication:source,config:{deviceRuntimeMode:'traffic'}})
 assert.ok(view.chart.option.series.find(item=>item.id==='receivedBytes').data.every(point=>point.value[1]===null))
 assert.equal(view.chart.option.series.find(item=>item.id==='sentBytes').data[1].value[1],0)
 const tooltip=view.chart.option.tooltip.formatter([{seriesId:'receivedBytes',data:view.chart.option.series.find(item=>item.id==='receivedBytes').data[1]}]).replace(/<[^>]+>/g,' ');assert.match(tooltip,/接收流量\s+—/);assert.match(tooltip,/发送流量\s+0 B\/s/)
})

test('QPS adds a third default message curve, keeps raw packet units and direction details, and stays a reading in traffic mode',async()=>{
 let view=await render({session,communication})
 assert.equal(view.chart.option.yAxis[1].name,'');assert.match(view.html,/左轴：会话记录（条）/);assert.match(view.html,/右轴：消息（条\/s） · 通信 QPS（次\/s）/)
 assert.equal(view.chart.option.legend.selected['通信 QPS'],true)
 const qps=view.chart.option.series.find(item=>item.id==='communicationQps');assert.equal(qps.data[1].value[1],22)
 const tooltip=view.chart.option.tooltip.formatter([{seriesId:'communicationQps',data:qps.data[1]}]).replace(/<[^>]+>/g,' ');assert.match(tooltip,/22 次\/s/);assert.match(tooltip,/接收\s+17/);assert.match(tooltip,/发送\s+5/)
 view=await render({session,communication,config:{deviceRuntimeMode:'traffic'}})
 assert.equal(view.chart.option.legend.selected['通信 QPS'],false);assert.equal(view.chart.option.yAxis[1].show,false);assert.equal(view.chart.option.yAxis[2].show,true);assert.match(view.html,/右轴：流量（B\/s）/);assert.match(view.html,/通信/);assert.match(view.html,/>22<\/b>/)
})
test('tooltip groups only equal source timestamps and keeps subordinate values, full units and stale markers',async()=>{
 const view=await render({session:{...session,state:{status:'stale',sampledAt:7000}},communication}),option=view.chart.option
 const tooltip=option.tooltip.formatter(['sessions','upstreamMessages','propertyReports','communicationQps'].map(seriesId=>({seriesId,data:option.series.find(series=>series.id===seriesId).data.at(-1)})))
 assert.equal((tooltip.match(/<time>/g)??[]).length,3)
 assert.match(tooltip,/<time>\d{2}:\d{2}:\d{2}\.\d{3}<\/time>/)
 assert.equal(tooltip.split(`<time>${sampleTime(7700)}</time>`).length-1,1)
 const text=tooltip.replace(/<[^>]+>/g,' ')
 assert.match(text,/会话记录\s+上次采集\s+14 条/);assert.match(text,/上行消息\s+3 条\/s/);assert.match(text,/属性上报\s+2 条\/s\s+属性点位\s+4 点\/s/)
 assert.match(text,/通信 QPS\s+22 次\/s/);assert.match(text,/采样窗口 1秒/)
})
test('one hovered timestamp includes hidden message and traffic details in either mode without carrying values across gaps',async()=>{
 for(const deviceRuntimeMode of ['messages','traffic']){
  const view=await render({session,communication,config:{deviceRuntimeMode,deviceRuntimeSeries:['sessions','upstreamMessages','receivedBytes']}})
  const text=view.chart.option.tooltip.formatter([{axisValue:7700}]).replace(/<[^>]+>/g,' ')
  assert.match(text,/会话记录\s+14 条/);assert.match(text,/通信 QPS\s+22 次\/s/);assert.match(text,/属性上报\s+2 条\/s/);assert.match(text,/属性点位\s+4 点\/s/);assert.match(text,/事件上报\s+1 条\/s/);assert.match(text,/接收流量\s+1 KB\/s/);assert.match(text,/发送流量\s+0 B\/s/)
 }
 const view=await render({session:{...session,history:[session.history[0],{timestamp:7000}]},communication:{...communication,history:[...communication.history,{timestamp:7700}]}})
 const text=view.chart.option.tooltip.formatter([{axisValue:7700}]).replace(/<[^>]+>/g,' ')
 assert.match(text,/会话记录\s+—/);assert.match(text,/通信 QPS\s+—/);assert.match(text,/上行消息\s+—/)
 assert.doesNotMatch(view.chart.option.tooltip.formatter([{axisValue:100000}]),/22 次\/s|3 条\/s|14 条/)
 assert.equal(view.chart.option.tooltip.formatter([]),'')
})
test('legacy eight-attribute sources keep upstream and session while unavailable or reset QPS never renders a false zero',async()=>{
 const old={...communication,history:communication.history.map(point=>{const {receivedPackets,sentPackets,...counters}=point.counters;return {...point,counters,qps:undefined}})}
 let view=await render({session,communication:old});assert.equal(view.chart.option.legend.data.includes('通信 QPS'),false);assert.equal(view.chart.option.series.find(item=>item.id==='upstreamMessages').data[1].value[1],3)
 const partial={...communication,history:communication.history.map(point=>({...point,counters:{...point.counters,sentPackets:undefined},qps:{ready:false,invalid:true}}))}
 view=await render({communication:partial});assert.ok(view.chart.option.series.find(item=>item.id==='communicationQps').data.every(point=>point.value[1]===null));assert.doesNotMatch(view.html,/>0<\/b>/)
 const reset={...communication,history:[communication.history[0],{...communication.history[1],startTime:'2000',qps:{ready:false}}]}
 view=await render({communication:reset});assert.equal(view.chart.option.series.find(item=>item.id==='communicationQps').data.at(-1).value[1],null);assert.match(view.html,/等待首个窗口/)
})

test('QPS geometry uses its own source time, repeats no source points and compacts large message-axis ticks',async()=>{
 const repeated={...communication,history:[...communication.history,{...communication.history[1],timestamp:7800}]}
 const view=await render({communication:repeated}),points=view.chart.option.series.find(item=>item.id==='communicationQps').data
 assert.deepEqual(points.map(point=>point.value[0]),[4500,7500]);assert.equal(view.chart.option.yAxis[1].axisLabel.formatter(1600000),'1.6M')
 const tooltip=view.chart.option.tooltip.formatter([{seriesId:'communicationQps',data:points[1]}]);assert.match(tooltip,/采样窗口 1秒/);assert.ok(tooltip.includes(sampleTime(7500)))
})

test('legends freely combine message and traffic curves, persist across samples, and recover from all-off',async()=>{
 let patches=[],view=await render({session,communication,config:{deviceRuntimeSeries:[]},onConfigure:patch=>patches.push(patch)})
 assert.match(view.html,/未选择指标/);assert.match(view.html,/恢复默认/);assert.doesNotMatch(view.html,/data-control="a-segmented"/)
 view.chart.events.legendselectchanged({name:'接收流量',selected:{会话记录:false,上行消息:false,'通信 QPS':false,属性上报:false,事件上报:false,接收流量:true,发送流量:false}})
 assert.deepEqual(patches.at(-1),{deviceRuntimeSeries:['receivedBytes']})
 view=await render({session,communication,config:{deviceRuntimeMode:'traffic',deviceRuntimeSeries:['sessions','receivedBytes']},onConfigure:patch=>patches.push(patch)})
 assert.ok(view.chart.option.legend.data.includes('上行消息'))
 view.chart.events.legendselectchanged({name:'上行消息',selected:{会话记录:true,上行消息:true,'通信 QPS':false,属性上报:false,事件上报:false,接收流量:true,发送流量:false}})
 assert.deepEqual(patches.at(-1),{deviceRuntimeSeries:['sessions','receivedBytes','upstreamMessages']})
 const config={deviceRuntimeMode:'traffic',...patches.at(-1)}
 view=await render({session,communication,config})
 assert.deepEqual(view.chart.option.yAxis.map(axis=>axis.show),[true,true,true])
 assert.equal(view.chart.option.legend.selected['上行消息'],true);assert.equal(view.chart.option.legend.selected['接收流量'],true)
 assert.match(view.html,/右外轴：流量（B\/s）/)
 assert.equal(view.chart.option.series.find(series=>series.id==='receivedBytes').yAxisIndex,2)
 assert.equal(view.chart.option.series.find(series=>series.id==='upstreamMessages').yAxisIndex,1)
 view=await render({session,communication:{...communication,history:[...communication.history,{...communication.history[1],timestamp:10700}]},config})
 assert.equal(view.chart.option.legend.selected['上行消息'],true);assert.equal(view.chart.option.legend.selected['接收流量'],true)
 const missing={...communication,history:communication.history.map(point=>({...point,counters:{upstreamMessages:point.counters.upstreamMessages}}))}
 view=await render({communication:missing,config:{deviceRuntimeSeries:['propertyReports']}});assert.match(view.html,/暂无有效采样/)
 assert.ok(240-view.chart.option.grid.top-view.chart.option.grid.bottom>=145)
})
test('clock rollback keeps latest source readings visible without stretching a chart across old future session coordinates',async()=>{
 const old=1700000000000,current=old-259200000
 const view=await render({session:{...session,history:[{timestamp:old,value:'3'}]},communication:{supported:true,state:{status:'ready'},history:[{timestamp:current,startTime:String(old),counters:{upstreamMessages:'9'},qps:{ready:true,timestamp:current,windowMillis:1000,sequence:'101',values:{receivedQps:7,sentQps:2,communicationQps:9}}}]}})
 assert.match(view.html,/>9<\/b>/);assert.equal(view.chart.option.xAxis.min,current);assert.equal(view.chart.option.series.find(series=>series.id==='sessions').data.length,0)
})
test('line presentation keeps hover symbols available and explains a single point before a line exists',async()=>{
 const view=await render({communication:{...communication,history:communication.history.slice(0,1)},config:{deviceRuntimeSeries:['communicationQps']}})
 assert.ok(view.chart.option.series.every(series=>series.showSymbol===false&&series.symbol!=='none'&&series.connectNulls===false))
 assert.equal(view.chart.option.legend.icon,'rect');assert.equal(view.chart.option.legend.itemHeight,2);assert.match(view.html,/等待下一次采集/)
 const completed=await render({communication,config:{deviceRuntimeSeries:['communicationQps']}})
 assert.doesNotMatch(completed.html,/device-runtime-empty/)
})
test('native chart media lowers narrow time-axis density and restores wide ticks on resize',async()=>{
 const {init}=await import('echarts'),view=await render({session,communication}),chart=init(null,undefined,{renderer:'svg',ssr:true,width:328,height:216})
 try{chart.setOption(view.chart.option);assert.equal(chart.getModel().getComponent('xAxis').get('splitNumber'),2)
 const icons=[...chart.renderToSVGString().matchAll(/<path[^>]+ecmeta_ssr_type="legend"[^>]*>/g)].map(match=>match[0]).filter(path=>path.includes('ecmeta_silent="true"'))
 assert.ok(icons.length>0);assert.ok(icons.every(path=>path.includes('d="M0 0l16 0l0 2l-16 0Z"')&&/fill="(?!none")[^"]+"/.test(path)),'legend markers need painted area; fill-only line paths are invisible')
 chart.resize({width:1008});assert.equal(chart.getModel().getComponent('xAxis').get('splitNumber'),4)
 }finally{chart.dispose()}
})
test('cache exposes exact counts and direct navigation while preserving missing fields, stale state and the session gate',async()=>{
 const target='org.jetlinks:type=ThingsDataManager,name=local',events=[],count='9223372036854775807',cache={key:'property-cache',history:[],state:{status:'stale',sampledAt:7000},retainedValue:count,dirtyCount:'0',facts:[{label:'RuntimeMonitor.overviewDirtyKeys',value:'0'},{label:'RuntimeMonitor.overviewDirtyQueue',value:'2'}],details:target}
 let view=await render({session,communication,cache,onDetails:value=>events.push(value)})
 assert.ok(view.html.includes(BigInt(count).toLocaleString()));assert.match(view.html,/待落盘 <b>0<\/b>/);assert.match(view.html,/刷盘队列项: 2/);assert.match(view.html,/上次采集/);assert.doesNotMatch(view.html,/查看详情|ant-tag|data-control="a-tag"/)
 const link=view.buttons.find(button=>button.class==='device-runtime-cache-link');assert.equal(link.type,'link');link.onClick();assert.deepEqual(events,[target])
 view=await render({session,cache:{...cache,details:undefined,dirtyCount:undefined,facts:[]}})
 assert.equal(view.buttons.some(button=>button.class==='device-runtime-cache-link'),false);assert.doesNotMatch(view.html,/>· 待落盘 |刷盘排队/)
 view=await render({communication,cache});assert.doesNotMatch(view.html,/device-runtime-cache/)
})
