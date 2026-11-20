<template>
  <IotDeviceAlarmWorkspace :key="device.id" :device="device" />
</template>
<script setup lang="ts">
import IotDeviceAlarmWorkspace from './IotDeviceAlarmWorkspace.vue'
import type { IotDevice } from '../../types'
defineProps<{ device: IotDevice }>()
</script>
