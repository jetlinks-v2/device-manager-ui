import dayjs from 'dayjs'
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

export interface PropertySparklinePoint {
  time: number | string
  value: number
}

const AGG = 'AVG'
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
  let requestTicket = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const numericVisibleProperties = computed(() =>
    visibleProperties.value.filter((property) => isNumericProperty(property)),
  )

  function getSparklineRows(property: RealtimePropertyRow) {
    return sparklineRows.value[property.identifier] || []
  }

  function scheduleLoad() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void loadRows()
    }, 120)
  }

  async function loadRows() {
    const properties = numericVisibleProperties.value
    if (!deviceId.value || !properties.length) {
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
    } finally {
      if (currentTicket === requestTicket) loading.value = false
    }
  }

  watch(
    () => [deviceId.value, timeRange.value, numericVisibleProperties.value.map((item) => item.identifier).join('|')],
    scheduleLoad,
    { immediate: true },
  )

  return {
    getSparklineRows,
  }
}

function isNumericProperty(property: RealtimePropertyRow) {
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
      .slice(-12)
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
