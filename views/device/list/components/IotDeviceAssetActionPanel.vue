<template>
  <div class="iot-device-list__row-actions">
    <j-permission-button type="text" size="small" :hasPermission="true" @click="emit('detail', device.id)">
      {{ $t('IotDeviceList.action.detailShort') }}
    </j-permission-button>
    <j-permission-button type="text" size="small" :hasPermission="true" @click="emit('edit', device)">
      {{ $t('IotDeviceList.action.editShort') }}
    </j-permission-button>
    <j-permission-button
      type="text"
      size="small"
      :danger="!isDeviceDisabled(device)"
      :loading="actionBusyId === device.id"
      :hasPermission="true"
      :popConfirm="{
        title: isDeviceDisabled(device)
          ? $t('IotDeviceList.confirm.enableOne', { name: device.name })
          : $t('IotDeviceList.confirm.disableOne', { name: device.name }),
        okButtonProps: { loading: actionBusyId === device.id },
        onConfirm: () => runToggleDevice(device),
      }"
    >
      {{ isDeviceDisabled(device) ? $t('IotDeviceList.action.enableShort') : $t('IotDeviceList.action.disableShort') }}
    </j-permission-button>
    <j-permission-button
      type="text"
      size="small"
      danger
      :disabled="!isDeviceDisabled(device)"
      :loading="actionBusyId === device.id"
      :hasPermission="true"
      :tooltip="!isDeviceDisabled(device) ? { title: $t('IotDeviceList.message.deleteDisabledOnly') } : undefined"
      :popConfirm="{
        title: $t('IotDeviceList.confirm.deleteOne', { name: device.name }),
        okButtonProps: { loading: actionBusyId === device.id },
        onConfirm: () => runDeleteDevice(device),
      }"
    >
      {{ $t('IotDeviceList.action.deleteShort') }}
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
  padding-inline: 0;
}
</style>
