import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
const filename=resolve(import.meta.dirname,'../views/link/RuntimeMonitor/device-runtime/deviceQps.ts'),module={exports:{}},code=transformSync(readFileSync(filename,'utf8'),{loader:'ts',format:'cjs'}).code
const gaugeModule={exports:{}};new Function('require','module','exports',transformSync(readFileSync(resolve(import.meta.dirname,'../views/link/diagnostics/overview/gaugeHistory.ts'),'utf8'),{loader:'ts',format:'cjs'}).code)(()=>{},gaugeModule,gaugeModule.exports)
new Function('require','module','exports',code)(id=>id.endsWith('gaugeHistory')?gaugeModule.exports:undefined,module,module.exports)
const {readDeviceQps,deviceQpsView,deviceQpsSummary}=module.exports
const values={receivedQps:4.1,sentQps:1.1,communicationQps:5.2}
const qps=(timestamp=6500,extra={})=>({ready:true,timestamp,windowMillis:1000,sequence:String(Math.floor(timestamp/100)),values:{...values},...extra})
const sample=(timestamp=7000,source=qps(),startTime='1000')=>({timestamp,startTime,counters:{receivedPackets:'999999',sentPackets:'888888'},qps:source})
const bean=(patch={},missing=[])=>({attributes:[{name:'QpsSnapshot',available:true,value:Object.fromEntries(Object.entries({ReceivedQps:4.1,SentQps:1.1,CommunicationQps:5.2,QpsSampleTime:6500,QpsWindowMillis:1000,QpsReady:true,QpsWindowSequence:'65',...patch}).filter(([key])=>!missing.includes(key)))}]})

test('summary shares chart semantics for gaps, repeated windows, rollback, resets, unsupported and invalid sources',()=>{
 const cases=[[],[sample()],[sample(),{timestamp:7000}],[sample(),sample(10000)],[sample(),sample(7100)],
  [sample(),sample(8000,qps(6000))],[sample(),sample(10000,qps(9500),'9000')],
  [sample(),{timestamp:7000},sample(10000,qps(9500))],[sample(),{...sample(8000),qps:undefined}],
  [sample(),sample(8000,{ready:false,invalid:true})],
  [sample(),sample(700,{...qps(600),sequence:'80'})]]
 for(const samples of cases){const {history,...expected}=deviceQpsView(samples);assert.deepEqual(deviceQpsSummary(samples),expected)}
})

test('QPS is available from the first ready backend window without two frontend reads and preserves backend total exactly',()=>{
 const source=readDeviceQps(bean(),1000);assert.deepEqual(source.values,values);assert.equal(readDeviceQps(bean({QpsSampleTime:900})).ready,true)
 const view=deviceQpsView([sample(7000,source)]);assert.equal(view.values.communicationQps,5.2);assert.notEqual(view.values.communicationQps,view.values.receivedQps+view.values.sentQps)
 assert.equal(view.history[0].timestamp,6500);assert.equal(view.history[0].windowMillis,1000);assert.equal(view.history.length,1)
})
test('unready first window is waiting, idle source zero is real zero, and old eight/ten attributes have no QPS fallback',()=>{
 const waiting=readDeviceQps(bean({QpsReady:false,QpsSampleTime:0,QpsWindowMillis:0,ReceivedQps:0,SentQps:0,CommunicationQps:0}),1000)
 let view=deviceQpsView([sample(7000,waiting)]);assert.equal(view.ready,false);assert.equal(view.values,undefined);assert.deepEqual(view.history,[])
 const zero=readDeviceQps(bean({ReceivedQps:0,SentQps:0,CommunicationQps:0}),1000);view=deviceQpsView([sample(7000,zero)]);assert.equal(view.values.communicationQps,0)
 view=deviceQpsView([{...sample(4000),qps:undefined},{...sample(7000),qps:undefined}]);assert.equal(view.supported,false);assert.deepEqual(view.history,[])
 assert.equal(readDeviceQps({attributes:[{name:'ReceivedPacketsTotal',available:true,value:50},{name:'SentPacketsTotal',available:true,value:20}]},1000),undefined)
})
test('repeated source sample time does not add fake points; expired source reads are retained and interrupt the curve',()=>{
 let view=deviceQpsView([sample(7000),sample(7100)]);assert.equal(view.history.length,1);assert.equal(view.stale,false)
 view=deviceQpsView([sample(7000),sample(10000)]);assert.equal(view.stale,true);assert.equal(view.values.communicationQps,5.2);assert.equal(view.history.length,2);assert.equal(view.history.at(-1).values,undefined)
 view=deviceQpsView([sample(7000),sample(10000),sample(11000,qps(10500))]);assert.equal(view.stale,false);assert.equal(view.history.length,3);assert.equal(view.history[1].values,undefined)
})
test('missing getters, unavailable values, non-finite rates and old source sequences remain unknown',()=>{
 for(const broken of [bean({},['SentQps']),bean({ReceivedQps:NaN}),bean({SentQps:-1}),bean({CommunicationQps:Infinity}),bean({QpsWindowMillis:0}),bean({QpsWindowMillis:900}),bean({QpsWindowSequence:undefined})]){
  const source=readDeviceQps(broken,1000),view=deviceQpsView([sample(7000,source)]);assert.equal(view.ready,false);assert.equal(view.values,undefined);assert.equal(view.invalid,true)
 }
 const unavailable=bean();unavailable.attributes[0].available=false;assert.equal(readDeviceQps(unavailable,1000).invalid,true)
 const view=deviceQpsView([sample(7000),sample(8000,qps(6000))]);assert.equal(view.ready,false);assert.equal(view.values,undefined);assert.equal(view.history.at(-1).values,undefined)
})
test('generation change and pause break QPS geometry while latest valid source readings retain their true window time',()=>{
 let view=deviceQpsView([sample(7000),{timestamp:7000},sample(10000,qps(9500))]);assert.equal(view.history[1].values,undefined);assert.equal(view.values.communicationQps,5.2)
 view=deviceQpsView([sample(7000),sample(10000,qps(9500),'9000')]);assert.equal(view.history.length,3);assert.equal(view.history[1].values,undefined);assert.equal(view.history[2].timestamp,9500)
 view=deviceQpsView([sample(7000),{timestamp:7000}]);assert.equal(view.stale,true);assert.equal(view.timestamp,6500)
})

test('scalar QPS attributes are never assembled as a frontend snapshot, and malformed composite payloads stay unknown',()=>{
 const scalar={attributes:Object.entries({ReceivedQps:20,SentQps:10,CommunicationQps:30,QpsSampleTime:6500,QpsWindowMillis:1000,QpsReady:true}).map(([name,value])=>({name,value,available:true}))}
 assert.equal(readDeviceQps(scalar,1000),undefined)
 for(const value of [null,[],{},'bad',{QpsReady:false,QpsWindowMillis:0}])assert.equal(readDeviceQps({attributes:[{name:'QpsSnapshot',available:true,value}]},1000).invalid,true)
})

test('monotonic source sequence accepts wall rollback and same epoch, deduplicates phase jitter, but rejects old windows',()=>{
 const start='1700000000000',before=1700000005000,after=before-259200000
 let view=deviceQpsView([sample(before,qps(before,{sequence:'100'}),start),sample(after,qps(after,{sequence:'101',values:{receivedQps:7,sentQps:2,communicationQps:9}}),start)])
 assert.equal(view.ready,true);assert.equal(view.values.communicationQps,9);assert.equal(view.history.length,1);assert.equal(view.history[0].timestamp,after)
 view=deviceQpsView([sample(before,qps(before,{sequence:'100'}),start),sample(before+1,qps(before+1,{sequence:'100',values:{...values,communicationQps:17}}),start)])
 assert.equal(view.history.length,1);assert.equal(view.history[0].timestamp,before+1);assert.equal(view.values.communicationQps,17)
 view=deviceQpsView([sample(before,qps(before,{sequence:'100'}),start),sample(before,qps(before,{sequence:'101',values:{...values,communicationQps:18}}),start)])
 assert.equal(view.ready,true);assert.equal(view.values.communicationQps,18);assert.equal(view.history.length,1)
 view=deviceQpsView([sample(before,qps(before,{sequence:'100'}),start),sample(before+100,qps(before+100,{sequence:'99'}),start)])
 assert.equal(view.ready,false);assert.equal(view.invalid,true)
})
