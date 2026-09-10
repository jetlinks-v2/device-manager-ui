import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { ConditionFilterChangePayload, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { buildQueryFilter } from '@jetlinks-web-core/components/ConditionFilter'
import { queryRuleRecords } from '../workspaceApi'
import type { DeviceAlarmEvent } from '../workspaceTypes'

export function useDeviceAlarmRecords(ruleId: Ref<string | undefined>, t: (key: string) => string) {
  const rows = ref<DeviceAlarmEvent[]>([])
  const total = ref(0)
  const pageIndex = ref(0)
  const pageSize = ref(10)
  const loading = ref(false)
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
  let sequence = 0
  async function load(index = pageIndex.value, size = pageSize.value) {
    const current = ++sequence
    pageIndex.value = index
    pageSize.value = size
    rows.value = []
    total.value = 0
    loading.value = true
    error.value = false
    try {
      const page = await queryRuleRecords(ruleId.value, { pageIndex: index, pageSize: size,
        terms: submitted.value,
        sorts: [{ name: 'lastAlarmTime', order: 'desc' }, { name: 'id', order: 'desc' }] })
      if (sequence !== current) return
      // 处理后若当前过滤结果最后一页消失，回到实际存在的最后一页。
      if (index > 0 && !page.data.length) {
        const lastPage = Math.max(0, Math.ceil(page.total / size) - 1)
        if (lastPage >= index) throw new Error('Inconsistent alarm page')
        await load(lastPage, size)
        return
      }
      rows.value = page.data
      total.value = page.total
    } catch {
      if (sequence === current) error.value = true
    } finally {
      if (sequence === current) loading.value = false
    }
  }
  function search(payload?: ConditionFilterChangePayload) {
    // change.filter 已编码通配符；仅无事件载荷的主动搜索从编辑模型转换一次。
    const filter = payload?.filter ?? buildQueryFilter(terms.value, fields.value)
    submitted.value = Array.isArray(filter.terms) ? filter.terms : []
    void load(0)
  }
  // 保留记录搜索条件，只替换规则范围；左侧搜索不进入该查询模型。
  watch(ruleId, () => { void load(0) }, { immediate: true })
  onBeforeUnmount(() => { sequence += 1 })
  return { rows, total, pageIndex, pageSize, loading, error, terms, fields, load, search }
}
