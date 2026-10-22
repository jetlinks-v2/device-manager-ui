<template>
  <div class="detail-message">
    <JEcharts class="detail-message__chart" :option="option" />
    <footer class="detail-message__legend">
      <span><i class="up" />{{ t('IotDeviceDetail.overview.upstreamMessages') }} <strong>{{ formatCount(totals.up) }}</strong></span>
      <span><i class="down" />{{ t('IotDeviceDetail.overview.downstreamMessages') }} <strong>{{ formatCount(totals.down) }}</strong></span>
      <em>{{ t('IotDeviceDetail.overview.trafficLegend', { upstream: traffic.up, downstream: traffic.down }) }}</em>
    </footer>
  </div>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCount } from '../../../views/device/list/components/device-detail/iotDeviceOverviewCharts'
defineProps({ option: { type: Object, required: true }, totals: { type: Object as PropType<{ up: number; down: number }>, required: true }, traffic: { type: Object as PropType<{ up: string; down: string }>, required: true } })
const { t } = useI18n()
</script>
<style scoped>
.detail-message { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: var(--space-3); }
.detail-message__chart { flex: 1; min-height: 0; width: 100%; }
.detail-message__legend { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-4); padding: var(--space-3); background: var(--jet-theme-primary-soft); border-radius: var(--r-2); color: var(--jet-theme-text); }
.detail-message__legend span { display: inline-flex; align-items: center; gap: var(--space-2); }
.detail-message__legend i { width: .375rem; height: .375rem; border-radius: var(--r-pill); background: var(--jet-theme-primary); }
.detail-message__legend .down { background: var(--jet-theme-warning); }
.detail-message__legend em { margin-left: auto; font-style: normal; color: var(--jet-theme-text-secondary); }
</style>
