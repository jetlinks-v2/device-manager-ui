<template>
  <article
    class="dashboard-card"
    :class="[`dashboard-card--${widget.size}`, `dashboard-card--${widget.kind}`]"
  >
    <header class="dashboard-card__head">
      <span class="dashboard-card__head-title">{{ widget.title }}</span>
      <div class="dashboard-card__tools">
        <a-segmented
          v-if="widget.kind === 'alarm-trend'"
          :value="alarmTrendRange"
          class="overview-chart__range"
          :options="trendRangeOptions"
          :aria-label="$t('IotDeviceGroups.overview.trendRange')"
          @change="handleAlarmTrendRangeChange"
        />
        <a-segmented
          v-else-if="widget.kind === 'alert-rank'"
          :value="alarmRankRange"
          class="overview-chart__range"
          :options="trendRangeOptions"
          :aria-label="$t('IotDeviceGroups.overview.trendRange')"
          @change="handleAlarmRankRangeChange"
        />
      </div>
    </header>

    <div class="dashboard-card__body">
      <template v-if="widget.kind === 'online-trend'">
        <div class="activity-widget">
          <div class="overview-chart">
            <header>
              <span>{{ $t('IotWorkbench.chart.activeTrend', { window: trendWindowLabel }) }}</span>
              <a-segmented
                :value="onlineRateTrendRange"
                class="overview-chart__range"
                :options="trendRangeOptions"
                :aria-label="$t('IotDeviceGroups.overview.trendRange')"
                @change="handleTrendRangeChange"
              />
            </header>
            <IotActiveTrendChart
              :values="onlineRateTrendValues"
              :points="onlineRateTrendPoints"
              :window-label="trendWindowLabel"
              value-type="percent"
              :aria-label="$t('IotWorkbench.chart.activeAria')"
            />
          </div>
        </div>
      </template>

      <template v-else-if="widget.kind === 'alarm-trend'">
        <div class="activity-widget">
          <div class="overview-chart">
            <div class="trend-panel__meta trend-panel__meta--alarm">
              <span>{{ $t('IotWorkbench.chart.unitRecord') }}</span>
              <span class="trend-panel__legend">
                <i class="trend-panel__legend-marker trend-panel__legend-marker--alarm" aria-hidden="true" />
                {{ $t('IotWorkbench.chart.legendAlarmCount') }}
              </span>
            </div>
            <IotActiveTrendChart
              :values="alarmRecordTrendValues"
              :points="alarmRecordTrendPoints"
              :window-label="alarmTrendWindowLabel"
              value-type="record"
              :aria-label="$t('IotWorkbench.chart.alarmAria')"
            />
          </div>
        </div>
      </template>

      <template v-else-if="widget.kind === 'status-distribution'">
        <div class="distribution-widget">
          <div v-for="item in statusDistribution" :key="item.label" class="bar-row">
            <span>{{ item.label }}</span>
            <i><b :style="{ width: `${item.percent}%` }" :data-state="item.state" /></i>
            <em>{{ item.value }}</em>
          </div>
        </div>
      </template>

      <template v-else-if="widget.kind === 'alert-top'">
        <IotAlarmOverviewList
          mode="latest"
          :alert-top-devices="alertTopDevices"
          :realtime-messages="realtimeMessages"
          :alarm-rank-page-index="alarmRankPageIndex"
          :alarm-rank-page-total="alarmRankPageTotal"
          :latest-alarm-page-index="latestAlarmPageIndex"
          :latest-alarm-page-total="latestAlarmPageTotal"
          @change-alarm-rank-page="emit('change-alarm-rank-page', $event)"
          @change-latest-alarm-page="emit('change-latest-alarm-page', $event)"
          @open-device-alarm="emit('open-device-alarm', $event)"
        />
      </template>

      <template v-else-if="widget.kind === 'alert-rank'">
        <IotAlarmOverviewList
          mode="rank"
          :alert-top-devices="alertTopDevices"
          :realtime-messages="realtimeMessages"
          :alarm-rank-page-index="alarmRankPageIndex"
          :alarm-rank-page-total="alarmRankPageTotal"
          :latest-alarm-page-index="latestAlarmPageIndex"
          :latest-alarm-page-total="latestAlarmPageTotal"
          @change-alarm-rank-page="emit('change-alarm-rank-page', $event)"
          @change-latest-alarm-page="emit('change-latest-alarm-page', $event)"
          @open-device-alarm="emit('open-device-alarm', $event)"
        />
      </template>

      <template v-else-if="widget.kind === 'scene-health'">
        <div class="alert-type-widget">
          <div
            v-for="item in alertTypeRows"
            :key="item.key"
            class="alert-type-widget__button"
            :class="{ 'is-clickable': item.target }"
            @click="item.target && emit('apply', item.target)"
          >
            <AIcon :type="item.icon" aria-hidden="true" />
            <span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.detail }}</small>
            </span>
            <i><b :style="{ width: `${item.percent}%` }" :data-state="item.state" /></i>
            <em>{{ item.value }}</em>
          </div>
        </div>
      </template>

      <template v-else-if="widget.kind === 'area-usage'">
        <div v-if="areaRows.length" class="geo-widget">
          <div class="geo-widget__stage" :aria-label="$t('IotWorkbench.geo.aria')">
            <span class="geo-widget__line geo-widget__line--h geo-widget__line--one" aria-hidden="true" />
            <span class="geo-widget__line geo-widget__line--h geo-widget__line--two" aria-hidden="true" />
            <span class="geo-widget__line geo-widget__line--v geo-widget__line--one" aria-hidden="true" />
            <span class="geo-widget__line geo-widget__line--v geo-widget__line--two" aria-hidden="true" />
            <div
              v-for="area in areaRows"
              :key="area.name"
              class="geo-widget__point"
              :data-risk="area.risk"
              :style="{ left: `${area.x}%`, top: `${area.y}%` }"
              @click="emit('focus-area', area.name)"
            >
              {{ area.total }}
            </div>
          </div>
          <div class="geo-widget__list">
            <div
              v-for="area in areaRows"
              :key="area.name"
              class="geo-widget__list-button"
              @click="emit('focus-area', area.name)"
            >
              <span>
                <strong>{{ area.name }}</strong>
                <small>{{ $t('IotWorkbench.geo.detail', { total: area.total, onlineRate: area.onlineRate, alarmDensity: area.alarmDensity }) }}</small>
              </span>
              <em :data-risk="area.risk">{{ area.onlineRate }}%</em>
            </div>
          </div>
        </div>
        <CloudEmpty v-else class="dashboard-widget-empty" :description="$t('IotWorkbench.card.empty')" />
      </template>

      <template v-else-if="widget.kind === 'command-success'">
        <div class="connection-widget">
          <div
            v-for="metric in connectionMetrics"
            :key="metric.label"
            class="connection-widget__button"
            :data-tone="metric.tone"
            @click="emit('apply', metric.target)"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}<em>{{ metric.unit }}</em></strong>
            <small>{{ metric.detail }}</small>
            <i :data-tone="metric.trendTone">
              <AIcon :type="trendIcon(metric.direction)" aria-hidden="true" />
              {{ metric.trend }}
            </i>
          </div>
        </div>
      </template>

    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IotActiveTrendChart from './IotActiveTrendChart.vue'
import IotAlarmOverviewList from './IotAlarmOverviewList.vue'
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

const props = defineProps<{
  widget: DashboardWidget
  selected: boolean
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

const emit = defineEmits<{
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

function trendRangeLabel(range: DeviceGroupTrendRange) {
  const item = props.trendRangeOptions.find((option) => option.value === range)
  return item?.label ?? range
}

const alarmTrendWindowLabel = computed(() => trendRangeLabel(props.alarmTrendRange))

function handleTrendRangeChange(value: string | number) {
  const next = props.trendRangeOptions.find((item) => item.value === value)
  if (next) emit('update-trend-range', next.value)
}

function handleAlarmTrendRangeChange(value: string | number) {
  const next = props.trendRangeOptions.find((item) => item.value === value)
  if (next) emit('update-alarm-trend-range', next.value)
}

function handleAlarmRankRangeChange(value: string | number) {
  const next = props.trendRangeOptions.find((item) => item.value === value)
  if (next) emit('update-alarm-rank-range', next.value)
}

</script>
