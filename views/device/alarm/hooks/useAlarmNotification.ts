import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getNotificationMessageMode, matchesAlarmNotifyMethod, selectAlarmNotificationTypes } from '../utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../types'

interface NotificationProps {
  model: DeviceAlarmFormModel
  methods: DeviceAlarmNotifyMethod[]
  disabled?: boolean
  reveal?: boolean
}
type NotificationPanel = 'channels' | 'recipients'

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
      props.model.notification = selectAlarmNotificationTypes(props.model.notification, values)
    },
  })
  const channelOptions = computed(() => {
    const options = props.methods.map(method => ({ value: method.providerId, label: method.label, icon: method.icon, templates: method.templates,
      description: t(`DeviceAlarm.delivery.short.${method.key}`) }))
    const known = new Set(options.map(option => option.value))
    return [...options, ...channelIds.value.filter(id => !known.has(id)).map(id => ({
      value: id, label: t('DeviceAlarm.notification.unavailableChannel'), icon: 'ExclamationCircleOutlined', templates: undefined,
      description: t('DeviceAlarm.delivery.unavailableType'),
    }))]
  })
  const channelCount = computed(() => channelIds.value.length || props.model.notification.notifyChannelIds?.length || 0)
  const channelLabel = computed(() => selectedMethods.value[0]?.label
    ?? (channelCount.value ? t('DeviceAlarm.notification.channelCount', { count: channelCount.value }) : t('DeviceAlarm.notification.channelShort')))
  const channelTitle = computed(() => selectedMethods.value.map(method => method.label).join('、') || channelLabel.value)
  const deliveryHints = computed(() => selectedMethods.value.map(method => ({
    id: method.providerId, label: method.label, icon: method.icon, text: t(`DeviceAlarm.delivery.address.${method.key}`),
  })))
  const hasContactType = computed(() => selectedMethods.value.some(method => ['email', 'sms', 'phone'].includes(method.key)))

  /** A closing event from the previous popover must not close the next chip's panel. */
  function setPanel(panel: NotificationPanel, open: boolean) {
    if (props.disabled || !props.model.notification.enabled || (!open && activePanel.value !== panel)) return
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
  // Resolve saved types on first display; the owner deduplicates and caches resource requests.
  watch(() => [scopeKey.value, props.model.notification.enabled] as const, ([, enabled]) => {
    if (enabled) requestMethods()
    else activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  watch(activePanel, value => panelChanged(Boolean(value)), { flush: 'sync' })
  watch(() => props.reveal, reveal => {
    if (reveal && !activePanel.value) setPanel(!channelCount.value ? 'channels' : !props.model.notification.userIds.length ? 'recipients' : 'channels', true)
    else if (reveal === false) activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  return { activePanel, scopeKey, showLegacyMessageTemplate, channelIds, channelOptions, channelCount, channelLabel, channelTitle, selectedMethods, deliveryHints, hasContactType, setPanel, toggleEnabled, setIncludeRelieve }
}
