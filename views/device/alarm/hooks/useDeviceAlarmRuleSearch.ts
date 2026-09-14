import { computed, ref } from 'vue'
import { escapeLikeValue } from '@jetlinks-web-core/components/ConditionFilter'

/** 单个关键词只在提交或清空时生效，输入草稿不会改变分页查询。 */
export function useDeviceAlarmRuleSearch(onSearch: () => void) {
  const keyword = ref('')
  const submitted = ref('')
  const terms = computed(() => {
    if (!submitted.value) return []
    // 共享工具处理 % 和反斜杠；补齐 _ 的字面匹配，避免用户文本扩大查询范围。
    const value = `%${escapeLikeValue(submitted.value).replace(/_/g, '\\_')}%`
    // 名称是接口回填字段，查询需通过现有产品/设备关联条件；OR 收在组内。
    return [{ terms: [
      { column: 'templateId', termType: 'product-info', value: [{ column: 'name', termType: 'like', value }] },
      { column: 'thingId', termType: 'dev-instance', type: 'or', value: [{ column: 'name', termType: 'like', value }] },
      { column: 'property', termType: 'like', type: 'or', value },
    ] }]
  })

  function submit() {
    const next = keyword.value.trim()
    if (next === submitted.value) return
    submitted.value = next
    onSearch()
  }

  function updateKeyword(value: string) {
    keyword.value = value
    if (!value) submit()
  }

  return { keyword, terms, submit, updateKeyword }
}
