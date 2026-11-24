import { request } from '@jetlinks-web/core'
import type { DeviceAlarmChannelRecipients, DeviceAlarmDimensionKind, DeviceAlarmNotifyMethod } from './types'

export type AlarmRecipientKind = 'people' | DeviceAlarmDimensionKind
export interface AlarmRecipientDirectory {
  loading: boolean
  failed: boolean
  options: Array<{ value: string; label: string }>
}

/** A selected kind is a local view; persisted dimensions remain readable after capability changes. */
export function alarmRecipientKind(group?: DeviceAlarmChannelRecipients, preferred?: AlarmRecipientKind): AlarmRecipientKind {
  if (preferred) return preferred
  if (group?.userIds.length) return 'people'
  const type = group?.dimensions?.find(item => item.type === 'org' || item.type === 'role')?.type
  return type === 'org' || type === 'role' ? type : 'people'
}

export function alarmRecipientTargets(group: DeviceAlarmChannelRecipients | undefined, method: DeviceAlarmNotifyMethod | undefined,
  kind: AlarmRecipientKind, directory?: AlarmRecipientDirectory) {
  const kinds: AlarmRecipientKind[] = ['people', ...(method?.recipientKinds ?? [])]
  if (!kinds.includes(kind)) kinds.unshift(kind)
  const ids = kind === 'people' ? group?.userIds ?? [] : (group?.dimensions ?? [])
    .filter(item => item.type === kind && typeof item.id === 'string').map(item => item.id as string)
  const options = [...(directory?.options ?? [])]
  for (const id of ids) if (!options.some(option => option.value === id)) options.push({ value: id, label: id })
  return { kind, kinds, ids, options, directory }
}

/** Editing one recipient kind keeps the other kinds in the same enterprise channel intact. */
export function withAlarmRecipientTargets(group: DeviceAlarmChannelRecipients, kind: AlarmRecipientKind, value: unknown): DeviceAlarmChannelRecipients {
  const ids = Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))] : []
  return kind === 'people'
    ? { ...group, userIds: ids }
    : { ...group, dimensions: [...(group.dimensions ?? []).filter(item => item.type !== kind), ...ids.map(id => ({ type: kind, id }))] }
}

type Row = Record<string, unknown>
const record = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

/** Provider-level groups may narrow targets only when all concrete channels agree. */
export function alarmRecipientKinds(channels: Row[], notifiers: ReadonlyMap<string, Row>): DeviceAlarmDimensionKind[] | undefined {
  const kinds = channels.map(channel => {
    const binding = record(channel.channelConfiguration) ? channel.channelConfiguration : {}
    const config = notifiers.get(text(binding.notifierId))
    if (config?.type === 'weixin' && config.provider === 'corpMessage') return ['org', 'role'] as DeviceAlarmDimensionKind[]
    if (config?.type === 'dingTalk' && config.provider === 'dingTalkMessage') return ['org'] as DeviceAlarmDimensionKind[]
    return undefined
  })
  return kinds.length && kinds.every(value => value?.join() === kinds[0]?.join()) ? kinds[0] : undefined
}

/** Read accessible platform references; neither persist names nor expand dimensions into people. */
export async function queryAlarmRecipientDimensions(kind: DeviceAlarmDimensionKind): Promise<Array<{ value: string; label: string }>> {
  const response: unknown = kind === 'org' ? await request.post('/organization/_all/tree', {})
    : await request.get('/role/_query/no-paging?paging=false')
  const result = record(response) ? response.result ?? response.data : response
  const rows = Array.isArray(result) ? result : record(result) ? result.data : undefined
  if (record(response) && (response.success === false || Number(response.status) >= 400) || !Array.isArray(rows)) throw new Error('Invalid recipient directory')
  const options = new Map<string, string>()
  function visit(row: Row, parent = '') {
    const id = text(row.id)
    const label = [parent, text(row.name) || id].filter(Boolean).join(' / ')
    if (id) options.set(id, label)
    if (kind === 'org' && Array.isArray(row.children)) row.children.filter(record).forEach(child => visit(child, label))
  }
  rows.filter(record).forEach(row => visit(row))
  return [...options].map(([value, label]) => ({ value, label }))
}
