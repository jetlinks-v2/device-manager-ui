<template>
  <MonitorCard :title="view.title" :state="view" @retry="view.refresh">
    <template #controls><TrendToolbar :view="view" /></template>
    <div v-if="view.legendItems && view.legendItems.length > 1" class="trend-legend">
      <span v-for="(item, index) in view.legendItems" :key="item.kind"><i :class="{ secondary: index > 0 }" />{{ item.label }}</span>
    </div>
    <div class="monitor-trend-chart"><JEcharts :option="view.chartOptions" /></div>
    <template #footer>
      <NodeFocusSelector v-if="!view.disabled && (view.nodeOptions.length > 1 || (view.nodeOptions.length > 0 && !view.selectedNodes.length))" :value="view.selectedNodes" :options="view.nodeOptions"
        @update:value="view.selectNodes" @reset="view.resetNodes" />
    </template>
  </MonitorCard>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import type { TrendView } from '../types'
import MonitorCard from './MonitorCard.vue'
import TrendToolbar from './TrendToolbar.vue'
import NodeFocusSelector from './NodeFocusSelector.vue'
defineProps({ view: { type: Object as PropType<TrendView>, required: true } })
</script>
<style scoped>
.monitor-trend-chart { flex: 1; min-height: 100px; min-width: 0; }
.trend-legend { display: flex; gap: 12px; color: var(--ink-3); font-size: 12px; }
.trend-legend span { display: inline-flex; align-items: center; gap: 6px; }
.trend-legend i { width: 20px; border-top: 2px solid currentColor; }
.trend-legend .secondary { border-top-style: dashed; }
</style>
<style lang="less" src="./monitorTooltip.less"></style>
