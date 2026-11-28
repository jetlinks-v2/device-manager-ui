<template>
  <DefineToggleAction v-slot="{ close }">
    <a-popconfirm
      v-if="permissions.action"
      :title="$t(disabled ? 'IotDeviceList.confirm.enableOne' : 'IotDeviceList.confirm.disableOne', { name })"
      :disabled="!!busyAction"
      :ok-button-props="{ loading: busyAction === 'toggle' }"
      @confirm="emit('toggle'); close?.()"
    >
      <a-button :type="compact ? 'text' : 'default'" :disabled="!!busyAction" :loading="busyAction === 'toggle'">
        <template #icon><AIcon :type="disabled ? 'CheckCircleOutlined' : 'StopOutlined'" aria-hidden="true" /></template>
        {{ $t(disabled ? 'IotDeviceDetail.detail.enable' : 'IotDeviceDetail.detail.disable') }}
      </a-button>
    </a-popconfirm>
  </DefineToggleAction>
  <DefineDeleteAction v-slot="{ close }">
    <a-popconfirm
      v-if="permissions.delete"
      :title="$t('IotDeviceList.confirm.deleteOne', { name })"
      :disabled="!disabled || !!busyAction"
      :ok-button-props="{ loading: busyAction === 'delete' }"
      @confirm="emit('delete'); close?.()"
    >
      <a-button :type="compact ? 'text' : 'default'" danger :disabled="!disabled || !!busyAction" :loading="busyAction === 'delete'">
        <template #icon><AIcon type="DeleteOutlined" aria-hidden="true" /></template>
        {{ $t('IotDeviceDetail.detail.delete') }}
      </a-button>
    </a-popconfirm>
  </DefineDeleteAction>
  <DefineEditAction>
    <a-button v-if="permissions.update && editMode !== 'hidden'" :type="compact ? 'text' : 'default'" :disabled="!!busyAction" :loading="busyAction === 'edit'" @click="emit('edit')">
      <template #icon><AIcon :type="editMode === 'settings' ? 'SettingOutlined' : 'EditOutlined'" aria-hidden="true" /></template>
      {{ $t(editMode === 'settings' ? 'IotDeviceDetail.header.accessSettings' : 'IotDeviceDetail.detail.edit') }}
    </a-button>
  </DefineEditAction>
  <div class="device-detail-actions">
    <TableActions v-if="compact">
      <template #trigger="{ open }"><a-button type="text" class="device-detail-actions__trigger" :title="$t('IotDeviceDetail.header.manageDevice')" :aria-label="$t('IotDeviceDetail.header.manageDevice')" :aria-expanded="open" :disabled="!!busyAction"><AIcon class="device-detail-actions__icon" type="ControlOutlined" aria-hidden="true" /><span class="device-detail-actions__label">{{ $t('IotDeviceDetail.header.manage') }}</span><AIcon class="device-detail-actions__overflow" type="EllipsisOutlined" aria-hidden="true" /></a-button></template>
      <TableActionsItem v-if="$slots.more"><slot name="more" /></TableActionsItem>
      <TableActionsItem v-if="permissions.update && editMode !== 'hidden'"><EditAction /></TableActionsItem>
      <TableActionsItem v-if="permissions.action" :separated="!!$slots.more || (permissions.update && editMode !== 'hidden')" :close-on-click="false" v-slot="{ close }"><ToggleAction :close="close" /></TableActionsItem>
      <TableActionsItem v-if="permissions.delete" separated :close-on-click="false" v-slot="{ close }"><DeleteAction :close="close" /></TableActionsItem>
    </TableActions>
    <template v-else><EditAction /><ToggleAction /><DeleteAction /><slot name="more" /></template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { createReusableTemplate } from '@vueuse/core'
import TableActions, { TableActionsItem } from '@jetlinks-web-core/components/TableActions'

// 设备与网关共用展示和确认交互；权限计算、请求及刷新由各自宿主负责。
defineProps<{
  name: string
  disabled: boolean
  permissions: { update: boolean; action: boolean; delete: boolean }
  busyAction: 'edit' | 'toggle' | 'delete' | ''
  compact?: boolean
  /** 默认保留旧编辑入口；分区已接管资料编辑时隐藏，专属配置使用设置语义。 */
  editMode?: 'default' | 'settings' | 'hidden'
}>()

const emit = defineEmits<{
  (event: 'edit'): void
  (event: 'toggle'): void
  (event: 'delete'): void
}>()
const { t: $t } = useI18n()
const [DefineToggleAction, ToggleAction] = createReusableTemplate<{ close?: () => void }>()
const [DefineDeleteAction, DeleteAction] = createReusableTemplate<{ close?: () => void }>()
const [DefineEditAction, EditAction] = createReusableTemplate()
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
.device-detail-actions__trigger { display:inline-flex; align-items:center; gap:5px; color:var(--jet-theme-text-secondary); transition-property:color, background-color, border-color, box-shadow; }
.device-detail-actions__trigger > .anticon { margin-inline-start:0; }
.device-detail-actions__trigger > .anticon + span { margin-inline-start:0; }
.device-detail-actions__icon { flex:none; font-size:14px; }
.device-detail-actions__overflow { display:none; }
@container detail-header (max-width:400px) {
  .device-detail-actions__trigger { gap:0; }
  .device-detail-actions__icon,.device-detail-actions__label { display:none; }
  .device-detail-actions__overflow { display:inline-flex; }
}
</style>
