<template>
  <DashboardCountConfig
    :configData="configData"
    :typeOptions="typeOptions"
    type="productCountCard"
  />
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import DashboardCountConfig from '../components/DashboardCountConfig.vue'

defineOptions({
  name: 'ProductCountCardConfig'
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
    name: '产品数量'
  },
  {
    value: 'normal',
    label: '正常',
    name: '正常产品'
  },
  {
    value: 'disabled',
    label: '禁用',
    name: '禁用产品'
  }
])
</script>
