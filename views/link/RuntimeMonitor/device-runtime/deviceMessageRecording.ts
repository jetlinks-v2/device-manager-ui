import type { MBeanDescriptor } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { gaugeCount } from '../../diagnostics/overview/gaugeHistory'

export const recordingMetrics = ['Communication', 'ReceivedPackets', 'SentPackets', 'UpstreamMessages', 'PropertyReports', 'PropertyValues', 'EventReports', 'ReceivedBytes', 'SentBytes'] as const
export type RecordingMetric = typeof recordingMetrics[number]
export interface DeviceSecond { sequence: number; timestamp: number; values: Record<RecordingMetric, number> }
export interface DevicePeak { metric: RecordingMetric; value: number; timestamp: number; sequence: number }
export interface DeviceRecording {
  generation: string; statisticsStartTime: number; sampledAt: number; zoneId: string; todayStartTime: number
  firstSequence: number; endSequence: number; hourPeaks: DevicePeak[]; todayPeaks: DevicePeak[]; points: DeviceSecond[]
}
export interface DevicePeakSelection { peak: DevicePeak; scope: 'hour' | 'today' }
export interface DeviceRecordingView {
  data?: DeviceRecording; points: DeviceSecond[]; state: 'loading' | 'ready' | 'stale' | 'error' | 'unsupported'
  busy: boolean; active: boolean; focus?: DevicePeakSelection; outside?: boolean
}
const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const integer = (value: unknown) => { const text = gaugeCount(value), number = text === undefined ? NaN : Number(text); return Number.isSafeInteger(number) && number >= 0 ? number : undefined }
const positive = (value: unknown) => { const number = integer(value); return number !== undefined && number > 0 ? number : undefined }
function required(value: number | undefined): number { if (value === undefined) throw new Error('Invalid device history number'); return value }

/** 标准 TabularData 经平台转换为索引对象；只读取行本身的身份，拒绝重复或未知指标。 */
function peaks(value: unknown): DevicePeak[] {
  const rows = object(value)
  if (!rows || Object.keys(rows).length > recordingMetrics.length) throw new Error('Invalid device peaks')
  const seen = new Set<string>()
  return Object.values(rows).map(raw => {
    const row = object(raw), metric = row?.Metric
    if (typeof metric !== 'string' || !recordingMetrics.includes(metric as RecordingMetric) || seen.has(metric) || typeof row?.Value !== 'number' || !Number.isFinite(row.Value) || row.Value < 0) throw new Error('Invalid device peak')
    seen.add(metric)
    return { metric: metric as RecordingMetric, value: row.Value, timestamp: required(positive(row.Time)), sequence: required(integer(row.Sequence)) }
  })
}

/** 沿用精确能力身份和 available 证据；旧节点缺少新属性时保持原实时曲线。 */
export function readDeviceRecording(bean: MBeanDescriptor | undefined, hour = false): DeviceRecording | undefined {
  if (!bean || bean.domain !== 'org.jetlinks' || bean.type !== 'DeviceMessageMonitor' || bean.name !== 'DeviceMessageMonitor') return undefined
  const attribute = bean.attributes.find(item => item.name === 'HistorySummary')
  if (!attribute) return undefined
  const source = object(attribute.available ? attribute.value : undefined)
  const history = bean.attributes.find(item => item.name === (hour ? 'HourHistory' : 'RecentHistory'))
  const data = object(history?.available ? history.value : undefined)
  const rows = object(data?.Points), generation = gaugeCount(source?.StartTime)
  if (!source || !data || !rows || !generation || gaugeCount(data.StartTime) !== generation || data.StatisticsStartTime !== source.StatisticsStartTime || source.WindowMillis !== 1000 || data.WindowMillis !== 1000 || Object.keys(rows).length > (hour ? 3600 : 60)) throw new Error('Invalid device recording')
  const firstSequence = required(integer(source.FirstSequence)), endSequence = required(integer(source.EndSequence))
  const historyFirst = required(integer(data.FirstSequence)), historyEnd = required(integer(data.EndSequence))
  if (endSequence < firstSequence || historyEnd < historyFirst || historyFirst !== firstSequence || typeof source.ZoneId !== 'string') throw new Error('Invalid device recording coverage')
  try { new Intl.DateTimeFormat('en', { timeZone: source.ZoneId }).format(0) } catch { throw new Error('Invalid device recording zone') }
  const seen = new Set<number>()
  const points = Object.values(rows).map(raw => {
    const row = object(raw), sequence = required(integer(row?.Sequence)), timestamp = required(positive(row?.Time))
    // 独立 JMX 属性可以跨秒读取；用历史自己的截止序号，不能以摘要时间或 epoch 推算身份。
    if (sequence < Math.max(historyFirst, historyEnd - (hour ? 3600 : 60)) || sequence >= historyEnd || seen.has(sequence)) throw new Error('Invalid device recording sequence')
    seen.add(sequence)
    const values = Object.fromEntries(recordingMetrics.filter(metric => metric !== 'Communication').map(metric => [metric, required(integer(row?.[metric]))])) as Record<RecordingMetric, number>
    values.Communication = values.ReceivedPackets + values.SentPackets
    if (!Number.isSafeInteger(values.Communication)) throw new Error('Invalid device communication count')
    return { sequence, timestamp, values }
  }).sort((a, b) => a.sequence - b.sequence)
  if (points.some((point, index) => index > 0 && point.timestamp <= points[index - 1].timestamp)) throw new Error('Invalid device recording clock')
  return { generation, statisticsStartTime: required(positive(source.StatisticsStartTime)), sampledAt: required(positive(data.SampleTime)), zoneId: source.ZoneId,
    todayStartTime: required(positive(source.TodayStartTime)), firstSequence, endSequence,
    hourPeaks: peaks(source.HourPeaks), todayPeaks: peaks(source.TodayPeaks), points }
}

/** 峰值定位保持真实秒级数据，仅裁取附近一分钟；超出节点保留范围时不替造曲线。 */
export function peakNeighborhood(points: readonly DeviceSecond[], peak: DevicePeak) {
  return points.some(point => point.sequence === peak.sequence) ? points.filter(point => Math.abs(point.sequence - peak.sequence) <= 30) : []
}

export const recordingSeriesMetric = { communicationQps: 'Communication', upstreamMessages: 'UpstreamMessages', propertyReports: 'PropertyReports', propertyValues: 'PropertyValues', eventReports: 'EventReports', receivedBytes: 'ReceivedBytes', sentBytes: 'SentBytes' } as const
export function peakSeries(metric: RecordingMetric): keyof typeof recordingSeriesMetric {
  return (Object.keys(recordingSeriesMetric) as Array<keyof typeof recordingSeriesMetric>).find(id => recordingSeriesMetric[id] === metric) ?? 'communicationQps'
}
