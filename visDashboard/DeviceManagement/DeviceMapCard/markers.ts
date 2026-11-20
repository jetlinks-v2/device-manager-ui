import markerPng from '@device-manager-ui/assets/marker.png'
import { DEVICE_MAP_CLUSTER_MAX_ZOOM, DEVICE_MAP_GRID_SIZE, type DeviceMapMarker } from './cluster'
import { distributionColors, distributionState } from './deviceMapStatus'

interface MarkerContext {
  count: number
  marker: {
    setExtData: (data: { locationKey: string }) => void
    setOffset: (offset: unknown) => void
    setContent: (content: HTMLElement) => void
    setAnchor: (anchor: string) => void
  }
}

/** Build marker DOM using textContent so device names are never interpreted as HTML. */
export function createDeviceMapMarkerOptions(showStatus = false) {
  const getPixel = (x: number, y: number) => {
    const api = (window as Window & { AMap?: { Pixel: new (x: number, y: number) => unknown } }).AMap
    return api ? new api.Pixel(x, y) : undefined
  }
  const renderCount = (marker: MarkerContext['marker'], count: number) => {
    const content = document.createElement('div')
    content.className = 'device-dashboard-cluster'
    content.textContent = String(count)
    marker.setAnchor('center')
    marker.setOffset(getPixel(0, 0))
    marker.setContent(content)
  }
  return {
    gridSize: DEVICE_MAP_GRID_SIZE,
    maxZoom: DEVICE_MAP_CLUSTER_MAX_ZOOM,
    zoomOnClick: false,
    renderClusterMarker(context: MarkerContext) {
      renderCount(context.marker, context.count)
    },
    renderMarker(context: Pick<MarkerContext, 'marker'> & { data: DeviceMapMarker[] }) {
      const point = context.data[0]
      // 高德停止聚合后点击事件的 clusterData 为空，只回传绘制的 marker。
      context.marker.setExtData({ locationKey: point.locationKey })
      if (point.deviceCount > 1) {
        renderCount(context.marker, point.deviceCount)
        return
      }
      const content = document.createElement('div')
      content.className = 'device-dashboard-marker-content'
      if (showStatus) {
        const state = distributionState(point)
        const dot = document.createElement('span')
        dot.className = `device-dashboard-marker-dot is-${state}`
        dot.style.backgroundColor = distributionColors[state]
        content.title = [point.label, point.stateText].filter(Boolean).join(' · ')
        content.append(dot)
        context.marker.setContent(content)
        context.marker.setAnchor('center')
        context.marker.setOffset(getPixel(0, 0))
        return
      }
      const label = document.createElement('span')
      label.className = 'device-dashboard-marker-label'
      label.textContent = point.label
      const image = document.createElement('img')
      image.src = markerPng
      image.alt = ''
      image.style.cssText = 'height:34px;width:25px'
      content.append(label, image)
      context.marker.setContent(content)
      context.marker.setAnchor('bottom-center')
      context.marker.setOffset(getPixel(0, 3))
    }
  }
}
