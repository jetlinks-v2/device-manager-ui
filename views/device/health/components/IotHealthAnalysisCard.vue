<template>
  <IotHealthDetailSection :title="$t('IotHealthPage.detail.analysis')">
    <div class="iot-health-analysis">
      <div class="iot-health-analysis__score">
        <svg class="iot-health-analysis__chart" viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="iot-health-score-gradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#1e72f0" />
              <stop offset="1" stop-color="#62d5f0" />
            </linearGradient>
          </defs>
          <circle class="iot-health-analysis__chart-border" cx="120" cy="120" r="108" />
          <g class="iot-health-analysis__ticks">
            <line
              v-for="tick in ticks"
              :key="tick"
              x1="120"
              x2="120"
              y1="24"
              y2="37"
              :transform="`rotate(${tick} 120 120)`"
            />
          </g>
          <circle class="iot-health-analysis__chart-track" cx="120" cy="120" r="82" />
          <path
            v-for="segment in segments"
            :key="segment.key"
            class="iot-health-analysis__chart-segment"
            :d="segment.path"
            :stroke="segment.color"
          />
          <circle
            v-for="segment in segments"
            :key="`${segment.key}-end`"
            class="iot-health-analysis__chart-marker"
            :cx="segment.marker.x"
            :cy="segment.marker.y"
            :stroke="segment.color"
          />
          <circle class="iot-health-analysis__chart-center" cx="120" cy="120" r="64" />
        </svg>
        <div class="iot-health-analysis__score-content">
          <span>{{ $t('IotHealthPage.detail.score') }}</span>
          <strong>{{ score }}<em>{{ $t('IotHealthPage.unit.score') }}</em></strong>
          <small>{{ healthLevel }}</small>
        </div>
      </div>
      <IotHealthDimensionList class="iot-health-analysis__dimensions" compact :items="dimensions" :window-label="windowLabel" />
    </div>
  </IotHealthDetailSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import IotHealthDetailSection from './IotHealthDetailSection.vue'
import IotHealthDimensionList from './IotHealthDimensionList.vue'
import type { HealthDimensionItem, HealthTone } from '../hooks/useIotDeviceHealthPage'

const props = defineProps({
  score: {
    type: Number,
    required: true,
  },
  tone: {
    type: String as PropType<HealthTone>,
    required: true,
  },
  healthLevel: {
    type: String,
    required: true,
  },
  dimensions: {
    type: Array as PropType<HealthDimensionItem[]>,
    default: () => [],
  },
  windowLabel: {
    type: String,
    required: true,
  },
})

const { t: $t } = useI18n()

const dimensionColors: Record<string, string> = {
  link: '#1e72f0',
  data: '#1593ff',
  latency: '#11c6b7',
  power: '#faa12d',
}

const ticks = Array.from({ length: 52 }, (_, index) => (index * 360) / 52)

function pointAt(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: 120 + radius * Math.cos(radians),
    y: 120 + radius * Math.sin(radians),
  }
}

function arcPath(startAngle: number, endAngle: number) {
  const start = pointAt(startAngle, 82)
  const end = pointAt(endAngle, 82)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A 82 82 0 ${largeArc} 1 ${end.x} ${end.y}`
}

const segments = computed(() => {
  const totalWeight = props.dimensions.reduce((sum, item) => sum + Math.max(item.weight, 0), 0)
  if (!totalWeight) return []

  const gap = 4
  let cursor = 0

  // The fixed visual gap preserves distinct dimension segments while weights determine their span.
  return props.dimensions.map((item) => {
    const angle = (Math.max(item.weight, 0) / totalWeight) * 360
    const startAngle = cursor + gap / 2
    const endAngle = cursor + angle - gap / 2
    cursor += angle

    return {
      key: item.key,
      color: dimensionColors[item.key] || '#1e72f0',
      path: arcPath(startAngle, endAngle),
      marker: pointAt(endAngle, 82),
    }
  })
})
</script>

<style scoped>
.iot-health-analysis {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: var(--space-6);
  align-items: center;
  min-height: 15rem;
}

.iot-health-analysis__score {
  position: relative;
  display: grid;
  place-items: center;
  width: min(15rem, 100%);
  aspect-ratio: 1;
  filter: drop-shadow(0 0.5rem 1rem rgb(30 114 240 / 8%));
}

.iot-health-analysis__chart {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.iot-health-analysis__chart-border {
  fill: none;
  stroke: #e8f3ff;
  stroke-width: 1.5;
}

.iot-health-analysis__ticks line {
  stroke: #dcecff;
  stroke-linecap: round;
  stroke-width: 1.5;
}

.iot-health-analysis__chart-track {
  fill: none;
  stroke: #f3f6fa;
  stroke-width: 12;
}

.iot-health-analysis__chart-segment {
  fill: none;
  stroke-linecap: round;
  stroke-width: 12;
}

.iot-health-analysis__chart-marker {
  fill: var(--jet-theme-bg-container);
  stroke-width: 4;
}

.iot-health-analysis__chart-center {
  fill: url(#iot-health-score-gradient);
}

.iot-health-analysis__score-content {
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  text-align: center;
}

.iot-health-analysis__score-content span {
  color: rgb(255 255 255 / 72%);
  font-size: var(--fs-14);
}

.iot-health-analysis__score-content small {
  color: rgb(255 255 255 / 72%);
  font-size: var(--fs-14);
}

.iot-health-analysis__score-content strong {
  color: #fff;
  font-size: var(--fs-44);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.iot-health-analysis__score-content em {
  margin-left: var(--space-1);
  font-size: var(--fs-16);
  font-style: normal;
}

.iot-health-analysis__dimensions {
  min-width: 0;
}

@media (max-width: 64rem) {
  .iot-health-analysis {
    grid-template-columns: minmax(0, 1fr);
  }

  .iot-health-analysis__score {
    justify-self: center;
  }
}

@container (max-width: 32rem) {
  .iot-health-analysis {
    grid-template-columns: minmax(0, 1fr);
  }

  .iot-health-analysis__score {
    justify-self: center;
  }
}
</style>
