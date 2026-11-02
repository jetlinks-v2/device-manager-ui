<template>
  <MetricTemplateManager :editable="editable" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MetricTemplateManager } from '@jetlinks-web-core/components'
import { useAuthStore } from '@jetlinks-web-core/store'

const auth = useAuthStore()
const editable = computed(() => auth.hasPermission('device/MetricTemplate:save'))
</script>
