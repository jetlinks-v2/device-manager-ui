<template>
  <a-menu @click="handleAction">
    <a-menu-item v-if="!group" key="create-root" :disabled="disabled"><AIcon type="PlusOutlined" />{{ $t('IotDeviceList.scope.createRootGroup') }}</a-menu-item>
    <template v-else>
      <a-menu-item key="create-child" :disabled="disabled"><AIcon type="PlusOutlined" />{{ $t('IotDeviceList.scope.createChildGroup') }}</a-menu-item>
      <a-menu-item key="edit" :disabled="disabled"><AIcon type="EditOutlined" />{{ $t('IotDeviceList.scope.editGroup') }}</a-menu-item>
      <a-menu-item key="delete" danger :disabled="disabled"><AIcon type="DeleteOutlined" />{{ $t('IotDeviceList.scope.deleteGroup') }}</a-menu-item>
    </template>
  </a-menu>
</template>
<script setup lang="ts">
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import type { GroupTreeAction } from '../hooks/iotDeviceGroupTreeInteractions'
defineProps<{ group?: DeviceGroup; disabled?: boolean }>()
const emit = defineEmits<{ action: [action: GroupTreeAction] }>()
function handleAction({ key }: { key: string | number }) {
  if (key === 'create-root' || key === 'create-child' || key === 'edit' || key === 'delete') emit('action', key)
}
</script>
