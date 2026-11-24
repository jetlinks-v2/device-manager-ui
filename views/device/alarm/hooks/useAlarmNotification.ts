import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getNotificationMessageMode, hasPersonnelNotification, matchesAlarmNotifyMethod, selectAlarmNotificationTypes } from '../utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../types'
import { aggregateTemplateState } from '../notificationTemplateStatus'
import { notificationRecipientGroups, recipientGroupKey, withNotificationRecipientGroups, removeNotificationRecipient, notificationIsConfigured, groupHasRecipients } from '../notificationRecipients'
import { alarmRecipientKind, alarmRecipientTargets, withAlarmRecipientTargets, type AlarmRecipientKind } from '../notificationTargets'
import { useAlarmDimensionOptions } from './useAlarmDimensionOptions'

interface NotificationProps {
  model: DeviceAlarmFormModel
  methods: DeviceAlarmNotifyMethod[]
  disabled?: boolean
  loading?: boolean
  failed?: boolean
  reveal?: boolean
  revealChannel?: string
  layout?: 'inline' | 'form'
}
type NotificationPanel = 'channels' | 'recipients'
// Draft identity survives a notification component remount; an explicit clear must stay cleared.
const initializedDrafts = new WeakSet<DeviceAlarmFormModel>()

/** Shared draft selection; opening a chip never loads the entire user directory. */
export function useAlarmNotification(props: NotificationProps, requestMethods: () => void, panelChanged: (open: boolean) => void, grouped = false) {
  const { t } = useI18n()
  const activePanel = ref<NotificationPanel>()
  const selectedChannelId = ref<string>()
  const targetKind = ref<AlarmRecipientKind>()
  const showLegacyMessageTemplate = ref(false)
  const optional = computed(() => props.layout === 'form')
  // 表单中“没有通知”用空选择表达；历史关闭的配置不因打开编辑器重新生效。
  const draftNotification = computed(() => optional.value && !props.model.notification.enabled
    ? { ...props.model.notification, userIds: [], dimensions: [], channelProviders: [], notifyChannelIds: [], fixedReceiverChannels: [], channelRecipients: [] }
    : props.model.notification)
  const scopeKey = computed(() => `${props.model.source}:${props.model.targetId}:${props.model.property}`)
  const selectedMethods = computed(() => props.methods.filter(method => matchesAlarmNotifyMethod(draftNotification.value, method)))
  const channelIds = computed({
    get: () => [...new Set([
      ...draftNotification.value.channelProviders,
      ...(draftNotification.value.fixedReceiverChannels ?? []).map(channel => channel.channelId),
      ...selectedMethods.value.map(method => method.id),
    ])],
    set: (values: string[]) => {
      if (props.disabled) return
      initializedDrafts.add(props.model)
      const available = values.filter(id => props.methods.some(method => method.id === id) || props.model.notification.fixedReceiverChannels?.some(channel => channel.channelId === id))
      props.model.notification = selectAlarmNotificationTypes(props.model.notification, available, props.methods)
      if (!hasPersonnelNotification(props.model.notification) && activePanel.value === 'recipients') activePanel.value = undefined
    },
  })
  const configuredChannelIds = computed(() => [
    ...notificationRecipientGroups(draftNotification.value, props.methods).map(recipientGroupKey),
    ...(draftNotification.value.fixedReceiverChannels ?? []).map(channel => channel.channelId),
  ])
  const channelOptions = computed(() => {
    const options = props.methods.map(method => {
      const fixedHint = method.key === 'webhook' ? 'DeviceAlarm.notification.webhookRecipientHint' : 'DeviceAlarm.notification.robotRecipientHint'
      return { value: method.id, label: method.label, icon: method.icon, fixed: Boolean(method.fixedReceiver),
        templates: method.templates, description: t(method.fixedReceiver ? fixedHint : `DeviceAlarm.delivery.address.${method.key}`) }
    })
    return [...options, ...configuredChannelIds.value.filter(id => !options.some(option => option.value === id))
      .map(value => ({ value, label: t('DeviceAlarm.notification.unavailableChannel'), icon: 'ExclamationCircleOutlined', fixed: Boolean(props.model.notification.fixedReceiverChannels?.some(channel => channel.channelId === value)), templates: undefined, description: '' }))]
  })
  const currentGroup = computed(() => notificationRecipientGroups(draftNotification.value, props.methods).find(group => recipientGroupKey(group) === selectedChannelId.value))
  const currentFixed = computed(() => Boolean(draftNotification.value.fixedReceiverChannels?.some(channel => channel.channelId === selectedChannelId.value)
    || props.methods.find(method => method.id === selectedChannelId.value)?.fixedReceiver))
  const currentRequiresRecipients = computed(() => !currentFixed.value)
  const currentMethod = computed(() => props.methods.find(method => method.id === selectedChannelId.value))
  const currentKind = computed(() => alarmRecipientKind(currentGroup.value, targetKind.value))
  const dimensionOptions = useAlarmDimensionOptions(reactive({
    get scopeKey() { return scopeKey.value },
    get kinds() { return !grouped && props.layout !== 'form' && props.model.notification.enabled && selectedChannelId.value
      && !currentFixed.value && currentKind.value !== 'people' ? [currentKind.value] : [] },
  }))
  const currentTargets = computed(() => alarmRecipientTargets(currentGroup.value, currentMethod.value, currentKind.value,
    currentKind.value === 'people' ? undefined : dimensionOptions.entries[currentKind.value]))
  // Only the active view changes here; targets are committed separately and retain the other kinds.
  function setTargetKind(value: unknown) {
    if (props.disabled || props.loading || props.failed || currentFixed.value
      || value !== 'people' && value !== 'org' && value !== 'role' || !currentTargets.value.kinds.includes(value)) return
    activePanel.value = undefined
    targetKind.value = value
  }
  watch([() => props.model, scopeKey, selectedChannelId], () => { targetKind.value = undefined }, { flush: 'sync' })
  const currentUserIds = computed({
    get: () => currentGroup.value?.userIds ?? [],
    set: (userIds: string[]) => setTargets('people', userIds),
  })
  function setTargets(kind: AlarmRecipientKind, value: unknown) {
    if (props.disabled || props.loading || props.failed || currentFixed.value || !selectedChannelId.value
      || !Array.isArray(value) || !currentTargets.value.kinds.includes(kind)) return
    const method = currentMethod.value
    const current = currentGroup.value ?? (optional.value && method ? { providerId: method.providerId, userIds: [] } : undefined)
    if (!current) return
    const groups = notificationRecipientGroups(draftNotification.value, props.methods)
    const nextGroup = withAlarmRecipientTargets(current, kind, value)
    const others = groups.filter(group => recipientGroupKey(group) !== selectedChannelId.value)
    const updated = groups.some(group => recipientGroupKey(group) === selectedChannelId.value)
      ? groups.map(group => recipientGroupKey(group) === selectedChannelId.value ? nextGroup : group)
      : [...others, nextGroup]
    const next = withNotificationRecipientGroups(draftNotification.value,
      optional.value ? updated.filter(groupHasRecipients) : updated)
    if (optional.value) {
      next.enabled = notificationIsConfigured(next)
      if (method?.personnelChannels) next.personnelChannels = [
        ...(next.personnelChannels ?? []).filter(binding => binding.providerId !== method.providerId), method.personnelChannels,
      ]
    }
    props.model.notification = next
    targetKind.value = kind
  }
  const currentOption = computed(() => channelOptions.value.find(option => option.value === selectedChannelId.value))

  /** Selecting a channel edits its own group; switching channels never clears another group's draft. */
  function selectChannel(id: unknown) {
    if (props.disabled || typeof id !== 'string') return
    const method = props.methods.find(method => method.id === id)
    if (!method && !configuredChannelIds.value.includes(id)) return
    initializedDrafts.add(props.model)
    if (!configuredChannelIds.value.includes(id) && method) {
      const notification = draftNotification.value
      if (method.fixedReceiver) props.model.notification = { ...notification,
        enabled: optional.value || notification.enabled,
        fixedReceiverChannels: [...(notification.fixedReceiverChannels ?? []), { ...method.fixedReceiver }] }
      else if (!optional.value) {
        props.model.notification = withNotificationRecipientGroups(notification,
          [...notificationRecipientGroups(notification, props.methods), { providerId: method.providerId, userIds: [] }])
        if (method.personnelChannels) props.model.notification.personnelChannels = [
          ...(notification.personnelChannels ?? []).filter(binding => binding.providerId !== method.providerId), method.personnelChannels,
        ]
      }
    }
    selectedChannelId.value = id
    activePanel.value = undefined
  }
  function removeSelection(selection: { channelId: string; userId?: string }) {
    if (props.disabled) return
    const next = removeNotificationRecipient(draftNotification.value, selection, props.methods)
    if (optional.value) next.enabled = notificationIsConfigured(next)
    props.model.notification = next
    if (!configuredChannelIds.value.includes(selectedChannelId.value ?? '')) selectedChannelId.value = configuredChannelIds.value[0]
  }
  function removeChannel(id: string) { removeSelection({ channelId: id }) }
  watch([() => props.model, scopeKey], () => { selectedChannelId.value = configuredChannelIds.value[0] }, { flush: 'sync' })
  watch(configuredChannelIds, ids => { if (!selectedChannelId.value || !ids.includes(selectedChannelId.value) && !(optional.value && props.methods.some(method => method.id === selectedChannelId.value))) selectedChannelId.value = ids[0] }, { immediate: true, flush: 'sync' })
  watch(() => props.revealChannel, id => { if (id) selectChannel(id) })
  const requiresRecipients = computed(() => hasPersonnelNotification(props.model.notification))
  const channelCount = computed(() => channelIds.value.length || draftNotification.value.notifyChannelIds?.length || 0)
  // Legacy recovery uses the trigger topic; never turn a template-free selection into configured.
  const selectedTemplateStatus = computed(() => {
    const statuses = channelIds.value.map(id => props.methods.find(method => method.id === id)?.templates)
    const eventStatus = (event: 'trigger' | 'relieve') => aggregateTemplateState(statuses.map(status =>
      status?.[event === 'relieve' && props.model.notification.relieveTopicProvider === 'alarm-device' ? 'trigger' : event] ?? 'unknown'))
    return { trigger: eventStatus('trigger'), relieve: eventStatus('relieve') }
  })
  const channelLabel = computed(() => selectedMethods.value[0]?.label
    ?? (channelCount.value ? t('DeviceAlarm.notification.channelCount', { count: channelCount.value }) : t('DeviceAlarm.notification.channelShort')))
  const channelLabels = computed(() => channelIds.value.map(id => props.methods.find(method => method.id === id)?.label
    ?? t('DeviceAlarm.notification.unavailableChannel')))
  const channelTitle = computed(() => selectedMethods.value.map(method => method.label).join('、') || channelLabel.value)
  const hasContactType = computed(() => props.methods.some(method => ['email', 'sms', 'phone'].includes(method.key)))

  /** A closing event from the previous popover must not close the next chip's panel. */
  function setPanel(panel: NotificationPanel, open: boolean) {
    if (props.disabled || !optional.value && !props.model.notification.enabled || (!open && activePanel.value !== panel)) return
    if (open && panel === 'recipients' && (optional.value ? !selectedChannelId.value || currentFixed.value : !requiresRecipients.value)) return
    activePanel.value = open ? panel : undefined
    if (open && panel === 'channels') requestMethods()
  }
  function toggleEnabled() {
    if (props.disabled) return
    props.model.notification.enabled = !props.model.notification.enabled
    activePanel.value = undefined
  }
  function setIncludeRelieve(value: boolean) {
    if (props.disabled || !props.model.autoRelieve) return
    // Refresh event bindings without dropping unmapped legacy groups or their precise channel IDs.
    if (value) {
      const legacy = props.model.notification
      if (legacy.channelRecipients === undefined && !(legacy.notifyChannelIds ?? []).some(id => !props.methods.some(method => method.channelIds?.includes(id)))) channelIds.value = channelIds.value
      else props.model.notification = withNotificationRecipientGroups(legacy, notificationRecipientGroups(legacy, props.methods))
      props.model.notification.relieveTopicProvider = 'alarm-device-relieve'
      props.model.notification.personnelChannels = props.model.notification.channelProviders.flatMap(id => {
        const binding = props.methods.find(method => method.id === id)?.personnelChannels
          ?? props.model.notification.personnelChannels?.find(binding => binding.providerId === id)
        return binding ? [binding] : []
      })
    }
    props.model.notification.includeRelieve = value
  }

  watch(() => props.model, model => {
    activePanel.value = undefined
    // Existing custom content remains editable without introducing a new template mode.
    showLegacyMessageTemplate.value = model.source === 'device' && getNotificationMessageMode(model.notification) === 'custom'
  }, { immediate: true })
  watch(scopeKey, () => { activePanel.value = undefined })
  watch(() => props.disabled, disabled => { if (disabled) activePanel.value = undefined })
  // Wait for asynchronous availability; never replace a saved selection or reselect after a user clear.
  watch([() => props.model, () => props.model.notification.enabled, () => props.methods, () => props.disabled, () => props.loading], () => {
    if (optional.value || props.disabled || props.loading || !props.model.notification.enabled || initializedDrafts.has(props.model)) return
    if (props.model.id || channelCount.value) { initializedDrafts.add(props.model); return }
    if (props.methods.some(method => method.providerId === 'inside-mail')) channelIds.value = ['inside-mail']
  }, { immediate: true, flush: 'sync' })
  // Resolve saved types on first display; the owner deduplicates and caches resource requests.
  watch([scopeKey, () => props.model.notification.enabled], ([, enabled]) => {
    if (enabled || optional.value) requestMethods()
    else activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  watch(activePanel, value => panelChanged(Boolean(value)), { flush: 'sync' })
  watch(() => props.reveal, reveal => {
    if (grouped) return
    if (reveal && !activePanel.value) setPanel(!channelCount.value ? 'channels' : requiresRecipients.value && !props.model.notification.userIds.length ? 'recipients' : 'channels', true)
    else if (reveal === false) activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  return { selectedChannelId, currentGroup, currentFixed, currentRequiresRecipients, currentUserIds, currentTargets, setTargetKind, setTargets, retryTargets: dimensionOptions.retry, currentOption, configuredChannelIds, selectChannel, removeChannel, removeSelection, requiresRecipients, activePanel, scopeKey, showLegacyMessageTemplate, channelIds, channelOptions, channelCount, selectedTemplateStatus, channelLabel, channelLabels, channelTitle, selectedMethods, hasContactType, setPanel, toggleEnabled, setIncludeRelieve }
}
