import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type ConditionFilterField, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../types'

interface InvalidDataRow {
  id: string
  createTime: string
  description: string
  value: string
}

interface TablePagination {
  current?: number
  pageSize?: number
}

/**
 * 管理设备详情无效数据的统一条件筛选与分页查询。
 *
 * 设备范围始终从详情上下文追加，筛选器只负责用户输入的字段条件。
 */
export function useIotDeviceInvalidData(getDevice: () => IotDevice) {
  const { t: $t } = useI18n()
  const loading = ref(false)
  const rows = ref<InvalidDataRow[]>([])
  const total = ref(0)
  const pageCurrent = ref(1)
  const pageSize = ref(10)
  const filterTerms = ref<ConditionFilterTerm[]>([])
  const submittedTerms = ref<ConditionFilterTerm[]>([])
  const filterCommonFields = ['description', 'value']

  const columns = computed(() => [
    {
      title: $t('IotDeviceDetail.runtime.time'),
      dataIndex: 'createTime',
      key: 'createTime',
      width: 190,
    },
    {
      title: $t('IotDeviceDetail.threshold.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: $t('IotDeviceDetail.trace.value'),
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
    },
  ])

  const filterFields = computed<ConditionFilterField[]>(() => [
    { title: $t('IotDeviceDetail.runtime.time'), dataIndex: 'createTime', search: { type: 'date' } },
    { title: $t('IotDeviceDetail.threshold.description'), dataIndex: 'description', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
    { title: $t('IotDeviceDetail.trace.value'), dataIndex: 'value', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
  ])

  const pagination = computed(() => ({
    current: pageCurrent.value,
    pageSize: pageSize.value,
    total: total.value,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (value: number) => $t('IotDeviceDetail.common.count.item', { count: value }),
  }))

  async function loadRows() {
    const device = getDevice()
    if (!device.id) {
      rows.value = []
      total.value = 0
      return
    }

    loading.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.queryInvalidData({
        pageIndex: pageCurrent.value - 1,
        pageSize: pageSize.value,
        sorts: [{ name: 'createTime', order: 'desc' }],
        terms: buildQueryTerms(device.id),
      })
      const result = resp?.result ?? resp
      const nextRows = extractRows(result).map((item: any, index) => ({
        id: item.id || `${item.createTime || index}-${item.thingId || device.id}`,
        createTime: formatApiTime(item.createTime),
        description: item.description || item.reason || '--',
        value: item.value == null || item.value === '' ? '--' : String(item.value),
      }))
      rows.value = nextRows
      total.value = Number(result?.total ?? result?.page?.total ?? nextRows.length)
    } finally {
      loading.value = false
    }
  }

  function buildQueryTerms(deviceId: string) {
    // change 事件已输出可直接请求的条件，不能再次转换 like 条件以免重复转义通配符。
    return [
      {
        terms: [{ column: 'thingId', value: deviceId, termType: 'eq' }],
        type: 'and',
      },
      ...submittedTerms.value,
    ]
  }

  function onTableChange(nextPagination: TablePagination) {
    pageCurrent.value = Number(nextPagination.current ?? 1)
    pageSize.value = Number(nextPagination.pageSize ?? pageSize.value)
    void loadRows()
  }

  function handleSearch(payload: { terms: ConditionFilterTerm[] }) {
    submittedTerms.value = payload.terms
    pageCurrent.value = 1
    void loadRows()
  }

  watch(
    () => getDevice().id,
    () => {
      pageCurrent.value = 1
      rows.value = []
      total.value = 0
      void loadRows()
    },
    { immediate: true },
  )

  return {
    columns,
    filterCommonFields,
    filterFields,
    filterTerms,
    handleSearch,
    loading,
    onTableChange,
    pagination,
    rows,
  }
}
