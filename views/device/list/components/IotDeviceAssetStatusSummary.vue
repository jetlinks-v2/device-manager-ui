<template>
  <div class="asset-status-summary" :aria-label="$t('IotDeviceDetail.assetStatusSummary.aria')">
    <div class="asset-status-summary__list">
      <div v-for="item in items" :key="item.key" class="asset-status-summary__item">
        <IotDeviceStatusPill :label="item.label" :tone="item.tone" />
        <strong>{{ item.count }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

import IotDeviceStatusPill from './IotDeviceStatusPill.vue'

type SummaryTone = 'ok' | 'warn' | 'err' | 'info' | 'muted'

defineProps({
  items: {
    type: Array as PropType<Array<{ key: string; label: string; tone: SummaryTone; count: number }>>,
    default: () => [],
  },
})
</script>

<style scoped>
.asset-status-summary {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.asset-status-summary__label {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.asset-status-summary__list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.asset-status-summary__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--jet-theme-radius);
}

.asset-status-summary__item strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
