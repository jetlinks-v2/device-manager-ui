<template>
  <DashboardCountConfig
    :configData="configData"
    :typeOptions="typeOptions"
    type="messageVolumeCard"
  />
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import DashboardCountConfig from '../components/DashboardCountConfig.vue'

defineOptions({
  name: 'MessageVolumeCardConfig'
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
    label: '今日 + 当月',
    name: '今日设备消息量'
  },
  {
    value: 'today',
    label: '今日消息量',
    name: '今日设备消息量'
  }
])
</script>
