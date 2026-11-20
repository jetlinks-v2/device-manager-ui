import type { DeviceMapPoint } from '../shared'

export const DEVICE_MAP_MAX_ZOOM = 20
export const DEVICE_MAP_CLUSTER_MAX_ZOOM = DEVICE_MAP_MAX_ZOOM - 1
export const DEVICE_MAP_GRID_SIZE = 60

export interface DeviceMapMarker extends DeviceMapPoint {
  locationKey: string
  deviceCount: number
}

export function groupDevicesByLocation(points: DeviceMapPoint[]) {
  const locations = new Map<string, DeviceMapPoint[]>()
  for (const point of points) {
    const key = point.lnglat.join(',')
    const devices = locations.get(key)
    if (devices) devices.push(point)
    else locations.set(key, [point])
  }
  return locations
}

/** 高德会改写 lnglat。普通聚合每台设备传一个副本，停止聚合后每个坐标传一个标记。 */
export function toDeviceMapMarkers(locations: Map<string, DeviceMapPoint[]>, groupedByPosition: boolean) {
  const markers: DeviceMapMarker[] = []
  for (const [locationKey, devices] of locations) {
    const visible = groupedByPosition ? [devices[0]] : devices
    for (const point of visible) {
      markers.push({ ...point, lnglat: [...point.lnglat], locationKey, deviceCount: devices.length })
    }
  }
  return markers
}
