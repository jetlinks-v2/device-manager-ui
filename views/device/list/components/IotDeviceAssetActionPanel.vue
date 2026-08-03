<template>
  <div class="iot-device-list__action-panel">
    <j-permission-button type="text" :hasPermission="true" @click="emit('detail', device.id)">
      {{ $t('IotDeviceList.action.detail') }}
    </j-permission-button>
    <j-permission-button type="text" :hasPermission="true" @click="emit('edit', device)">
      {{ $t('IotDeviceList.action.edit') }}
    </j-permission-button>
    <j-permission-button
      type="text"
      :disabled="!canUpdateProduct(device)"
      :loading="productUpdateBusyId === (device.productId || device.productKey || device.id)"
      :hasPermission="true"
      :tooltip="productUpdateTooltipOf(device)"
      @click="emit('update-product', device)"
    >
      {{ $t('IotDeviceList.action.updateProduct') }}
    </j-permission-button>
    <j-permission-button
      type="text"
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
      {{ isDeviceDisabled(device) ? $t('IotDeviceList.action.enableOne') : $t('IotDeviceList.action.disableOne') }}
    </j-permission-button>
    <j-permission-button
      type="text"
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
      {{ $t('IotDeviceList.action.delete') }}
    </j-permission-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IotDevice } from '../types'

const props = defineProps<{
  device: IotDevice
  actionBusyId: string
  productUpdateBusyId: string
  isDeviceDisabled: (device: IotDevice) => boolean
  canUpdateProduct: (device: IotDevice) => boolean
  productUpdateTooltipOf: (device: IotDevice) => { title: string } | undefined
  runToggleDevice: (device: IotDevice) => void | Promise<void>
  runDeleteDevice: (device: IotDevice) => void | Promise<void>
}>()

const emit = defineEmits<{
  detail: [deviceId: string]
  edit: [device: IotDevice]
  'update-product': [device: IotDevice]
}>()

const { t: $t } = useI18n()

async function runToggleDevice(device: IotDevice) {
  await props.runToggleDevice(device)
}

async function runDeleteDevice(device: IotDevice) {
  await props.runDeleteDevice(device)
}
</script>
