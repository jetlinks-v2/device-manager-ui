import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { EventSourcePolyfill } from 'event-source-polyfill'
import type { DeviceMapPoint } from '../shared'
import { loadDeviceStates } from '../../../dataCapabilities/deviceInstanceMonitoring.service'

interface DeviceGeoJsonFeature {
  geometry?: {
    coordinates?: unknown
  }
  properties?: {
    deviceName?: unknown
    objectId?: unknown
  }
}

interface DeviceGeoJsonPayload {
  features?: DeviceGeoJsonFeature[]
}

const isLngLat = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  Math.abs(value[0]) <= 180 &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]) &&
  Math.abs(value[1]) <= 90

const normalizeFeature = (feature: DeviceGeoJsonFeature): DeviceMapPoint | undefined => {
  const coordinates = feature.geometry?.coordinates
  const deviceId = feature.properties?.objectId

  if (!isLngLat(coordinates) || typeof deviceId !== 'string' || !deviceId.trim()) {
    return undefined
  }

  return {
    // GeoObject.id identifies a location record; objectId identifies the actual device.
    deviceId,
    lnglat: [Number(coordinates[0]), Number(coordinates[1])],
    label: String(feature.properties?.deviceName || '')
  }
}

export const parseDeviceGeoJson = (payload: string): DeviceMapPoint[] => {
  try {
    const data = JSON.parse(payload) as DeviceGeoJsonPayload

    if (!Array.isArray(data.features)) {
      return []
    }

    return data.features.map(normalizeFeature).filter((item): item is DeviceMapPoint => !!item)
  } catch {
    return []
  }
}

/** 位置接口不带状态，复用设备状态查询分批补齐；失败批次保留位置并标为未知。 */
export async function loadDeviceMapStates(points: DeviceMapPoint[], signal: AbortSignal) {
  const result: DeviceMapPoint[] = []
  let failed = false
  for (let offset = 0; offset < points.length; offset += 100) {
    if (signal.aborted) throw new Error('Device map query cancelled')
    const batch = points.slice(offset, offset + 100)
    try {
      const states = await loadDeviceStates({ deviceIds: batch.map(point => point.deviceId) }, signal)
      const byId = new Map(states.map(state => [state.deviceId, state]))
      result.push(...batch.map(point => ({ ...point, state: byId.get(point.deviceId)?.state,
        stateText: byId.get(point.deviceId)?.stateText })))
    } catch (error) {
      if (signal.aborted) throw error
      failed = true
      result.push(...batch.map(point => ({ ...point, state: undefined, stateText: undefined })))
    }
  }
  if (signal.aborted) throw new Error('Device map query cancelled')
  return { points: result, failed }
}

/** Geo queries are finite streams: a clean EOF completes even when no location was emitted. */
export const createDeviceMapStream = (handlers: {
  onMessage: (points: DeviceMapPoint[]) => void
  onComplete: () => void
  onError: () => void
}) => {
  let opened = false
  const source = new EventSourcePolyfill(
    `${getBaseApi()}/geo/object/device/_search/geo.json?${TOKEN_KEY_URL}=${getToken()}&filter.paging=false`
  )

  source.onopen = () => {
    opened = true
  }

  source.onmessage = (event: MessageEvent<string>) => {
    handlers.onMessage(parseDeviceGeoJson(event.data))
  }

  source.onerror = (event: Event & { error?: unknown }) => {
    // The polyfill reports clean EOF through onerror with a null/undefined error.
    // An accepted SSE response is required so HTTP/protocol failures stay failures.
    source.close()
    if (opened && 'error' in event && event.error == null) {
      handlers.onComplete()
    } else {
      handlers.onError()
    }
  }

  return source
}
