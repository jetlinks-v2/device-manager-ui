import type { MBeanDescriptor } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DeviceMessageSample } from './deviceMessageHistory'
import { gaugeCount } from '../../diagnostics/overview/gaugeHistory'

export const deviceQpsAttributeNames = ['ReceivedQps', 'SentQps', 'CommunicationQps', 'QpsSampleTime', 'QpsWindowMillis', 'QpsReady', 'QpsWindowSequence'] as const
export interface DeviceQpsValues { receivedQps: number; sentQps: number; communicationQps: number }
export interface DeviceQpsSnapshot { ready: boolean; invalid?: boolean; timestamp?: number; windowMillis?: number; sequence?: string; values?: DeviceQpsValues }
export interface DeviceQpsPoint { timestamp: number; windowMillis?: number; sequence?: string; values?: DeviceQpsValues }
export interface DeviceQpsView extends DeviceQpsSnapshot { supported: boolean; stale: boolean; history: DeviceQpsPoint[] }
const positiveInteger = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** QPS只读取服务端窗口快照；累计报文数不作为兼容回退或总量推算依据。 */
export function readDeviceQps(bean: MBeanDescriptor): DeviceQpsSnapshot | undefined {
  const attribute = bean.attributes.find(item => item.name === 'QpsSnapshot')
  if (!attribute) return undefined
  const raw = attribute.available ? attribute.value : undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ready: false, invalid: true }
  const source = raw as Record<string, unknown>
  if (deviceQpsAttributeNames.some(name => !Object.hasOwn(source, name))) return { ready: false, invalid: true }
  const ready = source.QpsReady, receivedQps = source.ReceivedQps, sentQps = source.SentQps, communicationQps = source.CommunicationQps
  const sequence = gaugeCount(source.QpsWindowSequence)
  if (sequence === undefined || !nonnegative(receivedQps) || !nonnegative(sentQps) || !nonnegative(communicationQps)) return { ready: false, invalid: true }
  if (ready === false && source.QpsWindowMillis === 0 && typeof source.QpsSampleTime === 'number' && Number.isSafeInteger(source.QpsSampleTime) && source.QpsSampleTime >= 0) return { ready: false, sequence }
  const timestamp = positiveInteger(source.QpsSampleTime), windowMillis = positiveInteger(source.QpsWindowMillis)
  if (ready !== true || timestamp === undefined || windowMillis !== 1000) return { ready: false, invalid: true }
  return { ready: true, timestamp, windowMillis, sequence, values: { receivedQps, sentQps, communicationQps } }
}

/** 序号来自100ms单调时间窗；epoch仅决定图形坐标，校时后重开坐标段。 */
export function qpsClockDiscontinuity(previous?: DeviceQpsSnapshot, current?: DeviceQpsSnapshot) {
  if (previous?.sequence === undefined || current?.sequence === undefined || previous.timestamp === undefined || current.timestamp === undefined) return false
  const delta = BigInt(current.sequence) - BigInt(previous.sequence)
  if (delta < 0n) return false
  const wall = current.timestamp - previous.timestamp
  if (delta === 0n) return Math.abs(wall) > 1000
  return wall <= 0 || delta > BigInt(Number.MAX_SAFE_INTEGER) || Math.abs(wall - Number(delta) * 100) > 1000
}

/** 独立服务端采样时间去重；代次、暂停、非法快照和过期快照均打断曲线。 */
export function deviceQpsView(samples: readonly DeviceMessageSample[]): DeviceQpsView {
  return projectDeviceQps(samples, true)
}

/** 摘要沿用完整代次 / 单调窗口校验，但不创建图表点或查找重复点。 */
export function deviceQpsSummary(samples: readonly DeviceMessageSample[]): Omit<DeviceQpsView, 'history'> {
  const { history: _, ...summary } = projectDeviceQps(samples, false)
  return summary
}

function projectDeviceQps(samples: readonly DeviceMessageSample[], includeHistory: boolean): DeviceQpsView {
  const history: DeviceQpsPoint[] = []
  let result: DeviceQpsView = { supported: false, ready: false, stale: false, history }
  let generation: string | undefined, latestSequence: string | undefined, latestSource: DeviceQpsSnapshot | undefined, latestReadTime: number | undefined
  const interrupt = () => { const last = history.at(-1); if (last?.values) history.push({ timestamp: last.timestamp }) }
  for (const sample of samples) {
    if (sample.startTime === undefined) { interrupt(); if (result.supported) result = { ...result, stale: true }; continue }
    if (generation !== sample.startTime) { interrupt(); generation = sample.startTime; latestSequence = undefined; latestSource = undefined; latestReadTime = undefined }
    const source = sample.qps
    if (!source) { interrupt(); result = { supported: false, ready: false, stale: false, history }; continue }
    if (!source.ready || source.invalid || !source.values || source.timestamp === undefined || source.windowMillis === undefined || source.sequence === undefined) { interrupt(); result = { ...source, supported: true, stale: false, history }; continue }
    if (latestSequence !== undefined && BigInt(source.sequence) < BigInt(latestSequence)) { interrupt(); result = { supported: true, ready: false, invalid: true, stale: false, history }; continue }
    if (qpsClockDiscontinuity(latestSource, source) || latestReadTime !== undefined && sample.timestamp < latestReadTime) history.splice(0)
    latestReadTime = sample.timestamp
    // 以同一服务端的读取时间判断过期，不依赖浏览器时钟，也不把页面读取间隔当采样窗口。
    const stale = sample.timestamp - source.timestamp > source.windowMillis
    result = { ...source, supported: true, stale, history }
    const repeated = source.sequence === latestSequence
    latestSequence = source.sequence
    latestSource = source
    if (stale) { interrupt(); continue }
    if (!includeHistory) continue
    const point = { timestamp: source.timestamp, windowMillis: source.windowMillis, sequence: source.sequence, values: source.values }
    if (repeated) {
      const index = history.findLastIndex(item => item.sequence === source.sequence)
      if (index >= 0) history[index] = point
      else history.push(point)
    } else history.push(point)
  }
  return result
}
