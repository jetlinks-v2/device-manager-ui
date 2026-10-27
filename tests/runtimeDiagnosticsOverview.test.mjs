import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url)
const calls = []
const cache = new Map()
const network = (timestamp, received, sent, extras = {}) => ({ group: 'network', data: { clusterNodeId: 'node-a', value: {
  timestamp, networkInterfaceMetricsAvailable: true, networkReceivedBytes: received, networkSentBytes: sent,
  networkReceivedPackets: received, networkSentPackets: sent, networkReceiveDrops: 0, networkReceiveErrors: 0, networkSendErrors: 0,
  networkTcpMetricsAvailable: true, networkTcpConnectionsEstablished: 12, networkTcpSegmentsSent: sent, networkTcpSegmentsRetransmitted: 0, ...extras,
} } })
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  const imports = id => {
    if (id === './diagnosticStream') return {}
    if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
    if (id === '@jetlinks-web/core') return { request: { post: async (url, data) => {
      calls.push({ url, data })
      return { success: true, result: [
        { data: { clusterNodeId: 'node-a', value: { timestamp: 60000, cpuSystemUsage: 37, cpuJvmUsage: 12 } } },
        { data: { clusterNodeId: 'node-a', value: { timestamp: 60000, memorySystemTotal: 8192, memorySystemFree: 4096, memoryJvmHeapTotal: 2048, memoryJvmHeapFree: 512 } } },
        network(60000, 1024, 2048), network(120000, 615424, 124928),
        { group: 'bytesRead', data: { clusterNodeId: 'node-a', value: [{ timestamp: 120000, timeString: '01-01 00:02', value: 5120 }] } },
        { group: 'bytesSent', data: { clusterNodeId: 'node-a', value: [{ timestamp: 120000, timeString: '01-01 00:02', value: 3072 }] } },
      ] }
    }, get: async (url, params) => {
      calls.push({ url, params })
      if (decodeURIComponent(url).includes('PersistenceBuffer')) throw new Error('remote node unavailable')
      return { success: true, result: {} }
    } } }
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }
  new Function('require', 'module', 'exports', code)(imports, module, module.exports)
  cache.set(filename, module.exports)
  return module.exports
}

test('trace normalization keeps unknown time rows and only marks explicit exception events', () => {
  const { normalizeTrace } = load(resolve(import.meta.dirname, '../views/link/diagnostics/normalize.ts'))
  const spans = normalizeTrace([
    { traceId: 'trace', spanId: 'a', name: 'normal', startWithNanos: 1792652760000000000, endWithNanos: 1792652760000000000, events: [{ name: 'error-count', attributes: { message: 'error handling finished' } }] },
    { traceId: 'trace', spanId: 'b', name: 'failed', startWithNanos: 1792652760000000000, endWithNanos: 1792652760000000000, startWithNanosText: '1792652760000000001', endWithNanosText: '1792652760000000002', events: [{ name: 'exception', attributes: { 'exception.message': 'failure' } }] },
  ])
  assert.equal(spans.length, 2); assert.equal(spans[0].startNanos, ''); assert.equal(spans[0].error, false)
  assert.equal(spans[1].startNanos, '1792652760000000001'); assert.equal(spans[1].error, true)
})

test('one batched overview query preserves host, JVM, NIC rates and bucketed business traffic', async () => {
  const { loadResourceOverviewHistory } = load(resolve(import.meta.dirname, '../visDashboard/SystemMonitor/services/history.ts'))
  const result = await loadResourceOverviewHistory([new Date(0), new Date(120000)])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/dashboard/_multi')
  assert.deepEqual(calls[0].data.map(query => query.group), ['cpu', 'memory', 'network', 'bytesRead', 'bytesSent'])
  assert.equal(result.cpuSystem[0].points[0].percent, 37)
  assert.equal(result.cpuJvm[0].points[0].percent, 12)
  assert.equal(result.memorySystem[0].points[0].percent, 50)
  assert.equal(result.memoryJvm[0].points[0].percent, 75)
  assert.equal(result.memoryJvm[0].points[0].used, 1536)
  assert.deepEqual(result.network.series.hostReceive['node-a']._data, [[60000, null], [120000, 10240]])
  assert.deepEqual(result.network.series.hostSend['node-a']._data, [[60000, null], [120000, 2048]])
  assert.deepEqual(result.traffic.timestamps, [120000])
  assert.deepEqual(result.traffic.series.trafficUp['node-a']._data, [5120])
  const { nodeMetricCharts } = load(resolve(import.meta.dirname, '../views/link/diagnostics/normalize.ts'))
  const charts = nodeMetricCharts(result, 'node-a', key => key)
  assert.equal(charts.length, 6)
  assert.equal(charts.find(chart => chart.key === 'hostTraffic').series[0].samples[1].value, 10240)
  assert.equal(charts.find(chart => chart.key === 'hostTraffic').formatValue(10240), '10KB/s')
  assert.equal(charts.find(chart => chart.key === 'traffic').formatValue(5120), '5KB')
  assert.equal(charts.find(chart => chart.key === 'traffic').series[0].samples[0].timestamp, 120000)
  assert.ok(nodeMetricCharts(result, 'other-node', key => key).every(chart => chart.series.every(series => series.samples.every(point => point.value === undefined))))
})

test('host traffic never fills unavailable, first or rollback counters with zero', () => {
  const { normalizeSystemNetworkHistory } = load(resolve(import.meta.dirname, '../visDashboard/SystemMonitor/utils/networkData.ts'))
  const result = normalizeSystemNetworkHistory([
    network(60000, 1000, 1000), network(120000, 500, 500),
    network(180000, 1500, 1500, { networkInterfaceMetricsAvailable: false }), network(240000, 2500, 2500), network(300000, 3500, 3500),
  ])
  assert.deepEqual(result.series.hostReceive['node-a']._data, [[60000, null], [120000, null], [180000, null], [240000, null], [300000, 1000 / 60]])
})

test('traffic aggregation keys retain the calendar year at every bucket granularity', () => {
  const { networkParams } = load(resolve(import.meta.dirname, '../visDashboard/SystemMonitor/utils/historyParams.ts'))
  const start = new Date('2025-12-31T23:45:00+08:00')
  for (const [duration, interval, format] of [
    [30 * 60_000, '1m', 'yyyy-MM-dd HH:mm'],
    [24 * 3600_000, '1h', 'yyyy-MM-dd HH:mm'],
    [31 * 24 * 3600_000, '1d', 'yyyy-MM-dd'],
    [180 * 24 * 3600_000, '1M', 'yyyy-MM'],
    [730 * 24 * 3600_000, '1M', 'yyyy-MM'],
  ]) {
    const end = new Date(start.valueOf() + duration)
    const queries = networkParams({ time: { time: [start, end] } })
    assert.deepEqual(queries.map(query => query.group), ['bytesRead', 'bytesSent'])
    for (const query of queries) {
      assert.equal(query.params.interval, interval)
      assert.equal(query.params.format, format, 'backend timestamp reconstruction requires complete calendar keys')
      assert.equal(query.params.from, start.valueOf())
      assert.equal(query.params.to, end.valueOf())
    }
  }
})

test('JVM overview requests projected read-only attributes independently from Buffer failures', async () => {
  const { queryOverviewMBeans, queryBufferMBeans } = load(resolve(import.meta.dirname, '../api/link/diagnostics.ts'))
  const result = await queryOverviewMBeans('node-a', new AbortController().signal)
  assert.equal(result.partial, false)
  assert.equal(result.sources.length, 1)
  const requests = calls.filter(call => call.params)
  assert.equal(requests.length, 1)
  assert.ok(requests.every(call => call.params.serverId === 'node-a' && call.params.detailed === true))
  assert.ok(requests[0].params.attributes.includes('StartTime'))
  assert.ok(!requests[0].params.attributes.includes('SystemProperties'))
  await assert.rejects(queryBufferMBeans('node-a', new AbortController().signal), /remote node unavailable/)
  const bufferRequest = calls.at(-1)
  assert.deepEqual(bufferRequest.params.attributes.split(','), ['Remainder', 'DeadSize', 'Monitor', 'WriterPending', 'Wip'])
  assert.ok(!bufferRequest.params.attributes.includes('LastError'), 'periodic projections must not pull complete exception stacks')
  assert.ok(!requests[0].params.attributes.includes('Remainder'))
  assert.ok(requests.every(call => !call.url.includes('_invoke')))
})

test('device-session lookup encodes one exact device ID and does not use MBean invocation', async () => {
  const { queryDeviceSessions } = load(resolve(import.meta.dirname, '../api/link/diagnostics.ts'))
  const before = calls.length
  await queryDeviceSessions('child/a b', new AbortController().signal)
  const request = calls.at(-1)
  assert.equal(calls.length, before + 1)
  assert.equal(request.url, '/device/instance/child%2Fa%20b/sessions')
  assert.ok(!request.url.includes('_invoke'))
})

test('operational overview reads only the current node and four bounded MBean projections', async () => {
  const { queryOperationalMBeans } = load(resolve(import.meta.dirname, '../api/link/diagnostics.ts'))
  const before = calls.length
  const results = await queryOperationalMBeans('node-a', new AbortController().signal, true)
  const requests = calls.slice(before)
  assert.equal(results.length, 4); assert.ok(results.every(result => result.status === 'fulfilled'))
  assert.deepEqual(requests.map(call => decodeURIComponent(call.url).match(/mbean\/(.*)$/)[1]), [
    'org.jetlinks:type=EventBus,*',
    'org.jetlinks:type=ThingsDataManager,*', 'org.jetlinks:type=SystemMonitorCollector,*', 'java.lang:type=Memory',
  ])
  assert.ok(requests.every(call => call.params.serverId === 'node-a' && call.params.detailed === true))
  assert.deepEqual(requests.map(call => call.params.attributes.split(',')), [
    ['StructuredBufferedEventCount', 'StructuredPendingSyncPeerCount'],
    ['InMemorySize', 'DirtyCount', 'QueueDepth', 'LastCommitTime', 'LastFlushDuration'],
    ['LastFailureTime', 'LastSuccessTime'], ['HeapMemoryUsage'],
  ])
  assert.ok(requests.every(call => !call.url.includes('_invoke')))
})


test('cache projection is suppressed unless session capability was explicitly confirmed', async () => {
  const { queryOperationalMBeans } = load(resolve(import.meta.dirname, '../api/link/diagnostics.ts'))
  for (const includeCache of [undefined, false]) {
    const before = calls.length
    const sources = await queryOperationalMBeans('node-a', new AbortController().signal, includeCache)
    assert.equal(sources.length, 4)
    assert.deepEqual(sources[1], { status: 'fulfilled', value: {} })
    assert.equal(calls.length - before, 3)
    assert.ok(calls.slice(before).every(call => !decodeURIComponent(call.url).includes('ThingsDataManager')))
  }
})
