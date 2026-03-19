import dayjs from 'dayjs'
import type { ControlParamField } from './types'

export const formatTime = (iso?: string | number) =>
  iso ? dayjs(iso).format('YYYY-MM-DD HH:mm:ss') : '-'

export const selectFilterOption = (input: string, option: any) =>
  String(option?.label || '').toLowerCase().includes(input.toLowerCase())

export const toParamField = (input: any): ControlParamField => {
  const valueType = input?.valueType || {}
  const rawType = String(valueType?.type || 'string').toLowerCase()
  const type: ControlParamField['type'] =
    rawType === 'boolean'
      ? 'boolean'
      : rawType === 'enum'
        ? 'enum'
        : ['int', 'long', 'float', 'double', 'decimal', 'number'].includes(rawType)
          ? 'number'
          : 'string'

  const options = Array.isArray(valueType?.elements)
    ? valueType.elements.map((item: any) => ({
        label: item.text || String(item.value),
        value: item.value
      }))
    : undefined

  return {
    id: input.id,
    name: input.name || input.id,
    type,
    min: valueType?.min,
    max: valueType?.max,
    options,
    defaultValue: input.defaultValue
  }
}

export const getParamFieldTypeLabel = (field: ControlParamField) => {
  if (field.type === 'enum') return '枚举'
  if (field.type === 'number') return '数值'
  if (field.type === 'boolean') return '布尔'
  return '文本'
}

export const getParamFieldMeta = (field: ControlParamField) => {
  if (field.type === 'enum') return `共 ${field.options?.length || 0} 个选项`
  if (field.type === 'number') return `范围 ${field.min ?? '-'} ~ ${field.max ?? '-'}`
  if (field.type === 'boolean') return '开/关 类型'
  return `字段标识：${field.id}`
}
