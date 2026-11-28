import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getToken } from '@jetlinks-web/utils'
import { useMenuStore } from '@jetlinks-web-core/store'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment'
import { countDevice_api, type DeviceLibraryProductFilterOption, type DeviceQueryTerm } from '../../../../api/device'
import { queryDeviceLibraryProductFilterOptions_api } from '../../../../api/device-library'
import { buildIotDeviceDetailPath, getIotDeviceListMenuCode, isIotDeviceListEntry, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import type { DeviceListProvider, UnifiedDevice } from '../../../../deviceListProvider'
import { useDeviceScope } from '../../../../deviceScope'
import { decodeConditionFilterQuery, encodeConditionFilterQuery, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { getDeviceListFilterFields, getDeviceListSearchTerms } from '../../../../deviceListFilter'
import { useSupportedDeviceListProviders } from '../hooks/useSupportedDeviceListProviders'
import { useUnifiedDeviceRows, type DeviceRowsSnapshot } from './useUnifiedDeviceRows'

let retainedList: { identity: string; snapshot: DeviceRowsSnapshot; readingIndex: number; readingOffset: number } | undefined

/** 单一设备实例集合，类型 Provider 仅提供限定和字段补充。 */
export function useUnifiedDeviceList() {
  const route = useRoute()
  const router = useRouter()
  const menu = useMenuStore()
  const { t } = useI18n()
  const refreshKey = ref(0)
  const isIotEntry = computed(() => isIotDeviceListEntry(route))
  const deviceProvider: DeviceListProvider = {
    id: 'device', label: () => t('UnifiedDeviceList.device'), order: 10, menuCode: getIotDeviceListMenuCode(route),
    terms: () => [], matches: () => true,
    // 详情继承当前物联或资源中心入口，不能再通过另一个入口的菜单 code 查找。
    detailPath: device => ({
      path: buildIotDeviceDetailPath(resolveIotProjectId(route), device.id, undefined, route),
      query: { ...route.query, type: route.query.type || device.category },
    }),
  }
  const extensions = moduleRegistry.getAllModuleIds().flatMap(id => Object.values(
    moduleRegistry.getResource(id, 'deviceListProviders') || {},
  ) as DeviceListProvider[])
  const authorizedProviders = computed(() => [deviceProvider, ...extensions].filter(provider => provider.id === 'device' || menu.hasMenu(provider.menuCode)).sort((a, b) => a.order - b.order))
  const providers = useSupportedDeviceListProviders(authorizedProviders)
  // 资源中心的旧 type=device 链接沿用“全部”；只有后端支持且已授权的扩展可以切换分类。
  const activeType = computed(() => {
    if (isIotEntry.value) return 'device'
    const requested = route.query.type || (route.path.endsWith('/gateway') ? 'gateway' : route.path.endsWith('/video') ? 'video' : 'all')
    return providers.value.some(provider => provider.id !== 'device' && provider.id === requested) ? String(requested) : 'all'
  })
  const activeProvider = computed(() => providers.value.find(provider => provider.id === activeType.value))
  // 当前分类条件同时传入分页、状态统计与左侧范围统计，保持各处统计口径一致。
  const baseTerms = computed(() => activeType.value === 'all' ? [] : (activeProvider.value?.terms() || []))
  const rows = ref<UnifiedDevice[]>([])
  // 左侧空间/分组统计须与当前设备类型保持同一筛选口径。
  const scope = useDeviceScope(baseTerms, refreshKey, rows)
  const products = ref<DeviceLibraryProductFilterOption[]>([])
  const productLabels = ref<Record<string, string>>({})
  const filterProducts = computed<DeviceLibraryProductFilterOption[]>(() => [
    ...products.value,
    ...Object.entries(productLabels.value).map(([productId, productName]) => ({
      templateId: productId,
      productId,
      productName,
    })),
  ])
  // 私有化字段自行按 ID 回查选项，不依赖侧栏和当前页产品；避免异步刷新重建字段后清空已解析的名称。
  const filterFields = computed(() => isPrivateDeployment()
    ? getDeviceListFilterFields()
    : getDeviceListFilterFields([], [], filterProducts.value))
  const commonFilterFields = computed(() => filterFields.value.map(field => String(field.dataIndex)))
  const searchTerms = ref<ConditionFilterTerm[]>([])
  const status = computed(() => String(route.query.status || 'all'))
  const counts = ref<Record<string, number>>({})
  const countsLoading = ref(false)
  const tabs = computed(() => [
    { key: 'all', label: t('UnifiedDeviceList.all'), count: counts.value.all, countLoading: countsLoading.value },
    ...providers.value.filter(provider => provider.id !== 'device' && provider.showInTabs !== false).map(provider => ({
      key: provider.id, label: provider.label(), count: counts.value[provider.id], countLoading: countsLoading.value,
    })),
  ])
  const statusCounts = ref<Record<string, number>>({})
  const statusCountsLoading = ref(false)
  const selectedIds = ref<string[]>([])
  const batchMode = ref(false)
  let countVersion = 0
  let statusCountVersion = 0

  // 搜索以已提交路由条件为准，固定所属范围和输入草稿不影响空态操作。
  const submittedSearchTerms = computed(() => getDeviceListSearchTerms(route.query.q, scope.sidebarProps.value.areas))
  const hasSearch = computed(() => submittedSearchTerms.value.length > 0 || status.value !== 'all')
  const scopeSearchTerms = computed<DeviceQueryTerm[]>(() => {
    const terms: DeviceQueryTerm[] = [...scope.terms.value]
    const conditions = submittedSearchTerms.value
    if (conditions.length) terms.push({ terms: conditions })
    return terms
  })
  const filterTerms = computed<DeviceQueryTerm[]>(() => {
    const terms = [...scopeSearchTerms.value]
    if (status.value !== 'all') terms.push({ column: 'state', termType: 'eq', value: status.value === 'disabled' ? 'notActive' : status.value })
    return terms
  })
  const classify = (device: UnifiedDevice) => extensions.find(provider => provider.matches(device))?.id || 'device'
  const providerOf = (device: UnifiedDevice) => providers.value.find(provider => provider.id === device.category)

  const rowState = useUnifiedDeviceRows({ rows, prepare: scope.ensureReady,
    context: () => ({ type: activeType.value, provider: activeProvider.value, terms: filterTerms.value, baseTerms: baseTerms.value }),
    classify, onRows: rememberProductLabels, errorMessage: () => t('UnifiedDeviceList.loadFailed'),
  })
  const error = rowState.error
  const readingIndex = ref(0)
  const readingOffset = ref(0)
  const cacheIdentity = () => JSON.stringify([getToken(), resolveIotProjectId(route), activeType.value, route.query.q, status.value,
    scope.scopeType.value, scope.scopeId.value, authorizedProviders.value.map(provider => provider.id)])
  function load(retain = false) {
    clearBatchSelection()
    if (!retain) {
      readingIndex.value = 0; readingOffset.value = 0
      if (retainedList && retainedList.identity === cacheIdentity()) {
        readingIndex.value = retainedList.readingIndex; readingOffset.value = retainedList.readingOffset; rowState.restore(retainedList.snapshot)
        retainedList = undefined; retain = true
      }
    }
    void rowState.reload(retain)
  }
  // 仅在用户打开设备详情前保留一份内存快照；返回后后台重验，不跨登录上下文复用。
  function rememberList() {
    retainedList = { identity: cacheIdentity(), snapshot: rowState.snapshot(), readingIndex: readingIndex.value, readingOffset: readingOffset.value }
  }
  async function loadCounts() {
    if (isIotEntry.value) {
      counts.value = {}
      countsLoading.value = false
      return
    }
    const version = ++countVersion
    countsLoading.value = true
    try {
      const values = await Promise.all([
        ...providers.value.filter(provider => provider.id !== 'device').map(async provider => [provider.id, await countDevice_api({}, provider.terms())] as const),
        // “全部”统计覆盖所有设备，不能继承边缘节点或视频设备的接入方式限定。
        countDevice_api({}).then(value => ['all', value] as const),
      ])
      if (version === countVersion) counts.value = Object.fromEntries(values)
    } catch { if (version === countVersion) counts.value = {} }
    finally { if (version === countVersion) countsLoading.value = false }
  }
  // 快捷状态的数量统计整个筛选范围，不受当前页和已点击的状态按钮限制。
  async function loadStatusCounts() {
    const version = ++statusCountVersion
    statusCountsLoading.value = true
    statusCounts.value = {}
    try {
      await scope.ensureReady()
      if (version !== statusCountVersion) return
      const terms = scopeSearchTerms.value
      const fixedTerms = baseTerms.value
      const values = await Promise.all(['online', 'offline', 'disabled'].map(async value => [
        value,
        await countDevice_api({ terms: [...terms, { column: 'state', termType: 'eq', value: value === 'disabled' ? 'notActive' : value }] }, fixedTerms),
      ] as const))
      if (version === statusCountVersion) statusCounts.value = Object.fromEntries(values)
    } catch { if (version === statusCountVersion) statusCounts.value = {} }
    finally { if (version === statusCountVersion) statusCountsLoading.value = false }
  }
  function changeType(type: string) {
    clearBatchSelection()
    void router.replace({ query: { ...route.query, type } })
  }

  // 批量命令结束后同时清空表格选中态和操作条开关，避免残留“已选 0 台”。
  function clearBatchSelection() {
    selectedIds.value = []
    batchMode.value = false
  }

  // 设备库选项只覆盖已安装模板；列表响应中的产品名称可为详情跳转的任意产品补齐筛选标签。
  function rememberProductLabels(data: UnifiedDevice[]) {
    const labels = { ...productLabels.value }
    data.forEach((device) => {
      const productId = String(device.productId ?? '').trim()
      const productName = String(device.productName ?? '').trim()
      if (productId && productName && productName !== '--') labels[productId] = productName
    })
    productLabels.value = labels
  }

  function search() {
    // URL 保存编辑态；change 的查询值已转义，回填后会被再次转义并触发搜索循环。
    const q = encodeConditionFilterQuery(searchTerms.value, filterFields.value) || undefined
    // 同条件再次搜索仍需重新请求，供用户刷新可能发生变化的设备数据。
    if (q === (route.query.q || undefined) && !route.query.keyword) {
      refresh()
      return
    }
    void router.replace({ query: { ...route.query, keyword: undefined, q } })
  }
  // 再次点击已选状态即取消，其他搜索条件及左侧范围保持不变。
  function changeStatus(value: string) { void router.replace({ query: { ...route.query, status: value === status.value ? undefined : value } }) }
  function refresh() { refreshKey.value++; void loadCounts() }
  // 产品与接入方式共用原设备列表的选项接口，区域和分组直接复用侧栏数据。
  watch(() => resolveIotProjectId(route), async (projectId, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    products.value = []
    productLabels.value = {}
    if (!projectId) return
    try {
      const options = await queryDeviceLibraryProductFilterOptions_api(projectId)
      if (!cancelled) products.value = options
    } catch (reason) {
      if (!cancelled) error.value = reason instanceof Error ? reason.message : t('UnifiedDeviceList.loadFailed')
    }
  }, { immediate: true })
  watch([activeType, () => route.query.q, status, scope.scopeType, scope.scopeId, () => resolveIotProjectId(route), refreshKey], (current, previous) => {
    searchTerms.value = decodeConditionFilterQuery(route.query.q, filterFields.value)
    const sameQuery = previous?.length && current.slice(0, -1).every((value, index) => value === previous[index])
    load(Boolean(sameQuery))
  }, { immediate: true })
  watch([baseTerms, () => route.query.q, scope.scopeType, scope.scopeId, () => resolveIotProjectId(route), refreshKey], () => {
    void loadStatusCounts()
  }, { immediate: true })
  watch([isIotEntry, providers], loadCounts, { immediate: true })
  onBeforeUnmount(() => { countVersion++; statusCountVersion++ })
  return { ...rowState, countsLoading, statusCountsLoading, providers, isIotEntry, tabs, activeType, activeProvider, scope, baseTerms, filterTerms, filterFields, commonFilterFields, searchTerms, hasSearch, status, rows, counts, statusCounts, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, clearBatchSelection, readingIndex, readingOffset, rememberList }
}
