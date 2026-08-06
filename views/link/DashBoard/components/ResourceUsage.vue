<template>
  <div class="resource-usage">
    <div class="resource-usage__percent">
      <a-progress v-if="percent !== undefined" :percent="percent" :show-info="false" size="small" :stroke-color="strokeColor" />
      <span v-else class="resource-usage__empty" />
      <strong>{{ percent === undefined ? '--' : `${percent.toFixed(1)}%` }}</strong>
    </div>
    <small v-if="$slots.detail || detail || total !== undefined">
      <slot name="detail">{{ detail || `${formatMemorySize(used)} / ${formatMemorySize(total)}` }}</slot>
    </small>
  </div>
</template>

<script lang="ts" setup name="ResourceUsage">
import { formatMemorySize } from './monitorData'

const props = defineProps({
  percent: { type: Number, default: undefined },
  used: { type: Number, default: undefined },
  total: { type: Number, default: undefined },
  detail: { type: String, default: '' },
})
const strokeColor = computed(() => {
  if (props.percent === undefined) return '#1677ff'
  return props.percent >= 85 ? '#ff4d4f' : props.percent >= 70 ? '#faad14' : '#1677ff'
})
</script>

<style lang="less" scoped>
.resource-usage, .resource-usage__percent { min-width: 0; }
.resource-usage__percent { display: flex; align-items: center; gap: 0.375rem; line-height: 1.25; }
.resource-usage__percent :deep(.ant-progress), .resource-usage__empty { flex: 1; min-width: 2rem; margin: 0; }
.resource-usage strong { flex: none; width: 2.875rem; text-align: right; font-variant-numeric: tabular-nums; }
.resource-usage small { display: block; margin-top: -0.1875rem; color: rgba(0, 0, 0, 0.45); font-variant-numeric: tabular-nums; line-height: 1.15; text-align: right; }
</style>
