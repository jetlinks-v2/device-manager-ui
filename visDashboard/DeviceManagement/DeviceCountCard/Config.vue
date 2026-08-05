<template>
  <DashboardCountConfig
    :configData="configData"
    :typeOptions="typeOptions"
    type="deviceCountCard"
  />
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import DashboardCountConfig from '../components/DashboardCountConfig.vue'

defineOptions({
  name: 'DeviceCountCardConfig'
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
    label: '全部',
    name: '设备数量'
  },
  {
    value: 'online',
    label: '在线设备',
    name: '在线设备'
  },
  {
    value: 'offline',
    label: '离线设备',
    name: '离线设备'
  }
])
</script>
