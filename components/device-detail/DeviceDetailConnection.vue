<template>
  <span class="device-detail-connection-inline">
    <DeviceConnectionStatus :observation="observation" :device-id="deviceId" :status="status" :label="label" :online-at="onlineAt" :offline-at="offlineAt" :last-report-at="lastReportAt" />
  </span>
</template>
<script setup lang="ts">
import DeviceConnectionStatus from './DeviceConnectionStatus.vue'
import { useDeviceConnectionHeader } from '../../deviceDetailConnection'
const props = defineProps<{ deviceId: string; projectId?: string; status: string; label: string; onlineAt?: number; offlineAt?: number; lastReportAt?: number }>()
const observation = useDeviceConnectionHeader(props)
</script>
<style scoped>
.device-detail-connection-inline { display:inline-flex; align-items:center; gap:8px; min-width:0; max-width:100%; }
</style>
