<template>
  <MetricImageCard
    :config="config"
    :data="data"
    :loading="loading"
    :error="error"
    :showFooter="showFooter"
    :style="style"
  />
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import MetricImageCard from '../components/MetricImageCard.vue'
import { useDeviceCountCard } from '../hooks/useMetricCards'

defineOptions({
  name: 'DeviceCountCard'
})

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

const props = defineProps({
  info: {
    type: Object as PropType<DashboardCardInfo>,
    default: () => ({})
  },
  style: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const infoRef = toRef(props, 'info')
const isEditRef = toRef(props, 'isEdit')
const { config, data, loading, error, showFooter } = useDeviceCountCard(infoRef, isEditRef)
</script>
