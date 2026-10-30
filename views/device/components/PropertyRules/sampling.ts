import type { RuleNode } from './codec'

export type SamplingMode = 'ratio' | 'interval' | 'change'
export type IntervalUnit = 1 | 1000 | 60000
export interface SamplingDraft {
  samplingMode: SamplingMode
  percent: number | null
  interval: number | null
  intervalUnit: IntervalUnit
  deadband: number | null
  deadbandType: 'absolute' | 'percent'
  maxSilence?: number | null
}

// The backend validates Duration.toNanos(), including overflow, before creating a rule.
export const MAX_INTERVAL_MILLIS = 9_223_372_036_854
export const samplingProviders: Record<SamplingMode, string> = { ratio: 'ratio-sampling', interval: 'interval-sampling', change: 'change-sampling' }
export const samplingModes: SamplingMode[] = ['ratio', 'interval', 'change']
export function samplingModeOf(node?: RuleNode): SamplingMode {
  if (node?.provider === 'change-sampling-timed') return 'change'
  return samplingModes.find(mode => samplingProviders[mode] === node?.provider) ?? 'ratio'
}
export function intervalMillis(draft: SamplingDraft) { return typeof draft.interval === 'number' ? draft.interval * draft.intervalUnit : Number.NaN }
function validInterval(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_INTERVAL_MILLIS
}
export function isSamplingNode(node: RuleNode) {
  const config = node.configuration
  if (node.provider === samplingProviders.ratio) return typeof config.ratio === 'number' && Number.isFinite(config.ratio) && config.ratio >= 0 && config.ratio <= 1
  if (node.provider === samplingProviders.interval) return validInterval(config.intervalMillis)
  return node.provider === samplingProviders.change
    && validChange(config) || node.provider === 'change-sampling-timed' && validChange(config) && validInterval(config.maxSilenceMillis)
}
function validChange(config: RuleNode['configuration']) {
  return (config.maxSilenceMillis === undefined || validInterval(config.maxSilenceMillis))
    && (config.deadband === undefined || typeof config.deadband === 'number' && Number.isFinite(config.deadband) && config.deadband >= 0)
    && (config.deadbandType === undefined || ['absolute', 'percent'].includes(config.deadbandType))
}

/** Pick an exact display unit so opening and saving a rule never rounds its interval. */
export function readSampling(node?: RuleNode): SamplingDraft {
  const millis = node?.provider === samplingProviders.interval ? node.configuration.intervalMillis : 10000
  const unit = ([60000, 1000, 1] as const).find(value => millis % value === 0) ?? 1
  return { samplingMode: samplingModeOf(node), percent: node?.provider === samplingProviders.ratio ? node.configuration.ratio * 100 : 10,
    interval: millis / unit, intervalUnit: unit,
    deadband: samplingModeOf(node) === 'change' ? node?.configuration.deadband ?? 0 : 0,
    deadbandType: samplingModeOf(node) === 'change' ? node?.configuration.deadbandType ?? 'absolute' : 'absolute',
    maxSilence: samplingModeOf(node) === 'change' ? node?.configuration.maxSilenceMillis ?? null : null }
}

/** Changing strategy replaces its parameters; editing the same strategy preserves extensions. */
export function buildSampling(draft: SamplingDraft, previous?: RuleNode): RuleNode {
  const provider = draft.samplingMode === 'change' && draft.maxSilence != null ? 'change-sampling-timed' : samplingProviders[draft.samplingMode]
  const configuration = draft.samplingMode === 'ratio' ? { ratio: previous?.provider === provider && draft.percent === readSampling(previous).percent ? previous.configuration.ratio : (draft.percent ?? Number.NaN) / 100 }
    : draft.samplingMode === 'interval' ? { intervalMillis: intervalMillis(draft) }
      : { deadband: draft.deadband, deadbandType: draft.deadbandType, ...(draft.maxSilence != null ? { maxSilenceMillis: draft.maxSilence } : {}) }
  const result: RuleNode = { ...previous, provider, configuration: { ...(previous && samplingModeOf(previous) === draft.samplingMode ? previous.configuration : {}), ...configuration } }
  if (draft.samplingMode === 'change' && draft.maxSilence == null) delete result.configuration.maxSilenceMillis
  return result
}

export function validateSampling(draft: SamplingDraft, numeric: boolean): string | undefined {
  if (draft.samplingMode === 'ratio') {
    if (typeof draft.percent !== 'number' || !Number.isFinite(draft.percent) || draft.percent < 0 || draft.percent > 100) return 'PropertyRules.validation.percent'
  } else if (draft.samplingMode === 'interval') {
    if (![1, 1000, 60000].includes(draft.intervalUnit) || !validInterval(intervalMillis(draft))) return 'PropertyRules.validation.interval'
  } else if (draft.samplingMode === 'change') {
    if (typeof draft.deadband !== 'number' || !Number.isFinite(draft.deadband) || draft.deadband < 0
      || !['absolute', 'percent'].includes(draft.deadbandType) || !numeric && draft.deadband !== 0) return 'PropertyRules.validation.deadband'
    if (draft.maxSilence != null && !validInterval(draft.maxSilence)) return 'PropertyRules.validation.maxSilence'
  } else return 'PropertyRules.validation.strategy'
}
