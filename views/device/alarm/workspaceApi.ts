import { request } from '@jetlinks-web/core'
import { handlePreconditioning, queryByDevice, queryLogList, queryPreHandleHistory } from '../../../api/rule-engine/log'
import type { DeviceAlarmEvent, HistoryTab } from './workspaceTypes'

export interface AlarmQuery {
  pageIndex: number
  pageSize: number
  terms?: Record<string, unknown>[]
  sorts?: { name: string; order: string }[]
}

function unwrap(response: unknown): unknown {
  return response && typeof response === 'object' && 'result' in response ? response.result : response
}

function pageOf(response: unknown): { data: DeviceAlarmEvent[]; total: number } {
  const value = unwrap(response)
  if (!value || typeof value !== 'object' || !('data' in value) || !Array.isArray(value.data)
    || !('total' in value) || !Number.isFinite(Number(value.total))) throw new Error('Invalid alarm page')
  return { data: value.data as DeviceAlarmEvent[], total: Number(value.total) }
}

/** 预处理 id 由产品、设备范围和属性生成；缺失时不能降级为按名称或设备匹配。 */
export async function queryRuleRecords(ruleId: string | undefined, query: AlarmQuery) {
  return pageOf(await queryByDevice({ ...query, terms: [
    ...(ruleId ? [{ column: 'alarmConfigId', termType: 'eq', value: ruleId }] : []),
    { column: 'alarmConfigSource', termType: 'eq', value: 'device-property-preprocessor' },
    { terms: query.terms || [] },
  ] }))
}

export async function queryRecordHistory(recordId: string, tab: HistoryTab, query: AlarmQuery) {
  if (!recordId) throw new Error('Missing alarm record id')
  const id = encodeURIComponent(recordId)
  return pageOf(await (tab === 'logs' ? queryLogList(id, query) : queryPreHandleHistory(id, query)))
}

/** 只聚合当前页规则，COUNT 为各规则仍在告警的设备记录数，不受右侧搜索影响。 */
export async function queryActiveRuleCounts(ruleIds: string[]): Promise<Record<string, number>> {
  if (!ruleIds.length) return {}
  const value = unwrap(await request.post('/alarm/record/device/_aggregation', {
    columns: [{ column: 'id', alias: 'count', aggregation: 'COUNT' }],
    groupBy: [{ column: 'alarmConfigId', alias: 'alarmConfigId' }],
    limit: ruleIds.length,
    filter: { terms: [
      { column: 'state', termType: 'eq', value: 'warning' },
      { column: 'alarmConfigSource', termType: 'eq', value: 'device-property-preprocessor' },
      { column: 'alarmConfigId', termType: 'in', value: ruleIds },
    ] },
  }))
  if (!Array.isArray(value)) throw new Error('Invalid alarm aggregation')
  const counts: Record<string, number> = Object.fromEntries(ruleIds.map(id => [id, 0]))
  for (const item of value) {
    if (!item || !ruleIds.includes(item.alarmConfigId) || item.count === null || item.count === undefined
      || !Number.isSafeInteger(Number(item.count)) || Number(item.count) < 0) throw new Error('Invalid alarm count')
    counts[item.alarmConfigId] = Number(item.count)
  }
  return counts
}

/** 按设备记录处理；alarmTime 保留触发批次，不能只传规则ID或伪造时间。 */
export async function handleDeviceAlarm(record: DeviceAlarmEvent, description: string) {
  const describe = description.trim()
  if (!record.id || !record.alarmConfigId || !Number.isFinite(record.alarmTime)
    || !describe || describe.length > 200) throw new Error('Invalid alarm handling input')
  const response = await handlePreconditioning({ alarmRecordId: record.id, alarmConfigId: record.alarmConfigId,
    alarmTime: record.alarmTime, describe, type: 'user', state: 'normal' })
  if (response && typeof response === 'object' && 'status' in response && response.status !== 200) {
    throw new Error('Alarm handling failed')
  }
}
