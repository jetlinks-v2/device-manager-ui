import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConditionOptionPanelConfig } from '@jetlinks-web-core/components/ConditionFilter'
import { queryDeviceAlarmNotifyUsers } from '../api'

interface RecipientOption { value: string; label: string; description?: string; icon?: string }
interface RecipientProps { value: string[]; scopeKey: string; open?: boolean; disabled?: boolean }

/** Resolve names and candidates only when the recipient chip is opened. */
export function useAlarmRecipients(props: RecipientProps) {
  const { t } = useI18n()
  const open = ref(false)
  const revision = ref(0)
  const candidateFailed = ref(false)
  const selectedFailed = ref(false)
  const labels = ref(new Map<string, RecipientOption>())
  let generation = 0
  let candidateVersion = 0
  let selectedVersion = 0
  function remember(options: RecipientOption[]) {
    labels.value = new Map([...labels.value, ...options.map(item => [item.value, item] as const)])
    return options
  }
  const options = computed(() => [...labels.value.values()])
  const selected = computed(() => props.value.map(id => labels.value.get(id) ?? { value: id, label: id }))
  const firstSelectedLabel = computed(() => labels.value.get(props.value[0])?.label)
  const selectionLabel = computed(() => firstSelectedLabel.value
    ?? t(props.value.length ? 'DeviceAlarm.notification.recipientCount' : 'DeviceAlarm.notification.userShort', { count: props.value.length }))
  const selectionTitle = computed(() => props.value.length && props.value.every(id => labels.value.has(id))
    ? selected.value.map(user => user.label).join('、') : selectionLabel.value)
  const config = computed<ConditionOptionPanelConfig>(() => {
    // A new loader identity lets the shared panel restart safely after an explicit retry.
    const token = revision.value
    return {
      multiple: true, showCheckAll: false, pageSize: 20, queryDebounce: 260,
      keywordPlaceholder: t('DeviceAlarm.notification.userSearch'), hintText: '',
      loadOptions: async (keyword, page) => {
        const scope = generation
        const request = ++candidateVersion
        try {
          const result = await queryDeviceAlarmNotifyUsers({ keyword, pageIndex: page?.pageIndex, pageSize: 20 })
          if (scope !== generation || token !== revision.value || request !== candidateVersion || !open.value) return []
          candidateFailed.value = false
          return remember(result.data.map(user => ({ value: user.id, label: user.name, description: user.desc, icon: 'UserOutlined' })))
        } catch (error) {
          if (scope === generation && token === revision.value && request === candidateVersion && open.value) candidateFailed.value = true
          throw error
        }
      },
      loadSelectedOptions: async (values) => {
        const scope = generation
        const request = ++selectedVersion
        const ids = (values ?? []).map(String)
        const missing = ids.filter(id => !labels.value.has(id))
        try {
          if (missing.length) {
            const result = await queryDeviceAlarmNotifyUsers({ paging: false, userIds: missing })
            if (scope !== generation || token !== revision.value || request !== selectedVersion || !open.value) return []
            remember(result.data.map(user => ({ value: user.id, label: user.name, description: user.desc, icon: 'UserOutlined' })))
            // Retain unavailable IDs without querying them again for each selection change.
            remember(missing.filter(id => !labels.value.has(id)).map(id => ({ value: id, label: id })))
          }
          if (scope !== generation || token !== revision.value || request !== selectedVersion || !open.value) return []
          selectedFailed.value = false
          return ids.map(id => labels.value.get(id)!)
        } catch (error) {
          if (scope === generation && token === revision.value && request === selectedVersion && open.value) selectedFailed.value = true
          throw error
        }
      },
    }
  })
  function setOpen(value: boolean) {
    if (props.disabled) return
    if (open.value !== value) generation++
    open.value = value
  }
  // Controlled popovers share one active panel; closing invalidates in-flight option responses.
  watch(() => props.open, value => { if (value !== undefined) setOpen(value) }, { immediate: true, flush: 'sync' })
  function retry() {
    generation++
    candidateFailed.value = selectedFailed.value = false
    revision.value++
  }
  watch(() => props.scopeKey, () => {
    generation++
    open.value = false
    candidateFailed.value = selectedFailed.value = false
    labels.value = new Map()
  })
  watch(() => props.disabled, value => { if (value) { generation++; open.value = false } })
  onBeforeUnmount(() => { generation++ })
  return { open, selected, options, config, revision, candidateFailed, selectedFailed, firstSelectedLabel, selectionLabel, selectionTitle, setOpen, retry }
}
