<template>
  <article class="detail-stat" :data-key="card.key" :data-tone="card.tone">
    <div class="detail-stat__label"><span />{{ title || card.label }}</div>
    <div class="detail-stat__main"><strong>{{ card.value }}</strong><em>{{ card.unit }}</em></div>
    <div class="detail-stat__sub" :title="card.sub">{{ card.sub }}</div>
    <JEcharts class="detail-stat__spark" :option="card.chartOption" />
  </article>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import type { OverviewStatCard } from '../../../views/device/list/components/device-detail/iotDeviceOverviewCharts'
defineProps({ card: { type: Object as PropType<OverviewStatCard>, required: true }, title: String })
</script>
<style scoped lang="less">
.detail-stat { position: relative; height: 100%; display: grid; align-content: center; grid-template-columns: minmax(0, 1fr) 4.875rem; gap: var(--space-1) var(--space-4); min-width: 0; }
.detail-stat__label { grid-column: 1 / -1; display: flex; align-items: center; gap: var(--space-2); color: var(--jet-theme-text-secondary); }
.detail-stat__label span { width: .375rem; height: .375rem; border-radius: var(--r-pill); background: var(--jet-theme-primary); }
.detail-stat[data-tone="orange"] .detail-stat__label span { background: var(--jet-theme-warning); }
.detail-stat[data-tone="cyan"] .detail-stat__label span { background: var(--jet-theme-success); }
.detail-stat__main { display: flex; align-items: baseline; min-width: 0; }
.detail-stat__main strong { color: var(--jet-theme-text); font-size: var(--fs-26); line-height: 1.2; overflow-wrap: anywhere; }
.detail-stat__main em { margin-left: var(--space-1); font-style: normal; color: var(--jet-theme-text-secondary); }
.detail-stat__sub { color: var(--jet-theme-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-stat__spark { grid-column: 2; grid-row: 2 / 4; width: 100%; height: 2.125rem; align-self: center; }
.detail-stat[data-key="active"] .detail-stat__main { grid-column: 1 / -1; }
.detail-stat[data-key="active"] .detail-stat__main strong { word-break: keep-all; }
.detail-stat[data-key="active"] .detail-stat__spark { grid-row: 3; height: 1.25rem; }
</style>
