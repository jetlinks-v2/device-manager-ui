<template>
  <IotHealthDetailSection :title="$t('IotHealthPage.detail.basic')">
    <div class="iot-health-info">
      <div v-for="item in items" :key="item.key" class="iot-health-info__item">
        <span>{{ item.label }}</span>
        <strong :class="{ 'is-mono': item.mono }">{{ item.value }}</strong>
      </div>
    </div>
  </IotHealthDetailSection>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

import IotHealthDetailSection from './IotHealthDetailSection.vue'
import type { HealthInfoItem } from '../hooks/useIotDeviceHealthPage'
import { useI18n } from 'vue-i18n'

defineProps({
  items: {
    type: Array as PropType<HealthInfoItem[]>,
    default: () => [],
  },
})

const { t: $t } = useI18n()
</script>

<style scoped>
.iot-health-info {
  display: grid;
  gap: var(--space-3);
}

.iot-health-info__item {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: var(--space-3);
  align-items: baseline;
  min-width: 0;
}

.iot-health-info__item span {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.iot-health-info__item strong {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iot-health-info__item strong.is-mono {
  font-size: var(--fs-14);
}

@media (max-width: 64rem) {
  .iot-health-info__item {
    grid-template-columns: 4.5rem minmax(0, 1fr);
  }
}
</style>
