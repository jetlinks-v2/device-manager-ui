<template>
  <section class="iot-health-detail">
    <IotHealthDetailHero
      :device="item.device"
      :tone="tone"
      :connection-label="connectionLabel"
      :connection-tone="connectionTone"
      :health-level="healthLevel"
    />

    <div class="iot-health-detail__summary">
      <IotHealthInfoGrid :items="infoItems" />
      <IotHealthAnalysisCard
        :score="item.score"
        :tone="tone"
        :health-level="healthLevel"
        :dimensions="dimensions"
        :window-label="windowLabel"
      />
    </div>

    <div class="iot-health-detail__signals">
      <IotHealthDetailSection
        :title="$t('IotHealthPage.trend.eyebrow')"
        :meta="windowLabel"
      >
        <IotHealthTrendChart
          :points="trend"
          :labels="trendLabels"
          :threshold-label="$t('IotHealthPage.trend.threshold')"
        />
      </IotHealthDetailSection>

      <IotHealthDetailSection
        :title="$t('IotHealthPage.detail.events')"
        :meta="$t('IotHealthPage.detail.eventCount', { total: events.length })"
      >
        <IotHealthEventList :items="events" />
      </IotHealthDetailSection>
    </div>

    <IotHealthDetailSection
      :title="$t('IotHealthPage.detail.alarms')"
      :meta="$t('IotHealthPage.detail.alarmCount', { total: alarms.length })"
    >
      <IotHealthAlarmList :items="alarms" />
    </IotHealthDetailSection>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

import IotHealthAlarmList from './IotHealthAlarmList.vue'
import IotHealthAnalysisCard from './IotHealthAnalysisCard.vue'
import IotHealthDetailHero from './IotHealthDetailHero.vue'
import IotHealthDetailSection from './IotHealthDetailSection.vue'
import IotHealthEventList from './IotHealthEventList.vue'
import IotHealthInfoGrid from './IotHealthInfoGrid.vue'
import IotHealthTrendChart from './IotHealthTrendChart.vue'
import type {
  HealthAlarmItem,
  HealthDimensionItem,
  HealthEventItem,
  HealthInfoItem,
  HealthTone,
} from '../hooks/useIotDeviceHealthPage'
import type { IotDevice } from '@device-manager-ui/types'
import { useI18n } from 'vue-i18n'

defineProps({
  item: {
    type: Object as PropType<{ device: IotDevice; score: number; delta: number }>,
    required: true,
  },
  tone: {
    type: String as PropType<HealthTone>,
    required: true,
  },
  dimensions: {
    type: Array as PropType<HealthDimensionItem[]>,
    default: () => [],
  },
  infoItems: {
    type: Array as PropType<HealthInfoItem[]>,
    default: () => [],
  },
  trend: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
  trendLabels: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  events: {
    type: Array as PropType<HealthEventItem[]>,
    default: () => [],
  },
  alarms: {
    type: Array as PropType<HealthAlarmItem[]>,
    default: () => [],
  },
  windowLabel: {
    type: String,
    required: true,
  },
  connectionLabel: {
    type: String,
    required: true,
  },
  connectionTone: {
    type: String as PropType<HealthTone>,
    required: true,
  },
  healthLevel: {
    type: String,
    required: true,
  },
})

const { t: $t } = useI18n()
</script>

<style scoped>
.iot-health-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  container-type: inline-size;
}

.iot-health-detail__summary,
.iot-health-detail__signals {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.iot-health-detail__summary {
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
}

.iot-health-detail__signals {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
}

.iot-health-detail__summary > *,
.iot-health-detail__signals > * {
  min-width: 0;
}

@media (max-width: 75rem) {
  .iot-health-detail__summary,
  .iot-health-detail__signals {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container (max-width: 50rem) {
  .iot-health-detail__summary,
  .iot-health-detail__signals {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
