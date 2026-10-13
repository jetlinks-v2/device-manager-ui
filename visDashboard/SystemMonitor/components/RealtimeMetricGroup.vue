<template>
  <div
    class="realtime-metric-group"
    :class="{
      'realtime-metric-group--inline': inline,
      'realtime-metric-group--compact': compact,
      'realtime-metric-group--fit': fit,
    }"
  >
    <div v-for="item in items" :key="item.label" class="realtime-metric-group__item">
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </div>
  </div>
</template>

<script lang="ts" setup name="RealtimeMetricGroup">
import type { PropType } from 'vue'

interface RealtimeMetricItem {
  label: string
  value: string
}

defineProps({
  items: { type: Array as PropType<RealtimeMetricItem[]>, required: true },
  inline: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  fit: { type: Boolean, default: false },
})
</script>

<style lang="less" scoped>
.realtime-metric-group { display: flex; flex-direction: column; gap: 0.0625rem; min-width: 0; line-height: 1.25; }
.realtime-metric-group__item { display: grid; grid-template-columns: 5.5rem 1fr; align-items: baseline; gap: 0.375rem; min-width: 0; }
.realtime-metric-group__item span { overflow: hidden; color: rgba(0, 0, 0, 0.45); font-size: 0.75rem; white-space: nowrap; text-overflow: ellipsis; }
.realtime-metric-group__item strong { font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.realtime-metric-group--inline { flex-direction: row; gap: 0.5rem; }
.realtime-metric-group--inline .realtime-metric-group__item { display: flex; flex: 1; justify-content: space-between; gap: 0.25rem; }
.realtime-metric-group--fit { justify-content: space-between; }
.realtime-metric-group--fit .realtime-metric-group__item {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: max-content max-content;
}
.realtime-metric-group--compact .realtime-metric-group__item {
  display: flex;
  width: calc((100% - 0.5rem) / 2);
  justify-content: space-between;
  gap: 0.25rem;
}
</style>
