<template>
  <FullPage flex transparent-background class="unified-device-list">
    <a-flex class="unified-device-list__header" align="center" justify="space-between" wrap="wrap" :gap="16">
      <a-flex align="center" :gap="16" wrap="wrap"><strong>{{ t('UnifiedDeviceList.title') }}</strong>
        <a-segmented :value="activeType" :options="tabs" @change="changeType(String($event))" />
      </a-flex>
      <a-space>
        <a-button v-if="activeType === 'device'" @click="editing = null; editOpen = true">{{ t('IotDeviceList.action.create') }}</a-button>
        <a-button v-if="activeProvider?.create" type="primary" :disabled="busy || !canCreate(activeProvider)" @click="openCreate(activeProvider)">
          <template #icon><AIcon type="PlusOutlined" /></template>
          {{ activeProvider.create.label() }}
        </a-button>
        <a-button @click="openBatchPage">{{ t('UnifiedDeviceList.batch') }}</a-button>
      </a-space>
    </a-flex>
    <EqualHeightColumns class="unified-device-list__layout" left-width="15rem" right-width="1fr">
      <template #left>
        <a-spin :spinning="scopeLoading" wrapper-class-name="unified-device-list__scope">
          <IotDeviceScopeSidebar v-bind="sidebarProps" @change="handleScopeChange" @create-group="openCreateGroup" @create-child-group="openCreateChildGroup" @edit-group="openEditGroup" @delete-group="confirmDeleteGroup" />
        </a-spin>
      </template>
      <template #right>
        <ContentPanel class="unified-device-list__panel">
          <a-flex align="center" wrap="wrap" :gap="12" class="unified-device-list__filters">
            <a-input-search v-model:value="keyword" allow-clear :placeholder="t('UnifiedDeviceList.search')" @search="search" />
            <a-radio-group :value="status" option-type="button" :options="statusOptions" @change="changeStatus($event.target.value)" />
            <span class="unified-device-list__summary">{{ summary ? t('UnifiedDeviceList.summary', summary) : '—' }}</span>
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
                  <a-flex align="center" :gap="8"><a-badge :status="record.connectionStatus === 'online' ? 'success' : record.connectionStatus === 'offline' ? 'error' : 'default'" />
                    <div><a-button type="link" class="unified-device-list__name" @click="openDetail(record)">{{ record.name }}</a-button><small>{{ record.networkAddress || record.identifier }}</small></div>
                  </a-flex>
                </template>
                <template v-else-if="column.key === 'category'">{{ providerOf(record)?.label() }}</template>
                <template v-else-if="column.key === 'brand'">{{ [record.productManufacturer, record.productModel].filter(Boolean).join(' ') || '—' }}</template>
                <template v-else-if="column.key === 'area'">{{ record.areaBindings?.map(area => area.area).join(' / ') || record.area || '—' }}</template>
                <template v-else-if="column.key === 'group'">{{ record.groupBindings?.map(group => group.name).join('、') || record.groupName || '—' }}</template>
                <template v-else-if="column.key === 'channel'">{{ record.channelNumber ?? '—' }}</template>
                <template v-else-if="column.key === 'status'"><a-tag :color="record.connectionStatus === 'online' ? 'green' : record.connectionStatus === 'offline' ? 'red' : undefined">{{ t(`UnifiedDeviceList.${record.connectionStatus}`) }}</a-tag></template>
                <template v-else-if="column.key === 'action'">
                  <a-space :size="4">
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
        </ContentPanel>
      </template>
    </EqualHeightColumns>
    <component v-if="createEntry" :is="createEntry.component" :open="true" @update:open="createEntry = undefined" @saved="refresh" />
    <IotAddDeviceDrawer v-if="!editing || editing.category === 'device'" v-model:open="editOpen" :project-id="projectId" :device="editing" @saved="refresh" @created="refresh" />
    <component v-else-if="editing && providerOf(editing)?.editComponent" :is="providerOf(editing)?.editComponent" v-model:open="editOpen" :gateway="editing" @saved="refresh" />
    <component v-if="detailDevice && providerOf(detailDevice)?.detailComponent" :is="providerOf(detailDevice)?.detailComponent" v-bind="providerOf(detailDevice)?.detailProps?.(detailDevice)" @close-drawer="detailDevice = null" @close="detailDevice = null" />
    <IotDeviceAssignAreaModal v-model:open="assignAreaOpen" :project-id="projectId" :selected-device-count="selectedIds.length" :saving="busy" @save="assignArea" />
    <IotDeviceAssignGroupModal v-model:open="assignGroupOpen" :selected-device-count="selectedIds.length" :saving="busy" @save="assignGroup" />
    <IotDeviceGroupNameModal v-model:open="groupDialogOpen" :mode="groupDialogMode" :initial-name="groupEditing?.name" :saving="groupSaving" :error="groupDialogError" @save="saveGroup" />
  </FullPage>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import EqualHeightColumns from '@jetlinks-web-core/components/EqualHeightColumns/index.vue'
import { useRoute } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store'
import IotDeviceScopeSidebar from '../components/IotDeviceScopeSidebar.vue'
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
  menu.jumpPage('iot-user-device-list/Batch', { query: {
    ...route.query, gatewayIds: gatewayIds.length ? gatewayIds : undefined,
    gatewayScope: gatewayIds.length ? undefined : 'query',
  } })
}
const { providers, activeType, activeProvider, scope, keyword, status, rows, total, pageIndex, pageSize, loading, error, counts, summary, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, changePage } = useUnifiedDeviceList()
const { sidebarProps, loading: scopeLoading, loadError: scopeLoadError, handleScopeChange } = scope
const { projectId, editing, editOpen, createEntry, canCreate, openCreate, detailDevice, busy, selected, allowed, openDetail, edit, toggle, remove, canDelete, batchToggle, assignAreaOpen, assignGroupOpen, assignArea, assignGroup } = useUnifiedDeviceActions(rows, selectedIds, providerOf, refresh)
const { deleteGroup, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup } = useIotDeviceGroupManagement({
  getActiveScope: () => ({ type: scope.scopeType.value, id: scope.scopeId.value }), reloadGroups: scope.reloadGroups, changeScope: handleScopeChange,
})
function confirmDeleteGroup(group: DeviceGroup) { Modal.confirm({ title: t('IotDeviceList.scope.deleteGroup'), onOk: () => deleteGroup(group) }) }
const tabs = computed(() => [...providers.value.map(provider => ({ value: provider.id, label: `${provider.label()} ${counts.value[provider.id] ?? '—'}` })), { value: 'all', label: `${t('UnifiedDeviceList.all')} ${counts.value.all ?? '—'}` }])
const statusOptions = computed(() => ['all', 'online', 'offline', 'disabled'].map(value => ({ value, label: t(`UnifiedDeviceList.${value}`) })))
const rowSelection = computed(() => ({ selectedRowKeys: selectedIds.value, onChange: (keys: Array<string | number>) => { selectedIds.value = keys.map(String); batchMode.value = keys.length > 0 } }))
const columns = computed(() => [
  { title: t('UnifiedDeviceList.name'), key: 'name', width: 230, fixed: 'left' },
  ...(activeType.value === 'all' ? [{ title: t('UnifiedDeviceList.category'), key: 'category', width: 110 }] : []),
  { title: t('UnifiedDeviceList.product'), dataIndex: 'productName', width: 180 },
  { title: t('UnifiedDeviceList.brand'), key: 'brand', width: 180 },
  { title: t('UnifiedDeviceList.area'), key: 'area', width: 200 },
  { title: t('UnifiedDeviceList.group'), key: 'group', width: 130 },
  ...(['gateway', 'video'].includes(activeType.value) ? [{ title: t('UnifiedDeviceList.channel'), key: 'channel', width: 100 }] : []),
  { title: t('UnifiedDeviceList.status'), key: 'status', width: 100 },
  { title: t('UnifiedDeviceList.action'), key: 'action', width: 250, fixed: 'right' },
])
</script>
<style scoped lang="less">
.unified-device-list { min-width: 0; min-height: 0; gap: var(--space-4); overflow: hidden; }
.unified-device-list__header { flex-shrink: 0; }
.unified-device-list__layout { flex: 1 1 0; width: 100%; min-height: 0; height: 0; align-items: stretch; }
.unified-device-list :deep(.unified-device-list__scope), .unified-device-list :deep(.unified-device-list__scope > .ant-spin-container) { height: 100%; min-height: 0; }
.unified-device-list :deep(.iot-device-scope > .ant-flex:empty) { display: none; }
.unified-device-list__panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--space-3); overflow: hidden; }
.unified-device-list__filters, .unified-device-list__batch, .unified-device-list__pagination { flex-shrink: 0; }
.unified-device-list__filters :deep(.ant-input-search) { width: 20rem; max-width: 100%; }
.unified-device-list__summary { margin-left: auto; color: var(--ink-3); }
.unified-device-list__table { flex: 1; min-height: 0; overflow: auto; }
.unified-device-list__table small { display: block; color: var(--ink-3); font-weight: normal; }
.unified-device-list__name { padding: 0; height: auto; font-weight: 600; }
.unified-device-list__pagination { text-align: right; }
.unified-device-list__batch { padding: var(--space-2); background: var(--info-bg); border-radius: var(--r-3); }
</style>
