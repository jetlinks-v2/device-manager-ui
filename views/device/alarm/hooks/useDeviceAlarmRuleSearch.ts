import { computed, ref } from 'vue'
import { escapeLikeValue } from '@jetlinks-web-core/components/ConditionFilter'

/** 单个关键词只在提交或清空时生效，输入草稿不会改变分页查询。 */
export function useDeviceAlarmRuleSearch(onSearch: () => void) {
  const keyword = ref('')
  const submitted = ref('')
  const terms = computed(() => submitted.value ? [{
    column: 'keyword',
    termType: 'like',
    // 共享工具处理 % 和反斜杠；补齐 _ 的字面匹配，避免用户文本扩大查询范围。
    value: `%${escapeLikeValue(submitted.value).replace(/_/g, '\\_')}%`,
  }] : [])

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
