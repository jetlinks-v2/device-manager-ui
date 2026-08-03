import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryDevicePage_api, type DeviceQueryTerm } from '@device-manager-ui/api/device'
import type { ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { IotDevice } from '../types'

const pageSizeOptions = [10, 20, 50] as const
const antPageSizeOptions = pageSizeOptions.map(String)

export function useIotDeviceAssetTable(
  projectId: Ref<string>,
  submittedTerms: Ref<ConditionFilterTerm[]>,
  buildDeviceQueryTerms: () => DeviceQueryTerm[],
  devices: Ref<IotDevice[]>,
) {
  const { t: $t } = useI18n()
  const totalDevices = ref(0)
  const loadError = ref('')
  const currentPage = ref(1)
  const pageSize = ref(10)
  const refreshKey = ref(0)

  const tableParams = computed(() => ({
    projectId: projectId.value,
    refreshKey: refreshKey.value,
    filterKey: JSON.stringify(submittedTerms.value),
  }))

  const tablePagination = computed(() => ({
    current: currentPage.value,
    pageSize: pageSize.value,
    pageSizeOptions: antPageSizeOptions,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => $t('IotDeviceList.table.total', { total }),
  }))

  function refreshTable(resetPage = false) {
    if (resetPage) currentPage.value = 1
    refreshKey.value += 1
  }

  async function tableRequest(params: { pageIndex?: number; pageSize?: number }) {
    const pageIndex = Number(params.pageIndex ?? Math.max(currentPage.value - 1, 0))
    const pageSizeValue = Number(params.pageSize ?? pageSize.value)
    const nextPage = pageIndex + 1
    if (currentPage.value !== nextPage) currentPage.value = nextPage
    if (pageSize.value !== pageSizeValue) pageSize.value = pageSizeValue
    loadError.value = ''

    try {
      const result = await queryDevicePage_api({
        pageIndex,
        pageSize: pageSizeValue,
        terms: buildDeviceQueryTerms(),
      })

      devices.value = result.data
      totalDevices.value = result.total

      return {
        success: true,
        result: {
          data: result.data,
          total: result.total,
          pageIndex,
          pageSize: pageSizeValue,
        },
      }
    } catch (error) {
      devices.value = []
      totalDevices.value = 0
      loadError.value = error instanceof Error ? error.message : $t('IotDeviceList.table.loadFailed')

      return {
        success: false,
        result: {
          data: [],
          total: 0,
          pageIndex,
          pageSize: pageSizeValue,
        },
      }
    }
  }

  return {
    devices,
    totalDevices,
    loadError,
    currentPage,
    pageSize,
    refreshKey,
    tableParams,
    tablePagination,
    refreshTable,
    tableRequest,
  }
}
