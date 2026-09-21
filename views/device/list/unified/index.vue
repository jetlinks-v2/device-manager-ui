<template>
  <!-- 卡片切换充当面板顶栏：flush 让它与布局面板贴合，左上角一起拉平。 -->
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
					    <RegistryComponent page-code="unified-device-list" code="toolbar-actions" is="a-space" :size="12" class="unified-device-list__toolbar-actions">
						    <SwitchGroup
						    	:model-value="status"
						    	:options="statusOptions"
						    	:aria-label="t('IotDeviceList.filter.status')"
						    	@change="changeStatus"
						    >
						    	<template #option="{ option }">
						    		<span>{{ option.label }}</span>
						    	</template>
						    </SwitchGroup>
						    <a-divider type="vertical" class="unified-device-list__action-divider" />
						    <a-button v-if="activeType === 'all' || isIotEntry" type="primary" :disabled="busy" @click="editing = null; editOpen = true">
							    <template #icon><AIcon type="PlusOutlined" /></template>
							    {{ t('IotDeviceList.action.create') }}
						    </a-button>
						    <a-button v-if="activeProvider?.create" :key="`create-${activeProvider.id}`" type="primary" :disabled="busy || !canCreate(activeProvider)" @click="openCreate(activeProvider)">
							    <template #icon><AIcon type="PlusOutlined" /></template>
							    {{ activeProvider.create.label() }}
						    </a-button>
						    <!-- 批量配置仅面向边缘节点，其他设备分类不提供入口。 -->
						    <a-dropdown v-if="activeType === 'gateway'">
						      <a-button>
						        {{ t('UnifiedDeviceList.batch') }}
						        <AIcon type="DownOutlined" />
						      </a-button>
						      <template #overlay>
						        <a-menu @click="openBatchPage">
						          <a-menu-item key="algorithms">{{ t('UnifiedDeviceList.batchAlgorithms') }}</a-menu-item>
						          <a-menu-item key="plugins">{{ t('UnifiedDeviceList.batchPlugins') }}</a-menu-item>
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
					    </template>
					    <a-button :disabled="!selectedIds.length || busy" @click="assignAreaOpen = true">{{ t('IotDeviceList.action.assignArea') }}</a-button>
					    <a-button :disabled="!selectedIds.length || busy" @click="assignGroupOpen = true">{{ t('IotDeviceList.action.assignGroup') }}</a-button>
				    </a-flex>
				    <a-alert v-if="error || scopeLoadError" type="error" show-icon :message="error || t('UnifiedDeviceList.loadFailed')"><template #action><a-button @click="refresh">{{ t('UnifiedDeviceList.refresh') }}</a-button></template></a-alert>
				    <div class="unified-device-list__table">
					    <a-table row-key="id" :columns="columns" :data-source="rows" :loading="loading" :pagination="false" :row-selection="rowSelection" :scroll="{ x: 'max-content' }">
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
								    <div>{{ record.productName || '—' }}</div>
								    <small>{{ [record.productManufacturer, record.productModel].filter(Boolean).join(' ') || '—' }}</small>
							    </template>
						    <template v-else-if="column.key === 'productName'">
								    <div>{{ record.productName || '—' }}</div>
						    </template>
						    <template v-else-if="column.key === 'brandModel'">
								    <div>{{ formatBrandModel(record.productManufacturer) }}</div>
								    <small>{{ formatBrandModel(record.productModel) }}</small>
						    </template>
						    <template v-else-if="column.key === 'area'">
								    <div>{{ formatAreaName(record) }}</div>
								    <small>{{ record.groupBindings?.map(group => group.name).join('、') || record.groupName || t('IotDeviceList.scope.unassignedGroup') }}</small>
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
				    <a-pagination class="unified-device-list__pagination" :current="pageIndex + 1" :page-size="pageSize" :total="total" :page-size-options="['10', '20', '50']" show-size-changer :show-total="value => t('UnifiedDeviceList.total', { count: value })" @change="changePage" />
			    </div>
		    </template>
	    </EqualHeightColumns>
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
import SlantedTabs from '@jetlinks-web-core/components/SlantedTabs'
import { useRoute } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store'
import { encodeConditionFilterQuery } from '@jetlinks-web-core/components/ConditionFilter'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import type { SwitchGroupOption } from '@jetlinks-web-core/components/SwitchGroup'
import type { useGatewayRuntimeMetricsLoader as UseGatewayRuntimeMetricsLoader } from '@edge-master-ui/views/workbench/gateway/hooks/useGatewayRuntimeMetricsLoader'
import IotDeviceScopeSidebar from '../components/IotDeviceScopeSidebar.vue'
import IotDeviceAssetSearchBar from '../components/IotDeviceAssetSearchBar.vue'
import IotAddDeviceDrawer from '../components/IotAddDeviceDrawer.vue'
import IotDeviceAssignAreaModal from '../components/IotDeviceAssignAreaModal.vue'
import IotDeviceAssignGroupModal from '../components/IotDeviceAssignGroupModal.vue'
import IotDeviceGroupNameModal from '../components/IotDeviceGroupNameModal.vue'
import { useIotDeviceGroupManagement } from '../hooks/useIotDeviceGroupManagement'
import { getIotDeviceListMenuCode } from '../hooks/useIotDeviceRouting'
import type { DeviceGroup } from '../../../../api/deviceGroup'
import { useUnifiedDeviceList } from './useUnifiedDeviceList'
import { useUnifiedDeviceActions } from './useUnifiedDeviceActions'
const { t } = useI18n()
const route = useRoute()
const deviceMenuCode = computed(() => getIotDeviceListMenuCode(route))
const menu = useMenuStore()
// 已选网关按明确 ID 传入；未选择网关时在批量页按当前范围加载，由矩阵决定实际下发项。
function openBatchPage({ key }: { key: string | number }) {
  const gatewayIds = selected.value.filter(device => device.category === 'gateway').map(device => device.id)
  const currentQuery = encodeConditionFilterQuery(searchTerms.value, filterFields.value)
  menu.jumpPage('iot-user-device-list/Batch', { query: {
    ...route.query, q: currentQuery || route.query.q || undefined, gatewayIds: gatewayIds.length ? gatewayIds : undefined,
    gatewayScope: gatewayIds.length ? undefined : 'query',
    batchTab: String(key),
  } })
}
const { providers, isIotEntry, tabs, activeType, activeProvider, scope, filterFields, commonFilterFields, searchTerms, status, rows, total, pageIndex, pageSize, loading, error, counts, statusCounts, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, changePage, clearBatchSelection } = useUnifiedDeviceList()
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
  if (!value || value === '--') return t('IotDeviceList.scope.noReport')
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
function formatAreaName(record: { areaBindings?: Array<{ area?: string }>; area?: string }) {
  const boundAreas = record.areaBindings?.map(item => item.area).filter(Boolean).join(' / ')
  const isEmptyArea = !record.area || ['--', '—'].includes(record.area)
  return boundAreas || (isEmptyArea ? t('IotDeviceList.scope.unboundArea') : record.area)
}
function formatBrandModel(value?: string) {
  const normalized = value?.trim()
  return normalized && !['--', '—'].includes(normalized)
    ? normalized
    : t('IotDeviceDetail.common.unconfigured')
}
const { projectId, editing, editOpen, createEntry, canCreate, openCreate, detailDevice, busy, selected, allowed, openDetail, edit, toggle, remove, canDelete, batchToggle, assignAreaOpen, assignGroupOpen, assignArea, assignGroup } = useUnifiedDeviceActions(rows, selectedIds, clearBatchSelection, providerOf, refresh, activeProvider)
function handleBatchChanged() {
  clearBatchSelection()
  refresh()
}
const { deleteGroup, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup } = useIotDeviceGroupManagement({
  getActiveScope: () => ({ type: scope.scopeType.value, id: scope.scopeId.value }), reloadGroups: scope.reloadGroups, changeScope: handleScopeChange,
})
function confirmDeleteGroup(group: DeviceGroup) { Modal.confirm({ title: t('IotDeviceList.scope.deleteGroup'), onOk: () => deleteGroup(group) }) }
// 状态点属于业务语义，只在页面侧维护，并通过 SwitchGroup 的 option 插槽渲染；计数由状态选项统一下发。
const statusTones: Record<string, 'success' | 'error' | 'default'> = { online: 'success', offline: 'error', disabled: 'default' }
const statusOptions = computed<SwitchGroupOption[]>(() => ['online', 'offline', 'disabled'].map(value => ({
  value, label: t(`UnifiedDeviceList.${value}`), count: statusCounts.value[value] ?? '—',
})))
const rowSelection = computed(() => ({ selectedRowKeys: selectedIds.value, onChange: (keys: Array<string | number>) => { selectedIds.value = keys.map(String); batchMode.value = keys.length > 0 } }))
const columns = computed(() => [
  { title: t('UnifiedDeviceList.name'), key: 'name', width: 280, fixed: 'left' },
  { title: t('UnifiedDeviceList.product'), key: 'productName', width: 180 },
  { title: t('IotDeviceList.table.brandModel'), key: 'brandModel', width: 160 },
  { title: t('UnifiedDeviceList.areaAndGroup'), key: 'area', width: 220 },
  { title: t('UnifiedDeviceList.status'), key: 'status', width: 100 },
  ...(activeType.value === 'all' ? [{ title: '最后上报时间', key: 'lastReportTime', width: 160 }] : []),
  ...(activeType.value === 'all' ? [{ title: '创建时间', key: 'createdAt', width: 160 }] : []),
  ...(activeType.value === 'gateway' ? [{ title: t('GatewayDeviceCard.monitor'), key: 'monitor', width: 220 }] : []),
  ...(['gateway', 'video'].includes(activeType.value) ? [{ title: t('UnifiedDeviceList.channel'), key: 'channel', width: 100 }] : []),
  { title: t('UnifiedDeviceList.action'), key: 'action', width: 80, fixed: 'right', align: 'center' },
])
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
