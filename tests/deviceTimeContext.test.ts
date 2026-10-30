import assert from 'node:assert/strict'
import test from 'node:test'
import { mapApiDevice } from '../views/device/list/services/adapters/iotDeviceApiAdapter'
import { createDeviceDetailDiagnosticsService } from '../views/device/list/agent/deviceDetailDiagnostics.service'
import { mapDevice } from '../agentCapabilities/deviceAnalysis/deviceAnalysis.shared'
import { iotDeviceDetailRealApi } from '../views/device/list/services/iotDeviceDetailReal.service'

test('device context exposes state events without claiming they are communication or reports', async () => {
  const original = iotDeviceDetailRealApi.getDeviceState
  iotDeviceDetailRealApi.getDeviceState = (async () => ({ result: { value: 'online', text: '在线' } })) as typeof original
  try {
    for (const [onlineTime, offlineTime] of [[10000, 20000], [30000, 20000]]) {
      const device = mapApiDevice({ id: 'device-1', onlineTime, offlineTime }, 'project-1')
      const result = await createDeviceDetailDiagnosticsService(device).contextGet()
      assert.equal(device.lastSeenTimestamp, Math.max(onlineTime, offlineTime))
      assert.equal(device.onlineAt, onlineTime)
      assert.equal(device.offlineAt, offlineTime)
      assert.equal(result.data.lastReportAt, undefined)
      assert.equal('lastSeen' in result.data, false)
      assert.equal('lastSeenTimestamp' in result.data, false)
      assert.equal((result.data.timeSemantics as Record<string, unknown>).lastReportAt, 'DeviceConnectionAgent.time.lastReportAt')
      assert.deepEqual(mapDevice(device).timeSemantics, result.data.timeSemantics)
    }
  } finally {
    iotDeviceDetailRealApi.getDeviceState = original
  }
})

test('device mapping reuses known report time without deriving it from connection events', () => {
  const instance = { id: 'device-1', onlineTime: 10000, offlineTime: 20000, lastReportTime: 30000 }
  const device = mapApiDevice(instance, 'project-1')
  assert.equal(device.lastReportAt, 30000)
  assert.equal(device.lastSeenTimestamp, 20000)
  assert.equal(mapApiDevice({ id: 'device-1' }, 'project-1', device).lastReportAt, 30000)
  assert.equal(mapApiDevice({ id: 'device-2' }, 'project-1', device).lastReportAt, undefined)
  assert.equal(mapApiDevice({ id: 'device-2', onlineTime: 'not a date' }, 'project-1').lastSeenTimestamp, undefined)
  assert.equal(mapApiDevice({ id: 'device-2' }, 'project-1').lastReportAt, undefined)
  assert.equal(mapApiDevice({ id: 'device-2' }, 'project-1').lastSeen, '--')
})

test('device detail features exclusively determine data-parsing capability', () => {
  const fallback = mapApiDevice({
    id: 'device-1',
    features: [{ id: 'transparentCodec', name: '透明编解码' }],
  }, 'project-1')

  assert.deepEqual(mapApiDevice({ id: 'device-1' }, 'project-1', fallback).features, [])
  assert.deepEqual(
    mapApiDevice({ id: 'device-1', features: [{ id: 'transparentCodec', name: '透明编解码' }] }, 'project-1', fallback).features,
    [{ id: 'transparentCodec', name: '透明编解码' }],
  )
})
