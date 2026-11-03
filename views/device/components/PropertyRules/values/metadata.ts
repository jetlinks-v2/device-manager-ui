import type { ThingModelProperty } from '../../../alarm/types'
import { scalarValue, type ScalarValue } from './config'

export const propertyValueType = (property: ThingModelProperty) =>
  String(property.valueType?.type ?? property.type ?? property.dataType ?? '').toLowerCase()

/** Display metadata labels without changing the scalar sent to the preprocessor. */
export function formatPropertyValue(value: unknown, property?: ThingModelProperty): string {
  if (propertyValueType(property ?? {}) === 'boolean' && typeof value === 'boolean') {
    return (value ? property?.valueType?.trueText : property?.valueType?.falseText) || String(value)
  }
  const text = property?.valueType?.elements?.find(item => item.value === value)?.text
  return text || (typeof value === 'string' ? JSON.stringify(value) : String(value ?? '—'))
}

export function propertyValueOptions(property: ThingModelProperty): Array<{ value: ScalarValue; label: string }> {
  const values = propertyValueType(property) === 'boolean' ? [true, false]
    : (property.valueType?.elements ?? []).map(item => item.value)
  return [...new Set(values)].map(value => ({ value, label: formatPropertyValue(value, property) }))
}

/** Select accepts string/number keys; encode type as well so false, 0 and "0" stay distinct. */
export const propertyValueKey = (value: ScalarValue) => JSON.stringify([typeof value, value])

export function propertyValueChoices(property: ThingModelProperty, selected: readonly ScalarValue[] = []) {
  const options = propertyValueOptions(property)
  const values = [...new Set([...options.map(item => item.value), ...selected])]
  return values.map(rawValue => ({
    value: propertyValueKey(rawValue), rawValue, label: formatPropertyValue(rawValue, property),
    unavailable: !options.some(option => option.value === rawValue),
  }))
}

export function readPropertyValueKeys(keys: readonly string[], property: ThingModelProperty, selected: readonly ScalarValue[] = []): ScalarValue[] {
  const choices = propertyValueChoices(property, selected)
  return keys.flatMap(key => {
    const choice = choices.find(item => item.value === key)
    return choice ? [choice.rawValue] : []
  })
}

/** Output values follow metadata; a cleaning match set may still contain invalid raw reports. */
export function validPropertyOutput(value: unknown, property: ThingModelProperty): boolean {
  if (!scalarValue(value)) return false
  switch (propertyValueType(property)) {
    case 'enum': return property.valueType?.elements?.some(item => item.value === value) ?? false
    case 'boolean': return typeof value === 'boolean'
    case 'string': return typeof value === 'string' && (property.valueType?.maxLength == null || value.length <= property.valueType.maxLength)
    case 'int': case 'long': case 'float': case 'double': case 'number': return typeof value === 'number'
    default: return false
  }
}

export function readValueTags(values: readonly string[], numeric: boolean): ScalarValue[] {
  return numeric ? values.map(value => value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value) : [...values]
}
