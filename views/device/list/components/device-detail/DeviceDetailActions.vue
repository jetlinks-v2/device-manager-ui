<template>
  <DetailActionPopupBoundary>
    <div class="device-detail-actions">
      <j-permission-button
        :disabled="!!busyAction"
        :loading="busyAction === 'edit'"
        :hasPermission="permissions.update"
        @click="emit('edit')"
      >
        <template #icon><AIcon type="EditOutlined" /></template>
        {{ $t('IotDeviceDetail.detail.edit') }}
      </j-permission-button>
      <a-popconfirm
        :title="$t(disabled ? 'IotDeviceList.confirm.enableOne' : 'IotDeviceList.confirm.disableOne', { name })"
        :disabled="!permissions.action || !!busyAction"
        :ok-button-props="{ loading: busyAction === 'toggle' }"
        @confirm="emit('toggle')"
      >
        <j-permission-button
          :disabled="!!busyAction"
          :loading="busyAction === 'toggle'"
          :hasPermission="permissions.action"
        >
          <template #icon><AIcon :type="disabled ? 'CheckSquareOutlined' : 'StopOutlined'" /></template>
          {{ $t(disabled ? 'IotDeviceDetail.detail.enable' : 'IotDeviceDetail.detail.disable') }}
        </j-permission-button>
      </a-popconfirm>
      <a-popconfirm
        :title="$t('IotDeviceList.confirm.deleteOne', { name })"
        :disabled="!permissions.delete || !disabled || !!busyAction"
        :ok-button-props="{ loading: busyAction === 'delete' }"
        @confirm="emit('delete')"
      >
        <j-permission-button
          danger
          :disabled="!disabled || !!busyAction"
          :loading="busyAction === 'delete'"
          :hasPermission="permissions.delete"
        >
          <template #icon><AIcon type="DeleteOutlined" /></template>
          {{ $t('IotDeviceDetail.detail.delete') }}
        </j-permission-button>
      </a-popconfirm>
    </div>
  </DetailActionPopupBoundary>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DetailActionPopupBoundary from '../../../components/DetailActionPopupBoundary.vue'

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
  flex-wrap: wrap;
  max-width: 100%;
  align-items: center;
  gap: var(--space-2);
}
</style>
