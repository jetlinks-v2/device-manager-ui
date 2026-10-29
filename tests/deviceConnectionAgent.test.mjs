import assert from 'node:assert/strict'
import test from 'node:test'
import { request } from '@jetlinks-web/core'
import { deviceConnectionService, queryDeviceConnectionSessions } from '../agentCapabilities/deviceAnalysis/deviceConnection.service'
import { iotDeviceDetailRealApi } from '../views/device/list/services/iotDeviceDetailReal.service'
import { mapApiDevice } from '../views/device/list/services/adapters/iotDeviceApiAdapter'
import { createDeviceDetailAgentService } from '../views/device/list/agent/deviceDetailAgent.service'
import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools'
import { createDeviceAnalysisTools } from '../agentCapabilities/deviceAnalysis/tools'
import { toAiClientToolSessionDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import zh from '../locales/lang/zh.json'
import en from '../locales/lang/en.json'

test('state and connection APIs use independent authorized device routes', async () => {
  const original = request.get
  const paths = []
  request.get = async path => { paths.push(path); return { result: [] } }
  try {
    await iotDeviceDetailRealApi.getDeviceState('device/id')
    await iotDeviceDetailRealApi.getDeviceSessions('device/id')
    assert.deepEqual(paths, ['/device-instance/device%2Fid/state', '/device/instance/device%2Fid/sessions'])
  } finally {
    request.get = original
  }
})

test('detail context reads current state and current host facts without fetching sessions or metadata', async () => {
  const originalState = iotDeviceDetailRealApi.getDeviceState
  const originalSessions = iotDeviceDetailRealApi.getDeviceSessions
  const originalDetail = iotDeviceDetailRealApi.getDeviceDetail
  const calls = []
  let state = 'offline'
  iotDeviceDetailRealApi.getDeviceState = async id => { calls.push(id); return { result: { value: state, text: state } } }
  iotDeviceDetailRealApi.getDeviceSessions = async () => { throw new Error('Session query is not part of state/context') }
  iotDeviceDetailRealApi.getDeviceDetail = async () => { throw new Error('Metadata query is not part of state/context') }
  let current = mapApiDevice({ id: 'one', name: 'Original', state: { value: 'online' }, onlineTime: 1000 }, 'project')
  const service = createDeviceDetailAgentService(current, { getDevice: () => current })
  try {
    const first = await service.contextGet()
    assert.equal(first.success, true)
    assert.equal(first.data.status.value, 'offline')
    assert.ok(first.data.status.checkedAt > 0)
    assert.equal('lastSeen' in first.data, false)
    current = { ...current, name: 'Refreshed', lastReportAt: 3000 }
    state = 'online'
    const refreshed = await service.contextGet()
    assert.equal(refreshed.data.name, 'Refreshed')
    assert.equal(refreshed.data.lastReportAt, 3000)
    assert.equal(refreshed.data.status.value, 'online')
    current = { ...current, id: 'another', name: 'Other device' }
    const isolated = await service.contextGet()
    assert.equal(isolated.data.id, 'one')
    assert.equal(isolated.data.name, 'Original')
    assert.deepEqual(calls, ['one', 'one', 'one'])
  } finally {
    service.dispose()
    iotDeviceDetailRealApi.getDeviceState = originalState
    iotDeviceDetailRealApi.getDeviceSessions = originalSessions
    iotDeviceDetailRealApi.getDeviceDetail = originalDetail
  }
})

test('session facts preserve multiple connections, exact communication times and a strict field whitelist', async () => {
  const original = iotDeviceDetailRealApi.getDeviceSessions
  const originalState = iotDeviceDetailRealApi.getDeviceState
  const calls = []
  iotDeviceDetailRealApi.getDeviceSessions = async id => {
    calls.push(id)
    return { result: [
      { serverId: 'private-node', id: 'internal-session', transport: 'TCP', connectTime: 1000, lastCommTime: 3000,
        connections: [{ address: 'remote:1000', metrics: { connectTime: '2000', lastCommTime: '5000', secret: 'hidden' } }] },
      { serverId: 'another-node', transport: 'MQTT', connectTime: 4000, lastCommTime: 6000,
        connections: [{ address: 'remote:2000', metrics: { lastCommTime: 0 } }, { metrics: { lastCommTime: 'invalid' } }] },
    ] }
  }
  iotDeviceDetailRealApi.getDeviceState = async () => { throw new Error('Sessions do not query state') }
  try {
    const result = await deviceConnectionService.connectionSessions({ deviceId: ' one ' })
    assert.equal(result.success, true)
    assert.equal(result.summary.sessionCount, 2)
    assert.equal(result.summary.connectionCount, 3)
    assert.equal(result.summary.lastCommunicationAt, 6000)
    assert.ok(result.summary.queriedAt > 0)
    assert.equal(result.data[0].connections[0].connectedAt, 2000)
    assert.equal(result.data[0].connections[0].lastCommunicationAt, 5000)
    assert.equal(result.data[1].connections[0].lastCommunicationAt, undefined)
    assert.equal('state' in result.summary, false)
    assert.doesNotMatch(JSON.stringify(result), /private-node|internal-session|another-node|hidden|serverId/)
    assert.deepEqual(calls, ['one'])
    const device = mapApiDevice({ id: 'bound' }, 'project')
    const service = createDeviceDetailAgentService(device)
    try {
      await service.connectionSessions({ deviceId: 'another' })
      assert.deepEqual(calls, ['one', 'bound'])
    } finally { service.dispose() }
  } finally {
    iotDeviceDetailRealApi.getDeviceSessions = original
    iotDeviceDetailRealApi.getDeviceState = originalState
  }
})

test('empty or missing connection information never establishes offline state or absent reports', async () => {
  const original = iotDeviceDetailRealApi.getDeviceSessions
  try {
    iotDeviceDetailRealApi.getDeviceSessions = async () => ({ result: [] })
    const empty = await queryDeviceConnectionSessions('one')
    assert.equal(empty.success, true)
    assert.equal(empty.status, 'empty')
    assert.equal(empty.evidence.supportsAbsenceClaim, false)
    assert.equal(empty.summary.lastCommunicationAt, undefined)
    iotDeviceDetailRealApi.getDeviceSessions = async () => ({ result: [{ connectTime: 1000, connections: null }] })
    const unknown = await queryDeviceConnectionSessions('one')
    assert.equal(unknown.summary.sessionCount, 1)
    assert.equal(unknown.summary.connectionCount, undefined)
    assert.equal(unknown.summary.lastCommunicationAt, undefined)
    assert.equal(unknown.data[0].lastCommunicationAt, undefined)
    assert.equal(unknown.evidence.supportsAbsenceClaim, false)
  } finally { iotDeviceDetailRealApi.getDeviceSessions = original }
})

test('session output is bounded while counts and latest communication cover the full returned source', async () => {
  const original = iotDeviceDetailRealApi.getDeviceSessions
  iotDeviceDetailRealApi.getDeviceSessions = async () => ({ result: Array.from({ length: 21 }, (_, index) => ({
    connections: Array.from({ length: 21 }, (_, connection) => ({ metrics: { lastCommTime: 1000 + index * 100 + connection } })),
  })) })
  try {
    const result = await queryDeviceConnectionSessions('one')
    assert.equal(result.data.length, 20)
    assert.equal(result.data[0].connections.length, 20)
    assert.equal(result.summary.sessionCount, 21)
    assert.equal(result.summary.connectionCount, 441)
    assert.equal(result.summary.lastCommunicationAt, 3020)
    assert.equal(result.truncated, true)
    assert.equal(result.data[0].truncated, true)
  } finally { iotDeviceDetailRealApi.getDeviceSessions = original }
})

test('permission, state and malformed session failures remain errors instead of stale state or empty sessions', async () => {
  const originalState = iotDeviceDetailRealApi.getDeviceState
  const originalSessions = iotDeviceDetailRealApi.getDeviceSessions
  const device = mapApiDevice({ id: 'one', state: { value: 'online' } }, 'project')
  const service = createDeviceDetailAgentService(device)
  try {
    iotDeviceDetailRealApi.getDeviceState = async () => { throw { status: 403, message: 'Forbidden' } }
    const denied = await service.contextGet()
    assert.equal(denied.success, false)
    assert.equal(denied.data.status, undefined)
    iotDeviceDetailRealApi.getDeviceSessions = async () => { throw { status: 403, message: 'Forbidden' } }
    const failed = await queryDeviceConnectionSessions('one')
    assert.equal(failed.success, false)
    assert.notEqual(failed.evidence?.supportsAbsenceClaim, true)
    assert.notEqual(failed.status, 'empty')
    iotDeviceDetailRealApi.getDeviceSessions = async () => ({ result: {} })
    assert.equal((await queryDeviceConnectionSessions('one')).success, false)
    iotDeviceDetailRealApi.getDeviceState = async () => ({ result: {} })
    assert.equal((await deviceConnectionService.stateGet({ deviceId: 'one' })).success, false)
    await assert.rejects(() => deviceConnectionService.stateGet({}), /deviceIdRequired/)
    await assert.rejects(() => deviceConnectionService.connectionSessions({}), /deviceIdRequired/)
  } finally {
    service.dispose()
    iotDeviceDetailRealApi.getDeviceState = originalState
    iotDeviceDetailRealApi.getDeviceSessions = originalSessions
  }
})

test('both agent entries expose separate state/session semantics and complete bilingual descriptions', () => {
  const global = createDeviceAnalysisTools().map(factory => factory.build())
  for (const id of ['device_state_get', 'device_connection_sessions_get']) {
    const serialized = toAiClientToolSessionDefinition(global.find(tool => tool.id === id))
    assert.equal(serialized.inputs.find(input => input.name === 'deviceId').required, true)
  }
  const service = createDeviceDetailAgentService(mapApiDevice({ id: 'one' }, 'project'))
  try {
    const local = createDeviceDetailAgentTools(service).find(tool => tool.id === 'device_connection_sessions_get')
    assert.deepEqual(local.inputs, [])
    assert.ok(local.routing.capabilities.includes('subject.connection.sessions.read'))
  } finally { service.dispose() }
  const keys = Object.keys(zh).filter(key => key.startsWith('DeviceConnectionAgent.') || key.includes('tools.device_connection_sessions_get.') || key.includes('tools.device_state_get.'))
  for (const key of keys) {
    assert.ok(zh[key], key)
    assert.ok(en[key], key)
  }
})
