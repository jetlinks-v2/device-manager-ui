import type { DeviceAlarmNotificationConfig, DeviceAlarmChannelRecipients, DeviceAlarmNotifyMethod, DeviceAlarmRecipientSelection } from './types'

const strings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : []
const dimensions = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)).map(item => ({ ...item })) : []

/** Presence selects the new contract: malformed/empty groups must never revive legacy recipients. */
export function normalizeChannelRecipients(value: unknown): DeviceAlarmChannelRecipients[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').map(item => ({
    providerId: typeof item.providerId === 'string' ? item.providerId : '',
    userIds: strings(item.userIds), dimensions: dimensions(item.dimensions),
    ...(Array.isArray(item.notifyChannelIds) ? { notifyChannelIds: strings(item.notifyChannelIds) } : {}),
  })) : []
}

export function recipientGroupKey(group: DeviceAlarmChannelRecipients) {
  return group.providerId || `@channels:${(group.notifyChannelIds ?? []).join(',')}`
}

/** Derive the legacy display without mutating saved data or guessing a channel's provider. */
export function notificationRecipientGroups(notification: DeviceAlarmNotificationConfig, methods: DeviceAlarmNotifyMethod[] = []): DeviceAlarmChannelRecipients[] {
  if (notification.channelRecipients !== undefined) return normalizeChannelRecipients(notification.channelRecipients)
  const groups: DeviceAlarmChannelRecipients[] = notification.channelProviders.map(providerId => ({
    providerId, userIds: [...notification.userIds], dimensions: dimensions(notification.dimensions),
  }))
  const unmapped: string[] = []
  for (const id of notification.notifyChannelIds ?? []) {
    const group = groups.find(group => methods.some(method => method.providerId === group.providerId && method.channelIds?.includes(id)))
    if (group) group.notifyChannelIds = [...(group.notifyChannelIds ?? []), id]
    else unmapped.push(id)
  }
  if (unmapped.length) groups.push({ providerId: '', userIds: [...notification.userIds], dimensions: dimensions(notification.dimensions), notifyChannelIds: unmapped })
  return groups
}

export function groupHasChannel(group: DeviceAlarmChannelRecipients) {
  return Boolean(group.providerId || group.notifyChannelIds?.length)
}
export function groupHasRecipients(group: DeviceAlarmChannelRecipients) {
  return Boolean(group.userIds.length || group.dimensions?.length)
}
export function notificationUserIds(notification: DeviceAlarmNotificationConfig): string[] {
  return [...new Set(notificationRecipientGroups(notification).flatMap(group => group.userIds))]
}

/** An explicit edit migrates personnel groups together; global legacy recipients cannot leak into a new channel. */
export function withNotificationRecipientGroups(notification: DeviceAlarmNotificationConfig, groups: DeviceAlarmChannelRecipients[]): DeviceAlarmNotificationConfig {
  const normalized = normalizeChannelRecipients(groups)
  return { ...notification, channelRecipients: normalized, userIds: [], dimensions: [],
    channelProviders: [...new Set(normalized.map(group => group.providerId).filter(Boolean))],
    notifyChannelIds: [...new Set(normalized.flatMap(group => group.notifyChannelIds ?? []))] }
}

export function notificationIsConfigured(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false
  const value = config as Record<string, unknown>
  const personnel = Object.prototype.hasOwnProperty.call(value, 'channelRecipients')
    ? normalizeChannelRecipients(value.channelRecipients).some(group => groupHasChannel(group) && groupHasRecipients(group))
    : Boolean((strings(value.channelProviders).length || strings(value.notifyChannelIds).length)
      && (strings(value.userIds).length || dimensions(value.dimensions).length))
  return personnel || Boolean(Array.isArray(value.fixedReceiverChannels)
    && value.fixedReceiverChannels.some(channel => channel?.channelId && channel?.templateId))
}

/** Removing one user/group leaves all other channel assignments intact. */
export function removeNotificationRecipient(notification: DeviceAlarmNotificationConfig, selection: DeviceAlarmRecipientSelection, methods: DeviceAlarmNotifyMethod[] = []) {
  const groups = notificationRecipientGroups(notification, methods)
  return withNotificationRecipientGroups({ ...notification,
    fixedReceiverChannels: notification.fixedReceiverChannels?.filter(channel => channel.channelId !== selection.channelId || selection.userId !== undefined || selection.dimension !== undefined),
  }, selection.userId === undefined && selection.dimension === undefined ? groups.filter(group => recipientGroupKey(group) !== selection.channelId)
    : groups.map(group => recipientGroupKey(group) === selection.channelId ? { ...group,
      userIds: group.userIds.filter(id => id !== selection.userId),
      dimensions: group.dimensions?.filter(item => item.type !== selection.dimension?.type || item.id !== selection.dimension?.id),
    } : group))
}
