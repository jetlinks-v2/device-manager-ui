<template>
  <MetricTrendCard
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
import MetricTrendCard from '../components/MetricTrendCard.vue'
import { useOnlineCountCard } from '../hooks/useMetricCards'

defineOptions({
  name: 'OnlineCountCard'
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
const { config, data, loading, error, showFooter } = useOnlineCountCard(infoRef, isEditRef)
</script>
