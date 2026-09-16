<template>
  <!-- Renderless: owns deviceDetailChat for the embedding page lifetime. -->
</template>

<script setup lang="ts">
import { useDeviceDetailAgent } from './useDeviceDetailAgent'

const props = defineProps<{
  deviceId?: string
}>()

useDeviceDetailAgent({
  deviceId: () => props.deviceId,
})
</script>
