import dayjs from 'dayjs'
import { queryDefaultAlarmLevels } from '../../../views/device/alarm/api'
import { iotDeviceDetailRealApi, formatApiTime } from '../../../views/device/list/services/iotDeviceDetailReal.service'
import { recordOf, resultOf, textOf } from './summary'
import type { RecentAlarmRecord } from '../shared'

export function buildAlarmQuery(deviceId: string, limit: number) {
  return { pageIndex: 0, pageSize: limit, sorts: [{ name: 'alarmTime', order: 'desc' }],
    terms: [{ terms: [{ column: 'sourceId', value: deviceId, termType: 'eq' },
      { column: 'targetType', value: 'device', termType: 'eq' }], type: 'and' }] }
}

function durationOf(row: Record<string, unknown>) {
  const start = dayjs(row.alarmTime as string), state = recordOf(row.state).value ?? row.state
  const end = state === 'warning' ? dayjs() : dayjs(row.handleTime as string)
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return '--'
  const seconds = end.diff(start, 'second')
  return seconds < 60 ? `${seconds.toFixed(1)} s` : seconds < 3600 ? `${(seconds / 60).toFixed(1)} min` : `${(seconds / 3600).toFixed(1)} h`
}

/** 告警查询一次、等级字典一次；字典失败沿用接口枚举文案，告警失败交给重试。 */
export async function loadAlarms(deviceId: string, limit: number): Promise<RecentAlarmRecord[]> {
  const [response, levels] = await Promise.all([
    iotDeviceDetailRealApi.queryAlarmByDevice(buildAlarmQuery(deviceId, limit)),
    queryDefaultAlarmLevels().catch(() => []),
  ])
  const result = resultOf(response), rows = Array.isArray(result) ? result : recordOf(result).data
  if (!Array.isArray(rows)) throw new Error('Invalid alarm response')
  return rows.map(recordOf).filter(row => row.id || row.alarmRecordId || row.alarmTime).map(row => {
    const rawLevel = row.level ?? row.alarmLevel, level = recordOf(rawLevel)
    return { id: textOf(row.id || row.alarmRecordId || row.alarmTime), title: textOf(row.alarmName),
      time: formatApiTime(row.alarmTime), duration: durationOf(row),
      level: levels.find(item => item.value === Number(level.value ?? rawLevel))?.label || textOf(level.text ?? level.value ?? rawLevel),
      trigger: textOf(row.triggerDesc), summary: textOf(row.actualDesc || row.triggerDesc) }
  })
}
