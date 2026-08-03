<template>
  <article class="overview-panel overview-panel--location">
    <header class="overview-panel__head">
      <div class="overview-panel__title">
        <h3>{{ $t('IotDeviceDetail.location.title') }}</h3>
      </div>
    </header>

    <div class="overview-panel__body location-panel">
      <dl class="location-meta">
        <div>
          <dt>{{ $t('IotDeviceDetail.detail.area') }}</dt>
          <dd>{{ displayText(device.area) }}</dd>
        </div>
        <div>
          <dt>{{ $t('IotDeviceDetail.location.position') }}</dt>
          <dd>{{ displayText(device.location) }}</dd>
        </div>
        <div>
          <dt>{{ $t('IotDeviceDetail.location.coordinate') }}</dt>
          <dd>{{ coordinateText }}</dd>
        </div>
      </dl>

      <a-spin :spinning="loading">
        <div class="location-map">
          <AMapComponent
            v-if="mapPoint"
            class="location-map__view"
            :center="mapPoint.lnglat"
            @init="onMapInit"
          >
            <el-amap-marker :position="mapPoint.lnglat">
              <div class="location-marker">
                <span>{{ mapPoint.label }}</span>
                <i />
              </div>
            </el-amap-marker>
          </AMapComponent>
          <CloudEmpty v-else class="location-map__empty">
            <template #description>
              <strong>{{ error || $t('IotDeviceDetail.location.noCoordinate') }}</strong>
              <span>{{ $t('IotDeviceDetail.location.textOnly') }}</span>
            </template>
          </CloudEmpty>
        </div>
      </a-spin>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElAmapMarker } from '@vuemap/vue-amap'
import AMapComponent from '@jetlinks-web-core/components/AMapComponent'

import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../../types'

type MapPoint = {
  lnglat: [number, number]
  label: string
}

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
})

const { t: $t } = useI18n()
const loading = ref(false)
const error = ref('')
const queriedPoint = ref<MapPoint | null>(null)
const mapInstance = ref<any>()

const mapPoint = computed(() => resolveDevicePoint(props.device as Record<string, any>) ?? queriedPoint.value)
const coordinateText = computed(() => mapPoint.value ? mapPoint.value.lnglat.join(', ') : '--')

function displayText(value?: string | null) {
  return value && String(value).trim() ? String(value) : '--'
}

function toFiniteNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function resolveLngLat(value: unknown): [number, number] | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toFiniteNumber(value[0])
    const lat = toFiniteNumber(value[1])
    return lng !== undefined && lat !== undefined ? [lng, lat] : undefined
  }
  if (typeof value === 'string') {
    const parts = value.split(',').map((item) => item.trim())
    return resolveLngLat(parts)
  }
  if (value && typeof value === 'object') {
    const target = value as Record<string, any>
    const lng = toFiniteNumber(target.lng ?? target.lon ?? target.longitude)
    const lat = toFiniteNumber(target.lat ?? target.latitude)
    if (lng !== undefined && lat !== undefined) return [lng, lat]
    return resolveLngLat(target.coordinates ?? target.coordinate)
  }
  return undefined
}

function resolveDevicePoint(source: Record<string, any>): MapPoint | undefined {
  const lnglat = resolveLngLat([
    source.longitude ?? source.lng ?? source.lon,
    source.latitude ?? source.lat,
  ]) ??
    resolveLngLat(source.geoPoint) ??
    resolveLngLat(source.geoLocation) ??
    resolveLngLat(source.locationPoint) ??
    resolveLngLat(source.coordinate) ??
    resolveLngLat(source.coordinates)

  if (!lnglat) return undefined
  return {
    lnglat,
    label: source.name || source.deviceName || props.device.name || props.device.id,
  }
}

function normalizeGeoPoint(item: any): MapPoint | undefined {
  const lnglat = resolveLngLat(item?.geometry?.coordinates) ??
    resolveLngLat(item?.location?.coordinates) ??
    resolveLngLat(item?.geoPoint) ??
    resolveLngLat(item?.coordinate) ??
    resolveLngLat(item)

  if (!lnglat) return undefined
  return {
    lnglat,
    label: item?.properties?.deviceName || item?.deviceName || item?.name || props.device.name,
  }
}

async function queryGeoPoint() {
  if (resolveDevicePoint(props.device as Record<string, any>)) {
    queriedPoint.value = null
    error.value = ''
    return
  }

  loading.value = true
  error.value = ''
  try {
    const resp: any = await iotDeviceDetailRealApi.queryDeviceGeo({
      pageIndex: 0,
      pageSize: 1,
      terms: [{ column: 'id', value: props.device.id, termType: 'eq' }],
    })
    const result = resp?.result
    const candidates = [
      ...extractRows(result),
      ...(Array.isArray(result?.features) ? result.features : []),
      result,
    ]
    queriedPoint.value = candidates.map(normalizeGeoPoint).find(Boolean) ?? null
  } catch {
    queriedPoint.value = null
    error.value = $t('IotDeviceDetail.location.loadFailed')
  } finally {
    loading.value = false
  }
}

function onMapInit(instance: any) {
  mapInstance.value = instance
  if (mapPoint.value?.lnglat) {
    instance?.setZoomAndCenter?.(15, mapPoint.value.lnglat)
  }
}

watch(
  () => props.device.id,
  () => {
    void queryGeoPoint()
  },
  { immediate: true },
)

watch(mapPoint, (point) => {
  if (point?.lnglat) {
    mapInstance.value?.setZoomAndCenter?.(15, point.lnglat)
  }
})
</script>

<style scoped>
.location-panel {
  gap: 0.75rem;
}

.location-meta {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.location-meta div {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: 0.625rem;
  min-width: 0;
}

.location-meta dt,
.location-meta dd {
  min-width: 0;
  margin: 0;
  font-size: var(--fs-14);
}

.location-meta dt {
  color: var(--jet-theme-text-disabled);
}

.location-meta dd {
  overflow: hidden;
  color: var(--jet-theme-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-map {
  height: 10.625rem;
  overflow: hidden;
  border: 0.0625rem solid color-mix(in srgb, var(--jet-theme-border) 80%, transparent);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
}

.location-map__view {
  width: 100%;
  height: 100%;
}

.location-map__empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.375rem;
  height: 100%;
  color: var(--jet-theme-text-disabled);
  text-align: center;
}

.location-map__empty :deep(svg) {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--jet-theme-primary);
}

.location-map__empty strong {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.location-map__empty span {
  font-size: var(--fs-14);
}

.location-marker {
  position: relative;
  display: grid;
  justify-items: center;
  transform: translateY(-0.5rem);
}

.location-marker span {
  max-width: 7.5rem;
  margin-bottom: 0.25rem;
  padding: 0.1875rem 0.5rem;
  overflow: hidden;
  border-radius: 0.25rem;
  background: var(--jet-theme-bg-container);
  box-shadow: var(--jet-theme-shadow-secondary);
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-marker i {
  width: 1.125rem;
  height: 1.125rem;
  border: 0.1875rem solid var(--jet-theme-bg-container);
  border-radius: 62.4375rem 62.4375rem 62.4375rem 0;
  background: var(--jet-theme-primary);
  box-shadow: var(--jet-theme-shadow-secondary);
  transform: rotate(-45deg);
}
</style>
