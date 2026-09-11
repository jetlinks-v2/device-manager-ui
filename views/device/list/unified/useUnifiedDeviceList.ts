import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMenuStore } from '@jetlinks-web-core/store'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { countDevice_api, queryDevicePage_api, type DeviceLibraryProductFilterOption, type DeviceQueryTerm } from '../../../../api/device'
import { queryDeviceLibraryProductFilterOptions_api } from '../../../../api/device-library'
import { queryRuntimeDevices_api } from '../../../../api/deviceGroup'
import { resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import { IOT_DEVICE_LIST_DEFAULT_PRODUCT_TERM } from '../../../../api/deviceListDefaultTerms'
import type { DeviceListProvider, UnifiedDevice } from '../../../../deviceListProvider'
import { useDeviceScope } from '../../../../deviceScope'
import { decodeConditionFilterQuery, encodeConditionFilterQuery, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { getDeviceListFilterFields, getDeviceListSearchTerms } from '../../../../deviceListFilter'

/** 单一设备实例分页，类型 Provider 仅提供限定和字段补充，避免跨列表拼页和重复计数。 */
export function useUnifiedDeviceList() {
  const route = useRoute()
  const router = useRouter()
  const menu = useMenuStore()
  const { t } = useI18n()
  const refreshKey = ref(0)
  const deviceProvider: DeviceListProvider = {
    id: 'device', label: () => t('UnifiedDeviceList.device'), order: 10, menuCode: 'iot-user/device/list',
    terms: () => [IOT_DEVICE_LIST_DEFAULT_PRODUCT_TERM], matches: () => true,
    detailRoute: 'iot-user-device-list/Detail', detailParam: 'id',
  }
  const extensions = moduleRegistry.getAllModuleIds().flatMap(id => Object.values(
    moduleRegistry.getResource(id, 'deviceListProviders') || {},
  ) as DeviceListProvider[])
  const providers = computed(() => [deviceProvider, ...extensions].filter(provider => provider.id === 'device' || menu.hasMenu(provider.menuCode)).sort((a, b) => a.order - b.order))
  const activeType = computed(() => {
    const requested = route.query.type || (route.path.endsWith('/gateway') ? 'gateway' : route.path.endsWith('/video') ? 'video' : 'all')
    return providers.value.some(provider => provider.id !== 'device' && provider.id === requested) ? String(requested) : 'all'
  })
  const activeProvider = computed(() => providers.value.find(provider => provider.id === activeType.value))
  const allTerms = computed<DeviceQueryTerm[]>(() => providers.value.length ? [{ terms: providers.value.map((provider, index) => ({ type: index ? 'or' : 'and', terms: provider.terms() })) }] : [{ column: 'id', termType: 'in', value: [] }])
  const baseTerms = computed(() => activeProvider.value?.terms() || allTerms.value)
  const scope = useDeviceScope(baseTerms, refreshKey)
  const products = ref<DeviceLibraryProductFilterOption[]>([])
  const filterFields = computed(() => getDeviceListFilterFields(scope.sidebarProps.value.areas, scope.sidebarProps.value.groups, products.value))
  const commonFilterFields = computed(() => filterFields.value.map(field => String(field.dataIndex)))
  const searchTerms = ref<ConditionFilterTerm[]>([])
  const status = computed(() => String(route.query.status || 'all'))
  const rows = ref<UnifiedDevice[]>([])
  const total = ref(0)
  const pageIndex = ref(0)
  const pageSize = ref(10)
  const loading = ref(false)
  const error = ref('')
  const counts = ref<Record<string, number>>({})
  const statusCounts = ref<Record<string, number>>({})
  const selectedIds = ref<string[]>([])
  const batchMode = ref(false)
  let requestVersion = 0
  let countVersion = 0
  let statusCountVersion = 0

  const scopeSearchTerms = computed<DeviceQueryTerm[]>(() => {
    const terms: DeviceQueryTerm[] = [...scope.terms.value]
    const conditions = getDeviceListSearchTerms(route.query.q, scope.sidebarProps.value.areas)
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

  async function load() {
    const version = ++requestVersion
    loading.value = true; error.value = ''; selectedIds.value = []
    if (!providers.value.length) { rows.value = []; total.value = 0; loading.value = false; return }
    try {
      await scope.ensureReady()
      const result = await queryDevicePage_api({ pageIndex: pageIndex.value, pageSize: pageSize.value, terms: filterTerms.value, sorts: [{ name: 'createTime', order: 'desc' }, { name: 'id', order: 'asc' }] }, baseTerms.value)
      if (version !== requestVersion) return
      let data = result.data.map(device => ({ ...device, category: '' } as UnifiedDevice))
      data.forEach(device => { device.category = classify(device) })
      // 时间列只在全部分类显示，按当前页 ID 批量补齐真实上报时间，关闭无关告警聚合。
      const [enriched, runtime] = await Promise.all([
        Promise.all(providers.value.filter(provider => provider.enrich).map(async provider => provider.enrich!(data.filter(device => device.category === provider.id)))),
        activeType.value === 'all' && data.length ? queryRuntimeDevices_api({
          pageIndex: 0, pageSize: data.length,
          terms: [{ column: 'id', termType: 'in', value: data.map(device => device.id) }],
          withAlarmInfo: false,
        }, baseTerms.value) : undefined,
      ])
      const extras = new Map(enriched.flat().map(device => [device.id, device]))
      const reportTimes = new Map(runtime?.data.map(device => [device.id, device.lastReportTime]))
      data = data.map(device => ({ ...(extras.get(device.id) || device), lastReportTime: reportTimes.get(device.id) }))
      if (version !== requestVersion) return
      rows.value = data; total.value = result.total
    } catch (reason) {
      if (version === requestVersion) { rows.value = []; total.value = 0; error.value = reason instanceof Error ? reason.message : t('UnifiedDeviceList.loadFailed') }
    } finally { if (version === requestVersion) loading.value = false }
  }
  async function loadCounts() {
    const version = ++countVersion
    try {
      const values = await Promise.all([
        ...providers.value.filter(provider => provider.id !== 'device').map(async provider => [provider.id, await countDevice_api({}, provider.terms())] as const),
        countDevice_api({}, allTerms.value).then(value => ['all', value] as const),
      ])
      if (version === countVersion) counts.value = Object.fromEntries(values)
    } catch { if (version === countVersion) counts.value = {} }
  }
  // 快捷状态的数量统计整个筛选范围，不受当前页和已点击的状态按钮限制。
  async function loadStatusCounts() {
    const version = ++statusCountVersion
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
  }
  function changeType(type: string) {
    batchMode.value = false
    void router.replace({ query: { ...route.query, type } })
  }
  function search(payload: { terms: ConditionFilterTerm[] }) {
    void router.replace({ query: { ...route.query, keyword: undefined, q: encodeConditionFilterQuery(payload.terms, filterFields.value) || undefined } })
  }
  // 再次点击已选状态即取消，其他搜索条件及左侧范围保持不变。
  function changeStatus(value: string) { void router.replace({ query: { ...route.query, status: value === status.value ? undefined : value } }) }
  function refresh() { refreshKey.value++; void loadCounts() }
  function changePage(page: number, size: number) { pageIndex.value = size === pageSize.value ? page - 1 : 0; pageSize.value = size; void load() }
  // 产品与接入方式共用原设备列表的选项接口，区域和分组直接复用侧栏数据。
  watch(() => resolveIotProjectId(route), async (projectId, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    products.value = []
    if (!projectId) return
    try {
      const options = await queryDeviceLibraryProductFilterOptions_api(projectId)
      if (!cancelled) products.value = options
    } catch (reason) {
      if (!cancelled) error.value = reason instanceof Error ? reason.message : t('UnifiedDeviceList.loadFailed')
    }
  }, { immediate: true })
  watch([activeType, () => route.query.q, status, scope.scopeType, scope.scopeId, refreshKey], () => {
    searchTerms.value = decodeConditionFilterQuery(route.query.q, filterFields.value); pageIndex.value = 0; void load()
  }, { immediate: true })
  watch([baseTerms, () => route.query.q, scope.scopeType, scope.scopeId, () => resolveIotProjectId(route), refreshKey], () => {
    void loadStatusCounts()
  }, { immediate: true })
  void loadCounts()
  onBeforeUnmount(() => { requestVersion++; countVersion++; statusCountVersion++ })
  return { providers, activeType, activeProvider, scope, filterFields, commonFilterFields, searchTerms, status, rows, total, pageIndex, pageSize, loading, error, counts, statusCounts, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, changePage }
}
