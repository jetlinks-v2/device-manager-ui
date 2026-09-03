<template>
  <section class="iot-device-list__table-wrap">
    <a-alert
      v-if="loadError"
      class="iot-device-list__error"
      type="error"
      show-icon
      :message="loadError"
    />

    <j-pro-table
      class="iot-device-list__table"
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
            :image="deviceImageUrl(record.imageUrl)"
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
      <template #brandModel="record">
        <a-tooltip :title="brandModelFullText(record)">
          <span class="iot-device-list__cell-stack">
            <span class="iot-device-list__cell-text">{{ displayText(record.productManufacturer) }}</span>
            <span class="iot-device-list__cell-subtext">{{ displayText(record.productModel) }}</span>
          </span>
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

      <template #action="record">
        <IotDeviceAssetActionPanel
          :device="record"
          :action-busy-id="actionBusyId"
          :is-device-disabled="isDeviceDisabled"
          :run-toggle-device="runToggleDevice"
          :run-delete-device="runDeleteDevice"
          @detail="onDetail"
          @edit="onEdit"
        />
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseIconValue } from '@jetlinks-web-core/components/IconValue'
import IconBadge from '@jetlinks-web-core/components/IconBadge/index.vue'

import IotDeviceAssetActionPanel from './IotDeviceAssetActionPanel.vue'
import { useIotDeviceAssetTableColumns } from './useIotDeviceAssetTableColumns'
import type { IotDevice } from '../types'
const { t: $t } = useI18n()
const props = defineProps<{
  totalDevices: number
  selectedCount: number
  hasActiveFilters: boolean
  loadError: string
  tableParams: Record<string, unknown>
  tablePagination: Record<string, unknown>
  tableRequest: (params: { pageIndex?: number; pageSize?: number }) => Promise<unknown>
  rowSelection: Record<string, unknown>
  connectionStatusOf: (device: IotDevice) => { label: string; tone: string }
  productNameText: (device: IotDevice) => string
  areaText: (device: IotDevice) => string
  areaFullText: (device: IotDevice) => string
  groupText: (device: IotDevice) => string
  groupFullText: (device: IotDevice) => string
  isDeviceDisabled: (device: IotDevice) => boolean
  actionBusyId: string
  onDetail: (deviceId: string) => void
  onEdit: (device: IotDevice) => void
  onToggle: (device: IotDevice) => void | Promise<void>
  onDelete: (device: IotDevice) => void | Promise<void>
}>()
const columns = useIotDeviceAssetTableColumns($t)
const resultSummaryText = computed(() =>
  props.hasActiveFilters
    ? $t('IotDeviceList.toolbar.filteredSummary', { total: props.totalDevices })
    : $t('IotDeviceList.toolbar.totalSummary', { total: props.totalDevices }),
)

async function runToggleDevice(device: IotDevice) {
  await props.onToggle(device)
}

async function runDeleteDevice(device: IotDevice) {
  await props.onDelete(device)
}

function deviceIconType(device: IotDevice) {
  const parsed = parseIconValue(device.imageUrl)
  if (parsed.kind === 'font') return parsed.iconType
  if (device.deviceTypeValue === 'gateway') return 'GatewayOutlined'
  if (device.deviceTypeValue === 'childrenDevice') return 'ApartmentOutlined'
  return 'ApiOutlined'
}

function deviceImageUrl(value?: string) {
  const parsed = parseIconValue(value)
  return parsed.kind === 'image' ? parsed.url : ''
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

function brandModelFullText(device: IotDevice) {
  return `${displayText(device.productManufacturer)} / ${displayText(device.productModel)}`
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

</script>

<style scoped src="../styles/device-list-table.less" lang="less"></style>
