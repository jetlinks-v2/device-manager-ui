import type { BufferEvidence, BufferEvidenceSample } from './bufferEvidence'

export interface Bottleneck {
  key: string; message: string; values?: Record<string, string | number>; priority: number; observedAt: number
  target: { tool: 'jvm' | 'mbean' | 'overview'; bean?: string; kind?: 'cache' }; retained?: boolean
}
export const bottleneckThresholds = { sustainMs: 60000, recoveryMs: 30000, minimumSamples: 3, cpuHigh: 80, cpuRecovery: 70, heapHigh: 90, heapRecovery: 85, loadHigh: 100, loadRecovery: 80 } as const
export interface ResourceEvidence { observedAt: number; cpuJvm?: number; cpuSystem?: number; heapUsage?: number; loadPressure?: number }
export interface CacheEvidence { observedAt: number; objectName?: string; dirty?: string; queue?: string; committedAt?: string }
const message = (key: string) => `RuntimeMonitor.bottleneck.${key}`
const valid = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0

/** 阈值必须覆盖真实连续采样时间；缺测与长间隔清空持续及恢复窗口。 */
export function sustained(history: readonly ResourceEvidence[], field: keyof Omit<ResourceEvidence, 'observedAt'>, high: number, recovery: number, maxGap = 20000, initiallyActive = false) {
  let aboveSince: number | undefined, belowSince: number | undefined, count = 0, active = initiallyActive, previous: number | undefined
  for (const sample of history) {
    const value = sample[field]
    if (!valid(value) || previous !== undefined && (sample.observedAt <= previous || sample.observedAt - previous > maxGap)) {
      aboveSince = belowSince = undefined; count = 0; active = false
    }
    previous = sample.observedAt
    if (!valid(value)) continue
    if (value! >= high) {
      aboveSince ??= sample.observedAt; count++; belowSince = undefined
      if (count >= bottleneckThresholds.minimumSamples && sample.observedAt - aboveSince >= bottleneckThresholds.sustainMs) active = true
    } else if (!active) { aboveSince = undefined; count = 0 }
    else if (value! < recovery) {
      belowSince ??= sample.observedAt
      if (sample.observedAt - belowSince >= bottleneckThresholds.recoveryMs) { active = false; aboveSince = belowSince = undefined; count = 0 }
    } else belowSince = undefined
  }
  return active
}

export function resourceBottlenecks(history: readonly ResourceEvidence[], now: number, previouslyActive: ReadonlySet<string> = new Set(), maxGap = 20000): Bottleneck[] {
  const last = history.at(-1), rules = bottleneckThresholds
  if (!last || now < last.observedAt || now - last.observedAt > maxGap) return []
  const result: Bottleneck[] = []
  const add = (key: string, priority: number, tool: Bottleneck['target']['tool']) => result.push({ key, message: message(key), priority, observedAt: last.observedAt, target: { tool } })
  const holds = (key: string, field: keyof Omit<ResourceEvidence, 'observedAt'>, high: number, recovery: number) => sustained(history, field, high, recovery, maxGap, previouslyActive.has(key))
  if (holds('applicationCpu', 'cpuJvm', rules.cpuHigh, rules.cpuRecovery)) add('applicationCpu', 50, 'jvm')
  else if (holds('hostCpu', 'cpuSystem', rules.cpuHigh, rules.cpuRecovery)) add('hostCpu', 51, 'overview')
  else if (holds('hostLoad', 'loadPressure', rules.loadHigh, rules.loadRecovery)) add('hostLoad', 52, 'overview')
  if (holds('heap', 'heapUsage', rules.heapHigh, rules.heapRecovery)) add('heap', 40, 'jvm')
  return result
}

function delta(current: string | undefined, previous: string | undefined) {
  if (current === undefined || previous === undefined || !/^\d+$/.test(current) || !/^\d+$/.test(previous)) return undefined
  return BigInt(current) >= BigInt(previous) ? BigInt(current) - BigInt(previous) : undefined
}
function queueSegment(history: readonly BufferEvidenceSample[], current: BufferEvidence, maxGap: number) {
  const segment: Array<{ observedAt: number; queue: BufferEvidence }> = []
  for (let index = history.length - 1; index >= 0; index--) {
    const sample = history[index], queue = sample.queues.find(value => value.objectName === current.objectName)
    if (!queue || queue.epoch !== current.epoch || segment[0] && (segment[0].observedAt <= sample.observedAt || segment[0].observedAt - sample.observedAt > maxGap)) break
    const next = segment[0]?.queue
    if (next && (['written', 'attempted', 'dropped', 'operations', 'slowOperations'] as const).some(key => next[key] !== undefined && queue[key] !== undefined && delta(next[key], queue[key]) === undefined)) break
    segment.unshift({ observedAt: sample.observedAt, queue })
  }
  return segment
}

/** 数据库名称来自生产 writer 的精确身份注册；堆积本身只能定位处理能力，不能证明数据库故障。 */
const writerProfiles: Readonly<Record<string, string>> = { 'timescale-db-things-writer': 'timescaleWrite' }
export function bufferBottlenecks(history: readonly BufferEvidenceSample[], now: number, maxGap = 20000): Bottleneck[] {
  const last = history.at(-1)
  if (!last || now < last.observedAt || now - last.observedAt > maxGap) return []
  const result: Bottleneck[] = []
  for (const queue of last.queues) {
    const segment = queueSegment(history, queue, maxGap)
    // 完成后调度会略长于设定间隔；保留窗口边界前的真实基线，60秒采样也能计算本轮增量。
    const recentStart = Math.max(0, segment.findLastIndex(sample => sample.observedAt <= last.observedAt - 60000))
    const recent = segment.slice(recentStart)
    const previous = recent[0]?.queue
    const completeCounter = (key: 'dead' | 'dropped') => recent.every((sample, index) => sample.queue[key] !== undefined && (!index || delta(sample.queue[key], recent[index - 1].queue[key]) !== undefined))
    const dead = completeCounter('dead') ? delta(queue.dead, previous?.dead) : undefined
    const dropped = completeCounter('dropped') ? delta(queue.dropped, previous?.dropped) : undefined
    const add = (key: string, priority: number, values: Record<string, string | number> = {}) => result.push({ key: `${queue.objectName}:${key}`, message: message(key), values: { name: queue.name, ...values }, priority, observedAt: last.observedAt, target: { tool: 'mbean', bean: queue.objectName } })
    // 既有失败 / LastError 只是历史；只提示本观察窗口内新增失败与新增淘汰。
    if (dead !== undefined && dead > 0n) { add('queueFailures', 10, { count: dead.toLocaleString() }); continue }
    if (dropped !== undefined && dropped > 0n) { add('queueDropped', 11, { count: dropped.toLocaleString() }); continue }
    const startIndex = segment.findLastIndex(sample => sample.observedAt <= last.observedAt - 60000)
    if (startIndex < 0) continue
    const window = segment.slice(Math.min(startIndex, segment.length - 3)), first = window[0]?.queue
    if (!first) continue
    if (window.length < 3 || window.some(sample => sample.queue.pending === undefined || sample.queue.written === undefined || BigInt(sample.queue.pending) === 0n)) continue
    const nonDecreasing = window.every((sample, index) => !index || BigInt(sample.queue.pending!) >= BigInt(window[index - 1].queue.pending!))
    const inflow = delta(queue.written, first.written)
    if (!nonDecreasing || inflow === undefined || inflow === 0n) continue
    const slow = window.every(sample => sample.queue.slowOperations !== undefined) ? delta(queue.slowOperations, first.slowOperations) : undefined
    const profile = writerProfiles[queue.name]
    add(profile && slow !== undefined && slow > 0n ? profile : 'queueBacklog', 20)
  }
  return result
}

export function prioritizeBottlenecks(values: readonly Bottleneck[]): Bottleneck[] {
  return [...new Map(values.map(value => [value.key, value])).values()].sort((left, right) => left.priority - right.priority || left.key.localeCompare(right.key))
}

/** 当前关注与保留证据分开计数，严重的现有健康信号保持最高状态优先级。 */
export function nodeAttentionStatus(health: { level: string; evidence: readonly { signal: string; level: string; values: Array<string | number> }[] } | undefined, fresh: boolean, issues: readonly Bottleneck[]) {
  const evidence = fresh ? health?.evidence ?? [] : []
  const current = issues.filter(value => !value.retained), retained = issues.filter(value => value.retained)
  const count = evidence.length + current.length
  const level = count ? evidence.some(value => value.level === 'critical') ? 'error' as const : 'warning' as const : 'default' as const
  return { count, evidence, current, retained, level }
}

/** 缓存大小不是故障；仅在待写持续增长且提交停滞的连续窗口内提示落盘压力。 */
export function cacheBottlenecks(history: readonly CacheEvidence[], now: number, maxGapMs = 55000): Bottleneck[] {
  const last = history.at(-1)
  if (!last?.objectName || now < last.observedAt || now - last.observedAt > maxGapMs) return []
  const startIndex = history.findLastIndex(sample => sample.observedAt <= last.observedAt - 60000)
  if (startIndex < 0) return []
  const window = history.slice(Math.min(startIndex, Math.max(0, history.length - 3))), first = window[0]
  if (window.length < 3 || window.some((sample, index) => sample.objectName !== last.objectName || sample.dirty === undefined || sample.queue === undefined || sample.committedAt === undefined || BigInt(sample.dirty) === 0n || BigInt(sample.queue) === 0n || sample.committedAt !== first.committedAt || index > 0 && (sample.observedAt - window[index - 1].observedAt > maxGapMs || BigInt(sample.dirty!) < BigInt(window[index - 1].dirty!) || BigInt(sample.queue!) < BigInt(window[index - 1].queue!)))) return []
  if (delta(last.dirty, first.dirty) === 0n || delta(last.queue, first.queue) === 0n) return []
  return [{ key: `${last.objectName}:cacheWrite`, message: message('cacheWrite'), priority: 30, observedAt: last.observedAt, target: { tool: 'mbean', bean: last.objectName, kind: 'cache' } }]
}
