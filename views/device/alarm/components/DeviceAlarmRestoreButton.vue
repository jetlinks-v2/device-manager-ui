<template>
  <a-button @click="openRestore">
    <template #icon>
      <AIcon type="ReloadOutlined" aria-hidden="true" />
    </template>
    {{ $t('DeviceAlarm.action.restore') }}
  </a-button>

  <DeviceAlarmLibraryRestoreModal
    v-model:open="restoreOpen"
    v-model:libraryId="restoreLibraryId"
    v-model:clearDeviceConfig="restoreClearDeviceConfig"
    v-model:selectedRowKeys="restoreSelectedRowKeys"
    :loading="restoreLoading"
    :libraries="restoreLibraries"
    :configs="restoreConfigs"
    @confirm="restoreFromLibrary"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DeviceAlarmLibraryRestoreModal from './DeviceAlarmLibraryRestoreModal.vue'
import { useDeviceAlarmRestore } from '../hooks/useDeviceAlarmRestore'

const emit = defineEmits<{
  (e: 'restored'): void
}>()

const { t: $t } = useI18n()
const {
  restoreOpen,
  restoreLoading,
  restoreLibraryId,
  restoreSelectedRowKeys,
  restoreClearDeviceConfig,
  restoreLibraries,
  restoreConfigs,
  openRestore,
  restoreFromLibrary,
} = useDeviceAlarmRestore($t, () => emit('restored'))
</script>
