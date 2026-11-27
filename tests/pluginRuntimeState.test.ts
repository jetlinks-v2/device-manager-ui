import assert from 'node:assert/strict'
import test from 'node:test'
import { pluginAvailability, pluginMetricRows, pluginRuntimeState, pluginRuntimeError, pluginDriverMetadata, isPreviousPluginRevision, pluginInstancePreview } from '../views/link/plugin/runtimeState.ts'
import type { PluginRuntimeInfo } from '../api/link/pluginRuntime.ts'
import { pluginListRequest } from '../api/link/pluginListQuery.ts'

test('plugin list uses bounded stable cursor ordering and groups search terms independently', () => {
  const filters = [{ column: 'name', termType: 'like', value: '%test%' }]
  const query = pluginListRequest({ terms: filters }, { createTime: 123, id: 'driver-2' })
  assert.equal(query.paging, true)
  assert.equal(query.pageSize, 32)
  assert.deepEqual(query.sorts.map(sort => sort.name), ['createTime', 'id'])
  assert.deepEqual(query.terms[0], { terms: filters })
  assert.deepEqual(query.terms[1], { terms: [
    { column: 'createTime', termType: 'lt', value: 123 },
    { type: 'or', terms: [
      { column: 'createTime', termType: 'eq', value: 123 },
      { column: 'id', termType: 'lt', value: 'driver-2' },
    ] },
  ] })
  assert.equal(pluginListRequest({}).terms.length, 0)
})

const node = (status: string, available = false, revision = 'current'): PluginRuntimeInfo => ({
  driverId: 'driver', serverId: 'node', serviceId: 'service', status, available,
  appliedRevision: revision, sampledAt: 100, instanceCount: -1,
})

test('one current host is enough; an unrelated unsupported service is not a failure', () => {
  assert.equal(pluginAvailability([node('ready', true), node('unsupported')], 'current').state, 'available')
  assert.equal(pluginAvailability([node('ready', true), node('failed')], 'current').state, 'partial')
})
test('a stale revision cannot make the new configuration effective', () => {
  assert.equal(pluginAvailability([node('ready', true, 'old')], 'current').state, 'previous')
})
test('partial failure plus an unknown node is not proof that all hosts failed', () => {
  assert.equal(pluginAvailability([node('failed'), node('unknown')]).state, 'unknown')
  assert.equal(pluginAvailability([node('failed'), node('unsupported')]).state, 'unavailable')
})
test('expired samples do not remain available', () => {
  assert.equal(pluginAvailability([{ ...node('ready', true), receivedAt: 1 }], undefined, 20000).state, 'unknown')
})
test('unknown or expired observations do not display the last native running state as current', () => {
  assert.equal(pluginRuntimeState({ ...node('unknown'), state: 'running' }), 'unknown')
  assert.equal(pluginRuntimeState({ ...node('ready', true), state: 'running', receivedAt: 1 }, 20000), 'unknown')
  assert.equal(pluginRuntimeState({ ...node('failed', true), state: 'running' }), 'running')
})
test('HTTP observation errors render a useful status instead of an object string', () => {
  assert.equal(pluginRuntimeError(new Response('', { status: 404 })), 'HTTP 404')
  assert.equal(pluginRuntimeError(new Error('Disconnected')), 'Disconnected')
  assert.equal(pluginRuntimeError({ private: 'value' }), undefined)
})
test('custom metric metadata and scopes are preserved, with zero distinct from unreadable', () => {
  const rows = pluginMetricRows({ instanceId: 'instance', sampledAt: 1,
    metadata: { properties: [{ id: 'count', name: 'Count' }] },
    values: { count: { available: true, value: 0 }, unavailable: { available: false, value: null } },
    observations: { transport: { instanceId: 'connection', sampledAt: 1, values: { bytes: { available: true, value: 42 } } } },
  })
  assert.deepEqual(rows.map(row => [row.key, row.value]), [['count', '0'], ['unavailable', '—'], ['transport.bytes', '42']])
  assert.equal(rows[0].name, 'Count')
})

test('package metadata comes from a fresh loaded host of the current revision', () => {
  const old = { ...node('ready', true, 'old'), driverName: 'Old package', driverDescription: 'Old description' }
  const current = { ...node('ready', true), driverName: 'Declared package', driverDescription: 'Declared description' }
  assert.equal(pluginDriverMetadata([old, current], 'current'), current)
  assert.equal(pluginDriverMetadata([{ ...current, receivedAt: 1 }], 'current', 20000), undefined)
  assert.equal(pluginDriverMetadata([{ ...current, status: 'unknown' }], 'current'), undefined)
  assert.equal(pluginDriverMetadata([{ ...current, available: false }], 'current'), undefined)
})

test('package name and description stay on one host and missing package fields remain missing', () => {
  const named = { ...node('ready', true), serverId: 'one', driverName: 'Package name' }
  const described = { ...node('ready', true), serverId: 'two', driverDescription: 'Another host description' }
  const metadata = pluginDriverMetadata([named, described], 'current')
  assert.equal(metadata.driverName, 'Package name')
  assert.equal(metadata.driverDescription, undefined)
  assert.equal(pluginDriverMetadata([node('ready', true)], 'current'), undefined)
  assert.equal(pluginDriverMetadata([{ ...node('ready', true), driverName: ' ', driverDescription: '  ' }], 'current'), undefined)
})

test('same-name instances from another revision remain visible with an explicit old-revision identity', () => {
  assert.equal(isPreviousPluginRevision({ desiredRevision: 'new', appliedRevision: 'old' }), true)
  assert.equal(isPreviousPluginRevision({ desiredRevision: 'new', appliedRevision: 'new' }), false)
  assert.equal(isPreviousPluginRevision({ desiredRevision: 'new' }), false)
})

test('normal stopped records leave the preview while failures, unknowns and genuinely running old revisions remain', () => {
  const running = { ...node('ready', true), state: 'running' }
  const stopped = { ...node('ready'), state: 'stopped' }
  const failed = { ...stopped, error: 'StartFailure' }
  const unknown = { ...node('unknown'), state: 'unknown' }
  const previous = { ...running, desiredRevision: 'new', appliedRevision: 'old' }
  assert.deepEqual(pluginInstancePreview([running, stopped, failed, unknown, previous]), [running, failed, unknown, previous])
})
