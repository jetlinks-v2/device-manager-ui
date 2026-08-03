<template>
  <header class="iot-health-hero">
    <div class="iot-health-hero__identity">
      <h2>{{ device.name }}</h2>
      <span class="iot-health-hero__pill" :data-tone="tone">{{ healthLevel }}</span>
      <span class="iot-health-hero__pill" :data-tone="connectionTone">{{ connectionLabel }}</span>
    </div>
    <div class="iot-health-hero__meta">
      <span>{{ device.productName }}</span>
      <span>{{ device.identifier }}</span>
      <span>{{ device.accessMode }}</span>
      <span>{{ device.lastSeen }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

import type { IotDevice } from '@device-manager-ui/types'
import type { HealthTone } from '../hooks/useIotDeviceHealthPage'

defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
  tone: {
    type: String as PropType<HealthTone>,
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

</script>

<style scoped>
.iot-health-hero {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--jet-theme-bg-container);
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
  border-radius: var(--jet-theme-radius-lg);
}

.iot-health-hero__identity {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.iot-health-hero__meta {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.iot-health-hero h2 {
  margin: 0;
  color: var(--jet-theme-text-title);
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: 1.35;
}

.iot-health-hero__pill {
  border-radius: 999px;
  padding: 0 var(--space-2);
  color: var(--jet-theme-text-secondary);
  background: var(--jet-theme-border-secondary);
  font-size: var(--fs-14);
  font-weight: 600;
}

.iot-health-hero__pill[data-tone='danger'] {
  color: var(--jet-theme-error);
  background: var(--err-bg);
}

.iot-health-hero__pill[data-tone='warn'] {
  color: var(--jet-theme-warning);
  background: var(--warn-bg);
}

.iot-health-hero__pill[data-tone='good'] {
  color: var(--jet-theme-success);
  background: var(--ok-bg);
}

.iot-health-hero__meta {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.iot-health-hero__meta span + span::before {
  content: "·";
  margin-right: var(--space-2);
  color: var(--jet-theme-text-disabled);
}

@media (max-width: 48rem) {
  .iot-health-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .iot-health-hero__identity,
  .iot-health-hero__meta {
    width: 100%;
  }
}
</style>
