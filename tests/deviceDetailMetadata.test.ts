import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeviceMetadataResolver } from '../agentCapabilities/deviceAnalysis/deviceAnalysis.shared.ts'
import { createDeviceDetailAgentService } from '../views/device/list/agent/deviceDetailAgent.service.ts'
import { mapApiDevice } from '../views/device/list/services/adapters/iotDeviceApiAdapter.ts'
import { iotDeviceDetailRealApi } from '../views/device/list/services/iotDeviceDetailReal.service.ts'

const metadata = (id: string) => ({
  properties: [{ id, name: id, valueType: { type: 'double' } }],
  events: [], functions: [], tags: [],
})

test('detail tools reuse page metadata and observe replacement after a model refresh', async () => {
  let device = mapApiDevice({ id: 'device-1', metadata: JSON.stringify(metadata('temperature')) }, 'project-1')
  const service = createDeviceDetailAgentService(device, { getDevice: () => device })
  const originalDetail = iotDeviceDetailRealApi.getDeviceDetail
  const originalAggregate = iotDeviceDetailRealApi.queryPropertyAggregation
  let detailCalls = 0
  let aggregateCalls = 0
  iotDeviceDetailRealApi.getDeviceDetail = async () => {
    detailCalls += 1
    throw new Error('Page metadata must be reused')
  }
  iotDeviceDetailRealApi.queryPropertyAggregation = (async () => {
    aggregateCalls += 1
    return { result: [] }
  }) as typeof originalAggregate
  try {
    const args = { propertyIds: ['temperature'], aggregates: ['AVG', 'MAX'], analysisMode: 'statistics', timeRange: '24h' }
    const [search, model, ...aggregates] = await Promise.all([
      service.modelSearch({}), service.modelGet({}),
      service.propertyAggregate(args), service.propertyAggregate(args), service.propertyAggregate(args),
    ])
    assert.equal(search.success, true)
    assert.equal(model.success, true)
    assert.equal(aggregates.every(result => result.success), true)
    assert.equal(aggregateCalls, 3)
    assert.equal(detailCalls, 0)

    device = mapApiDevice({ id: 'device-1', metadata: JSON.stringify(metadata('humidity')) }, 'project-1')
    const refreshed = await service.modelSearch({})
    assert.deepEqual(refreshed.data.map(item => item.id), ['humidity'])
    assert.equal((await service.propertyAggregate({ ...args, propertyIds: ['humidity'] })).success, true)
    await assert.rejects(() => service.propertyAggregate(args), /propertyNotFound/)
    assert.equal(detailCalls, 0)
  } finally {
    service.dispose()
    iotDeviceDetailRealApi.getDeviceDetail = originalDetail
    iotDeviceDetailRealApi.queryPropertyAggregation = originalAggregate
  }
})

test('missing page metadata shares an in-flight load, retries failures and keeps devices separate', async () => {
  const original = iotDeviceDetailRealApi.getDeviceDetail
  const calls: string[] = []
  let fail = true
  iotDeviceDetailRealApi.getDeviceDetail = (async (id: string) => {
    calls.push(id)
    if (fail) throw new Error('Unavailable')
    return { result: { id, metadata: metadata(id) } }
  }) as typeof original
  try {
    const resolve = createDeviceMetadataResolver(() => undefined)
    await assert.rejects(() => resolve('one'), /Unavailable/)
    fail = false
    const [first, second] = await Promise.all([resolve('one'), resolve('one')])
    assert.deepEqual(first, second)
    await resolve('one')
    assert.deepEqual(calls, ['one', 'one'])
    assert.equal((await resolve('two')).metadata.properties[0].id, 'two')
    assert.deepEqual(calls, ['one', 'one', 'two'])
    const independent = createDeviceMetadataResolver(() => undefined)
    await independent('two')
    assert.deepEqual(calls, ['one', 'one', 'two', 'two'])
  } finally {
    iotDeviceDetailRealApi.getDeviceDetail = original
  }
})
