<template>
  <section class="device-asset-search">
    <ConditionFilter
      :fields="filterFields"
      :commonFields="commonFilterFields"
      :modelValue="filterTerms"
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
let skipNextSearch = false

watch(
  () => props.filterTerms,
  (value) => {
    latestRawTerms.value = Array.isArray(value) ? value : []
  },
  { immediate: true, deep: true },
)

function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
  const normalized = normalizeSwitchedFieldTerms(terms, latestRawTerms.value)
  latestRawTerms.value = normalized.terms
  if (normalized.switched) skipNextSearch = true
  emit('update:filterTerms', normalized.terms)
}

function handleFilterSearch() {
  if (skipNextSearch) {
    skipNextSearch = false
    return
  }
  const terms = latestRawTerms.value
  emit('update:filterTerms', terms)
  emit('search', { terms })
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
