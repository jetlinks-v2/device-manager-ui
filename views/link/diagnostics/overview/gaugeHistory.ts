export interface GaugeSample { timestamp: number; value?: string }
export const gaugeWindowMs = 10 * 60 * 1000
const maxSamples = 256

/** Java long 的十进制文本保持精确；JSON 已损失精度的 number 不能成为证据。 */
export function gaugeCount(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value).toString()
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined
}

/** 只存真实页面观察，缺测保留断点；手动刷新也不能令窗口无限增长。 */
export function appendGaugeSample(history: readonly GaugeSample[] = [], timestamp: number, value?: string): GaugeSample[] {
  if (!Number.isFinite(timestamp)) return [...history]
  const sample = { timestamp, value: gaugeCount(value) }
  return [...history.filter(point => point.timestamp >= timestamp - gaugeWindowMs && point.timestamp <= timestamp), sample].slice(-maxSamples)
}

/** 暂停只追加缺测边界，避免恢复后的折线越过未观测区间。 */
export function interruptGaugeHistory(history: readonly GaugeSample[] = [], timestamp = Date.now()): GaugeSample[] {
  return history.length ? appendGaugeSample(history, timestamp) : []
}

/** 变化只比较最后一段连续有效观察，不跨失败、缺测和暂停推算。 */
export function gaugeObservation(history: readonly GaugeSample[]) {
  const last = history[history.length - 1], retained = [...history].reverse().find(point => point.value !== undefined)
  if (!last?.value) return { retained, collecting: true }
  const segment: GaugeSample[] = []
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].value === undefined) break
    segment.unshift(history[index])
  }
  const first = segment[0]
  return { retained, collecting: segment.length < 2, change: segment.length < 2 ? undefined : (BigInt(last.value) - BigInt(first.value!)).toString(), seconds: Math.max(0, Math.round((last.timestamp - first.timestamp) / 1000)) }
}

/** 仅图形几何按 BigInt 差值缩放；提示、当前值和变化始终使用原始精确计数。 */
export function gaugePlot(history: readonly GaugeSample[]) {
  const values = history.flatMap(point => point.value === undefined ? [] : [BigInt(point.value)])
  const minimum = values.reduce((left, right) => left < right ? left : right, values[0] ?? 0n)
  const maximum = values.reduce((left, right) => left > right ? left : right, minimum), span = maximum - minimum
  return history.map(point => [point.timestamp, point.value === undefined ? null : span === 0n ? 0.5 : Number((BigInt(point.value) - minimum) * 10000n / span) / 10000] as [number, number | null])
}
