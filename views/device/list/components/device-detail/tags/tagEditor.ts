import dayjs from 'dayjs'

export interface DeviceTag {
  id?: string
  key?: string
  name?: string
  type?: string
  format?: string
  value?: unknown
  formatValue?: unknown
  dataType?: {
    type?: string
    format?: string
    elements?: { text: string; value: unknown }[]
    trueText?: string
    trueValue?: unknown
    falseText?: string
    falseValue?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

export const getTagKey = (tag: DeviceTag) => String(tag.key || tag.id || tag.name || '')
export const getTagLabel = (tag: DeviceTag) => String(tag.name || tag.key || tag.id || '')
export const getTagType = (tag: DeviceTag) => String(tag.dataType?.type || tag.type || 'string')
const getTagDateFormat = (tag: DeviceTag) => String(tag.dataType?.format || tag.format || '').trim()
export const isTimeOnlyTag = (tag: DeviceTag) => getTagType(tag) === 'date' && getTagDateFormat(tag) === 'HH:mm:ss'
export const isDateOnlyTag = (tag: DeviceTag) => getTagType(tag) === 'date' && getTagDateFormat(tag).toUpperCase() === 'YYYY-MM-DD'
export const hasTagValue = (value: unknown) => value !== undefined && value !== null && !(typeof value === 'string' && !value.trim())

/** 产品定义提供类型和名称，实例记录提供当前值及用于清除的记录 ID。 */
export function mergeTagDefinitions(definitions: DeviceTag[], values: DeviceTag[]): DeviceTag[] {
  if (!definitions.length) return values
  const stored = new Map(values.map(tag => [getTagKey(tag), tag]))
  return definitions.map(definition => ({
    ...definition,
    ...stored.get(getTagKey(definition)),
    value: stored.get(getTagKey(definition))?.value ?? definition.value,
    formatValue: stored.get(getTagKey(definition))?.formatValue ?? definition.formatValue,
  }))
}

export function formatTagValue(tag: DeviceTag): unknown {
  const type = tag.dataType
  const options = type?.type === 'boolean'
    ? [{ text: type.trueText, value: type.trueValue }, { text: type.falseText, value: type.falseValue }]
    : type?.elements || []
  return options.find(option => String(option.value) === String(tag.value))?.text ?? tag.formatValue ?? tag.value
}

export function getTagOptions(tag: DeviceTag) {
  if (getTagType(tag) === 'enum') return tag.dataType?.elements?.map(item => ({ label: item.text, value: item.value }))
  if (getTagType(tag) === 'boolean') return [
    { label: tag.dataType?.trueText, value: tag.dataType?.trueValue },
    { label: tag.dataType?.falseText, value: tag.dataType?.falseValue },
  ]
}

/** 草稿与设备值隔离；日期按标签格式回显，结构化值交给原 JSON 编辑器。 */
export function createTagDraft(tag: DeviceTag): DeviceTag {
  const type = getTagType(tag)
  let value = tag.formatValue ?? tag.value
  if (isTimeOnlyTag(tag) || isDateOnlyTag(tag)) {
    const format = isTimeOnlyTag(tag) ? 'HH:mm:ss' : 'YYYY-MM-DD'
    if (format === 'HH:mm:ss' && typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value)) {
      value = value.trim()
    } else {
      const date = typeof value === 'string' || typeof value === 'number' ? dayjs(value) : null
      value = date?.isValid() ? date.format(format) : undefined
    }
  }
  if (['object', 'array'].includes(type) && typeof value === 'string') {
    try { value = JSON.parse(value) } catch { /* 交给原编辑器展示非 JSON 值。 */ }
  }
  if (value && typeof value === 'object') value = JSON.parse(JSON.stringify(value))
  return { ...tag, value, valueType: { ...tag.dataType, type } }
}

/** 标签接口保存字符串；保留日期/时间的原格式和设备实例记录 ID。 */
export function serializeTagDraft(row: DeviceTag): DeviceTag {
  const { dataType, valueType, formatValue, ...tag } = row
  const type = getTagType(row)
  let value = row.value
  if (type === 'date' && value && !isTimeOnlyTag(row) && !isDateOnlyTag(row)) {
    value = dayjs(value as string | number).format('YYYY-MM-DD HH:mm:ss')
  } else if (['object', 'array'].includes(type) && value !== undefined && value !== null && typeof value !== 'string') {
    value = JSON.stringify(value)
  }
  return { ...tag, key: getTagKey(row), type, value }
}

/** 删除使用设备标签记录 ID，不能把产品物模型的字段 ID 当作记录 ID。 */
export function findStoredTag(tags: DeviceTag[], tag: DeviceTag) {
  return tags.find(item => getTagKey(item) === getTagKey(tag) && item.id)
}
