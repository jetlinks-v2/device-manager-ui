<template>
  <DashboardPreviewTab :targetId="deviceId" />
</template>

<script setup lang="ts">
import DashboardPreviewTab from '../../../components/DashboardPreviewTab/index.vue'

const route = useRoute()
const deviceId = computed(() => String(route.params.id || ''))
</script>
