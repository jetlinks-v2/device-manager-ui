import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import type { MonitorTimeRange, TimeShortcut, TrendView } from '../types'

/** 日期草稿仅属于当前卡片；确认后才调用原有历史查询入口。 */
export function useTrendTimeControls(view: () => TrendView) {
  const { t } = useI18n()
  const open = ref(false)
  const draft = shallowRef<MonitorTimeRange | null>(null)
  const error = ref('')
  const shortcuts = computed(() => [
    { label: t('components.MonitorTrend.lastHour'), value: 'hour' },
    { label: t('components.MonitorTrend.lastDay'), value: 'day' },
    { label: t('components.MonitorTrend.lastWeek'), value: 'week' },
  ])
  const label = computed(() => shortcuts.value.find(item => item.value === view().shortcut)?.label
    ?? t('components.MonitorTrend.custom'))
  function setOpen(value: boolean) {
    open.value = value && !view().disabled
    if (open.value) {
      draft.value = [view().timeRange[0].clone(), view().timeRange[1].clone()]
      error.value = ''
    }
  }
  function setDraft(value: MonitorTimeRange | [string, string] | null) {
    draft.value = value ? [dayjs(value[0]), dayjs(value[1])] : null
    error.value = ''
  }
  function selectShortcut(value: string | number) {
    if (view().disabled || !['hour', 'day', 'week'].includes(String(value))) return
    view().selectShortcut(value as TimeShortcut)
    open.value = false
  }
  function apply() {
    if (view().disabled) return
    const range = draft.value
    if (!range || range.some(date => !date.isValid())) {
      error.value = t('components.MonitorTrend.selectCompleteRange')
      return
    }
    if (range[0].isAfter(range[1])) {
      error.value = t('components.MonitorTrend.invalidRange')
      return
    }
    view().selectRange([range[0].clone(), range[1].clone()])
    open.value = false
  }
  watch(() => view().disabled, disabled => { if (disabled) open.value = false })
  return { open, draft, error, shortcuts, label, setOpen, setDraft, selectShortcut, apply }
}
