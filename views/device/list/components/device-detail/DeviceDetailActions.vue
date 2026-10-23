<template>
  <div class="device-detail-actions">
    <a-button v-if="permissions.update" :disabled="!!busyAction" :loading="busyAction === 'edit'" @click="emit('edit')">
      <template #icon><AIcon type="EditOutlined" /></template>
      {{ $t('IotDeviceDetail.detail.edit') }}
    </a-button>
    <a-popconfirm
      v-if="permissions.action"
      :title="$t(disabled ? 'IotDeviceList.confirm.enableOne' : 'IotDeviceList.confirm.disableOne', { name })"
      :disabled="!!busyAction"
      :ok-button-props="{ loading: busyAction === 'toggle' }"
      @confirm="emit('toggle')"
    >
      <a-button :disabled="!!busyAction" :loading="busyAction === 'toggle'">
        <template #icon><AIcon :type="disabled ? 'CheckSquareOutlined' : 'StopOutlined'" /></template>
        {{ $t(disabled ? 'IotDeviceDetail.detail.enable' : 'IotDeviceDetail.detail.disable') }}
      </a-button>
    </a-popconfirm>
    <a-popconfirm
      v-if="permissions.delete"
      :title="$t('IotDeviceList.confirm.deleteOne', { name })"
      :disabled="!disabled || !!busyAction"
      :ok-button-props="{ loading: busyAction === 'delete' }"
      @confirm="emit('delete')"
    >
      <a-button danger :disabled="!disabled || !!busyAction" :loading="busyAction === 'delete'">
        <template #icon><AIcon type="DeleteOutlined" /></template>
        {{ $t('IotDeviceDetail.detail.delete') }}
      </a-button>
    </a-popconfirm>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// 设备与网关共用展示和确认交互；权限计算、请求及刷新由各自宿主负责。
defineProps<{
  name: string
  disabled: boolean
  permissions: { update: boolean; action: boolean; delete: boolean }
  busyAction: 'edit' | 'toggle' | 'delete' | ''
}>()

const emit = defineEmits<{
  (event: 'edit'): void
  (event: 'toggle'): void
  (event: 'delete'): void
}>()
const { t: $t } = useI18n()
</script>

<style scoped>
.device-detail-actions {
  display: inline-flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-2);
}
</style>
