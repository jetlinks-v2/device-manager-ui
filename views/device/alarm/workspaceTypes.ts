import type { EnumLike } from './types'

/** 记录与日志保存触发时的快照，不能用当前规则信息覆盖。 */
export interface DeviceAlarmEvent {
  id: string
  alarmConfigId?: string
  alarmRecordId?: string
  alarmName?: string
  alarmConfigName?: string
  targetType?: string
  sourceType?: string
  level?: number
  targetName?: string
  sourceName?: string
  state?: EnumLike
  alarmTime?: number
  lastAlarmTime?: number
  actualDesc?: string
  triggerDesc?: string
  handleTime?: number
  handleType?: EnumLike
  handleUserName?: string
  creatorName?: string
  description?: string
  describe?: string
  alarmInfo?: unknown
}

export type HistoryTab = 'logs' | 'handles'
export interface AlarmHistoryState {
  tab: HistoryTab
  rows: DeviceAlarmEvent[]
  total: number
  pageIndex: number
  pageSize: number
  loading: boolean
  error: boolean
}
