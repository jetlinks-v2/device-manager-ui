import type { DeviceAlarmRow } from './types'
import type { DeviceAlarmEvent } from './workspaceTypes'
import { enumValue, formatTriggerText } from './utils'

export function ruleSummary(row: DeviceAlarmRow, t: (key: string, params?: Record<string, unknown>) => string) {
  return t('DeviceAlarm.workspace.ruleSummary', {
    product: row.productName || (row.source === 'product' ? row.targetName : row.productId) || '—',
    device: row.source === 'product' ? t('DeviceAlarm.deviceRange.all') : row.targetName || row.deviceId || '—',
    condition: formatTriggerText({ ...row, propertyName: row.propertyName || row.property }),
  })
}

export function canHandleRecord(record: DeviceAlarmEvent) {
  return enumValue(record.state) === 'warning' && Boolean(record.id && record.alarmConfigId)
    && Number.isFinite(record.alarmTime)
}

export function alarmDuration(record: DeviceAlarmEvent, now: number) {
  const start = record.alarmTime
  const end = enumValue(record.state) === 'warning' ? now : record.handleTime
  // 缺少开始/结束时间不推算为0，不用最近一次告警时间替代本轮开始时间。
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const seconds = (end - start) / 1000
  if (seconds < 60) return `${Math.floor(seconds)} s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}
