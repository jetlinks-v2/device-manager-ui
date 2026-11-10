import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getNotificationMessageMode, matchesAlarmNotifyMethod, selectAlarmNotificationTypes } from '../utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../types'
import { aggregateTemplateState } from '../notificationTemplateStatus'

interface NotificationProps {
  model: DeviceAlarmFormModel
  methods: DeviceAlarmNotifyMethod[]
  disabled?: boolean
  loading?: boolean
  reveal?: boolean
}
type NotificationPanel = 'channels' | 'recipients'
// Draft identity survives a notification component remount; an explicit clear must stay cleared.
const initializedDrafts = new WeakSet<DeviceAlarmFormModel>()

/** Shared draft selection; opening a chip never loads the entire user directory. */
export function useAlarmNotification(props: NotificationProps, requestMethods: () => void, panelChanged: (open: boolean) => void) {
  const { t } = useI18n()
  const activePanel = ref<NotificationPanel>()
  const showLegacyMessageTemplate = ref(false)
  const scopeKey = computed(() => `${props.model.source}:${props.model.targetId}:${props.model.property}`)
  const selectedMethods = computed(() => props.methods.filter(method => matchesAlarmNotifyMethod(props.model.notification, method)))
  const channelIds = computed({
    get: () => [...new Set([
      ...props.model.notification.channelProviders,
      ...selectedMethods.value.map(method => method.providerId),
    ])],
    set: (values: string[]) => {
      if (props.disabled) return
      initializedDrafts.add(props.model)
      const available = values.filter(id => props.methods.some(method => method.providerId === id))
      props.model.notification = selectAlarmNotificationTypes(props.model.notification, available)
      if (!available.length && activePanel.value === 'recipients') activePanel.value = undefined
    },
  })
  const channelOptions = computed(() => props.methods.map(method => ({ value: method.providerId, label: method.label,
    icon: method.icon, templates: method.templates, description: t(`DeviceAlarm.delivery.address.${method.key}`) })))
  const channelCount = computed(() => channelIds.value.length || props.model.notification.notifyChannelIds?.length || 0)
  // Legacy recovery uses the trigger topic; never turn a template-free selection into configured.
  const selectedTemplateStatus = computed(() => {
    const statuses = channelIds.value.map(id => props.methods.find(method => method.providerId === id)?.templates)
    const eventStatus = (event: 'trigger' | 'relieve') => aggregateTemplateState(statuses.map(status =>
      status?.[event === 'relieve' && props.model.notification.relieveTopicProvider === 'alarm-device' ? 'trigger' : event] ?? 'unknown'))
    return { trigger: eventStatus('trigger'), relieve: eventStatus('relieve') }
  })
  const channelLabel = computed(() => selectedMethods.value[0]?.label
    ?? (channelCount.value ? t('DeviceAlarm.notification.channelCount', { count: channelCount.value }) : t('DeviceAlarm.notification.channelShort')))
  const channelLabels = computed(() => channelIds.value.map(id => props.methods.find(method => method.providerId === id)?.label
    ?? t('DeviceAlarm.notification.unavailableChannel')))
  const channelTitle = computed(() => selectedMethods.value.map(method => method.label).join('、') || channelLabel.value)
  const hasContactType = computed(() => props.methods.some(method => ['email', 'sms', 'phone'].includes(method.key)))

  /** A closing event from the previous popover must not close the next chip's panel. */
  function setPanel(panel: NotificationPanel, open: boolean) {
    if (props.disabled || !props.model.notification.enabled || (!open && activePanel.value !== panel)) return
    if (open && panel === 'recipients' && !channelCount.value) return
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
    if (value) channelIds.value = channelIds.value
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
    if (props.disabled || props.loading || !props.model.notification.enabled || initializedDrafts.has(props.model)) return
    if (props.model.id || channelCount.value) { initializedDrafts.add(props.model); return }
    if (props.methods.some(method => method.providerId === 'inside-mail')) channelIds.value = ['inside-mail']
  }, { immediate: true, flush: 'sync' })
  // Resolve saved types on first display; the owner deduplicates and caches resource requests.
  watch([scopeKey, () => props.model.notification.enabled], ([, enabled]) => {
    if (enabled) requestMethods()
    else activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  watch(activePanel, value => panelChanged(Boolean(value)), { flush: 'sync' })
  watch(() => props.reveal, reveal => {
    if (reveal && !activePanel.value) setPanel(!channelCount.value ? 'channels' : !props.model.notification.userIds.length ? 'recipients' : 'channels', true)
    else if (reveal === false) activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  return { activePanel, scopeKey, showLegacyMessageTemplate, channelIds, channelOptions, channelCount, selectedTemplateStatus, channelLabel, channelLabels, channelTitle, selectedMethods, hasContactType, setPanel, toggleEnabled, setIncludeRelieve }
}
