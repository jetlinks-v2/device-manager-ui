<template>
  <section class="device-asset-search">
    <ConditionFilter
      :fields="filterFields"
      :commonFields="commonFilterFields"
      :modelValue="editorTerms"
      :placeholder="placeholder || $t('IotDeviceList.filter.conditionPlaceholder')"
      @update:modelValue="handleFilterTermsUpdate"
      @change="handleFilterSearch"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import ConditionFilter, {
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'

const props = defineProps({
  filterFields: {
    type: Array as PropType<ConditionFilterField[]>,
    default: () => [],
  },
  commonFilterFields: {
    type: Array as PropType<Array<string | { label?: string; value: string }>>,
    default: () => [],
  },
  filterTerms: {
    type: Array as PropType<ConditionFilterTerm[]>,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  (e: 'update:filterTerms', terms: ConditionFilterTerm[]): void
  (e: 'search', payload: { terms: ConditionFilterTerm[] }): void
}>()

const { t: $t } = useI18n()
const latestRawTerms = ref<ConditionFilterTerm[]>([])
const editorTerms = ref<ConditionFilterTerm[]>([])
let skipNextSearch = false

const cloneEditorTerms = (terms: ConditionFilterTerm[] = []): ConditionFilterTerm[] => terms.map((term) => {
  if (Array.isArray(term.terms)) {
    return { ...term, terms: cloneEditorTerms(term.terms as ConditionFilterTerm[]) }
  }

  if (['like', 'nlike'].includes(String(term.termType || '')) && typeof term.value === 'string') {
    const value = term.value
    const rawValue = value.startsWith('%') && value.endsWith('%')
      ? value.slice(1, -1).replace(/\\%/g, '%').replace(/\\\\/g, '\\')
      : value
    return { ...term, value: rawValue }
  }

  return { ...term, value: Array.isArray(term.value) ? [...term.value] : term.value }
})

watch(
  () => props.filterTerms,
  (value) => {
    const nextTerms = cloneEditorTerms(Array.isArray(value) ? value : [])
    latestRawTerms.value = nextTerms
    // 同一编辑态条件不重置 ConditionFilter，避免自动查询后的外部刷新抢走输入焦点。
    if (JSON.stringify(editorTerms.value) !== JSON.stringify(nextTerms)) {
      editorTerms.value = nextTerms
    }
  },
  { immediate: true, deep: true },
)

function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
  const normalized = normalizeSwitchedFieldTerms(terms, latestRawTerms.value)
  latestRawTerms.value = normalized.terms
  editorTerms.value = normalized.terms
  if (normalized.switched) skipNextSearch = true
  emit('update:filterTerms', normalized.terms)
}

function handleFilterSearch(payload?: { terms?: ConditionFilterTerm[] }) {
  if (skipNextSearch) {
    skipNextSearch = false
    return
  }
  // ConditionFilter 的 change 是查询态，like 已带 %；所有上层状态和 URL 只保存编辑态原始值。
  emit('search', { terms: latestRawTerms.value })
}

function normalizeSwitchedFieldTerms(
  nextTerms: ConditionFilterTerm[] = [],
  previousTerms: ConditionFilterTerm[] = [],
): { terms: ConditionFilterTerm[]; switched: boolean } {
  let switched = false
  const previousMap = new Map<string, ConditionFilterTerm>()
  previousTerms.forEach((term, index) => previousMap.set(term.key || String(index), term))

  const terms = nextTerms.map((term, index) => {
    const previous = previousMap.get(term.key || String(index))
    const isSwitched = Boolean(previous?.column && term.column && previous.column !== term.column)

    if (!isSwitched) return term

    switched = true
    return {
      ...term,
      value: undefined,
    }
  })

  return { terms, switched }
}
</script>

<style scoped lang="less">
.device-asset-search{
	width: 100%
}
</style>
