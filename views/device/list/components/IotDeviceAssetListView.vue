<template>
  <div class="iot-device-list">
		<a-flex :gap="16">
			<IotDeviceAssetSearchBar
				:filter-fields="filterFields"
				:common-filter-fields="commonFilterFields"
				:filter-terms="filterTerms"
				@update:filter-terms="handleFilterTermsUpdate"
				@search="handleFilterSearch"
			/>
			<j-permission-button
				class="project-onboarding-target--iot-device-create"
				type="primary"
				:hasPermission="true"
				@click="openCreateDrawer"
			>
				<template #icon><AIcon type="PlusOutlined" /></template>
				{{ $t('IotDeviceList.action.create') }}
			</j-permission-button>
		</a-flex>

    <IotDeviceAssetTable
      :total-devices="totalDevices"
      :selected-count="selectedRowKeys.length"
      :has-active-filters="hasActiveFilters"
      :running-action="runningAction"
      :has-selected-area-bound-device="hasSelectedAreaBoundDevice"
      :load-error="loadError"
      :table-params="tableParams"
      :table-pagination="tablePagination"
      :table-request="tableRequest"
      :row-selection="rowSelection"
      :connection-status-of="connectionStatusOf"
      :risk-label-of="riskLabelOf"
      :product-name-text="productNameText"
      :area-text="areaText"
      :area-full-text="areaFullText"
      :group-text="groupText"
      :group-full-text="groupFullText"
      :is-device-disabled="isDeviceDisabled"
      :action-busy-id="actionBusyId"
      :product-update-busy-id="runningProductId"
      :can-update-product="canUpdateProduct"
      :product-update-tooltip-of="productUpdateTooltipOf"
      :on-batch-toggle="toggleSelectedDevices"
      :on-assign-area="openAssignAreaModal"
      :on-assign-group="openAssignGroupModal"
      :on-detail="goToDetail"
      :on-edit="openEditDrawer"
      :on-toggle="toggleDeviceEnabled"
      :on-delete="deleteDevice"
      :on-update-product="updateDeviceProduct"
    />
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { onlyMessage } from '@jetlinks-web/utils'
import { PageHeader } from '@jetlinks-web-core/components'
import { bindDeviceGroupDevices_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { bindDeviceToSpaceArea_api } from '@device-manager-ui/api/spaceArea'

import IotAddDeviceDrawer from './IotAddDeviceDrawer.vue'
import IotDeviceAssignAreaModal from './IotDeviceAssignAreaModal.vue'
import IotDeviceAssignGroupModal from './IotDeviceAssignGroupModal.vue'
import IotDeviceAssetSearchBar from './IotDeviceAssetSearchBar.vue'
import IotDeviceAssetTable from './IotDeviceAssetTable.vue'
import { useIotDeviceAssetActions } from '../hooks/useIotDeviceAssetActions'
import { useIotDeviceAssetBulkActions } from '../hooks/useIotDeviceAssetBulkActions'
import { useIotDeviceAssetFilters } from '../hooks/useIotDeviceAssetFilters'
import { useIotDeviceAssetPresentation } from '../hooks/useIotDeviceAssetPresentation'
import { useIotDeviceAssetTable } from '../hooks/useIotDeviceAssetTable'
import { buildIotDeviceDetailPath, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import { useIotDeviceMeta } from '../hooks/useIotDeviceMeta'
import { useIotChildGatewayGuide } from '../hooks/useIotChildGatewayGuide'
import { useIotDeviceLibraryQuickUpdate } from '../hooks/useIotDeviceLibraryQuickUpdate'
import { resolveSpaceAreaError } from '../services/shared/spaceAreaError'
import type { IotDevice } from '../types'
import type { IotAddDeviceCreatedPayload } from '../hooks/useIotAddDeviceDrawer'

const { t: $t } = useI18n()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => resolveIotProjectId(route))
const { connectionStatusMeta, riskMeta } = useIotDeviceMeta()
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
  submittedTerms,
  buildDeviceQueryTerms,
  handleFilterTermsUpdate,
  handleFilterSearch,
} = useIotDeviceAssetFilters(projectId, devices, connectionStatusMeta, route, router, () => refreshTable(true))

const {
  totalDevices,
  loadError,
  tableParams,
  tablePagination,
  refreshTable,
  tableRequest,
} = useIotDeviceAssetTable(projectId, submittedTerms, buildDeviceQueryTerms, devices)

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

const {
  runningProductId,
  canUpdateProduct,
  productUpdateTooltipOf,
  updateDeviceProduct,
} = useIotDeviceLibraryQuickUpdate(() => projectId.value, () => refreshTable())

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

const {
  isChildDeviceType,
  openChildGatewayGuide,
  openCreatedDeviceAccessGuide,
} = useIotChildGatewayGuide(projectId, route, router, $t)
const hasActiveFilters = computed(() => submittedTerms.value.some(hasFilterValue))
const hasSelectedAreaBoundDevice = computed(() => selectedDevices.value.some((device) => (
  Boolean(device.areaBindings?.length) || Boolean(device.areaId)
)))

function riskLabelOf(device: IotDevice) {
  return riskMeta(device.risk)
}

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
  const deviceType = typeof payload === 'string' ? undefined : payload.deviceType
  onDeviceCreated()
  if (isChildDeviceType(deviceType)) {
    openChildGatewayGuide()
    return
  }
  openCreatedDeviceAccessGuide(deviceId)
}

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
    await Promise.all(selectedDevices.value.map((device) => bindDeviceToSpaceArea_api(areaId, {
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
