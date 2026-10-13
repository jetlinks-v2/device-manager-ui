<template>
  <div class="trend-controls">
    <div class="trend-controls__metric">
      <a-segmented :value="view.activeMetric" :options="view.metricOptions" size="small" :disabled="view.disabled" @change="view.selectMetric" />
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
.trend-controls__scope { color: var(--ink-3); font-size: 12px; white-space: nowrap; cursor: help; }
.trend-controls__time { display: flex; align-items: center; gap: var(--space-2, 8px); margin-left: auto; min-width: 0; flex: 0 1 430px; }
.trend-controls__time :deep(.ant-picker) { flex: 1; min-width: 0; }
.trend-controls__time :deep(.ant-btn) { flex: none; }
</style>
