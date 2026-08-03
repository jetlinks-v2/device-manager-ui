<template>
  <section class="overview-tab" :aria-label="$t('IotDeviceDetail.overview.aria')">
    <IotDevicePropertyDetailModal
      v-model:open="detailOpen"
      :device-id="device.id"
      :property="selectedMetric"
      :tone="selectedMetricTone"
    />

    <div class="overview-dashboard">
      <div class="overview-stat-strip" :aria-label="$t('IotDeviceDetail.overview.messageStats')">
        <article v-for="item in statCards" :key="item.key" class="overview-stat" :data-tone="item.tone">
          <div class="overview-stat__label"><span />{{ item.label }}</div>
          <div class="overview-stat__main">
            <strong>{{ item.value }}</strong>
            <em>{{ item.unit }}</em>
          </div>
          <div class="overview-stat__sub">{{ item.sub }}</div>
          <JEcharts class="overview-stat__spark" :option="item.chartOption" />
        </article>
      </div>

      <div class="overview-main-grid">
        <article class="overview-panel overview-panel--trend">
          <header class="overview-panel__head">
            <h3>{{ $t('IotDeviceDetail.overview.messageTrendTitle') }}</h3>
          </header>
          <div class="message-chart" :aria-label="$t('IotDeviceDetail.overview.messageChart')">
            <JEcharts class="message-chart__plot" :option="messageTrendOption" />
            <footer class="message-chart__legend">
              <span><i data-tone="up" />{{ $t('IotDeviceDetail.overview.upstreamMessages') }} <strong>{{ formatCount(messageTotals.up) }}</strong></span>
              <span><i data-tone="down" />{{ $t('IotDeviceDetail.overview.downstreamMessages') }} <strong>{{ formatCount(messageTotals.down) }}</strong></span>
              <em>{{ $t('IotDeviceDetail.overview.trafficLegend', { upstream: trafficText.up, downstream: trafficText.down }) }}</em>
            </footer>
          </div>
        </article>

        <article class="overview-panel overview-panel--properties">
          <header class="overview-panel__head">
            <h3>{{ $t('IotDeviceDetail.overview.keyPropertySnapshot') }}</h3>
            <span>{{ $t('IotDeviceDetail.overview.thingModelReadonly') }}</span>
          </header>
          <div v-if="snapshotMetrics.length" class="property-snapshot-grid">
            <div
              v-for="metric in snapshotMetrics"
              :key="metric.id"
              class="property-snapshot"
              :data-tone="metric.tone"
              @click="openHistory(metric)"
            >
              <span>{{ metric.name }} <code>{{ metric.identifier }}</code></span>
              <strong>{{ propertyDisplayValue(metric) }}<em v-if="propertyDisplayUnit(metric)">{{ propertyDisplayUnit(metric) }}</em></strong>
              <small>{{ displayText(metric.updatedAt) }}</small>
            </div>
          </div>
          <CloudEmpty v-else class="overview-empty" :description="$t('IotDeviceDetail.overview.emptyPropertiesHint')" />
        </article>

        <article class="overview-panel overview-panel--alerts">
          <header class="overview-panel__head">
            <h3>{{ $t('IotDeviceDetail.overview.recentAlarms') }}</h3>
            <span>{{ $t('IotDeviceDetail.overview.recentAlarmCount', { count: recentRecords.length }) }}</span>
          </header>
          <a-spin :spinning="recentRecordLoading">
            <ol v-if="recentRecords.length" class="alert-timeline">
              <li v-for="item in recentRecords" :key="item.id" :data-type="item.type">
                <a-tooltip>
                  <template #title>
                    <div class="alert-timeline__tooltip">
                      <div>{{ $t('IotDeviceDetail.overview.alarmTrigger', { value: displayText(item.trigger) }) }}</div>
                      <div>{{ $t('IotDeviceDetail.overview.alarmReason', { value: displayText(item.summary) }) }}</div>
                    </div>
                  </template>
                  <div class="alert-timeline__row">
                    <strong>{{ displayText(item.title) }}</strong>
                    <div class="alert-timeline__meta">
                      <span>{{ displayText(item.level) }}</span>
                      <span>{{ item.duration }}</span>
                    </div>
                    <time>{{ displayText(item.time) }}</time>
                  </div>
                </a-tooltip>
              </li>
            </ol>
            <CloudEmpty type="page" v-else :description="$t('IotDeviceDetail.overview.emptyAlarmsHint')"></CloudEmpty>
          </a-spin>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type PropType } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'

import { queryDefaultAlarmLevels } from '@device-manager-ui/views/device/alarm/api'
import type { AlarmLevelOption } from '@device-manager-ui/views/device/alarm/types'
import type { DeviceTemplate } from '../../services/device-library/types'
import type { IotDevice, IotDeviceHealthDiagnosis, IotDeviceTodo } from '../../types'
import type { RealtimePropertyRow, SimulatorSession } from './iotDeviceDetail.types'
import { type OverviewAccessSummary, useIotDeviceOverview } from '../../hooks/useIotDeviceOverview'
import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import IotDevicePropertyDetailModal from './IotDevicePropertyDetailModal.vue'
import { createMessageTrendOption, createStatCard, formatBytes, formatCount, formatDuration as formatMetricDuration } from './iotDeviceOverviewCharts'
import { formatMessageTrendTimestamp } from './iotDeviceOverviewTime'
import { getPropertyDisplayUnit, getPropertyDisplayValue } from './iotDevicePropertyDisplay'

type SummarySeries = {
  total?: number
  peak?: number
  buckets?: SummaryPoint[]
}

type SummaryPoint = {
  time?: number
  value?: number
}

type MessageTrendPoint = {
  time?: number
  upstream?: number
  downstream?: number
}

type TrafficTrendPoint = {
  time?: number
  upstreamBytes?: number
  downstreamBytes?: number
}

type OverviewSummary = {
  activeDuration?: SummarySeries
  upstream?: SummarySeries
  downstream?: SummarySeries
  traffic?: SummarySeries & {
    upstreamBytes?: number
    downstreamBytes?: number
  }
  messageTrend?: MessageTrendPoint[]
  trafficTrend?: TrafficTrendPoint[]
}

type RecentAlarmRecord = {
  id: string
  title: string
  time: string
  duration: string
  level: string
  trigger: string
  summary: string
  type: 'alarm'
}

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  productTemplate: { type: Object as PropType<DeviceTemplate | null>, default: null },
  healthPath: { type: String, default: undefined },
  healthDiagnosis: { type: Object as PropType<IotDeviceHealthDiagnosis | null>, default: null },
  todos: { type: Array as PropType<IotDeviceTodo[]>, default: () => [] },
  simulatorSession: { type: Object as PropType<SimulatorSession | null>, default: null },
  accessSummary: { type: Object as PropType<OverviewAccessSummary>, required: true },
  properties: { type: Array as PropType<RealtimePropertyRow[]>, required: true },
})

const { t: $t } = useI18n()

defineEmits<{
  'jump-tab': [tab: 'data' | 'records' | 'advanced']
  'jump-sub-tab': [tab: 'data' | 'records' | 'advanced', sub: string]
}>()

const {
  displayText,
  detailOpen,
  keyMetrics,
  openHistory,
  selectedMetric,
} = useIotDeviceOverview(props)

const overviewSummary = ref<OverviewSummary>(createEmptySummary())
const recentRecords = ref<RecentAlarmRecord[]>([])
const recentRecordLoading = ref(false)
const levelOptions = ref<AlarmLevelOption[]>([])
const snapshotMetrics = computed(() => keyMetrics.value.slice(0, 6))
const propertyDisplayValue = getPropertyDisplayValue
const propertyDisplayUnit = getPropertyDisplayUnit
const selectedMetricTone = computed(() => {
  if (selectedMetric.value?.tone === 'critical') return 'danger'
  if (selectedMetric.value?.tone === 'warning') return 'warning'
  if (selectedMetric.value?.tone === 'normal') return 'success'
  return 'primary'
})

const messageTotals = computed(() => ({
  up: numberValue(overviewSummary.value.upstream?.total),
  down: numberValue(overviewSummary.value.downstream?.total),
}))

const trendSeries = computed(() => ({
  up: bucketValues(overviewSummary.value.upstream?.buckets),
  down: bucketValues(overviewSummary.value.downstream?.buckets),
}))

const trendAxisLabels = computed(() => bucketLabels(overviewSummary.value.upstream?.buckets))
const chartMax = computed(() => Math.max(...trendSeries.value.up, ...trendSeries.value.down, 1))
const trafficText = computed(() => {
  const upBytes = numberValue(overviewSummary.value.traffic?.upstreamBytes)
  const downBytes = numberValue(overviewSummary.value.traffic?.downstreamBytes)
  return { up: formatBytes(upBytes), down: formatBytes(downBytes) }
})

const statCards = computed(() => [
  createStatCard('active', $t('IotDeviceDetail.overview.stat.activeDuration'), formatMetricDuration(numberValue(overviewSummary.value.activeDuration?.total)), '', $t('IotDeviceDetail.overview.stat.activeDurationHint'), 'purple', bucketValues(overviewSummary.value.activeDuration?.buckets)),
  createStatCard('up', $t('IotDeviceDetail.overview.stat.todayUpstream'), formatCount(messageTotals.value.up), $t('IotDeviceDetail.overview.unit.message'), $t('IotDeviceDetail.overview.stat.peakPerHour', { value: formatPeak(trendSeries.value.up) }), 'violet', trendSeries.value.up),
  createStatCard('down', $t('IotDeviceDetail.overview.stat.todayDownstream'), formatCount(messageTotals.value.down), $t('IotDeviceDetail.overview.unit.message'), $t('IotDeviceDetail.overview.stat.peakPerHour', { value: formatPeak(trendSeries.value.down) }), 'orange', trendSeries.value.down),
  createStatCard('traffic', $t('IotDeviceDetail.overview.stat.todayTraffic'), formatBytes(numberValue(overviewSummary.value.traffic?.total)), '', $t('IotDeviceDetail.overview.trafficSummary', { upstream: trafficText.value.up, downstream: trafficText.value.down }), 'cyan', bucketValues(overviewSummary.value.traffic?.buckets)),
])

const messageTrendOption = computed(() => createMessageTrendOption(trendAxisLabels.value, trendSeries.value, chartMax.value))

onMounted(async () => {
  levelOptions.value = await queryDefaultAlarmLevels().catch(() => [])
  if (props.device.id) void loadRecentAlarmRecords()
})

watch(
  () => props.device.id,
  () => {
    void loadOverviewSummary()
    void loadRecentAlarmRecords()
  },
  { immediate: true },
)

async function loadOverviewSummary() {
  if (!props.device.id) {
    overviewSummary.value = createEmptySummary()
    return
  }
  try {
    const response = await iotDeviceDetailRealApi.queryOverviewSummary(buildOverviewSummaryParams(props.device.id))
    overviewSummary.value = normalizeSummary((response as any)?.result ?? response)
  } catch {
    overviewSummary.value = createEmptySummary()
  }
}

async function loadRecentAlarmRecords() {
  if (!props.device.id) {
    recentRecords.value = []
    return
  }
  recentRecordLoading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.queryAlarmByDevice({
      pageIndex: 0,
      pageSize: 4,
      sorts: [{ name: 'alarmTime', order: 'desc' }],
      terms: [
        {
          terms: [
            { column: 'sourceId', value: props.device.id, termType: 'eq' },
            { column: 'targetType', value: 'device', termType: 'eq' },
          ],
          type: 'and',
        },
      ],
    })
    recentRecords.value = extractRows(resp?.result ?? resp)
      .map(toRecentAlarmRecord)
      .filter((item): item is RecentAlarmRecord => Boolean(item))
  } catch {
    recentRecords.value = []
  } finally {
    recentRecordLoading.value = false
  }
}

function toRecentAlarmRecord(record: Record<string, any>): RecentAlarmRecord | undefined {
  const id = displayText(record.id || record.alarmRecordId || record.alarmTime)
  if (id === '--') return undefined
  return {
    id,
    title: displayText(record.alarmName),
    time: formatApiTime(record.alarmTime),
    duration: formatAlarmDuration(record),
    level: levelLabel(record.level ?? record.alarmLevel),
    trigger: displayText(record.triggerDesc),
    summary: displayText(record.actualDesc || record.triggerDesc),
    type: 'alarm',
  }
}

function enumValue(value: unknown) {
  return value && typeof value === 'object' ? String((value as any).value ?? '') : String(value ?? '')
}

function enumText(value: unknown, fallback = '--') {
  if (value && typeof value === 'object') return String((value as any).text ?? (value as any).value ?? fallback)
  return displayText(String(value || fallback))
}

function levelLabel(value: unknown) {
  const level = Number(enumValue(value))
  const option = levelOptions.value.find((item) => item.value === level)
  return option?.label || enumText(value)
}

function formatAlarmDuration(record: Record<string, any>) {
  const start = dayjs(record.alarmTime)
  const end = enumValue(record.state) === 'warning' ? dayjs() : dayjs(record.handleTime)
  if (!start.isValid() || !end.isValid()) return '--'
  const seconds = end.diff(start, 'second')
  if (seconds < 0) return '--'
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}

function buildOverviewSummaryParams(deviceId: string) {
  const hour = 60 * 60 * 1000
  // 概览统计与图表统一按当天自然日聚合，避免总量和 00:00 开始的横轴口径不一致。
  const from = dayjs().startOf('day').valueOf()
  const to = from + 24 * hour - 1
  return {
    columns: [
      { column: 'onlineDuration', alias: 'onlineDuration', aggregation: 'SUM' },
      { column: 'upstreamMessages', alias: 'upstreamMessages', aggregation: 'SUM' },
      { column: 'downstreamMessages', alias: 'downstreamMessages', aggregation: 'SUM' },
      { column: 'upstreamBytes', alias: 'upstreamBytes', aggregation: 'SUM' },
      { column: 'downstreamBytes', alias: 'downstreamBytes', aggregation: 'SUM' },
    ],
    groupByTime: {
      column: 'timestamp',
      alias: 'time',
      interval: '1h',
      format: 'yyyy-MM-dd HH:mm:ss',
      from: formatAggregationTime(from),
      to: formatAggregationTime(to),
    },
    limit: 24,
    filter: {
      terms: [
        { column: 'deviceId', termType: 'eq', value: deviceId },
      ],
    },
  }
}

function formatAggregationTime(value: number) {
  return `${formatApiTime(value, '')}.000`
}

function formatPeak(values: number[]) {
  return formatCount(Math.max(...values, 0))
}

function createEmptySummary(): OverviewSummary {
  return {
    activeDuration: { total: 0, peak: 0, buckets: emptyBuckets() },
    upstream: { total: 0, peak: 0, buckets: emptyBuckets() },
    downstream: { total: 0, peak: 0, buckets: emptyBuckets() },
    traffic: { total: 0, peak: 0, upstreamBytes: 0, downstreamBytes: 0, buckets: emptyBuckets() },
  }
}

function normalizeSummary(value: any): OverviewSummary {
  const messageTrend = Array.isArray(value?.messageTrend) ? value.messageTrend : []
  const trafficTrend = Array.isArray(value?.trafficTrend) ? value.trafficTrend : []
  return {
    activeDuration: normalizeSeries(value?.activeDuration),
    upstream: normalizeSeries(value?.upstream, mapTrendBuckets(messageTrend, 'upstream')),
    downstream: normalizeSeries(value?.downstream, mapTrendBuckets(messageTrend, 'downstream')),
    traffic: {
      ...normalizeSeries(value?.traffic, mapTrafficBuckets(trafficTrend)),
      upstreamBytes: numberValue(value?.traffic?.upstreamBytes),
      downstreamBytes: numberValue(value?.traffic?.downstreamBytes),
    },
  }
}

function normalizeSeries(value: any, fallbackBuckets?: SummaryPoint[]): SummarySeries {
  return {
    total: numberValue(value?.total),
    peak: numberValue(value?.peak),
    buckets: normalizeBuckets(value?.buckets, fallbackBuckets),
  }
}

function normalizeBuckets(value?: unknown, fallbackBuckets?: SummaryPoint[]): SummaryPoint[] {
  const source = Array.isArray(value) && value.length ? value : fallbackBuckets ?? []
  const fallback = todayHourBuckets()
  return Array.from({ length: 24 }, (_, index) => {
    const bucket = normalizeBucket(source[index])
    return bucket.time ? bucket : { ...bucket, time: fallback[index].time }
  })
}

function normalizeBucket(value: any): SummaryPoint {
  if (typeof value === 'number') {
    return { value: numberValue(value) }
  }
  return {
    time: numberValue(value?.time),
    value: numberValue(value?.value),
  }
}

function mapTrendBuckets(value: MessageTrendPoint[], field: 'upstream' | 'downstream'): SummaryPoint[] {
  return value.map((item) => ({
    time: numberValue(item?.time),
    value: numberValue(item?.[field]),
  }))
}

function mapTrafficBuckets(value: TrafficTrendPoint[]): SummaryPoint[] {
  return value.map((item) => ({
    time: numberValue(item?.time),
    value: numberValue(item?.upstreamBytes) + numberValue(item?.downstreamBytes),
  }))
}

function emptyBuckets(): SummaryPoint[] {
  return todayHourBuckets()
}

function bucketValues(value?: SummaryPoint[]) {
  return (value?.length ? value : emptyBuckets()).map((item) => numberValue(item.value))
}

function bucketLabels(value?: SummaryPoint[]) {
  const buckets = value?.length ? value : emptyBuckets()
  return buckets.map((item) => formatMessageTrendTimestamp(item.time))
}

function todayHourBuckets(): SummaryPoint[] {
  const hour = 60 * 60 * 1000
  const firstHour = dayjs().startOf('day').valueOf()
  return Array.from({ length: 24 }, (_, index) => ({
    time: firstHour + hour * index,
    value: 0,
  }))
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

</script>

<style scoped src="./IotDeviceOverviewTab.css"></style>
