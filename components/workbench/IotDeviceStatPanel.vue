<template>
  <section class="device-stat-panel" :aria-label="$t('IotWorkbench.stats.aria')">
    <div class="device-stat-cards">
      <div
        v-for="item in items"
        :key="item.key"
        class="device-stat-card"
        :data-tone="item.tone"
        :data-key="item.key"
        :aria-label="$t('IotWorkbench.stats.cardAria', {
          title: item.title,
          value: item.value,
          unit: item.unit,
          trend: item.trend?.value || '',
          label: item.trend?.label || '',
        })"
      >
        <div class="device-stat-card__main">
          <span class="device-stat-card__body">
            <span class="device-stat-card__title">{{ item.title }}</span>
            <span class="device-stat-card__value">
              <strong>{{ formatValue(item.value) }}</strong>
              <span v-if="item.unit">{{ item.unit }}</span>
            </span>
          </span>

          <span class="device-stat-card__visual" :style="cardVisualStyle(item)" aria-hidden="true">
            <span v-if="item.key === 'total'" class="device-stat-card__ring device-stat-card__ring--total"></span>
            <svg
              v-else-if="item.key === 'online' || item.key === 'alarm'"
              class="device-stat-card__spark"
              viewBox="0 0 90 42"
              preserveAspectRatio="none"
            >
              <polyline :points="statSparklinePoints(item)" />
            </svg>
            <svg v-else-if="item.key === 'alarm-config'" class="device-stat-card__bars" viewBox="0 0 90 56">
              <rect
                v-for="(height, index) in configBarHeights"
                :key="height"
                :x="index * 12 + 4"
                :y="54 - height"
                width="4"
                :height="height"
                rx="2"
              />
            </svg>
            <span v-else-if="item.key === 'health-score'" class="device-stat-card__ring device-stat-card__ring--score"></span>
          </span>
        </div>

        <div class="device-stat-card__meta">
          <span v-if="item.breakdown?.length" class="device-stat-card__breakdown">
            <span v-for="entry in item.breakdown" :key="entry.label" class="device-stat-card__breakdown-item" :data-tone="entry.tone">
              <i aria-hidden="true"></i>
              <span>{{ entry.label }}</span>
              <strong>{{ formatValue(entry.value) }}</strong>
            </span>
          </span>
          <span v-else :title="item.detail || cardMetaText(item)">{{ cardMetaText(item) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CSSProperties, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceStatCard } from '../useIotDeviceWorkbench'

defineProps({
  items: {
    type: Array as PropType<DeviceStatCard[]>,
    required: true,
  },
  formatValue: {
    type: Function as PropType<(value: number) => string>,
    required: true,
  },
})

const { t: $t } = useI18n()
const configBarHeights = [28, 16, 22, 38, 50, 42, 32]

const sparklinePoints: Record<string, string> = {
  online: '2,30 10,26 18,32 26,18 34,28 42,14 50,24 58,8 66,22 74,12 82,25 88,16',
  alarm: '2,34 10,30 18,32 26,18 34,24 42,10 50,28 58,6 66,18 74,8 82,26 88,14',
}

function buildSparklinePoints(values: number[]) {
  if (values.length < 2) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 1)
  return values.map((value, index) => {
    const x = 2 + (index / (values.length - 1)) * 86
    const y = 36 - ((value - min) / range) * 30
    return `${Math.round(x)},${Math.round(y)}`
  }).join(' ')
}

function statSparklinePoints(item: DeviceStatCard) {
  if (item.sparkline) return buildSparklinePoints(item.sparkline)
  return sparklinePoints[item.key] ?? ''
}

function cardMetaText(item: DeviceStatCard) {
  if (item.key === 'online' && item.trend) {
    return `${item.title}${item.trend.value}`
  }
  return item.subtitle || item.trend?.label || item.trend?.value || ''
}

function cardVisualStyle(item: DeviceStatCard): CSSProperties {
  if (item.key === 'total' && item.breakdown?.length) {
    const total = Math.max(item.breakdown.reduce((sum, entry) => sum + entry.value, 0), 1)
    const [online = 0, offline = 0] = item.breakdown.map((entry) => entry.value)
    const onlineEnd = (online / total) * 360
    const offlineEnd = onlineEnd + (offline / total) * 360
    return {
      '--stat-online-end': `${onlineEnd}deg`,
      '--stat-offline-end': `${offlineEnd}deg`,
    } as CSSProperties
  }
  if (item.key === 'health-score') {
    return {
      '--stat-score-end': `${Math.min(Math.max(item.value, 0), 100)}%`,
    } as CSSProperties
  }
  return {}
}
</script>
