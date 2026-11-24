import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { notificationRecipientGroups, recipientGroupKey, removeNotificationRecipient, withNotificationRecipientGroups } from '../notificationRecipients'
import { useAlarmDimensionOptions } from './useAlarmDimensionOptions'
import { alarmRecipientKind, alarmRecipientTargets, withAlarmRecipientTargets, type AlarmRecipientKind } from '../notificationTargets'
import type { DeviceAlarmDimensionKind, DeviceAlarmFormModel, DeviceAlarmNotifyMethod, DeviceAlarmChannelRecipients, DeviceAlarmRecipientSelection } from '../types'

type Kind = AlarmRecipientKind
interface Block { key: number; channelId?: string; kind?: Kind }
export interface AlarmNotificationBlocksProps {
  model: DeviceAlarmFormModel
  methods: DeviceAlarmNotifyMethod[]
  disabled?: boolean
  loading?: boolean
  failed?: boolean
  revealChannel?: string
  compact?: boolean
  reveal?: boolean
}

/** Blocks own only blank UI placeholders; selected channels and targets live in the existing notification draft. */
export function useAlarmNotificationBlocks(props: AlarmNotificationBlocksProps) {
  const { t } = useI18n()
  const blocks = ref<Block[]>([])
  const recipientKey = ref<number>()
  let sequence = 0
  let writing = false
  const elements = new Map<number, HTMLElement>()
  const scopeKey = computed(() => `${props.model.source}:${props.model.targetId}:${props.model.property}`)
  const draft = computed(() => props.compact || props.model.notification.enabled ? props.model.notification : {
    ...props.model.notification, userIds: [], dimensions: [], channelProviders: [], notifyChannelIds: [], channelRecipients: [], fixedReceiverChannels: [], personnelChannels: [],
  })
  const groups = computed(() => notificationRecipientGroups(draft.value, props.methods))
  const selectedIds = computed(() => [...groups.value.map(recipientGroupKey), ...(draft.value.fixedReceiverChannels ?? []).map(item => item.channelId)])
  const groupFor = (block: Block) => groups.value.find(group => recipientGroupKey(group) === block.channelId)
  const methodFor = (block: Block) => props.methods.find(method => method.id === block.channelId)
  function kindFor(block: Block): Kind {
    return alarmRecipientKind(groupFor(block), block.kind)
  }
  const dimensionOptions = useAlarmDimensionOptions(reactive({
    get scopeKey() { return scopeKey.value },
    get kinds() { return [...new Set(blocks.value.filter(block => block.channelId && !methodFor(block)?.fixedReceiver)
      .map(kindFor).filter((kind): kind is DeviceAlarmDimensionKind => kind !== 'people'))] },
  }))
  function sync() {
    if (writing) return
    blocks.value = blocks.value.filter(block => !block.channelId || selectedIds.value.includes(block.channelId))
    for (const id of selectedIds.value) if (!blocks.value.some(block => block.channelId === id)) blocks.value.push({ key: ++sequence, channelId: id })
    if (!blocks.value.length) blocks.value.push({ key: ++sequence })
  }
  watch([() => props.model, scopeKey], () => { recipientKey.value = undefined; blocks.value = []; sync() }, { immediate: true, flush: 'sync' })
  watch(() => selectedIds.value.join('\u0000'), sync, { flush: 'sync' })
  watch(() => props.disabled, value => { if (value) recipientKey.value = undefined })

  function commit(nextGroups: DeviceAlarmChannelRecipients[], fixed = draft.value.fixedReceiverChannels ?? [], method?: DeviceAlarmNotifyMethod) {
    const next = withNotificationRecipientGroups({ ...draft.value, fixedReceiverChannels: fixed }, nextGroups)
    // A selected channel without targets stays enabled so the existing save guard can report the missing target.
    // Inline rules have an explicit switch; clearing channels must not silently toggle it.
    next.enabled = props.compact ? props.model.notification.enabled : Boolean(nextGroups.length || fixed.length)
    if (method?.personnelChannels) next.personnelChannels = [
      ...(next.personnelChannels ?? []).filter(binding => binding.providerId !== method.providerId), method.personnelChannels,
    ]
    writing = true
    props.model.notification = next
    writing = false
  }
  const blocked = () => props.disabled || props.loading || props.failed
  function add() { if (!blocked()) blocks.value.push({ key: ++sequence }) }
  function remove(key: number) {
    if (blocked()) return
    const block = blocks.value.find(item => item.key === key)
    if (!block) return
    if (recipientKey.value === key) recipientKey.value = undefined
    if (block.channelId) commit(groups.value.filter(group => recipientGroupKey(group) !== block.channelId),
      draft.value.fixedReceiverChannels?.filter(item => item.channelId !== block.channelId))
    blocks.value = blocks.value.filter(item => item.key !== key)
    sync()
  }
  function removeRecipient(selection: DeviceAlarmRecipientSelection) {
    if (blocked()) return
    const next = removeNotificationRecipient(draft.value, selection, props.methods)
    commit(notificationRecipientGroups(next, props.methods), next.fixedReceiverChannels)
  }
  function selectChannel(key: number, id: unknown) {
    if (props.disabled || props.loading || props.failed || typeof id !== 'string') return
    const block = blocks.value.find(item => item.key === key)
    const method = props.methods.find(item => item.id === id)
    if (!block || !method || block.channelId === id || blocks.value.some(item => item.key !== key && item.channelId === id)) return
    recipientKey.value = undefined
    const nextGroups = groups.value.filter(group => recipientGroupKey(group) !== block.channelId)
    const fixed = (draft.value.fixedReceiverChannels ?? []).filter(item => item.channelId !== block.channelId)
    if (method.fixedReceiver) fixed.push({ ...method.fixedReceiver })
    else nextGroups.push({ providerId: method.providerId, userIds: [] })
    block.channelId = id
    block.kind = undefined
    commit(nextGroups, fixed, method)
  }
  function setTargets(key: number, kind: Kind, value: unknown) {
    if (blocked() || !Array.isArray(value)) return
    const block = blocks.value.find(item => item.key === key)
    if (!block || !block.channelId || methodFor(block)?.fixedReceiver) return
    const group = groupFor(block)
    if (!group || !items.value.find(item => item.key === key)?.kinds.includes(kind)) return
    const updated = withAlarmRecipientTargets(group, kind, value)
    block.kind = kind
    commit(groups.value.map(item => recipientGroupKey(item) === block.channelId ? updated : item), undefined, methodFor(block))
  }
  function setKind(key: number, value: unknown) {
    if (value !== 'people' && value !== 'org' && value !== 'role') return
    const view = items.value.find(item => item.key === key)
    if (blocked() || !view?.kinds.includes(value)) return
    const block = blocks.value.find(item => item.key === key)
    if (block) { recipientKey.value = undefined; block.kind = value }
  }
  const items = computed(() => blocks.value.map(block => {
    const method = methodFor(block)
    const group = groupFor(block)
    const kind = kindFor(block)
    const directory = kind === 'people' ? undefined : dimensionOptions.entries[kind]
    const targets = alarmRecipientTargets(group, method, kind, directory)
    const channelOptions = props.methods.map(item => ({ value: item.id, label: item.label,
      disabled: blocks.value.some(other => other.key !== block.key && other.channelId === item.id) }))
    if (block.channelId && !method) channelOptions.push({ value: block.channelId, label: t('DeviceAlarm.notification.unavailableChannel'), disabled: true })
    return { ...block, ...targets, channelOptions, method,
      templates: method?.templates ? { ...method.templates, relieve: props.model.notification.relieveTopicProvider === 'alarm-device' ? method.templates.trigger : method.templates.relieve } : undefined,
      fixed: Boolean(method?.fixedReceiver || draft.value.fixedReceiverChannels?.some(item => item.channelId === block.channelId)),
      unavailable: Boolean(block.channelId && !method) }
  }))
  // Summary navigation may mount the editor with reveal already set; wait until block views exist.
  watch(() => props.reveal, value => {
    if (!value) { recipientKey.value = undefined; return }
    const block = items.value.find(item => item.channelId && !item.fixed && !item.unavailable)
    if (block && props.model.notification.enabled && !blocked()) recipientKey.value = block.key
  }, { immediate: true })
  watch(() => props.revealChannel, async id => {
    const block = blocks.value.find(item => item.channelId === id)
    if (block) { await nextTick(); elements.get(block.key)?.scrollIntoView({ block: 'nearest' }) }
  })
  function setRecipientOpen(key: number, open: boolean) {
    if (blocked() || !open && recipientKey.value !== key) return
    recipientKey.value = open ? key : undefined
  }
  return { items, scopeKey, recipientKey, setRecipientOpen, add, remove, removeRecipient, selectChannel, setKind, setTargets, retry: dimensionOptions.retry,
    setElement: (key: number, element: unknown) => { if (element instanceof HTMLElement) elements.set(key, element); else elements.delete(key) } }
}
