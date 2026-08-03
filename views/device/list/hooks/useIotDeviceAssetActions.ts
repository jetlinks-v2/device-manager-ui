import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  deleteDevice_api,
  deployDevice_api,
  undeployDevice_api,
} from '@device-manager-ui/api/device'
import { getIotDeviceConnectionStatus } from './useIotDeviceStatus'
import type { IotDevice } from '../types'

export function useIotDeviceAssetActions(devices: Ref<IotDevice[]>, refreshTable: (resetPage?: boolean) => void) {
  const { t: $t } = useI18n()
  const deviceFormOpen = ref(false)
  const editingDeviceId = ref('')
  const actionBusyId = ref('')
  const actionError = ref('')

  const editingDevice = computed(() => devices.value.find((device) => device.id === editingDeviceId.value) ?? null)

  watch(deviceFormOpen, (open) => {
    if (!open) editingDeviceId.value = ''
  })

  function onDeviceCreated() {
    editingDeviceId.value = ''
    refreshTable(true)
  }

  function onDeviceSaved() {
    editingDeviceId.value = ''
    refreshTable()
  }

  function openCreateDrawer() {
    actionError.value = ''
    editingDeviceId.value = ''
    deviceFormOpen.value = true
  }

  function openEditDrawer(device: IotDevice) {
    actionError.value = ''
    editingDeviceId.value = device.id
    deviceFormOpen.value = true
  }

  function isDeviceDisabled(device: IotDevice) {
    return getIotDeviceConnectionStatus(device) === 'disabled'
  }

  async function toggleDeviceEnabled(device: IotDevice) {
    actionError.value = ''
    actionBusyId.value = device.id
    try {
      if (isDeviceDisabled(device)) {
        await deployDevice_api(device.id)
      } else {
        await undeployDevice_api(device.id)
      }
      refreshTable()
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : $t('IotDeviceList.message.statusUpdateFailed')
      onlyMessage(actionError.value, 'error')
    } finally {
      actionBusyId.value = ''
    }
  }

  async function deleteDevice(device: IotDevice) {
    actionError.value = ''
    // 删除是真实破坏性操作，前端必须和后端规则一致：仅允许删除已禁用设备。
    if (!isDeviceDisabled(device)) {
      actionError.value = $t('IotDeviceList.message.deleteDisabledOnly')
      onlyMessage(actionError.value, 'warning')
      return
    }
    actionBusyId.value = device.id
    try {
      await deleteDevice_api(device.id)
      refreshTable()
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : $t('IotDeviceList.message.deleteFailed')
      onlyMessage(actionError.value, 'error')
    } finally {
      actionBusyId.value = ''
    }
  }

  return {
    deviceFormOpen,
    editingDevice,
    actionBusyId,
    actionError,
    openCreateDrawer,
    onDeviceCreated,
    onDeviceSaved,
    openEditDrawer,
    isDeviceDisabled,
    toggleDeviceEnabled,
    deleteDevice,
  }
}
