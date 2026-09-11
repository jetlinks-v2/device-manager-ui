<template>
  <FullPage flex transparent-background class="unified-device-list">
    <a-flex class="unified-device-list__header" align="center" justify="space-between" wrap="wrap" :gap="16">
      <a-segmented class="unified-device-list__types" :value="activeType" :options="tabs" @change="changeType(String($event))" />
    </a-flex>
    <ContentPanel>
	    <EqualHeightColumns class="unified-device-list__layout" :left-width="scopeCollapsed ? '2.5rem' : '15rem'" right-width="1fr">
		    <template #left>
			    <a-spin v-if="!scopeCollapsed" :spinning="scopeLoading" wrapper-class-name="unified-device-list__scope">
				    <IotDeviceScopeSidebar v-bind="sidebarProps" @change="handleScopeChange" @create-group="openCreateGroup" @create-child-group="openCreateChildGroup" @edit-group="openEditGroup" @delete-group="confirmDeleteGroup" />
			    </a-spin>
			    <a-button :class="['unified-device-list__scope-toggle', { 'is-collapsed': scopeCollapsed }]" type="text" :aria-label="scopeCollapsed ? '展开设备范围' : '收起设备范围'" @click="scopeCollapsed = !scopeCollapsed"><AIcon :type="scopeCollapsed ? 'RightOutlined' : 'LeftOutlined'" /></a-button>
		    </template>
		    <template #right>
			    <div class="unified-device-list__panel">
				    <a-flex align="center" justify="space-between" wrap="wrap" :gap="12" class="unified-device-list__filters">
					    <IotDeviceAssetSearchBar v-model:filter-terms="searchTerms" :filter-fields="filterFields" :common-filter-fields="commonFilterFields" @search="search" />
					    <RegistryComponent page-code="unified-device-list" code="toolbar-actions" is="a-space" :size="12" class="unified-device-list__toolbar-actions">
						    <a-space :size="2" class="unified-device-list__statuses" role="group" :aria-label="t('IotDeviceList.filter.status')">
							    <a-button
								    v-for="option in statusOptions"
								    :key="option.value"
								    type="text"
								    size="small"
								    class="unified-device-list__status"
								    :class="{ 'unified-device-list__status--selected': status === option.value }"
								    :aria-pressed="status === option.value"
								    @click="changeStatus(option.value)"
							    >
								    <a-space :size="6">
									    <a-badge :status="option.value === 'online' ? 'success' : option.value === 'offline' ? 'error' : 'default'" />
									    {{ option.label }}
									    <span class="unified-device-list__status-count">{{ statusCounts[option.value] ?? '—' }}</span>
								    </a-space>
							    </a-button>
						    </a-space>
						    <a-divider type="vertical" class="unified-device-list__action-divider" />
						    <a-button v-if="activeType === 'all'" type="primary" :disabled="busy" @click="editing = null; editOpen = true">
							    <template #icon><AIcon type="PlusOutlined" /></template>
							    {{ t('IotDeviceList.action.create') }}
						    </a-button>
						    <a-button v-if="activeProvider?.create" :key="`create-${activeProvider.id}`" type="primary" :disabled="busy || !canCreate(activeProvider)" @click="openCreate(activeProvider)">
							    <template #icon><AIcon type="PlusOutlined" /></template>
							    {{ activeProvider.create.label() }}
						    </a-button>
						    <!-- 批量配置仅面向边缘节点，其他设备分类不提供入口。 -->
						    <a-button v-if="activeType === 'gateway'" @click="openBatchPage">{{ t('UnifiedDeviceList.batch') }}</a-button>
					    </RegistryComponent>
				    </a-flex>
				    <a-flex v-if="batchMode" wrap="wrap" :gap="12" class="unified-device-list__batch">
					    <span>{{ t('IotDeviceList.toolbar.selected', { selected: selectedIds.length }) }}</span>
					    <component v-if="activeProvider?.batchComponent" :is="activeProvider.batchComponent" :devices="rows" :selected-ids="selectedIds" @changed="refresh" />
					    <template v-else>
						    <a-button :disabled="!selectedIds.length || busy || !selected.every(device => allowed(device, 'enable'))" @click="batchToggle('enable')">{{ t('IotDeviceList.action.batchEnable') }}</a-button>
						    <a-button :disabled="!selectedIds.length || busy || !selected.every(device => allowed(device, 'disable'))" @click="batchToggle('disable')">{{ t('IotDeviceList.action.batchDisable') }}</a-button>
					    </template>
					    <a-button :disabled="!selectedIds.length || busy" @click="assignAreaOpen = true">{{ t('IotDeviceList.action.assignArea') }}</a-button>
					    <a-button :disabled="!selectedIds.length || busy" @click="assignGroupOpen = true">{{ t('IotDeviceList.action.assignGroup') }}</a-button>
				    </a-flex>
				    <a-alert v-if="error || scopeLoadError" type="error" show-icon :message="error || t('UnifiedDeviceList.loadFailed')"><template #action><a-button @click="refresh">{{ t('UnifiedDeviceList.refresh') }}</a-button></template></a-alert>
				    <div class="unified-device-list__table">
					    <a-table row-key="id" :columns="columns" :data-source="rows" :loading="loading" :pagination="false" :row-selection="rowSelection" :scroll="{ x: 'max-content' }">
						    <template #bodyCell="{ column, record }">
							    <template v-if="column.key === 'name'">
								    <a-flex align="center" :gap="8"><a-tooltip :title="t(`UnifiedDeviceList.${record.connectionStatus}`)"><a-badge :status="record.connectionStatus === 'online' ? 'success' : record.connectionStatus === 'offline' ? 'error' : 'default'" /></a-tooltip>
									    <div>
										    <a-flex align="center" :gap="8" wrap="wrap">
											    <a-button type="link" class="unified-device-list__name" @click="openDetail(record)">{{ record.name }}</a-button>
											    <a-tag v-if="activeType === 'all'" :bordered="false" class="unified-device-list__category">{{ providerOf(record)?.label() }}</a-tag>
										    </a-flex>
										    <small>{{ record.networkAddress || record.identifier }}</small>
									    </div>
								    </a-flex>
							    </template>
							    <template v-else-if="column.key === 'product'">
								    <div>{{ record.productName || '—' }}</div>
								    <small>{{ [record.productManufacturer, record.productModel].filter(Boolean).join(' ') || '—' }}</small>
							    </template>
							    <template v-else-if="column.key === 'productName'">
								    <div>{{ record.productName || '—' }}</div>
								    <small>{{ [record.productManufacturer, record.productModel].filter(Boolean).join(' ') || '—' }}</small>
							    </template>
							    <template v-else-if="column.key === 'area'">
								    <div>{{ record.areaBindings?.map(area => area.area).join(' / ') || record.area || '—' }}</div>
								    <small>{{ record.groupBindings?.map(group => group.name).join('、') || record.groupName || '—' }}</small>
							    </template>
							    <template v-else-if="column.key === 'createdAt'">{{ formatTableTime(record.createdAt) }}</template>
							    <template v-else-if="column.key === 'lastReportTime'">{{ formatTableTime(record.lastReportTime) }}</template>
							    <template v-else-if="column.key === 'scope'">
								    <div>{{ record.areaBindings?.map(area => area.area).join(' / ') || record.area || '—' }}</div>
								    <small>{{ record.groupBindings?.map(group => group.name).join('、') || record.groupName || '—' }}</small>
							    </template>
							    <template v-else-if="column.key === 'channel'">{{ record.channelNumber ?? '—' }}</template>
							    <template v-else-if="column.key === 'monitor'">
								    <component :is="gatewayMonitorCell" :snapshot="gatewayMetrics?.metricsMap[record.id]" />
							    </template>
							    <template v-else-if="column.key === 'action'">
								    <a-space :size="4" class="unified-device-list__row-actions">
									    <a-button type="link" size="small" @click="openDetail(record)">{{ t('IotDeviceList.action.detailShort') }}</a-button>
									    <a-button v-if="allowed(record, 'update')" type="link" size="small" :disabled="busy" @click="edit(record)">{{ t('IotDeviceList.action.editShort') }}</a-button>
									    <a-button v-if="allowed(record, record.connectionStatus === 'disabled' ? 'enable' : 'disable')" type="link" size="small" :danger="record.connectionStatus !== 'disabled'" :disabled="busy" @click="toggle(record)">{{ t(record.connectionStatus === 'disabled' ? 'IotDeviceList.action.enableShort' : 'IotDeviceList.action.disableShort') }}</a-button>
									    <a-button v-if="allowed(record, 'delete')" type="link" size="small" danger :disabled="busy || !canDelete(record)" @click="remove(record)">{{ t('IotDeviceList.action.deleteShort') }}</a-button>
								    </a-space>
							    </template>
						    </template>
					    </a-table>
				    </div>
				    <a-pagination class="unified-device-list__pagination" :current="pageIndex + 1" :page-size="pageSize" :total="total" :page-size-options="['10', '20', '50']" show-size-changer :show-total="value => t('UnifiedDeviceList.total', { count: value })" @change="changePage" />
			    </div>
		    </template>
	    </EqualHeightColumns>
    </ContentPanel>
    <component v-if="createEntry" :is="createEntry.component" :open="true" @update:open="createEntry = undefined" @saved="refresh" />
    <IotAddDeviceDrawer v-if="!editing || editing.category === 'device'" v-model:open="editOpen" :project-id="projectId" :device="editing" @saved="refresh" @created="refresh" />
    <component v-else-if="editing && providerOf(editing)?.editComponent" :is="providerOf(editing)?.editComponent" v-model:open="editOpen" :gateway="editing" :device="editing" :project-id="projectId" @saved="refresh" />
    <component v-if="detailDevice && providerOf(detailDevice)?.detailComponent" :is="providerOf(detailDevice)?.detailComponent" v-bind="providerOf(detailDevice)?.detailProps?.(detailDevice)" @close-drawer="detailDevice = null" @close="detailDevice = null" />
    <IotDeviceAssignAreaModal v-model:open="assignAreaOpen" :project-id="projectId" :selected-device-count="selectedIds.length" :saving="busy" @save="assignArea" />
    <IotDeviceAssignGroupModal v-model:open="assignGroupOpen" :selected-device-count="selectedIds.length" :saving="busy" @save="assignGroup" />
    <IotDeviceGroupNameModal v-model:open="groupDialogOpen" :mode="groupDialogMode" :initial-name="groupEditing?.name" :saving="groupSaving" :error="groupDialogError" @save="saveGroup" />
  </FullPage>
</template>
<script setup lang="ts">
import { computed, type Component } from 'vue'
import { ref } from 'vue'
import dayjs from 'dayjs'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import EqualHeightColumns from '@jetlinks-web-core/components/EqualHeightColumns/index.vue'
import { useRoute } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store'
import { encodeConditionFilterQuery } from '@jetlinks-web-core/components/ConditionFilter'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import type { useGatewayRuntimeMetricsLoader as UseGatewayRuntimeMetricsLoader } from '@edge-master-ui/views/workbench/gateway/hooks/useGatewayRuntimeMetricsLoader'
import IotDeviceScopeSidebar from '../components/IotDeviceScopeSidebar.vue'
import IotDeviceAssetSearchBar from '../components/IotDeviceAssetSearchBar.vue'
import IotAddDeviceDrawer from '../components/IotAddDeviceDrawer.vue'
import IotDeviceAssignAreaModal from '../components/IotDeviceAssignAreaModal.vue'
import IotDeviceAssignGroupModal from '../components/IotDeviceAssignGroupModal.vue'
import IotDeviceGroupNameModal from '../components/IotDeviceGroupNameModal.vue'
import { useIotDeviceGroupManagement } from '../hooks/useIotDeviceGroupManagement'
import type { DeviceGroup } from '../../../../api/deviceGroup'
import { useUnifiedDeviceList } from './useUnifiedDeviceList'
import { useUnifiedDeviceActions } from './useUnifiedDeviceActions'
const { t } = useI18n()
const route = useRoute()
const menu = useMenuStore()
// 已选网关按明确 ID 传入；未选择网关时在批量页按当前范围加载，由矩阵决定实际下发项。
function openBatchPage() {
  const gatewayIds = selected.value.filter(device => device.category === 'gateway').map(device => device.id)
  const currentQuery = encodeConditionFilterQuery(searchTerms.value, filterFields.value)
  menu.jumpPage('iot-user-device-list/Batch', { query: {
    ...route.query, q: currentQuery || route.query.q || undefined, gatewayIds: gatewayIds.length ? gatewayIds : undefined,
    gatewayScope: gatewayIds.length ? undefined : 'query',
  } })
}
const { providers, activeType, activeProvider, scope, filterFields, commonFilterFields, searchTerms, status, rows, total, pageIndex, pageSize, loading, error, counts, statusCounts, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, changePage } = useUnifiedDeviceList()
const gatewayMonitorCell = moduleRegistry.getResourceItem<Component>('edge-master-ui', 'components', 'GatewayDeviceMonitorCell')
const useGatewayMetrics = moduleRegistry.getResourceItem<typeof UseGatewayRuntimeMetricsLoader>('edge-master-ui', 'hooks', 'useGatewayRuntimeMetricsLoader')
// 只监控边缘节点分类的当前页，切换分类或重新加载列表时撤掉旧查询目标。
const gatewayMetricTargets = computed(() => activeType.value === 'gateway' && !loading.value
  ? rows.value.map(device => ({ id: device.id, deviceId: device.id, productId: device.productId }))
  : [])
const gatewayMetrics = useGatewayMetrics?.(gatewayMetricTargets)
const { sidebarProps, loading: scopeLoading, loadError: scopeLoadError, handleScopeChange } = scope
const scopeCollapsed = ref(false)
function formatTableTime(value?: string | number | null) {
  if (!value || value === '--') return '—'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
const { projectId, editing, editOpen, createEntry, canCreate, openCreate, detailDevice, busy, selected, allowed, openDetail, edit, toggle, remove, canDelete, batchToggle, assignAreaOpen, assignGroupOpen, assignArea, assignGroup } = useUnifiedDeviceActions(rows, selectedIds, providerOf, refresh, activeProvider)
const { deleteGroup, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup } = useIotDeviceGroupManagement({
  getActiveScope: () => ({ type: scope.scopeType.value, id: scope.scopeId.value }), reloadGroups: scope.reloadGroups, changeScope: handleScopeChange,
})
function confirmDeleteGroup(group: DeviceGroup) { Modal.confirm({ title: t('IotDeviceList.scope.deleteGroup'), onOk: () => deleteGroup(group) }) }
const tabs = computed(() => [{ value: 'all', label: `${t('UnifiedDeviceList.all')} ${counts.value.all ?? '—'}` }, ...providers.value.filter(provider => provider.id !== 'device').map(provider => ({ value: provider.id, label: `${provider.label()} ${counts.value[provider.id] ?? '—'}` }))])
const statusOptions = computed(() => ['online', 'offline', 'disabled'].map(value => ({ value, label: t(`UnifiedDeviceList.${value}`) })))
const rowSelection = computed(() => ({ selectedRowKeys: selectedIds.value, onChange: (keys: Array<string | number>) => { selectedIds.value = keys.map(String); batchMode.value = keys.length > 0 } }))
const columns = computed(() => [
  { title: t('UnifiedDeviceList.name'), key: 'name', width: 280, fixed: 'left' },
  { title: t('UnifiedDeviceList.product'), key: 'productName', width: 180 },
  { title: t('UnifiedDeviceList.areaAndGroup'), key: 'area', width: 220 },
  ...(activeType.value === 'all' ? [{ title: '最后上报时间', key: 'lastReportTime', width: 160 }] : []),
  ...(activeType.value === 'all' ? [{ title: '创建时间', key: 'createdAt', width: 160 }] : []),
  ...(activeType.value === 'gateway' ? [{ title: t('GatewayDeviceCard.monitor'), key: 'monitor', width: 220 }] : []),
  ...(['gateway', 'video'].includes(activeType.value) ? [{ title: t('UnifiedDeviceList.channel'), key: 'channel', width: 100 }] : []),
  { title: t('UnifiedDeviceList.action'), key: 'action', width: 210, fixed: 'right', align: 'center' },
])
</script>
<style scoped lang="less">
.unified-device-list { min-width: 0; min-height: 0; gap: var(--space-4); overflow: hidden; }
.unified-device-list__header { flex-shrink: 0; }
.unified-device-list__types.ant-segmented { padding: 0; background: transparent; box-shadow: none; }
.unified-device-list__types :deep(.ant-segmented-group) { gap: var(--space-2); }
.unified-device-list__types :deep(.ant-segmented-item) { color: var(--ink-2); border-radius: var(--r-3); }
.unified-device-list__types :deep(.ant-segmented-item-label) { padding: 5px 14px; min-height: 32px; line-height: 22px; font-variant-numeric: tabular-nums; }
.unified-device-list__types :deep(.ant-segmented-item-selected),
.unified-device-list__types :deep(.ant-segmented-thumb) { color: var(--primary-color); background: var(--info-bg); box-shadow: none; }
.unified-device-list__types :deep(.ant-segmented-item-selected) { font-weight: 500; }
.unified-device-list__types :deep(.ant-segmented-item:hover) { color: var(--primary-color); background: var(--info-bg); }
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
.unified-device-list__filters, .unified-device-list__statuses, .unified-device-list__batch, .unified-device-list__pagination { flex-shrink: 0; }
.unified-device-list__filters { align-items: center; flex-wrap: nowrap; }
.unified-device-list__filters > .device-asset-search { flex: 1 1 auto; width: auto; min-width: 0; }
.unified-device-list__toolbar-actions { flex-shrink: 0; margin-inline-start: auto; gap: 8px; }
.unified-device-list__statuses { padding: 3px; border: 1px solid color-mix(in srgb, var(--primary-color) 16%, var(--line)); border-radius: var(--r-3); background: color-mix(in srgb, var(--bg) 86%, var(--info-bg)); }
.unified-device-list__status { height: 26px; padding-inline: 10px; color: var(--ink-2); }
.unified-device-list__status--selected { color: var(--primary-color); background: var(--info-bg); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 12%, transparent); }
.unified-device-list__status--selected:hover { color: var(--primary-color); background: var(--info-bg); }
.unified-device-list__status-count { font-variant-numeric: tabular-nums; font-size: 12px; opacity: 0.75; }
.unified-device-list__action-divider { margin: 0 2px; height: 24px; opacity: .45; }
.unified-device-list__category { margin-inline-end: 0; color: var(--ink-3); }
.unified-device-list__table { flex: 1; min-height: 0; overflow: auto; }
.unified-device-list__table :deep(.ant-table) { background: transparent; }
.unified-device-list__table :deep(.ant-table-thead > tr > th) { background: var(--device-table-header-bg); }
.unified-device-list__table :deep(.ant-table-tbody > tr:not(.ant-table-row-selected) > td) { background: transparent; border-bottom-color: color-mix(in srgb, var(--primary-color) 9%, transparent); }
// 固定列保持实底，横向滚动时避免透出下方单元格文字。
.unified-device-list__table :deep(.ant-table-tbody > tr:not(.ant-table-row-selected) > .ant-table-cell-fix-left),
.unified-device-list__table :deep(.ant-table-tbody > tr:not(.ant-table-row-selected) > .ant-table-cell-fix-right) { background: var(--device-table-fixed-bg); }
.unified-device-list__table :deep(.ant-table-tbody > tr:hover > td),
.unified-device-list__table :deep(.ant-table-tbody > tr > td.ant-table-cell-row-hover),
.unified-device-list__table :deep(.ant-table-tbody > tr.ant-table-row-selected > td) { background: var(--info-bg); }
.unified-device-list__row-actions { width: 100%; justify-content: flex-end; }
.unified-device-list__table small { display: block; color: var(--ink-3); font-weight: normal; }
.unified-device-list__name { padding: 0; height: auto; font-weight: 600; }
.unified-device-list__pagination { text-align: right; }
.unified-device-list__batch { justify-content: flex-end; align-items: center; min-height: 48px; padding: 8px 12px; color: #f5f8ff; background: #1f2d42; border: 1px solid #31445f; border-radius: 8px; }
</style>
