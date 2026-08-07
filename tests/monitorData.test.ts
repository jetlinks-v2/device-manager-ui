import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultFocusedNodes,
  formatMemorySize,
  nodeColor,
  nodeSeriesVisual,
  normalizeMonitorHistory,
  sortMonitorTooltipItems,
} from '../views/link/DashBoard/components/monitorData.ts'
import {
  calculateCpuLoadPressure,
  createRealtimeNodeNormalizer,
  createRealtimeNetworkRateCalculator,
  defaultFocusedRealtimeNodes,
  getCpuLoadPressureLevel,
  normalizeRealtimeNodes,
  preserveRealtimeNodeOrder,
  resolveFocusedRealtimeNodes,
  sortRealtimeNodes,
} from '../views/link/DashBoard/components/realtimeResourceData.ts'
import { createNodeHealthCalculator } from '../views/link/DashBoard/components/nodeHealthData.ts'
import {
  formatNetworkCount,
  formatNetworkPercent,
  formatNetworkSize,
  normalizeSystemNetworkHistory,
  normalizeTrafficHistory,
  renderNetworkMetricTooltip,
} from '../views/link/DashBoard/components/networkData.ts'

const history = [
  {
    data: {
      clusterNodeId: 'node-a',
      value: {
        timestamp: 62_000,
        cpuSystemUsage: 25,
        cpuJvmUsage: 10,
        memoryJvmHeapTotal: 2048,
        memoryJvmHeapFree: 512,
        memorySystemTotal: 8192,
        memorySystemFree: 4096,
      },
    },
  },
  {
    data: {
      clusterNodeId: 'node-a',
      value: {
        timestamp: 2_000,
        cpuSystemUsage: 20,
        cpuJvmUsage: 8,
        memoryJvmHeapTotal: 2048,
        memoryJvmHeapFree: 1024,
        memorySystemTotal: 8192,
        memorySystemFree: 6144,
      },
    },
  },
  {
    data: {
      clusterNodeId: 'node-b',
      value: {
        timestamp: 63_000,
        cpuSystemUsage: 80,
        cpuJvmUsage: 60,
        memoryJvmHeapTotal: 4096,
        memoryJvmHeapFree: 1024,
        memorySystemTotal: 16384,
        memorySystemFree: 4096,
      },
    },
  },
]

test('normalizes CPU history in timestamp order and keeps JVM/system metrics separate', () => {
  const system = normalizeMonitorHistory(history, 'cpuSystem')
  const jvm = normalizeMonitorHistory(history, 'cpuJvm')

  assert.deepEqual(system[0].points.map(point => point.percent), [20, 25])
  assert.deepEqual(jvm[0].points.map(point => point.percent), [8, 10])
})

test('aligns nearby cluster samples to the same minute for comparable hover rows', () => {
  const series = normalizeMonitorHistory(history, 'cpuSystem')

  assert.equal(series[0].latest?.timestamp, series[1].latest?.timestamp)
})

test('derives memory usage percent and used/total sizes for both memory scopes', () => {
  const jvm = normalizeMonitorHistory(history, 'memoryJvm')
  const system = normalizeMonitorHistory(history, 'memorySystem')

  assert.deepEqual(jvm[0].latest, { timestamp: 60_000, percent: 75, used: 1536, total: 2048 })
  assert.deepEqual(system[0].latest, { timestamp: 60_000, percent: 50, used: 4096, total: 8192 })
})

test('focuses the highest current usage nodes and uses stable node colors', () => {
  const series = normalizeMonitorHistory(history, 'cpuSystem')

  assert.deepEqual(defaultFocusedNodes(series, 1), ['node-b'])
  assert.equal(nodeColor('node-a'), nodeColor('node-a'))
  assert.notEqual(nodeColor('node-a'), nodeColor('node-b'))
  assert.equal(nodeColor('iot-service:8200'), nodeColor('iot-service:8200'))
})

test('keeps every node series visual stable without realtime hover linkage', () => {
  const first = nodeSeriesVisual('node-b')
  const second = nodeSeriesVisual('node-b')

  assert.deepEqual(first, second)
  assert.equal(first.lineStyle.opacity, 1)
  assert.equal(first.lineStyle.width, 1.5)
  assert.equal(first.lineStyle.color, nodeColor('node-b'))
  assert.equal(first.emphasis.disabled, true)
  assert.equal(first.z, 2)
})

test('formats monitor memory capacity without inventing missing values', () => {
  assert.equal(formatMemorySize(1536), '1.5 GB')
  assert.equal(formatMemorySize(512), '512 MB')
  assert.equal(formatMemorySize(undefined), '--')
})

test('sorts hover rows from highest to lowest usage without mutating ECharts input', () => {
  const items = [
    { seriesName: 'node-a', data: [1, 25] as const },
    { seriesName: 'node-b', data: [1, 80] as const },
    { seriesName: 'node-c', data: [1, 40] as const },
  ]

  assert.deepEqual(sortMonitorTooltipItems(items).map(item => item.seriesName), [
    'node-b',
    'node-c',
    'node-a',
  ])
  assert.deepEqual(items.map(item => item.seriesName), ['node-a', 'node-b', 'node-c'])
})

test('normalizes grouped realtime resources including CPU load and cores', () => {
  const nodes = normalizeRealtimeNodes([
    {
      clusterNodeId: 'node-a',
      value: {
        cpu: {
          systemUsage: 40,
          jvmUsage: 20,
          logicalProcessorCount: 8,
          loadAverage1m: 4,
          loadAverage5m: 3,
          loadAverage15m: 2,
        },
        memory: {
          systemUsage: 50,
          systemTotal: 8192,
          jvmHeapUsage: 70,
          jvmHeapTotal: 2048,
          jvmNonHeapUsage: 25,
          jvmNonHeapTotal: 512,
          jvmNonHeapFree: 384,
        },
        disk: { usage: 25, total: 10240 },
      },
    },
    {
      clusterNodeId: 'node-b',
      value: {
        cpu: { systemUsage: 30, jvmUsage: 80 },
        memory: { systemUsage: 60, systemTotal: 16384, jvmHeapUsage: 30, jvmHeapTotal: 4096 },
        disk: { usage: 45, total: 20480 },
      },
    },
  ])

  assert.equal(nodes[0].memoryJvmUsed, 1433.6)
  assert.equal(nodes[0].memoryJvmNonHeapUsed, 128)
  assert.equal(nodes[0].memorySystemUsed, 4096)
  assert.equal(nodes[0].diskUsed, 2560)
  assert.equal(nodes[0].cpuLogicalProcessors, 8)
  assert.equal(nodes[0].cpuLoadPressure, 50)
  assert.deepEqual([nodes[0].cpuLoadAverage1m, nodes[0].cpuLoadAverage5m, nodes[0].cpuLoadAverage15m], [4, 3, 2])
  assert.deepEqual(sortRealtimeNodes(nodes, 'jvm', 'desc').map(item => item.nodeId), ['node-b', 'node-a'])
  assert.deepEqual(sortRealtimeNodes(nodes, 'nodeId', 'asc').map(item => item.nodeId), ['node-a', 'node-b'])
  assert.deepEqual(preserveRealtimeNodeOrder(nodes, ['node-b', 'node-a']), ['node-b', 'node-a'])
})

test('normalizes CPU load by core count without hiding overload', () => {
  assert.equal(calculateCpuLoadPressure(4, 8), 50)
  assert.equal(calculateCpuLoadPressure(12, 8), 150)
  assert.equal(calculateCpuLoadPressure(4, 0), undefined)
  assert.equal(calculateCpuLoadPressure(undefined, 8), undefined)
  assert.equal(getCpuLoadPressureLevel(69.9), 'normal')
  assert.equal(getCpuLoadPressureLevel(70), 'elevated')
  assert.equal(getCpuLoadPressureLevel(100), 'elevated')
  assert.equal(getCpuLoadPressureLevel(100.1), 'overloaded')
  assert.equal(getCpuLoadPressureLevel(undefined), undefined)
})

const healthItem = (time: number, overrides: Record<string, any> = {}) => ({
  clusterNodeId: 'node-a',
  value: {
    cpu: {
      sampleTime: time,
      userTicks: time / 10,
      niceTicks: 0,
      systemTicks: time / 10,
      idleTicks: time / 10,
      ioWaitTicks: time / 10,
      irqTicks: 0,
      softIrqTicks: 0,
      stealTicks: 0,
      ...overrides.cpu,
    },
    disk: { sampleTime: time, ioMetricsAvailable: false, ...overrides.disk },
    network: { sampleTime: time, diagnosticSampleTime: time, ...overrides.network },
  },
})

test('derives health only from valid adjacent snapshots and keeps the worst evidence', () => {
  const calculate = createNodeHealthCalculator()
  assert.deepEqual(calculate([healthItem(1000)]).get('node-a'), { level: 'normal', evidence: [] })
  const current = healthItem(2000, {
    cpu: { userTicks: 200, systemTicks: 200, idleTicks: 200, ioWaitTicks: 500, stealTicks: 100 },
    disk: { ioMetricsAvailable: true, deviceCount: 1, transferTimeMillis: 1000 },
    network: { conntrackMetricsAvailable: true, conntrackCurrent: 95, conntrackMax: 100 },
  })
  calculate([healthItem(1000, { disk: { ioMetricsAvailable: true, deviceCount: 1, transferTimeMillis: 0 } })])
  const summary = calculate([current]).get('node-a')!
  assert.equal(summary.level, 'critical')
  assert.ok(summary.evidence.some(item => item.signal === 'cpuIoWait'))
  assert.ok(summary.evidence.some(item => item.signal === 'diskIoBusy'))
  assert.ok(summary.evidence.some(item => item.signal === 'conntrackUsage'))
})

test('gates optional diagnostics and clears counter evidence after rollback', () => {
  const calculate = createNodeHealthCalculator()
  calculate([healthItem(1000, { cpu: { ioWaitTicks: 0 } })])
  const abnormal = calculate([healthItem(2000, { cpu: { ioWaitTicks: 1000 } })]).get('node-a')!
  assert.ok(abnormal.evidence.some(item => item.signal === 'cpuIoWait'))
  const rollback = calculate([healthItem(1500, { cpu: { ioWaitTicks: 10 }, disk: {
    blockDeviceStateMetricsAvailable: false,
    blockDeviceNotRunningCount: 4,
    health: { available: false, failedDeviceCount: 2, score: 0 },
  } })]).get('node-a')!
  assert.equal(rollback.level, 'normal')
  assert.deepEqual(rollback.evidence, [])
})

test('clears retained counter evidence when an optional source becomes unavailable', () => {
  const calculate = createNodeHealthCalculator()
  calculate([healthItem(1000, { cpu: { cgroupMetricsAvailable: true, cgroupPeriods: 100, cgroupThrottledPeriods: 0 } })])
  const throttled = calculate([healthItem(2000, {
    cpu: { cgroupMetricsAvailable: true, cgroupPeriods: 200, cgroupThrottledPeriods: 30 },
  })]).get('node-a')!
  assert.ok(throttled.evidence.some(item => item.signal === 'cpuThrottled'))
  const unavailable = calculate([healthItem(2000, {
    cpu: { cgroupMetricsAvailable: false, cgroupPeriods: 200, cgroupThrottledPeriods: 30 },
  })]).get('node-a')!
  assert.ok(!unavailable.evidence.some(item => item.signal === 'cpuThrottled'))
})

test('retains health conclusion on unchanged collection timestamp and integrates it into realtime nodes', () => {
  const normalize = createRealtimeNodeNormalizer()
  normalize([healthItem(1000, { cpu: { ioWaitTicks: 0 } })])
  const abnormal = normalize([healthItem(2000, { cpu: { ioWaitTicks: 1000 } })])[0]
  const unchanged = normalize([healthItem(2000, { cpu: { ioWaitTicks: 1000 } })])[0]
  assert.equal(abnormal.health.level, 'critical')
  assert.deepEqual(unchanged.health, abnormal.health)
})

test('treats direct disk device and SMART failure evidence as critical', () => {
  const calculate = createNodeHealthCalculator()
  const summary = calculate([healthItem(1000, { disk: {
    blockDeviceStateMetricsAvailable: true,
    blockDeviceNotRunningCount: 1,
    health: { available: true, failedDeviceCount: 1, score: 0 },
  } })]).get('node-a')!
  assert.equal(summary.level, 'critical')
  assert.deepEqual(summary.evidence.map(item => item.signal), ['diskDevice', 'diskHealth'])
})

test('shows the applied CPU temperature threshold instead of an unavailable critical value', () => {
  const calculate = createNodeHealthCalculator()
  const fallback = calculate([healthItem(1000, { cpu: {
    cpuTemperatureAvailable: true,
    cpuTemperatureCelsius: 80.4,
    cpuCriticalTemperatureAvailable: false,
  } })]).get('node-a')!
  assert.deepEqual(fallback.evidence.find(item => item.signal === 'cpuTemperature')?.values, [80.4, 80])

  const platform = calculate([healthItem(2000, { cpu: {
    cpuTemperatureAvailable: true,
    cpuTemperatureCelsius: 84,
    cpuCriticalTemperatureAvailable: true,
    cpuCriticalTemperatureCelsius: 100,
  } })]).get('node-a')!
  assert.deepEqual(platform.evidence.find(item => item.signal === 'cpuTemperature')?.values, [84, 80])
})

const networkItem = (
  nodeId: string,
  sampleTime: number,
  receivedPackets: number,
  receiveDrops: number,
  sent: number,
  retransmitted: number,
  available = true,
) => ({
  clusterNodeId: nodeId,
  value: {
    disk: {
      sampleTime,
      ioMetricsAvailable: available,
      readBytes: receivedPackets * 1024,
      writeBytes: sent * 1024,
    },
    network: {
      sampleTime,
      diagnosticSampleTime: sampleTime,
      interfaceMetricsAvailable: available,
      receivedBytes: receivedPackets * 1000,
      sentBytes: sent * 1000,
      receivedPackets,
      receiveDrops,
      tcpMetricsAvailable: available,
      tcpConnectionsEstablished: 12,
      tcpSegmentsSent: sent,
      tcpSegmentsRetransmitted: retransmitted,
    },
  },
})

test('derives packet loss and TCP retransmission from adjacent counter snapshots', () => {
  const calculate = createRealtimeNetworkRateCalculator()
  assert.deepEqual(calculate([networkItem('node-a', 1000, 100, 10, 200, 20)]).get('node-a'), {
    receivePacketLossRate: undefined,
    tcpRetransmissionRate: undefined,
    diskReadBytesPerSecond: undefined,
    diskWriteBytesPerSecond: undefined,
    networkReceiveBytesPerSecond: undefined,
    networkSendBytesPerSecond: undefined,
  })

  const rates = calculate([networkItem('node-a', 2000, 190, 20, 300, 25)]).get('node-a')
  assert.equal(rates?.receivePacketLossRate, 10)
  assert.equal(rates?.tcpRetransmissionRate, 5)
  assert.equal(rates?.diskReadBytesPerSecond, 90 * 1024)
  assert.equal(rates?.diskWriteBytesPerSecond, 100 * 1024)
  assert.equal(rates?.networkReceiveBytesPerSecond, 90_000)
  assert.equal(rates?.networkSendBytesPerSecond, 100_000)
})

test('keeps missing network rates honest on rollback, zero denominator and unavailable metrics', () => {
  const calculate = createRealtimeNetworkRateCalculator()
  calculate([networkItem('node-a', 2000, 100, 10, 200, 20)])
  const rollback = calculate([networkItem('node-a', 1000, 50, 5, 100, 10)]).get('node-a')
  assert.equal(rollback?.receivePacketLossRate, undefined)
  assert.equal(rollback?.tcpRetransmissionRate, undefined)

  const zero = calculate([networkItem('node-a', 2000, 50, 5, 100, 10)]).get('node-a')
  assert.equal(zero?.receivePacketLossRate, undefined)
  assert.equal(zero?.tcpRetransmissionRate, undefined)

  const unavailable = calculate([networkItem('node-a', 3000, 60, 6, 110, 11, false)]).get('node-a')
  assert.equal(unavailable?.receivePacketLossRate, undefined)
  assert.equal(unavailable?.tcpRetransmissionRate, undefined)
})

test('retains rates while diagnostic timestamps stay unchanged and removes departed node baselines', () => {
  const calculate = createRealtimeNetworkRateCalculator()
  calculate([networkItem('node-a', 1000, 100, 10, 200, 20)])
  const current = calculate([networkItem('node-a', 2000, 190, 20, 300, 25)]).get('node-a')
  const unchanged = calculate([networkItem('node-a', 2000, 190, 20, 300, 25)]).get('node-a')
  assert.deepEqual(unchanged, current)

  calculate([])
  const returned = calculate([networkItem('node-a', 3000, 300, 30, 400, 30)]).get('node-a')
  assert.equal(returned?.receivePacketLossRate, undefined)
  assert.equal(returned?.tcpRetransmissionRate, undefined)
})

test('focuses nodes by highest then average realtime pressure and restores valid cached choices', () => {
  const nodes = normalizeRealtimeNodes([
    { clusterNodeId: 'spike', value: { cpu: { jvmUsage: 90 } } },
    { clusterNodeId: 'steady', value: { cpu: { systemUsage: 70, jvmUsage: 70 }, memory: { systemUsage: 70, jvmHeapUsage: 70 }, disk: { usage: 70 } } },
    { clusterNodeId: 'low', value: { cpu: { systemUsage: 10 } } },
  ])

  assert.deepEqual(defaultFocusedRealtimeNodes(nodes, 2), ['spike', 'steady'])
  assert.deepEqual(resolveFocusedRealtimeNodes(nodes, ['steady', 'offline']), ['steady'])
  assert.deepEqual(resolveFocusedRealtimeNodes(nodes, ['offline'], 2), ['spike', 'steady'])
  assert.deepEqual(resolveFocusedRealtimeNodes(nodes, [], 2), ['spike', 'steady'])
})

test('groups both traffic directions into one sorted periodic-traffic row per node', () => {
  const tooltip = renderNetworkMetricTooltip([
    { axisValueLabel: '12:00', marker: 'a', seriesName: 'node-a · trafficUp', value: 2048 },
    { axisValueLabel: '12:00', marker: 'a', seriesName: 'node-a · trafficDown', value: 1024 },
    { axisValueLabel: '12:00', marker: 'b', seriesName: 'node-b · trafficUp', value: 4096 },
    { axisValueLabel: '12:00', marker: 'b', seriesName: 'node-b · trafficDown', value: 512 },
  ], ['trafficUp', 'trafficDown'], { trafficUp: '上行', trafficDown: '下行' }, formatNetworkSize)

  assert.equal(formatNetworkSize(1024), '1KB')
  assert.ok(tooltip.indexOf('node-b') < tooltip.indexOf('node-a'))
  assert.equal(tooltip.match(/node-a/g)?.length, 1)
  assert.match(tooltip, /上行.*2KB.*下行.*1KB/)
})

const systemNetworkHistoryItem = (
  nodeId: string,
  timestamp: number,
  overrides: Record<string, unknown> = {},
) => ({
  data: {
    clusterNodeId: nodeId,
    value: {
      timestamp,
      networkInterfaceMetricsAvailable: true,
      networkReceivedPackets: 100,
      networkSentPackets: 200,
      networkReceiveErrors: 2,
      networkSendErrors: 1,
      networkReceiveDrops: 10,
      networkTcpMetricsAvailable: true,
      networkTcpConnectionsEstablished: 12,
      networkTcpSegmentsSent: 1000,
      networkTcpSegmentsRetransmitted: 20,
      ...overrides,
    },
  },
})

test('derives historical packet loss, interface error and TCP retransmission rates', () => {
  const history = normalizeSystemNetworkHistory([
    systemNetworkHistoryItem('node-a', 60_000),
    systemNetworkHistoryItem('node-a', 120_000, {
      networkReceivedPackets: 190,
      networkSentPackets: 300,
      networkReceiveErrors: 4,
      networkSendErrors: 2,
      networkReceiveDrops: 20,
      networkTcpConnectionsEstablished: 18,
      networkTcpSegmentsSent: 1100,
      networkTcpSegmentsRetransmitted: 25,
    }),
  ])

  assert.deepEqual(history.series.packetLoss['node-a']._data, [[60_000, null], [120_000, 10]])
  assert.deepEqual(history.series.interfaceErrors['node-a']._data, [[60_000, null], [120_000, 1.5789]])
  assert.deepEqual(history.series.tcpRetransmission['node-a']._data, [[60_000, null], [120_000, 5]])
  assert.deepEqual(history.series.tcpConnections['node-a']._data, [[60_000, 12], [120_000, 18]])
})

test('uses null history gaps for unavailable, stationary, zero-denominator and rollback counters', () => {
  const history = normalizeSystemNetworkHistory([
    systemNetworkHistoryItem('unavailable', 60_000),
    systemNetworkHistoryItem('unavailable', 120_000, { networkInterfaceMetricsAvailable: false }),
    systemNetworkHistoryItem('stationary', 60_000),
    systemNetworkHistoryItem('stationary', 60_000, { networkReceivedPackets: 120 }),
    systemNetworkHistoryItem('zero', 60_000),
    systemNetworkHistoryItem('zero', 120_000),
    systemNetworkHistoryItem('rollback', 60_000),
    systemNetworkHistoryItem('rollback', 120_000, {
      networkReceivedPackets: 90,
      networkTcpSegmentsSent: 900,
    }),
  ])

  assert.equal(history.series.packetLoss.unavailable._data.at(-1)?.[1], null)
  assert.equal(history.series.packetLoss.stationary._data.at(-1)?.[1], null)
  assert.equal(history.series.packetLoss.zero._data.at(-1)?.[1], null)
  assert.equal(history.series.packetLoss.rollback._data.at(-1)?.[1], null)
  assert.equal(history.series.tcpRetransmission.rollback._data.at(-1)?.[1], null)
})

test('normalizes traffic independently from system history and sorts metric tooltip rows', () => {
  const traffic = normalizeTrafficHistory([{ group: 'bytesRead', data: {
    clusterNodeId: 'traffic-only',
    value: [{ timeString: '12:00', timestamp: 1000, value: 2048 }],
  } }])
  const system = normalizeSystemNetworkHistory([systemNetworkHistoryItem('system-only', 60_000)])
  const tooltip = renderNetworkMetricTooltip([
    { axisValueLabel: '12:00', marker: 'a', seriesName: 'node-a · packetLoss', value: [60_000, 1] },
    { axisValueLabel: '12:00', marker: 'b', seriesName: 'node-b · packetLoss', value: [60_000, 5] },
  ], ['packetLoss'], { packetLoss: '丢包' }, formatNetworkPercent)

  assert.deepEqual(traffic.nodes, ['traffic-only'])
  assert.deepEqual(system.nodes, ['system-only'])
  assert.ok(tooltip.indexOf('node-b') < tooltip.indexOf('node-a'))
  assert.match(tooltip, /丢包.*5%/)
  assert.equal(formatNetworkCount([60_000, 1234]), '1,234')
})
