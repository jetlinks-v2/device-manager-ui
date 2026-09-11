<template>
  <div class="iot-device-list__row-actions">
    <j-permission-button
      type="link"
      size="small"
      :hasPermission="true"
      :tooltip="{ title: $t('IotDeviceList.action.detailShort') }"
      @click="emit('detail', device.id)"
    >
      <template #icon><AIcon type="EyeOutlined" /></template>
    </j-permission-button>
    <j-permission-button
      type="link"
      size="small"
      :hasPermission="true"
      :tooltip="{ title: $t('IotDeviceList.action.editShort') }"
      @click="emit('edit', device)"
    >
      <template #icon><AIcon type="EditOutlined" /></template>
    </j-permission-button>
    <j-permission-button
      type="link"
      size="small"
      :loading="actionBusyId === device.id"
      :hasPermission="true"
      :tooltip="{
        title: isDeviceDisabled(device)
          ? $t('IotDeviceList.action.enableShort')
          : $t('IotDeviceList.action.disableShort'),
      }"
      :popConfirm="{
        title: isDeviceDisabled(device)
          ? $t('IotDeviceList.confirm.enableOne', { name: device.name })
          : $t('IotDeviceList.confirm.disableOne', { name: device.name }),
        okButtonProps: { loading: actionBusyId === device.id },
        onConfirm: () => runToggleDevice(device),
      }"
    >
      <template #icon>
        <AIcon :type="isDeviceDisabled(device) ? 'CheckCircleOutlined' : 'StopOutlined'" />
      </template>
    </j-permission-button>
    <j-permission-button
      type="link"
      size="small"
      danger
      :disabled="!isDeviceDisabled(device)"
      :loading="actionBusyId === device.id"
      :hasPermission="true"
      :tooltip="{
        title: !isDeviceDisabled(device)
          ? $t('IotDeviceList.message.deleteDisabledOnly')
          : $t('IotDeviceList.action.deleteShort'),
      }"
      :popConfirm="{
        title: $t('IotDeviceList.confirm.deleteOne', { name: device.name }),
        okButtonProps: { loading: actionBusyId === device.id },
        onConfirm: () => runDeleteDevice(device),
      }"
    >
      <template #icon><AIcon type="DeleteOutlined" /></template>
    </j-permission-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IotDevice } from '../types'

const props = defineProps<{
  device: IotDevice
  actionBusyId: string
  isDeviceDisabled: (device: IotDevice) => boolean
  runToggleDevice: (device: IotDevice) => void | Promise<void>
  runDeleteDevice: (device: IotDevice) => void | Promise<void>
}>()

const emit = defineEmits<{
  detail: [deviceId: string]
  edit: [device: IotDevice]
}>()

const { t: $t } = useI18n()

async function runToggleDevice(device: IotDevice) {
  await props.runToggleDevice(device)
}

async function runDeleteDevice(device: IotDevice) {
  await props.runDeleteDevice(device)
}
</script>

<style scoped lang="less">
.iot-device-list__row-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.iot-device-list__row-actions :deep(.ant-btn) {
  padding: 0;
  margin: 0;
}
</style>
