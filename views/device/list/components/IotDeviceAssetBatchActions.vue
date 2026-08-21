<template>
  <a-space class="iot-device-list__batch-actions" wrap :size="[8, 8]">
    <j-permission-button
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
    <j-permission-button :disabled="!selectedCount" :hasPermission="true" @click="onAssignArea">
      <template #icon><AIcon type="EnvironmentOutlined" /></template>
      {{ $t('IotDeviceList.action.assignArea') }}
    </j-permission-button>
    <j-permission-button :disabled="!selectedCount" :hasPermission="true" @click="onAssignGroup">
      <template #icon><AIcon type="ApartmentOutlined" /></template>
      {{ $t('IotDeviceList.action.assignGroup') }}
    </j-permission-button>
  </a-space>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  selectedCount: number
  runningAction: '' | 'enable' | 'disable' | 'export'
  onBatchToggle: (target: 'enable' | 'disable') => void | Promise<void>
  onAssignArea: () => void
  onAssignGroup: () => void
}>()

const { t: $t } = useI18n()
</script>
