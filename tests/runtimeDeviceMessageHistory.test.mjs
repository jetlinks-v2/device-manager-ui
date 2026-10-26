import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
const require=createRequire(import.meta.url), modules=new Map()
function load(path){if(modules.has(path))return modules.get(path);const module={exports:{}};const {code}=transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'});new Function('require','module','exports',code)(id=>id.startsWith('.')?load(resolve(dirname(path),`${id}.ts`)):require(id),module,module.exports);modules.set(path,module.exports);return module.exports}
const pure=load(resolve(import.meta.dirname,'../views/link/RuntimeMonitor/device-runtime/deviceMessageHistory.ts'))
const point=(timestamp,total,startTime='1000')=>({timestamp,startTime,counters:{upstreamMessages:total,receivedBytes:total}})
test('first cumulative sample is unknown, real zero remains zero, and large long counters subtract exactly',()=>{
 const base=9223372036854775700n
 assert.equal(pure.deviceMessageRates([point(4000,String(base))])[0].upstreamMessages,undefined)
 const rates=pure.deviceMessageRates([point(4000,String(base)),point(7000,String(base+3n)),point(10000,String(base+3n))])
 assert.equal(rates[1].upstreamMessages,1);assert.equal(rates[2].upstreamMessages,0)
 assert.equal(pure.deviceMessageRates([point(4000,'0'),point(7000,'9007199254740992')])[1].upstreamMessages,undefined)
})
test('counter rollback, generation change, long gaps and interruption never calculate an apparent rate',()=>{
 for(const history of [[point(4000,'6'),point(7000,'3')],[point(4000,'6'),point(7000,'9','2000')],[point(4000,'6'),point(200000,'9')],[point(4000,'6'),{timestamp:4000},point(7000,'9')]])assert.equal(pure.deviceMessageRates(history).at(-1).upstreamMessages,undefined)
 const interrupted=pure.interruptDeviceMessageHistory([point(4000,'6')]);assert.equal(interrupted.at(-1).timestamp,4000)
 assert.equal(pure.latestDeviceMessageRates([point(4000,'0'),point(7000,'3'),{timestamp:7000}]).upstreamMessages,1)
 assert.equal(pure.latestDeviceMessageRates([point(4000,'0'),point(7000,'3'),{timestamp:7000},point(10000,'6')]).upstreamMessages,undefined)
})
test('exact capability requires frozen domain/type/name and available metadata; unsafe numbers and invalid timestamps stay missing',()=>{
 const bean={domain:'org.jetlinks',type:'DeviceMessageMonitor',name:'DeviceMessageMonitor',attributes:[{name:'StartTime',available:true,value:1000},{name:'SnapshotTime',available:true,value:4000},{name:'UpstreamMessagesTotal',available:true,value:'9223372036854775807'},{name:'ReceivedBytesTotal',available:false,value:'9'},{name:'SentBytesTotal',available:true,value:Number.MAX_SAFE_INTEGER+1}]}
 const value=pure.deviceMessageSample(bean);assert.equal(value.counters.upstreamMessages,'9223372036854775807');assert.equal(value.counters.receivedBytes,undefined);assert.equal(value.counters.sentBytes,undefined)
 assert.equal(pure.deviceMessageSample({...bean,name:'other'}),undefined);assert.equal(pure.deviceMessageSample({...bean,domain:'other'}),undefined)
 assert.equal(pure.deviceMessageSample({...bean,attributes:bean.attributes.filter(a=>a.name!=='SnapshotTime')}),undefined)
})
test('device message history is bounded by ten minutes and 256 real samples',()=>{
 let history=[];for(let i=0;i<1000;i++)history=pure.appendDeviceMessageSample(history,point(i*1000,String(i)))
 assert.equal(history.length,256);assert.ok(history.every(p=>p.timestamp>=399000))
 history=pure.appendDeviceMessageSample(history,point(2000000,'1000'));assert.equal(history.length,1)
})

test('late source sequences preserve completed newer history while wall rollback rebuilds the counter baseline',()=>{
 const history=[{...point(4000,'0'),qps:{sequence:'10'}},{...point(7000,'3'),qps:{sequence:'40'}}]
 const late=pure.appendDeviceMessageSample(history,{...point(10000,'99'),qps:{sequence:'39'}})
 assert.deepEqual(late.slice(0,2),history);assert.equal(late.at(-1).startTime,undefined)
 const reset=pure.appendDeviceMessageSample(history,{...point(2000,'6'),qps:{sequence:'41'}})
 assert.equal(reset.length,1);assert.equal(pure.deviceMessageRates(reset).at(-1).upstreamMessages,undefined)
 const next=pure.appendDeviceMessageSample(reset,{...point(5000,'9'),qps:{sequence:'71'}});assert.equal(pure.deviceMessageRates(next).at(-1).upstreamMessages,1)
})

test('raw packet cumulative counters never derive QPS for old ten-attribute sources',()=>{
 const a={timestamp:4000,startTime:'1000',counters:{receivedPackets:'9223372036854775700',sentPackets:'9007199254740993',upstreamMessages:'30'}}
 const b={timestamp:7000,startTime:'1000',counters:{receivedPackets:'9223372036854775712',sentPackets:'9007199254740996',upstreamMessages:'36'}}
 const value=pure.deviceMessageRates([a,b]).at(-1)
 assert.equal(value.upstreamMessages,2);assert.equal(value.receivedQps,undefined);assert.equal(value.sentQps,undefined);assert.equal(value.communicationQps,undefined)
})
