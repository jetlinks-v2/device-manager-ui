import { computed, ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  buildQueryFilter,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'

import { cloneConditionTerms } from './useIotDeviceAssetFilters'

export function useIotDeviceChildFilters(onSearch: () => void) {
  const { t: $t } = useI18n()
  const filterTerms = ref<ConditionFilterTerm[]>([])
  const submittedTerms = ref<ConditionFilterTerm[]>([])

  const statusOptions = computed(() => [
    { label: $t('IotWorkbench.option.connection.disabled'), value: 'disabled' },
    { label: $t('IotWorkbench.option.connection.offline'), value: 'offline' },
    { label: $t('IotWorkbench.option.connection.online'), value: 'online' },
  ])

  const filterFields = computed<ConditionFilterField[]>(() => [
    {
      dataIndex: 'name',
      title: $t('IotDeviceList.filter.keyword'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['子设备名称', '设备名称', '名称', 'deviceName', 'name'],
      },
    },
    {
      dataIndex: 'id',
      title: $t('IotDeviceList.filter.identifier'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['子设备ID', '设备ID', 'ID', 'id'],
      },
    },
    {
      dataIndex: 'productName',
      title: $t('IotDeviceList.table.type'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['产品', '所属产品', 'productName', 'product'],
      },
    },
    {
      dataIndex: 'status',
      title: $t('IotDeviceList.filter.status'),
      search: {
        rename: 'state',
        type: 'select',
        defaultTermType: 'in',
        options: statusOptions.value,
        matchTokens: ['状态', '连接状态', 'status', 'state'],
        optionPanel: {
          multiple: true,
          showSearch: false,
        },
      },
    },
  ])
  const commonFilterFields = computed(() => ['name', 'id', 'productName', 'status'])

  function normalizeSearchTerm(term: any): any {
    if (Array.isArray(term.terms)) {
      return {
        ...term,
        terms: term.terms.map(normalizeSearchTerm),
      }
    }

    if (term.column !== 'state') return term

    if (Array.isArray(term.value)) {
      return {
        ...term,
        value: term.value.map((item: string) => item === 'disabled' ? 'notActive' : item),
      }
    }

    return {
      ...term,
      value: term.value === 'disabled' ? 'notActive' : term.value,
    }
  }

  function buildFilterTerms() {
    return buildQueryFilter(submittedTerms.value, filterFields.value).terms.map(normalizeSearchTerm)
  }

  function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
    filterTerms.value = cloneConditionTerms(terms)
  }

  function handleFilterSearch(payload?: { terms?: ConditionFilterTerm[] }) {
    const terms = cloneConditionTerms(payload?.terms ?? filterTerms.value)
    filterTerms.value = terms
    submittedTerms.value = terms
    onSearch()
  }

  return {
    filterTerms,
    filterFields: filterFields as ComputedRef<ConditionFilterField[]>,
    commonFilterFields,
    buildFilterTerms,
    handleFilterSearch,
    handleFilterTermsUpdate,
  }
}
