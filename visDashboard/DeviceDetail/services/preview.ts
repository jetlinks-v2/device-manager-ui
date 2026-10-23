import type { OverviewSummary, RecentAlarmRecord, RealtimePropertyRow } from '../shared'

/** 设计态使用独立样例，不查真实设备或写入宿主数据。 */
export function previewSummary(): OverviewSummary {
  const buckets = Array.from({ length: 24 }, (_, i) => ({ time: Date.now() - (23 - i) * 3600000, value: 10 + i * 3 }))
  const series = { total: buckets.reduce((sum, item) => sum + item.value, 0), peak: 79, buckets }
  return { activeDuration: { ...series, total: 965400000 }, upstream: series, downstream: { ...series, total: 88 },
    traffic: { ...series, total: 819200, upstreamBytes: 614400, downstreamBytes: 204800 } }
}
export function previewProperties(): RealtimePropertyRow[] {
  return [{ id: 'temperature', identifier: 'temperature', name: 'Temperature', value: '26', unit: '℃', dataType: 'double',
    valueType: { type: 'double' }, accessMode: 'read', writable: false, updatedAt: '--', groupId: '', groupName: '',
    description: '', tone: 'normal', focused: true }]
}
export function previewAlarms(): RecentAlarmRecord[] {
  return []
}
