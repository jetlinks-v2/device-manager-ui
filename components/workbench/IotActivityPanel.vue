<template>
  <section class="activity-panel" :aria-label="$t('IotWorkbench.activity.aria')">
    <header class="activity-panel__head">
      <h3>{{ $t('IotWorkbench.activity.title') }}</h3>
      <a-segmented
        :value="messageTrendRange"
        class="overview-chart__range"
        :options="trendRangeOptions"
        :aria-label="$t('IotDeviceGroups.overview.trendRange')"
        @change="handleTrendRangeChange"
      />
    </header>

    <div class="activity-panel__metrics">
      <div
        v-for="metric in activityMetrics"
        :key="metric.label"
        class="activity-panel__metric"
      >
        <span class="activity-panel__metric-head">
          <span :title="metric.label">{{ metric.label }}</span>
          <small>{{ metric.trend }}</small>
        </span>
        <strong>{{ formatMetricValue(metric.value) }}</strong>
      </div>
    </div>

    <div class="trend-panel__body">
      <div class="trend-panel__meta">
        <span>{{ $t('IotWorkbench.chart.unitMessage') }}</span>
        <span class="trend-panel__legend">
          <i class="trend-panel__legend-marker" aria-hidden="true"></i>
          {{ $t('IotWorkbench.chart.legendMessageCount') }}
        </span>
      </div>

      <div class="activity-panel__chart">
        <IotActiveTrendChart
          :values="activeTrendValues"
          :points="activeTrendPoints"
          :window-label="trendWindowLabel"
          value-type="message"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IotActiveTrendChart from './IotActiveTrendChart.vue'
import type { ActivityMetric } from '../useIotDeviceWorkbench'
import type { DeviceGroupTrendRange } from '../../api/deviceGroup'

const props = defineProps<{
  activityMetrics: ActivityMetric[]
  trendWindowLabel: string
  messageTrendRange: DeviceGroupTrendRange
  trendRangeOptions: Array<{ label: string; value: DeviceGroupTrendRange }>
  activeTrendValues: number[]
  activeTrendPoints: Array<{ label: string; x: number; y: number }>
}>()

const emit = defineEmits<{
  'update-trend-range': [range: DeviceGroupTrendRange]
}>()

const { t: $t } = useI18n()
const metricNumberFormatter = new Intl.NumberFormat()

function formatMetricValue(value: number) {
  return metricNumberFormatter.format(value)
}

function handleTrendRangeChange(value: string | number) {
  const next = props.trendRangeOptions.find((item) => item.value === value)
  if (next) emit('update-trend-range', next.value)
}
</script>
