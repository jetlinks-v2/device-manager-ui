import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { RealtimeEventLevel, RealtimePropertyRow } from './iotDeviceDetail.types'
import { getPropertyDisplayUnit, getPropertyDisplayValue } from './iotDevicePropertyDisplay'

const propertyPageSizeOptions = ['8', '12', '24', '48']
const DEFAULT_PAGE_SIZE = 8

export function useIotDevicePropertyPagination(
  properties: ComputedRef<RealtimePropertyRow[]>,
  propertyFilter: Ref<RealtimeEventLevel | 'all'>,
  propertyGroup: Ref<string>,
) {
  let firstRequest = true
  const visiblePropertyCards = ref<RealtimePropertyRow[]>([])
  const filteredPropertyCards = computed(() => properties.value.filter((item) => {
    const matchesGroup = propertyGroup.value === '__all__' || item.groupId === propertyGroup.value
    if (!matchesGroup) return false
    if (propertyFilter.value === 'all') return true
    if (propertyFilter.value === 'critical') return item.tone === 'critical'
    if (propertyFilter.value === 'major') return item.tone === 'warning'
    return item.tone === 'normal' || item.tone === 'stale'
  }))

  const propertyTableParams = ref({
    filter: propertyFilter.value,
    groupId: propertyGroup.value,
    total: 0,
    keys: '',
  })

  watch(() => ({
    filter: propertyFilter.value,
    groupId: propertyGroup.value,
    total: filteredPropertyCards.value.length,
    keys: filteredPropertyCards.value.map((item) => item.id).join('|'),
  }), (next) => {
    const current = propertyTableParams.value
    if (current.filter === next.filter
      && current.groupId === next.groupId
      && current.total === next.total
      && current.keys === next.keys) return

    // 实时值变更会重算属性列表；仅筛选结果变化时才更新参数，避免 j-pro-table 回到第一页。
    propertyTableParams.value = next
  }, { immediate: true })

  const propertyPaginationOptions = {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    pageSize: DEFAULT_PAGE_SIZE,
    pageSizeOptions: propertyPageSizeOptions,
    showSizeChanger: true,
    showLessItems: true,
  }

  const requestPropertyCards = async (params: Record<string, unknown>) => {
    const pageIndex = Number(params.pageIndex ?? 0)
    const requestedPageSize = Number(params.pageSize ?? DEFAULT_PAGE_SIZE)
    const pageSize = firstRequest && requestedPageSize === 12 ? DEFAULT_PAGE_SIZE : requestedPageSize
    const start = pageIndex * pageSize
    const data = filteredPropertyCards.value.slice(start, start + pageSize)
    firstRequest = false
    visiblePropertyCards.value = data

    return {
      success: true,
      result: {
        data,
        pageIndex,
        pageSize,
        total: filteredPropertyCards.value.length,
      },
    }
  }

  function propertyCardIndex(item: RealtimePropertyRow) {
    const index = filteredPropertyCards.value.findIndex((property) => property.id === item.id)
    return index === -1 ? 0 : index
  }

  return {
    propertyPaginationOptions,
    filteredPropertyCards,
    visiblePropertyCards,
    propertyTableParams,
    propertyDisplayValue: getPropertyDisplayValue,
    propertyDisplayUnit: getPropertyDisplayUnit,
    propertyCardIndex,
    requestPropertyCards,
  }
}
