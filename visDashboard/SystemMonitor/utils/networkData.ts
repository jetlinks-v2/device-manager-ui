export type NetworkTrendMetric = 'traffic' | 'quality' | 'tcpRetransmission' | 'tcpConnections'
export type NetworkSeriesKind =
  | 'trafficUp'
  | 'trafficDown'
  | 'packetLoss'
  | 'interfaceErrors'
  | 'tcpRetransmission'
  | 'tcpConnections'

export interface NetworkSeriesValue {
  _data: unknown[]
}

export type NetworkSeriesMap = Record<string, NetworkSeriesValue>
export type NetworkSeriesByKind = Record<NetworkSeriesKind, NetworkSeriesMap>

export interface NetworkTooltipItem {
  axisValueLabel?: string
  marker?: string
  seriesName?: string
  value?: unknown
  data?: unknown
}

export interface TrafficHistoryResult {
  times: string[]
  nodes: string[]
  series: Pick<NetworkSeriesByKind, 'trafficUp' | 'trafficDown'>
}

export interface SystemNetworkHistoryValue {
  timestamp?: unknown
  networkInterfaceMetricsAvailable?: unknown
  networkReceivedPackets?: unknown
  networkSentPackets?: unknown
  networkReceiveErrors?: unknown
  networkSendErrors?: unknown
  networkReceiveDrops?: unknown
  networkTcpMetricsAvailable?: unknown
  networkTcpConnectionsEstablished?: unknown
  networkTcpSegmentsSent?: unknown
  networkTcpSegmentsRetransmitted?: unknown
}

export interface NetworkHistoryResponseItem {
  group?: string
  data?: {
    clusterNodeId?: string
    value?: unknown
  }
}

const numeric = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const isAvailable = (value: unknown): boolean => value === true || value === 'true' || value === 1

const pointValue = (value: unknown): number | undefined => {
  if (Array.isArray(value)) return numeric(value[1])
  return numeric(value)
}

export const formatNetworkSize = (value: unknown): string => {
  const bytes = pointValue(value)
  if (bytes === undefined) return '--'

  const kb = 1024
  const mb = kb ** 2
  const gb = kb ** 3
  if (bytes >= gb) return `${Number((bytes / gb).toFixed(2))}G`
  if (bytes >= mb) return `${Number((bytes / mb).toFixed(2))}M`
  if (bytes >= kb) return `${Number((bytes / kb).toFixed(2))}KB`
  return `${bytes}B`
}

export const formatNetworkPercent = (value: unknown): string => {
  const percent = pointValue(value)
  return percent === undefined ? '--' : `${Number(percent.toFixed(2))}%`
}

export const formatNetworkCount = (value: unknown): string => {
  const count = pointValue(value)
  return count === undefined ? '--' : Math.round(count).toLocaleString()
}

export const latestNetworkValue = (
  nodeId: string,
  series: NetworkSeriesMap,
): number | undefined => {
  const values = series[nodeId]?._data || []
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = pointValue(values[index])
    if (value !== undefined) return value
  }
  return undefined
}

export const normalizeTrafficHistory = (items: NetworkHistoryResponseItem[] | undefined): TrafficHistoryResult => {
  const timestamps = new Map<string, number>()
  const raw: Record<'trafficUp' | 'trafficDown', Record<string, Record<string, unknown>>> = {
    trafficUp: {},
    trafficDown: {},
  }

  ;(items || []).forEach((item) => {
    const kind = item.group === 'bytesRead'
      ? 'trafficUp'
      : item.group === 'bytesSent' ? 'trafficDown' : undefined
    const nodeId = item.data?.clusterNodeId
    if (!kind || !nodeId || !Array.isArray(item.data?.value)) return
    raw[kind][nodeId] ||= {}
    item.data.value.forEach((point) => {
      if (!point || typeof point !== 'object') return
      const value = point as Record<string, unknown>
      const time = String(value.timeString || '')
      const timestamp = numeric(value.timestamp)
      if (!time || timestamp === undefined) return
      raw[kind][nodeId][time] = value.value
      timestamps.set(time, timestamp)
    })
  })

  const times = [...timestamps.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(item => item[0])
  const nodes = [...new Set(Object.values(raw).flatMap(group => Object.keys(group)))]
  const series = Object.fromEntries((['trafficUp', 'trafficDown'] as const).map(kind => [kind,
    Object.fromEntries(nodes.map(nodeId => [nodeId, {
      _data: times.map(time => raw[kind][nodeId]?.[time] ?? null),
    }]))])) as TrafficHistoryResult['series']

  return { times, nodes, series }
}

const deltaRatio = (
  previous: SystemNetworkHistoryValue,
  current: SystemNetworkHistoryValue,
  numeratorKeys: Array<keyof SystemNetworkHistoryValue>,
  denominatorKeys: Array<keyof SystemNetworkHistoryValue>,
): number | undefined => {
  const keys = [...new Set([...numeratorKeys, ...denominatorKeys])]
  const deltas = new Map<keyof SystemNetworkHistoryValue, number>()
  for (const key of keys) {
    const before = numeric(previous[key])
    const after = numeric(current[key])
    if (before === undefined || after === undefined || after < before) return undefined
    deltas.set(key, after - before)
  }
  const denominator = denominatorKeys.reduce((sum, key) => sum + (deltas.get(key) || 0), 0)
  if (denominator <= 0) return undefined
  const numerator = numeratorKeys.reduce((sum, key) => sum + (deltas.get(key) || 0), 0)
  return Number(((numerator / denominator) * 100).toFixed(4))
}

const emptySystemSeries = (): Pick<NetworkSeriesByKind,
  'packetLoss' | 'interfaceErrors' | 'tcpRetransmission' | 'tcpConnections'> => ({
  packetLoss: {},
  interfaceErrors: {},
  tcpRetransmission: {},
  tcpConnections: {},
})

export const normalizeSystemNetworkHistory = (items: NetworkHistoryResponseItem[] | undefined) => {
  const grouped = new Map<string, SystemNetworkHistoryValue[]>()
  ;(items || []).forEach((item) => {
    const nodeId = item.data?.clusterNodeId
    if (!nodeId) return
    const values = Array.isArray(item.data?.value) ? item.data.value : [item.data?.value]
    values.forEach((value) => {
      if (!value || typeof value !== 'object') return
      const records = grouped.get(nodeId) || []
      records.push(value as SystemNetworkHistoryValue)
      grouped.set(nodeId, records)
    })
  })

  const series = emptySystemSeries()
  grouped.forEach((values, nodeId) => {
    const ordered = values
      .filter(value => numeric(value.timestamp) !== undefined)
      .sort((left, right) => numeric(left.timestamp)! - numeric(right.timestamp)!)
    const points = {
      packetLoss: new Map<number, number | null>(),
      interfaceErrors: new Map<number, number | null>(),
      tcpRetransmission: new Map<number, number | null>(),
      tcpConnections: new Map<number, number | null>(),
    }

    ordered.forEach((current, index) => {
      const rawTimestamp = numeric(current.timestamp)!
      const timestamp = Math.round(rawTimestamp / 60_000) * 60_000
      const previous = ordered[index - 1]
      const timeAdvanced = Boolean(previous && rawTimestamp > numeric(previous.timestamp)!)
      const interfaceAvailable = Boolean(previous && timeAdvanced
        && isAvailable(current.networkInterfaceMetricsAvailable)
        && isAvailable(previous.networkInterfaceMetricsAvailable))
      const tcpAvailable = isAvailable(current.networkTcpMetricsAvailable)
      const previousTcpAvailable = Boolean(previous && timeAdvanced
        && isAvailable(previous.networkTcpMetricsAvailable))

      // Counter 派生仅接受同一节点相邻的完整快照，首点、回退和能力不可用都保留为图表断点。
      points.packetLoss.set(timestamp, interfaceAvailable
        ? deltaRatio(previous!, current, ['networkReceiveDrops'], ['networkReceivedPackets', 'networkReceiveDrops']) ?? null
        : null)
      points.interfaceErrors.set(timestamp, interfaceAvailable
        ? deltaRatio(previous!, current,
          ['networkReceiveErrors', 'networkSendErrors'],
          ['networkReceivedPackets', 'networkSentPackets']) ?? null
        : null)
      points.tcpRetransmission.set(timestamp, tcpAvailable && previousTcpAvailable
        ? deltaRatio(previous!, current, ['networkTcpSegmentsRetransmitted'], ['networkTcpSegmentsSent']) ?? null
        : null)
      points.tcpConnections.set(timestamp, tcpAvailable
        ? numeric(current.networkTcpConnectionsEstablished) ?? null
        : null)
    })

    ;(Object.keys(points) as Array<keyof typeof points>).forEach((kind) => {
      series[kind][nodeId] = { _data: [...points[kind].entries()] }
    })
  })

  return { nodes: [...grouped.keys()], series }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] || character)

interface TooltipRow {
  nodeId: string
  marker: string
  values: Record<string, number>
}

export const renderNetworkMetricTooltip = (
  items: NetworkTooltipItem[],
  kinds: string[],
  labels: Record<string, string>,
  formatter: (value: unknown) => string,
): string => {
  const rows = new Map<string, TooltipRow>()
  items.forEach((item) => {
    const value = pointValue(item.value ?? item.data)
    if (value === undefined) return
    const match = /^(.*) · ([^·]+)$/.exec(item.seriesName || '')
    if (!match) return
    const [, nodeId, kind] = match
    const row = rows.get(nodeId) || { nodeId, marker: item.marker || '', values: {} }
    row.values[kind] = value
    rows.set(nodeId, row)
  })

  if (!rows.size) return escapeHtml(items[0]?.axisValueLabel || '')
  const sortedRows = [...rows.values()].sort((left, right) => {
    const pressure = (row: TooltipRow) => Math.max(...kinds.map(kind => row.values[kind] ?? -1))
    return pressure(right) - pressure(left) || left.nodeId.localeCompare(right.nodeId)
  })
  const time = escapeHtml(items[0]?.axisValueLabel || '')
  const content = sortedRows.map(row => [
    '<div class="monitor-tooltip__row">',
    row.marker,
    `<span>${escapeHtml(row.nodeId)}</span>`,
    ...kinds.map(kind => `<span><span class="monitor-tooltip__detail">${escapeHtml(labels[kind] || '')}</span> <span class="monitor-tooltip__value">${formatter(row.values[kind])}</span></span>`),
    '</div>',
  ].join('')).join('')
  return `<div class="monitor-tooltip"><div class="monitor-tooltip__time">${time}</div>${content}</div>`
}
