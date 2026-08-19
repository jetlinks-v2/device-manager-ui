<template>
  <section class="iot-device-list__table-wrap">
    <div class="iot-device-list__toolbar">
      <a-space class="iot-device-list__batch-actions" wrap :size="[8, 8]">
        <j-permission-button
          class="iot-device-list__batch-action"
          :disabled="!selectedCount"
          :loading="runningAction === 'enable'"
          :popConfirm="{
            title: $t('IotDeviceList.confirm.batchEnable', { count: selectedCount }),
            okButtonProps: { loading: runningAction === 'enable' },
            onConfirm: () => onBatchToggle('enable'),
          }"
        >
          <template #icon><AIcon type="PlayCircleOutlined" /></template>
          {{ $t('IotDeviceList.action.batchEnable') }}
        </j-permission-button>
        <j-permission-button
          class="iot-device-list__batch-action"
          :disabled="!selectedCount"
          :loading="runningAction === 'disable'"
          :hasPermission="true"
          :popConfirm="{
            title: $t('IotDeviceList.confirm.batchDisable', { count: selectedCount }),
            okButtonProps: { loading: runningAction === 'disable' },
            onConfirm: () => onBatchToggle('disable'),
          }"
        >
          <template #icon><AIcon type="StopOutlined" /></template>
          {{ $t('IotDeviceList.action.batchDisable') }}
        </j-permission-button>
        <a-tooltip :title="hasSelectedAreaBoundDevice ? $t('IotDeviceList.assignArea.boundDeviceDisabled') : undefined">
          <span
            :tabindex="hasSelectedAreaBoundDevice ? 0 : undefined"
            :aria-label="hasSelectedAreaBoundDevice ? $t('IotDeviceList.assignArea.boundDeviceDisabled') : undefined"
          >
            <j-permission-button
              class="iot-device-list__batch-action"
              :disabled="!selectedCount || hasSelectedAreaBoundDevice"
              :hasPermission="true"
              @click="onAssignArea"
            >
              <template #icon><AIcon type="EnvironmentOutlined" /></template>
              {{ $t('IotDeviceList.action.assignArea') }}
            </j-permission-button>
          </span>
        </a-tooltip>
        <j-permission-button
          class="iot-device-list__batch-action"
          :disabled="!selectedCount"
          :hasPermission="true"
          @click="onAssignGroup"
        >
          <template #icon><AIcon type="ApartmentOutlined" /></template>
          {{ $t('IotDeviceList.action.assignGroup') }}
        </j-permission-button>
      </a-space>
    </div>

    <a-alert
      v-if="loadError"
      class="iot-device-list__error"
      type="error"
      show-icon
      :message="loadError"
    />

    <j-pro-table
      mode="TABLE"
      rowKey="id"
      :columns="columns"
      :request="tableRequest"
      :params="tableParams"
      :alertShow="false"
      :pagination="tablePagination"
      :rowSelection="rowSelection"
      :bodyStyle="{ padding: 0 }"
    >
      <template #paginationRender="{ total, pageSize, current, onChange }">
        <footer class="iot-device-list__table-footer">
          <span class="iot-device-list__toolbar-info">
            <span>{{ resultSummaryText }}</span>
            <span
              class="iot-device-list__toolbar-selected"
              :data-selected="selectedCount > 0"
            >
              {{ $t('IotDeviceList.toolbar.selected', { selected: selectedCount }) }}
            </span>
          </span>
          <a-pagination
            v-bind="tablePagination"
            size="small"
            :total="total"
            :page-size="pageSize"
            :current="current"
            :show-total="undefined"
            @change="onChange"
          />
        </footer>
      </template>

      <template #device="record">
        <div class="iot-device-list__device-cell" @click="onDetail(record.id)">
          <IconBadge
            :image="record.imageUrl"
            :icon="deviceIconType(record)"
            :size="40"
            :inner-size="32"
            :alt="$t('IotDeviceList.table.deviceImageAlt', { name: record.name })"
          />
          <div class="iot-device-list__device-body">
            <div class="iot-device-list__device-name">
              <a-tooltip :title="displayText(record.name)">
                <span>{{ displayText(record.name) }}</span>
              </a-tooltip>
            </div>
            <small>{{ displayText(record.identifier) }}</small>
          </div>
        </div>
      </template>

      <template #productName="record">
        <a-tooltip :title="productNameText(record)">
          <span class="iot-device-list__cell-text">{{ productNameText(record) }}</span>
        </a-tooltip>
      </template>
      <template #productManufacturer="record">
        <a-tooltip :title="displayText(record.productManufacturer)">
          <span class="iot-device-list__cell-text">{{ displayText(record.productManufacturer) }}</span>
        </a-tooltip>
      </template>
      <template #productModel="record">
        <a-tooltip :title="displayText(record.productModel)">
          <span class="iot-device-list__cell-text">{{ displayText(record.productModel) }}</span>
        </a-tooltip>
      </template>
      <template #status="record">
        <StatusTag
          :status="connectionStatusTagStatusOf(connectionStatusOf(record).tone)"
          :text="connectionStatusOf(record).label"
        />
      </template>
      <template #deviceType="record">
        <a-tooltip :title="deviceTypeFullText(record)">
          <span class="iot-device-list__cell-stack">
            <span class="iot-device-list__cell-text">{{ deviceTypeText(record) }}</span>
            <span class="iot-device-list__cell-subtext">{{ displayText(record.accessMode) }}</span>
          </span>
        </a-tooltip>
      </template>

      <template #deviceGroup="record">
        <a-tooltip>
          <template #title>
            <span v-if="!shouldBreakDeviceGroupTooltip(record)">{{ deviceGroupFullText(record) }}</span>
            <span v-else class="iot-device-list__tooltip-stack">
              <span>{{ $t('IotDeviceList.table.areaGroupLabel') }}{{ areaFullText(record) }}</span>
              <span>{{ $t('IotDeviceList.table.businessGroupLabel') }}{{ groupFullText(record) }}</span>
            </span>
          </template>
          <span class="iot-device-list__cell-stack">
            <span class="iot-device-list__cell-line">
              <span class="iot-device-list__cell-text">{{ areaText(record) }}</span>
            </span>
            <span class="iot-device-list__cell-line">
              <span class="iot-device-list__cell-subtext">{{ groupText(record) }}</span>
            </span>
          </span>
        </a-tooltip>
      </template>

      <template #risk="record">
        <StatusTag
          :status="riskStatusTagStatusOf(riskLabelOf(record).tone)"
          :text="riskLabelOf(record).label"
          :bordered="false"
        >
          <template #icon>
            <AIcon
              :type="riskLabelOf(record).tone === 'ok' ? 'CheckCircleFilled' : 'ExclamationCircleFilled'"
              aria-hidden="true"
            />
          </template>
        </StatusTag>
      </template>
      <template #action="record">
        <a-popover
          placement="bottomRight"
          trigger="click"
          :open="actionPopoverOpenId === record.id"
          overlay-class-name="iot-device-list-action-popover"
          @open-change="(open: boolean) => onActionPopoverOpenChange(record.id, open)"
        >
          <j-permission-button
            type="text"
            size="small"
            class="iot-device-list__more"
            :hasPermission="true"
            @click.stop
          >
            <AIcon type="MoreOutlined" />
          </j-permission-button>
          <template #content>
            <IotDeviceAssetActionPanel
              :device="record"
              :action-busy-id="actionBusyId"
              :product-update-busy-id="productUpdateBusyId"
              :is-device-disabled="isDeviceDisabled"
              :can-update-product="canUpdateProduct"
              :product-update-tooltip-of="productUpdateTooltipOf"
              :run-toggle-device="runToggleDevice"
              :run-delete-device="runDeleteDevice"
              @detail="(deviceId) => { closeActionPopover(); onDetail(deviceId) }"
              @edit="(device) => { closeActionPopover(); onEdit(device) }"
              @update-product="onUpdateProduct"
            />
          </template>
        </a-popover>
      </template>

      <template #emptyText>
        <CloudEmpty type="page">
          <template #description>
            <div class="iot-device-list__empty">
              <strong>{{ $t('IotDeviceList.empty.title') }}</strong>
              <span>{{ $t('IotDeviceList.empty.description') }}</span>
            </div>
          </template>
        </CloudEmpty>
      </template>
    </j-pro-table>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import IconBadge from '@jetlinks-web-core/components/IconBadge/index.vue'

import IotDeviceAssetActionPanel from './IotDeviceAssetActionPanel.vue'
import { useIotDeviceAssetTableColumns } from './useIotDeviceAssetTableColumns'
import type { IotDevice } from '../types'
const { t: $t } = useI18n()
const props = defineProps<{
  totalDevices: number
  selectedCount: number
  hasSelectedAreaBoundDevice: boolean
  hasActiveFilters: boolean
  runningAction: '' | 'enable' | 'disable' | 'export'
  loadError: string
  tableParams: Record<string, unknown>
  tablePagination: Record<string, unknown>
  tableRequest: (params: { pageIndex?: number; pageSize?: number }) => Promise<unknown>
  rowSelection: Record<string, unknown>
  connectionStatusOf: (device: IotDevice) => { label: string; tone: string }
  riskLabelOf: (device: IotDevice) => { label: string; tone: 'ok' | 'warn' | 'err' }
  productNameText: (device: IotDevice) => string
  areaText: (device: IotDevice) => string
  areaFullText: (device: IotDevice) => string
  groupText: (device: IotDevice) => string
  groupFullText: (device: IotDevice) => string
  isDeviceDisabled: (device: IotDevice) => boolean
  actionBusyId: string
  productUpdateBusyId: string
  canUpdateProduct: (device: IotDevice) => boolean
  productUpdateTooltipOf: (device: IotDevice) => { title: string } | undefined
  onBatchToggle: (target: 'enable' | 'disable') => void | Promise<void>
  onAssignArea: () => void
  onAssignGroup: () => void
  onDetail: (deviceId: string) => void
  onEdit: (device: IotDevice) => void
  onToggle: (device: IotDevice) => void | Promise<void>
  onDelete: (device: IotDevice) => void | Promise<void>
  onUpdateProduct: (device: IotDevice) => void
}>()
const actionPopoverOpenId = ref('')
const columns = useIotDeviceAssetTableColumns($t)
const resultSummaryText = computed(() =>
  props.hasActiveFilters
    ? $t('IotDeviceList.toolbar.filteredSummary', { total: props.totalDevices })
    : $t('IotDeviceList.toolbar.totalSummary', { total: props.totalDevices }),
)

function onActionPopoverOpenChange(deviceId: string, open: boolean) {
  actionPopoverOpenId.value = open ? deviceId : ''
}

function closeActionPopover() {
  actionPopoverOpenId.value = ''
}

async function runToggleDevice(device: IotDevice) {
  await props.onToggle(device)
  closeActionPopover()
}

async function runDeleteDevice(device: IotDevice) {
  await props.onDelete(device)
  closeActionPopover()
}

function deviceIconType(device: IotDevice) {
  if (device.deviceTypeValue === 'gateway') return 'GatewayOutlined'
  if (device.deviceTypeValue === 'childrenDevice') return 'ApartmentOutlined'
  return 'ApiOutlined'
}

function displayText(value?: string) {
  return value || '--'
}

function deviceTypeText(device: IotDevice) {
  const value = device.deviceTypeValue || device.deviceType
  if (value === 'gateway') return $t('IotDeviceList.deviceType.gateway')
  if (value === 'childrenDevice') return $t('IotDeviceList.deviceType.childrenDevice')
  if (value === 'device') return $t('IotDeviceList.deviceType.device')
  return displayText(device.deviceType)
}

function deviceTypeFullText(device: IotDevice) {
  return `${deviceTypeText(device)} / ${displayText(device.accessMode)}`
}

function deviceGroupFullText(device: IotDevice) {
  return `${$t('IotDeviceList.table.areaGroupLabel')}${props.areaFullText(device)} / ${$t('IotDeviceList.table.businessGroupLabel')}${props.groupFullText(device)}`
}

function shouldBreakDeviceGroupTooltip(device: IotDevice) {
  return deviceGroupFullText(device).length > 28
}

function connectionStatusTagStatusOf(tone: string) {
  if (tone === 'ok') return 'success' as const
  if (tone === 'warn') return 'warning' as const
  if (tone === 'err' || tone === 'muted') return 'disabled' as const
  if (tone === 'info') return 'processing' as const
  return 'default' as const
}

function riskStatusTagStatusOf(tone: string) {
  if (tone === 'ok') return 'info' as const
  if (tone === 'warn') return 'warning' as const
  if (tone === 'err') return 'error' as const
  return 'default' as const
}
</script>

<style scoped src="../styles/device-list-table.less" lang="less"></style>
