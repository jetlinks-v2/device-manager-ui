import dayjs, { type Dayjs } from 'dayjs'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RealtimePropertyRow } from './iotDeviceDetail.types'

type ListFilterField = 'timestamp' | 'value'

interface QueryTerm {
  column: string
  termType: string
  value: unknown
}

interface QueryTermGroup {
  terms: QueryTerm[]
}

export function useIotDevicePropertyHistoryFilter(
  property: ComputedRef<RealtimePropertyRow | null>,
  detailTimeRange: Ref<[Dayjs, Dayjs]>,
) {
  const { t: $t } = useI18n()
  const listFilterField = ref<ListFilterField>('timestamp')
  const listFilterOperator = ref('gt')
  const listFilterValue = ref<Dayjs | string | number | boolean>()

  const numericFilterOperators = [
    { label: '=', value: 'eq' },
    { label: '>', value: 'gt' },
    { label: '>=', value: 'gte' },
    { label: '<', value: 'lt' },
    { label: '<=', value: 'lte' },
  ]
  const propertyValueType = computed(() => property.value?.valueType?.type || property.value?.dataType || '')
  const isNumericPropertyValue = computed(() => ['int', 'long', 'float', 'double', 'number', 'short', 'byte'].includes(propertyValueType.value))
  const isTextPropertyValue = computed(() => ['string', 'password'].includes(propertyValueType.value))
  const isPropertyValueFilterSupported = computed(() => (
    isNumericPropertyValue.value
    || isTextPropertyValue.value
    || propertyValueType.value === 'boolean'
    || propertyValueType.value === 'enum'
  ))
  const propertyValueColumn = computed(() => isNumericPropertyValue.value ? 'numberValue' : 'value')
  const propertyValueOptions = computed(() => {
    const valueType = property.value?.valueType
    if (propertyValueType.value === 'boolean') {
      return [
        { label: valueType?.falseText || $t('IotDeviceDetail.common.no'), value: valueType?.falseValue ?? false },
        { label: valueType?.trueText || $t('IotDeviceDetail.common.yes'), value: valueType?.trueValue ?? true },
      ]
    }
    if (propertyValueType.value === 'enum') {
      return (valueType?.elements || []).map((item: Record<string, unknown>) => ({
        label: String(item.text || item.label || item.value || ''),
        value: item.value,
      }))
    }
    return []
  })
  const listFilterFieldOptions = computed(() => [
    { label: $t('IotDeviceDetail.runtime.time'), value: 'timestamp' },
    ...(isPropertyValueFilterSupported.value ? [{ label: property.value?.name || $t('IotDeviceDetail.propertyDetail.propertyValue'), value: 'value' }] : []),
  ])
  const listFilterOperatorOptions = computed(() => {
    if (listFilterField.value === 'timestamp') return [
      { label: '>', value: 'gt' },
      { label: '>=', value: 'gte' },
      { label: '<', value: 'lt' },
      { label: '<=', value: 'lte' },
      { label: '=', value: 'eq' },
    ]
    if (isNumericPropertyValue.value) return numericFilterOperators
    if (isTextPropertyValue.value) return [
      { label: $t('IotDeviceDetail.propertyDetail.contains'), value: 'like' },
      { label: '=', value: 'eq' },
    ]
    return [{ label: '=', value: 'eq' }]
  })

  function buildListTerms(): QueryTermGroup[] {
    const terms: QueryTermGroup[] = [{
      terms: [{
        column: 'timestamp',
        termType: 'btw',
        value: detailTimeRange.value.map((time) => time.valueOf()),
      }],
    }]
    if (listFilterField.value === 'timestamp' && isDayjs(listFilterValue.value)) {
      terms.push({
        terms: [{
          column: 'timestamp',
          termType: listFilterOperator.value,
          value: listFilterValue.value.valueOf(),
        }],
      })
    }
    if (listFilterField.value === 'value' && hasListFilterValue()) {
      terms.push({
        terms: [{
          column: propertyValueColumn.value,
          termType: listFilterOperator.value,
          value: normalizeListFilterValue(),
        }],
      })
    }
    return terms
  }

  function onListFilterFieldChange() {
    listFilterValue.value = undefined
    listFilterOperator.value = listFilterOperatorOptions.value[0]?.value || 'eq'
  }

  function resetListFilter() {
    listFilterField.value = 'timestamp'
    listFilterOperator.value = 'gt'
    listFilterValue.value = undefined
  }

  function hasListFilterValue() {
    return listFilterValue.value !== undefined && listFilterValue.value !== null && listFilterValue.value !== ''
  }

  function normalizeListFilterValue() {
    if (listFilterOperator.value !== 'like') return listFilterValue.value
    return `%${String(listFilterValue.value)}%`
  }

  function isDayjs(value: unknown): value is Dayjs {
    return dayjs.isDayjs(value)
  }

  return {
    listFilterField,
    listFilterOperator,
    listFilterValue,
    listFilterFieldOptions,
    listFilterOperatorOptions,
    isNumericPropertyValue,
    propertyValueOptions,
    buildListTerms,
    onListFilterFieldChange,
    resetListFilter,
  }
}
