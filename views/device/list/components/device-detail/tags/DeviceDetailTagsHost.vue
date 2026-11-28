<template>
  <DeviceDetailTags v-if="state.thingModelTags.length" :key="deviceId" :state="state" :trigger="trigger" />
</template>

<script setup lang="ts">
import DeviceDetailTags from './DeviceDetailTags.vue'
import { useDeviceDetailTags, type DeviceDetailTagsProps } from './useDeviceDetailTags'

const props = defineProps<DeviceDetailTagsProps & { trigger?: boolean }>()
const emit = defineEmits<{ saved: [deviceId: string, detail: Record<string, any>] }>()
const state = useDeviceDetailTags(props, (deviceId, detail) => emit('saved', deviceId, detail))
</script>
