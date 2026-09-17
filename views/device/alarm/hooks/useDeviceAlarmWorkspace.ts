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
  const creating = ref(false)
  const loadingMore = ref(false)
  const loadMoreError = ref(false)
  // 服务端返回空页时立即停止滚动加载，避免偏移分页在总数不一致时反复请求。
  const exhausted = ref(false)
  const hasMore = computed(() => !exhausted.value && page.rows.value.length < page.total.value)
  let sequence = 0
  let countSequence = 0

  function currentRuleIds() {
    return page.rows.value.map(row => row.id).filter((id): id is string => Boolean(id))
  }

  /** 只保留当前列表仍显示的规则，追加页的并发结果不会被更早的全量结果抹掉。 */
  function mergeCounts(counts: Record<string, number>) {
    const merged = { ...(activeCounts.value ?? {}), ...counts }
    const visible = new Set(currentRuleIds())
    activeCounts.value = Object.fromEntries(Object.entries(merged).filter(([id]) => visible.has(id)))
  }

  async function loadCounts() {
    const current = ++countSequence
    statusError.value = false
    try {
      const counts = await queryActiveRuleCounts(currentRuleIds())
      if (current === countSequence) mergeCounts(counts)
    } catch {
      if (current === countSequence) statusError.value = true
    }
  }

  /** 滚动加载只补充新增规则的数量，已加载结果不被清空。 */
  async function loadMoreCounts(ids: string[]) {
    if (!ids.length) return
    try {
      mergeCounts(await queryActiveRuleCounts(ids))
    } catch {
      statusError.value = true
    }
  }

  function syncSelected() {
    // 左侧搜索/翻页不得悄悄改变右侧范围；仅刷新已选规则的配置快照。
    const updated = page.rows.value.find(row => row.id === selected.value?.id)
    if (updated && selected.value) selected.value = updated
  }

  async function load(index = 0, size = page.pageSize.value) {
    const current = ++sequence
    activeCounts.value = undefined
    exhausted.value = false
    loadMoreError.value = false
    loadingMore.value = false
    page.invalidateList()
    loading.value = true
    listError.value = false
    try {
      await page.tableRequest({ pageIndex: index, pageSize: size })
      if (current !== sequence) return
      syncSelected()
      void loadCounts()
    } catch {
      if (current === sequence) listError.value = true
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  /** 滚动到底部时追加下一页；失败保留已加载列表，由页脚重试。 */
  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    loadMoreError.value = false
    try {
      const result = await page.appendRulePage()
      if (result.stale) return
      if (!result.received) exhausted.value = true
      syncSelected()
      void loadMoreCounts(result.data.map(row => row.id).filter((id): id is string => Boolean(id)))
    } catch {
      loadMoreError.value = true
    } finally {
      loadingMore.value = false
    }
  }

  /** 编辑/删除后重取已加载页范围，保留用户的滚动深度。 */
  async function reloadLoaded() {
    const current = ++sequence
    loadMoreError.value = false
    page.invalidateList()
    loading.value = true
    listError.value = false
    try {
      const result = await page.reloadRuleRange()
      if (current !== sequence || result.stale) return
      syncSelected()
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
  function create() {
    return run(async () => {
      // 操作互斥继续使用 busy，新增加载动画只跟随新增动作。
      creating.value = true
      try { await page.openCreate() } finally { creating.value = false }
    })
  }
  // 搜索/首次加载回到第一页；编辑/删除只重取已加载范围。
  watch(page.searchKey, () => { void load(0) }, { immediate: true })
  watch(page.reloadKey, () => { void reloadLoaded() })
  onBeforeUnmount(() => { sequence += 1; countSequence += 1 })
  return { page, selected, ruleId, activeCounts, statusError, listError, loading, busy, creating,
    loadingMore, loadMoreError, hasMore, load, loadMore, loadCounts, select, showAllRecords, remove, run, create }
}
