<template>
  <div class="iot-health-events">
    <article
      v-for="item in items"
      :key="item.id"
      class="iot-health-events__row"
      :data-tone="item.tone"
    >
      <span class="iot-health-events__icon">
        <WarningOutlined v-if="item.tone === 'danger'" />
        <ClockCircleOutlined v-else-if="item.tone === 'warn'" />
        <InfoCircleOutlined v-else />
      </span>
      <div class="iot-health-events__body">
        <strong>{{ item.title }}</strong>
        <p>{{ item.desc }}</p>
        <em>{{ item.meta }}</em>
      </div>
      <time>{{ item.time }}</time>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { ClockCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons-vue'

import type { HealthEventItem } from '../hooks/useIotDeviceHealthPage'

defineProps({
  items: {
    type: Array as PropType<HealthEventItem[]>,
    default: () => [],
  },
})
</script>

<style scoped>
.iot-health-events {
  display: grid;
}

.iot-health-events__row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3) 0;
  border-top: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
}

.iot-health-events__row:first-child {
  border-top: 0;
  padding-top: 0;
}

.iot-health-events__icon {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
  border-radius: var(--jet-theme-radius);
}

.iot-health-events__row[data-tone='danger'] .iot-health-events__icon {
  color: var(--jet-theme-error);
  background: var(--err-bg);
}

.iot-health-events__row[data-tone='warn'] .iot-health-events__icon {
  color: var(--jet-theme-warning);
  background: var(--warn-bg);
}

.iot-health-events__body {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.iot-health-events__body strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 700;
}

.iot-health-events__body p {
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.iot-health-events__body em,
.iot-health-events__row time {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
}

.iot-health-events__row time {
  text-align: right;
  white-space: nowrap;
}
</style>
