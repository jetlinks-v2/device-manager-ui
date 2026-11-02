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
    builder.onResolve({ filter: /^\.\/(instance|product)$/ }, args => ({ path: args.path, namespace: 'source-mock' }))
    builder.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: 'locale', namespace: 'source-mock' }))
    builder.onLoad({ filter: /.*/, namespace: 'source-mock' }, args => ({ contents: args.path === 'locale'
      ? 'export default {global:{t:(key)=>key}}'
      : args.path === './product' ? 'export const detail=(...args)=>globalThis.__metricSourceApi.productDetail(...args)'
      : 'export const query=(...args)=>globalThis.__metricSourceApi.query(...args);export const detail=(...args)=>globalThis.__metricSourceApi.detail(...args)' }))
  } }],
})
const { queryMetricDevices, loadMetricDevice } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

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
  assert.equal(device.properties[0].id, 'energy')
})
