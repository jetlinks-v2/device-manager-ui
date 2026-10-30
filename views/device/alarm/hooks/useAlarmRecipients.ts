import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConditionOptionPanelConfig } from '@jetlinks-web-core/components/ConditionFilter'
import { queryDeviceAlarmNotifyUsers } from '../api'
import { alarmRecipientCacheKey, createAlarmRecipientCache, type AlarmRecipientOption } from './alarmRecipientCache'

interface RecipientProps { value: string[]; scopeKey: string; open?: boolean; disabled?: boolean }

/** Hydrate saved names immediately; search candidates only when the selector is open. */
export function useAlarmRecipients(props: RecipientProps) {
  const { t } = useI18n()
  const shared = inject(alarmRecipientCacheKey, undefined)
  const cache = shared ?? createAlarmRecipientCache()
  const open = ref(false)
  const revision = ref(0)
  const candidateFailed = ref(false)
  const selectedFailed = ref(false)
  const selectedLoading = ref(false)
  let generation = 0
  let candidateVersion = 0
  let selectedVersion = 0
  const displayOption = (option: AlarmRecipientOption): AlarmRecipientOption => option.unavailable
    ? { ...option, label: t('DeviceAlarm.notification.unavailableUser'), icon: 'ExclamationCircleOutlined' } : option
  const options = computed(() => [...cache.options.value.values()].map(displayOption))
  const selected = computed(() => props.value.map(id => displayOption(cache.options.value.get(id) ?? { value: id, label: id })))
  const selectionResolved = computed(() => props.value.length > 0 && props.value.every(id => cache.options.value.has(id)))
  const selectionLabel = computed(() => selectionResolved.value ? selected.value[0]?.label ?? ''
    : t(props.value.length ? 'DeviceAlarm.notification.recipientCount' : 'DeviceAlarm.notification.userShort', { count: props.value.length }))
  const additionalCount = computed(() => selectionResolved.value && props.value.length > 1 ? props.value.length - 1 : 0)
  const selectionTitle = computed(() => selectedFailed.value ? t('DeviceAlarm.notification.usersFailed') : selectionResolved.value
    ? selected.value.map(user => user.unavailable ? `${user.label} (${user.value})` : user.label).join('、') : selectionLabel.value)
  async function hydrate(values: string[]) {
    const scope = generation
    const request = ++selectedVersion
    selectedLoading.value = values.some(id => !cache.options.value.has(id))
    try {
      await cache.load(values)
      if (scope !== generation || request !== selectedVersion) return []
      selectedFailed.value = false
      return values.flatMap(id => {
        const option = cache.options.value.get(id)
        return option ? [displayOption(option)] : []
      })
    } catch (error) {
      if (scope === generation && request === selectedVersion) selectedFailed.value = true
      throw error
    } finally { if (scope === generation && request === selectedVersion) selectedLoading.value = false }
  }
  const config = computed<ConditionOptionPanelConfig>(() => {
    // A new loader identity lets the shared panel restart safely after an explicit retry.
    const token = revision.value
    return {
      multiple: true, showCheckAll: false, pageSize: 20, queryDebounce: 260,
      keywordPlaceholder: t('DeviceAlarm.notification.userSearch'), hintText: '',
      loadOptions: async (keyword, page) => {
        const scope = generation
        const cacheScope = cache.revision.value
        const request = ++candidateVersion
        try {
          const result = await queryDeviceAlarmNotifyUsers({ keyword, pageIndex: page?.pageIndex, pageSize: 20 })
          if (scope !== generation || cacheScope !== cache.revision.value || token !== revision.value || request !== candidateVersion || !open.value) return []
          candidateFailed.value = false
          return cache.remember(result.data.map(user => ({ value: user.id, label: user.name, description: user.desc, icon: 'UserOutlined' })))
        } catch (error) {
          if (scope === generation && cacheScope === cache.revision.value && token === revision.value && request === candidateVersion && open.value) candidateFailed.value = true
          throw error
        }
      },
      loadSelectedOptions: values => hydrate((values ?? []).map(String)),
    }
  })
  function setOpen(value: boolean) {
    if (props.disabled) return
    if (open.value !== value) candidateVersion++
    open.value = value
  }
  // Closing invalidates candidate pages, while selected-name hydration remains useful for the summary.
  watch(() => props.open, value => { if (value !== undefined) setOpen(value) }, { immediate: true, flush: 'sync' })
  function retry() {
    candidateFailed.value = selectedFailed.value = false
    revision.value++
    void hydrate(props.value).catch(() => {})
  }
  watch(() => props.scopeKey, () => {
    generation++
    open.value = false
    candidateFailed.value = selectedFailed.value = false
    if (!shared) cache.reset()
  })
  // Selection-only queries are bounded by saved IDs, including in read-only mode.
  watch([() => props.scopeKey, () => props.value.join('\0'), () => cache.revision.value], () => {
    void hydrate(props.value).catch(() => {})
  }, { immediate: true })
  watch(() => props.disabled, value => { if (value) { candidateVersion++; open.value = false } })
  onBeforeUnmount(() => { generation++; if (!shared) cache.reset() })
  return { open, selected, options, config, revision, candidateFailed, selectedFailed, selectedLoading, selectionLabel, additionalCount, selectionTitle, setOpen, retry }
}
