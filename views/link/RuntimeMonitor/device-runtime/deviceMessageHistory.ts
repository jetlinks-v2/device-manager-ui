import type { MBeanDescriptor, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { gaugeCount } from '../../diagnostics/overview/gaugeHistory'
import { qpsClockDiscontinuity, readDeviceQps, type DeviceQpsSnapshot } from './deviceQps'

export const deviceMessageObjectName = 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor'
export const deviceMessageCounterNames = {
  receivedBytes: 'ReceivedBytesTotal', sentBytes: 'SentBytesTotal', upstreamMessages: 'UpstreamMessagesTotal',
  propertyReports: 'PropertyReportsTotal', propertyValues: 'PropertyValuesTotal', eventReports: 'EventReportsTotal',
  receivedPackets: 'ReceivedPacketsTotal', sentPackets: 'SentPacketsTotal',
} as const
export type DeviceMessageCounter = keyof typeof deviceMessageCounterNames
export interface DeviceMessageSample { timestamp: number; startTime?: string; counters?: Partial<Record<DeviceMessageCounter, string>>; qps?: DeviceQpsSnapshot }
export interface DeviceMessageRates { timestamp: number; receivedBytes?: number; sentBytes?: number; upstreamMessages?: number; propertyReports?: number; propertyValues?: number; eventReports?: number }
export interface NodeDeviceMessageSnapshot {
  supported: boolean | undefined; state: ViewState; objectName?: string; history: DeviceMessageSample[]; partial?: boolean
}
const timestamp = (value: unknown) => { const text = gaugeCount(value), number = text === undefined ? NaN : Number(text); return Number.isSafeInteger(number) && number > 0 ? number : undefined }

/** 只接收冻结域、类型和名称；available 元数据优先于同名原始字段。 */
export function deviceMessageSample(bean: MBeanDescriptor): DeviceMessageSample | undefined {
  if (bean.domain !== 'org.jetlinks' || bean.type !== 'DeviceMessageMonitor' || bean.name !== 'DeviceMessageMonitor') return undefined
  const value = (name: string) => bean.attributes.find(attribute => attribute.name === name && attribute.available)?.value
  const startTime = timestamp(value('StartTime')), snapshotTime = timestamp(value('SnapshotTime'))
  if (startTime === undefined || snapshotTime === undefined) return undefined
  return { timestamp: snapshotTime, startTime: String(startTime), qps: readDeviceQps(bean), counters: Object.fromEntries(Object.entries(deviceMessageCounterNames).flatMap(([key, name]) => {
    const count = gaugeCount(value(name)); return count === undefined ? [] : [[key, count]]
  })) }
}

/** 单节点十分钟、最多256个真实采样；缺测只追加断点，不填伪零。 */
export function appendDeviceMessageSample(history: readonly DeviceMessageSample[] = [], sample: DeviceMessageSample) {
  const previous = history.findLast(point => point.startTime !== undefined)
  if (previous?.startTime === sample.startTime && previous?.qps?.sequence !== undefined && sample.qps?.sequence !== undefined && BigInt(sample.qps.sequence) < BigInt(previous.qps.sequence)) return interruptDeviceMessageHistory(history)
  if (deviceMessageClockDiscontinuity(previous, sample)) return [sample]
  return [...history.filter(point => point.timestamp >= sample.timestamp - 600000), sample].slice(-256)
}

/** 时钟校准不能永久拒收新快照；只重建受影响趋势的坐标与非QPS差值基线。 */
export function deviceMessageClockDiscontinuity(previous: DeviceMessageSample | undefined, sample: DeviceMessageSample) {
  if (!previous) return false
  if (sample.timestamp < previous.timestamp) return true
  if (previous.startTime !== sample.startTime) return false
  return qpsClockDiscontinuity(previous.qps, sample.qps)
}

/** 断点沿用最后服务端时间，避免服务端时钟偏移把中断边界过滤掉。 */
export function interruptDeviceMessageHistory(history: readonly DeviceMessageSample[] = []) {
  const last = history[history.length - 1]
  return last?.startTime === undefined ? [...history] : [...history, { timestamp: last.timestamp }].slice(-256)
}

/** 按相同统计代次和真实 SnapshotTime 求差；首样本、回退、重建、长间隔均未知。 */
export function deviceMessageRates(history: readonly DeviceMessageSample[], maxGapMs = 180000): DeviceMessageRates[] {
  return history.map((sample, index) => {
    const previous = history[index - 1], elapsed = previous ? sample.timestamp - previous.timestamp : 0
    const valid = sample.startTime !== undefined && sample.startTime === previous?.startTime && elapsed > 0 && elapsed <= maxGapMs
    const result: DeviceMessageRates = { timestamp: sample.timestamp }
    for (const key of Object.keys(deviceMessageCounterNames) as DeviceMessageCounter[]) {
      if (key === 'receivedPackets' || key === 'sentPackets') continue
      const current = sample.counters?.[key], before = previous?.counters?.[key]
      if (!valid || current === undefined || before === undefined || BigInt(current) < BigInt(before)) continue
      const delta = BigInt(current) - BigInt(before), rate = Number(delta) * 1000 / elapsed
      if (delta <= BigInt(Number.MAX_SAFE_INTEGER) && Number.isFinite(rate)) result[key] = rate
    }
    return result
  })
}

/** 摘要保留最后完成快照，失败/暂停仍由外部状态明确标记；新基线不补旧速率。 */
export function latestDeviceMessageRates(history: readonly DeviceMessageSample[]) {
  const rates = deviceMessageRates(history)
  for (let index = history.length - 1; index >= 0; index--) if (history[index].startTime !== undefined) return rates[index]
  return undefined
}
