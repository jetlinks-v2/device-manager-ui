import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import type { ConditionFilterChangePayload, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { buildQueryFilter } from '@jetlinks-web-core/components/ConditionFilter'
import { queryRuleRecords, type AlarmQuery } from '../workspaceApi'
import type { DeviceAlarmEvent } from '../workspaceTypes'

type RecordPagination = Pick<AlarmQuery, 'pageIndex' | 'pageSize'>
interface RecordResponse {
  success: boolean
  result?: RecordPagination & { data: DeviceAlarmEvent[]; total: number }
}

/** 为 ProTable 提供记录查询、范围隔离与重试；分页和加载状态由表格维护。 */
export function useDeviceAlarmRecords(ruleId: Ref<string | undefined>, t: (key: string) => string) {
  const tableRef = shallowRef<{ reload: () => void }>()
  const error = ref(false)
  const terms = ref<ConditionFilterTerm[]>([])
  const submitted = ref<Record<string, unknown>[]>([])
  const fields = computed<ConditionFilterField[]>(() => [
    { dataIndex: 'alarmName', title: t('DeviceAlarm.record.alarmName'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'sourceName', title: t('DeviceAlarm.record.sourceDevice'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'actualDesc', title: t('DeviceAlarm.record.reason'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'lastAlarmTime', title: t('DeviceAlarm.workspace.lastAlarmTime'), search: { type: 'date' } },
    { dataIndex: 'state', title: t('DeviceAlarm.record.status'), search: { type: 'select', options: [
      { label: t('DeviceAlarm.workspace.warning'), value: 'warning' },
      { label: t('DeviceAlarm.workspace.normal'), value: 'normal' },
    ] } },
  ])
  const revision = ref(0)
  let disposed = false
  // 换范围时重建表格，清空旧记录并回到首页；旧表格的延迟请求不能污染新范围。
  watch([ruleId, submitted], () => { revision.value += 1; error.value = false }, { flush: 'sync' })
  const table = computed(() => {
    const key = revision.value
    const scope = ruleId.value
    const filters = submitted.value
    let sequence = 0
    let latest: Promise<RecordResponse> | undefined
    let lastQuery: RecordPagination | undefined
    let retryQuery: RecordPagination | undefined
    const active = () => !disposed && revision.value === key

    /** 同一表格并发翻页时，旧请求等待最新结果，避免 ProTable 回写过期记录或提前结束加载。 */
    async function query(params: RecordPagination, current: number): Promise<RecordResponse> {
      let index = params.pageIndex
      const size = Number(params.pageSize)
      try {
        while (active()) {
          const page = await queryRuleRecords(scope, { pageIndex: index, pageSize: size,
            terms: filters,
            sorts: [{ name: 'lastAlarmTime', order: 'desc' }, { name: 'id', order: 'desc' }] })
          if (!active()) return { success: false }
          if (sequence !== current) return latest!
          // 处理后当前页可能消失，直接回到有效末页，并把实际页码交还 ProTable。
          if (index > 0 && !page.data.length) {
            const lastPage = Math.max(0, Math.ceil(page.total / size) - 1)
            if (lastPage >= index) throw new Error('Inconsistent alarm page')
            index = lastPage
            continue
          }
          lastQuery = { pageIndex: index, pageSize: size }
          return { success: true, result: { ...page, ...lastQuery } }
        }
      } catch {
        if (active()) {
          if (sequence !== current) return latest!
          error.value = true
        }
      }
      return { success: false }
    }

    /** 请求仅由 ProTable 发起，重试沿用失败页而非表格最后一次成功的页码。 */
    function request(params: RecordPagination): Promise<RecordResponse> {
      if (!active()) return Promise.resolve({ success: false })
      const pagination = retryQuery ?? params
      retryQuery = undefined
      lastQuery = { pageIndex: pagination.pageIndex, pageSize: Number(pagination.pageSize) }
      error.value = false
      latest = query(lastQuery, ++sequence)
      return latest
    }

    /** ProTable.reload 不返回 Promise，由适配层返回本次请求以便处理成功后等待刷新。 */
    function reload() {
      retryQuery = lastQuery
      tableRef.value?.reload()
      return latest
    }
    return { key, request, reload }
  })

  /** 提交筛选仅更新查询范围，交由重建后的 ProTable 发起首页请求。 */
  function search(payload?: ConditionFilterChangePayload) {
    // change.filter 已编码通配符；仅无事件载荷的主动搜索从编辑模型转换一次。
    const filter = payload?.filter ?? buildQueryFilter(terms.value, fields.value)
    submitted.value = Array.isArray(filter.terms) ? filter.terms : []
  }
  /** 重试及处理后刷新共用当前表格的分页上下文。 */
  function reload() { return table.value.reload() }
  onBeforeUnmount(() => { disposed = true })
  return { tableRef, table, error, terms, fields, reload, search }
}
