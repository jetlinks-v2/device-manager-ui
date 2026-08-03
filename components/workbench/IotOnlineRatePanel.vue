<template>
  <section class="online-rate-panel" :aria-label="$t('IotWorkbench.chart.activeAria')">
    <header class="activity-panel__head">
      <h3>{{ $t('IotWorkbench.widget.onlineTrend') }}</h3>
      <a-segmented
        :value="onlineRateTrendRange"
        class="overview-chart__range"
        :options="trendRangeOptions"
        :aria-label="$t('IotDeviceGroups.overview.trendRange')"
        @change="handleTrendRangeChange"
      />
    </header>

    <div class="trend-panel__body">
      <div class="trend-panel__meta">
        <span>{{ $t('IotWorkbench.chart.unitPercent') }}</span>
        <span class="trend-panel__legend">
          <i class="trend-panel__legend-marker trend-panel__legend-marker--online" aria-hidden="true"></i>
          {{ $t('IotWorkbench.chart.legendOnlineRate') }}
        </span>
      </div>

      <div class="online-rate-panel__chart">
        <IotActiveTrendChart
          :values="onlineRateTrendValues"
          :points="onlineRateTrendPoints"
          :window-label="trendWindowLabel"
          value-type="percent"
          :aria-label="$t('IotWorkbench.chart.activeAria')"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IotActiveTrendChart from './IotActiveTrendChart.vue'
import type { DeviceGroupTrendRange } from '../../api/deviceGroup'

const props = defineProps<{
  trendWindowLabel: string
  onlineRateTrendRange: DeviceGroupTrendRange
  trendRangeOptions: Array<{ label: string; value: DeviceGroupTrendRange }>
  onlineRateTrendValues: number[]
  onlineRateTrendPoints: Array<{ label: string; x: number; y: number }>
}>()

const emit = defineEmits<{
  'update-trend-range': [range: DeviceGroupTrendRange]
}>()

const { t: $t } = useI18n()

function handleTrendRangeChange(value: string | number) {
  const next = props.trendRangeOptions.find((item) => item.value === value)
  if (next) emit('update-trend-range', next.value)
}
</script>
