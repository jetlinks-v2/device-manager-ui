import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAlarmRecipients } from './useAlarmRecipients'
import { useAlarmDimensionOptions } from './useAlarmDimensionOptions'
import { notificationRecipientGroups, notificationUserIds, recipientGroupKey } from '../notificationRecipients'
import type { DeviceAlarmNotificationConfig, DeviceAlarmNotifyMethod, DeviceAlarmDimensionKind } from '../types'

/** Resolve only saved IDs; preview never loads the candidate directory or changes the draft. */
export function useAlarmNotificationGroups(props: { notification: DeviceAlarmNotificationConfig; methods: DeviceAlarmNotifyMethod[]; scopeKey: string; channelId?: string }) {
  const { t } = useI18n()
  // A channel-local summary hydrates only its own references, including legacy recipient groups.
  const notification = computed(() => props.channelId ? { ...props.notification,
    channelRecipients: notificationRecipientGroups(props.notification, props.methods).filter(group => recipientGroupKey(group) === props.channelId),
    fixedReceiverChannels: props.notification.fixedReceiverChannels?.filter(channel => channel.channelId === props.channelId),
  } : props.notification)
  const directory = reactive(useAlarmRecipients(reactive({
    get value() { return notificationUserIds(notification.value) },
    get scopeKey() { return `${props.scopeKey}:${props.channelId ?? ''}` }, open: false,
  })))
  const targets = useAlarmDimensionOptions(reactive({
    get scopeKey() { return `${props.scopeKey}:${props.channelId ?? ''}` },
    get kinds() { return [...new Set(notificationRecipientGroups(notification.value).flatMap(group => group.dimensions ?? [])
      .map(item => item.type).filter((kind): kind is DeviceAlarmDimensionKind => kind === 'org' || kind === 'role'))] },
  }))
  const groups = computed(() => [
    ...notificationRecipientGroups(notification.value, props.methods).map(group => {
      const id = recipientGroupKey(group)
      return { id, label: props.methods.find(method => method.id === id)?.label ?? t('DeviceAlarm.notification.unavailableChannel'),
        key: props.methods.find(method => method.id === id)?.key,
        fixed: false, dimensions: Boolean(group.dimensions?.length),
        targets: (group.dimensions ?? []).flatMap(item => {
          if (typeof item.type !== 'string' || typeof item.id !== 'string') return []
          const kind = item.type
          const name = kind === 'org' || kind === 'role' ? targets.entries[kind].options.find(option => option.value === item.id)?.label : undefined
          return [{ type: kind, id: item.id, label: `${kind === 'org' || kind === 'role' ? t(`DeviceAlarm.notification.workTarget.${kind}`) : kind} · ${name ?? item.id}` }]
        }),
        users: group.userIds.map(userId => ({ id: userId, name: directory.selected.find(option => option.value === userId)?.label ?? userId })) }
    }),
    ...(notification.value.fixedReceiverChannels ?? []).map(channel => ({ id: channel.channelId,
      key: props.methods.find(method => method.id === channel.channelId)?.key,
      label: props.methods.find(method => method.id === channel.channelId)?.label ?? t('DeviceAlarm.notification.unavailableChannel'),
      fixed: true, dimensions: false, targets: [], users: [] })),
  ])
  return { groups, directory, targets }
}
