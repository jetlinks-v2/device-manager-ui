<template>
  <!-- Renderless: owns deviceDetailChat for the embedding page lifetime. -->
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { DeviceInstance } from '@device-manager-ui/types/Instance'
import { resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import { mapApiDevice } from '../services/adapters/iotDeviceApiAdapter'
import { useDeviceDetailAgent } from './useDeviceDetailAgent'

const props = defineProps<{
  deviceId?: string
  deviceDetail?: Partial<DeviceInstance>
  tabs?: readonly string[]
  defaultTab?: string
}>()

const route = useRoute()
const device = computed(() => props.deviceDetail?.id
  ? mapApiDevice(props.deviceDetail, resolveIotProjectId(route))
  : undefined)

useDeviceDetailAgent({
  device,
  deviceId: () => props.deviceId,
  tabs: () => props.tabs,
  defaultTab: () => props.defaultTab,
})
</script>
