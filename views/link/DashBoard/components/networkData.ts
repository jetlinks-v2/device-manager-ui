export interface NetworkSeriesValue {
  _data: unknown[]
}

export type NetworkSeriesMap = Record<string, NetworkSeriesValue>

export interface NetworkTooltipItem {
  axisValueLabel?: string
  marker?: string
  seriesName?: string
  value?: unknown
}

export interface NetworkTooltipLabels {
  up: string
  down: string
}

const numeric = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const formatNetworkSize = (value: unknown): string => {
  const bytes = numeric(value)
  if (bytes === undefined) return '--'

  const kb = 1024
  const mb = kb ** 2
  const gb = kb ** 3
  if (bytes >= gb) return `${Number((bytes / gb).toFixed(2))}G`
  if (bytes >= mb) return `${Number((bytes / mb).toFixed(2))}M`
  if (bytes >= kb) return `${Number((bytes / kb).toFixed(2))}KB`
  return `${bytes}B`
}

export const latestNetworkValue = (
  nodeId: string,
  series: NetworkSeriesMap,
): number | undefined => {
  const values = series[nodeId]?._data || []
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = numeric(values[index])
    if (value !== undefined) return value
  }
  return undefined
}

export const defaultFocusedNetworkNodes = (
  nodeIds: string[],
  series: NetworkSeriesMap,
  limit = 5,
): string[] => [...nodeIds]
  .sort((left, right) => (latestNetworkValue(right, series) ?? -1) - (latestNetworkValue(left, series) ?? -1))
  .slice(0, limit)

export const resolveAvailableNetworkNodes = (
  nodeIds: string[],
  selectedNodes: string[],
  defaultNodes: string[],
  series: NetworkSeriesMap,
  limit = 5,
): string[] => {
  const available = new Set(nodeIds)
  const retained = [...new Set(selectedNodes)].filter(nodeId => available.has(nodeId))
  if (retained.length) return retained

  const defaults = [...new Set(defaultNodes)].filter(nodeId => available.has(nodeId))
  return defaults.length ? defaults.slice(0, limit) : defaultFocusedNetworkNodes(nodeIds, series, limit)
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] || character)

interface NetworkTooltipRow {
  nodeId: string
  marker: string
  up?: number
  down?: number
}

export const renderNetworkTooltip = (
  items: NetworkTooltipItem[],
  labels: NetworkTooltipLabels = { up: '↑', down: '↓' },
): string => {
  // ECharts 按系列返回上下行数据，先按节点归并，避免同一节点在 Tooltip 中占两行。
  const rows = new Map<string, NetworkTooltipRow>()
  items.forEach((item) => {
    const value = numeric(item.value)
    if (value === undefined) return
    const match = /^(.*) · ([↑↓])$/.exec(item.seriesName || '')
    if (!match) return
    const [, nodeId, direction] = match
    const row = rows.get(nodeId) || { nodeId, marker: item.marker || '' }
    if (direction === '↑') row.up = value
    else row.down = value
    rows.set(nodeId, row)
  })

  if (!rows.size) return items[0]?.axisValueLabel || ''
  const sortedRows = [...rows.values()].sort((left, right) => {
    const pressure = (row: NetworkTooltipRow) => Math.max(row.up ?? -1, row.down ?? -1)
    return pressure(right) - pressure(left) || left.nodeId.localeCompare(right.nodeId)
  })
  const time = escapeHtml(items[0]?.axisValueLabel || '')
  const content = sortedRows.map(row => [
    '<div class="monitor-tooltip__row">',
    row.marker,
    `<span>${escapeHtml(row.nodeId)}</span>`,
    `<span><span class="monitor-tooltip__detail">${escapeHtml(labels.up)}</span> <span class="monitor-tooltip__value">${formatNetworkSize(row.up)}</span></span>`,
    `<span><span class="monitor-tooltip__detail">${escapeHtml(labels.down)}</span> <span class="monitor-tooltip__value">${formatNetworkSize(row.down)}</span></span>`,
    '</div>',
  ].join('')).join('')
  return `<div class="monitor-tooltip"><div class="monitor-tooltip__time">${time}</div>${content}</div>`
}
