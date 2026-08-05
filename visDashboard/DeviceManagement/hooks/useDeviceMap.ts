import type { Ref } from 'vue'
import { debounce } from 'lodash-es'
import { getCenterPoint } from '../../../utils/map'
import { deviceMapCardConfig } from '../DeviceMapCard/config'
import type { DashboardCardInfo, DeviceMapConfig, DeviceMapPoint } from '../shared'
import { getComponentConfig } from '../shared'
import { createDeviceMapStream } from '../services/deviceMap'
import markerPng from '@device-manager-ui/assets/marker.png'

interface AMapApiLike {
  Bounds: new (northEast: unknown, southWest: unknown) => unknown
  LngLat: new (lng: number, lat: number) => unknown
  Pixel: new (x: number, y: number) => unknown
}

interface AMapMarkerLike {
  setOffset: (offset: unknown) => void
  setContent: (content: string | HTMLElement) => void
  setAnchor: (anchor: string) => void
}

interface AMapClusterRenderContext {
  count: number
  marker: AMapMarkerLike
  data: Array<{
    label?: string
  }>
}

interface AMapClusterPoint {
  lnglat?: {
    lng?: number
    lat?: number
  } | [number, number]
}

interface AMapClusterClickEvent {
  clusterData: AMapClusterPoint[]
}

interface MapInstanceLike {
  getFitZoomAndCenterByBounds: (
    bounds: unknown,
    padding: [number, number, number, number],
    maxZoom: number
  ) => [number, [number, number]]
  setZoomAndCenter: (zoom: number, center: [number, number]) => void
}

const getAMapApi = () => (window as Window & { AMap?: AMapApiLike }).AMap

const resolveClusterPoint = (item: AMapClusterPoint): [number, number] | undefined => {
  const value = item.lnglat

  if (Array.isArray(value) && value.length >= 2) {
    const lng = Number(value[0])
    const lat = Number(value[1])

    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat]
    }
  }

  const lng = Number(value?.lng)
  const lat = Number(value?.lat)

  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    return [lng, lat]
  }

  return undefined
}

export const useDeviceMap = (
  info: Ref<DashboardCardInfo | undefined>,
  isEdit: Ref<boolean>,
  enabled: Ref<boolean>
) => {
  const config = getComponentConfig<DeviceMapConfig>(info, 'deviceMapCard', deviceMapCardConfig.componentProps.deviceMapCard)
  const points = ref<DeviceMapPoint[]>([])
  const loading = ref(false)
  const error = ref('')
  const map = shallowRef<MapInstanceLike>()

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
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = undefined
    }
  }

  const refresh = async () => {
    stopStream()

    if (isEdit.value || !enabled.value) {
      points.value = []
      loading.value = false
      error.value = ''
      return
    }

    const currentRequestId = requestId
    const pointKeys = new Set<string>()

    points.value = []
    loading.value = true
    error.value = ''

    stream = createDeviceMapStream({
      onMessage: (nextPoints) => {
        if (currentRequestId !== requestId) {
          return
        }

        const merged = [...points.value]

        nextPoints.forEach((item) => {
          const key = `${item.lnglat[0]}-${item.lnglat[1]}-${item.label}`

          if (!pointKeys.has(key)) {
            pointKeys.add(key)
            merged.push(item)
          }
        })

        points.value = merged
        closeStreamLater()
      },
      onError: () => {
        if (currentRequestId !== requestId) {
          return
        }

        stopStream()
        loading.value = false

        if (!points.value.length) {
          error.value = '设备地图加载失败'
        }
      }
    })
  }

  const onMapInit = (instance: MapInstanceLike) => {
    map.value = instance
  }

  const onClusterClick = ({ clusterData }: AMapClusterClickEvent) => {
    if (clusterData.length <= 1 || !map.value) {
      return
    }

    const clusterPoints = clusterData
      .map(resolveClusterPoint)
      .filter((item): item is [number, number] => !!item)

    if (clusterPoints.length <= 1) {
      return
    }

    const amapApi = getAMapApi()

    if (!amapApi) {
      return
    }

    const [northEast, southWest] = getCenterPoint(clusterPoints)
    const bounds = new amapApi.Bounds(
      new amapApi.LngLat(northEast[0], northEast[1]),
      new amapApi.LngLat(southWest[0], southWest[1])
    )
    const [zoom, center] = map.value.getFitZoomAndCenterByBounds(bounds, [10, 10, 10, 10], 19)

    map.value.setZoomAndCenter(zoom, center)
  }

  const extraOptions = computed(() => ({
    gridSize: 10,
    renderClusterMarker(context: AMapClusterRenderContext) {
      const amapApi = getAMapApi()

      if (!amapApi) {
        return
      }

      const div = document.createElement('div')
      const hue = 18
      const size = 44

      div.style.backgroundColor = `hsla(${hue},100%,40%,0.7)`
      div.style.width = `${size}px`
      div.style.height = `${size}px`
      div.style.border = `solid 1px hsla(${hue},100%,40%,1)`
      div.style.borderRadius = `${size / 2}px`
      div.style.boxShadow = `0 0 5px hsla(${hue},100%,90%,1)`
      div.innerHTML = String(context.count)
      div.style.lineHeight = `${size}px`
      div.style.color = `hsla(${hue},100%,90%,1)`
      div.style.fontSize = '14px'
      div.style.textAlign = 'center'

      context.marker.setOffset(new amapApi.Pixel(-size / 2, -size / 2))
      context.marker.setContent(div)
    },
    renderMarker(context: AMapClusterRenderContext) {
      const amapApi = getAMapApi()

      if (!amapApi) {
        return
      }

      context.marker.setContent(`
        <div class="device-dashboard-marker-content">
          <span class="device-dashboard-marker-label">${context.data[0]?.label || ''}</span>
          <img src="${markerPng}" style="height: 34px; width: 25px" />
        </div>
      `)
      context.marker.setAnchor('bottom-center')
      context.marker.setOffset(new amapApi.Pixel(0, 3))
    }
  }))

  watch(
    [config, isEdit, enabled],
    ([currentConfig, currentEdit, currentEnabled]) => {
      stopRefreshTimer()

      if (currentEdit || !currentEnabled) {
        stopStream()
        points.value = []
        loading.value = false
        error.value = ''
        return
      }

      void refresh()

      if (currentConfig.isAutoRefresh && Number(currentConfig.interval) > 0) {
        refreshTimer = setInterval(() => {
          void refresh()
        }, Number(currentConfig.interval) * 1000)
      }
    },
    { immediate: true, deep: true }
  )

  onUnmounted(() => {
    stopRefreshTimer()
    stopStream()
  })

  return {
    config,
    points,
    loading,
    error,
    extraOptions,
    refresh,
    onMapInit,
    onClusterClick
  }
}
