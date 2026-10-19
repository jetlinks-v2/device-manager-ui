import type { DeviceMapPoint } from '../shared'

// AMapComponent permits zooms [3, 20]. Keep aggregation enabled at the last level.
export const DEVICE_MAP_MAX_ZOOM = 20
export const DEVICE_MAP_GRID_SIZE = 60

export interface DeviceClusterPoint {
  deviceId?: string
  label?: string
  lnglat?: { lng?: number; lat?: number } | [number, number]
}

/** AMap changes tuple coordinates into LngLat objects in cluster callbacks. */
export function resolveClusterDevices(data: DeviceClusterPoint[]): DeviceMapPoint[] {
  const devices = new Map<string, DeviceMapPoint>()
  for (const item of data) {
    const value = item.lnglat
    const lng = Array.isArray(value) ? value[0] : value?.lng
    const lat = Array.isArray(value) ? value[1] : value?.lat
    if (!item.deviceId || !Number.isFinite(lng) || !Number.isFinite(lat)) continue
    devices.set(item.deviceId, {
      deviceId: item.deviceId,
      label: item.label || item.deviceId,
      lnglat: [Number(lng), Number(lat)]
    })
  }
  return [...devices.values()]
}

/** Equal coordinates cannot separate at any zoom; other clusters expand until the map limit. */
export function shouldOpenDeviceCluster(points: DeviceMapPoint[], zoom: number): boolean {
  return (
    points.length <= 1 ||
    zoom >= DEVICE_MAP_MAX_ZOOM ||
    points.every((point) => point.lnglat[0] === points[0].lnglat[0] && point.lnglat[1] === points[0].lnglat[1])
  )
}
