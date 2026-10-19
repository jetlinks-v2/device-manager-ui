import markerPng from '@device-manager-ui/assets/marker.png'
import { DEVICE_MAP_GRID_SIZE, DEVICE_MAP_MAX_ZOOM } from './cluster'

interface MarkerContext {
  count: number
  marker: {
    setOffset: (offset: unknown) => void
    setContent: (content: HTMLElement) => void
    setAnchor: (anchor: string) => void
  }
  data: Array<{ label?: string }>
}

/** Build marker DOM using textContent so device names are never interpreted as HTML. */
export function createDeviceMapMarkerOptions() {
  const getPixel = (x: number, y: number) => {
    const api = (window as Window & { AMap?: { Pixel: new (x: number, y: number) => unknown } }).AMap
    return api ? new api.Pixel(x, y) : undefined
  }
  return {
    gridSize: DEVICE_MAP_GRID_SIZE,
    maxZoom: DEVICE_MAP_MAX_ZOOM + 1,
    zoomOnClick: false,
    renderClusterMarker(context: MarkerContext) {
      const content = document.createElement('div')
      content.className = 'device-dashboard-cluster'
      content.textContent = String(context.count)
      context.marker.setOffset(getPixel(-22, -22))
      context.marker.setContent(content)
    },
    renderMarker(context: MarkerContext) {
      const content = document.createElement('div')
      content.className = 'device-dashboard-marker-content'
      const label = document.createElement('span')
      label.className = 'device-dashboard-marker-label'
      label.textContent = context.data[0]?.label || ''
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
