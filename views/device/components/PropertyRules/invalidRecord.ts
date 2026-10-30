import type { RuleTranslator } from './summary'

/** New records use stable reason codes; legacy/free-form descriptions remain readable. */
export function invalidRecordDescription(record: Record<string, unknown>, t: RuleTranslator): string {
  const detail = record.detail && typeof record.detail === 'object' && !Array.isArray(record.detail)
    ? record.detail as Record<string, unknown> : {}
  const reason = String(detail.reason ?? '')
  const description = ['value-set', 'number-range', 'max-step'].includes(reason)
    ? t(`PropertyRules.invalidReason.${reason}`) : String(record.description || reason || '--')
  return detail.valueTruncated === true ? `${description} · ${t('PropertyRules.invalidValueTruncated')}` : description
}
