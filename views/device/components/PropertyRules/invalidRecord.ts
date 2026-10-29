import type { RuleTranslator } from './summary'

/** New records use stable reason codes; legacy/free-form descriptions remain readable. */
export function invalidRecordDescription(record: Record<string, unknown>, t: RuleTranslator): string {
  const reason = String(record.reason ?? '')
  const description = ['value-set', 'number-range', 'max-step'].includes(reason)
    ? t(`PropertyRules.invalidReason.${reason}`) : String(record.description || record.reason || '--')
  return record.valueTruncated === true ? `${description} · ${t('PropertyRules.invalidValueTruncated')}` : description
}
