<template>
  <DashboardCountConfig
    :configData="configData"
    :typeOptions="typeOptions"
    type="onlineCountCard"
  />
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import DashboardCountConfig from '../components/DashboardCountConfig.vue'

defineOptions({
  name: 'OnlineCountCardConfig'
})

type DashboardCountOption = {
  value: string
  label: string
  name: string
}

defineProps({
  configData: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  }
})

const typeOptions = computed<DashboardCountOption[]>(() => [
  {
    value: 'all',
    label: '当前在线 + 昨日在线',
    name: '当前在线'
  },
  {
    value: 'current',
    label: '当前在线',
    name: '当前在线'
  }
])
</script>
