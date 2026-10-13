<template><TrendPanel data-monitor-widget="CpuTrend" :view="view" /></template>
<script setup lang="ts">
import { toRef, type PropType } from 'vue'
import type { DashboardWidget } from '@jetlinks-web-core/components/DashBoardCanvas'
import TrendPanel from '../components/TrendPanel.vue'
import { useResourceTrend } from '../hooks/useResourceTrend'
const props = defineProps({ info: { type: Object as PropType<DashboardWidget>, default: undefined }, isEdit: { type: Boolean, default: false } })
const view = useResourceTrend('cpu', toRef(props, 'isEdit'))
</script>
