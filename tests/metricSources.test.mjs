import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { build, transform } from 'esbuild'
import { fileURLToPath } from 'node:url'

const source = await readFile(new URL('../views/device/metrics/metricSources.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { metricSourceTerms } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../api/metricSources.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'source-api-boundary', setup(builder) {
    builder.onResolve({ filter:/^@jetlinks-web\/core$/ }, () => ({ path:'platform',namespace:'source-mock' }))
    builder.onResolve({ filter: /^\.\/(instance|product)$/ }, args => ({ path: args.path, namespace: 'source-mock' }))
    builder.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: 'locale', namespace: 'source-mock' }))
    builder.onResolve({ filter: /^@jetlinks-web-core\/components$/ }, () => ({ path: 'metric', namespace: 'source-mock' }))
    builder.onLoad({ filter: /.*/, namespace: 'source-mock' }, args => ({ contents: args.path === 'platform' ? 'export const request={get:async()=>globalThis.__metricPlatformRequest ? globalThis.__metricPlatformRequest() : ({result:[{id:"$online",name:"平台连接状态",valueType:"int",history:true,icon:"PoweroffOutlined"},{id:"$lastCommunicationTime",name:"最近会话通信时间",valueType:"long",history:false,icon:"MessageOutlined"}]})}' : args.path === 'locale'
      ? 'export default {global:{t:(key)=>key,locale:{value:"zh"}}}'
      : args.path === 'metric' ? 'export const metricApi={byOwner:(...args)=>globalThis.__metricSourceApi.byOwner(...args),getConfig:(...args)=>globalThis.__metricSourceApi.getConfig(...args),configTemplate:(...args)=>globalThis.__metricSourceApi.configTemplate(...args)}'
      : args.path === './product' ? 'export const detail=(...args)=>globalThis.__metricSourceApi.productDetail(...args); export const queryProductList=(...args)=>globalThis.__metricSourceApi.queryProducts(...args)'
      : 'export const query=(...args)=>globalThis.__metricSourceApi.query(...args);export const detail=(...args)=>globalThis.__metricSourceApi.detail(...args)' }))
  } }],
})
const { queryMetricDevices, loadMetricDevice, loadMetricProduct, loadMetricOutputs, loadMetricOutput } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

test('platform directory failures remain visible, share an in-flight request and can retry immediately', async () => {
  const isolated = await import(`data:text/javascript;base64,${Buffer.from(`${bundled.outputFiles[0].text}\n// directory-retry`).toString('base64')}`)
  let finish
  let calls = 0
  globalThis.__metricPlatformRequest = () => { calls++; return new Promise(resolve => { finish = resolve }) }
  try {
    const first = isolated.loadMetricPlatformProperties()
    const second = isolated.loadMetricPlatformProperties()
    assert.equal(first, second)
    const rejected = Promise.all([assert.rejects(first, /directory unavailable/), assert.rejects(second, /directory unavailable/)])
    finish({ status:500, message:'directory unavailable' })
    await rejected
    const retried = isolated.loadMetricPlatformProperties()
    assert.equal(calls, 2)
    finish({ status:200, result:[{ id:'$lastCommunicationTime', name:'Last communication', valueType:'long', history:false, icon:'MessageOutlined' }] })
    const items = await retried
    assert.equal(items.length, 1)
    assert.equal(items[0].id, '$lastCommunicationTime')
    assert.equal(items[0].platform, true)
    assert.equal(items[0].history, false)
    assert.deepEqual(items[0].valueType, { type:'long' })
    assert.equal(await isolated.loadMetricPlatformProperties(), items)
    assert.equal(calls, 2)
  } finally { delete globalThis.__metricPlatformRequest }
})

test('four hosts set the initial candidate scope without restricting offline devices', () => {
  const cases = [
    ['device', 'id', 'eq'], ['product', 'productId', 'eq'],
    ['deviceGroup', 'id', 'dev-group'], ['space', 'id', 'space-bind$device'],
  ]
  for (const [ownerType, column, termType] of cases) {
    assert.deepEqual(metricSourceTerms({ ownerType, ownerId: 'owner-1' }), [{ column, termType, value: 'owner-1' }])
  }
})

test('source failures remain errors and offline properties restore from product metadata', async () => {
  globalThis.__metricSourceApi = {
    query: async () => ({ status: 500, message: 'query unavailable' }),
    detail: async () => ({ status: 403, message: 'device denied' }),
  }
  await assert.rejects(queryMetricDevices({ ownerType: 'device', ownerId: 'offline' }, '', 0, true), /query unavailable/)
  await assert.rejects(loadMetricDevice('offline'), /device denied/)
  globalThis.__metricSourceApi.detail = async () => ({ status: 200, result: { id: 'offline', name: '离线电表', productId: 'meter', metadata: '{}' } })
  globalThis.__metricSourceApi.productDetail = async () => ({ status: 500, message: 'product unavailable' })
  await assert.rejects(loadMetricDevice('offline'), /product unavailable/)
  globalThis.__metricSourceApi.productDetail = async () => ({ status: 200, result: { metadata: JSON.stringify({ properties: [{ id: 'energy', name: '累计电量', valueType: { type: 'double', unit: 'kWh' } }] }) } })
  const device = await loadMetricDevice('offline')
  assert.equal(device.device.id, 'offline')
  assert.equal(device.properties.find(property => !property.platform).id, 'energy')
  assert.ok(device.properties.some(property => property.id === '$lastCommunicationTime' && property.platform && property.history === false))
})

test('product inheritance selects properties from the product model without loading device members', async () => {
  const calls = []
  globalThis.__metricSourceApi = {
    query: async () => { throw new Error('must not enumerate devices') },
    detail: async () => { throw new Error('must not bind a device') },
    productDetail: async id => {
      calls.push(id)
      return { status:200, result:{ metadata:JSON.stringify({ properties:[{ id:'state', name:'工作状态', valueType:{ type:'int' } }] }) } }
    },
  }
  assert.deepEqual((await loadMetricProduct('pumps')).filter(property => !property.platform).map(property => [property.id,property.name]), [['state','工作状态']])
  assert.deepEqual(calls, ['pumps'])
  globalThis.__metricSourceApi.productDetail = async () => ({ status:403, message:'product denied' })
  await assert.rejects(loadMetricProduct('pumps'), /product denied/)
})

test('metric sources expose only active single-target public outputs and propagate access failures', async () => {
  const calls = []
  const active = { id: 'active', state: 'enabled', scope: 'single' }
  const template = { outputs: [{ metricId: 'usage', persist: true }, { metricId: 'threshold', persist: false }] }
  globalThis.__metricSourceApi = {
    byOwner: async (...args) => { calls.push(args); return [active, { id: 'disabled', state: 'disabled' }, { id: 'inherited', state: 'enabled', scope: 'children' }] },
    getConfig: async id => { assert.equal(id, 'active'); return active },
    configTemplate: async id => { assert.equal(id, 'active'); return template },
  }
  assert.deepEqual((await loadMetricOutputs('device', 'meter')).map(item => [item.config.id, item.output.metricId]), [['active', 'usage'], ['active', 'threshold']])
  assert.deepEqual(calls, [['device', 'meter']])
  assert.deepEqual(await loadMetricOutput('active'), { config: active, template })
  globalThis.__metricSourceApi.configTemplate = async () => { throw new Error('source denied') }
  await assert.rejects(loadMetricOutputs('device', 'meter'), /source denied/)
  await assert.rejects(loadMetricOutput('active'), /source denied/)
})
