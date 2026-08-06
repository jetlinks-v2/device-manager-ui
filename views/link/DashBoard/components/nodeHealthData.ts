export type NodeHealthLevel = 'normal' | 'warning' | 'critical' | 'unavailable'

export type NodeHealthSignal =
  | 'cpuIoWait' | 'cpuSteal' | 'cpuThrottled' | 'cpuTemperature' | 'cpuThermalThrottle'
  | 'diskCapacity' | 'diskInodes' | 'diskIoBusy' | 'diskQueue' | 'diskDevice' | 'diskIoError' | 'diskHealth'
  | 'networkLink' | 'networkErrors' | 'tcpRetransmit' | 'tcpFailures' | 'networkKernelDrops'
  | 'conntrackUsage' | 'conntrackDrops' | 'socketOrphans'

export interface NodeHealthEvidence {
  signal: NodeHealthSignal
  level: Exclude<NodeHealthLevel, 'normal' | 'unavailable'>
  values: Array<number | string>
}

export interface NodeHealthSummary {
  level: NodeHealthLevel
  evidence: NodeHealthEvidence[]
}

type NumericValue = number | string

export interface RealtimeCpuHealthPayload {
  sampleTime?: NumericValue
  userTicks?: NumericValue
  niceTicks?: NumericValue
  systemTicks?: NumericValue
  idleTicks?: NumericValue
  ioWaitTicks?: NumericValue
  irqTicks?: NumericValue
  softIrqTicks?: NumericValue
  stealTicks?: NumericValue
  cpuTemperatureAvailable?: boolean
  cpuTemperatureCelsius?: NumericValue
  cpuCriticalTemperatureAvailable?: boolean
  cpuCriticalTemperatureCelsius?: NumericValue
  thermalThrottleMetricsAvailable?: boolean
  packageThermalThrottleCount?: NumericValue
  coreThermalThrottleCount?: NumericValue
  cgroupMetricsAvailable?: boolean
  cgroupPeriods?: NumericValue
  cgroupThrottledPeriods?: NumericValue
}

interface DiskHealthPayload {
  available?: boolean
  warningDeviceCount?: NumericValue
  failedDeviceCount?: NumericValue
  score?: NumericValue
  nvmeCriticalWarning?: NumericValue
}

export interface RealtimeDiskHealthPayload {
  sampleTime?: NumericValue
  fileSystemMetricsAvailable?: boolean
  usage?: NumericValue
  inodeMetricsAvailable?: boolean
  totalInodes?: NumericValue
  freeInodes?: NumericValue
  ioMetricsAvailable?: boolean
  deviceCount?: NumericValue
  currentQueueLength?: NumericValue
  transferTimeMillis?: NumericValue
  blockDeviceStateMetricsAvailable?: boolean
  blockDeviceNotRunningCount?: NumericValue
  blockDeviceIoErrorMetricsAvailable?: boolean
  blockDeviceIoErrors?: NumericValue
  health?: DiskHealthPayload
}

export interface RealtimeNetworkHealthPayload {
  sampleTime?: NumericValue
  diagnosticSampleTime?: NumericValue
  interfaceMetricsAvailable?: boolean
  linkSpeedBitsPerSecond?: NumericValue
  receivedBytes?: NumericValue
  sentBytes?: NumericValue
  receivedPackets?: NumericValue
  sentPackets?: NumericValue
  receiveErrors?: NumericValue
  sendErrors?: NumericValue
  receiveDrops?: NumericValue
  tcpMetricsAvailable?: boolean
  tcpConnectionsActive?: NumericValue
  tcpConnectionsPassive?: NumericValue
  tcpConnectionFailures?: NumericValue
  tcpSegmentsSent?: NumericValue
  tcpSegmentsRetransmitted?: NumericValue
  tcpExtendedMetricsAvailable?: boolean
  tcpListenOverflows?: NumericValue
  tcpListenDrops?: NumericValue
  tcpBacklogDrops?: NumericValue
  tcpReceiveQueueDrops?: NumericValue
  softnetMetricsAvailable?: boolean
  softnetProcessed?: NumericValue
  softnetDropped?: NumericValue
  socketMetricsAvailable?: boolean
  tcpSocketsInUse?: NumericValue
  tcpSocketsOrphan?: NumericValue
  conntrackMetricsAvailable?: boolean
  conntrackCurrent?: NumericValue
  conntrackMax?: NumericValue
  conntrackDrops?: NumericValue
}

export interface RealtimeHealthPayloadItem {
  clusterNodeId?: string
  value?: {
    cpu?: RealtimeCpuHealthPayload
    disk?: RealtimeDiskHealthPayload
    network?: RealtimeNetworkHealthPayload
  }
}

export const NODE_HEALTH_THRESHOLDS = {
  cpuIoWait: [10, 25],
  cpuSteal: [5, 10],
  cpuThrottled: [5, 20],
  cpuTemperature: [80, 90],
  cpuTemperaturePressure: [80, 95],
  diskCapacity: [80, 90],
  diskInodes: [80, 90],
  diskIoBusy: [80, 95],
  diskQueuePerDevice: [1, 2],
  networkLink: [80, 95],
  networkErrors: [1, 5],
  tcpRetransmit: [5, 15],
  tcpFailures: [5, 20],
  conntrackUsage: [80, 90],
  socketOrphans: [5, 15],
} as const

interface HealthSnapshot {
  cpu?: RealtimeCpuHealthPayload
  disk?: RealtimeDiskHealthPayload
  network?: RealtimeNetworkHealthPayload
}

interface HealthState {
  snapshot: HealthSnapshot
  cpuEvidence: NodeHealthEvidence[]
  diskEvidence: NodeHealthEvidence[]
  networkEvidence: NodeHealthEvidence[]
}

const numeric = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const result = Number(value)
  return Number.isFinite(result) ? result : undefined
}
const rounded = (value: number) => Number(value.toFixed(1))
const levelFor = (value: number, thresholds: readonly [number, number]) =>
  value >= thresholds[1] ? 'critical' as const : value >= thresholds[0] ? 'warning' as const : undefined
const evidence = (
  signal: NodeHealthSignal,
  level: NodeHealthEvidence['level'] | undefined,
  ...values: Array<number | string>
): NodeHealthEvidence[] => level ? [{ signal, level, values }] : []
const delta = (current: unknown, previous: unknown): number | undefined => {
  const currentValue = numeric(current)
  const previousValue = numeric(previous)
  if (currentValue === undefined || previousValue === undefined || currentValue < previousValue) return undefined
  return currentValue - previousValue
}
const sumDeltas = (current: object, previous: object, keys: readonly string[]) => {
  const values = keys.map(key => delta(
    (current as Record<string, unknown>)[key],
    (previous as Record<string, unknown>)[key],
  ))
  return values.some(value => value === undefined) ? undefined : values.reduce((sum, value) => sum + value!, 0)
}
const validElapsed = (current: unknown, previous: unknown) => {
  const currentTime = numeric(current)
  const previousTime = numeric(previous)
  return currentTime !== undefined && previousTime !== undefined && currentTime > previousTime
    ? currentTime - previousTime
    : undefined
}
const percentOf = (part: number | undefined, total: number | undefined) =>
  part !== undefined && total !== undefined && total > 0 ? part / total * 100 : undefined

const directEvidence = (snapshot: HealthSnapshot): NodeHealthEvidence[] => {
  const result: NodeHealthEvidence[] = []
  const cpu = snapshot.cpu
  if (cpu?.cpuTemperatureAvailable === true) {
    const temperature = numeric(cpu.cpuTemperatureCelsius)
    const critical = cpu.cpuCriticalTemperatureAvailable === true
      ? numeric(cpu.cpuCriticalTemperatureCelsius)
      : undefined
    if (temperature !== undefined) {
      const pressure = critical && critical > 0 ? temperature / critical * 100 : undefined
      const level = pressure === undefined
        ? levelFor(temperature, NODE_HEALTH_THRESHOLDS.cpuTemperature)
        : levelFor(pressure, NODE_HEALTH_THRESHOLDS.cpuTemperaturePressure)
      const threshold = level === 'critical'
        ? (critical && critical > 0 ? critical * NODE_HEALTH_THRESHOLDS.cpuTemperaturePressure[1] / 100 : NODE_HEALTH_THRESHOLDS.cpuTemperature[1])
        : (critical && critical > 0 ? critical * NODE_HEALTH_THRESHOLDS.cpuTemperaturePressure[0] / 100 : NODE_HEALTH_THRESHOLDS.cpuTemperature[0])
      result.push(...evidence('cpuTemperature', level, rounded(temperature), rounded(threshold)))
    }
  }

  const disk = snapshot.disk
  if (disk?.fileSystemMetricsAvailable === true) {
    const usage = numeric(disk.usage)
    if (usage !== undefined) result.push(...evidence('diskCapacity', levelFor(usage, NODE_HEALTH_THRESHOLDS.diskCapacity), rounded(usage)))
  }
  if (disk?.inodeMetricsAvailable === true) {
    const total = numeric(disk.totalInodes)
    const free = numeric(disk.freeInodes)
    const usage = total && free !== undefined ? Math.max(0, (total - free) / total * 100) : undefined
    if (usage !== undefined) result.push(...evidence('diskInodes', levelFor(usage, NODE_HEALTH_THRESHOLDS.diskInodes), rounded(usage)))
  }
  if (disk?.ioMetricsAvailable === true) {
    const devices = numeric(disk.deviceCount)
    const queue = numeric(disk.currentQueueLength)
    const pressure = devices && queue !== undefined ? queue / devices : undefined
    if (pressure !== undefined) result.push(...evidence('diskQueue', levelFor(pressure, NODE_HEALTH_THRESHOLDS.diskQueuePerDevice), rounded(pressure)))
  }
  if (disk?.blockDeviceStateMetricsAvailable === true) {
    const count = numeric(disk.blockDeviceNotRunningCount) || 0
    if (count > 0) result.push(...evidence('diskDevice', 'critical', count))
  }
  if (disk?.health?.available === true) {
    const failed = numeric(disk.health.failedDeviceCount) || 0
    const warning = numeric(disk.health.warningDeviceCount) || 0
    const score = numeric(disk.health.score)
    const nvmeWarning = numeric(disk.health.nvmeCriticalWarning) || 0
    if (failed > 0 || nvmeWarning > 0 || score === 0) result.push(...evidence('diskHealth', 'critical', failed, score ?? '--'))
    else if (warning > 0 || (score !== undefined && score > 0 && score < 100)) result.push(...evidence('diskHealth', 'warning', warning, score ?? '--'))
  }

  const network = snapshot.network
  if (network?.conntrackMetricsAvailable === true) {
    const usage = percentOf(numeric(network.conntrackCurrent), numeric(network.conntrackMax))
    if (usage !== undefined) result.push(...evidence('conntrackUsage', levelFor(usage, NODE_HEALTH_THRESHOLDS.conntrackUsage), rounded(usage)))
  }
  if (network?.socketMetricsAvailable === true) {
    const ratio = percentOf(numeric(network.tcpSocketsOrphan), numeric(network.tcpSocketsInUse))
    if (ratio !== undefined) result.push(...evidence('socketOrphans', levelFor(ratio, NODE_HEALTH_THRESHOLDS.socketOrphans), rounded(ratio)))
  }
  return result
}

const deriveCpuEvidence = (current?: RealtimeCpuHealthPayload, previous?: RealtimeCpuHealthPayload) => {
  if (!current || !previous || !validElapsed(current.sampleTime, previous.sampleTime)) return []
  const keys = ['userTicks', 'niceTicks', 'systemTicks', 'idleTicks', 'ioWaitTicks', 'irqTicks', 'softIrqTicks', 'stealTicks'] as const
  const deltas = keys.map(key => delta(current[key], previous[key]))
  if (deltas.some(value => value === undefined)) return []
  const total = deltas.reduce((sum, value) => sum + value!, 0)
  const ioWait = percentOf(deltas[4], total)
  const steal = percentOf(deltas[7], total)
  const result = [
    ...(ioWait === undefined ? [] : evidence('cpuIoWait', levelFor(ioWait, NODE_HEALTH_THRESHOLDS.cpuIoWait), rounded(ioWait))),
    ...(steal === undefined ? [] : evidence('cpuSteal', levelFor(steal, NODE_HEALTH_THRESHOLDS.cpuSteal), rounded(steal))),
  ]
  if (current.cgroupMetricsAvailable === true && previous.cgroupMetricsAvailable === true) {
    const throttled = percentOf(delta(current.cgroupThrottledPeriods, previous.cgroupThrottledPeriods), delta(current.cgroupPeriods, previous.cgroupPeriods))
    if (throttled !== undefined) result.push(...evidence('cpuThrottled', levelFor(throttled, NODE_HEALTH_THRESHOLDS.cpuThrottled), rounded(throttled)))
  }
  if (current.thermalThrottleMetricsAvailable === true && previous.thermalThrottleMetricsAvailable === true) {
    const packageDelta = delta(current.packageThermalThrottleCount, previous.packageThermalThrottleCount)
    const coreDelta = delta(current.coreThermalThrottleCount, previous.coreThermalThrottleCount)
    if (packageDelta !== undefined && coreDelta !== undefined && packageDelta + coreDelta > 0) {
      result.push(...evidence('cpuThermalThrottle', 'warning', packageDelta + coreDelta))
    }
  }
  return result
}

const deriveDiskEvidence = (current?: RealtimeDiskHealthPayload, previous?: RealtimeDiskHealthPayload) => {
  if (!current || !previous || current.ioMetricsAvailable !== true || previous.ioMetricsAvailable !== true) return []
  const elapsed = validElapsed(current.sampleTime, previous.sampleTime)
  if (!elapsed) return []
  const busyDelta = delta(current.transferTimeMillis, previous.transferTimeMillis)
  const devices = numeric(current.deviceCount)
  const utilization = busyDelta !== undefined && devices && devices > 0 ? busyDelta / (elapsed * devices) * 100 : undefined
  const result = utilization === undefined ? [] : evidence('diskIoBusy', levelFor(utilization, NODE_HEALTH_THRESHOLDS.diskIoBusy), rounded(utilization))
  if (current.blockDeviceIoErrorMetricsAvailable === true && previous.blockDeviceIoErrorMetricsAvailable === true) {
    const errors = delta(current.blockDeviceIoErrors, previous.blockDeviceIoErrors)
    if (errors !== undefined && errors > 0) result.push(...evidence('diskIoError', 'critical', errors))
  }
  return result
}

const deriveNetworkEvidence = (current?: RealtimeNetworkHealthPayload, previous?: RealtimeNetworkHealthPayload) => {
  if (!current || !previous) return []
  const result: NodeHealthEvidence[] = []
  const elapsed = validElapsed(current.sampleTime, previous.sampleTime)
  if (elapsed && current.interfaceMetricsAvailable === true && previous.interfaceMetricsAvailable === true) {
    const receivedBytes = delta(current.receivedBytes, previous.receivedBytes)
    const sentBytes = delta(current.sentBytes, previous.sentBytes)
    const speed = numeric(current.linkSpeedBitsPerSecond)
    if (receivedBytes !== undefined && sentBytes !== undefined && speed && speed > 0) {
      const utilization = Math.max(receivedBytes, sentBytes) * 8 / (elapsed / 1000) / speed * 100
      result.push(...evidence('networkLink', levelFor(utilization, NODE_HEALTH_THRESHOLDS.networkLink), rounded(utilization)))
    }
    const packets = sumDeltas(current, previous, ['receivedPackets', 'sentPackets'])
    const errors = sumDeltas(current, previous, ['receiveErrors', 'sendErrors', 'receiveDrops'])
    const errorRate = packets !== undefined && errors !== undefined ? percentOf(errors, packets + errors) : undefined
    if (errorRate !== undefined) result.push(...evidence('networkErrors', levelFor(errorRate, NODE_HEALTH_THRESHOLDS.networkErrors), rounded(errorRate)))
  }

  const diagnosticElapsed = validElapsed(current.diagnosticSampleTime, previous.diagnosticSampleTime)
  if (!diagnosticElapsed) return result
  if (current.tcpMetricsAvailable === true && previous.tcpMetricsAvailable === true) {
    const retransmit = percentOf(delta(current.tcpSegmentsRetransmitted, previous.tcpSegmentsRetransmitted), delta(current.tcpSegmentsSent, previous.tcpSegmentsSent))
    if (retransmit !== undefined) result.push(...evidence('tcpRetransmit', levelFor(retransmit, NODE_HEALTH_THRESHOLDS.tcpRetransmit), rounded(retransmit)))
    const attempts = sumDeltas(current, previous, ['tcpConnectionsActive', 'tcpConnectionsPassive'])
    const failures = delta(current.tcpConnectionFailures, previous.tcpConnectionFailures)
    const failureRate = attempts !== undefined && failures !== undefined ? percentOf(failures, attempts + failures) : undefined
    if (failureRate !== undefined) result.push(...evidence('tcpFailures', levelFor(failureRate, NODE_HEALTH_THRESHOLDS.tcpFailures), rounded(failureRate)))
  }
  if (current.tcpExtendedMetricsAvailable === true && previous.tcpExtendedMetricsAvailable === true) {
    const keys = ['tcpListenOverflows', 'tcpListenDrops', 'tcpBacklogDrops', 'tcpReceiveQueueDrops'] as const
    const drops = keys.map(key => delta(current[key], previous[key]))
    if (drops.every(value => value !== undefined)) {
      const total = drops.reduce((sum, value) => sum + value!, 0)
      if (total > 0) result.push(...evidence('networkKernelDrops', total >= 10 ? 'critical' : 'warning', total))
    }
  }
  if (current.softnetMetricsAvailable === true && previous.softnetMetricsAvailable === true) {
    const dropped = delta(current.softnetDropped, previous.softnetDropped)
    if (dropped && dropped > 0) result.push(...evidence('networkKernelDrops', dropped >= 10 ? 'critical' : 'warning', dropped))
  }
  if (current.conntrackMetricsAvailable === true && previous.conntrackMetricsAvailable === true) {
    const drops = delta(current.conntrackDrops, previous.conntrackDrops)
    if (drops && drops > 0) result.push(...evidence('conntrackDrops', 'critical', drops))
  }
  return result
}

const levelOf = (items: NodeHealthEvidence[]): NodeHealthLevel => items.some(item => item.level === 'critical')
  ? 'critical'
  : items.length ? 'warning' : 'normal'

/**
 * Keeps node-local adjacent snapshots. An unchanged timestamp retains the last counter conclusion, while
 * time rollback, counter rollback, metric unavailability, or a departed node clears that conclusion.
 */
export const createNodeHealthCalculator = () => {
  let states = new Map<string, HealthState>()
  return (items: RealtimeHealthPayloadItem[]): Map<string, NodeHealthSummary> => {
    const nextStates = new Map<string, HealthState>()
    const summaries = new Map<string, NodeHealthSummary>()
    items.forEach((item) => {
      const nodeId = item.clusterNodeId || '--'
      const snapshot: HealthSnapshot = item.value || {}
      const previous = states.get(nodeId)
      const sameCpuTime = numeric(snapshot.cpu?.sampleTime) === numeric(previous?.snapshot.cpu?.sampleTime)
        && snapshot.cpu?.cgroupMetricsAvailable === previous?.snapshot.cpu?.cgroupMetricsAvailable
        && snapshot.cpu?.thermalThrottleMetricsAvailable === previous?.snapshot.cpu?.thermalThrottleMetricsAvailable
      const sameDiskTime = numeric(snapshot.disk?.sampleTime) === numeric(previous?.snapshot.disk?.sampleTime)
        && snapshot.disk?.ioMetricsAvailable === previous?.snapshot.disk?.ioMetricsAvailable
        && snapshot.disk?.blockDeviceIoErrorMetricsAvailable === previous?.snapshot.disk?.blockDeviceIoErrorMetricsAvailable
      const sameNetworkTimes = numeric(snapshot.network?.sampleTime) === numeric(previous?.snapshot.network?.sampleTime)
        && numeric(snapshot.network?.diagnosticSampleTime) === numeric(previous?.snapshot.network?.diagnosticSampleTime)
        && snapshot.network?.interfaceMetricsAvailable === previous?.snapshot.network?.interfaceMetricsAvailable
        && snapshot.network?.tcpMetricsAvailable === previous?.snapshot.network?.tcpMetricsAvailable
        && snapshot.network?.tcpExtendedMetricsAvailable === previous?.snapshot.network?.tcpExtendedMetricsAvailable
        && snapshot.network?.softnetMetricsAvailable === previous?.snapshot.network?.softnetMetricsAvailable
        && snapshot.network?.conntrackMetricsAvailable === previous?.snapshot.network?.conntrackMetricsAvailable
      const cpuEvidence = previous && sameCpuTime ? previous.cpuEvidence : deriveCpuEvidence(snapshot.cpu, previous?.snapshot.cpu)
      const diskEvidence = previous && sameDiskTime ? previous.diskEvidence : deriveDiskEvidence(snapshot.disk, previous?.snapshot.disk)
      const networkEvidence = previous && sameNetworkTimes ? previous.networkEvidence : deriveNetworkEvidence(snapshot.network, previous?.snapshot.network)
      const allEvidence = [...directEvidence(snapshot), ...cpuEvidence, ...diskEvidence, ...networkEvidence]
      const state = { snapshot, cpuEvidence, diskEvidence, networkEvidence }
      nextStates.set(nodeId, state)
      summaries.set(nodeId, { level: levelOf(allEvidence), evidence: allEvidence })
    })
    states = nextStates
    return summaries
  }
}
