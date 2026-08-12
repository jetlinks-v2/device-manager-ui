<template>
  <div class="iot-groups-page">
    <EqualHeightColumns
      class="iot-groups-page__layout"
      height="calc(100vh - 6rem)"
      left-width="15rem"
      right-width="1fr"
    >
      <template #left>
        <IotDeviceGroupsSidebar
          :activeView="activeView"
          :areaExpandedKeys="areaExpandedKeys"
          :areaTreeData="areaTreeData"
          :currentViewCount="currentViewCount"
          :groupKeyword="groupKeyword"
          :groupViewOptions="groupViewOptions"
          :selectedGroupId="selectedGroupId"
          :visibleDeviceCount="visibleDeviceCount"
          :visibleItems="visibleItems"
          :visibleListItems="visibleListItems"
          :viewCount="viewCount"
          :areaIcon="areaIcon"
          :riskLevelLabel="riskLevelLabel"
          :riskTone="riskTone"
          @create-type-group="openTypeGroupDrawer"
          @delete-type-group="confirmDeleteTypeGroup"
          @edit-type-group="openEditTypeGroupDrawer"
          @expand-area="handleAreaExpand"
          @switch-view="onSwitchView"
          @update:groupKeyword="groupKeyword = $event"
          @update:selectedGroupId="selectedGroupId = $event"
        />
      </template>

      <template #right>
        <IotDeviceGroupsDetailCard
          v-model:activeTab="activeTab"
          :deviceCommonFilterFieldsByView="deviceCommonFilterFieldsByView"
          :deviceFilterFields="deviceFilterFields"
          :deviceFilterTerms="deviceFilterTerms"
          :deviceTableColumns="deviceTableColumns"
          :deviceTablePagination="deviceTablePagination"
          :deviceTableParams="deviceTableParams"
          :deviceTableRequest="deviceTableRequest"
          :deviceDetailPath="deviceDetailPath"
          :deviceHealthScore="deviceHealthScore"
          :onlineDuration="onlineDuration"
          :overview="selectedOverview"
          :selectedGroup="selectedGroup"
          :selectedVisibleDeviceCount="selectedVisibleDeviceCount"
          @bind-group-devices="openBindDeviceModal"
          @unbind-group-device="confirmUnbindDevice"
          @update:deviceFilterTerms="handleDeviceFilterTermsUpdate"
          @search="handleDeviceFilterSearch"
        />
      </template>
    </EqualHeightColumns>

    <IotTypeGroupCreateDrawer
      :open="typeGroupDrawerOpen"
      :mode="typeGroupDrawerMode"
      :initial-value="typeGroupEditingValue"
      :saving="typeGroupSaving"
      :error="typeGroupDrawerError"
      @update:open="typeGroupDrawerOpen = $event"
      @save="handleTypeGroupSave"
    />

    <IotTypeGroupBindDeviceModal
      :open="bindDeviceModalOpen"
      :saving="bindDeviceSaving"
      :error="bindDeviceError"
      :group-name="bindDeviceGroup?.name"
      :search-trigger-key="bindDeviceSearchTriggerKey"
      :request="queryBindableDevices"
      @search="handleBindDeviceFilterSearch"
      @save="handleBindDevices"
      @update:open="bindDeviceModalOpen = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { PageHeader } from '@jetlinks-web-core/components'

import IotTypeGroupBindDeviceModal from './IotTypeGroupBindDeviceModal.vue'
import IotTypeGroupCreateDrawer from './IotTypeGroupCreateDrawer.vue'
import IotDeviceGroupsDetailCard from './IotDeviceGroupsDetailCard.vue'
import IotDeviceGroupsSidebar from './IotDeviceGroupsSidebar.vue'
import type { GroupItem } from './iotDeviceGroupsPage.types'
import { useIotDeviceGroupsPage } from './useIotDeviceGroupsPage'
import type { IotDevice } from '@device-manager-ui/types'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n()

const {
  activeView,
  areaExpandedKeys,
  areaTreeData,
  areaIcon,
  currentViewCount,
  deviceCommonFilterFieldsByView,
  deviceDetailPath,
  deviceFilterFields,
  deviceFilterTerms,
  deviceHealthScore,
  deviceTableColumns,
  deviceTablePagination,
  deviceTableParams,
  deviceTableRequest,
  groupKeyword,
  groupViewOptions,
  handleDeviceFilterSearch,
  handleDeviceFilterTermsUpdate,
  handleBindDeviceFilterSearch,
  handleBindDevices,
  handleTypeGroupDelete,
  handleTypeGroupSave,
  handleUnbindDevice,
  onlineDuration,
  onSwitchView,
  openEditTypeGroupDrawer,
  openBindDeviceModal,
  openTypeGroupDrawer,
  queryBindableDevices,
  riskLevelLabel,
  riskTone,
  selectedGroup,
  selectedGroupId,
  selectedOverview,
  selectedVisibleDeviceCount,
  handleAreaExpand,
  typeGroupDrawerError,
  typeGroupDrawerMode,
  typeGroupDrawerOpen,
  typeGroupEditingValue,
  typeGroupSaving,
  bindDeviceError,
  bindDeviceGroup,
  bindDeviceModalOpen,
  bindDeviceSaving,
  bindDeviceSearchTriggerKey,
  viewCount,
  visibleDeviceCount,
  visibleItems,
  visibleListItems,
} = useIotDeviceGroupsPage()

const activeTab = ref<'overview' | 'devices'>('overview')

watch(selectedGroupId, () => {
  activeTab.value = 'overview'
})

function confirmDeleteTypeGroup(item: GroupItem) {
  Modal.confirm({
    title: $t('IotDeviceGroups.confirm.deleteGroup.title'),
    content: $t('IotDeviceGroups.confirm.deleteGroup.content', { name: item.name }),
    okText: $t('IotDeviceGroups.confirm.deleteGroup.okText'),
    okType: 'danger',
    cancelText: $t('IotDeviceDetail.common.cancel'),
    centered: true,
    onOk: () => handleTypeGroupDelete(item),
  })
}

function confirmUnbindDevice(group: GroupItem, device: IotDevice) {
  const targetName = group.view === 'area'
    ? $t('IotDeviceGroups.confirm.unbindDevice.target.area')
    : $t('IotDeviceGroups.confirm.unbindDevice.target.group')
  Modal.confirm({
    title: $t('IotDeviceGroups.confirm.unbindDevice.title'),
    content: $t('IotDeviceGroups.confirm.unbindDevice.content', { device: device.name || device.id, group: group.name, target: targetName }),
    okText: $t('IotDeviceGroups.confirm.unbindDevice.okText'),
    okType: 'danger',
    cancelText: $t('IotDeviceDetail.common.cancel'),
    centered: true,
    onOk: () => handleUnbindDevice(group, device),
  })
}
</script>

<style scoped>
.iot-groups-page {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.iot-groups-page__layout {
  min-width: 0;
}

.iot-groups-page__layout :deep(.equal-height-columns__pane) {
  display: grid;
  min-width: 0;
  min-height: 0;
}

@media (width <= 73.75rem) {
  .iot-groups-page__layout {
    height: auto;
    grid-template-columns: 1fr;
  }

  .iot-groups-page__layout :deep(.equal-height-columns__pane) {
    min-height: auto;
  }
}
</style>
