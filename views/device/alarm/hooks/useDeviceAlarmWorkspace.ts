import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useDeviceAlarmPage } from './useDeviceAlarmPage'
import { queryActiveRuleCounts } from '../workspaceApi'
import type { DeviceAlarmRow } from '../types'

export function useDeviceAlarmWorkspace(t: (key: string, params?: Record<string, unknown>) => string) {
  const page = useDeviceAlarmPage(t)
  const selected = ref<DeviceAlarmRow>()
  const ruleId = computed(() => selected.value?.id)
  const activeCounts = ref<Record<string, number>>()
  const statusError = ref(false)
  const listError = ref(false)
  const loading = ref(false)
  const busy = ref(false)
  let sequence = 0
  let statusSequence = 0

  async function loadCounts() {
    const current = ++statusSequence
    activeCounts.value = undefined
    statusError.value = false
    const ids = page.rows.value.map(row => row.id).filter((id): id is string => Boolean(id))
    try {
      const counts = await queryActiveRuleCounts(ids)
      if (current === statusSequence) activeCounts.value = counts
    } catch {
      if (current === statusSequence) statusError.value = true
    }
  }

  async function load(index = 0, size = page.pageSize.value) {
    const current = ++sequence
    statusSequence += 1
    activeCounts.value = undefined
    page.invalidateList()
    loading.value = true
    listError.value = false
    try {
      await page.tableRequest({ pageIndex: index, pageSize: size })
      if (current !== sequence) return
      // 左侧搜索/翻页不得悄悄改变右侧范围；仅刷新已选规则的配置快照。
      const updated = page.rows.value.find(row => row.id === selected.value?.id)
      if (updated && selected.value) selected.value = updated
      void loadCounts()
    } catch {
      if (current === sequence) listError.value = true
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  function select(row: DeviceAlarmRow) { if (row.id) selected.value = row }
  function showAllRecords() { selected.value = undefined }
  async function remove(row: DeviceAlarmRow) {
    await page.remove(row)
    if (row.id === selected.value?.id) showAllRecords()
  }
  async function run(action: () => Promise<unknown>) {
    if (busy.value) return
    busy.value = true
    try { await action() } catch { message.error(t('DeviceAlarm.workspace.actionError')) } finally { busy.value = false }
  }
  watch(page.tableParams, () => { void load() }, { immediate: true })
  onBeforeUnmount(() => { sequence += 1; statusSequence += 1 })
  return { page, selected, ruleId, activeCounts, statusError, listError, loading, busy,
    load, loadCounts, select, showAllRecords, remove, run }
}
