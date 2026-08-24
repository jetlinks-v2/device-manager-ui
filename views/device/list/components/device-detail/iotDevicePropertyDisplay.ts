import type { RealtimePropertyRow } from './iotDeviceDetail.types'

interface DisplayValueUnit {
  value: string
  unit: string
}

export function splitPropertyValueAndUnit(value: unknown, unit?: string): DisplayValueUnit {
  const text = String(value ?? '').trim()
  if (!text || text === '--') return { value: '--', unit: '' }

  const normalizedUnit = String(unit ?? '').trim()
  if (!normalizedUnit) return { value: text, unit: '' }

  // 设备值可能已来自 formatValue，部分协议会把已配置单位拼进值里；先拆开再展示，避免重复单位。
  const inlineUnit = text.match(/^([+-]?\d+(?:\.\d+)?)(?:\s*)([^\d\s].*)$/u)
  if (inlineUnit) {
    return {
      value: inlineUnit[1],
      unit: inlineUnit[2].trim(),
    }
  }

  return { value: text, unit: normalizedUnit }
}

export function getPropertyDisplayValue(item: RealtimePropertyRow) {
  return splitPropertyValueAndUnit(item.value, item.unit).value
}

export function getPropertyDisplayUnit(item: RealtimePropertyRow) {
  return splitPropertyValueAndUnit(item.value, item.unit).unit
}

export function formatPropertyValueWithUnit(value: unknown, unit?: string) {
  const display = splitPropertyValueAndUnit(value, unit)
  return display.unit ? `${display.value}${display.unit}` : display.value
}

export function isStructuredPropertyType(valueType?: Record<string, unknown>, dataType?: string) {
  const type = valueType?.type || dataType
  return type === 'object' || type === 'array'
}

export function parseStructuredPropertyValue(value: unknown): Record<string, unknown> | unknown[] | undefined {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return undefined

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

export function getImageFileSource(value: unknown, valueType?: Record<string, unknown>, dataType?: string) {
  const type = valueType?.type || dataType
  if (type !== 'file' || typeof value !== 'string') return ''

  const source = value.trim()
  if (!source) return ''
  if (/^data:image\//iu.test(source)) return source
  if (/\.(?:apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#]|$)/iu.test(source)) return source

  if (valueType?.bodyType === 'base64' && /^[a-z\d+/]+={0,2}$/iu.test(source)) {
    return `data:image/png;base64,${source}`
  }
  return ''
}
