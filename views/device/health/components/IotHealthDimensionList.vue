<template>
  <div class="health-dimensions" :class="{ 'health-dimensions--compact': compact }">
    <div
      v-for="item in items"
      :key="item.key"
      class="health-dimensions__row"
      :class="`health-dimensions__row--${item.tone}`"
      :data-key="item.key"
    >
      <div class="health-dimensions__icon">
        <AIcon :type="iconByKey[item.key] || 'icon-shuxingpeizhi'" />
      </div>
      <div class="health-dimensions__body">
        <strong>{{ item.label }}</strong>
        <span>{{ $t('IotHealthPage.dimension.weight', { value: item.weight }) }} · {{ deltaText(item) }}</span>
        <div class="health-dimensions__bar">
          <i :style="{ width: `${item.score}%` }" />
        </div>
      </div>
      <span class="health-dimensions__score">{{ item.score }}<em>{{ $t('IotHealthPage.unit.score') }}</em></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import type { HealthDimensionItem } from '../hooks/useIotDeviceHealthPage'

const props = defineProps({
  items: {
    type: Array as PropType<HealthDimensionItem[]>,
    default: () => [],
  },
  windowLabel: {
    type: String,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const iconByKey: Record<string, string> = {
  link: 'icon-wulian-shebeijiankang-lianluzhiliang',
  data: 'icon-wulian-shebeijiankang-shujuwanzhengxing',
  latency: 'icon-wulian-shebeijiankang-gongdianwendingxing',
  power: 'icon-wulian-shebeijiankang-xiangyingshiyan',
}

const $t = i18n.global.t

function deltaText(item: HealthDimensionItem) {
  if (item.delta > 0) return $t('IotHealthPage.dimension.deltaUp', { window: props.windowLabel, value: Math.abs(item.delta) })
  if (item.delta < 0) return $t('IotHealthPage.dimension.deltaDown', { window: props.windowLabel, value: Math.abs(item.delta) })
  return $t('IotHealthPage.dimension.deltaFlat', { window: props.windowLabel })
}
</script>

<style scoped>
.health-dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-6);
}

.health-dimensions__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: center;
}

.health-dimensions__icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
  border-radius: var(--jet-theme-radius-sm);
}

.health-dimensions__body {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.health-dimensions__body strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.health-dimensions__body span {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.health-dimensions__bar {
  height: 0.375rem;
  overflow: hidden;
  background: var(--jet-theme-border-secondary);
  border-radius: 999px;
}

.health-dimensions__bar i {
  display: block;
  height: 100%;
  background: var(--jet-theme-primary);
  border-radius: inherit;
}

.health-dimensions__score {
  color: var(--jet-theme-text);
  font-size: var(--fs-24);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.health-dimensions__score em {
  margin-left: 0.125rem;
  font-size: var(--fs-14);
  font-style: normal;
}

.health-dimensions__row--good .health-dimensions__bar i,
.health-dimensions__row--good .health-dimensions__score {
  color: var(--jet-theme-success);
}

.health-dimensions__row--good .health-dimensions__bar i {
  background: var(--jet-theme-success);
}

.health-dimensions__row--warn .health-dimensions__bar i,
.health-dimensions__row--warn .health-dimensions__score {
  color: var(--jet-theme-warning);
}

.health-dimensions__row--warn .health-dimensions__bar i {
  background: var(--jet-theme-warning);
}

.health-dimensions__row--danger .health-dimensions__bar i,
.health-dimensions__row--danger .health-dimensions__score {
  color: var(--jet-theme-error);
}

.health-dimensions__row--danger .health-dimensions__bar i {
  background: var(--jet-theme-error);
}

.health-dimensions--compact {
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

.health-dimensions--compact .health-dimensions__row {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
}

.health-dimensions--compact .health-dimensions__icon {
  display: none;
}

.health-dimensions--compact .health-dimensions__body {
  grid-template-columns: minmax(5rem, 1fr) auto;
  column-gap: var(--space-3);
  align-items: center;
}

.health-dimensions--compact .health-dimensions__body strong {
  grid-column: 1;
}

.health-dimensions--compact .health-dimensions__body span {
  grid-column: 2;
  grid-row: 1;
  white-space: nowrap;
}

.health-dimensions--compact .health-dimensions__bar {
  grid-column: 1 / -1;
}

.health-dimensions--compact .health-dimensions__score {
  font-size: var(--fs-16);
}

.health-dimensions--compact .health-dimensions__row[data-key='link'] {
  --health-dimension-color: #1e72f0;
}

.health-dimensions--compact .health-dimensions__row[data-key='data'] {
  --health-dimension-color: #1593ff;
}

.health-dimensions--compact .health-dimensions__row[data-key='latency'] {
  --health-dimension-color: #11c6b7;
}

.health-dimensions--compact .health-dimensions__row[data-key='power'] {
  --health-dimension-color: #faa12d;
}

.health-dimensions--compact .health-dimensions__row[data-key] .health-dimensions__bar i {
  background: var(--health-dimension-color);
}

.health-dimensions--compact .health-dimensions__row[data-key] .health-dimensions__score {
  color: var(--health-dimension-color);
}

@container (max-width: 20rem) {
  .health-dimensions--compact .health-dimensions__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .health-dimensions--compact .health-dimensions__body span {
    grid-column: 1;
    grid-row: auto;
    white-space: normal;
  }
}

@media (max-width: 64rem) {
  .health-dimensions {
    grid-template-columns: 1fr;
  }
}
</style>
