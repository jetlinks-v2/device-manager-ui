import { computed, ref, watch } from 'vue'
import { normalizeDeviceTypeValue, type IotDeviceLibraryTagGroup, type IotDeviceProductTemplate } from '@device-manager-ui/api/device'

export interface DeviceLibrarySelectionQuery {
  pageIndex: number
  pageSize: number
  keyword: string
  tags: string[]
}

interface DeviceLibrarySelectionProps {
  selectableDeviceType: string
  tagFilterGroups: IotDeviceLibraryTagGroup[]
  tagLoading: boolean
  loading: boolean
  pageIndex: number
  pageSize: number
  hasMore: boolean
}

const COLLAPSED_TAG_GROUP_COUNT = 5

/** 管理设备库选择器的筛选状态和查询事件，数据与错误反馈由调用容器负责。 */
export function useDeviceLibrarySelection(
  props: DeviceLibrarySelectionProps,
  onQueryChange: (query: DeviceLibrarySelectionQuery) => void,
) {
  const keyword = ref('')
  const submittedKeyword = ref('')
  const activeTagIds = ref<string[]>([])
  const tagGroupsExpanded = ref(false)

  const showTagPanel = computed(() => props.tagLoading || props.tagFilterGroups.length || activeTagIds.value.length)
  const hasActiveTagFilter = computed(() => activeTagIds.value.length > 0)
  const visibleTagFilterGroups = computed(() => (
    tagGroupsExpanded.value ? props.tagFilterGroups : props.tagFilterGroups.slice(0, COLLAPSED_TAG_GROUP_COUNT)
  ))
  const hasHiddenTagFilterGroups = computed(() => props.tagFilterGroups.length > COLLAPSED_TAG_GROUP_COUNT)

  // 提交关键词时回到第一页；翻页仅使用已提交的关键词。
  function handleKeywordSearch(value = keyword.value) {
    submittedKeyword.value = value.trim()
    emitQuery(0)
  }

  // 清空输入立即撤销已提交的关键词条件。
  function handleKeywordChange(event: Event) {
    const value = (event.target as HTMLInputElement | null)?.value ?? ''
    if (!value && submittedKeyword.value) handleKeywordSearch('')
  }

  // 标签多选更新查询，并保持隐藏分组中的已选标签可见。
  function toggleTagFilter(tagId: string) {
    const isSelected = activeTagIds.value.includes(tagId)
    if (!isSelected && props.tagFilterGroups.slice(COLLAPSED_TAG_GROUP_COUNT).some((group) => (
      group.tags.some((tag) => tag.id === tagId)
    ))) {
      tagGroupsExpanded.value = true
    }
    activeTagIds.value = isSelected
      ? activeTagIds.value.filter((item) => item !== tagId)
      : [...activeTagIds.value, tagId]
    emitQuery(0)
  }

  // 清除标签后从第一页重新查询。
  function clearTagFilters() {
    activeTagIds.value = []
    emitQuery(0)
  }

  // 接口只提供 hasMore；禁止请求越界页或在加载中重复翻页。
  function changePage(nextPageIndex: number) {
    if (props.loading || nextPageIndex < 0 || (nextPageIndex > props.pageIndex && !props.hasMore)) return
    emitQuery(nextPageIndex)
  }

  // 只向容器派发查询，不在展示层执行 API 请求。
  function emitQuery(pageIndex = props.pageIndex) {
    onQueryChange({
      pageIndex: Math.max(0, pageIndex),
      pageSize: props.pageSize,
      keyword: submittedKeyword.value,
      tags: [...activeTagIds.value],
    })
  }

  // 网关和子设备入口限制可选择的设备类型。
  function isTemplateDisabled(template: IotDeviceProductTemplate) {
    return Boolean(
      props.selectableDeviceType
      && normalizeDeviceTypeValue(template.deviceType) !== normalizeDeviceTypeValue(props.selectableDeviceType),
    )
  }

  // 标签源刷新后恢复折叠状态。
  watch(() => props.tagFilterGroups, () => {
    tagGroupsExpanded.value = false
  }, { deep: true })

  return {
    keyword, activeTagIds, tagGroupsExpanded, showTagPanel, hasActiveTagFilter,
    visibleTagFilterGroups, hasHiddenTagFilterGroups, handleKeywordSearch,
    handleKeywordChange, toggleTagFilter, clearTagFilters, changePage, isTemplateDisabled,
  }
}
