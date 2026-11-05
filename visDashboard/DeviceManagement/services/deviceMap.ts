import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { EventSourcePolyfill } from 'event-source-polyfill'
import { cloneDeep } from 'lodash-es'
import type { DeviceMapPoint } from '../shared'
import type { DeviceQueryTerm } from '../../../api/device'
import { queryDeviceInstanceStates } from '../../../api/deviceInstanceMonitoring'
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

/** 按真实设备条件过滤位置，ID 批次与调用方条件始终为 AND；任一批次失败都不返回未过滤位置。 */
export async function filterDeviceMapPoints(
  points: DeviceMapPoint[],
  deviceTerms: readonly DeviceQueryTerm[],
  signal: AbortSignal,
): Promise<DeviceMapPoint[]> {
  const allowed = new Set<string>()
  // 条件属于本次查询快照，父页面后续原地修改配置不能混入未完成的批次。
  const terms = cloneDeep(deviceTerms)
  for (let offset = 0; offset < points.length; offset += 100) {
    if (signal.aborted) throw new Error('Device map query cancelled')
    const ids = points.slice(offset, offset + 100).map(point => point.deviceId)
    const response = await queryDeviceInstanceStates({
      paging: false,
      includes: ['id'],
      terms: [
        { column: 'id', termType: 'in', value: ids },
        ...(terms.length ? [{ type: 'and', terms }] : []),
      ],
    }, { signal, hiddenError: true })
    const source = response as unknown as { success?: boolean; status?: number; result?: unknown }
    if (source?.success === false || (typeof source?.status === 'number' && source.status >= 400)) {
      throw new Error('Device map scope query failed')
    }
    const result = source && 'result' in source ? source.result : source
    const page = result && typeof result === 'object' ? result as { data?: unknown; total?: unknown } : undefined
    const rows = Array.isArray(result) ? result : page?.data
    if (!Array.isArray(rows) || Number(page?.total) > rows.length) throw new Error('Incomplete device map scope response')
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id) {
        throw new Error('Missing device map scope identity')
      }
      if (ids.includes(row.id)) allowed.add(row.id)
    }
  }
  if (signal.aborted) throw new Error('Device map query cancelled')
  return points.filter(point => allowed.has(point.deviceId))
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
