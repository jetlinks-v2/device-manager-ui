<template>
  <IotDeviceAlarmsTab :device="device" />
</template>
<script setup lang="ts">
import IotDeviceAlarmsTab from './IotDeviceAlarmsTab.vue'
import type { IotDevice } from '../../types'
defineProps<{ device: IotDevice }>()
</script>
