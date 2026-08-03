<template>
  <section class="connection-overview">
    <div class="connection-overview__main">
      <article class="connection-gauge" :data-tone="statusTone">
        <div
          class="connection-gauge__ring"
          :style="{ '--rate': `${Math.max(insight.onlineRateValue * 100, 1)}%` }"
        >
          <div>
            <strong>{{ insight.onlineRate }}</strong>
            <span>{{ $t('IotDeviceDetail.connectionHealth.onlineRate') }}</span>
          </div>
        </div>
        <div class="connection-gauge__meta">
          <span>{{ $t('IotDeviceDetail.connectionHealth.currentStatus') }}</span>
          <strong>{{ statusLabel }}</strong>
          <small>{{ device.lastSeen || '--' }}</small>
        </div>
      </article>

      <article class="connection-chart">
        <header class="connection-chart__head">
          <div>
            <strong>{{ $t('IotDeviceDetail.connectionHealth.distribution') }}</strong>
            <span>{{ loading ? $t('IotDeviceDetail.common.loading') : insight.windowLabel }}</span>
          </div>
        </header>
        <div class="connection-status-chart" :aria-label="$t('IotDeviceDetail.connectionOverview.chartAria')">
          <div
            v-for="bucket in insight.buckets"
            :key="bucket.label"
            class="connection-status-chart__col"
          >
            <div class="connection-status-chart__bar">
              <span
                v-for="(segment, segmentIndex) in bucket.segments"
                :key="`${bucket.label}-${segmentIndex}`"
                class="connection-status-chart__segment"
                :data-state="segment.state"
                :style="{ height: `${Math.max(segment.ratio * 100, 1)}%` }"
                :title="connectionSegmentTitle(bucket, segment)"
              />
            </div>
            <strong class="connection-status-chart__rate">{{ formatRate(bucket.onlineRate) }}</strong>
            <span class="connection-status-chart__label">{{ bucket.label }}</span>
          </div>
        </div>
      </article>

      <article class="connection-events">
        <header>
          <strong>{{ $t('IotDeviceDetail.connectionHealth.events') }}</strong>
          <span>{{ $t('IotDeviceDetail.connectionHealth.disconnectCount', { count: insight.disconnectCount }) }}</span>
        </header>
        <ul>
          <li v-for="item in insight.events" :key="`${item.title}-${item.time}`">
            <time>{{ item.time }}</time>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.detail }}</p>
            </div>
          </li>
        </ul>
      </article>
    </div>

    <div class="connection-overview__bottom">
      <div class="connection-metrics">
        <article v-for="item in metrics" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>

      <div class="connection-summary">
        <header>
          <strong>{{ $t('IotDeviceDetail.connectionHealth.anomalySummary') }}</strong>
          <span>{{ anomalyRows.length ? $t('IotDeviceDetail.common.itemCount', { count: anomalyRows.length }) : $t('IotDeviceDetail.common.none') }}</span>
        </header>
        <div v-if="anomalyRows.length" class="connection-summary__list">
          <article v-for="item in anomalyRows" :key="item.key" :data-tone="item.tone">
            <strong>{{ item.title }}</strong>
            <p>{{ item.summary }}</p>
          </article>
        </div>
        <CloudEmpty v-else class="connection-summary__empty" :description="$t('IotDeviceDetail.connectionOverview.emptyHint')" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IotDevice, IotDeviceHealthDiagnosis, IotDeviceTodo } from '../../types'
import {
  connectionSegmentTitle,
  useIotDeviceConnectionHealth,
} from './useIotDeviceConnectionHealth'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  healthDiagnosis: { type: Object as PropType<IotDeviceHealthDiagnosis | null>, default: null },
  todos: { type: Array as PropType<IotDeviceTodo[]>, default: () => [] },
})

const { t: $t } = useI18n()
const deviceRef = toRef(props, 'device')
const hasOfflineRisk = computed(() =>
  props.device.status === 'offline'
  || props.device.status === 'no-data'
  || Boolean(props.healthDiagnosis?.timeline?.anomalyStartedAt)
  || props.device.risk === 'urgent',
)

const {
  insight,
  loading,
} = useIotDeviceConnectionHealth(deviceRef, hasOfflineRisk)

const statusLabel = computed(() => {
  if (props.device.status === 'online') return $t('IotDeviceDetail.common.status.online')
  if (props.device.status === 'offline') return $t('IotDeviceDetail.common.status.offline')
  if (props.device.status === 'disabled') return $t('IotDeviceDetail.common.status.disabled')
  if (props.device.status === 'no-data') return $t('IotDeviceDetail.common.status.noData')
  if (props.device.status === 'alarm') return $t('IotDeviceDetail.common.status.alarm')
  return props.device.status
})

const statusTone = computed(() => {
  if (props.device.status === 'online') return 'ok'
  if (props.device.status === 'disabled') return 'muted'
  if (props.device.status === 'offline' || props.device.status === 'alarm') return 'err'
  return 'warn'
})

const metrics = computed(() => [
  { label: $t('IotDeviceDetail.connectionHealth.metric.disconnects'), value: $t('IotDeviceDetail.connectionHealth.disconnectCount', { count: insight.value.disconnectCount }) },
  { label: $t('IotDeviceDetail.connectionHealth.metric.onlineDuration'), value: insight.value.onlineDuration },
  { label: $t('IotDeviceDetail.connectionHealth.metric.latestOffline'), value: insight.value.latestOfflineDuration },
])

function formatRate(value: number) {
  return `${Math.round(value * 1000) / 10}%`
}

const anomalyRows = computed(() => {
  const rows: Array<{ key: string; title: string; summary: string; tone: 'warn' | 'err' | 'info' }> = []
  const deviating = props.healthDiagnosis?.features.points.filter((item) => item.isDeviating) ?? []
  const pendingTodos = (props.todos ?? []).filter((item) => item.status === 'pending' || item.status === 'assigned')
  const faultCount = props.healthDiagnosis?.faults?.rows.length ?? props.device.alarms.length

  if (props.device.status === 'offline' || props.device.status === 'no-data') {
    rows.push({
      key: 'connection',
      title: props.device.status === 'offline' ? $t('IotDeviceDetail.connectionHealth.anomaly.offline') : $t('IotDeviceDetail.connectionHealth.anomaly.noData'),
      summary: $t('IotDeviceDetail.connectionHealth.anomaly.offlineSummary'),
      tone: 'err',
    })
  } else if (insight.value.disconnectCount >= 3 || hasOfflineRisk.value) {
    rows.push({
      key: 'connection-watch',
      title: $t('IotDeviceDetail.connectionHealth.anomaly.fluctuation'),
      summary: $t('IotDeviceDetail.connectionHealth.anomaly.fluctuationSummary', { count: insight.value.disconnectCount }),
      tone: 'warn',
    })
  }

  if (deviating.length) {
    rows.push({
      key: 'deviation',
      title: $t('IotDeviceDetail.connectionHealth.anomaly.deviation'),
      summary: $t('IotDeviceDetail.connectionHealth.anomaly.deviationSummary', { count: deviating.length }),
      tone: 'warn',
    })
  }

  if (faultCount) {
    rows.push({
      key: 'fault',
      title: $t('IotDeviceDetail.connectionHealth.anomaly.fault'),
      summary: $t('IotDeviceDetail.connectionHealth.anomaly.faultSummary', { count: faultCount }),
      tone: 'err',
    })
  }

  if (pendingTodos.length) {
    rows.push({
      key: 'todo',
      title: $t('IotDeviceDetail.connectionHealth.anomaly.todo'),
      summary: $t('IotDeviceDetail.connectionHealth.anomaly.todoSummary', { count: pendingTodos.length }),
      tone: 'info',
    })
  }

  return rows.slice(0, 3)
})
</script>

<style scoped src="./IotDeviceConnectionOverview.css"></style>
