import { computed, ref, watch, type Component, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { getToken, onlyMessage } from '@jetlinks-web/utils'
import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { ResponsiveSplitter } from '@jetlinks-web-core/components'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { useIotDeviceGroupManagement } from '../hooks/useIotDeviceGroupManagement'
import { saveIotDeviceAreaGroupBindings } from '../hooks/iotDeviceAreaGroupBindings'
import { buildAreaTreeData } from '../hooks/iotAreaTreeOptions'
import { buildDeviceGroupTreeData } from '../hooks/iotDeviceGroupTreeOptions'
import type { DeviceScopeKind } from './deviceListPresentation'
import { getIotDeviceListMenuCode, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import type { DeviceGroup } from '../../../../api/deviceGroup'
import { useUnifiedDeviceList } from './useUnifiedDeviceList'
import { useDeviceListChannelSupport } from './useDeviceListChannelSupport'
import { useUnifiedDeviceActions } from './useUnifiedDeviceActions'
import { useUnifiedDeviceBatchNavigation } from './useUnifiedDeviceBatchNavigation'
import { useHomeAgentFeatureEntry } from '@jetlinks-web-core/layout/components/AiChat/useHomeAgentFeatureEntry'
import { DEVICE_ONBOARDING_CAPABILITY_ID } from '@device-manager-ui/agentCapabilities/deviceGuidance/homeAgentProvider'
import type { UnifiedDevice } from '../../../../deviceListProvider'
import { IOT_UNBOUND_AREA_SCOPE_ID, IOT_UNASSIGNED_GROUP_SCOPE_ID, IOT_ALL_BOUND_AREAS_SCOPE_ID, IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID } from '../hooks/iotDeviceScopeTerms'

// Optional monitor payloads are owned by the registered monitor component.
type GatewayMetricsLoader = (targets: Readonly<Ref<Array<{ id: string; deviceId: string; productId?: string }>>>) => { metricsMap: Record<string, unknown> }

export function useUnifiedDeviceWorkspace() {
const { t } = useI18n()
const route = useRoute()
const guideProjectId = computed(() => resolveIotProjectId(route, ''))
const deviceMenuCode = computed(() => getIotDeviceListMenuCode(route))
const menu = useMenuStore()
const authStore = useAuthStore()
/**
 * The resource-center root and its device child both host this view, so deployments may return either menu code.
 * The server declares “enable” separately; old menus used the combined “action” button.
 */
function canDeviceBatchAction(action: 'delete' | 'enable' | 'export' | 'import') {
  const menuCodes = new Set([deviceMenuCode.value, 'iot-user-device-list', 'iot-user/device/list', 'device/Instance'])
  const actionCodes = action === 'enable' ? ['enable', 'action'] : [action]

  const hasButtonPermission = actionCodes.some((actionCode) =>
    [...menuCodes].some((menuCode) => authStore.hasPermission(`${menuCode}:${actionCode}`)),
  )
  if (hasButtonPermission) return true

  // 已部署的资源中心菜单可能还没有导入、导出和启用这三个按钮节点；列表菜单本身仍是该组批量操作的授权边界。
  return menu.hasMenu(deviceMenuCode.value)
}
const list = useUnifiedDeviceList()
const { providers, isIotEntry, tabs, activeType, activeProvider, scope, baseTerms, filterTerms, filterFields, commonFilterFields, searchTerms, hasSearch, status, rows, total, loading, error, counts, statusCounts, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, clearBatchSelection } = list
const channelSupported = useDeviceListChannelSupport(activeProvider)
const gatewayMonitorCell = moduleRegistry.getResourceItem<Component>('edge-master-ui', 'components', 'GatewayDeviceMonitorCell')
const useGatewayMetrics = moduleRegistry.getResourceItem<GatewayMetricsLoader>('edge-master-ui', 'hooks', 'useGatewayRuntimeMetricsLoader')
const visibleIds = ref<string[]>([])
const gatewayMetricTargets = computed(() => activeType.value === 'gateway'
  ? rows.value.filter(device => visibleIds.value.includes(device.id)).map(device => ({ id: device.id, deviceId: device.id, productId: device.productId })) : [])
const gatewayMetrics = useGatewayMetrics?.(gatewayMetricTargets)
const { sidebarProps, spaceAreaSupported, loading: scopeLoading, loadError: scopeLoadError, handleScopeChange } = scope
const scopePanel = ref<InstanceType<typeof ResponsiveSplitter>>()
const { projectId, editing, editOpen, initialProductId, productOnboardingDeviceCreation, createDrawerOptions, createEntry, guideRequest, canCreate, openCreate, detailDevice, busy, selected, allowed, openDetail, edit, toggle, remove, canDelete, batchToggle, batchRemove, assignAreaOpen, assignGroupOpen, assignArea, assignGroup, deviceImportOpen, deviceImportProductId, productOnboardingDeviceImport, openDeviceImport, enableOnboardedDeviceAndOpenAccess } = useUnifiedDeviceActions(rows, selectedIds, clearBatchSelection, providerOf, refresh, activeProvider)
const { openBatchPage } = useUnifiedDeviceBatchNavigation({ selected, searchTerms, filterFields, syncGatewayStatus })
const configurationRequest = ref(0)

// 私有化网关由产品抽屉直接创建；完成后单独通知待办引导，不能复用 SaaS 的扫码请求。
function handleDeviceCreated(payload?: { deviceId: string; deviceName?: string }) {
  refresh()
  if (productOnboardingDeviceCreation.value && payload?.deviceId) {
    const deviceName = payload.deviceName || payload.deviceId
    Modal.confirm({
      title: t('IotDeviceList.onboarding.enableDevice.title'),
      content: t('IotDeviceList.onboarding.enableDevice.content', { name: deviceName }),
      okText: t('IotDeviceList.onboarding.enableDevice.confirm'),
      cancelText: t('IotDeviceList.onboarding.enableDevice.later'),
      onOk: async () => {
        try {
          await enableOnboardedDeviceAndOpenAccess(payload.deviceId)
          onlyMessage(t('IotDeviceDetail.detail.enabledMessage', { name: deviceName }))
        } catch (error) {
          onlyMessage(error instanceof Error ? error.message : t('UnifiedDeviceList.actionFailed'), 'error')
          throw error
        }
      },
    })
  }
  if (activeProvider.value?.id === 'gateway' && createDrawerOptions.value?.productOnly) {
    configurationRequest.value++
  }
}

const syncVisible = ref(false)
const syncApi = ref('')
const syncData = ref<Record<string, unknown>>({})
const bulkProcessType = ref<'active' | 'sync'>('sync')
const deviceExportOpen = ref(false)
const bulkQuery = computed(() => ({ terms: [...baseTerms.value, ...filterTerms.value] }))
function syncGatewayStatus() {
  if (syncVisible.value) return
  const terms = [...baseTerms.value, ...filterTerms.value]
  syncData.value = { terms }
  bulkProcessType.value = 'sync'
  const params = new URLSearchParams()
  appendQueryParams(params, terms, 'terms')
  syncApi.value = `${getBaseApi()}/device-instance/state/_sync?${TOKEN_KEY_URL}=${getToken()}&${params.toString()}`
  syncVisible.value = true
}
function activateAllDevices() {
  if (syncVisible.value) return
  const terms = [...baseTerms.value, ...filterTerms.value]
  syncData.value = { terms }
  bulkProcessType.value = 'active'
  const params = new URLSearchParams()
  appendQueryParams(params, terms, 'terms')
  syncApi.value = `${getBaseApi()}/device-instance/deploy?${TOKEN_KEY_URL}=${getToken()}&${params.toString()}`
  syncVisible.value = true
}
function appendQueryParams(params: URLSearchParams, value: unknown, path: string) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendQueryParams(params, item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => appendQueryParams(params, item, `${path}.${key}`))
    return
  }
  if (value !== undefined && value !== null) params.set(path, String(value))
}
function handleSyncSaved() {
  syncVisible.value = false
  clearBatchSelection()
  refresh()
}
function handleBatchChanged() {
  clearBatchSelection()
  refresh()
}
function handleBatchMenuClick({ key }: { key: string | number }) {
  if (key === 'export') {
    deviceExportOpen.value = true
    return
  }
  if (key === 'import') {
    openDeviceImport()
    return
  }
  if (key === 'activateAll') {
    Modal.confirm({ title: t('Instance.index.133466-33'), onOk: activateAllDevices })
    return
  }
  openBatchPage({ key })
}
function handleDeviceImportSaved() {
  deviceImportOpen.value = false
  refresh()
}
const { deleteGroup, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, groupMoving, moveGroup, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup } = useIotDeviceGroupManagement({
  getActiveScope: () => ({ type: scope.scopeType.value, id: scope.scopeId.value }), reloadGroups: scope.reloadGroups, changeScope: handleScopeChange,
  getGroups: () => sidebarProps.value.groups,
})

// Use the actual button's availability; opening guidance must never overwrite another form.
function openCreateDrawer() {
  if (busy.value || createEntry.value || detailDevice.value || assignAreaOpen.value || assignGroupOpen.value || groupDialogOpen.value || syncVisible.value) return false
  if (editOpen.value) return !editing.value
  if (activeType.value !== 'all' && !isIotEntry.value) return false
  editing.value = null
  createDrawerOptions.value = undefined
  editOpen.value = true
  return true
}
useHomeAgentFeatureEntry(DEVICE_ONBOARDING_CAPABILITY_ID, openCreateDrawer)
function confirmDeleteGroup(group: DeviceGroup) { Modal.confirm({ title: t('IotDeviceList.scope.deleteGroup'), onOk: () => deleteGroup(group) }) }
// 这组三个快捷筛选允许重复点击当前项清除，不能改用不可再次点击的单选分段控件。
const statusTones: Record<string, 'success' | 'error' | 'default'> = { online: 'success', offline: 'error', disabled: 'default' }
const statusOptions = computed(() => ['online', 'offline', 'disabled'].map(value => ({
  value, label: t(`UnifiedDeviceList.${value}`), count: statusCounts.value[value], loading: list.statusCountsLoading.value,
})))

const scopeTitle = computed(() => {
  const id = scope.scopeId.value
  if (!id) return t('IotDeviceList.scope.allAreas')
  if (id === IOT_UNBOUND_AREA_SCOPE_ID) return t('IotDeviceList.scope.unboundArea')
  if (id === IOT_UNASSIGNED_GROUP_SCOPE_ID) return t('IotDeviceList.scope.unassignedGroup')
  if (id === IOT_ALL_BOUND_AREAS_SCOPE_ID) return t('IotDeviceList.scope.rootAreas')
  if (id === IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID) return t('IotDeviceList.scope.rootGroups')
  return (scope.scopeType.value === 'area' ? sidebarProps.value.areas : sidebarProps.value.groups).find(item => item.id === id)?.name || id
})
function updateVisibleIds(ids: string[]) {
  if (ids.join('|') !== visibleIds.value.join('|')) visibleIds.value = ids
}
function updateReadingIndex(index: number, offset = 0) { list.readingIndex.value = index; list.readingOffset.value = offset }
function selectDevices(ids: string[]) { selectedIds.value = ids; batchMode.value = ids.length > 0 }
function openDeviceDetail(device: UnifiedDevice) {
  list.rememberList()
  openDetail(device)
}
async function saveDeviceScope(device: UnifiedDevice, kind: DeviceScopeKind, ids: string[]) {
  if (busy.value || !authStore.hasPermission(`${deviceMenuCode.value}:update`)) throw new Error(t('UnifiedDeviceList.unavailable'))
  if (kind === 'area' && spaceAreaSupported.value !== true) throw new Error(t('UnifiedDeviceList.unavailable'))
  busy.value = true
  try {
    await saveIotDeviceAreaGroupBindings({ deviceId: device.id, deviceName: device.name, productName: device.productName, state: device.status,
      ...(kind === 'area' ? { areaId: ids[0], previousAreaId: device.areaBindings?.[0]?.areaId || device.areaId } : { groupIds: ids, previousGroupIds: device.groupBindings?.map(group => group.id) || [] }),
    })
  } catch (error) { onlyMessage(error instanceof Error ? error.message : t('UnifiedDeviceList.actionFailed'), 'error'); throw error }
  finally { busy.value = false; refresh() }
}
const resultsModel = computed(() => ({
  rows: rows.value, total: list.hasLoaded.value ? total.value : undefined,
  selectedIds: selectedIds.value, loading: loading.value, loadingMore: list.loadingMore.value,
  error: error.value, appendError: list.appendError.value, hasMore: list.hasMore.value, hasSearch: hasSearch.value,
  details: list.details.value, revision: list.revision.value, readingIndex: list.readingIndex.value, readingOffset: list.readingOffset.value,
  activeType: activeType.value, showCategory: activeType.value === 'all' && providers.value.length > 1,
  categoryLabels: Object.fromEntries(providers.value.map(provider => [provider.id, provider.label()])),
  showArea: spaceAreaSupported.value !== false, showChannel: channelSupported.value === true,
  monitorCell: gatewayMonitorCell, monitorMetrics: gatewayMetrics?.metricsMap || {},
  stateAction: { allowed: authStore.hasPermission(`${deviceMenuCode.value}:action`), disabled: busy.value || batchMode.value },
  scopeEditor: { allowed: authStore.hasPermission(`${deviceMenuCode.value}:update`), disabled: busy.value || batchMode.value,
    loading: scopeLoading.value, error: scopeLoadError.value ? t('UnifiedDeviceList.loadFailed') : '',
    areas: buildAreaTreeData(sidebarProps.value.areas), groups: buildDeviceGroupTreeData(sidebarProps.value.groups), save: saveDeviceScope },
}))

return { t, guideProjectId, deviceMenuCode, menu, list, providers, isIotEntry, tabs, activeType, activeProvider, scope, filterFields, commonFilterFields, searchTerms, hasSearch, status, rows, total, loading, error, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, gatewayMonitorCell, gatewayMetrics, sidebarProps, spaceAreaSupported, scopeLoading, scopeLoadError, handleScopeChange, scopePanel, projectId, editing, editOpen, initialProductId, createDrawerOptions, createEntry, guideRequest, canCreate, openCreate, detailDevice, busy, selected, openDetail, edit, toggle, remove, canDelete, batchToggle, batchRemove, assignAreaOpen, assignGroupOpen, assignArea, assignGroup, deviceImportOpen, deviceImportProductId, productOnboardingDeviceImport, configurationRequest, syncVisible, syncApi, syncData, bulkProcessType, deviceExportOpen, bulkQuery, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, groupMoving, moveGroup, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup, statusTones, statusOptions, canDeviceBatchAction, handleDeviceCreated, handleSyncSaved, handleBatchChanged, handleBatchMenuClick, handleDeviceImportSaved, openCreateDrawer, confirmDeleteGroup, scopeTitle, resultsModel, updateVisibleIds, updateReadingIndex, selectDevices, openDeviceDetail }
}
