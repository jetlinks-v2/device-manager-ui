import type { RuleNode } from '../codec'

export type ScalarValue = string | number | boolean
export interface ValueRuleDraft {
  replacementValue?: ScalarValue | null
  rangeAction?: 'ignore' | 'clamp'
  offset?: string | null
  fallbackEnabled?: boolean
  fallbackMode?: 'fixed' | 'previous'
  fallbackValue?: ScalarValue | null
  fallbackMaxAge?: number | null
  fallbackEmpty?: boolean
  fallbackMissing?: boolean
  stepEnabled?: boolean
  maxStep?: number | null
  baselineTtl?: number | null
}
export const scalarValue = (value: unknown): value is ScalarValue => typeof value === 'string'
  || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)

export function readValueRules(nodes: Partial<Record<string, RuleNode>>): ValueRuleDraft {
  const fallback = nodes.fallback?.configuration
  return {
    replacementValue: nodes.values?.configuration.processors[0]?.configuration.value ?? null,
    rangeAction: nodes.range?.configuration.processors[0]?.provider === 'clamp' ? 'clamp' : 'ignore',
    offset: nodes.scale?.configuration.offset ?? '0',
    fallbackEnabled: Boolean(fallback), fallbackMode: fallback?.mode ?? 'previous',
    fallbackValue: fallback?.value ?? null, fallbackMaxAge: fallback?.maxAgeMillis ?? 300000,
    fallbackEmpty: fallback?.includeEmpty ?? false, fallbackMissing: fallback?.includeMissing ?? false,
    stepEnabled: Boolean(nodes.step), maxStep: nodes.step?.configuration.maxStep ?? null,
    baselineTtl: nodes.step?.configuration.baselineTtlMillis ?? 300000,
  }
}

export function validFallback(config: Record<string, unknown>) {
  return ['fixed', 'previous'].includes(String(config.mode ?? 'previous'))
    && (config.value === undefined || scalarValue(config.value))
    && (config.mode === 'fixed' ? scalarValue(config.value)
      : typeof config.maxAgeMillis === 'number' && Number.isSafeInteger(config.maxAgeMillis) && config.maxAgeMillis > 0)
    && (config.includeEmpty === undefined || typeof config.includeEmpty === 'boolean')
    && (config.includeMissing === undefined || typeof config.includeMissing === 'boolean')
}

/** Removing an optional fixed fallback must remove its saved value, not retain the previous extension. */
export function buildFallback(draft: ValueRuleDraft, previous?: RuleNode): RuleNode {
  const configuration = { ...previous?.configuration, mode: draft.fallbackMode,
    maxAgeMillis: draft.fallbackMaxAge, includeEmpty: draft.fallbackEmpty ?? false, includeMissing: draft.fallbackMissing ?? false }
  const node: RuleNode = { ...previous, provider: 'fallback', configuration }
  if (draft.fallbackValue === null || draft.fallbackValue === undefined) delete node.configuration.value
  else node.configuration.value = draft.fallbackValue
  if (draft.fallbackMode === 'fixed') delete node.configuration.maxAgeMillis
  return node
}
