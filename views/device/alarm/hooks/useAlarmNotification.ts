import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getNotificationMessageMode, matchesAlarmNotifyMethod } from '../utils'
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
    get: () => props.model.notification.notifyChannelIds?.length
      ? props.model.notification.notifyChannelIds
      : selectedMethods.value.map(method => method.channelId || method.id),
    set: (values: string[]) => {
      if (props.disabled) return
      const selected = new Set(values)
      const methods = props.methods.filter(method => selected.has(method.channelId || method.id))
      const knownProviders = new Set(props.methods.map(method => method.providerId))
      const hasUnavailable = values.some(id => !props.methods.some(method => (method.channelId || method.id) === id))
      // Explicit saved IDs remain selectable even if a channel has become unavailable.
      const unavailableProviders = hasUnavailable ? props.model.notification.channelProviders.filter(id => !knownProviders.has(id)) : []
      props.model.notification.notifyChannelIds = [...values]
      props.model.notification.channelProviders = [...new Set([...methods.map(method => method.providerId), ...unavailableProviders])]
      syncParameters()
    },
  })
  const channelOptions = computed(() => {
    const options = props.methods.map(method => ({ value: method.channelId || method.id, label: method.label, icon: method.icon }))
    const known = new Set(options.map(option => option.value))
    return [...options, ...channelIds.value.filter(id => !known.has(id)).map(id => ({
      value: id, label: t('DeviceAlarm.notification.unavailableChannel'), icon: 'ExclamationCircleOutlined',
    }))]
  })
  const channelCount = computed(() => channelIds.value.length || props.model.notification.channelProviders.length)
  const channelLabel = computed(() => selectedMethods.value[0]?.label
    ?? (channelCount.value ? t('DeviceAlarm.notification.channelCount', { count: channelCount.value }) : t('DeviceAlarm.notification.channelShort')))
  const channelTitle = computed(() => selectedMethods.value.map(method => method.label).join('、') || channelLabel.value)

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
    if (props.model.notification.enabled) requestMethods()
  }
  /** Rebuild channel parameters while retaining the existing device-specific message template. */
  function syncParameters() {
    const previous = props.model.notification.parameters ?? {}
    const parameters: Record<string, unknown> = {}
    // Unknown providers may belong to unavailable selected channels; retain their configuration.
    for (const provider of props.model.notification.channelProviders) {
      if (Object.prototype.hasOwnProperty.call(previous, provider)) parameters[provider] = previous[provider]
    }
    for (const method of selectedMethods.value) {
      const raw = method.raw ?? {}
      const configuration = raw.channelConfiguration ?? raw.configuration ?? {}
      parameters[method.providerId] = {
        templateId: firstText(configuration.templateId, raw.templateId),
        notifierId: firstText(configuration.notifierId, raw.notifierId),
      }
    }
    for (const key of ['template', 'messageTemplate', 'variableDefinitions']) {
      if (Object.prototype.hasOwnProperty.call(previous, key)) parameters[key] = previous[key]
    }
    props.model.notification.parameters = parameters
  }

  watch(() => props.model, model => {
    activePanel.value = undefined
    // Existing custom content remains editable without introducing a new template mode.
    showLegacyMessageTemplate.value = model.source === 'device' && getNotificationMessageMode(model.notification) === 'custom'
  }, { immediate: true })
  watch(scopeKey, () => { activePanel.value = undefined })
  watch(() => props.disabled, disabled => { if (disabled) activePanel.value = undefined })
  watch(() => props.model.notification.enabled, enabled => { if (!enabled) activePanel.value = undefined })
  watch(activePanel, value => panelChanged(Boolean(value)), { flush: 'sync' })
  watch(() => props.reveal, reveal => {
    if (reveal && !activePanel.value) setPanel(!channelCount.value ? 'channels' : !props.model.notification.userIds.length ? 'recipients' : 'channels', true)
    else if (reveal === false) activePanel.value = undefined
  }, { immediate: true, flush: 'sync' })
  watch(selectedMethods, methods => {
    // Provider-only saved rules gain concrete IDs after options arrive; explicit IDs are authoritative.
    if (props.model.notification.notifyChannelIds?.length || !props.methods.length) return
    const ids = methods.map(method => method.channelId).filter((id): id is string => Boolean(id))
    if (ids.length) props.model.notification.notifyChannelIds = ids
  }, { immediate: true })

  return { activePanel, scopeKey, showLegacyMessageTemplate, channelIds, channelOptions, channelCount, channelLabel, channelTitle, selectedMethods, setPanel, toggleEnabled }
}

function firstText(...values: unknown[]) {
  return values.map(value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '').find(Boolean) || ''
}
