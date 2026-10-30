<template>
  <!-- 卡片切换充当面板顶栏：flush 让它与布局面板贴合，左上角一起拉平。 -->

  <DefineEmptyCreateAction1>
    <a-button v-if="activeType === 'all' || isIotEntry" type="primary" :disabled="busy" @click="openCreateDrawer">
     <template #icon><AIcon type="PlusOutlined" /></template>
     {{ t('IotDeviceList.action.create') }}
    </a-button>
  </DefineEmptyCreateAction1>
  <DefineEmptyCreateAction2>
    <a-button v-if="activeProvider?.create" :key="`create-${activeProvider.id}`" type="primary" :disabled="busy || !canCreate(activeProvider)" @click="openCreate(activeProvider)">
     <template #icon><AIcon type="PlusOutlined" /></template>
     {{ activeProvider.create.label() }}
    </a-button>
  </DefineEmptyCreateAction2>
  <PageChrome flush>
    <SlantedTabs class="unified-device-list__types" :activeKey="activeType" :options="tabs" @change="changeType(String($event))" />
  </PageChrome>
  <FullPage flex transparent-background class="unified-device-list">
    <EqualHeightColumns class="unified-device-list__layout" :left-width="scopeCollapsed ? '2.5rem' : '15rem'" right-width="1fr">
		    <template #left>
			    <a-spin v-if="!scopeCollapsed" :spinning="scopeLoading" wrapper-class-name="unified-device-list__scope">
				    <IotDeviceScopeSidebar v-bind="sidebarProps" @change="handleScopeChange" @create-group="openCreateGroup" @create-child-group="openCreateChildGroup" @edit-group="openEditGroup" @delete-group="confirmDeleteGroup" />
			    </a-spin>
<!--			    <a-button :class="['unified-device-list__scope-toggle', { 'is-collapsed': scopeCollapsed }]" type="text" :aria-label="scopeCollapsed ? '展开设备范围' : '收起设备范围'" @click="scopeCollapsed = !scopeCollapsed"><AIcon :type="scopeCollapsed ? 'RightOutlined' : 'LeftOutlined'" /></a-button>-->
		    </template>
		    <template #right>
			    <div class="unified-device-list__panel">
				    <a-flex align="center" justify="space-between" wrap="wrap" :gap="12" class="unified-device-list__filters">
					    <IotDeviceAssetSearchBar v-model:filter-terms="searchTerms" :filter-fields="filterFields" :common-filter-fields="commonFilterFields" @search="search" />
					    <RegistryComponent page-code="unified-device-list" code="toolbar-actions" :active-type="activeType" @saved="refresh" is="a-space" :size="12" class="unified-device-list__toolbar-actions">
					    <a-button-group role="group" :aria-label="t('IotDeviceList.filter.status')">
					      <a-button
					        v-for="option in statusOptions"
					        :key="option.value"
					        :type="status === option.value ? 'primary' : 'default'"
					        :ghost="status === option.value"
					        :aria-pressed="status === option.value"
					        @click="changeStatus(option.value)"
					      >
					        <a-badge :status="statusTones[option.value]" />
					        {{ option.label }} {{ option.count }}
						    </a-button>
						    </a-button-group>
						    <a-divider type="vertical" class="unified-device-list__action-divider" />
						    <EmptyCreateButtonAction1 v-if="activeType === 'all' || isIotEntry" />
						    <EmptyCreateButtonAction2 v-if="activeProvider?.create" />
						    <a-dropdown>
						      <a-button>
						        {{ t('UnifiedDeviceList.batch') }}
						        <AIcon type="DownOutlined" />
						      </a-button>
						      <template #overlay>
						        <a-menu @click="handleBatchMenuClick">
					          <a-menu-item v-if="canDeviceBatchAction('export')" key="export">{{ t('Instance.index.133466-30') }}</a-menu-item>
					          <a-menu-item v-if="!isSaaS && canDeviceBatchAction('import')" key="import">{{ t('Instance.index.133466-31') }}</a-menu-item>
					          <a-menu-item v-if="canDeviceBatchAction('enable')" key="activateAll">{{ t('Instance.index.133466-32') }}</a-menu-item>
						          <a-menu-item v-if="activeType === 'gateway' && menu.hasMenu('algorithm-center')" key="algorithms">{{ t('UnifiedDeviceList.batchAlgorithms') }}</a-menu-item>
						          <a-menu-item v-if="activeType === 'gateway'" key="plugins">{{ t('UnifiedDeviceList.batchPlugins') }}</a-menu-item>
						          <a-menu-item key="syncStatus">{{ t('IotDeviceList.action.syncStatus') }}</a-menu-item>
						        </a-menu>
						      </template>
						    </a-dropdown>
				    </RegistryComponent>
				    </a-flex>
				    <a-flex v-if="batchMode" wrap="wrap" :gap="12" class="unified-device-list__batch">
					    <span>{{ t('IotDeviceList.toolbar.selected', { selected: selectedIds.length }) }}</span>
					    <component v-if="activeProvider?.batchComponent" :is="activeProvider.batchComponent" :devices="rows" :selected-ids="selectedIds" @changed="handleBatchChanged" />
					    <template v-else>
					    <a-button :disabled="!selectedIds.length || busy" @click="batchToggle('enable')">{{ t('IotDeviceList.action.batchEnable') }}</a-button>
					    <a-button :disabled="!selectedIds.length || busy" @click="batchToggle('disable')">{{ t('IotDeviceList.action.batchDisable') }}</a-button>
					    <a-button v-if="canDeviceBatchAction('delete')" danger :disabled="!selectedIds.length || busy" @click="batchRemove">{{ t('Instance.index.133466-35') }}</a-button>
					    </template>
					    <a-button v-if="spaceAreaSupported !== false" :disabled="!selectedIds.length || busy || spaceAreaSupported !== true" @click="assignAreaOpen = true">{{ t('IotDeviceList.action.assignArea') }}</a-button>
					    <a-button :disabled="!selectedIds.length || busy" @click="assignGroupOpen = true">{{ t('IotDeviceList.action.assignGroup') }}</a-button>
				    </a-flex>
				    <a-alert v-if="error || scopeLoadError" type="error" show-icon :message="error || t('UnifiedDeviceList.loadFailed')"><template #action><a-button @click="refresh">{{ t('UnifiedDeviceList.refresh') }}</a-button></template></a-alert>
				    <div class="unified-device-list__table">
					    <a-table row-key="id" :columns="columns" :data-source="rows" :loading="loading" :pagination="false" :row-selection="rowSelection" :scroll="{ x: 'max-content' }">
					      <template #emptyText>
					        <CloudEmpty :search="hasSearch" :search-name="$t('UnifiedDeviceList.device')">
					          <template v-if="!error"><a-space><EmptyCreateButtonAction1 /><EmptyCreateButtonAction2 /></a-space></template>
					        </CloudEmpty>
					      </template>
						    <template #bodyCell="{ column, record }">
							    <template v-if="column.key === 'name'">
								    <a-flex align="center" :gap="8">
									    <div>
										    <a-flex align="center" :gap="8" wrap="wrap">
											    <a-button type="link" class="unified-device-list__name" @click="openDetail(record)">{{ record.name }}</a-button>
                      <RegistryComponent page-code="device/Instance" code="name-badges" :record="record" />
											    <a-tag v-if="activeType === 'all'" :bordered="false" class="unified-device-list__category">{{ providerOf(record)?.label() }}</a-tag>
										    </a-flex>
										    <small>{{ record.networkAddress || record.identifier }}</small>
									    </div>
								    </a-flex>
							    </template>
                  <template v-else-if="column.key === 'status'">
                    <j-badge-status
                        :text="t(`UnifiedDeviceList.${record.connectionStatus}`)"
                        :status="record.connectionStatus === 'online' ? 'success' : record.connectionStatus === 'offline' ? 'error' : 'default'"
                    />
                  </template>
							    <template v-else-if="column.key === 'product'">
								    <div>
									    <j-ellipsis>{{ record.productName || '—' }}</j-ellipsis>
								    </div>
								    <small>
									    <j-ellipsis>{{ [record.productManufacturer, record.productModel].filter(Boolean).join(' ') || '—' }}</j-ellipsis>
								    </small>
							    </template>
						    <template v-else-if="column.key === 'productName'">
								    <div>{{ record.productName || '—' }}</div>
						    </template>
						    <template v-else-if="column.key === 'brandModel'">
								    <div>
									    <j-ellipsis>{{ formatBrandModel(record.productManufacturer) }}</j-ellipsis>
								    </div>
								    <small>
									    <j-ellipsis>{{ formatBrandModel(record.productModel) }}</j-ellipsis>
								    </small>
						    </template>
						    <template v-else-if="column.key === 'area'">
							    <template v-if="spaceAreaSupported !== false">
								    <div>
									    <j-ellipsis>{{ formatAreaName(record) }}</j-ellipsis>
								    </div>
								    <small>
									    <j-ellipsis>{{ formatGroupName(record) }}</j-ellipsis>
								    </small>
							    </template>
							    <j-ellipsis v-else>{{ formatGroupName(record) }}</j-ellipsis>
						    </template>
							    <template v-else-if="column.key === 'createdAt'">{{ formatTableTime(record.createdAt) }}</template>
							    <template v-else-if="column.key === 'lastReportTime'">{{ formatTableTime(record.lastReportTime) }}</template>
						    <template v-else-if="column.key === 'scope'">
								    <div>{{ formatAreaName(record) }}</div>
								    <small>{{ record.groupBindings?.map(group => group.name).join('、') || record.groupName || '—' }}</small>
							    </template>
							    <template v-else-if="column.key === 'channel'">{{ record.channelNumber ?? '—' }}</template>
							    <template v-else-if="column.key === 'monitor'">
								    <component :is="gatewayMonitorCell" :snapshot="gatewayMetrics?.metricsMap[record.id]" />
							    </template>
							    <template v-else-if="column.key === 'action'">
                    <j-permission-button
                        type="link"
                        size="small"
                        :disabled="busy"
                        :hasPermission="`${deviceMenuCode}:update`"
                        :tooltip="{ title: t('IotDeviceList.action.editShort') }"
                        @click="edit(record)"
                    >
                      <template #icon>
                        <AIcon type="EditOutlined"/>
                      </template>
                    </j-permission-button>
                    <table-actions>
                        <table-actions-item>
                          <j-permission-button
                              type="link"
                              size="small"
                              :disabled="busy"
                              :hasPermission="`${deviceMenuCode}:action`"
                              :danger="record.connectionStatus !== 'disabled'"
                              @click="toggle(record)"
                          >
                            <template #icon>
                              <AIcon :type="record.status !== 'notActive' ? 'StopOutlined' : 'CheckCircleOutlined'"/>
                            </template>
                            {{ t(record.connectionStatus === 'disabled' ? 'IotDeviceList.action.enableShort' : 'IotDeviceList.action.disableShort') }}
                          </j-permission-button>
                        </table-actions-item>
                        <table-actions-item>
                          <j-permission-button
                              type="link"
                              size="small"
                              :disabled="busy || !canDelete(record)"
                              :hasPermission="`${deviceMenuCode}:delete`"
                              danger
                              @click="remove(record)"
                          >
                            <template #icon>
                              <AIcon type="DeleteOutlined"/>
                            </template>
                            {{ t('IotDeviceList.action.deleteShort') }}
                          </j-permission-button>
                        </table-actions-item>

                    </table-actions>
							    </template>
						    </template>
					    </a-table>
				    </div>
				    <a-pagination class="unified-device-list__pagination" :current="pageIndex + 1" :page-size="pageSize" :total="total" :page-size-options="['12', '24', '48', '96']" show-size-changer :show-total="value => t('UnifiedDeviceList.total', { count: value })" @change="changePage" />
			    </div>
		    </template>
	    </EqualHeightColumns>
    <component v-for="provider in providers.filter(item => item.listGuide)" :key="`guide-${provider.id}`"
      :is="provider.listGuide" :active="activeType === provider.id" :request="guideRequest"
      :configuration-request="configurationRequest" :project-id="guideProjectId" @refresh="refresh" />
    <component v-if="createEntry" :is="createEntry.component" :open="true" @update:open="createEntry = undefined" @saved="refresh" />
    <IotAddDeviceDrawer v-if="!editing || editing.category === 'device'" v-model:open="editOpen" :project-id="projectId" :device="editing" :initial-product-id="initialProductId" :product-filter="createDrawerOptions" @saved="refresh" @created="handleDeviceCreated" />
    <DeviceImport v-if="deviceImportOpen" :initial-product-id="deviceImportProductId" :auto-advance-initial-product="productOnboardingDeviceImport" @cancel="deviceImportOpen = false" @save="handleDeviceImportSaved" />
    <DeviceExport v-if="deviceExportOpen" :data="bulkQuery" @close="deviceExportOpen = false" />
    <component v-else-if="editing && providerOf(editing)?.editComponent" :is="providerOf(editing)?.editComponent" v-model:open="editOpen" :gateway="editing" :device="editing" :project-id="projectId" @saved="refresh" />
    <component v-if="detailDevice && providerOf(detailDevice)?.detailComponent" :is="providerOf(detailDevice)?.detailComponent" v-bind="providerOf(detailDevice)?.detailProps?.(detailDevice)" @close-drawer="detailDevice = null" @close="detailDevice = null" />
    <IotDeviceAssignAreaModal v-if="spaceAreaSupported !== false" v-model:open="assignAreaOpen" :project-id="projectId" :selected-device-count="selectedIds.length" :saving="busy" @save="assignArea" />
    <IotDeviceAssignGroupModal v-model:open="assignGroupOpen" :selected-device-count="selectedIds.length" :saving="busy" @save="assignGroup" />
    <IotDeviceGroupNameModal v-model:open="groupDialogOpen" :mode="groupDialogMode" :initial-name="groupEditing?.name" :saving="groupSaving" :error="groupDialogError" @save="saveGroup" />
    <Process v-if="syncVisible" :api="syncApi" :type="bulkProcessType" :data="syncData" @close="syncVisible = false" @save="handleSyncSaved" />
  </FullPage>
</template>
<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'

import { computed, type Component } from 'vue'
import { ref } from 'vue'
import dayjs from 'dayjs'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { getToken, onlyMessage } from '@jetlinks-web/utils'
import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { getBaseApi } from '@jetlinks-web-core/utils'
import EqualHeightColumns from '@jetlinks-web-core/components/EqualHeightColumns/index.vue'
import SlantedTabs from '@jetlinks-web-core/components/SlantedTabs'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import type { useGatewayRuntimeMetricsLoader as UseGatewayRuntimeMetricsLoader } from '@edge-master-ui/views/workbench/gateway/hooks/useGatewayRuntimeMetricsLoader'
import IotDeviceScopeSidebar from '../components/IotDeviceScopeSidebar.vue'
import IotDeviceAssetSearchBar from '../components/IotDeviceAssetSearchBar.vue'
import IotAddDeviceDrawer from '../components/IotAddDeviceDrawer.vue'
import IotDeviceAssignAreaModal from '../components/IotDeviceAssignAreaModal.vue'
import IotDeviceAssignGroupModal from '../components/IotDeviceAssignGroupModal.vue'
import IotDeviceGroupNameModal from '../components/IotDeviceGroupNameModal.vue'
import { useIotDeviceGroupManagement } from '../hooks/useIotDeviceGroupManagement'
import { getIotDeviceListMenuCode, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import type { DeviceGroup } from '../../../../api/deviceGroup'
import { useUnifiedDeviceList } from './useUnifiedDeviceList'
import { useUnifiedDeviceActions } from './useUnifiedDeviceActions'
import { useUnifiedDeviceBatchNavigation } from './useUnifiedDeviceBatchNavigation'
import Process from '../../Instance/Process/index.vue'
import { useHomeAgentFeatureEntry } from '@jetlinks-web-core/layout/components/AiChat/useHomeAgentFeatureEntry'
import { DEVICE_ONBOARDING_CAPABILITY_ID } from '@device-manager-ui/agentCapabilities/deviceGuidance/homeAgentProvider'
import DeviceImport from '../../Instance/Import/modal.vue'
import DeviceExport from '../../Instance/Export/index.vue'
import { isSaaS } from '@jetlinks-web-core/utils/consts'
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
const { providers, isIotEntry, tabs, activeType, activeProvider, scope, baseTerms, filterTerms, filterFields, commonFilterFields, searchTerms, hasSearch, status, rows, total, pageIndex, pageSize, loading, error, counts, statusCounts, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, changePage, clearBatchSelection } = useUnifiedDeviceList()
const gatewayMonitorCell = moduleRegistry.getResourceItem<Component>('edge-master-ui', 'components', 'GatewayDeviceMonitorCell')
const useGatewayMetrics = moduleRegistry.getResourceItem<typeof UseGatewayRuntimeMetricsLoader>('edge-master-ui', 'hooks', 'useGatewayRuntimeMetricsLoader')
// 只监控边缘节点分类的当前页，切换分类或重新加载列表时撤掉旧查询目标。
const gatewayMetricTargets = computed(() => activeType.value === 'gateway' && !loading.value
  ? rows.value.map(device => ({ id: device.id, deviceId: device.id, productId: device.productId }))
  : [])
const gatewayMetrics = useGatewayMetrics?.(gatewayMetricTargets)
const { sidebarProps, spaceAreaSupported, loading: scopeLoading, loadError: scopeLoadError, handleScopeChange } = scope
const scopeCollapsed = ref(false)
function formatTableTime(value?: string | number | null) {
  if (!value || value === '--') return t('IotDeviceList.scope.noReport')
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
function formatAreaName(record: { areaBindings?: Array<{ area?: string }>; area?: string }) {
  const boundAreas = record.areaBindings?.map(item => item.area).filter(Boolean).join(' / ')
  const isEmptyArea = !record.area || ['--', '—'].includes(record.area)
  return boundAreas || (isEmptyArea ? t('IotDeviceList.scope.unboundArea') : record.area)
}
function formatGroupName(record: { groupBindings?: Array<{ name?: string }>; groupName?: string }) {
  return record.groupBindings?.map(group => group.name).filter(Boolean).join('、')
    || record.groupName
    || t('IotDeviceList.scope.unassignedGroup')
}
function formatBrandModel(value?: string) {
  const normalized = value?.trim()
  return normalized && !['--', '—'].includes(normalized)
    ? normalized
    : t('IotDeviceDetail.common.unconfigured')
}
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
const { deleteGroup, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup } = useIotDeviceGroupManagement({
  getActiveScope: () => ({ type: scope.scopeType.value, id: scope.scopeId.value }), reloadGroups: scope.reloadGroups, changeScope: handleScopeChange,
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
  value, label: t(`UnifiedDeviceList.${value}`), count: statusCounts.value[value] ?? '—',
})))
const rowSelection = computed(() => ({ selectedRowKeys: selectedIds.value, onChange: (keys: Array<string | number>) => { selectedIds.value = keys.map(String); batchMode.value = keys.length > 0 } }))
// 未启用空间模块时，列表不展示无意义的空间空态，仅保留设备分组。
const scopeColumn = computed(() => ({
  title: t(spaceAreaSupported.value === false ? 'UnifiedDeviceList.group' : 'UnifiedDeviceList.areaAndGroup'),
  key: 'area',
  width: spaceAreaSupported.value === false ? 180 : 220,
}))
const columns = computed(() => [
  { title: t('UnifiedDeviceList.name'), key: 'name', width: 280, fixed: 'left' },
  { title: t('UnifiedDeviceList.product'), key: 'productName', width: 180, ellipsis: true },
  { title: t('IotDeviceList.table.brandModel'), key: 'brandModel', width: 160 },
  scopeColumn.value,
  { title: t('UnifiedDeviceList.status'), key: 'status', width: 100 },
  ...(activeType.value === 'all' ? [{ title: t('IotDeviceDetail.detail.lastReport'), key: 'lastReportTime', width: 160, ellipsis: true }] : []),
  ...(activeType.value === 'all' ? [{ title: t('Instance.index.133466-5'), key: 'createdAt', width: 160, ellipsis: true }] : []),
  ...(activeType.value === 'gateway' ? [{ title: t('GatewayDeviceCard.monitor'), key: 'monitor', width: 220 }] : []),
  ...(['gateway', 'video'].includes(activeType.value) ? [{ title: t('UnifiedDeviceList.channel'), key: 'channel', width: 100 }] : []),
  { title: t('UnifiedDeviceList.action'), key: 'action', width: 90, fixed: 'right', align: 'center' },
])

const [DefineEmptyCreateAction1, EmptyCreateButtonAction1] = createReusableTemplate()
const [DefineEmptyCreateAction2, EmptyCreateButtonAction2] = createReusableTemplate()
</script>
<style scoped lang="less">
.unified-device-list {
  min-width: 0;
  min-height: 0;
  /*
   * 作为布局面板的 flex 项：面板已定高，这里收缩到面板内容高度，
   * 页内滚动交给 __table，避免出现第二条滚动条。
   */
  flex: 0 1 auto;
  overflow: hidden;
}
.unified-device-list__header { flex-shrink: 0; }
.unified-device-list__types { --slanted-tabs-background: transparent; z-index: 2; }
.unified-device-list__layout { flex: 1 1 0; width: 100%; min-height: 0;align-items: stretch; }
.unified-device-list :deep(.unified-device-list__scope), .unified-device-list :deep(.unified-device-list__scope > .ant-spin-container) { height: 100%; min-height: 0; }
.unified-device-list :deep(.iot-device-scope > .ant-flex:empty) { display: none; }
.unified-device-list__scope-toggle { position: absolute; top: 50%; right: -1px; transform: translate(100%, -50%); z-index: 4; width: 22px; height: 56px; padding: 0; color: var(--primary-color); background: color-mix(in srgb, var(--info-bg) 60%, transparent); border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent); border-left: 0; border-radius: 0 10px 10px 0; box-shadow: none; opacity: .75; transition: opacity .18s, width .18s, transform .18s; }
.unified-device-list__layout > .equal-height-columns__pane:first-child { position: relative; overflow: visible; }
.unified-device-list__scope-toggle.is-collapsed { right: 0; transform: translate(0, -50%); border-left: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent); }
.unified-device-list__layout > .equal-height-columns__pane:first-child:hover .unified-device-list__scope-toggle, .unified-device-list__scope-toggle:hover { width: 26px; opacity: 1; }

.unified-device-list :deep(.iot-device-scope.content-panel) { background: color-mix(in srgb, var(--bg-trans-8) 35%, transparent); border: 0; box-shadow: none; padding: 8px; }
.unified-device-list__layout > .equal-height-columns__pane:first-child:has(.unified-device-list__scope-toggle) { background: transparent; border-radius: var(--r-6); }

.unified-device-list__panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--space-3); overflow: hidden; }
.unified-device-list__panel.content-panel {
  --device-table-fixed-bg: color-mix(in srgb, var(--info-bg) 28%, var(--bg));
  --device-table-header-bg: color-mix(in srgb, var(--info-bg) 55%, var(--bg));
  background-color: color-mix(in srgb, var(--info-bg) 25%, var(--bg-trans-8));
}
.unified-device-list__filters, .unified-device-list__batch, .unified-device-list__pagination { flex-shrink: 0; }
.unified-device-list__filters { align-items: center; flex-wrap: nowrap; }
.unified-device-list__filters > .device-asset-search { flex: 1 1 auto; width: auto; min-width: 0; }
.unified-device-list__toolbar-actions { flex-shrink: 0; margin-inline-start: auto; gap: 8px; }
.unified-device-list__action-divider { margin: 0 2px; height: 24px; opacity: .45; }
.unified-device-list__category { margin-inline-end: 0; color: var(--ink-3); }
.unified-device-list__table { flex: 1; min-height: 0; overflow: auto; }
.unified-device-list__row-actions { width: 100%; justify-content: flex-end; }
.unified-device-list__table small { display: block; color: var(--ink-3); font-weight: normal; }
.unified-device-list__name { padding: 0; height: auto; font-weight: 600; }
.unified-device-list__pagination { text-align: right; }
.unified-device-list__batch { justify-content: flex-end; align-items: center; min-height: 48px; padding: 8px 12px; border-radius: 8px; }
</style>
