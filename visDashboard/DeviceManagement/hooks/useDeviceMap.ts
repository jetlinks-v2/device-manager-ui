import { computed, onActivated, onDeactivated, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { debounce } from 'lodash-es'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { getCenterPoint } from '../../../utils/map'
import { deviceMapCardConfig } from '../DeviceMapCard/config'
import type { DashboardCardInfo, DeviceMapConfig, DeviceMapPoint } from '../shared'
import { getComponentConfig } from '../shared'
import { createDeviceMapStream, filterDeviceMapPoints, loadDeviceMapStates } from '../services/deviceMap'
import { createDeviceMapMarkerOptions } from '../DeviceMapCard/markers'
import {
  DEVICE_MAP_MAX_ZOOM,
  resolveClusterDevices,
  shouldOpenDeviceCluster,
  type DeviceClusterPoint
} from '../DeviceMapCard/cluster'
import { useDeviceMapSelection } from './useDeviceMapSelection'
import { useDeviceMapViewport } from './useDeviceMapViewport'

interface AMapApiLike {
  Bounds: new (southWest: unknown, northEast: unknown) => unknown
  LngLat: new (lng: number, lat: number) => unknown
}

/** Owns the location stream, cluster navigation and the selected device card. */
export const useDeviceMap = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>, enabled: Ref<boolean>, container: Ref<HTMLElement | undefined>) => {
  const menu = useMenuStore()
  const canConfigureMap = computed(() => !isEdit.value && menu.hasMenu('system/Basis'))
  /** 配置页沿用当前菜单准入，设计预览不执行导航。 */
  const openMapConfig = () => {
    if (canConfigureMap.value) void menu.jumpPage('system/Basis')
  }
  const config = getComponentConfig<DeviceMapConfig>(
    info,
    'deviceMapCard',
    deviceMapCardConfig.componentProps.deviceMapCard
  )
  const points = shallowRef<DeviceMapPoint[]>([])
  const loading = ref(false)
  const error = ref(false)
  const stateError = ref(false)
  const active = ref(true)
  const distribution = computed(() => config.value.presentation === 'distribution')
  const available = computed(() => active.value && (distribution.value || enabled.value))
  const selection = useDeviceMapSelection(deviceId => viewport.remember(deviceId))
  const viewport = useDeviceMapViewport(
    computed(() => JSON.stringify([info.value?.id, config.value.scope])),
    container,
    computed(() => selection.view.position),
  )
  const { map, popup, onMapInit } = viewport
  const extraOptions = computed(() => createDeviceMapMarkerOptions(!!config.value.showStatus))
  let stream: { close: () => void } | undefined
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let requestId = 0
  let statesController: AbortController | undefined
  let pendingPoints: DeviceMapPoint[] = []

  const closeStreamLater = debounce(() => {
    void finishLocations()
  }, 1000)

  const stopStream = () => {
    requestId += 1
    closeStreamLater.cancel()
    stream?.close()
    stream = undefined
    statesController?.abort()
    statesController = undefined
  }
  const stopRefreshTimer = () => {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = undefined
  }

  /** 重新校验位置后恢复原设备摘要，同时保留同坐标设备的列表入口。 */
  function restoreSelection() {
    const restored = viewport.takeRestoredSelection(points.value)
    if (!restored) return
    selection.open(restored.points)
    selection.selectDevice(restored.device)
  }

  /** 位置信息完成后再补齐状态；旧连接回调及旧状态响应均不能覆盖新的项目或刷新。 */
  async function finishLocations() {
    stopStream()
    const currentRequestId = requestId
    const locations = pendingPoints
    const deviceTerms = config.value.deviceTerms
    if (!locations.length || (deviceTerms === undefined && !distribution.value && !config.value.showStatus)) {
      restoreSelection()
      loading.value = false
      return
    }
    const controller = new AbortController()
    statesController = controller
    try {
      if (deviceTerms !== undefined) {
        // 分类校验完成前不发布流中的点位，失败也不能回退为全部设备。
        const filtered = await filterDeviceMapPoints(locations, deviceTerms, controller.signal)
        if (currentRequestId !== requestId || controller.signal.aborted) return
        points.value = filtered
      }
    } catch {
      if (currentRequestId === requestId && !controller.signal.aborted) {
        points.value = []
        error.value = true
        loading.value = false
      }
      return
    }
    restoreSelection()
    try {
      if ((!distribution.value && !config.value.showStatus) || !points.value.length) return
      const result = await loadDeviceMapStates(points.value, controller.signal)
      if (currentRequestId !== requestId || controller.signal.aborted) return
      points.value = result.points
      stateError.value = result.failed
    } catch {
      if (currentRequestId === requestId && !controller.signal.aborted) stateError.value = true
    } finally {
      if (currentRequestId === requestId && !controller.signal.aborted) loading.value = false
    }
  }

  const refresh = () => {
    stopStream()
    selection.close()
    pendingPoints = []
    if (isEdit.value || !available.value) {
      points.value = []
      loading.value = false
      error.value = false
      stateError.value = false
      return
    }
    const currentRequestId = requestId
    const devices = new Map<string, DeviceMapPoint>()
    points.value = []
    loading.value = true
    error.value = false
    stateError.value = false
    stream = createDeviceMapStream({
      onMessage: (nextPoints) => {
        if (currentRequestId !== requestId) return
        // Different devices may have identical names and coordinates; only identity deduplicates them.
        nextPoints.forEach((item) => devices.set(item.deviceId, item))
        pendingPoints = [...devices.values()]
        if (config.value.deviceTerms === undefined) points.value = pendingPoints
        closeStreamLater()
      },
      onComplete: () => {
        if (currentRequestId !== requestId) return
        void finishLocations()
      },
      onError: () => {
        if (currentRequestId !== requestId) return
        error.value = true
        void finishLocations()
      }
    })
  }

  /** 同坐标设备继续复用原选择卡，避免一个点覆盖其他设备后无法查看。 */
  const onPointSelect = (deviceId: string) => {
    if (isEdit.value || !available.value) return
    const point = points.value.find(item => item.deviceId === deviceId)
    if (point) selection.open(points.value.filter(item => item.lnglat[0] === point.lnglat[0] && item.lnglat[1] === point.lnglat[1]))
  }
  const onClusterClick = ({ clusterData }: { clusterData: DeviceClusterPoint[] }) => {
    if (isEdit.value || !enabled.value || !map.value) return
    // 聚合回调可能只保留坐标和身份，摘要仍使用本轮完整点位中的设备状态。
    const byId = new Map(points.value.map(point => [point.deviceId, point]))
    const devices = resolveClusterDevices(clusterData).map(point => byId.get(point.deviceId) || point)
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
    [config, isEdit, available],
    ([currentConfig, currentEdit, currentEnabled]) => {
      stopRefreshTimer()
      if (currentEdit || !currentEnabled) {
        stopStream()
        selection.close()
        points.value = []
        loading.value = false
        error.value = false
        stateError.value = false
        return
      }
      refresh()
      if (currentConfig.isAutoRefresh && Number(currentConfig.interval) > 0) {
        refreshTimer = setInterval(refresh, Number(currentConfig.interval) * 1000)
      }
    },
    { immediate: true, deep: true }
  )

  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false })
  onUnmounted(() => {
    stopRefreshTimer()
    stopStream()
  })
  return { config, distribution, points, loading, error, stateError, extraOptions, selection, popup, refresh, onMapInit, onClusterClick, onPointSelect, canConfigureMap, openMapConfig }
}
