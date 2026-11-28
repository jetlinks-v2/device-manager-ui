import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveFeedback } from '@jetlinks-web-core/components/Editable/useSaveFeedback'
import type { DeviceScopeKind } from './deviceScopeTypes'

export function useDeviceScopeCellEditing(props: {
  kind: DeviceScopeKind; value: string[]; allowed: boolean; disabled: boolean
  loading: boolean; loadError: string; save: (ids: string[]) => Promise<void>
}, onOpenChange: (open: boolean) => void) {
  const { t } = useI18n()
  const open = ref(false), dropdownOpen = ref(false), draft = ref<string[]>([]), saving = ref(false), failure = ref('')
  const dirty = computed(() => open.value && [...draft.value].sort().join('|') !== [...props.value].sort().join('|'))
  const { feedback, resetFeedback, markSaved, minimumFeedback } = useSaveFeedback({ saving: () => saving.value, dirty: () => dirty.value })
  let active = true
  onScopeDispose(() => { active = false })
  watch(open, value => {
    if (value) { draft.value = [...props.value]; failure.value = ''; resetFeedback() }
    dropdownOpen.value = value
    onOpenChange(value)
  })
  watch(() => props.loading, (value, previous) => { if (previous && !value && open.value) draft.value = [...props.value] })
  watch(() => props.allowed, allowed => { if (!allowed) open.value = false })
  function changeOpen(value: boolean) {
    if (saving.value || value && (!props.allowed || props.disabled)) return
    open.value = value
  }
  function changeDropdownOpen(value: boolean) {
    dropdownOpen.value = value
    if (!value && !saving.value && !failure.value) changeOpen(false)
  }
  function changeDraft(value: unknown) {
    draft.value = Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
    failure.value = ''
  }
  async function selectDraft(value: unknown) {
    changeDraft(value)
    if (props.kind === 'area') await submit()
  }
  async function submit() {
    if (saving.value || !props.allowed || props.disabled || props.loading || props.loadError) return
    if (props.kind === 'area' && !draft.value.length) { failure.value = t('IotDeviceList.assignArea.selectRequired'); return }
    if (!dirty.value) { open.value = false; return }
    saving.value = true
    const feedbackWait = minimumFeedback()
    try {
      await props.save([...draft.value])
      await feedbackWait
      if (!active) return
      markSaved()
      open.value = false
    }
    catch (error) {
      await feedbackWait
      if (!active) return
      failure.value = error instanceof Error ? error.message : t('UnifiedDeviceList.actionFailed')
      await nextTick()
      if (open.value && props.allowed) dropdownOpen.value = true
    } finally { if (active) saving.value = false }
  }
  return { open, dropdownOpen, draft, saving, failure, feedback, changeOpen, changeDropdownOpen, changeDraft, selectDraft, submit }
}
