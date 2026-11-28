<template>
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
  <DefineStatuses>
        <div class="unified-device-list__statuses" role="group" :aria-label="t('IotDeviceList.filter.status')">
          <a-button v-for="option in statusOptions" :key="option.value" type="text" class="unified-device-list__status" :class="{ 'is-selected': status === option.value }" :aria-pressed="status === option.value" @click="changeStatus(option.value)">
            <a-badge :status="statusTones[option.value]" /> {{ option.label }} <SkeletonText v-if="option.loading" :width="14" /><span v-else class="unified-device-list__status-count">{{ option.count }}</span>
          </a-button>
        </div>
  </DefineStatuses>
  <DefineActions>
        <RegistryComponent page-code="unified-device-list" code="toolbar-actions" :active-type="activeType" @saved="refresh" is="a-space" :size="8" class="unified-device-list__actions">
          <EmptyCreateButtonAction1 v-if="activeType === 'all' || isIotEntry" /><EmptyCreateButtonAction2 v-if="activeProvider?.create" />
          <a-dropdown>
						      <a-button>
						        {{ t('UnifiedDeviceList.moreActions') }}
						        <AIcon type="DownOutlined" />
						      </a-button>
						      <template #overlay>
						        <a-menu @click="handleBatchMenuClick">
					          <a-menu-item v-if="canDeviceBatchAction('export')" key="export">{{ t('Instance.index.133466-30') }}</a-menu-item>
					          <a-menu-item v-if="!isSaaS && canDeviceBatchAction('import')" key="import">{{ t('Instance.index.133466-31') }}</a-menu-item>
					          <a-menu-item v-if="canDeviceBatchAction('enable')" key="activateAll">{{ t('Instance.index.133466-32') }}</a-menu-item>
						          <a-menu-item v-if="activeType === 'gateway' && menu.hasMenu('algorithm-center')" key="algorithms">{{ t('UnifiedDeviceList.batchAlgorithms') }}</a-menu-item>
						          <a-menu-item v-if="activeType === 'gateway'" key="plugins">{{ t('UnifiedDeviceList.batchPlugins') }}</a-menu-item>
						          <a-menu-item key="syncStatus">
                        {{ t('IotDeviceList.action.syncStatus') }}
                      </a-menu-item>
						        </a-menu>
						      </template>
						    </a-dropdown>
        </RegistryComponent>
  </DefineActions>
  <PageChrome v-if="!isIotEntry && tabs.length > 1" flush><div ref="typeTabsElement"><SlantedTabs :fill="typeTabsFill" class="unified-device-list__types" :style="typeTabsStyle" :active-key="activeType" :options="tabs" @change="changeType(String($event))" /></div></PageChrome>
  <div class="unified-device-list">
    <ResponsiveToolbar :dock-target="toolbarTarget" :reference-element="toolbarTarget?.parentElement || undefined" @docked-change="toolbarDocked = $event">
      <template #context>
          <PanelCollapseButton v-if="scopePanel?.collapsed" :collapsed="true" :aria-controls="scopePanel?.startId" @toggle="scopePanel?.toggle()" />
          <a-tooltip :title="scopeTitle"><strong class="unified-device-list__scope-title">{{ scopeTitle }}</strong></a-tooltip>
      </template>
      <template #leading>
        <Statuses />
      </template>
      <template #search><IotDeviceAssetSearchBar compact v-model:filter-terms="searchTerms" :filter-fields="filterFields" :common-filter-fields="commonFilterFields" @search="search" /></template>
      <template #actions>
        <Actions />
      </template>
      <template #utilities>
        <a-tooltip :title="t('UnifiedDeviceList.refresh')"><a-button type="text" :loading="loading" :aria-label="t('UnifiedDeviceList.refresh')" @click="refresh"><template #icon><AIcon type="ReloadOutlined" /></template></a-button></a-tooltip>
      </template>
    </ResponsiveToolbar>
    <ResponsiveSplitter ref="scopePanel" class="unified-device-list__layout" :default-size="240" :min="220" :max="360" :end-min="480" :panel-title="t('IotDeviceList.scope.aria')">
      <template #start="{ compact, close }">
        <div ref="scopeElement" class="unified-device-list__scope">
          <IotDeviceScopeSidebar v-bind="sidebarProps" :action-busy="groupMoving || groupSaving" @change="value => { handleScopeChange(value); if (compact) close() }" @create-group="openCreateGroup" @create-child-group="openCreateChildGroup" @edit-group="openEditGroup" @delete-group="confirmDeleteGroup" @move-group="moveGroup">
            <template v-if="!compact" #header-action><PanelCollapseButton :collapsed="false" :aria-controls="scopePanel?.startId" @toggle="scopePanel?.toggle()" /></template>
          </IotDeviceScopeSidebar>
        </div>
      </template>
      <template #end="{ collapsed, toggle: toggleScope, startId }">
        <div class="unified-device-list__result-region">
        <UnifiedDeviceResults :model="resultsModel" @selection-change="selectDevices" @visible-change="updateVisibleIds" @reading-change="updateReadingIndex" @load-more="list.loadMore" @refresh="refresh" @detail="openDeviceDetail" @toggle="toggle" @retry-details="list.retryDetails">
          <template #header>
            <div v-show="toolbarDocked" ref="toolbarTarget" class="unified-device-list__toolbar-target" />
            <template v-if="!toolbarDocked && !batchMode">
              <PanelCollapseButton v-if="collapsed" :collapsed="true" :aria-controls="startId" @toggle="toggleScope" />
              <strong class="unified-device-list__range-summary">{{ scopeTitle }}</strong>
              <span class="unified-device-list__result-total"><SkeletonText v-if="!list.hasLoaded.value && loading" :width="60" /><template v-else-if="list.hasLoaded.value">{{ t('UnifiedDeviceList.totalCount', { count: total }) }}</template></span>
              <a-button type="text" :loading="loading" :aria-label="t('UnifiedDeviceList.refresh')" @click="refresh"><template #icon><AIcon type="ReloadOutlined" /></template></a-button>
            </template>
            <a-flex v-if="batchMode" wrap="wrap" :gap="8" class="unified-device-list__batch">
              <PanelCollapseButton v-if="collapsed && !toolbarDocked" :collapsed="true" :aria-controls="startId" @toggle="toggleScope" />
              <span>{{ t('IotDeviceList.toolbar.selected', { selected: selectedIds.length }) }}</span>
              <a-button type="link" @click="list.clearBatchSelection">{{ t('UnifiedDeviceList.clearSelection') }}</a-button>
              <component v-if="activeProvider?.batchComponent" :is="activeProvider.batchComponent" :devices="rows" :selected-ids="selectedIds" @changed="handleBatchChanged" />
              <template v-else>
                <a-button :disabled="!selectedIds.length || busy" @click="batchToggle('enable')">{{ t('IotDeviceList.action.batchEnable') }}</a-button>
                <a-button :disabled="!selectedIds.length || busy" @click="batchToggle('disable')">{{ t('IotDeviceList.action.batchDisable') }}</a-button>
                <a-button v-if="canDeviceBatchAction('delete')" danger :disabled="!selectedIds.length || busy" @click="batchRemove">{{ t('Instance.index.133466-35') }}</a-button>
              </template>
              <a-button v-if="spaceAreaSupported !== false" :disabled="!selectedIds.length || busy || spaceAreaSupported !== true" @click="assignAreaOpen = true">{{ t('IotDeviceList.action.assignArea') }}</a-button>
              <a-button :disabled="!selectedIds.length || busy" @click="assignGroupOpen = true">{{ t('IotDeviceList.action.assignGroup') }}</a-button>
            </a-flex>
          </template>
          <template #empty-actions><a-space><EmptyCreateButtonAction1 /><EmptyCreateButtonAction2 /></a-space></template>
        </UnifiedDeviceResults>
        </div>
      </template>
    </ResponsiveSplitter>
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
    <IotDeviceGroupNameModal v-model:open="groupDialogOpen" :mode="groupDialogMode" :initial-name="groupDialogMode === 'edit' ? groupEditing?.name : undefined" :initial-parent-id="groupDialogMode === 'createChild' ? groupEditing?.id : groupEditing?.parentId" :editing-id="groupDialogMode === 'edit' ? groupEditing?.id : undefined" :groups="sidebarProps.groups" :saving="groupSaving" :error="groupDialogError" @save="saveGroup" />
    <Process v-if="syncVisible" :api="syncApi" :type="bulkProcessType" :data="syncData" @close="syncVisible = false" @save="handleSyncSaved" />
  </div>
</template>
<script setup lang="ts">
import { createReusableTemplate, useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
import { PanelCollapseButton, ResponsiveSplitter } from '@jetlinks-web-core/components'
import SlantedTabs from '@jetlinks-web-core/components/SlantedTabs'
import ResponsiveToolbar from '@jetlinks-web-core/components/ResponsiveToolbar'
import SkeletonText from '@jetlinks-web-core/components/SkeletonText'
import IotDeviceScopeSidebar from '../components/IotDeviceScopeSidebar.vue'
import IotDeviceAssetSearchBar from '../components/IotDeviceAssetSearchBar.vue'
import IotAddDeviceDrawer from '../components/IotAddDeviceDrawer.vue'
import IotDeviceAssignAreaModal from '../components/IotDeviceAssignAreaModal.vue'
import IotDeviceAssignGroupModal from '../components/IotDeviceAssignGroupModal.vue'
import IotDeviceGroupNameModal from '../components/IotDeviceGroupNameModal.vue'
import Process from '../../Instance/Process/index.vue'
import DeviceImport from '../../Instance/Import/modal.vue'
import DeviceExport from '../../Instance/Export/index.vue'
import { isSaaS } from '@jetlinks-web-core/utils/consts'
import UnifiedDeviceResults from './UnifiedDeviceResults.vue'
import { useUnifiedDeviceWorkspace } from './useUnifiedDeviceWorkspace'
const { t, guideProjectId, deviceMenuCode, menu, list, providers, isIotEntry, tabs, activeType, activeProvider, scope, filterFields, commonFilterFields, searchTerms, hasSearch, status, rows, total, loading, error, selectedIds, batchMode, providerOf, changeType, search, changeStatus, refresh, sidebarProps, spaceAreaSupported, scopeLoading, handleScopeChange, scopePanel, projectId, editing, editOpen, initialProductId, createDrawerOptions, createEntry, guideRequest, canCreate, openCreate, detailDevice, busy, selected, edit, toggle, remove, canDelete, batchToggle, batchRemove, assignAreaOpen, assignGroupOpen, assignArea, assignGroup, deviceImportOpen, deviceImportProductId, productOnboardingDeviceImport, configurationRequest, syncVisible, syncApi, syncData, bulkProcessType, deviceExportOpen, bulkQuery, groupDialogError, groupDialogMode, groupDialogOpen, groupEditing, groupSaving, groupMoving, moveGroup, openCreateChildGroup, openCreateGroup, openEditGroup, saveGroup, statusTones, statusOptions, canDeviceBatchAction, handleDeviceCreated, handleSyncSaved, handleBatchChanged, handleBatchMenuClick, handleDeviceImportSaved, openCreateDrawer, confirmDeleteGroup, scopeTitle, resultsModel, updateVisibleIds, updateReadingIndex, selectDevices, openDeviceDetail } = useUnifiedDeviceWorkspace()
const [DefineEmptyCreateAction1, EmptyCreateButtonAction1] = createReusableTemplate()
const [DefineEmptyCreateAction2, EmptyCreateButtonAction2] = createReusableTemplate()
const [DefineStatuses, Statuses] = createReusableTemplate()
const [DefineActions, Actions] = createReusableTemplate()
const toolbarTarget = ref<HTMLElement>(), toolbarDocked = ref(false)
const typeTabsElement = ref<HTMLElement>(), scopeElement = ref<HTMLElement>()
const typeTabsWidth = ref(0)
useResizeObserver([typeTabsElement, scopeElement], () => {
  const tabs = typeTabsElement.value?.getBoundingClientRect(), scope = scopeElement.value?.getBoundingClientRect()
  typeTabsWidth.value = tabs && scope ? Math.max(0, scope.right - tabs.left) : 0
})
const typeTabsFill = computed(() => !scopePanel.value?.collapsed && !scopePanel.value?.compact && typeTabsWidth.value > 0)
const typeTabsStyle = computed(() => ({ '--slanted-tabs-track-width': typeTabsFill.value ? `${typeTabsWidth.value}px` : undefined }))
</script>
<style scoped lang="less">
.unified-device-list { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; overflow:hidden; background:var(--jet-theme-bg-container); container-type:inline-size; }
.unified-device-list__types { --slanted-tabs-background:transparent; --slanted-tabs-padding-inline:12px; --slanted-tabs-min-width:0px; }
.unified-device-list__statuses { display:inline-flex; flex-wrap:wrap; align-items:center; gap:4px; flex-shrink:0; max-width:100%; white-space:nowrap; }
.unified-device-list__status { display:inline-flex; flex:none; align-items:center; gap:4px; height:28px; padding-inline:8px; border:1px solid transparent; }
.unified-device-list__status.is-selected,
.unified-device-list__status.is-selected:hover,
.unified-device-list__status.is-selected:active { color:var(--primary-color); border-color:var(--primary-color-2); background:var(--primary-color-1); }
.unified-device-list__status:focus-visible { outline:2px solid var(--primary-color-2); outline-offset:2px; }
.unified-device-list__status-count { display:inline-block; min-width:14px; color:var(--jet-theme-text-secondary); font-size:12px; font-variant-numeric:tabular-nums; }
.unified-device-list__actions { flex:none; display:flex; flex-wrap:wrap; gap:8px; }
.unified-device-list__batch { align-items:center; min-height:32px; gap:8px; }
.unified-device-list__layout { flex:1 1 0; width:100%; min-height:0; align-items:stretch; }
.unified-device-list :deep(.unified-device-list__scope), .unified-device-list :deep(.unified-device-list__scope > .ant-spin-container) { height:100%; min-height:0; }
.unified-device-list__scope-title { max-width:128px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:500; }
.unified-device-list__result-region { display:flex; width:100%; height:100%; min-width:0; min-height:0; }
.unified-device-list__toolbar-target { width:100%; min-width:0; }
.unified-device-list__range-summary { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
.unified-device-list__result-total { flex:none; color:var(--jet-theme-text-secondary); font-size:12px; }
</style>
