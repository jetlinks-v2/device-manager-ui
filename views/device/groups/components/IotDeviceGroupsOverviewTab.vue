<template>
  <div class="group-overview" :aria-label="$t('IotDeviceGroups.overview.aria')">
    <div class="group-overview__stats">
      <article v-for="item in overviewCards" :key="item.label" class="group-overview__stat">
        <div class="group-overview__stat-main">
          <div class="group-overview__stat-copy">
            <span>{{ item.label }}</span>
            <strong :data-tone="item.tone || 'default'">
              {{ item.value }}
              <small v-if="item.unit">{{ item.unit }}</small>
            </strong>
          </div>
          <span class="group-overview__stat-icon" :data-tone="item.tone || 'default'">
            <img :src="item.icon" alt="" class="group-overview__stat-icon-image" aria-hidden="true" />
          </span>
        </div>
        <span class="group-overview__stat-progress" aria-hidden="true">
          <i :data-tone="item.tone || 'default'" :style="{ width: `${item.progress}%` }" />
        </span>
        <div class="group-overview__stat-foot">
          <span v-if="item.onlineRate" class="group-overview__stat-online">
            <i aria-hidden="true" />
            <em>{{ item.onlineRate.label }}</em>
            <b>{{ item.onlineRate.value }}{{ item.onlineRate.unit }}</b>
          </span>
          <em v-else :data-tone="item.tone || 'default'">{{ item.hint }}</em>
          <span
            v-if="item.compare"
            class="group-overview__stat-compare"
            :data-tone="item.compare.tone"
          >
            {{ item.compare.label }} {{ item.compare.value }}
          </span>
        </div>
      </article>
    </div>

    <section class="group-overview__section group-overview__section--trend">
      <header class="group-overview__head group-overview__head--trend">
        <h3>{{ $t('IotDeviceGroups.overview.trendTitle') }}</h3>
        <div class="group-overview__trend-controls">
          <a-segmented
            :value="activeMetric"
            class="group-overview__metric-segmented"
            :options="metricSegmentedOptions"
            @change="handleMetricChange"
          >
            <template #label="{ payload, value }">
              <span class="group-overview__metric-label" :class="{ 'is-active': activeMetric === value }">
                <span>{{ metricPayloadLabel(payload) }}</span>
                <b>{{ metricPayloadValue(payload) }}</b>
              </span>
            </template>
          </a-segmented>
          <a-segmented
            v-model:value="activeRange"
            class="group-overview__range-segmented"
            :options="rangeOptions"
            :aria-label="$t('IotDeviceGroups.overview.trendRange')"
          />
        </div>
      </header>
      <div class="group-overview__trend-summary">
        <article v-for="item in trendSummary" :key="item.label" class="group-overview__summary-card">
          <span>{{ item.label }}</span>
          <strong>
            {{ item.value }}
            <small>{{ item.unit }}</small>
          </strong>
        </article>
      </div>
      <a-spin :spinning="trendLoading">
        <IotDeviceGroupsTrendChart v-if="currentTrend?.points.length" :series="currentTrend" />
        <CloudEmpty v-else class="group-overview__trend-empty" :description="$t('IotDeviceGroups.overview.trendEmpty')" />
      </a-spin>
    </section>

    <div class="group-overview__split">
      <section class="group-overview__section">
        <header class="group-overview__head">
          <h3>{{ $t('IotDeviceGroups.overview.statusTitle') }}</h3>
        </header>
        <div class="group-overview__distribution">
          <div class="group-overview__donut">
            <JEcharts :option="donutOption" />
          </div>
          <div class="group-overview__legend">
            <article v-for="item in overview.statusSlices" :key="item.key" class="group-overview__legend-row">
              <span class="group-overview__legend-label">
                <span class="group-overview__legend-icon" :data-key="item.key">
                  <AIcon :type="deviceGroupStatusIcon(item.key)" aria-hidden="true" />
                </span>
                {{ item.label }}
              </span>
              <strong>{{ item.value }}</strong>
              <em>{{ item.share }}%</em>
            </article>
          </div>
        </div>
      </section>

      <section class="group-overview__section">
        <header class="group-overview__head">
          <h3>{{ $t('IotDeviceGroups.overview.eventsTitle') }}</h3>
        </header>
        <div class="group-overview__events">
          <article v-for="item in overview.events" :key="item.id" class="group-overview__event">
            <span class="group-overview__event-time">{{ item.timeLabel }}</span>
            <span class="group-overview__event-dot" :data-tone="item.tone">
              <AIcon :type="eventIcon(item.tone)" aria-hidden="true" />
            </span>
            <div class="group-overview__event-body">
              <strong>{{ item.title }}</strong>
              <p>{{ item.summary }}</p>
            </div>
          </article>
          <CloudEmpty v-if="!overview.events.length" class="group-overview__events-empty" :description="$t('IotDeviceGroups.overview.eventsEmpty')" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import deviceAnomalyIcon from '@device-manager-ui/assets/device-groups/device-anomaly.svg'
import deviceHealthIcon from '@device-manager-ui/assets/device-groups/device-health.svg'
import deviceOfflineIcon from '@device-manager-ui/assets/device-groups/device-offline.svg'
import deviceTotalIcon from '@device-manager-ui/assets/device-groups/device-total.svg'
import type { DeviceGroupTrendRange } from '@device-manager-ui/api/deviceGroup'
import type {
  GroupDashboardEvent,
  GroupDashboardTrendSeries,
} from './groupDetailDashboard.types'
import type { GroupItem, GroupOverviewModel } from './iotDeviceGroupsPage.types'
import { deviceGroupStatusGradient, deviceGroupStatusIcon } from './deviceGroupStatusPresentation'
import IotDeviceGroupsTrendChart from './IotDeviceGroupsTrendChart.vue'
import { useIotTypeGroupTrend } from './useIotTypeGroupTrend'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const props = defineProps<{
  overview: GroupOverviewModel
  selectedGroup?: GroupItem
}>()

const activeMetric = ref(props.overview.trendSeries[0]?.key || 'onlineRate')
const activeRange = ref<DeviceGroupTrendRange>('7d')
const { loading: trendLoading, trendSeries } = useIotTypeGroupTrend(
  () => props.overview,
  () => props.selectedGroup,
  activeRange,
)

const visibleTrendMetrics = computed(() => {
  const keys = ['onlineRate', 'uplink']
  return trendSeries.value.filter((item) => keys.includes(item.key))
})
const metricSegmentedOptions = computed(() => visibleTrendMetrics.value.map((item) => ({
  value: item.key,
  title: metricLabel(item),
  payload: {
    label: metricLabel(item),
    value: item.value,
  },
})))
const rangeOptions: DeviceGroupTrendRange[] = ['24h', '7d', '30d']
const overviewStatIcons = [deviceTotalIcon, deviceOfflineIcon, deviceAnomalyIcon, deviceHealthIcon]
const overviewCards = computed(() => {
  const statIndexes = [0, 2, 3, 4]
  const tones = ['default', 'muted', 'warn', 'brand']
  return statIndexes.flatMap((statIndex, cardIndex) => {
    const item = props.overview.stats[statIndex]
    return item ? [{
      ...item,
      icon: overviewStatIcons[cardIndex],
      tone: tones[cardIndex],
      progress: statProgress(statIndex),
      onlineRate: statIndex === 0 ? props.overview.stats[1] : undefined,
    }] : []
  })
})

watch(visibleTrendMetrics, (next) => {
  if (!next.some((item) => item.key === activeMetric.value)) {
    activeMetric.value = next[0]?.key || 'onlineRate'
  }
}, { immediate: true })

const currentTrend = computed(() => (
  visibleTrendMetrics.value.find((item) => item.key === activeMetric.value) || visibleTrendMetrics.value[0]
))
const trendSummary = computed(() => {
  const series = currentTrend.value
  const points = series?.points ?? []
  if (!series || !points.length) return []

  const values = points.map((item) => item.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const labels = summaryLabels(series)

  return [
    { label: labels[0], value: formatTrendValue(max), unit: series.unit },
    { label: labels[1], value: formatTrendValue(average), unit: series.unit },
    { label: labels[2], value: formatTrendValue(min), unit: series.unit },
  ]
})

const donutOption = computed(() => ({
  title: {
    text: `${props.overview.stats[0]?.value ?? 0}`,
    subtext: $t('IotDeviceGroups.overview.deviceCount'),
    left: 'center',
    top: '35%',
    textStyle: { fontSize: 24, fontWeight: 700, color: resolveCssColor('var(--ink-1)') },
    subtextStyle: { fontSize: 14, color: resolveCssColor('var(--ink-3)') },
  },
  series: [{
    type: 'pie',
    radius: ['60%', '80%'],
    center: ['50%', '50%'],
    label: { show: false },
    itemStyle: {
      borderColor: resolveCssColor('var(--bg)'),
      borderWidth: 3,
    },
    data: props.overview.statusSlices.map((item) => ({
      name: item.label,
      value: item.value,
      itemStyle: { color: deviceGroupStatusGradient(item.key, resolveCssColor) },
    })),
  }],
}))

function metricLabel(item: GroupDashboardTrendSeries) {
  if (item.key === 'uplink') return $t('IotDeviceGroups.overview.trendMessageCount')
  return item.title.replace(/（.*$/, '')
}

function metricPayloadLabel(payload: unknown) {
  if (payload && typeof payload === 'object' && 'label' in payload && typeof payload.label === 'string') {
    return payload.label
  }
  return ''
}

function metricPayloadValue(payload: unknown) {
  if (payload && typeof payload === 'object' && 'value' in payload) {
    return String(payload.value)
  }
  return ''
}

function handleMetricChange(value: string | number) {
  const next = String(value)
  const metric = visibleTrendMetrics.value.find((item) => item.key === next)
  if (metric) {
    activeMetric.value = metric.key
  }
}

function summaryLabels(series: GroupDashboardTrendSeries) {
  if (series.key === 'onlineRate') return [$t('IotDeviceGroups.overview.trendPeakOnline'), $t('IotDeviceGroups.overview.trendAverage'), $t('IotDeviceGroups.overview.trendLowest')]
  return [$t('IotDeviceGroups.overview.trendPeakMessages'), $t('IotDeviceGroups.overview.trendAverage'), $t('IotDeviceGroups.overview.trendLowest')]
}

function formatTrendValue(value: number) {
  const next = Math.round(value * 10) / 10
  return Number.isInteger(next) ? next.toLocaleString() : next.toFixed(1)
}

function resolveCssColor(color: string) {
  if (typeof window === 'undefined') return color
  const match = color.match(/^var\((--[^)]+)\)$/)
  if (!match) return color
  return window.getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || color
}

function eventIcon(tone: GroupDashboardEvent['tone']) {
  if (tone === 'ok') return 'CheckOutlined'
  if (tone === 'err') return 'AlertOutlined'
  if (tone === 'warn') return 'WarningOutlined'
  return 'PlusOutlined'
}

function statProgress(index: number) {
  const value = Number(props.overview.stats[index]?.value) || 0
  const total = Number(props.overview.stats[0]?.value) || 0
  const onlineRate = Number(props.overview.stats[1]?.value) || 0
  // 设备总数卡的进度表示在线率，其余卡片继续使用现有健康分或数量占比。
  if (index === 0) return Math.min(100, Math.max(0, onlineRate))
  if (index === 4) return Math.min(100, Math.max(0, value))
  return total ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
}
</script>
<style scoped src="./IotDeviceGroupsOverviewTab.css"></style>
