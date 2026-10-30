import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useSystemStore } from '@jetlinks-web-core/store'
import type { ThingModelProperty, ThingPropertyPreprocess } from '../../alarm/types'
import { createEmptyNotification, isNumberProperty, propertyIdOf, propertyNameOf, toDeviceAlarmRow,
  defaultAlarmLevelOptions, formatPropertyUnit, validateNotificationMessage, DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH } from '../../alarm/utils'
import { availableRuleParts, buildRule, isEmptyRule, parseRule, validateDraft, type RuleDraft, type RuleAddPart } from './codec'
import { readSampling } from './sampling'
import { defaultCondition } from '../../alarm/conditions'
import { readValueRules } from './values/config'
import { loadRules, restoreRule, saveRule, type RuleScope } from './service'
import { useRuleResources } from './useRuleResources'
import { formatRuleDifferenceUnit, summarizeDraft, type RuleSection } from './summary'

export interface RuleEditorProps {
  open: boolean
  scope: RuleScope
  property: ThingModelProperty
  inline?: boolean
  snapshot?: { raw?: ThingPropertyPreprocess; hasOverride: boolean }
}

export function usePropertyRuleEditor(props: RuleEditorProps, close: () => void, changed: () => void | Promise<void>) {
  const { t } = useI18n()
  const permission = useAuthStore()
  const system = useSystemStore()
  const loading = ref(false)
  const failed = ref(false)
  const saving = ref(false)
  const saveFeedback = ref<'idle' | 'saved' | 'error'>('idle')
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined
  const raw = ref<ThingPropertyPreprocess>()
  const hasOverride = ref(false)
  const custom = ref(false)
  const draft = ref<RuleDraft>()
  const initial = ref('')
  const resources = useRuleResources(() => [props.scope.productId, props.scope.deviceId, permission.permissions])
  const activeSection = ref<RuleSection | undefined>('cleaning')
  const notificationOpen = ref(false)
  const alarmNameEditing = ref(false)
  const alarmNameInput = ref<{ focus: () => void }>()
  const alarmNameValue = ref('')
  let generation = 0
  const parsed = computed(() => parseRule(raw.value))
  const numeric = computed(() => isNumberProperty(props.property))
  const type = computed(() => String(props.property.valueType?.type ?? props.property.type ?? props.property.dataType ?? ''))
  const boolean = computed(() => type.value === 'boolean')
  const scalar = computed(() => numeric.value || ['string', 'boolean', 'enum'].includes(type.value))
  const unit = computed(() => formatPropertyUnit(props.property.valueType?.unit))
  const cleaningUnit = computed(() => draft.value?.scaleEnabled ? t('PropertyRules.rawValue') : unit.value)
  const differenceUnit = computed(() => formatRuleDifferenceUnit(props.property, t))
  const cleaningDifferenceUnit = computed(() => draft.value?.scaleEnabled ? t('PropertyRules.rawValue') : differenceUnit.value)
  const cleaningHint = computed(() => draft.value?.scaleEnabled ? t('PropertyRules.rawValueHint') : '')
  const booleanOptions = [{ label: 'true', value: true }, { label: 'false', value: false }]
  const enumOptions = computed(() => (props.property.valueType?.elements ?? []).map(item => ({ value: item.value, label: item.text ?? String(item.value) })))
  const levelOptions = computed(() => resources.levels.value.length ? resources.levels.value : defaultAlarmLevelOptions(t))
  const alarmAvailable = computed(() => Boolean(system.showThreshold))
  const canSave = computed(() => props.scope.canUpdate ?? permission.hasPermission(props.scope.deviceId ? 'device/Instance:update' : 'device/Product:update'))
  const editable = computed(() => canSave.value && custom.value && parsed.value.editable && !loading.value && !failed.value && !saving.value)
  const draftJson = computed(() => JSON.stringify(draft.value))
  const dirty = computed(() => Boolean(draft.value && draftJson.value !== initial.value))
  const pendingSave = computed(() => dirty.value || Boolean(props.scope.deviceId && custom.value && !hasOverride.value))
  const saveState = computed(() => saving.value ? 'saving' : saveFeedback.value !== 'idle' ? saveFeedback.value : pendingSave.value ? 'dirty' : 'idle')
  function clearFeedback() {
    clearTimeout(feedbackTimer)
    saveFeedback.value = 'idle'
  }
  function showSaved() {
    clearFeedback()
    alarmNameEditing.value = false
    saveFeedback.value = 'saved'
    feedbackTimer = setTimeout(clearFeedback, 1800)
  }
  // One active editor owns the feedback; a new edit must never keep an old success/error badge.
  watch(draftJson, () => { if (!saving.value) clearFeedback() }, { flush: 'sync' })
  const source = computed(() => props.scope.deviceId && hasOverride.value
    ? raw.value && isEmptyRule(raw.value) ? 'disabled' : 'device' : raw.value ? 'product' : 'none')
  const steps = computed(() => draft.value ? summarizeDraft(draft.value, props.property, t)
    .filter(step => step.key !== 'alarm' || (scalar.value && (alarmAvailable.value || draft.value!.alarmEnabled)))
    .map(step => step.key === 'cleaning' && !scalar.value ? { ...step, text: t('PropertyRules.unsupportedCleaning') } : step) : [])
  const addableParts = computed(() => draft.value ? availableRuleParts(props.property, {
    values: draft.value.valuesEnabled, range: draft.value.rangeEnabled,
    scale: draft.value.scaleEnabled, file: draft.value.fileEnabled,
    fallback: draft.value.fallbackEnabled,
    step: draft.value.stepEnabled,
    alarm: draft.value.alarmEnabled, sampling: draft.value.samplingEnabled,
  }, alarmAvailable.value) : [])
  function addPart(part: RuleAddPart) {
    if (!editable.value || !draft.value || !addableParts.value.includes(part)) return
    if (part === 'values') draft.value.valuesEnabled = true
    else if (part === 'range') draft.value.rangeEnabled = true
    else if (part === 'scale') draft.value.scaleEnabled = true
    else if (part === 'fallback') draft.value.fallbackEnabled = true
    else if (part === 'step') draft.value.stepEnabled = true
    else if (part === 'file') draft.value.fileEnabled = true
    else if (part === 'alarm') toggleStep(part, true)
    else {
      draft.value.samplingMode = part === 'sampling' ? 'ratio' : part
      toggleStep('sampling', true)
    }
  }

  async function load() {
    const token = ++generation
    clearFeedback()
    alarmNameEditing.value = false
    if (!props.open || !props.scope.productId || !propertyIdOf(props.property)) return
    loading.value = true
    failed.value = false
    draft.value = undefined
    try {
      const id = propertyIdOf(props.property)
      // The list already owns a full snapshot; selecting a row must not repeat its requests.
      const result = props.snapshot ? undefined : await loadRules(props.scope, id)
      if (token !== generation) return
      const own = result?.device.find((item) => item.property === id)
      raw.value = props.snapshot ? props.snapshot.raw : own ?? result?.product.find((item) => item.property === id)
      hasOverride.value = props.snapshot?.hasOverride ?? Boolean(own)
      custom.value = !props.scope.deviceId || hasOverride.value
      const rule = parsed.value
      const alarm = raw.value && toDeviceAlarmRow(raw.value, props.scope.deviceId ? 'device' : 'product', props.scope.name ?? '', props.property)
      draft.value = {
        recordInvalid: raw.value?.configuration?.recordInvalid === true,
        valuesEnabled: Boolean(rule.nodes.values), valuesMode: rule.nodes.values?.configuration.processors[0]?.provider === 'replace-value'
          ? 'replace' : rule.nodes.values?.configuration.matcher.configuration.not ? 'keep' : 'ignore',
        values: [...(rule.nodes.values?.configuration.matcher.configuration.values ?? [])],
        rangeEnabled: Boolean(rule.nodes.range), min: rule.nodes.range?.configuration.matcher.configuration.min,
        max: rule.nodes.range?.configuration.matcher.configuration.max,
        alarmEnabled: Boolean(rule.nodes.alarm),
        alarm: alarm ?? { name: t('PropertyRules.defaultAlarmName', { name: propertyNameOf(props.property) }), source: props.scope.deviceId ? 'device' : 'product',
          targetId: props.scope.deviceId ?? props.scope.productId, productId: props.scope.productId, deviceId: props.scope.deviceId,
          property: id, propertyName: propertyNameOf(props.property), level: 4, ...defaultCondition(props.property), autoRelieve: false, notification: createEmptyNotification() },
        samplingEnabled: Boolean(rule.nodes.sampling), ...readSampling(rule.nodes.sampling),
        scaleEnabled: Boolean(rule.nodes.scale), scale: rule.nodes.scale?.configuration.scale ?? '1', fileEnabled: Boolean(rule.nodes.file),
        ...readValueRules(rule.nodes),
      }
      initial.value = JSON.stringify(draft.value)
      activeSection.value = draft.value.valuesEnabled || draft.value.rangeEnabled ? 'cleaning'
        : draft.value.alarmEnabled ? 'alarm' : draft.value.samplingEnabled ? 'sampling' : 'cleaning'
      notificationOpen.value = false
    } catch { if (token === generation) failed.value = true }
    finally { if (token === generation) loading.value = false }
  }

  async function confirmLeave() {
    if (!dirty.value) return true
    return new Promise<boolean>((resolve) => Modal.confirm({ title: t('PropertyRules.discard'),
      okText: t('PropertyRules.discardAction'), cancelText: t('DeviceAlarm.action.cancel'),
      onOk: () => { resolve(true) }, onCancel: () => { resolve(false) } }))
  }
  async function requestClose() { if (!saving.value && await confirmLeave()) close() }
  /** Keep the same draft when hidden by search/collapse; explicitly guard a different property. */
  async function prepareLeave() {
    if (saving.value || !await confirmLeave()) return false
    discard()
    return true
  }
  function discard() {
    if (saving.value || !initial.value) return
    clearFeedback()
    alarmNameEditing.value = false
    draft.value = JSON.parse(initial.value) as RuleDraft
    custom.value = !props.scope.deviceId || hasOverride.value
  }
  function setNotificationsOpen(value: boolean) {
    notificationOpen.value = value
  }
  async function editAlarmName() {
    if (!editable.value || !draft.value) return
    alarmNameValue.value = draft.value.alarm.name
    alarmNameEditing.value = true
    await nextTick()
    alarmNameInput.value?.focus()
  }
  function setAlarmNameInput(value: unknown) {
    alarmNameInput.value = value && typeof value === 'object' && 'focus' in value && typeof value.focus === 'function'
      ? value as { focus: () => void } : undefined
  }
  function stopAlarmName(cancel = false) {
    if (!alarmNameEditing.value) return
    if (!cancel && editable.value && draft.value && alarmNameValue.value.trim()) draft.value.alarm.name = alarmNameValue.value.trim()
    alarmNameEditing.value = false
  }
  function customize() { custom.value = true }
  function toggleStep(section: RuleSection, enabled: boolean) {
    if (!draft.value || !editable.value || section === 'cleaning' || section === 'processing') return
    if (section === 'alarm') draft.value.alarmEnabled = enabled
    else draft.value.samplingEnabled = enabled
    if (enabled) activeSection.value = section
  }
  function setValues(values: string[]) {
    if (!draft.value) return
    draft.value.values = numeric.value ? values.map(value => value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value) : values
  }
  function clear() {
    if (!draft.value || !editable.value) return
    draft.value.fallbackEnabled = false
    draft.value.stepEnabled = false
    draft.value.valuesEnabled = draft.value.rangeEnabled = draft.value.alarmEnabled = draft.value.samplingEnabled = false
    draft.value.scaleEnabled = draft.value.fileEnabled = false
  }
  async function save() {
    if (!draft.value || !editable.value) return
    const current = draft.value
    const error = validateDraft(current, numeric.value, props.property)
    if (error) {
      // Hidden fields must become visible on failure; reuse the same validator to locate cleaning errors.
      activeSection.value = ['percent', 'interval', 'deadband', 'strategy'].some(key => error === `PropertyRules.validation.${key}`) ? 'sampling'
        : validateDraft({ ...current, alarmEnabled: false, samplingEnabled: false }, numeric.value) ? 'cleaning' : 'alarm'
      message.warning(t(error)); return
    }
    if (current.alarmEnabled && current.alarm.notification.enabled) {
      const notify = current.alarm.notification
      const showNotificationError = () => {
        activeSection.value = 'alarm'
        setNotificationsOpen(true)
      }
      if (!notify.channelProviders.length && !notify.notifyChannelIds?.length) { showNotificationError(); message.warning(t('DeviceAlarm.validation.notifyChannel')); return }
      if (!notify.userIds.length && !notify.dimensions?.length) { showNotificationError(); message.warning(t('DeviceAlarm.validation.notifyUser')); return }
      const error = validateNotificationMessage(notify)
      if (error) { showNotificationError(); message.warning(t(error === 'required' ? 'DeviceAlarm.validation.notifyMessage' : 'DeviceAlarm.validation.notifyMessageMaxLength', { max: DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH })); return }
    }
    saving.value = true
    clearFeedback()
    const token = generation
    const savedTarget = { productId: props.scope.productId, deviceId: props.scope.deviceId, property: propertyIdOf(props.property) }
    const next = buildRule(parsed.value, current)
    const previousSnapshot = props.snapshot
    try {
      await saveRule(props.scope, propertyIdOf(props.property), next)
      if (token !== generation) return
      initial.value = JSON.stringify(current)
      raw.value = !props.scope.deviceId && isEmptyRule(next) ? undefined : next
      hasOverride.value = Boolean(props.scope.deviceId)
      if (!props.inline) message.success(t('PropertyRules.saved'))
      // The write already succeeded. A failed refresh must not become a retryable write failure.
      try {
        await changed()
        if (token !== generation) return
        if (props.inline && props.snapshot !== previousSnapshot) await load()
      } catch { message.warning(t('PropertyRules.refreshFailed')) }
      if (!props.open || props.scope.productId !== savedTarget.productId || props.scope.deviceId !== savedTarget.deviceId || propertyIdOf(props.property) !== savedTarget.property) return
      if (props.inline) showSaved()
      else close()
    } catch {
      if (token === generation) saveFeedback.value = 'error'
      message.error(t('PropertyRules.saveFailed'))
    }
    finally { saving.value = false }
  }
  async function restore() {
    if (!hasOverride.value || !canSave.value || saving.value) return
    const token = generation
    const scope = { ...props.scope }
    const property = propertyIdOf(props.property)
    // Both confirmations belong to the original target; reactive props may change while either is open.
    const isCurrent = () => token === generation && props.open
      && scope.productId === props.scope.productId && scope.deviceId === props.scope.deviceId
      && property === propertyIdOf(props.property)
    if (!await confirmLeave() || !isCurrent()) return
    Modal.confirm({ title: t('PropertyRules.restoreConfirm'), onOk: async () => {
      if (!isCurrent() || saving.value || !hasOverride.value || !canSave.value) return
      saving.value = true
      try {
        await restoreRule(scope, property)
        if (!isCurrent()) return
        initial.value = JSON.stringify(draft.value)
        // A successful deletion must not be reported as a retryable write failure when refresh fails.
        try {
          await changed()
          if (isCurrent()) await load()
        } catch { if (isCurrent()) message.warning(t('PropertyRules.refreshFailed')) }
      } catch { if (isCurrent()) message.error(t('PropertyRules.saveFailed')) }
      finally { saving.value = false }
    } })
  }
  function beforeUnload(event: BeforeUnloadEvent) { if (props.open && dirty.value) event.preventDefault() }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => { generation++; clearFeedback(); window.removeEventListener('beforeunload', beforeUnload) })
  onBeforeRouteLeave(async () => !props.open || (!saving.value && await confirmLeave()))
  onBeforeRouteUpdate(async (to, from) => !props.open
    // Identical query parameters can still refer to a different product/device in the path.
    || (to.path === from.path && to.query.ruleProperty === from.query.ruleProperty && to.query.tab === from.query.tab)
    || (!saving.value && await confirmLeave()))
  watch([() => props.open, () => props.scope.productId, () => props.scope.deviceId, () => propertyIdOf(props.property)], load, { immediate: true })
  return { loading, failed, saving, draft, parsed, numeric, alarmAvailable, canSave, editable, source, hasOverride,
    custom, dirty, pendingSave, saveState, resources, type, boolean, scalar, unit, cleaningUnit, differenceUnit, cleaningDifferenceUnit, cleaningHint, booleanOptions, enumOptions, levelOptions,
    steps, activeSection, notificationOpen, setNotificationsOpen, alarmNameEditing, alarmNameValue, setAlarmNameInput, editAlarmName, stopAlarmName, toggleStep, setValues, addableParts, addPart,
    load, requestClose, prepareLeave, discard, customize, clear, save, restore }
}
