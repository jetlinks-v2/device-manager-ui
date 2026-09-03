export type MonitorMetric = 'cpuSystem' | 'cpuJvm' | 'memoryJvm' | 'memorySystem'

export interface MonitorHistoryValue {
  timestamp?: number | string
  cpuSystemUsage?: number | string
  cpuJvmUsage?: number | string
  memoryJvmHeapFree?: number | string
  memoryJvmHeapTotal?: number | string
  memorySystemFree?: number | string
  memorySystemTotal?: number | string
}

export interface MonitorHistoryResponseItem {
  data?: {
    clusterNodeId?: string
    value?: MonitorHistoryValue | MonitorHistoryValue[]
  }
}

export interface MonitorPoint {
  timestamp: number
  percent: number
  used?: number
  total?: number
}

export interface MonitorNodeSeries {
  nodeId: string
  points: MonitorPoint[]
  latest?: MonitorPoint
}

export interface NodeSeriesVisual {
  lineStyle: {
    color: string
    width: number
    opacity: number
  }
  itemStyle: { color: string }
  emphasis: { disabled: true }
  z: number
}

const NODE_COLORS = [
  '#1677ff',
  '#13c2c2',
  '#52c41a',
  '#722ed1',
  '#fa8c16',
  '#2f54eb',
  '#fa541c',
  '#08979c',
  '#7cb305',
  '#d48806',
]

const numberValue = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const percentValue = (value: unknown): number | undefined => {
  const parsed = numberValue(value)
  return parsed === undefined ? undefined : Math.min(100, Math.max(0, parsed))
}

const memoryPoint = (
  value: MonitorHistoryValue,
  totalKey: 'memoryJvmHeapTotal' | 'memorySystemTotal',
  freeKey: 'memoryJvmHeapFree' | 'memorySystemFree',
): Omit<MonitorPoint, 'timestamp'> | undefined => {
  const total = numberValue(value[totalKey])
  const free = numberValue(value[freeKey])
  if (total === undefined || free === undefined || total <= 0) return undefined

  const used = Math.min(total, Math.max(0, total - free))
  return {
    percent: Number(((used / total) * 100).toFixed(2)),
    used,
    total,
  }
}

const toPoint = (metric: MonitorMetric, value: MonitorHistoryValue): MonitorPoint | undefined => {
  const rawTimestamp = numberValue(value.timestamp)
  if (rawTimestamp === undefined) return undefined
  // 集群节点采集通常相差数秒，归并到最近一分钟后才能在同一 Hover 中横向比较。
  const timestamp = Math.round(rawTimestamp / 60_000) * 60_000

  if (metric === 'memoryJvm') {
    const memory = memoryPoint(value, 'memoryJvmHeapTotal', 'memoryJvmHeapFree')
    return memory ? { timestamp, ...memory } : undefined
  }
  if (metric === 'memorySystem') {
    const memory = memoryPoint(value, 'memorySystemTotal', 'memorySystemFree')
    return memory ? { timestamp, ...memory } : undefined
  }

  const percent = percentValue(metric === 'cpuJvm' ? value.cpuJvmUsage : value.cpuSystemUsage)
  return percent === undefined ? undefined : { timestamp, percent }
}

/**
 * Normalizes the dashboard history response into one ordered series per node.
 * Some time-series backends return one value per item while grouped providers may return an array.
 */
export const normalizeMonitorHistory = (
  items: MonitorHistoryResponseItem[] | undefined,
  metric: MonitorMetric,
): MonitorNodeSeries[] => {
  const grouped = new Map<string, MonitorPoint[]>()

  ;(items || []).forEach((item) => {
    const nodeId = item.data?.clusterNodeId || 'undefined'
    const values = Array.isArray(item.data?.value) ? item.data?.value : [item.data?.value]
    values.filter(Boolean).forEach((value) => {
      const point = toPoint(metric, value as MonitorHistoryValue)
      if (!point) return
      const points = grouped.get(nodeId) || []
      points.push(point)
      grouped.set(nodeId, points)
    })
  })

  return [...grouped.entries()].map(([nodeId, points]) => {
    const byTimestamp = new Map(points.map(point => [point.timestamp, point]))
    const ordered = [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp)
    return { nodeId, points: ordered, latest: ordered[ordered.length - 1] }
  })
}

export const defaultFocusedNodes = (series: MonitorNodeSeries[], limit = 5): string[] =>
  [...series]
    .sort((left, right) => (right.latest?.percent ?? -1) - (left.latest?.percent ?? -1))
    .slice(0, limit)
    .map(item => item.nodeId)

export const nodeColor = (nodeId: string): string => {
  let hash = 0
  for (let index = 0; index < nodeId.length; index += 1) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(index)) | 0
  }
  // 转为无符号整数，确保同一节点名称跨列表顺序和图表生命周期始终映射到同一颜色。
  return NODE_COLORS[(hash >>> 0) % NODE_COLORS.length]
}

/** Keeps node colors and line appearance stable across every monitor chart. */
export const nodeSeriesVisual = (nodeId: string): NodeSeriesVisual => {
  const color = nodeColor(nodeId)

  return {
    lineStyle: { color, width: 1.5, opacity: 1 },
    itemStyle: { color },
    // 禁用 ECharts 内建 emphasis，确保图表自身 Hover 也不会留下加粗状态。
    emphasis: { disabled: true },
    z: 2,
  }
}

export const formatMemorySize = (megabytes?: number): string => {
  if (megabytes === undefined || !Number.isFinite(megabytes)) return '--'
  if (megabytes >= 1024) return `${Number((megabytes / 1024).toFixed(1))} GB`
  return `${Number(megabytes.toFixed(1))} MB`
}

export const sortMonitorTooltipItems = <T extends { data: readonly [unknown, number, ...unknown[]] }>(items: T[]): T[] =>
  [...items].sort((left, right) => right.data[1] - left.data[1])
