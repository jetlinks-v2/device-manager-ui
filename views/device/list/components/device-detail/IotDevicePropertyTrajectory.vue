<template>
  <a-spin :spinning="loading">
    <section class="property-trajectory">
      <div class="property-trajectory__actions">
        <a-button type="primary" :disabled="!canAnimate" @click="startAnimation">
          {{ $t('IotDeviceDetail.propertyDetail.startAnimation') }}
        </a-button>
        <a-button v-if="!paused" :disabled="!canAnimate" @click="pauseAnimation">
          {{ $t('IotDeviceDetail.propertyDetail.pauseAnimation') }}
        </a-button>
        <a-button v-else :disabled="!canAnimate" @click="resumeAnimation">
          {{ $t('IotDeviceDetail.propertyDetail.resumeAnimation') }}
        </a-button>
      </div>

      <div class="property-trajectory__body">
        <AMapComponent
          v-if="center"
          :AMapUI="true"
          class="property-trajectory__map"
          @init="onMapInit"
        >
          <PathSimplifier v-if="canAnimate" ref="trajectoryPlayer" :path-data="trajectory" />
          <ElAmapMarker v-else :position="center" />
        </AMapComponent>
        <CloudEmpty
          v-else
          class="property-trajectory__empty"
          :description="$t('IotDeviceDetail.propertyDetail.emptyTrajectory')"
        />
      </div>
    </section>
  </a-spin>
</template>

<script setup lang="ts">
import type { Dayjs } from 'dayjs'
import { ElAmapMarker } from '@vuemap/vue-amap'
import { computed, ref, type PropType, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AMapComponent from '@jetlinks-web-core/components/AMapComponent'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { useIotDevicePropertyTrajectory } from './useIotDevicePropertyTrajectory'

type TimeRange = [Dayjs, Dayjs] | undefined

interface TrajectoryPlayer {
  start: () => void
  pause: () => void
  resume: () => void
}

const props = defineProps({
  deviceId: { type: String, required: true },
  property: { type: Object as PropType<RealtimePropertyRow | null>, default: null },
  timeRange: { type: Array as PropType<TimeRange>, default: undefined },
})

const { t: $t } = useI18n()
const property = computed(() => props.property)
const timeRange = computed(() => props.timeRange)
const { loading, trajectory } = useIotDevicePropertyTrajectory({
  deviceId: computed(() => props.deviceId),
  property,
  timeRange,
})
const trajectoryPlayer = ref<TrajectoryPlayer | null>(null)
const mapInstance = ref<{ setZoomAndCenter?: (zoom: number, center: number[]) => void } | null>(null)
const paused = ref(false)
const center = computed(() => trajectory.value[0]?.path[0])
const canAnimate = computed(() => (trajectory.value[0]?.path.length ?? 0) > 1)

function onMapInit(instance: { setZoomAndCenter?: (zoom: number, center: number[]) => void }) {
  mapInstance.value = instance
  focusSinglePoint()
}

function focusSinglePoint() {
  if (!canAnimate.value && center.value) {
    mapInstance.value?.setZoomAndCenter?.(15, center.value)
  }
}

function startAnimation() {
  trajectoryPlayer.value?.start()
  paused.value = false
}

function pauseAnimation() {
  trajectoryPlayer.value?.pause()
  paused.value = true
}

function resumeAnimation() {
  trajectoryPlayer.value?.resume()
  paused.value = false
}

watch(center, () => {
  paused.value = false
  focusSinglePoint()
})
</script>

<style scoped>
.property-trajectory {
  display: grid;
  gap: var(--space-3);
}

.property-trajectory__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.property-trajectory__body {
  height: 26.25rem;
  overflow: hidden;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
}

.property-trajectory__map,
.property-trajectory__empty {
  width: 100%;
  height: 100%;
}

.property-trajectory__empty {
  display: grid;
  place-items: center;
  color: var(--jet-theme-text-disabled);
}
</style>
