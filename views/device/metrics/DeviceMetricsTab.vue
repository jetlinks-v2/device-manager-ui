<template><ObjectMetrics v-if="deviceId" :context="context" /></template>
<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@jetlinks-web-core/store'
import ObjectMetrics from './ObjectMetrics.vue'
const props = defineProps<{ deviceId: string }>()
const auth = useAuthStore()
const context = computed(() => ({ ownerType: 'device', ownerId: props.deviceId, editable: auth.hasPermission(['device/Instance:update', 'iot-user/device/list:update', 'iot-user-device-list:update']) }))
</script>
