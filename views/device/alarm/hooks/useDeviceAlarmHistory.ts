import { onBeforeUnmount, reactive, ref } from 'vue'
import type { Dayjs } from 'dayjs'
import { queryRecordHistory } from '../workspaceApi'
import type { AlarmHistoryState, DeviceAlarmEvent, HistoryTab } from '../workspaceTypes'

/** 历史查询只在用户打开某张记录卡的弹窗时启动，不绑定左侧规则或右侧分页。 */
export function useDeviceAlarmHistory() {
  const selectedRecord = ref<DeviceAlarmEvent>()
  const open = ref(false)
  const range = ref<[Dayjs, Dayjs] | null>(null)
  const history = reactive<AlarmHistoryState>({ tab: 'logs', rows: [], total: 0, pageIndex: 0, pageSize: 10, loading: false, error: false })
  let sequence = 0
  async function loadHistory() {
    const current = ++sequence
    history.rows = []
    history.total = 0
    history.error = false
    const record = selectedRecord.value
    if (!record || !open.value) { history.loading = false; return }
    history.loading = true
    const column = history.tab === 'logs' ? 'alarmTime' : 'handleTime'
    try {
      const page = await queryRecordHistory(record.id, history.tab, {
        pageIndex: history.pageIndex, pageSize: history.pageSize,
        sorts: [{ name: column, order: 'desc' }, { name: 'id', order: 'desc' }],
        terms: range.value ? [{ column, termType: 'btw', value: range.value.map(time => time.valueOf()) }] : [],
      })
      // 记录、页签、范围、分页或开关弹窗变化后，旧响应不得覆盖新上下文。
      if (current !== sequence) return
      history.rows = page.data
      history.total = page.total
    } catch {
      if (current === sequence) history.error = true
    } finally {
      if (current === sequence) history.loading = false
    }
  }
  function show(record: DeviceAlarmEvent, tab: HistoryTab) {
    selectedRecord.value = record
    open.value = true
    range.value = null
    history.tab = tab
    history.pageIndex = 0
    void loadHistory()
  }
  function close() { open.value = false; sequence += 1; selectedRecord.value = undefined; history.loading = false }
  function changeTab(tab: HistoryTab) { history.tab = tab; history.pageIndex = 0; void loadHistory() }
  function changeRange(value: [Dayjs, Dayjs] | null) { range.value = value; history.pageIndex = 0; void loadHistory() }
  function changePage(index: number, size: number) { history.pageIndex = index; history.pageSize = size; void loadHistory() }
  onBeforeUnmount(() => { sequence += 1 })
  return { selectedRecord, open, range, history, show, close, loadHistory, changeTab, changeRange, changePage }
}
