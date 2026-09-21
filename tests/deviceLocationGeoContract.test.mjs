import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const serviceSource = readFileSync(
  new URL('../dataCapabilities/deviceMonitoring.service.ts', import.meta.url),
  'utf8',
)

function loadLocationService(response) {
  const calls = []
  const modules = {
    dayjs: () => ({ valueOf: () => 0 }),
    '@jetlinks-web-core/locales': { global: { t: key => key } },
    '@jetlinks-web/core': { request: {} },
    '@device-manager-ui/api/category': {},
    '@device-manager-ui/api/dashboard': {
      getDeviceGeoJson: async (body, config, client) => {
        calls.push({ body, config, client })
        if (response instanceof Error) throw response
        return response
      },
    },
    '@device-manager-ui/api/deviceInstanceMonitoring': {},
    '@device-manager-ui/api/product': {},
  }
  const compiled = ts.transpileModule(serviceSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const exports = {}
  runInNewContext(compiled, {
    exports,
    require: name => {
      assert.ok(name in modules, `unexpected dependency: ${name}`)
      return modules[name]
    },
  })
  return { loadDeviceLocationList: exports.loadDeviceLocationList, calls }
}

test('Geo query uses the supplied publication request and normalizes GeoObject fields', async () => {
  const { loadDeviceLocationList, calls } = loadLocationService({
    status: 200,
    result: {
      total: 2,
      pageIndex: 1,
      pageSize: 20,
      data: [
        {
          id: 'geo-record-001',
          objectId: 'device-001',
          point: { lon: 116.4, lat: 39.9 },
          tags: { deviceName: '测试设备', state: { value: 'online', text: '在线' } },
        },
        { objectId: 'device-without-point', tags: { deviceName: '无坐标' } },
      ],
    },
  })
  const publicationRequest = { post: () => {} }
  const result = await loadDeviceLocationList(
    { pageIndex: 1, pageSize: 20, state: 'online', scope: 'iot' },
    undefined,
    publicationRequest,
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].client, publicationRequest)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), {
    filter: {
      paging: true,
      pageIndex: 1,
      pageSize: 20,
      terms: [{ column: 'tags.state', termType: 'eq', value: 'online' }],
    },
  })
  assert.equal(result.total, 2)
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].deviceId, 'device-001')
  assert.equal(result.data[0].deviceName, '测试设备')
  assert.equal(result.data[0].longitude, 116.4)
  assert.equal(result.data[0].latitude, 39.9)
  assert.equal(result.data[0].stateText, '在线')
})

test('Geo authorization failure is propagated without switching request identity', async () => {
  const forbidden = new Error('geo-manager:find-geo')
  const { loadDeviceLocationList, calls } = loadLocationService(forbidden)
  const publicationRequest = { post: () => {} }

  await assert.rejects(
    loadDeviceLocationList({ pageIndex: 0, pageSize: 200 }, undefined, publicationRequest),
    forbidden,
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].client, publicationRequest)
})
