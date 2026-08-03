import { computed, ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'

import { queryDefaultAlarmLevels, queryDeviceAlarmPage } from '../views/device/alarm/api'
import { toDeviceAlarmPageRow } from '../views/device/alarm/utils'
import type { AlarmLevelOption, DeviceAlarmRow } from '../views/device/alarm/types'
import type { DashboardTone, IotAlarmRankRow, RealtimeMessage } from './useIotDeviceWorkbench'
import type { DeviceGroupTrendRange } from '../api/deviceGroup'
import {
  formatApiTime,
  queryActiveDeviceAlarmStats,
  queryDeviceAlarmRank,
  queryDeviceAlarmRecordPage,
  queryDeviceAlarmTrend,
  type AlarmRecordRow,
  type AlarmTrendPoint,
  type ActiveDeviceAlarmStat,
} from '../services/iotDeviceAlarmOverview.service'

const $t = i18n.global.t
export const ALARM_RANK_PAGE_SIZE = 5
export const ALARM_LATEST_PAGE_SIZE = 10
const RANK_QUERY_SIZE = ALARM_RANK_PAGE_SIZE * 3

const defaultLevelOptions = (): AlarmLevelOption[] => [
  { label: $t('DeviceAlarm.level.emergency'), value: 1 },
  { label: $t('DeviceAlarm.level.urgent'), value: 2 },
  { label: $t('DeviceAlarm.level.severity'), value: 3 },
  { label: $t('DeviceAlarm.level.ordinary'), value: 4 },
  { label: $t('DeviceAlarm.level.warn'), value: 5 },
]

export function useIotDeviceAlarmOverview() {
  const configRows = ref<DeviceAlarmRow[]>([])
  const activeDeviceAlarmStats = ref<ActiveDeviceAlarmStat[]>([])
  const trendRows = ref<AlarmTrendPoint[]>([])
  const rankRows = ref<IotAlarmRankRow[]>([])
  const latestRecordRows = ref<AlarmRecordRow[]>([])
  const latestRecordTotal = ref(0)
  const levelOptions = ref<AlarmLevelOption[]>(defaultLevelOptions())
  const loading = ref(false)
  const trendRange = ref<DeviceGroupTrendRange>('24h')
  const rankRange = ref<DeviceGroupTrendRange>('24h')
  const rankPageIndex = ref(0)
  const latestPageIndex = ref(0)
  let requestId = 0

  const total = computed(() => configRows.value.length)
  const urgentCount = computed(() => configRows.value.filter((row) => row.level <= 2).length)
  const activeRecordCount = computed(() => activeDeviceAlarmStats.value.reduce((sum, item) => sum + item.count, 0))
  const recordTotal = computed(() => activeRecordCount.value)
  const alarmDeviceCount = computed(() => activeDeviceAlarmStats.value.length)

  const topTargets = computed<IotAlarmRankRow[]>(() => rankRows.value)

  const levelRows = computed(() => {
    const max = Math.max(1, total.value)
    return levelOptions.value.map((level) => {
      const value = configRows.value.filter((row) => row.level === level.value).length
      return {
        key: `level-${level.value}`,
        label: level.label,
        value,
        detail: level.value <= 2
          ? $t('IotWorkbench.alarm.levelUrgent')
          : $t('IotWorkbench.alarm.levelNormal'),
        icon: level.value <= 2 ? 'lucide:shield-alert' : 'lucide:bell',
        state: levelState(level.value),
        percent: Math.round((value / max) * 100),
      }
    })
  })

  const pagedTopTargets = computed(() => pageRows(topTargets.value, rankPageIndex.value, ALARM_RANK_PAGE_SIZE))
  const latestRecords = computed<RealtimeMessage[]>(() => latestRecordRows.value.map((row) => toRealtimeMessage(row, levelOptions.value)).filter(Boolean))
  const pagedLatestRecords = computed(() => latestRecords.value)
  const rankPageTotal = computed(() => Math.max(1, Math.ceil(topTargets.value.length / ALARM_RANK_PAGE_SIZE)))
  const latestPageTotal = computed(() => Math.max(1, Math.ceil(latestRecordTotal.value / ALARM_LATEST_PAGE_SIZE)))
  const recordTrend = computed(() => trendRows.value)

  async function load() {
    const currentRequest = ++requestId
    loading.value = true
    try {
      const [levels, page, activeStats, trendRecords, rankRecords, latestPage] = await Promise.all([
        queryDefaultAlarmLevels().catch(() => []),
        queryDeviceAlarmPage({
          paging: false,
          sorts: [
            { name: 'modifyTime', order: 'desc' },
            { name: 'createTime', order: 'desc' },
          ],
        }),
        queryActiveDeviceAlarmStats(),
        queryDeviceAlarmTrend(trendRange.value),
        queryDeviceAlarmRank(rankRange.value, RANK_QUERY_SIZE),
        queryDeviceAlarmRecordPage(0, ALARM_LATEST_PAGE_SIZE),
      ])
      if (currentRequest !== requestId) return
      if (levels.length) levelOptions.value = levels
      configRows.value = page.data
        .map(toDeviceAlarmPageRow)
        .filter((item): item is DeviceAlarmRow => Boolean(item))
      resetPages()
      activeDeviceAlarmStats.value = activeStats
      trendRows.value = trendRecords
      rankRows.value = rankRecords
      latestPageIndex.value = latestPage.pageIndex
      latestRecordRows.value = latestPage.data
      latestRecordTotal.value = latestPage.total
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function updateTrendRange(range: DeviceGroupTrendRange) {
    if (trendRange.value === range) return
    trendRange.value = range
    trendRows.value = await queryDeviceAlarmTrend(range)
  }

  async function updateRankRange(range: DeviceGroupTrendRange) {
    if (rankRange.value === range) return
    rankRange.value = range
    rankPageIndex.value = 0
    rankRows.value = await queryDeviceAlarmRank(range, RANK_QUERY_SIZE)
  }

  function changeRankPage(direction: number) {
    rankPageIndex.value = nextPageIndex(rankPageIndex.value, rankPageTotal.value, direction)
  }

  async function changeLatestPage(direction: number) {
    const nextPage = nextPageIndex(latestPageIndex.value, latestPageTotal.value, direction)
    const page = await queryDeviceAlarmRecordPage(nextPage, ALARM_LATEST_PAGE_SIZE)
    latestPageIndex.value = page.pageIndex
    latestRecordRows.value = page.data
    latestRecordTotal.value = page.total
  }

  function levelLabel(level: number) {
    return levelOptions.value.find((item) => item.value === level)?.label ?? String(level)
  }

  function resetPages() {
    rankPageIndex.value = 0
    latestPageIndex.value = 0
  }

  return {
    loading,
    rows: configRows,
    configRows,
    summaryRecordRows: activeDeviceAlarmStats,
    trendRows,
    rankRows,
    latestRecordRows,
    latestRecordTotal,
    trendRange,
    rankRange,
    total,
    urgentCount,
    recordTotal,
    alarmDeviceCount,
    activeRecordCount,
    topTargets,
    pagedTopTargets,
    levelRows,
    latestRecords,
    pagedLatestRecords,
    rankPageIndex,
    latestPageIndex,
    rankPageTotal,
    latestPageTotal,
    recordTrend,
    load,
    updateTrendRange,
    updateRankRange,
    changeRankPage,
    changeLatestPage,
    levelLabel,
  }
}

function levelState(level: number) {
  if (level <= 2) return 'urgent'
  if (level === 3) return 'watch'
  return 'ok'
}

function pageRows<T>(rows: T[], pageIndex: number, pageSize: number) {
  return rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)
}

function nextPageIndex(current: number, total: number, direction: number) {
  const next = current + direction
  if (next < 0) return Math.max(0, total - 1)
  if (next >= total) return 0
  return next
}

function toRealtimeMessage(row: AlarmRecordRow, levelOptions: AlarmLevelOption[]): RealtimeMessage | undefined {
  const id = String(row.id ?? row.alarmRecordId ?? row.alarmTime ?? '')
  const deviceId = recordDeviceId(row)
  if (!id || !deviceId) return undefined
  const level = enumValue(row.level ?? row.alarmLevel)
  return {
    id,
    deviceId,
    level,
    levelLabel: levelLabel(row.level ?? row.alarmLevel, levelOptions),
    tone: levelTone(Number(level), enumValue(row.state)),
    deviceName: recordDeviceName(row),
    title: displayText(row.alarmName),
    text: displayText(row.actualDesc || row.triggerDesc),
    trigger: displayText(row.triggerDesc),
    duration: formatAlarmDuration(row),
    time: displayText(row.alarmTime ? formatApiTime(new Date(row.alarmTime)) : row.createTime),
    state: enumValue(row.state),
  }
}

function recordDeviceId(row: AlarmRecordRow) {
  return String(row.targetId ?? row.sourceId ?? row.deviceId ?? '').trim()
}

function recordDeviceName(row: AlarmRecordRow) {
  return displayText(row.sourceName || row.targetName || row.deviceName || recordDeviceId(row))
}

function levelTone(level: number, state: string): DashboardTone {
  if (state === 'normal') return 'ok'
  if (level <= 2) return 'err'
  if (level === 3) return 'warn'
  return 'info'
}

function levelLabel(value: unknown, levelOptions: AlarmLevelOption[]) {
  const level = Number(enumValue(value))
  const option = levelOptions.find((item) => item.value === level)
  return option?.label || enumText(value)
}

function formatAlarmDuration(row: AlarmRecordRow) {
  const start = timeValue(row.alarmTime)
  const end = enumValue(row.state) === 'normal' ? timeValue(row.handleTime) : Date.now()
  if (!start || !end || end < start) return '--'
  const seconds = Math.floor((end - start) / 1000)
  if (seconds < 60) return $t('DeviceAlarm.record.second', { seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h`
}

function timeValue(value: unknown) {
  if (!value) return 0
  const time = new Date(typeof value === 'number' ? value : String(value)).getTime()
  return Number.isFinite(time) ? time : 0
}

function enumValue(value: unknown) {
  return value && typeof value === 'object' ? String((value as any).value ?? '') : String(value ?? '')
}

function enumText(value: unknown, fallback = '--') {
  if (value && typeof value === 'object') return String((value as any).text ?? (value as any).value ?? fallback)
  return displayText(value || fallback)
}

function displayText(value: unknown) {
  return value === undefined || value === null || value === '' ? '--' : String(value)
}
