import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMenuStore } from '@jetlinks-web-core/store'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { countDevice_api, queryDevicePage_api, type DeviceQueryTerm } from '../../../../api/device'
import { IOT_DEVICE_LIST_DEFAULT_PRODUCT_TERM } from '../../../../api/deviceListDefaultTerms'
import type { DeviceListProvider, UnifiedDevice } from '../../../../deviceListProvider'
import { useDeviceScope } from '../../../../deviceScope'

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
    const requested = route.query.type || (route.path.endsWith('/gateway') ? 'gateway' : route.path.endsWith('/video') ? 'video' : 'device')
    return requested === 'all' || providers.value.some(provider => provider.id === requested) ? String(requested) : providers.value[0]?.id || 'all'
  })
  const activeProvider = computed(() => providers.value.find(provider => provider.id === activeType.value))
  const allTerms = computed<DeviceQueryTerm[]>(() => providers.value.length ? [{ terms: providers.value.map((provider, index) => ({ type: index ? 'or' : 'and', terms: provider.terms() })) }] : [{ column: 'id', termType: 'in', value: [] }])
  const baseTerms = computed(() => activeProvider.value?.terms() || allTerms.value)
  const scope = useDeviceScope(baseTerms, refreshKey)
  const keyword = ref(String(route.query.keyword || ''))
  const status = computed(() => String(route.query.status || 'all'))
  const rows = ref<UnifiedDevice[]>([])
  const total = ref(0)
  const pageIndex = ref(0)
  const pageSize = ref(10)
  const loading = ref(false)
  const error = ref('')
  const counts = ref<Record<string, number>>({})
  const summary = ref<{ total: number; online: number; offline: number }>()
  const selectedIds = ref<string[]>([])
  const batchMode = ref(false)
  let requestVersion = 0
  let countVersion = 0
  let summaryVersion = 0

  const filterTerms = computed<DeviceQueryTerm[]>(() => {
    const text = String(route.query.keyword || '').trim()
    const terms: DeviceQueryTerm[] = [...scope.terms.value]
    if (text) terms.push({ terms: ['name', 'id', 'address'].map((column, index) => ({ column, termType: 'like', value: `%${text}%`, type: index ? 'or' : 'and', skipKeywordExpand: true })) })
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
      let data = result.data.map(device => ({ ...device, category: '' } as UnifiedDevice))
      data.forEach(device => { device.category = classify(device) })
      const enriched = await Promise.all(providers.value.filter(provider => provider.enrich).map(async provider => provider.enrich!(data.filter(device => device.category === provider.id))))
      const extras = new Map(enriched.flat().map(device => [device.id, device]))
      data = data.map(device => extras.get(device.id) || device)
      if (version !== requestVersion) return
      rows.value = data; total.value = result.total
    } catch (reason) {
      if (version === requestVersion) { rows.value = []; total.value = 0; error.value = reason instanceof Error ? reason.message : t('UnifiedDeviceList.loadFailed') }
    } finally { if (version === requestVersion) loading.value = false }
  }
  async function loadCounts() {
    const version = ++countVersion
    try {
      const values = await Promise.all(providers.value.map(async provider => [provider.id, await countDevice_api({}, provider.terms())] as const))
      if (version === countVersion) counts.value = { ...Object.fromEntries(values), all: values.reduce((sum, [, value]) => sum + value, 0) }
    } catch { if (version === countVersion) counts.value = {} }
  }
  async function loadSummary() {
    const version = ++summaryVersion
    summary.value = undefined
    try {
      await scope.ensureReady()
      const terms = filterTerms.value.filter(term => term.column !== 'state')
      const [count, online, offline] = await Promise.all([
        countDevice_api({ terms }, baseTerms.value),
        countDevice_api({ terms: [...terms, { column: 'state', value: 'online' }] }, baseTerms.value),
        countDevice_api({ terms: [...terms, { column: 'state', value: 'offline' }] }, baseTerms.value),
      ])
      if (version === summaryVersion) summary.value = { total: count, online, offline }
    } catch { if (version === summaryVersion) summary.value = undefined }
  }
  function changeType(type: string) {
    batchMode.value = false
    void router.replace({ query: { ...route.query, type } })
  }
  function search() { void router.replace({ query: { ...route.query, keyword: keyword.value.trim() || undefined } }) }
  function changeStatus(value: string) { void router.replace({ query: { ...route.query, status: value === 'all' ? undefined : value } }) }
  function refresh() { refreshKey.value++; void loadCounts() }
  function changePage(page: number, size: number) { pageIndex.value = size === pageSize.value ? page - 1 : 0; pageSize.value = size; void load() }
  watch([activeType, () => route.query.keyword, status, scope.scopeType, scope.scopeId, refreshKey], () => {
    keyword.value = String(route.query.keyword || ''); pageIndex.value = 0; void load(); void loadSummary()
  }, { immediate: true })
  void loadCounts()
  onBeforeUnmount(() => { requestVersion++; countVersion++; summaryVersion++ })
  return { providers, activeType, activeProvider, scope, keyword, status, rows, total, pageIndex, pageSize, loading, error, counts, summary, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, changePage }
}
