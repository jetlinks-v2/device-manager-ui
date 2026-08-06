import { createNodeHealthCalculator, type NodeHealthSummary, type RealtimeHealthPayloadItem } from './nodeHealthData'

export type RealtimeSortKey = 'pressure' | 'nodeId' | 'system' | 'jvm' | 'disk' | 'network'
export type RealtimeSortOrder = 'asc' | 'desc'
export type CpuLoadPressureLevel = 'normal' | 'elevated' | 'overloaded'

interface UsageValue {
  usage?: number | string
  total?: number | string
}

interface RealtimeDiskPayload extends UsageValue {
  sampleTime?: number | string
  ioMetricsAvailable?: boolean
  readBytes?: number | string
  writeBytes?: number | string
  [key: string]: unknown
}

interface RealtimeCpuPayload {
  systemUsage?: number | string
  jvmUsage?: number | string
  sampleTime?: number | string
  logicalProcessorCount?: number | string
  loadAverage1m?: number | string
  loadAverage5m?: number | string
  loadAverage15m?: number | string
  [key: string]: unknown
}

interface RealtimeNetworkPayload {
  sampleTime?: number | string
  diagnosticSampleTime?: number | string
  interfaceMetricsAvailable?: boolean
  receivedBytes?: number | string
  sentBytes?: number | string
  receivedPackets?: number | string
  receiveDrops?: number | string
  tcpMetricsAvailable?: boolean
  tcpConnectionsEstablished?: number | string
  tcpSegmentsSent?: number | string
  tcpSegmentsRetransmitted?: number | string
  [key: string]: unknown
}

export interface RealtimePayloadItem {
  clusterNodeId?: string
  value?: {
    cpu?: RealtimeCpuPayload
    memory?: {
      systemUsage?: number | string
      systemTotal?: number | string
      jvmHeapUsage?: number | string
      jvmHeapTotal?: number | string
      jvmNonHeapUsage?: number | string
      jvmNonHeapTotal?: number | string
      jvmNonHeapFree?: number | string
    }
    disk?: RealtimeDiskPayload
    network?: RealtimeNetworkPayload
  }
}

export interface RealtimeNode {
  nodeId: string
  cpuSystem?: number
  cpuJvm?: number
  cpuLogicalProcessors?: number
  cpuLoadAverage1m?: number
  cpuLoadAverage5m?: number
  cpuLoadAverage15m?: number
  cpuLoadPressure?: number
  memorySystem?: number
  memorySystemUsed?: number
  memorySystemTotal?: number
  memoryJvm?: number
  memoryJvmUsed?: number
  memoryJvmTotal?: number
  memoryJvmNonHeapUsed?: number
  disk?: number
  diskUsed?: number
  diskTotal?: number
  diskReadBytesPerSecond?: number
  diskWriteBytesPerSecond?: number
  tcpConnectionsEstablished?: number
  networkReceiveBytesPerSecond?: number
  networkSendBytesPerSecond?: number
  receivePacketLossRate?: number
  tcpRetransmissionRate?: number
  systemPressure: number
  jvmPressure: number
  networkRisk?: number
  pressure: number
  averagePressure: number
  health: NodeHealthSummary
}

interface NetworkRateSnapshot {
  interfaceAvailable: boolean
  interfaceSampleTime?: number
  receivedBytes?: number
  sentBytes?: number
  receivedPackets?: number
  receiveDrops?: number
  tcpAvailable: boolean
  diagnosticSampleTime?: number
  tcpSegmentsSent?: number
  tcpSegmentsRetransmitted?: number
}

interface NetworkRateState {
  snapshot: NetworkRateSnapshot
  diskSnapshot: DiskRateSnapshot
  receivePacketLossRate?: number
  tcpRetransmissionRate?: number
  diskReadBytesPerSecond?: number
  diskWriteBytesPerSecond?: number
  networkReceiveBytesPerSecond?: number
  networkSendBytesPerSecond?: number
}

interface NetworkRates {
  receivePacketLossRate?: number
  tcpRetransmissionRate?: number
  diskReadBytesPerSecond?: number
  diskWriteBytesPerSecond?: number
  networkReceiveBytesPerSecond?: number
  networkSendBytesPerSecond?: number
}

interface DiskRateSnapshot {
  available: boolean
  sampleTime?: number
  readBytes?: number
  writeBytes?: number
}

const numeric = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const percent = (value: unknown): number | undefined => {
  const parsed = numeric(value)
  return parsed === undefined ? undefined : Math.min(100, Math.max(0, parsed))
}
const availableLoad = (value: unknown) => {
  const parsed = numeric(value)
  return parsed !== undefined && parsed >= 0 ? parsed : undefined
}

export const calculateCpuLoadPressure = (
  loadAverage: number | undefined,
  logicalProcessors: number | undefined,
): number | undefined => loadAverage !== undefined && loadAverage >= 0 && logicalProcessors !== undefined && logicalProcessors > 0
  ? loadAverage / logicalProcessors * 100
  : undefined

// A load of one runnable task per core is 100%; only a queue beyond that capacity is overloaded.
export const getCpuLoadPressureLevel = (pressure: number | undefined): CpuLoadPressureLevel | undefined => {
  if (pressure === undefined) return undefined
  if (pressure > 100) return 'overloaded'
  return pressure >= 70 ? 'elevated' : 'normal'
}

const usedCapacity = (total: number | undefined, usage: number | undefined) =>
  total === undefined || usage === undefined ? undefined : total * usage / 100
const maxValue = (values: Array<number | undefined>) => Math.max(0, ...values.filter(value => value !== undefined) as number[])

const toNetworkSnapshot = (network?: RealtimeNetworkPayload): NetworkRateSnapshot => ({
  interfaceAvailable: network?.interfaceMetricsAvailable === true,
  interfaceSampleTime: numeric(network?.sampleTime),
  receivedBytes: numeric(network?.receivedBytes),
  sentBytes: numeric(network?.sentBytes),
  receivedPackets: numeric(network?.receivedPackets),
  receiveDrops: numeric(network?.receiveDrops),
  tcpAvailable: network?.tcpMetricsAvailable === true,
  diagnosticSampleTime: numeric(network?.diagnosticSampleTime),
  tcpSegmentsSent: numeric(network?.tcpSegmentsSent),
  tcpSegmentsRetransmitted: numeric(network?.tcpSegmentsRetransmitted),
})

const toDiskSnapshot = (disk?: RealtimeDiskPayload): DiskRateSnapshot => ({
  available: disk?.ioMetricsAvailable === true,
  sampleTime: numeric(disk?.sampleTime),
  readBytes: numeric(disk?.readBytes),
  writeBytes: numeric(disk?.writeBytes),
})

const deriveBytesPerSecond = (
  currentTime: number | undefined,
  previousTime: number | undefined,
  currentBytes: number | undefined,
  previousBytes: number | undefined,
): number | undefined => {
  if ([currentTime, previousTime, currentBytes, previousBytes].some(value => value === undefined)) return undefined
  const elapsedSeconds = (currentTime! - previousTime!) / 1000
  const bytesDelta = currentBytes! - previousBytes!
  if (elapsedSeconds <= 0 || bytesDelta < 0) return undefined
  return bytesDelta / elapsedSeconds
}

const deriveCounterRate = (
  currentTime: number | undefined,
  previousTime: number | undefined,
  currentTotal: number | undefined,
  previousTotal: number | undefined,
  currentFailures: number | undefined,
  previousFailures: number | undefined,
): number | undefined => {
  if ([currentTime, previousTime, currentTotal, previousTotal, currentFailures, previousFailures]
    .some(value => value === undefined)) return undefined
  if (currentTime! <= previousTime!) return undefined
  const totalDelta = currentTotal! - previousTotal!
  const failureDelta = currentFailures! - previousFailures!
  if (totalDelta <= 0 || failureDelta < 0) return undefined
  return Math.min(100, Math.max(0, failureDelta / totalDelta * 100))
}

const deriveReceivePacketLossRate = (
  current: NetworkRateSnapshot,
  previous: NetworkRateSnapshot,
): number | undefined => {
  if (current.interfaceSampleTime === undefined || previous.interfaceSampleTime === undefined
    || current.interfaceSampleTime <= previous.interfaceSampleTime
    || current.receivedPackets === undefined || previous.receivedPackets === undefined
    || current.receiveDrops === undefined || previous.receiveDrops === undefined) return undefined
  const receivedDelta = current.receivedPackets - previous.receivedPackets
  const dropDelta = current.receiveDrops - previous.receiveDrops
  const totalDelta = receivedDelta + dropDelta
  if (receivedDelta < 0 || dropDelta < 0 || totalDelta <= 0) return undefined
  return Math.min(100, dropDelta / totalDelta * 100)
}

/**
 * Maintains node-local counter baselines. Equal diagnostic timestamps retain the last valid rate because
 * backend diagnostic counters may refresh less frequently than the three-second realtime snapshot.
 */
export const createRealtimeNetworkRateCalculator = () => {
  let stateByNode = new Map<string, NetworkRateState>()

  return (items: RealtimePayloadItem[]): Map<string, NetworkRates> => {
    const nextState = new Map<string, NetworkRateState>()
    const rates = new Map<string, NetworkRates>()

    items.forEach((item) => {
      const nodeId = item.clusterNodeId || '--'
      const snapshot = toNetworkSnapshot(item.value?.network)
      const diskSnapshot = toDiskSnapshot(item.value?.disk)
      const previous = stateByNode.get(nodeId)
      let receivePacketLossRate: number | undefined
      let tcpRetransmissionRate: number | undefined
      let diskReadBytesPerSecond: number | undefined
      let diskWriteBytesPerSecond: number | undefined
      let networkReceiveBytesPerSecond: number | undefined
      let networkSendBytesPerSecond: number | undefined

      if (snapshot.interfaceAvailable && previous?.snapshot.interfaceAvailable) {
        if (snapshot.interfaceSampleTime === previous.snapshot.interfaceSampleTime) {
          receivePacketLossRate = previous.receivePacketLossRate
          networkReceiveBytesPerSecond = previous.networkReceiveBytesPerSecond
          networkSendBytesPerSecond = previous.networkSendBytesPerSecond
        } else {
          receivePacketLossRate = deriveReceivePacketLossRate(snapshot, previous.snapshot)
          networkReceiveBytesPerSecond = deriveBytesPerSecond(
            snapshot.interfaceSampleTime,
            previous.snapshot.interfaceSampleTime,
            snapshot.receivedBytes,
            previous.snapshot.receivedBytes,
          )
          networkSendBytesPerSecond = deriveBytesPerSecond(
            snapshot.interfaceSampleTime,
            previous.snapshot.interfaceSampleTime,
            snapshot.sentBytes,
            previous.snapshot.sentBytes,
          )
        }
      }
      if (snapshot.tcpAvailable && previous?.snapshot.tcpAvailable) {
        if (snapshot.diagnosticSampleTime === previous.snapshot.diagnosticSampleTime) {
          tcpRetransmissionRate = previous.tcpRetransmissionRate
        } else {
          tcpRetransmissionRate = deriveCounterRate(
            snapshot.diagnosticSampleTime,
            previous.snapshot.diagnosticSampleTime,
            snapshot.tcpSegmentsSent,
            previous.snapshot.tcpSegmentsSent,
            snapshot.tcpSegmentsRetransmitted,
            previous.snapshot.tcpSegmentsRetransmitted,
          )
        }
      }
      if (diskSnapshot.available && previous?.diskSnapshot.available) {
        if (diskSnapshot.sampleTime === previous.diskSnapshot.sampleTime) {
          diskReadBytesPerSecond = previous.diskReadBytesPerSecond
          diskWriteBytesPerSecond = previous.diskWriteBytesPerSecond
        } else {
          diskReadBytesPerSecond = deriveBytesPerSecond(
            diskSnapshot.sampleTime,
            previous.diskSnapshot.sampleTime,
            diskSnapshot.readBytes,
            previous.diskSnapshot.readBytes,
          )
          diskWriteBytesPerSecond = deriveBytesPerSecond(
            diskSnapshot.sampleTime,
            previous.diskSnapshot.sampleTime,
            diskSnapshot.writeBytes,
            previous.diskSnapshot.writeBytes,
          )
        }
      }

      const next = {
        snapshot,
        diskSnapshot,
        receivePacketLossRate,
        tcpRetransmissionRate,
        diskReadBytesPerSecond,
        diskWriteBytesPerSecond,
        networkReceiveBytesPerSecond,
        networkSendBytesPerSecond,
      }
      nextState.set(nodeId, next)
      rates.set(nodeId, {
        receivePacketLossRate,
        tcpRetransmissionRate,
        diskReadBytesPerSecond,
        diskWriteBytesPerSecond,
        networkReceiveBytesPerSecond,
        networkSendBytesPerSecond,
      })
    })

    // Replacing the map also drops baselines for nodes that left the cluster.
    stateByNode = nextState
    return rates
  }
}

export const normalizeRealtimeNodes = (
  items: RealtimePayloadItem[],
  networkRates = new Map<string, NetworkRates>(),
  healthSummaries = new Map<string, NodeHealthSummary>(),
): RealtimeNode[] => items.map((item) => {
  const nodeId = item.clusterNodeId || '--'
  const cpuSystem = percent(item.value?.cpu?.systemUsage)
  const cpuJvm = percent(item.value?.cpu?.jvmUsage)
  const cpuLogicalProcessors = numeric(item.value?.cpu?.logicalProcessorCount)
  const cpuLoadAverage1m = availableLoad(item.value?.cpu?.loadAverage1m)
  const cpuLoadAverage5m = availableLoad(item.value?.cpu?.loadAverage5m)
  const cpuLoadAverage15m = availableLoad(item.value?.cpu?.loadAverage15m)
  const cpuLoadPressure = calculateCpuLoadPressure(cpuLoadAverage1m, cpuLogicalProcessors)
  const memorySystem = percent(item.value?.memory?.systemUsage)
  const memoryJvm = percent(item.value?.memory?.jvmHeapUsage)
  const memoryJvmNonHeap = percent(item.value?.memory?.jvmNonHeapUsage)
  const disk = percent(item.value?.disk?.usage)
  const memorySystemTotal = numeric(item.value?.memory?.systemTotal)
  const memoryJvmTotal = numeric(item.value?.memory?.jvmHeapTotal)
  const memoryJvmNonHeapTotal = numeric(item.value?.memory?.jvmNonHeapTotal)
  const memoryJvmNonHeapFree = numeric(item.value?.memory?.jvmNonHeapFree)
  const memoryJvmNonHeapUsed = memoryJvmNonHeapTotal !== undefined && memoryJvmNonHeapFree !== undefined
    ? Math.max(0, memoryJvmNonHeapTotal - memoryJvmNonHeapFree)
    : usedCapacity(memoryJvmNonHeapTotal, memoryJvmNonHeap)
  const diskTotal = numeric(item.value?.disk?.total)
  const tcpConnectionsEstablished = item.value?.network?.tcpMetricsAvailable === true
    ? numeric(item.value.network.tcpConnectionsEstablished)
    : undefined
  const rates = networkRates.get(nodeId) || {}
  const systemPressure = maxValue([
    cpuSystem,
    cpuLoadPressure === undefined ? undefined : Math.min(100, cpuLoadPressure),
    memorySystem,
  ])
  const jvmPressure = maxValue([cpuJvm, memoryJvm])
  const networkRiskValues = [rates.receivePacketLossRate, rates.tcpRetransmissionRate]
    .filter(value => value !== undefined) as number[]
  const networkRisk = networkRiskValues.length ? Math.max(...networkRiskValues) : undefined
  const usages = [cpuSystem, cpuJvm, memorySystem, memoryJvm, disk]
    .filter(value => value !== undefined) as number[]

  return {
    nodeId,
    cpuSystem,
    cpuJvm,
    cpuLogicalProcessors,
    cpuLoadAverage1m,
    cpuLoadAverage5m,
    cpuLoadAverage15m,
    cpuLoadPressure,
    memorySystem,
    memorySystemTotal,
    memorySystemUsed: usedCapacity(memorySystemTotal, memorySystem),
    memoryJvm,
    memoryJvmTotal,
    memoryJvmUsed: usedCapacity(memoryJvmTotal, memoryJvm),
    memoryJvmNonHeapUsed,
    disk,
    diskTotal,
    diskUsed: usedCapacity(diskTotal, disk),
    tcpConnectionsEstablished,
    ...rates,
    systemPressure,
    jvmPressure,
    networkRisk,
    pressure: maxValue(usages),
    averagePressure: usages.length ? usages.reduce((total, usage) => total + usage, 0) / usages.length : 0,
    health: healthSummaries.get(nodeId) || { level: 'normal', evidence: [] },
  }
})

export const createRealtimeNodeNormalizer = () => {
  const calculateNetworkRates = createRealtimeNetworkRateCalculator()
  const calculateHealth = createNodeHealthCalculator()
  return (items: RealtimePayloadItem[]) => normalizeRealtimeNodes(
    items,
    calculateNetworkRates(items),
    calculateHealth(items as RealtimeHealthPayloadItem[]),
  )
}

export const defaultFocusedRealtimeNodes = (nodes: RealtimeNode[], limit = 5): string[] =>
  [...nodes]
    .sort((left, right) => (
      right.pressure - left.pressure
      || right.averagePressure - left.averagePressure
      || left.nodeId.localeCompare(right.nodeId)
    ))
    .slice(0, limit)
    .map(node => node.nodeId)

export const resolveFocusedRealtimeNodes = (
  nodes: RealtimeNode[],
  cachedNodes: string[] | undefined,
  limit = 5,
): string[] => {
  // 空缓存不能成为页面初始态；当前会话允许临时清空，但重新进入时应恢复值得关注的节点。
  if (!cachedNodes?.length) return defaultFocusedRealtimeNodes(nodes, limit)

  const available = new Set(nodes.map(node => node.nodeId))
  const retained = [...new Set(cachedNodes)].filter(nodeId => available.has(nodeId))
  return retained.length ? retained : defaultFocusedRealtimeNodes(nodes, limit)
}

const compareNumber = (left: number | undefined, right: number | undefined) => (left ?? -1) - (right ?? -1)

export const sortRealtimeNodes = (
  nodes: RealtimeNode[],
  key: RealtimeSortKey = 'pressure',
  order: RealtimeSortOrder = 'desc',
): RealtimeNode[] => [...nodes].sort((left, right) => {
  let result: number
  if (key === 'nodeId') result = left.nodeId.localeCompare(right.nodeId)
  else if (key === 'system') result = left.systemPressure - right.systemPressure
  else if (key === 'jvm') result = left.jvmPressure - right.jvmPressure
  else if (key === 'network') {
    const throughput = (node: RealtimeNode) => Math.max(
      node.networkReceiveBytesPerSecond ?? -1,
      node.networkSendBytesPerSecond ?? -1,
    )
    result = throughput(left) - throughput(right)
      || compareNumber(left.networkRisk, right.networkRisk)
      || compareNumber(left.tcpConnectionsEstablished, right.tcpConnectionsEstablished)
  } else result = compareNumber(left[key], right[key])
  return order === 'asc' ? result : -result
})

export const preserveRealtimeNodeOrder = (
  nodes: RealtimeNode[],
  currentOrder: string[],
): string[] => {
  const available = new Set(nodes.map(node => node.nodeId))
  const retained = currentOrder.filter(nodeId => available.has(nodeId))
  const retainedSet = new Set(retained)
  const appended = sortRealtimeNodes(
    nodes.filter(node => !retainedSet.has(node.nodeId)),
    'pressure',
    'desc',
  ).map(node => node.nodeId)
  return [...retained, ...appended]
}
