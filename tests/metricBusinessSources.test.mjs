import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createMetricLoader } from './metricCoreRuntime.mjs'

let types=[],dimensions=[],calls=[]
const load=createMetricLoader({
  '@jetlinks-web/core':{request:{
    get:async url=>{calls.push({url});return {result:url==='/relation/types' ? types : []}},
    post:async(url,body)=>{calls.push({url,body});return {result:{data:[{id:'old',name:'旧对象'}],total:1}}},
  }},
  '@jetlinks-web-core/components/Metric/extensions/registry':{collectMetricResources:()=>({dimensions})},
})
const {loadMetricObjectTypes,queryMetricBusinessObjects,loadObjectSourceCapabilities,loadObjectSourceMetadata}=load(fileURLToPath(new URL('../api/metricBusinessSources.ts',import.meta.url)))

test('根对象来自可用指标维度及显式来源声明，保留名称、图标、说明且不按业务类型黑名单过滤',async()=>{
  dimensions=[{provider:{ownerType:'device',label:()=> '设备',icon:'DesktopOutlined'}},{provider:{ownerType:'space',label:'空间',icon:'EnvironmentOutlined'}}]
  types=[{id:'device',name:'Device',description:'物联网设备'},
    {id:'space',name:'Space',metricSource:{root:false,icon:'HomeOutlined'}},
    {id:'alarm',name:'Alarm',i18nName:'告警中心',description:'已声明的业务根对象',metricSource:{root:true,icon:'BellOutlined'}},
    {id:'notificationAttempt',name:'通知尝试'},{id:'role',name:'角色',metricSource:{root:false}}]
  const roots=await loadMetricObjectTypes()
  assert.deepEqual(roots.map(item=>item.id),['device','space','alarm'])
  assert.equal(roots[0].name,'设备');assert.equal(roots[0].description,'物联网设备')
  assert.equal(roots[1].icon,'HomeOutlined');assert.equal(roots[2].name,'告警中心')
  assert.equal(roots[2].icon,'BellOutlined')
  types=[];assert.deepEqual((await loadMetricObjectTypes()).map(item=>item.id),['device','space'])
})

test('声明导入按原对象授权查询，来源目录不执行业务查询',async()=>{
  calls=[]
  assert.equal((await queryMetricBusinessObjects('notificationAttempt','历史')).total,1)
  assert.equal(calls[0].body.type,'notificationAttempt')
  assert.equal(calls[0].body.query.terms[0].value,'%历史%')
  calls=[];await loadObjectSourceCapabilities('machine','M/1');await loadObjectSourceMetadata('machine','M/1','summary')
  assert.deepEqual(calls,[{url:'/ontology/catalog/machine/M%2F1/capabilities'},{url:'/ontology/catalog/machine/M%2F1/capabilities/summary/metadata'}])
})
