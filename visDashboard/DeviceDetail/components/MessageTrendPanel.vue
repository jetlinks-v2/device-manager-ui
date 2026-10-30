<template>
  <div class="detail-message">
    <div class="detail-message__summary">
      <div class="detail-message__totals">
        <span>{{ t('IotDeviceDetail.overview.upstreamMessages') }} <strong>{{ formatCount(totals.up) }}</strong></span>
        <span>{{ t('IotDeviceDetail.overview.downstreamMessages') }} <strong>{{ formatCount(totals.down) }}</strong></span>
      </div>
      <span class="detail-message__traffic">{{ t('IotDeviceDetail.overview.trafficLegend', { upstream: traffic.up, downstream: traffic.down }) }}</span>
    </div>
    <JEcharts class="detail-message__chart" :option="option" />
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
.detail-message { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: var(--space-2); }
.detail-message__summary { display: flex; flex-shrink: 0; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.detail-message__totals { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
.detail-message__totals span { display: inline-flex; align-items: baseline; gap: var(--space-2); }
.detail-message__totals strong { color: var(--jet-theme-text); font-size: var(--fs-16); font-weight: 600; font-variant-numeric: tabular-nums; }
.detail-message__traffic { margin-left: auto; }
.detail-message__chart { flex: 1; min-height: 0; width: 100%; }
</style>
