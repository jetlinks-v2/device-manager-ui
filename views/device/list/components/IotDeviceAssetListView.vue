<template>
  <div class="iot-device-list">
    <EqualHeightColumns class="iot-device-list__layout" height="auto" left-width="15rem" right-width="1fr">
      <template #left>
        <IotDeviceScopeSidebar
          :active-type="scopeType"
          :active-id="scopeId"
          :areas="areaOptions"
          :groups="groupOptions"
          :total-device-count="totalDeviceCount"
          :area-device-counts="areaDeviceCounts"
          :group-device-counts="groupDeviceCounts"
          @change="handleScopeChange"
        />
      </template>
      <template #right>
        <section class="iot-device-list__main">
          <IotDeviceAssetSummary :summary="deviceSummary" />
          <a-flex class="iot-device-list__search-actions" :gap="16" align="center" wrap="wrap">
            <IotDeviceAssetSearchBar
              class="iot-device-list__search"
              :filter-fields="filterFields"
              :common-filter-fields="commonFilterFields"
              :filter-terms="filterTerms"
              @update:filter-terms="handleFilterTermsUpdate"
              @search="handleFilterSearch"
            />
            <a-flex class="iot-device-list__action-group" :gap="16" align="center" wrap="wrap">
              <IotDeviceAssetBatchActions
                :selected-count="selectedRowKeys.length"
                :running-action="runningAction"
                :on-batch-toggle="toggleSelectedDevices"
                :on-assign-area="openAssignAreaModal"
                :on-assign-group="openAssignGroupModal"
              />
              <j-permission-button class="project-onboarding-target--iot-device-create" type="primary" :hasPermission="true" @click="openCreateDrawer">
                <template #icon><AIcon type="PlusOutlined" /></template>
                {{ $t('IotDeviceList.action.create') }}
              </j-permission-button>
            </a-flex>
          </a-flex>
          <IotDeviceAssetTable
      :total-devices="totalDevices"
      :selected-count="selectedRowKeys.length"
      :has-active-filters="hasActiveFilters"
      :load-error="loadError"
      :table-params="tableParams"
      :table-pagination="tablePagination"
      :table-request="tableRequest"
      :row-selection="rowSelection"
      :connection-status-of="connectionStatusOf"
      :product-name-text="productNameText"
      :area-text="areaText"
      :area-full-text="areaFullText"
      :group-text="groupText"
      :group-full-text="groupFullText"
      :is-device-disabled="isDeviceDisabled"
      :action-busy-id="actionBusyId"
      :on-detail="goToDetail"
      :on-edit="openEditDrawer"
      :on-toggle="toggleDeviceEnabled"
      :on-delete="deleteDevice"
          />
        </section>
      </template>
    </EqualHeightColumns>
  </div>

  <IotAddDeviceDrawer
    v-model:open="deviceFormOpen"
    :project-id="projectId"
    :device="editingDevice"
    @created="handleDeviceCreated"
    @saved="onDeviceSaved"
  />

  <IotDeviceAssignGroupModal
    v-model:open="assignGroupOpen"
    :saving="assignGroupSaving"
    :error="assignGroupError"
    :selected-device-count="selectedRowKeys.length"
    @save="assignSelectedDevicesToGroup"
  />

  <IotDeviceAssignAreaModal
    v-model:open="assignAreaOpen"
    :project-id="projectId"
    :saving="assignAreaSaving"
    :error="assignAreaError"
    :selected-device-count="selectedRowKeys.length"
    @save="assignSelectedDevicesToArea"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { onlyMessage } from '@jetlinks-web/utils'
import EqualHeightColumns from '@jetlinks-web-core/components/EqualHeightColumns/index.vue'
import { bindDeviceGroupDevices_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'

import IotAddDeviceDrawer from './IotAddDeviceDrawer.vue'
import IotDeviceAssignAreaModal from './IotDeviceAssignAreaModal.vue'
import IotDeviceAssignGroupModal from './IotDeviceAssignGroupModal.vue'
import IotDeviceAssetBatchActions from './IotDeviceAssetBatchActions.vue'
import IotDeviceAssetSearchBar from './IotDeviceAssetSearchBar.vue'
import IotDeviceAssetSummary from './IotDeviceAssetSummary.vue'
import IotDeviceAssetTable from './IotDeviceAssetTable.vue'
import IotDeviceScopeSidebar from './IotDeviceScopeSidebar.vue'
import { useIotDeviceAssetActions } from '../hooks/useIotDeviceAssetActions'
import { useIotDeviceAssetBulkActions } from '../hooks/useIotDeviceAssetBulkActions'
import { useIotDeviceAssetFilters } from '../hooks/useIotDeviceAssetFilters'
import { useIotDeviceAssetPresentation } from '../hooks/useIotDeviceAssetPresentation'
import { useIotDeviceScopeCounts } from '../hooks/useIotDeviceScopeCounts'
import { useIotDeviceAssetTable } from '../hooks/useIotDeviceAssetTable'
import { buildIotDeviceDetailPath, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import { useIotDeviceMeta } from '../hooks/useIotDeviceMeta'
import { reassignIotDevicesToArea } from '../hooks/iotDeviceAreaGroupBindings'
import { resolveSpaceAreaError } from '../services/shared/spaceAreaError'
import type { IotDevice } from '../types'
import type { IotAddDeviceCreatedPayload } from '../hooks/useIotAddDeviceDrawer'

const { t: $t } = useI18n()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => resolveIotProjectId(route))
const { connectionStatusMeta } = useIotDeviceMeta()
const devices = ref<IotDevice[]>([])
const assignGroupOpen = ref(false)
const assignGroupSaving = ref(false)
const assignGroupError = ref('')
const assignAreaOpen = ref(false)
const assignAreaSaving = ref(false)
const assignAreaError = ref('')

const {
  filterTerms,
  filterFields,
  commonFilterFields,
  submittedTerms, areaOptions, groupOptions, scopeType, scopeId,
  buildDeviceQueryTerms,
  handleFilterTermsUpdate,
  handleFilterSearch, handleScopeChange: changeScope,
} = useIotDeviceAssetFilters(projectId, devices, connectionStatusMeta, route, router, () => refreshTable(true))

const {
  totalDevices,
  deviceSummary,
  loadError,
  tableParams,
  tablePagination,
  refreshTable,
  refreshKey,
  tableRequest,
} = useIotDeviceAssetTable(projectId, submittedTerms, buildDeviceQueryTerms, devices)

const { totalDeviceCount, areaDeviceCounts, groupDeviceCounts } = useIotDeviceScopeCounts(
  projectId, areaOptions, groupOptions, refreshKey,
)

const {
  deviceFormOpen,
  editingDevice,
  actionBusyId,
  openCreateDrawer,
  onDeviceCreated,
  onDeviceSaved,
  openEditDrawer,
  isDeviceDisabled,
  toggleDeviceEnabled,
  deleteDevice,
} = useIotDeviceAssetActions(devices, refreshTable)

const presentation = useIotDeviceAssetPresentation(devices, connectionStatusMeta)

const {
  rowSelection,
  selectedRowKeys,
  selectedDevices,
  runningAction,
  clearSelection,
  toggleSelectedDevices,
} = useIotDeviceAssetBulkActions(devices, refreshTable)

const {
  connectionStatusOf,
  productNameText,
  areaText,
  areaFullText,
  groupText,
  groupFullText,
} = presentation

const hasActiveFilters = computed(() => Boolean(scopeId.value) || submittedTerms.value.some(hasFilterValue))

function hasFilterValue(term: { value?: unknown; terms?: unknown }): boolean {
  if (Array.isArray(term.terms) && term.terms.some((item) => hasFilterValue(item as { value?: unknown; terms?: unknown }))) {
    return true
  }
  if (Array.isArray(term.value)) return term.value.some((item) => String(item ?? '').trim())
  return String(term.value ?? '').trim().length > 0
}

function deviceDetailPath(deviceId: string) {
  return buildIotDeviceDetailPath(projectId.value, deviceId, undefined, route)
}

function goToDetail(deviceId: string) {
  void router.push(deviceDetailPath(deviceId))
}

function handleDeviceCreated(payload: IotAddDeviceCreatedPayload | string) {
  const deviceId = typeof payload === 'string' ? payload : payload.deviceId
  onDeviceCreated()
  goToDetail(deviceId)
}

function handleScopeChange(scope: { type: 'area' | 'group'; id: string }) {
  clearSelection()
  changeScope(scope)
}

watch([scopeType, scopeId], () => clearSelection())

function openAssignGroupModal() {
  assignGroupError.value = ''
  if (!selectedRowKeys.value.length) {
    onlyMessage($t('IotDeviceList.assignGroup.selectDeviceFirst'), 'warning')
    return
  }
  assignGroupOpen.value = true
}

function openAssignAreaModal() {
  assignAreaError.value = ''
  if (!selectedRowKeys.value.length) {
    onlyMessage($t('IotDeviceList.assignArea.selectDeviceFirst'), 'warning')
    return
  }
  assignAreaOpen.value = true
}

async function assignSelectedDevicesToArea(areaId: string) {
  if (!selectedDevices.value.length) {
    assignAreaError.value = $t('IotDeviceList.assignArea.selectDeviceFirst')
    return
  }

  assignAreaSaving.value = true
  assignAreaError.value = ''
  try {
    await reassignIotDevicesToArea(areaId, selectedDevices.value.map((device) => ({
      id: device.id,
      name: device.name,
      productName: productNameText(device),
      state: device.status,
    })))
    onlyMessage($t('IotDeviceList.assignArea.success', { count: selectedDevices.value.length }))
    assignAreaOpen.value = false
    clearSelection()
    refreshTable()
  } catch (error) {
    assignAreaError.value = ''
    onlyMessage(resolveSpaceAreaError(error) || $t('IotDeviceList.assignArea.failed'), 'error')
  } finally {
    assignAreaSaving.value = false
  }
}

async function assignSelectedDevicesToGroup(group: DeviceGroup) {
  if (!selectedRowKeys.value.length) {
    assignGroupError.value = $t('IotDeviceList.assignGroup.selectDeviceFirst')
    return
  }

  assignGroupSaving.value = true
  assignGroupError.value = ''
  try {
    await bindDeviceGroupDevices_api(group.id, selectedRowKeys.value)
    onlyMessage($t('IotDeviceList.assignGroup.success', {
      count: selectedRowKeys.value.length,
      name: group.name,
    }))
    assignGroupOpen.value = false
    clearSelection()
    refreshTable()
  } catch (error) {
    assignGroupError.value = error instanceof Error
      ? error.message
      : $t('IotDeviceList.assignGroup.failed')
    onlyMessage(assignGroupError.value, 'error')
  } finally {
    assignGroupSaving.value = false
  }
}
</script>

<style scoped src="../styles/device-list-view.less" lang="less"></style>
