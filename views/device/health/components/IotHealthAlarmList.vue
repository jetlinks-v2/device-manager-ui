<template>
  <div class="iot-health-alarms">
    <div class="iot-health-alarms__row is-head">
      <span>{{ $t('IotHealthPage.detail.alarm.level') }}</span>
      <span>{{ $t('IotHealthPage.detail.alarm.name') }}</span>
      <span>{{ $t('IotHealthPage.detail.alarm.time') }}</span>
      <span>{{ $t('IotHealthPage.detail.alarm.status') }}</span>
    </div>
    <div
      v-for="item in items"
      :key="item.id"
      class="iot-health-alarms__row"
      :data-tone="item.tone"
    >
      <span class="iot-health-alarms__level">{{ item.level }}</span>
      <strong>{{ item.title }}</strong>
      <time>{{ item.time }}</time>
      <em>{{ item.status }}</em>
    </div>
    <div class="iot-health-alarms__empty">
      <CloudEmpty v-if="!items.length" :description="$t('IotHealthPage.detail.alarm.empty')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

import type { HealthAlarmItem } from '../hooks/useIotDeviceHealthPage'
import { useI18n } from 'vue-i18n'

defineProps({
  items: {
    type: Array as PropType<HealthAlarmItem[]>,
    default: () => [],
  },
})

const { t: $t } = useI18n()
</script>

<style scoped>
.iot-health-alarms {
  overflow: hidden;
  border-radius: var(--jet-theme-radius-lg);
}

.iot-health-alarms__row {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) 7rem 7rem;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-top: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
}

.iot-health-alarms__row:first-child {
  border-top: 0;
}

.iot-health-alarms__row.is-head {
  color: var(--jet-theme-text-disabled);
  background: var(--jet-theme-bg-layout);
  font-size: var(--fs-14);
  font-weight: 700;
}

.iot-health-alarms__level,
.iot-health-alarms__row em {
  width: fit-content;
  border-radius: var(--jet-theme-radius-sm);
  padding: 0 var(--space-2);
  color: var(--jet-theme-text-secondary);
  background: var(--jet-theme-border-secondary);
  font-size: var(--fs-14);
  font-style: normal;
  font-weight: 700;
}

.iot-health-alarms__row[data-tone='danger'] .iot-health-alarms__level {
  color: var(--jet-theme-error);
  background: var(--err-bg);
}

.iot-health-alarms__row[data-tone='warn'] .iot-health-alarms__level {
  color: var(--jet-theme-warning);
  background: var(--warn-bg);
}

.iot-health-alarms__row[data-tone='brand'] .iot-health-alarms__level {
  color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
}

.iot-health-alarms__row strong {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iot-health-alarms__row time {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.iot-health-alarms__empty {
  margin: var(--space-10) 0;
}
</style>
