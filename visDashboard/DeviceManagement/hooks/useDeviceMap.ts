import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { debounce } from 'lodash-es'
import { getCenterPoint } from '../../../utils/map'
import { deviceMapCardConfig } from '../DeviceMapCard/config'
import type { DashboardCardInfo, DeviceMapConfig, DeviceMapPoint } from '../shared'
import { getComponentConfig } from '../shared'
import { createDeviceMapStream } from '../services/deviceMap'
import { createDeviceMapMarkerOptions } from '../DeviceMapCard/markers'
import {
  DEVICE_MAP_MAX_ZOOM,
  resolveClusterDevices,
  shouldOpenDeviceCluster,
  type DeviceClusterPoint
} from '../DeviceMapCard/cluster'
import { useDeviceMapSelection } from './useDeviceMapSelection'

interface AMapApiLike {
  Bounds: new (southWest: unknown, northEast: unknown) => unknown
  LngLat: new (lng: number, lat: number) => unknown
}

interface MapInstanceLike {
  getFitZoomAndCenterByBounds: (
    bounds: unknown,
    padding: [number, number, number, number],
    maxZoom: number
  ) => [number, [number, number]]
  getZoom: () => number
  setZoomAndCenter: (zoom: number, center: [number, number]) => void
}

/** Owns the location stream, cluster navigation and the selected device card. */
export const useDeviceMap = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>, enabled: Ref<boolean>) => {
  const config = getComponentConfig<DeviceMapConfig>(
    info,
    'deviceMapCard',
    deviceMapCardConfig.componentProps.deviceMapCard
  )
  const points = shallowRef<DeviceMapPoint[]>([])
  const loading = ref(false)
  const error = ref(false)
  const map = shallowRef<MapInstanceLike>()
  const selection = useDeviceMapSelection()
  const extraOptions = createDeviceMapMarkerOptions()
  let stream: { close: () => void } | undefined
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let requestId = 0

  const closeStreamLater = debounce(() => {
    requestId += 1
    loading.value = false
    stream?.close()
    stream = undefined
  }, 1000)

  const stopStream = () => {
    requestId += 1
    closeStreamLater.cancel()
    stream?.close()
    stream = undefined
  }
  const stopRefreshTimer = () => {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = undefined
  }

  const refresh = () => {
    stopStream()
    selection.close()
    if (isEdit.value || !enabled.value) {
      points.value = []
      loading.value = false
      error.value = false
      return
    }
    const currentRequestId = requestId
    const devices = new Map<string, DeviceMapPoint>()
    points.value = []
    loading.value = true
    error.value = false
    stream = createDeviceMapStream({
      onMessage: (nextPoints) => {
        if (currentRequestId !== requestId) return
        // Different devices may have identical names and coordinates; only identity deduplicates them.
        nextPoints.forEach((item) => devices.set(item.deviceId, item))
        points.value = [...devices.values()]
        closeStreamLater()
      },
      onComplete: () => {
        if (currentRequestId !== requestId) return
        stopStream()
        loading.value = false
      },
      onError: () => {
        if (currentRequestId !== requestId) return
        stopStream()
        loading.value = false
        if (!points.value.length) error.value = true
      }
    })
  }

  const onMapInit = (instance: MapInstanceLike) => {
    map.value = instance
  }
  const onClusterClick = ({ clusterData }: { clusterData: DeviceClusterPoint[] }) => {
    if (isEdit.value || !enabled.value || !map.value) return
    const devices = resolveClusterDevices(clusterData)
    if (!devices.length) return
    if (shouldOpenDeviceCluster(devices, map.value.getZoom())) {
      selection.open(devices)
      return
    }
    selection.close()
    const api = (window as Window & { AMap?: AMapApiLike }).AMap
    if (!api) return
    const [northEast, southWest] = getCenterPoint(devices.map((point) => point.lnglat))
    const bounds = new api.Bounds(
      new api.LngLat(southWest[0], southWest[1]),
      new api.LngLat(northEast[0], northEast[1])
    )
    const [fitZoom, center] = map.value.getFitZoomAndCenterByBounds(bounds, [40, 40, 40, 40], DEVICE_MAP_MAX_ZOOM)
    // Always make progress when bounds fitting returns the current zoom for a dense cluster.
    const zoom = Math.min(DEVICE_MAP_MAX_ZOOM, Math.max(map.value.getZoom() + 2, fitZoom))
    map.value.setZoomAndCenter(zoom, center)
  }

  watch(
    [config, isEdit, enabled],
    ([currentConfig, currentEdit, currentEnabled]) => {
      stopRefreshTimer()
      if (currentEdit || !currentEnabled) {
        stopStream()
        selection.close()
        points.value = []
        loading.value = false
        error.value = false
        return
      }
      refresh()
      if (currentConfig.isAutoRefresh && Number(currentConfig.interval) > 0) {
        refreshTimer = setInterval(refresh, Number(currentConfig.interval) * 1000)
      }
    },
    { immediate: true, deep: true }
  )

  onUnmounted(() => {
    stopRefreshTimer()
    stopStream()
  })
  return { config, points, loading, error, extraOptions, selection, refresh, onMapInit, onClusterClick }
}
