import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'

const resourceFields: ReadonlyArray<keyof RealtimeNode> = [
  'cpuSystem', 'cpuJvm', 'cpuLogicalProcessors', 'cpuLoadAverage1m', 'cpuLoadAverage5m', 'cpuLoadAverage15m',
  'memorySystem', 'memorySystemUsed', 'memorySystemTotal', 'memoryJvm', 'memoryJvmUsed', 'memoryJvmTotal', 'memoryJvmNonHeapUsed',
  'disk', 'diskUsed', 'diskTotal', 'diskReadBytesPerSecond', 'diskWriteBytesPerSecond',
  'tcpConnectionsEstablished', 'networkReceiveBytesPerSecond', 'networkSendBytesPerSecond', 'receivePacketLossRate', 'tcpRetransmissionRate',
]

/** 归一化节点即使没有上报资源也存在；派生的零压力不能充当监控证据。 */
export function hasNodeMonitoringData(live?: RealtimeNode): boolean {
  return !!live && resourceFields.some(field => typeof live[field] === 'number' && Number.isFinite(live[field]) && Number(live[field]) >= 0)
}
