import { TOKEN_KEY, TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { LocalStore } from '@jetlinks-web/utils'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { EventSourcePolyfill } from 'event-source-polyfill'
import type { DeviceMapPoint } from '../shared'

interface DeviceGeoJsonFeature {
  geometry?: {
    coordinates?: unknown
  }
  properties?: {
    deviceName?: unknown
  }
}

interface DeviceGeoJsonPayload {
  features?: DeviceGeoJsonFeature[]
}

const isLngLat = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]))

const normalizeFeature = (feature: DeviceGeoJsonFeature): DeviceMapPoint | undefined => {
  const coordinates = feature.geometry?.coordinates

  if (!isLngLat(coordinates)) {
    return undefined
  }

  return {
    lnglat: [Number(coordinates[0]), Number(coordinates[1])],
    label: String(feature.properties?.deviceName || '')
  }
}

const parseDeviceGeoJson = (payload: string): DeviceMapPoint[] => {
  try {
    const data = JSON.parse(payload) as DeviceGeoJsonPayload

    if (!Array.isArray(data.features)) {
      return []
    }

    return data.features
      .map(normalizeFeature)
      .filter((item): item is DeviceMapPoint => !!item)
  } catch {
    return []
  }
}

export const createDeviceMapStream = (handlers: {
  onMessage: (points: DeviceMapPoint[]) => void
  onError: () => void
}) => {
  const source = new EventSourcePolyfill(
    `${getBaseApi()}/geo/object/device/_search/geo.json?${TOKEN_KEY_URL}=${LocalStore.get(TOKEN_KEY)}&filter.paging=false`
  )

  source.onmessage = (event: MessageEvent<string>) => {
    handlers.onMessage(parseDeviceGeoJson(event.data))
  }

  source.onerror = () => {
    handlers.onError()
  }

  return source
}
