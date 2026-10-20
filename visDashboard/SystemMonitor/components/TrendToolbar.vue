<template>
  <div class="trend-controls">
    <div class="trend-controls__metric">
      <a-segmented class="trend-controls__switch" :value="view.activeMetric" :options="view.metricOptions" size="small" :disabled="view.disabled" @change="view.selectMetric" />
      <a-tooltip v-if="view.metricScope" :title="view.metricScope.tooltip">
        <span class="trend-controls__scope"><AIcon type="InfoCircleOutlined" /> {{ view.metricScope.label }}</span>
      </a-tooltip>
    </div>
    <div class="trend-controls__time">
      <a-range-picker :value="view.timeRange" :allow-clear="false" :disabled="view.disabled"
        :show-time="{ format: 'HH:mm:ss' }" format="YYYY-MM-DD HH:mm:ss" @change="view.selectRange">
        <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
        <template #renderExtraFooter>
          <a-radio-group :value="view.shortcut" button-style="solid" size="small" @update:value="view.selectShortcut">
            <a-radio-button value="hour">{{ $t('components.MonitorTrend.lastHour') }}</a-radio-button>
            <a-radio-button value="day">{{ $t('components.MonitorTrend.lastDay') }}</a-radio-button>
            <a-radio-button value="week">{{ $t('components.MonitorTrend.lastWeek') }}</a-radio-button>
          </a-radio-group>
        </template>
      </a-range-picker>
      <a-tooltip :title="$t('components.MonitorRefresh.button')">
        <a-button type="text" :loading="view.loading" :disabled="view.disabled" :aria-label="$t('components.MonitorRefresh.button')" @click="view.refresh">
          <template #icon><AIcon type="ReloadOutlined" /></template>
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import type { TrendView } from '../types'
defineProps({ view: { type: Object as PropType<TrendView>, required: true } })
</script>
<style scoped>
.trend-controls { display: flex; flex: 1 1 auto; align-items: center; flex-wrap: wrap; gap: var(--space-3, 12px); min-width: 0; }
.trend-controls__metric { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2, 8px); min-width: 0; }
.trend-controls__switch.ant-segmented { max-width: 100%; overflow-x: auto; padding: 2px; border-radius: 4px; background: #F2F3F5; color: #4E5969; font-size: 12px; }
.trend-controls__switch :deep(.ant-segmented-group) { gap: 2px; }
.trend-controls__switch :deep(.ant-segmented-item) { border-radius: 3px; transition: color .2s; }
.trend-controls__switch :deep(.ant-segmented-item-label) { min-height: 22px; padding: 2px 10px; line-height: 18px; font-size: 12px; font-weight: 400; }
.trend-controls__switch :deep(.ant-segmented-item-selected),
.trend-controls__switch :deep(.ant-segmented-thumb) { border-radius: 3px; background: #fff; color: #165DFF; font-weight: 500; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
.trend-controls__switch :deep(.ant-segmented-item:hover:not(.ant-segmented-item-selected)) { color: #1D2129; }
.trend-controls__switch :deep(.ant-segmented-item:has(input:focus-visible)) { outline: 2px solid #1677ff; outline-offset: -1px; }
.trend-controls__scope { color: var(--ink-3); font-size: 12px; white-space: nowrap; cursor: help; }
.trend-controls__time { display: flex; align-items: center; gap: var(--space-2, 8px); margin-left: auto; min-width: 0; flex: 0 1 430px; }
.trend-controls__time :deep(.ant-picker) { flex: 1; min-width: 0; }
.trend-controls__time :deep(.ant-btn) { flex: none; }
</style>
