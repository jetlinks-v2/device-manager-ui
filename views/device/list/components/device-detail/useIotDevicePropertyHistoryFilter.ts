import dayjs, { type Dayjs } from 'dayjs'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  cloneTerms,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

/** 属性历史复用统一条件编辑器，按物模型类型选择值编辑器及查询列。 */
export function useIotDevicePropertyHistoryFilter(
  property: ComputedRef<RealtimePropertyRow | null>,
  detailTimeRange: Ref<[Dayjs, Dayjs]>,
) {
  const { t: $t } = useI18n()
  const filterTerms = ref<ConditionFilterTerm[]>([])
  const submittedTerms = ref<ConditionFilterTerm[]>([])
  const propertyValueType = computed(() => property.value?.valueType?.type || property.value?.dataType || '')
  const isNumeric = computed(() => ['int', 'long', 'float', 'double', 'number', 'short', 'byte'].includes(propertyValueType.value))
  const isText = computed(() => ['string', 'password'].includes(propertyValueType.value))
  const isOption = computed(() => ['boolean', 'enum'].includes(propertyValueType.value))
  const valueOptions = computed(() => {
    const valueType = property.value?.valueType
    if (propertyValueType.value === 'boolean') return [
      { label: valueType?.falseText || $t('IotDeviceDetail.common.no'), value: valueType?.falseValue ?? false },
      { label: valueType?.trueText || $t('IotDeviceDetail.common.yes'), value: valueType?.trueValue ?? true },
    ]
    return (valueType?.elements || []).map((item: Record<string, unknown>) => ({
      label: String(item.text ?? item.label ?? item.value ?? ''), value: item.value,
    }))
  })
  const filterFields = computed<ConditionFilterField[]>(() => [
    {
      title: $t('IotDeviceDetail.runtime.time'), dataIndex: 'timestamp',
      search: {
        type: 'date', defaultTermType: 'gt', termTypeOptions: ['gt', 'gte', 'lt', 'lte', 'eq', 'btw'],
        componentProps: { showTime: true, format: 'YYYY-MM-DD HH:mm:ss' },
        handleValue: value => Array.isArray(value)
          ? value.map(item => dayjs(item).valueOf()) : dayjs(value).valueOf(),
      },
    },
    ...(isNumeric.value || isText.value || isOption.value ? [{
      title: property.value?.name || $t('IotDeviceDetail.propertyDetail.propertyValue'), dataIndex: 'value',
      search: {
        type: isNumeric.value ? 'number' : isOption.value ? 'select' : 'string',
        rename: isNumeric.value ? 'numberValue' : 'value',
        defaultTermType: isText.value ? 'like' : 'eq',
        termTypeOptions: isNumeric.value ? ['eq', 'gt', 'gte', 'lt', 'lte', 'btw'] : isText.value ? ['like', 'eq'] : ['eq'],
        ...(isOption.value ? { options: valueOptions.value, optionPanel: { multiple: false, showSearch: false } } : {}),
      },
    }] : []),
  ])

  /** 只查询已提交条件；外层时间范围始终与整个条件表达式取交集。 */
  function buildListTerms(): ConditionFilterTerm[] {
    const filters = cloneTerms(submittedTerms.value)
    return [
      { terms: [{ column: 'timestamp', termType: 'btw', value: detailTimeRange.value.map(time => time.valueOf()) }] },
      ...(filters.length ? [{ terms: filters, type: 'and' }] : []),
    ]
  }

  /** change 事件已完成字段映射和 like 转义，保存查询快照，避免二次转换。 */
  function submitListFilter(terms: ConditionFilterTerm[]) {
    submittedTerms.value = cloneTerms(terms)
  }

  function resetListFilter() {
    filterTerms.value = []
    submittedTerms.value = []
  }

  return { filterTerms, filterFields, buildListTerms, submitListFilter, resetListFilter }
}
