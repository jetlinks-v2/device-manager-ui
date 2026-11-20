import { computed, shallowRef, watch, type CSSProperties, type Ref } from 'vue'
import { useElementSize, useResizeObserver } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { getCenterPoint } from '../../../utils/map'
import { DEVICE_MAP_CLUSTER_MAX_ZOOM, DEVICE_MAP_MAX_ZOOM } from '../DeviceMapCard/cluster'
import type { DeviceMapPoint } from '../shared'

const POPUP_MARGIN = 12
const POPUP_GAP = 16
const POPUP_MAX_WIDTH = 256

type MapCenter = [number, number] | { lng: number; lat: number }

export interface DeviceMapInstance {
  on: (event: 'zoomend' | 'resize', listener: () => void) => void
  off: (event: 'zoomend' | 'resize', listener: () => void) => void
  getFitZoomAndCenterByBounds: (bounds: number[], padding: [number, number, number, number], maxZoom: number) => [number, MapCenter]
  getSize: () => { width: number; height: number }
  panBy: (x: number, y: number, duration: number) => void
  getZoom: () => number
  getCenter: () => { lng: number; lat: number }
  setZoomAndCenter: (zoom: number, center: MapCenter, immediately?: boolean) => void
  lngLatToContainer: (position: [number, number]) => { x: number; y: number }
}

export interface DeviceMapPopupLayout {
  placement: 'above' | 'below'
  anchor: 'bottom-center' | 'top-center'
  offset: [number, number]
  style: CSSProperties
}

interface MapReturnView {
  key: string
  center: [number, number]
  zoom: number
  deviceId: string
}

// 只保留最近一次从地图进入详情的视角；不持久化设备详情或跨身份复用点位。
let returnView: MapReturnView | undefined

/** 原生信息窗跟随设备坐标，这里负责边缘避让和从详情返回时的视角。 */
export function useDeviceMapViewport(
  identity: Readonly<Ref<string>>,
  container: Ref<HTMLElement | undefined>,
  position: Readonly<Ref<[number, number] | undefined>>,
  completedLocations: Readonly<Ref<DeviceMapPoint[]>>,
  revision?: Readonly<Ref<number>>,
) {
  const route = useRoute()
  const user = useUserStore()
  const key = computed(() => JSON.stringify([user.userInfo.id, getBaseApi(), route.fullPath, identity.value]))
  const { width, height } = useElementSize(container)
  const map = shallowRef<DeviceMapInstance>()
  const restored = returnView?.key === key.value ? returnView : undefined
  if (restored) returnView = undefined
  let restoreDeviceId = restored?.deviceId
  let positionedKey: string | undefined
  const groupedByPosition = shallowRef(false)
  const popupElement = shallowRef<HTMLElement>()
  const below = shallowRef(false)
  let frame: number | undefined

  // 地图缩放或变宽时，原生浮窗的 DOM 位置可能还停在上一帧。用当前投影计算避让。
  function keepPopupVisible() {
    const point = position.value
    if (!map.value || !point) return
    below.value = map.value.lngLatToContainer(point).y < height.value / 2
    if (!popupElement.value || frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      const instance = map.value
      const panel = popupElement.value
      if (!instance || !panel || !position.value) return
      const { width, height } = instance.getSize()
      if (!width || !height || !panel.offsetWidth || !panel.offsetHeight) return
      const { x, y } = instance.lngLatToContainer(position.value)
      below.value = y < height / 2
      const side = POPUP_MARGIN + panel.offsetWidth / 2
      const end = POPUP_MARGIN + POPUP_GAP + panel.offsetHeight
      const minY = below.value ? POPUP_MARGIN : end
      const maxY = height - (below.value ? end : POPUP_MARGIN)
      const dx = Math.max(side, Math.min(x, width - side)) - x
      const dy = Math.max(minY, Math.min(y, maxY)) - y
      if (dx || dy) instance.panBy(dx, dy, 0)
    })
  }
  watch(revision ? [map, position, width, height, revision] : [map, position, width, height], keepPopupVisible, { flush: 'sync' })
  useResizeObserver(popupElement, keepPopupVisible)

  watch(map, (instance, _, onCleanup) => {
    if (!instance) return
    const updateViewport = () => {
      groupedByPosition.value = instance.getZoom() > DEVICE_MAP_CLUSTER_MAX_ZOOM
      keepPopupVisible()
    }
    updateViewport()
    instance.on('zoomend', updateViewport)
    instance.on('resize', updateViewport)
    onCleanup(() => {
      instance.off('zoomend', updateViewport)
      instance.off('resize', updateViewport)
      if (frame !== undefined) {
        cancelAnimationFrame(frame)
        frame = undefined
      }
    })
  })

  function fitPoints(points: DeviceMapPoint[], expand = false) {
    const instance = map.value
    if (!instance || !points.length) return
    const [northEast, southWest] = getCenterPoint(points.map(point => point.lnglat))
    // 首次定位最多放到街区级，保留周边参照；点击重合设备时才放到地图上限。
    const maxZoom = expand ? DEVICE_MAP_MAX_ZOOM : 16
    if (northEast[0] === southWest[0] && northEast[1] === southWest[1]) {
      instance.setZoomAndCenter(maxZoom, points[0].lnglat)
      return
    }
    const bounds = [southWest[0], southWest[1], northEast[0], northEast[1]]
    const [fitZoom, center] = instance.getFitZoomAndCenterByBounds(bounds, [40, 40, 40, 40], maxZoom)
    const zoom = expand ? Math.min(maxZoom, Math.max(instance.getZoom() + 2, fitZoom)) : fitZoom
    instance.setZoomAndCenter(zoom, center)
  }

  watch([map, completedLocations], ([instance, locations]) => {
    if (!instance || !locations.length || positionedKey === key.value) return
    fitPoints(locations)
    positionedKey = key.value
  })

  const popup = computed<DeviceMapPopupLayout>(() => ({
    placement: below.value ? 'below' : 'above',
    anchor: below.value ? 'top-center' : 'bottom-center',
    offset: [0, below.value ? POPUP_GAP : -POPUP_GAP],
    style: {
      width: `${Math.min(POPUP_MAX_WIDTH, Math.max(0, width.value - 2 * POPUP_MARGIN))}px`,
      maxHeight: `${Math.max(0, height.value - 2 * POPUP_MARGIN - POPUP_GAP)}px`,
    },
  }))

  /** 页面重建后恢复原视角，点位选择仍等待本轮授权位置查询完成。 */
  function onMapInit(instance: DeviceMapInstance) {
    map.value = instance
    positionedKey = undefined
    if (restored?.key === key.value) {
      // 恢复摘要前立即到达原视角，防止过渡动画与信息窗避让争用地图中心。
      instance.setZoomAndCenter(restored.zoom, restored.center, true)
      positionedKey = restored.key
    }
  }

  /** 导航前只记录当前地图视角及身份，浏览器返回不重新定位到默认中心。 */
  function remember(deviceId: string) {
    if (!map.value) return
    const center = map.value.getCenter()
    returnView = { key: key.value, center: [center.lng, center.lat], zoom: map.value.getZoom(), deviceId }
  }

  /** 恢复选择必须与本轮可见设备取交集，空结果或权限撤回不会展示旧设备。 */
  function takeRestoredSelection(points: DeviceMapPoint[]): { points: DeviceMapPoint[]; device: DeviceMapPoint } | undefined {
    const deviceId = restoreDeviceId
    restoreDeviceId = undefined
    if (restored?.key !== key.value) return undefined
    const point = points.find(item => item.deviceId === deviceId)
    return point ? {
      points: points.filter(item => item.lnglat[0] === point.lnglat[0] && item.lnglat[1] === point.lnglat[1]),
      device: point,
    } : undefined
  }

  return { map, popup, popupElement, groupedByPosition, fitPoints, onMapInit, remember, takeRestoredSelection }
}
