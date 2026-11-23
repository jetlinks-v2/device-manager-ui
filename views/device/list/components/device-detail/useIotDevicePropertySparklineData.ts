import dayjs from 'dayjs'
import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { splitPropertyValueAndUnit } from './iotDevicePropertyDisplay'

export interface PropertySparklinePoint {
  time: number | string
  value: number
}

const AGG = 'AVG'
const MAX_POINTS = 12
export type PropertySparklineRange = '1h' | '24h' | '7d'

interface SparklineQueryRange {
  from: number
  to: number
  interval: '1m' | '1h' | '1d'
  format: string
}

export function useIotDevicePropertySparklineData(
  deviceId: ComputedRef<string>,
  visibleProperties: Ref<RealtimePropertyRow[]>,
  timeRange: Ref<PropertySparklineRange>,
) {
  const loading = ref(false)
  const sparklineRows = ref<Record<string, PropertySparklinePoint[]>>({})
  const realtimeRows = ref<Record<string, PropertySparklinePoint[]>>({})
  let requestTicket = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const numericVisibleProperties = computed(() =>
    visibleProperties.value.filter((property) => isNumericProperty(property)),
  )

  function getSparklineRows(property: RealtimePropertyRow) {
    return mergeRows(
      sparklineRows.value[property.identifier] || [],
      realtimeRows.value[property.identifier] || [],
    )
  }

  // 历史聚合与实时上报独立保存，查询返回时不能覆盖等待期间收到的点。
  function scheduleLoad() {
    ++requestTicket
    if (timer) clearTimeout(timer)
    sparklineRows.value = {}
    realtimeRows.value = {}
    appendRealtimeRows(numericVisibleProperties.value)
    timer = setTimeout(() => {
      timer = undefined
      void loadRows()
    }, 120)
  }

  // 按原始上报时间去重，保留连续上报；无上报时间或非数值不能伪造趋势点。
  function appendRealtimeRows(properties: RealtimePropertyRow[]) {
    properties.forEach((property) => {
      const value = Number(splitPropertyValueAndUnit(property.value, property.unit).value)
      const time = property.timestamp ?? dayjs(property.updatedAt).valueOf()
      if (!Number.isFinite(value) || !Number.isFinite(time)) return
      realtimeRows.value[property.identifier] = mergeRows(
        realtimeRows.value[property.identifier] || [],
        [{ time, value }],
      )
    })
  }

  // 实时点覆盖同一时间的历史点，按所选时间范围和卡片点数限制内存。
  function mergeRows(...sources: PropertySparklinePoint[][]) {
    const { from, to } = getTimeRange(timeRange.value)
    const points = new Map<number, PropertySparklinePoint>()
    sources.flat().forEach((point) => {
      const time = dayjs(point.time).valueOf()
      if (time >= from && time <= to) points.set(time, point)
    })
    return [...points.entries()]
      .sort(([left], [right]) => left - right)
      .slice(-MAX_POINTS)
      .map(([, point]) => point)
  }

  async function loadRows() {
    const properties = numericVisibleProperties.value
    if (!deviceId.value || !properties.length) {
      loading.value = false
      sparklineRows.value = {}
      return
    }

    const currentTicket = ++requestTicket
    loading.value = true
    try {
      const range = getTimeRange(timeRange.value)
      const resp: any = await iotDeviceDetailRealApi.queryPropertyAggregation(deviceId.value, {
        columns: properties.map((property) => ({
          property: property.identifier,
          alias: property.identifier,
          agg: AGG,
        })),
        query: {
          interval: range.interval,
          format: range.format,
          from: range.from,
          to: range.to,
        },
      })

      if (currentTicket !== requestTicket) return
      sparklineRows.value = mapAggregationRows(extractRows(resp?.result), properties)
    } catch {
      // 历史查询失败仍保留已收到的实时趋势。
      if (currentTicket === requestTicket) sparklineRows.value = {}
    } finally {
      if (currentTicket === requestTicket) loading.value = false
    }
  }

  // 属性实时值更新会重建卡片数据，不能把新数组引用误判为趋势查询条件变化。
  watch(
    [
      deviceId,
      timeRange,
      () => numericVisibleProperties.value.map((item) => item.identifier).join('|'),
    ],
    scheduleLoad,
    { immediate: true },
  )

  watch(numericVisibleProperties, appendRealtimeRows, { deep: true })

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
    ++requestTicket
  })

  return {
    getSparklineRows,
  }
}

// 以物模型声明类型判断趋势能力，纯数字文本仍属于非数值属性。
export function isNumericProperty(property: RealtimePropertyRow) {
  return ['int', 'float', 'double', 'long', 'number'].includes(property.valueType?.type || property.dataType || '')
}

function getTimeRange(range: PropertySparklineRange): SparklineQueryRange {
  const end = Date.now()
  if (range === '1h') {
    return {
      from: dayjs(end).subtract(1, 'hour').valueOf(),
      to: end,
      interval: '1m',
      format: 'yyyy-MM-dd HH:mm:ss',
    }
  }
  if (range === '7d') {
    return {
      from: dayjs(end).subtract(7, 'day').valueOf(),
      to: end,
      interval: '1d',
      format: 'yyyy-MM-dd',
    }
  }
  return {
    from: dayjs(end).subtract(24, 'hour').valueOf(),
    to: end,
    interval: '1h',
    format: 'yyyy-MM-dd HH:mm:ss',
  }
}

function mapAggregationRows(rows: any[], properties: RealtimePropertyRow[]) {
  const nextRows: Record<string, PropertySparklinePoint[]> = {}

  properties.forEach((property) => {
    nextRows[property.identifier] = rows
      .map((row) => {
        const value = getAggregationValue(row, property.identifier)
        const time = row?.time ?? row?.timestamp ?? row?.createTime
        const numberValue = Number(value)
        return Number.isFinite(numberValue) && time
          ? { time, value: numberValue }
          : undefined
      })
      .filter((row): row is PropertySparklinePoint => Boolean(row))
      .sort((left, right) => dayjs(left.time).valueOf() - dayjs(right.time).valueOf())
      .slice(-MAX_POINTS)
  })

  return nextRows
}

function getAggregationValue(row: any, property: string) {
  const candidates = [
    property,
    `${property}_${AGG}`,
    `${property}$${AGG}`,
    `${property}_${AGG.toLowerCase()}`,
    `${property}$${AGG.toLowerCase()}`,
    AGG,
    AGG.toLowerCase(),
    'value',
    'numberValue',
  ]
  for (const key of candidates) {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}
