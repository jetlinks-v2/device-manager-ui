import type { ComputedRef } from 'vue'
import { ref, watch } from 'vue'
import type { Dayjs } from 'dayjs'

import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

type TimeRange = [Dayjs, Dayjs] | undefined

export interface IotDevicePropertyTrajectoryPath {
  name: string
  path: number[][]
}

interface IotDevicePropertyTrajectoryOptions {
  deviceId: ComputedRef<string>
  property: ComputedRef<RealtimePropertyRow | null>
  timeRange: ComputedRef<TimeRange>
}

export function useIotDevicePropertyTrajectory(options: IotDevicePropertyTrajectoryOptions) {
  const loading = ref(false)
  const trajectory = ref<IotDevicePropertyTrajectoryPath[]>([])
  let latestRequest = 0

  async function queryTrajectory() {
    const property = options.property.value
    const timeRange = options.timeRange.value
    if (!options.deviceId.value || !property?.identifier || !timeRange?.[0] || !timeRange?.[1]) {
      trajectory.value = []
      return
    }

    // 切换属性或时间范围时可能有旧请求尚未返回，避免其覆盖当前轨迹。
    const requestId = ++latestRequest
    loading.value = true
    try {
      const resp = await iotDeviceDetailRealApi.queryPropertyNoPaging(options.deviceId.value, property.identifier, {
        paging: false,
        terms: [{
          column: 'timestamp',
          termType: 'btw',
          value: timeRange.map((item) => item.valueOf()),
        }],
        sorts: [{ name: 'timestamp', order: 'asc' }],
      })
      if (requestId !== latestRequest) return

      const path = extractRows(resp?.result)
        .map(resolveRowCoordinate)
        .filter((item): item is number[] => Boolean(item))
      trajectory.value = path.length ? [{ name: property.name || property.identifier, path }] : []
    } catch {
      if (requestId === latestRequest) trajectory.value = []
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  watch(
    () => [
      options.deviceId.value,
      options.property.value?.identifier,
      options.timeRange.value?.[0]?.valueOf(),
      options.timeRange.value?.[1]?.valueOf(),
    ],
    () => {
      void queryTrajectory()
    },
    { immediate: true },
  )

  return { loading, trajectory }
}

function resolveRowCoordinate(row: unknown): number[] | undefined {
  if (!row || typeof row !== 'object') return undefined
  const source = row as Record<string, unknown>
  return [
    source.value,
    source.formatValue,
    source.originValue,
    source.numberValue,
    source.data,
    source,
  ].map(resolveCoordinate).find((item): item is number[] => Boolean(item))
}

function resolveCoordinate(source: unknown): number[] | undefined {
  if (Array.isArray(source) && source.length >= 2) {
    return createCoordinate(source[0], source[1])
  }
  if (typeof source === 'string') {
    const value = source.trim()
    if (!value) return undefined
    try {
      return resolveCoordinate(JSON.parse(value))
    } catch {
      const [lng, lat] = value.split(',').map((item) => item.trim())
      return createCoordinate(lng, lat)
    }
  }
  if (!source || typeof source !== 'object') return undefined

  const value = source as Record<string, unknown>
  const coordinate = createCoordinate(
    value.lng ?? value.lon ?? value.longitude,
    value.lat ?? value.latitude,
  )
  if (coordinate) return coordinate

  // 兼容历史记录中坐标被包装在 value、data 或 coordinates 字段的格式。
  return [
    value.coordinates,
    value.coordinate,
    value.geoPoint,
    value.location,
    value.value,
    value.formatValue,
    value.originValue,
    value.data,
  ].map(resolveCoordinate).find((item): item is number[] => Boolean(item))
}

function createCoordinate(lngValue: unknown, latValue: unknown): number[] | undefined {
  if (lngValue === null || lngValue === undefined || lngValue === '' || latValue === null || latValue === undefined || latValue === '') {
    return undefined
  }
  const lng = Number(lngValue)
  const lat = Number(latValue)
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return undefined
  }
  return [lng, lat]
}
