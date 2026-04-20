import dayjs from 'dayjs'
import { encodeQuery } from '@jetlinks-web-core/utils'
import { dashboard, deviceCount, productCount } from '@device-manager-ui/api/dashboard'
import type {
  DeviceMessageChartData,
  ImageMetricData,
  TimeRangePayload,
  TimeShortcut,
  TrendMetricData
} from '../shared.ts'

type DashboardResponseItem = {
  group?: string
  data?: {
    value?: number
    timeString?: string
  }
}

type CountType = 'all' | 'normal' | 'disabled' | 'online' | 'offline' | 'current' | 'today'

const ensureSuccess = <T>(response: { status?: number; result?: T; message?: string } | undefined): T => {
  if (response?.status !== 200) {
    throw new Error(response?.message || '数据加载失败')
  }

  return (response.result ?? null) as T
}

const toNumber = (value: unknown) => Number(value || 0)

const reverseSeries = (items: DashboardResponseItem[]) => {
  const list = [...items].reverse()

  return {
    xData: list.map((item) => item.data?.timeString || ''),
    yData: list.map((item) => toNumber(item.data?.value))
  }
}

const getCurrentDayRange = () => ({
  from: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  to: dayjs().format('YYYY-MM-DD HH:mm:ss')
})

const getYesterdayRange = () => ({
  from: dayjs().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  to: dayjs().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss')
})

const getProductCountByType = async (type: CountType) => {
  const termsMap: Record<string, Record<string, unknown>> = {
    all: {},
    normal: {
      terms: [
        {
          column: 'state',
          value: '1'
        }
      ]
    },
    disabled: {
      terms: [
        {
          column: 'state',
          value: '0'
        }
      ]
    }
  }

  return toNumber(ensureSuccess<number>(await productCount(termsMap[type] || {})))
}

const getDeviceCountByType = async (type: CountType) => {
  const queryMap: Record<string, ReturnType<typeof encodeQuery> | undefined> = {
    all: undefined,
    online: encodeQuery({ terms: { state: 'online' } }),
    offline: encodeQuery({ terms: { state: 'offline' } })
  }

  return toNumber(ensureSuccess<number>(await deviceCount(queryMap[type])))
}

export const fetchProductCountCardData = async (type: 'all' | 'normal' | 'disabled'): Promise<ImageMetricData> => {
  const primary = await getProductCountByType(type)

  if (type !== 'all') {
    return {
      primary,
      secondary: '--',
      tertiary: '--'
    }
  }

  const [secondary, tertiary] = await Promise.all([
    getProductCountByType('normal'),
    getProductCountByType('disabled')
  ])

  return {
    primary,
    secondary,
    tertiary
  }
}

export const fetchDeviceCountCardData = async (type: 'all' | 'online' | 'offline'): Promise<ImageMetricData> => {
  const primary = await getDeviceCountByType(type)

  if (type !== 'all') {
    return {
      primary,
      secondary: '--',
      tertiary: '--'
    }
  }

  const [secondary, tertiary] = await Promise.all([
    getDeviceCountByType('online'),
    getDeviceCountByType('offline')
  ])

  return {
    primary,
    secondary,
    tertiary
  }
}

export const fetchOnlineCountCardData = async (type: 'all' | 'current'): Promise<TrendMetricData> => {
  const currentRange = getCurrentDayRange()
  const yesterdayRange = getYesterdayRange()

  const [currentCount, dashboardResult] = await Promise.all([
    getDeviceCountByType('online'),
    ensureSuccess<DashboardResponseItem[]>(
      await dashboard([
        {
          dashboard: 'device',
          object: 'session',
          measurement: 'online',
          dimension: 'agg',
          group: 'trend',
          params: {
            state: 'online',
            limit: 24,
            from: currentRange.from,
            to: currentRange.to,
            time: '1h',
            format: 'yyyy-MM-dd HH:mm:ss'
          }
        },
        {
          dashboard: 'device',
          object: 'session',
          measurement: 'online',
          dimension: 'agg',
          group: 'yesterday',
          params: {
            state: 'online',
            limit: 24,
            from: yesterdayRange.from,
            to: yesterdayRange.to,
            time: '1d',
            format: 'yyyy-MM-dd HH:mm:ss'
          }
        }
      ])
    )
  ])

  const trendSeries = reverseSeries(dashboardResult.filter((item) => item.group === 'trend'))
  const yesterdayValue = dashboardResult.find((item) => item.group === 'yesterday')?.data?.value ?? 0

  return {
    primary: currentCount,
    secondary: type === 'all' ? toNumber(yesterdayValue) : '--',
    xData: trendSeries.xData,
    yData: trendSeries.yData
  }
}

export const fetchMessageVolumeCardData = async (type: 'all' | 'today'): Promise<TrendMetricData> => {
  const currentRange = getCurrentDayRange()

  const result = ensureSuccess<DashboardResponseItem[]>(
    await dashboard([
      {
        dashboard: 'device',
        object: 'message',
        measurement: 'quantity',
        dimension: 'agg',
        group: 'todayTrend',
        params: {
          time: '1h',
          format: 'yyyy-MM-dd HH:mm:ss',
          limit: 24,
          from: currentRange.from,
          to: currentRange.to
        }
      },
      {
        dashboard: 'device',
        object: 'message',
        measurement: 'quantity',
        dimension: 'agg',
        group: 'todayTotal',
        params: {
          time: '1d',
          format: 'yyyy-MM-dd',
          from: 'now-1d'
        }
      },
      {
        dashboard: 'device',
        object: 'message',
        measurement: 'quantity',
        dimension: 'agg',
        group: 'monthTotal',
        params: {
          time: '1M',
          format: 'yyyy-MM',
          limit: 1,
          from: 'now-1M'
        }
      }
    ])
  )

  const trendSeries = reverseSeries(result.filter((item) => item.group === 'todayTrend'))
  const todayTotal = result.find((item) => item.group === 'todayTotal')?.data?.value ?? 0
  const monthTotal = result.find((item) => item.group === 'monthTotal')?.data?.value ?? 0

  return {
    primary: toNumber(todayTotal),
    secondary: type === 'all' ? toNumber(monthTotal) : '--',
    xData: trendSeries.xData,
    yData: trendSeries.yData
  }
}

export const fetchOnlineRateCardData = async (): Promise<TrendMetricData> => {
  const currentRange = getCurrentDayRange()

  const [totalCount, onlineCount, result] = await Promise.all([
    getDeviceCountByType('all'),
    getDeviceCountByType('online'),
    ensureSuccess<DashboardResponseItem[]>(
      await dashboard([
        {
          dashboard: 'device',
          object: 'session',
          measurement: 'online',
          dimension: 'agg',
          group: 'trend',
          params: {
            state: 'online',
            limit: 24,
            from: currentRange.from,
            to: currentRange.to,
            time: '1h',
            format: 'yyyy-MM-dd HH:mm:ss'
          }
        }
      ])
    )
  ])

  const trendSeries = reverseSeries(result.filter((item) => item.group === 'trend'))
  const rate = totalCount > 0 ? Number((((onlineCount / totalCount) * 100) || 0).toFixed(2)) : 0

  return {
    primary: `${rate}%`,
    secondary: `${onlineCount} / ${totalCount}`,
    xData: trendSeries.xData,
    yData: trendSeries.yData.map((value) =>
      totalCount > 0 ? Number((((value / totalCount) * 100) || 0).toFixed(2)) : 0
    )
  }
}

const resolveMessageQuery = (range: TimeRangePayload) => {
  const duration = range.end - range.start
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  const year = 365 * day
  const month = 30 * day

  let time = '1m'
  let format = 'HH:mm'
  let limit = 60

  if (duration > hour && duration <= day) {
    time = '1h'
    format = 'yyyy-MM-dd HH:mm:ss'
    limit = 24
  } else if (duration > day && duration < year) {
    time = '1d'
    format = 'yyyy-MM-dd'
    limit = Math.abs(Math.ceil(duration / day)) + 1
  } else if (duration >= year) {
    time = '1M'
    format = 'yyyy-MM'
    limit = Math.abs(Math.floor(duration / month))
  }

  return {
    time,
    format,
    limit
  }
}

export const getShortcutRange = (type: TimeShortcut): TimeRangePayload => {
  const end = dayjs().valueOf()

  switch (type) {
    case 'hour':
      return {
        start: dayjs().startOf('day').valueOf(),
        end,
        type
      }
    case 'day':
      return {
        start: dayjs().subtract(24, 'hour').valueOf(),
        end,
        type
      }
    case 'week':
    default:
      return {
        start: dayjs().subtract(6, 'day').startOf('day').valueOf(),
        end,
        type: 'week'
      }
  }
}

export const fetchDeviceMessageChartData = async (range: TimeRangePayload): Promise<DeviceMessageChartData> => {
  const query = resolveMessageQuery(range)
  const result = ensureSuccess<DashboardResponseItem[]>(
    await dashboard([
      {
        dashboard: 'device',
        object: 'message',
        measurement: 'quantity',
        dimension: 'agg',
        group: 'deviceMessage',
        params: {
          time: query.time,
          format: query.format,
          limit: query.limit,
          from: range.start,
          to: range.end
        }
      }
    ])
  )

  const trendSeries = reverseSeries(result)

  return {
    xData: trendSeries.xData,
    yData: trendSeries.yData
  }
}
