/** Single-node counters for a saved property chain, never a device or notification health check. */
export interface RuleStatisticsSnapshot {
  ruleId: string
  property: string
  nodeId: string
  generation?: string | null
  loaded: boolean
  startedAt: number
  sampledAt: number
  input?: number | null
  output?: number | null
  cleaned?: number | null
  sampled?: number | null
  bypassed?: number | null
  errors?: number | null
}

export interface StatisticsTarget {
  property: string
  source: 'product' | 'device' | 'disabled'
  permitted: boolean
}

export interface StatisticsEntry {
  loading?: boolean
  failure?: 'unavailable' | 'forbidden' | 'failed'
  snapshot?: RuleStatisticsSnapshot
  rate?: number
  restarted?: boolean
}

/** A version/node reset invalidates the rate baseline, including counter rollback. */
export function inputRate(previous: RuleStatisticsSnapshot | undefined, current: RuleStatisticsSnapshot) {
  if (!previous?.loaded || !current.loaded || previous.nodeId !== current.nodeId
    || previous.ruleId !== current.ruleId || previous.generation !== current.generation
    || previous.input == null || current.input == null || current.input < previous.input
    || current.sampledAt <= previous.sampledAt) return undefined
  return 1000 * (current.input - previous.input) / (current.sampledAt - previous.sampledAt)
}

export function statisticsStatus(target: StatisticsTarget, entry: StatisticsEntry = {}) {
  if (target.source === 'disabled') return 'disabled'
  if (!target.permitted) return 'forbidden'
  if (entry.failure) return entry.failure
  const snapshot = entry.snapshot
  if (!snapshot) return entry.loading ? 'loading' : 'unread'
  if (!snapshot.loaded) return 'unloaded'
  if (snapshot.errors) return 'errors'
  if (snapshot.bypassed) return 'bypassed'
  return snapshot.input ? 'executed' : 'empty'
}
