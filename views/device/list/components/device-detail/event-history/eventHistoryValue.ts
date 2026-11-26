export interface EventHistoryField {
  id: string
  name: string
  valueType?: Record<string, unknown>
}

export interface EventHistoryRecord {
  id: string
  time: string
  values: Record<string, unknown>
  raw: Record<string, unknown>
}

export interface EventHistoryDetail {
  eventId: string
  eventName: string
  fields: EventHistoryField[]
  row: EventHistoryRecord
}

interface ValueLabels {
  missing: string
  emptyString: string
  yes: string
  no: string
}

/** 仅解析结构化 JSON；文件、密码和普通字符串始终保留原文。 */
export function parseEventStructure(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')))) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

/** 兼容平铺及 value/data/payload 包装，显式 null 和空字符串不被候选值覆盖。 */
export function getEventHistoryValues(item: Record<string, unknown>): Record<string, unknown> {
  const data = item.data && typeof item.data === 'object' && !Array.isArray(item.data)
    ? item.data as Record<string, unknown>
    : undefined
  const candidates: Array<[Record<string, unknown>, string]> = [
    [item, 'value'], ...(data ? [[data, 'value'] as [Record<string, unknown>, string]] : []), [item, 'payload'], [item, 'data'],
  ]
  const candidate = candidates.find(([owner, key]) => Object.prototype.hasOwnProperty.call(owner, key))
  if (!candidate) return { ...item }
  const value = parseEventStructure(candidate[0][candidate[1]])
  const fields = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { value }
  return { ...item, ...fields }
}

/** 格式化字段只用于展示；对象与数组优先采用可解析的结构，原始记录保持独立。 */
export function getEventFieldValue(row: EventHistoryRecord, field: EventHistoryField): unknown {
  const raw = row.values[field.id]
  const formatted = row.values[`${field.id}_format`]
  const hasFormatted = formatted !== undefined && formatted !== null && formatted !== ''
  if (field.valueType?.type === 'object' || field.valueType?.type === 'array') {
    const candidates = hasFormatted ? [formatted, raw] : [raw]
    for (const value of candidates) {
      const parsed = parseEventStructure(value)
      if (parsed !== null && typeof parsed === 'object') return parsed
    }
  }
  return hasFormatted ? formatted : raw
}

/** 按物模型转换可读值；不强转数字，保留长整数、未知枚举和异常日期的原值。 */
export function formatEventHistoryValue(
  value: unknown,
  valueType: Record<string, unknown> | undefined,
  labels: ValueLabels,
  formatDate: (value: unknown) => string,
): unknown {
  if (value === undefined) return labels.missing
  if (value === null) return 'null'
  if (value === '') return labels.emptyString
  const type = valueType?.type
  if (type === 'boolean') {
    const options = [
      { value: valueType?.falseValue ?? false, text: valueType?.falseText ?? labels.no },
      { value: valueType?.trueValue ?? true, text: valueType?.trueText ?? labels.yes },
    ]
    return String(options.find(item => String(item.value) === String(value))?.text ?? value)
  }
  if (type === 'enum' && Array.isArray(valueType?.elements)) {
    const option = valueType.elements.find(item => String(item.value) === String(value))
    return String(option?.text ?? value)
  }
  if (type === 'date') return formatDate(value === 0 ? new Date(0).toISOString() : value)
  if (type === 'object' || type === 'array' || type === 'geoPoint') return parseEventStructure(value)
  return value
}

/** 列表只展示有限摘要；完整原文保留在详情和查询记录中。 */
export function eventHistoryValueText(value: unknown, maxLength?: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  return maxLength && text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}
