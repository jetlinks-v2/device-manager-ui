<template>
  <div class="resource-usage" :class="usageClass">
    <div class="resource-usage__percent">
      <a-progress v-if="available" :percent="percent" :show-info="false" :stroke-width="3" :stroke-color="strokeColor" />
      <strong :class="{ 'is-unavailable': !available }">{{ available ? `${percent!.toFixed(1)}%` : t('components.RealtimeResource.noData') }}</strong>
    </div>
    <small v-if="$slots.detail || detail || (used !== undefined && total !== undefined)">
      <slot name="detail">{{ detail || `${formatMemorySize(used)} / ${formatMemorySize(total)}` }}</slot>
    </small>
  </div>
</template>
<script lang="ts" setup name="ResourceUsage">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMemorySize } from '../utils/monitorData'

const props = defineProps({
  percent: { type: Number, default: undefined },
  used: { type: Number, default: undefined },
  total: { type: Number, default: undefined },
  detail: { type: String, default: '' },
})
const { t } = useI18n()
const available = computed(() => props.percent !== undefined && Number.isFinite(props.percent))
const usageClass = computed(() => !available.value ? '' : props.percent! >= 85 ? 'is-high' : props.percent! >= 70 ? 'is-elevated' : '')
const strokeColor = computed(() => !available.value ? undefined
  : props.percent! >= 85 ? 'var(--danger-color, #ff4d4f)'
    : props.percent! >= 70 ? 'var(--warning-color, #d48806)' : 'var(--primary-color, #1677ff)')
</script>
<style lang="less" scoped>
.resource-usage { min-width: 0; max-width: 160px; margin-left: auto; }
.resource-usage__percent { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; line-height: 20px; }
.resource-usage__percent :deep(.ant-progress) { flex: 1; min-width: 20px; margin: 0; line-height: 1; }
.resource-usage strong { flex: none; min-width: 3rem; text-align: right; font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.resource-usage small { display: block; margin-top: 4px; color: var(--ink-3, #86909c); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
.resource-usage.is-elevated strong { color: var(--warning-color, #d48806); }
.resource-usage.is-high strong { color: var(--danger-color, #ff4d4f); }
.resource-usage strong.is-unavailable { color: var(--ink-3, #86909c); font-size: 12px; font-weight: 400; }
</style>
