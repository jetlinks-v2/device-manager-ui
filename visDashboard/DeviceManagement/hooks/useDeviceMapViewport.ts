import { computed, shallowRef, type CSSProperties, type Ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { getBaseApi } from '@jetlinks-web-core/utils'
import type { DeviceMapPoint } from '../shared'

export interface DeviceMapInstance {
  getFitZoomAndCenterByBounds: (bounds: unknown, padding: [number, number, number, number], maxZoom: number) => [number, [number, number]]
  getZoom: () => number
  getCenter: () => { lng: number; lat: number }
  setZoomAndCenter: (zoom: number, center: [number, number]) => void
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

/** 原生信息窗负责跟随点位及自动避让；本 hook 限制浮卡尺寸并恢复详情返回视角。 */
export function useDeviceMapViewport(
  identity: Readonly<Ref<string>>,
  container: Ref<HTMLElement | undefined>,
  position: Readonly<Ref<[number, number] | undefined>>,
) {
  const route = useRoute()
  const user = useUserStore()
  const key = computed(() => JSON.stringify([user.userInfo.id, getBaseApi(), route.fullPath, identity.value]))
  const { width, height } = useElementSize(container)
  const map = shallowRef<DeviceMapInstance>()
  const restored = returnView?.key === key.value ? returnView : undefined
  if (restored) returnView = undefined
  let restoreDeviceId = restored?.deviceId

  const popup = computed<DeviceMapPopupLayout>(() => {
    const below = !!(position.value && map.value
      && map.value.lngLatToContainer(position.value).y < height.value / 2)
    return {
      placement: below ? 'below' : 'above',
      anchor: below ? 'top-center' : 'bottom-center',
      offset: [0, below ? 16 : -16],
      style: {
        width: `${Math.min(320, Math.max(0, width.value - 24))}px`,
        maxHeight: `${Math.max(0, height.value - 40)}px`,
      },
    }
  })

  /** 页面重建后恢复原视角，点位选择仍等待本轮授权位置查询完成。 */
  function onMapInit(instance: DeviceMapInstance) {
    map.value = instance
    if (restored?.key === key.value) instance.setZoomAndCenter(restored.zoom, restored.center)
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

  return { map, popup, onMapInit, remember, takeRestoredSelection }
}
