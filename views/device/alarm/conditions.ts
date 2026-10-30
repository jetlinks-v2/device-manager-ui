import type { DeviceAlarmCondition, DeviceAlarmFormModel, DeviceAlarmTrigger, DeviceAlarmValue, ThingModelProperty } from './types'

const inverse: Record<DeviceAlarmTrigger, DeviceAlarmTrigger> = {
  outside: 'inside', inside: 'outside', gt: 'lte', gte: 'lt', lt: 'gte', lte: 'gt',
  eq: 'neq', neq: 'eq', in: 'nin', nin: 'in',
}
export const conditionSymbols: Record<DeviceAlarmTrigger, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠', inside: 'inside', outside: 'outside', in: 'in', nin: 'nin',
}
export function isAlarmProperty(property: ThingModelProperty) {
  return ['int', 'long', 'float', 'double', 'number', 'string', 'boolean', 'enum'].includes(propertyType(property))
}
function propertyType(property: ThingModelProperty) {
  return String(property.valueType?.type ?? property.type ?? property.dataType ?? '')
}
export function conditionOperators(property: ThingModelProperty): DeviceAlarmTrigger[] {
  return ['int', 'long', 'float', 'double', 'number'].includes(propertyType(property))
    ? ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'inside', 'outside']
    : propertyType(property) === 'boolean' ? ['eq', 'neq'] : ['eq', 'neq', 'in', 'nin']
}
export function defaultCondition(property: ThingModelProperty): DeviceAlarmCondition {
  return { trigger: conditionOperators(property)[0], limit: {} }
}
export function invertCondition(condition: DeviceAlarmCondition): DeviceAlarmCondition {
  return { trigger: inverse[condition.trigger], limit: { ...condition.limit }, value: condition.value, values: condition.values?.slice() }
}
/** 条件形状变化时移除旧参数，单值和单元素集合之间保留用户已经选择的值。 */
export function switchConditionOperator(condition: DeviceAlarmCondition, trigger: DeviceAlarmTrigger): DeviceAlarmCondition {
  const shape = (operator: DeviceAlarmTrigger) => ['inside', 'outside'].includes(operator) ? 'range' : ['in', 'nin'].includes(operator) ? 'set' : 'value'
  const previous = shape(condition.trigger), next = shape(trigger)
  const result: DeviceAlarmCondition = { trigger, limit: {}, value: undefined, values: undefined }
  if (previous === next) {
    if (next === 'range') result.limit = { ...condition.limit }
    if (next === 'value') result.value = condition.value
    if (next === 'set') result.values = condition.values?.slice()
  } else if (previous === 'value' && next === 'set' && condition.value != null) {
    result.values = [condition.value]
  } else if (previous === 'set' && next === 'value' && condition.values?.length === 1) {
    result.value = condition.values[0]
  }
  return result
}
export function recoveryCondition(form: DeviceAlarmFormModel) {
  return form.relieveCondition ?? invertCondition(form)
}
const scalar = (value: unknown): value is DeviceAlarmValue => typeof value === 'string' || typeof value === 'boolean'
  || typeof value === 'number' && Number.isFinite(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
export function validCondition(condition: DeviceAlarmCondition, property?: ThingModelProperty): boolean {
  if (property && (!isAlarmProperty(property) || !conditionOperators(property).includes(condition.trigger))) return false
  if (condition.trigger === 'inside' || condition.trigger === 'outside') {
    return finite(condition.limit.lower) && finite(condition.limit.upper) && condition.limit.lower <= condition.limit.upper
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(condition.trigger)) return finite(condition.value)
  const values = ['eq', 'neq'].includes(condition.trigger) ? [condition.value] : condition.values
  if (!values?.length || !values.every(scalar)) return false
  if (!property) return true
  const type = propertyType(property)
  return values.every(value => type === 'enum' ? property.valueType?.elements?.some(item => item.value === value)
    : type === 'boolean' ? typeof value === 'boolean' : type === 'string' ? typeof value === 'string' : finite(value))
}

/** 编解码仅接受可无损编辑的简单条件；未知匹配器继续交给只读视图。 */
export function readCondition(matcher: { provider?: unknown; configuration?: unknown } | undefined): DeviceAlarmCondition | undefined {
  const raw = matcher?.configuration
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
  const config = raw as Record<string, unknown>
  let condition: DeviceAlarmCondition
  if (matcher.provider === 'number-range' && (config.not === undefined || typeof config.not === 'boolean')) {
    if (!finite(config.min) || !finite(config.max)) return
    condition = { trigger: config.not ? 'outside' : 'inside', limit: { lower: config.min, upper: config.max } }
  } else if (matcher.provider === 'number-compare' && typeof config.operator === 'string' && ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'].includes(config.operator)) {
    if (!finite(config.value)) return
    condition = { trigger: config.operator as DeviceAlarmTrigger, value: config.value, limit: {} }
  } else if (matcher.provider === 'value-set' && Array.isArray(config.values) && (config.not === undefined || typeof config.not === 'boolean')) {
    const values: unknown[] = config.values
    if (!values.every(scalar)) return
    condition = values.length === 1
      ? { trigger: config.not ? 'neq' : 'eq', value: values[0], limit: {} }
      : { trigger: config.not ? 'nin' : 'in', values: values.slice(), limit: {} }
  } else return
  return validCondition(condition) ? condition : undefined
}
export function buildCondition(condition: DeviceAlarmCondition) {
  const { trigger, limit, value, values } = condition
  if (trigger === 'inside' || trigger === 'outside') {
    return { provider: 'number-range', configuration: { min: limit.lower, max: limit.upper, not: trigger === 'outside' } }
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(trigger)) {
    return { provider: 'number-compare', configuration: { operator: trigger, value } }
  }
  return { provider: 'value-set', configuration: { values: ['eq', 'neq'].includes(trigger) ? [value] : values?.slice(), not: ['neq', 'nin'].includes(trigger) } }
}
export function matchesCondition(condition: DeviceAlarmCondition, actual: unknown): boolean {
  if (!scalar(actual)) return false
  switch (condition.trigger) {
    case 'inside': return finite(actual) && actual >= condition.limit.lower! && actual <= condition.limit.upper!
    case 'outside': return finite(actual) && (actual < condition.limit.lower! || actual > condition.limit.upper!)
    case 'gt': return finite(actual) && actual > Number(condition.value)
    case 'gte': return finite(actual) && actual >= Number(condition.value)
    case 'lt': return finite(actual) && actual < Number(condition.value)
    case 'lte': return finite(actual) && actual <= Number(condition.value)
    case 'eq': return actual === condition.value
    case 'neq': return actual !== condition.value
    case 'in': return Boolean(condition.values?.includes(actual))
    case 'nin': return !condition.values?.includes(actual)
  }
}

type Interval = { lower: number; upper: number; left: boolean; right: boolean }
function intervals(condition: DeviceAlarmCondition): Interval[] {
  const { trigger, value, limit } = condition
  const range = (lower: number, upper: number, left = false, right = false) => ({ lower, upper, left, right })
  const number = Number(value)
  switch (trigger) {
    case 'inside': return [range(limit.lower!, limit.upper!, true, true)]
    case 'outside': return [range(-Infinity, limit.lower!), range(limit.upper!, Infinity)]
    case 'gt': case 'gte': return [range(number, Infinity, trigger === 'gte')]
    case 'lt': case 'lte': return [range(-Infinity, number, false, trigger === 'lte')]
    default: {
      const values = (['eq', 'neq'].includes(trigger) ? [value] : condition.values!).filter(finite).sort((a, b) => a - b)
      if (trigger === 'eq' || trigger === 'in') return values.map(value => range(value, value, true, true))
      const points = [-Infinity, ...new Set(values), Infinity]
      return points.slice(1).map((upper, index) => range(points[index], upper))
    }
  }
}
/** 条件的交集只在配置时计算；不会为恢复条件引入运行时状态。 */
export function conditionsOverlap(left: DeviceAlarmCondition, right: DeviceAlarmCondition, property?: ThingModelProperty): boolean {
  const candidates = [left.value, right.value, ...(left.values ?? []), ...(right.values ?? [])].filter(scalar)
  const numeric = property ? ['int', 'long', 'float', 'double', 'number'].includes(propertyType(property))
    : ['inside', 'outside', 'gt', 'gte', 'lt', 'lte'].includes(left.trigger)
      || ['inside', 'outside', 'gt', 'gte', 'lt', 'lte'].includes(right.trigger) || candidates.every(finite)
  if (numeric) return intervals(left).some(a => intervals(right).some(b => {
    const lower = Math.max(a.lower, b.lower), upper = Math.min(a.upper, b.upper)
    return lower < upper || lower === upper && (a.lower !== lower || a.left) && (b.lower !== lower || b.left)
      && (a.upper !== upper || a.right) && (b.upper !== upper || b.right)
  }))
  if (propertyType(property ?? {}) === 'enum') candidates.push(...(property!.valueType?.elements?.map(item => item.value) ?? []))
  else if (propertyType(property ?? {}) === 'boolean' || !property && candidates.length > 0 && candidates.every(value => typeof value === 'boolean')) candidates.push(true, false)
  else {
    let other = ''
    while (candidates.includes(other)) other += '\u0000'
    candidates.push(other, true, false)
  }
  return candidates.some(value => matchesCondition(left, value) && matchesCondition(right, value))
}
export function validateAlarmConditions(form: DeviceAlarmFormModel, property?: ThingModelProperty): string | undefined {
  if (!validCondition(form, property)) return 'DeviceAlarm.validation.condition'
  if (form.autoRelieve && form.relieveCondition) {
    if (!validCondition(form.relieveCondition, property)) return 'DeviceAlarm.validation.recovery'
    if (conditionsOverlap(form, form.relieveCondition, property)) return 'DeviceAlarm.validation.overlap'
  }
}
