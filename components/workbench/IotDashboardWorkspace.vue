<template>
  <section class="dashboard-workspace" :aria-label="$t('IotWorkbench.workspace.aria')">
    <main class="dashboard-canvas" :aria-label="$t('IotWorkbench.workspace.canvas')">
      <IotDashboardWidgetCard
        v-for="widget in widgets"
        :key="widget.id"
        :widget="widget"
        :selected="selectedWidgetId === widget.id"
        :widget-template="widgetTemplate"
        :trend-icon="trendIcon"
        :activity-metrics="activityMetrics"
        :trend-window-label="trendWindowLabel"
        :active-device-count="activeDeviceCount"
        :online-rate-trend-range="onlineRateTrendRange"
        :alarm-trend-range="alarmTrendRange"
        :alarm-rank-range="alarmRankRange"
        :trend-range-options="trendRangeOptions"
        :online-rate-trend-values="onlineRateTrendValues"
        :online-rate-trend-points="onlineRateTrendPoints"
        :alarm-record-trend-values="alarmRecordTrendValues"
        :alarm-record-trend-points="alarmRecordTrendPoints"
        :status-distribution="statusDistribution"
        :alert-top-devices="alertTopDevices"
        :alert-type-rows="alertTypeRows"
        :area-rows="areaRows"
        :connection-metrics="connectionMetrics"
        :realtime-messages="realtimeMessages"
        :alarm-rank-page-index="alarmRankPageIndex"
        :alarm-rank-page-total="alarmRankPageTotal"
        :latest-alarm-page-index="latestAlarmPageIndex"
        :latest-alarm-page-total="latestAlarmPageTotal"
        @select="$emit('select', $event)"
        @remove="$emit('remove', $event)"
        @apply="$emit('apply', $event)"
        @focus-area="$emit('focus-area', $event)"
        @update-trend-range="$emit('update-trend-range', $event)"
        @update-alarm-trend-range="$emit('update-alarm-trend-range', $event)"
        @update-alarm-rank-range="$emit('update-alarm-rank-range', $event)"
        @change-alarm-rank-page="$emit('change-alarm-rank-page', $event)"
        @change-latest-alarm-page="$emit('change-latest-alarm-page', $event)"
        @open-device-alarm="$emit('open-device-alarm', $event)"
      />

      <CloudEmpty
        v-if="!widgets.length"
        class="dashboard-empty"
        type="page"
      >
        <template #description>
          <strong>{{ $t('IotWorkbench.workspace.emptyTitle') }}</strong>
          <span>{{ $t('IotWorkbench.workspace.emptyDesc') }}</span>
        </template>
      </CloudEmpty>
    </main>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IotDashboardWidgetCard from './IotDashboardWidgetCard.vue'
import type {
  ActivityMetric,
  AlertTypeRow,
  AreaRow,
  ConnectionMetric,
  DashboardWidget,
  IotAlarmRankRow,
  PercentRow,
  RealtimeMessage,
  WidgetKind,
  WidgetTemplate,
} from '../useIotDeviceWorkbench'
import type { IotDeviceFilters } from '../../types'
import type { DeviceGroupTrendRange } from '../../api/deviceGroup'

defineProps<{
  widgets: DashboardWidget[]
  selectedWidgetId: string
  widgetTemplate: (kind: WidgetKind) => WidgetTemplate
  trendIcon: (direction: 'up' | 'down' | 'flat') => string
  activityMetrics: ActivityMetric[]
  trendWindowLabel: string
  activeDeviceCount: number
  onlineRateTrendRange: DeviceGroupTrendRange
  alarmTrendRange: DeviceGroupTrendRange
  alarmRankRange: DeviceGroupTrendRange
  trendRangeOptions: Array<{ label: string; value: DeviceGroupTrendRange }>
  onlineRateTrendValues: number[]
  onlineRateTrendPoints: Array<{ label: string; x: number; y: number }>
  alarmRecordTrendValues: number[]
  alarmRecordTrendPoints: Array<{ label: string; x: number; y: number }>
  statusDistribution: PercentRow[]
  alertTopDevices: IotAlarmRankRow[]
  alertTypeRows: AlertTypeRow[]
  areaRows: AreaRow[]
  connectionMetrics: ConnectionMetric[]
  realtimeMessages: RealtimeMessage[]
  alarmRankPageIndex: number
  alarmRankPageTotal: number
  latestAlarmPageIndex: number
  latestAlarmPageTotal: number
}>()

defineEmits<{
  select: [widgetId: string]
  remove: [widgetId: string]
  apply: [target: Partial<IotDeviceFilters>]
  'focus-area': [area: string]
  'update-trend-range': [range: DeviceGroupTrendRange]
  'update-alarm-trend-range': [range: DeviceGroupTrendRange]
  'update-alarm-rank-range': [range: DeviceGroupTrendRange]
  'change-alarm-rank-page': [direction: number]
  'change-latest-alarm-page': [direction: number]
  'open-device-alarm': [deviceId: string]
}>()

const { t: $t } = useI18n()
</script>
